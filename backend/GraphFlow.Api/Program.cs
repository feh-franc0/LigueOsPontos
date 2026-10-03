using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading.RateLimiting;
using GraphFlow.Api.Data;
using GraphFlow.Api.Models;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
var configuration = builder.Configuration;
var requireHttps = !builder.Environment.IsDevelopment() && configuration.GetValue("Security:RequireHttps", true);
var connectionString = configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("Connection string 'Postgres' was not configured.");
const long maxAttachmentBytes = 50L * 1024 * 1024;
const int defaultBoardPageSize = 12;
const int maxBoardPageSize = 50;
var maxBoardsPerAccount = Math.Clamp(configuration.GetValue("Boards:MaxPerAccount", 100), 1, 10_000);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = maxAttachmentBytes + 1024 * 1024);
builder.Services.Configure<FormOptions>(options => options.MultipartBodyLengthLimit = maxAttachmentBytes);

builder.Services.AddDbContext<GraphFlowDbContext>(options => options.UseNpgsql(connectionString));
if (!builder.Environment.IsDevelopment())
{
    var keyPath = Path.GetFullPath(configuration["DataProtection:KeyPath"] ?? "/data/keys");
    Directory.CreateDirectory(keyPath);
    builder.Services.AddDataProtection()
        .PersistKeysToFileSystem(new DirectoryInfo(keyPath))
        .SetApplicationName("GraphFlowIA");
}
builder.Services.AddIdentityCore<AppUser>(options =>
{
    options.User.RequireUniqueEmail = true;
    options.Password.RequiredLength = 12;
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredUniqueChars = 4;
    options.Lockout.AllowedForNewUsers = true;
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
})
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<GraphFlowDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders();
builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme)
    .AddCookie(IdentityConstants.ApplicationScheme, options =>
    {
        options.Cookie.Name = "graphflow.auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.IsEssential = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = requireHttps ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.Events = new()
        {
            OnValidatePrincipal = SecurityStampValidator.ValidatePrincipalAsync,
            OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            },
            OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            }
        };
    });
builder.Services.Configure<SecurityStampValidatorOptions>(options => options.ValidationInterval = TimeSpan.FromMinutes(10));
builder.Services.AddAuthorization();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "graphflow.csrf";
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = requireHttps ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
});
builder.Services.AddProblemDetails();
builder.Services.AddCors(options => options.AddPolicy("web", policy => policy
    .WithOrigins(configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:5173"])
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));
builder.Services.AddRateLimiter(options => options.AddPolicy("auth", context =>
    RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
    {
        PermitLimit = 5, Window = TimeSpan.FromMinutes(10), QueueLimit = 0, AutoReplenishment = true
    })));
builder.Services.Configure<RateLimiterOptions>(options => options.RejectionStatusCode = StatusCodes.Status429TooManyRequests);

var app = builder.Build();
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    if (requireHttps) app.UseHttpsRedirection();
}
app.UseExceptionHandler();
app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        context.Response.Headers.TryAdd("X-Content-Type-Options", "nosniff");
        context.Response.Headers.TryAdd("X-Frame-Options", "DENY");
        context.Response.Headers.TryAdd("Referrer-Policy", "strict-origin-when-cross-origin");
        if (context.Request.Path.StartsWithSegments("/api/auth"))
        {
            context.Response.Headers["Cache-Control"] = "no-store";
            context.Response.Headers["Pragma"] = "no-cache";
        }
        return Task.CompletedTask;
    });
    await next();
});
app.UseCors("web");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

var uploadRoot = Path.GetFullPath(configuration["Storage:Path"] ?? "./storage");
Directory.CreateDirectory(uploadRoot);

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/api/auth/csrf", (IAntiforgery antiforgery, HttpContext context) =>
    Results.Ok(new CsrfResponse(antiforgery.GetAndStoreTokens(context).RequestToken!)));

app.MapGet("/api/auth/me", (ClaimsPrincipal principal) =>
{
    var userId = principal.GetUserId();
    return userId is null ? Results.Unauthorized() : Results.Ok(new AccountResponse(userId.Value, principal.Identity?.Name ?? string.Empty));
}).RequireAuthorization();

app.MapPost("/api/auth/register", async (RegisterRequest request, HttpContext context, IAntiforgery antiforgery, UserManager<AppUser> users, SignInManager<AppUser> signIn) =>
{
    if (await Security.ValidateAntiforgeryAsync(context, antiforgery) is { } csrfError) return csrfError;
    var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
    var fullName = PersonNames.Normalize(request.FullName);
    var phone = PhoneNumbers.Normalize(request.Phone);
    var password = request.Password ?? string.Empty;
    if (string.IsNullOrWhiteSpace(email) || !new EmailAddressAttribute().IsValid(email))
        return Results.BadRequest(new { message = "Informe um e-mail válido." });
    if (fullName is null) return Results.BadRequest(new { message = "Informe seu nome completo." });
    if (phone is null) return Results.BadRequest(new { message = "Informe um telefone válido com DDD." });
    if (!string.Equals(password, request.ConfirmPassword, StringComparison.Ordinal))
        return Results.BadRequest(new { message = "As senhas precisam ser iguais." });
    if (!PasswordPolicy.IsValid(password))
        return Results.BadRequest(new { message = PasswordPolicy.Message });
    if (await users.FindByEmailAsync(email) is not null)
        return Results.Conflict(new { message = "Este e-mail já está cadastrado. Entre na sua conta para continuar." });
    if (await users.Users.AnyAsync(user => user.PhoneNumber == phone))
        return Results.Conflict(new { message = "Este telefone já está vinculado a uma conta." });
    var user = new AppUser { Id = Guid.NewGuid(), UserName = email, Email = email, FullName = fullName, PhoneNumber = phone };
    IdentityResult result;
    try { result = await users.CreateAsync(user, password); }
    catch (DbUpdateException) { return Results.Conflict(new { message = "Não foi possível criar a conta com esses dados." }); }
    if (!result.Succeeded)
        return Results.BadRequest(new { message = PasswordPolicy.Message });
    await signIn.SignInAsync(user, isPersistent: false);
    return Results.Created("/api/auth/me", new AccountResponse(user.Id, user.Email!));
}).RequireRateLimiting("auth");

app.MapPost("/api/auth/login", async (LoginRequest request, HttpContext context, IAntiforgery antiforgery, SignInManager<AppUser> signIn) =>
{
    if (await Security.ValidateAntiforgeryAsync(context, antiforgery) is { } csrfError) return csrfError;
    var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
    var result = await signIn.PasswordSignInAsync(email, request.Password ?? string.Empty, isPersistent: false, lockoutOnFailure: true);
    if (result.IsLockedOut) return Results.StatusCode(StatusCodes.Status429TooManyRequests);
    if (!result.Succeeded) return Results.Unauthorized();
    var user = await signIn.UserManager.FindByEmailAsync(email);
    return Results.Ok(new AccountResponse(user!.Id, user.Email!));
}).RequireRateLimiting("auth");

app.MapPost("/api/auth/logout", async (HttpContext context, IAntiforgery antiforgery, SignInManager<AppUser> signIn) =>
{
    if (await Security.ValidateAntiforgeryAsync(context, antiforgery) is { } csrfError) return csrfError;
    await signIn.SignOutAsync();
    return Results.NoContent();
}).RequireAuthorization();

app.MapGet("/api/boards", async (string? query, DateOnly? updatedFrom, DateOnly? updatedTo, int? utcOffsetMinutes, int? page, int? pageSize, ClaimsPrincipal principal, GraphFlowDbContext db, CancellationToken ct) =>
{
    var userId = principal.RequireUserId();
    var normalizedQuery = (query ?? string.Empty).Trim();
    if (normalizedQuery.Length > 120)
        return Results.BadRequest(new { message = "A busca deve ter no máximo 120 caracteres." });
    if (updatedFrom is { } from && updatedTo is { } to && from > to)
        return Results.BadRequest(new { message = "A data inicial não pode ser posterior à data final." });
    if (utcOffsetMinutes is < -840 or > 840)
        return Results.BadRequest(new { message = "O fuso horário informado não é válido." });

    var currentPage = Math.Max(page.GetValueOrDefault(1), 1);
    var currentPageSize = Math.Clamp(pageSize.GetValueOrDefault(defaultBoardPageSize), 1, maxBoardPageSize);
    var ownedBoards = db.Boards.AsNoTracking().Where(item => item.OwnerId == userId);
    var ownedBoardCount = await ownedBoards.CountAsync(ct);
    var filteredBoards = ownedBoards;
    if (!string.IsNullOrWhiteSpace(normalizedQuery))
    {
        var pattern = $"%{normalizedQuery}%";
        filteredBoards = filteredBoards.Where(item => EF.Functions.ILike(item.Title, pattern));
    }
    if (updatedFrom is { } startDate)
    {
        var start = BoardDates.ToUtc(startDate, utcOffsetMinutes);
        filteredBoards = filteredBoards.Where(item => item.UpdatedAt >= start);
    }
    if (updatedTo is { } endDate)
    {
        var endExclusive = BoardDates.ToUtc(endDate.AddDays(1), utcOffsetMinutes);
        filteredBoards = filteredBoards.Where(item => item.UpdatedAt < endExclusive);
    }

    var totalCount = await filteredBoards.CountAsync(ct);
    var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)currentPageSize));
    currentPage = Math.Min(currentPage, totalPages);
    var boards = await filteredBoards
        .OrderByDescending(item => item.UpdatedAt)
        .ThenByDescending(item => item.Id)
        .Skip((currentPage - 1) * currentPageSize)
        .Take(currentPageSize)
        .Select(item => new BoardSummaryResponse(item.Id, item.Title, item.Version, item.UpdatedAt))
        .ToListAsync(ct);
    return Results.Ok(new BoardListResponse(boards, currentPage, currentPageSize, totalCount, totalPages, ownedBoardCount, maxBoardsPerAccount));
}).RequireAuthorization();

app.MapPost("/api/boards", async (CreateBoardRequest request, HttpContext context, IAntiforgery antiforgery, ClaimsPrincipal principal, GraphFlowDbContext db, CancellationToken ct) =>
{
    if (await Security.ValidateAntiforgeryAsync(context, antiforgery) is { } csrfError) return csrfError;
    var userId = principal.RequireUserId();
    var boardCount = await db.Boards.CountAsync(item => item.OwnerId == userId, ct);
    if (boardCount >= maxBoardsPerAccount)
        return Results.Conflict(new { message = $"Você atingiu o limite de {maxBoardsPerAccount} boards da sua conta." });
    var board = new Board
    {
        Id = Guid.NewGuid(),
        OwnerId = userId,
        Title = BoardTitles.Normalize(request.Title),
        Document = "{\"nodes\":[],\"edges\":[]}",
        Version = 1,
        UpdatedAt = DateTimeOffset.UtcNow
    };
    db.Boards.Add(board);
    await db.SaveChangesAsync(ct);
    return Results.Created($"/api/boards/{board.Id}", new BoardResponse(board.Id, board.Title, board.Document, board.Version, board.UpdatedAt));
}).RequireAuthorization();

app.MapGet("/api/boards/{boardId:guid}", async (Guid boardId, ClaimsPrincipal principal, GraphFlowDbContext db, CancellationToken ct) =>
{
    var userId = principal.RequireUserId();
    var board = await db.Boards.AsNoTracking().SingleOrDefaultAsync(item => item.Id == boardId && item.OwnerId == userId, ct);
    return board is null ? Results.NotFound() : Results.Ok(new BoardResponse(board.Id, board.Title, board.Document, board.Version, board.UpdatedAt));
}).RequireAuthorization();

app.MapPatch("/api/boards/{boardId:guid}/title", async (Guid boardId, RenameBoardRequest request, HttpContext context, IAntiforgery antiforgery, ClaimsPrincipal principal, GraphFlowDbContext db, CancellationToken ct) =>
{
    if (await Security.ValidateAntiforgeryAsync(context, antiforgery) is { } csrfError) return csrfError;
    if (string.IsNullOrWhiteSpace(request.Title)) return Results.BadRequest(new { message = "O título do board não pode ficar vazio." });
    var board = await db.Boards.SingleOrDefaultAsync(item => item.Id == boardId && item.OwnerId == principal.RequireUserId(), ct);
    if (board is null) return Results.NotFound();
    board.Title = BoardTitles.Normalize(request.Title);
    board.Version++;
    board.UpdatedAt = DateTimeOffset.UtcNow;
    await db.SaveChangesAsync(ct);
    return Results.Ok(new BoardSummaryResponse(board.Id, board.Title, board.Version, board.UpdatedAt));
}).RequireAuthorization();

app.MapDelete("/api/boards/{boardId:guid}", async (Guid boardId, HttpContext context, IAntiforgery antiforgery, ClaimsPrincipal principal, GraphFlowDbContext db, CancellationToken ct) =>
{
    if (await Security.ValidateAntiforgeryAsync(context, antiforgery) is { } csrfError) return csrfError;
    var userId = principal.RequireUserId();
    var board = await db.Boards.SingleOrDefaultAsync(item => item.Id == boardId && item.OwnerId == userId, ct);
    if (board is null) return Results.NotFound();
    db.Boards.Remove(board);
    await db.SaveChangesAsync(ct);
    return Results.NoContent();
}).RequireAuthorization();

app.MapPut("/api/boards/{boardId:guid}", async (Guid boardId, SaveBoardRequest request, HttpContext context, IAntiforgery antiforgery, ClaimsPrincipal principal, GraphFlowDbContext db, CancellationToken ct) =>
{
    if (await Security.ValidateAntiforgeryAsync(context, antiforgery) is { } csrfError) return csrfError;
    if (string.IsNullOrWhiteSpace(request.Document) || request.Document.Length > 10_000_000)
        return Results.BadRequest(new { message = "O documento do board é obrigatório e deve ter até 10 MB." });
    try
    {
        using var document = JsonDocument.Parse(request.Document);
        if (document.RootElement.ValueKind is not JsonValueKind.Object)
            return Results.BadRequest(new { message = "O documento do board deve ser um objeto JSON." });
    }
    catch (JsonException) { return Results.BadRequest(new { message = "O documento do board não contém JSON válido." }); }

    var userId = principal.RequireUserId();
    var board = await db.Boards.SingleOrDefaultAsync(item => item.Id == boardId && item.OwnerId == userId, ct);
    if (board is null) return Results.NotFound();
    board.Document = request.Document;
    board.Version++;
    board.UpdatedAt = DateTimeOffset.UtcNow;
    await db.SaveChangesAsync(ct);
    return Results.Ok(new BoardResponse(board.Id, board.Title, board.Document, board.Version, board.UpdatedAt));
}).RequireAuthorization();

app.MapPost("/api/attachments", async (HttpRequest request, HttpContext context, IAntiforgery antiforgery, ClaimsPrincipal principal, GraphFlowDbContext db, CancellationToken ct) =>
{
    if (await Security.ValidateAntiforgeryAsync(context, antiforgery) is { } csrfError) return csrfError;
    if (!request.HasFormContentType) return Results.BadRequest(new { message = "Envie o arquivo como multipart/form-data." });
    IFormCollection form;
    try { form = await request.ReadFormAsync(ct); }
    catch (InvalidDataException) { return Results.BadRequest(new { message = "O limite por arquivo é 50 MB." }); }
    var file = form.Files.GetFile("file");
    if (file is null || file.Length == 0) return Results.BadRequest(new { message = "Selecione um arquivo." });
    if (file.Length > maxAttachmentBytes) return Results.BadRequest(new { message = "O limite por arquivo é 50 MB." });
    var safeName = Path.GetFileName(file.FileName.Replace('\\', '/'));
    var extension = Path.GetExtension(safeName).ToLowerInvariant();
    var contentType = extension switch
    {
        ".png" => "image/png", ".jpg" or ".jpeg" => "image/jpeg", ".webp" => "image/webp",
        ".gif" => "image/gif", ".pdf" => "application/pdf", ".txt" or ".md" => "text/plain",
        ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".csv" => "text/csv", ".mp3" => "audio/mpeg", ".wav" => "audio/wav",
        ".m4a" => "audio/mp4", ".ogg" => "audio/ogg", ".mp4" => "video/mp4",
        ".mov" => "video/quicktime", _ => null
    };
    if (contentType is null) return Results.BadRequest(new { message = "Este tipo de arquivo não é permitido." });
    if (safeName.Length > 255) safeName = safeName[..(255 - extension.Length)] + extension;
    var id = Guid.NewGuid();
    var storageName = $"{id:N}{extension}";
    var storagePath = Path.Combine(uploadRoot, storageName);
    await using (var output = File.Create(storagePath)) await file.CopyToAsync(output, ct);
    string checksum;
    await using (var stream = File.OpenRead(storagePath)) checksum = Convert.ToHexString(await SHA256.HashDataAsync(stream, ct)).ToLowerInvariant();
    var attachment = new Attachment
    {
        Id = id, OwnerId = principal.RequireUserId(), OriginalName = safeName, StorageName = storageName,
        ContentType = contentType,
        SizeBytes = file.Length, Sha256 = checksum
    };
    db.Attachments.Add(attachment);
    await db.SaveChangesAsync(ct);
    return Results.Created($"/api/attachments/{id}", new AttachmentResponse(attachment.Id, attachment.OriginalName, attachment.ContentType, attachment.SizeBytes, attachment.Sha256, $"/api/attachments/{attachment.Id}/content", attachment.CreatedAt));
}).RequireAuthorization();

app.MapGet("/api/attachments/{attachmentId:guid}/content", async (Guid attachmentId, ClaimsPrincipal principal, GraphFlowDbContext db, CancellationToken ct) =>
{
    var attachment = await db.Attachments.AsNoTracking().SingleOrDefaultAsync(item => item.Id == attachmentId && item.OwnerId == principal.RequireUserId(), ct);
    if (attachment is null) return Results.NotFound();
    var path = Path.Combine(uploadRoot, attachment.StorageName);
    return File.Exists(path) ? Results.File(path, attachment.ContentType, attachment.OriginalName, enableRangeProcessing: true) : Results.NotFound();
}).RequireAuthorization();

await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<GraphFlowDbContext>();
    await db.Database.MigrateAsync();
}
app.Run();

public sealed record SaveBoardRequest(string Document);
public sealed record CreateBoardRequest(string? Title);
public sealed record RenameBoardRequest(string? Title);
public sealed record RegisterRequest(string? FullName, string? Phone, string? Email, string? Password, string? ConfirmPassword);
public sealed record LoginRequest(string? Email, string? Password);
public sealed record CsrfResponse(string Token);
public sealed record AccountResponse(Guid Id, string Email);
public sealed record BoardResponse(Guid Id, string Title, string Document, int Version, DateTimeOffset UpdatedAt);
public sealed record BoardSummaryResponse(Guid Id, string Title, int Version, DateTimeOffset UpdatedAt);
public sealed record BoardListResponse(IReadOnlyList<BoardSummaryResponse> Items, int Page, int PageSize, int TotalCount, int TotalPages, int OwnedBoardCount, int MaxBoards);
public sealed record AttachmentResponse(Guid Id, string Name, string ContentType, long SizeBytes, string Sha256, string Url, DateTimeOffset CreatedAt);

file static class ClaimsPrincipalExtensions
{
    public static Guid? GetUserId(this ClaimsPrincipal principal) => Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ? userId : null;
    public static Guid RequireUserId(this ClaimsPrincipal principal) => principal.GetUserId() ?? throw new UnauthorizedAccessException();
}

file static class Security
{
    public static async Task<IResult?> ValidateAntiforgeryAsync(HttpContext context, IAntiforgery antiforgery)
    {
        try
        {
            await antiforgery.ValidateRequestAsync(context);
            return null;
        }
        catch (AntiforgeryValidationException)
        {
            return Results.BadRequest(new { message = "A validação de segurança da requisição falhou." });
        }
    }
}

file static class BoardTitles
{
    public static string Normalize(string? value)
    {
        var normalized = string.Join(" ", (value ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return string.IsNullOrWhiteSpace(normalized) ? "Novo board" : normalized[..Math.Min(normalized.Length, 160)];
    }
}

file static class BoardDates
{
    public static DateTimeOffset ToUtc(DateOnly date, int? utcOffsetMinutes)
    {
        var localOffset = TimeSpan.FromMinutes(-utcOffsetMinutes.GetValueOrDefault(0));
        return new DateTimeOffset(date.ToDateTime(TimeOnly.MinValue), localOffset).ToUniversalTime();
    }
}

file static class PersonNames
{
    public static string? Normalize(string? value)
    {
        var normalized = string.Join(" ", (value ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return normalized.Length is >= 2 and <= 120 ? normalized : null;
    }
}

file static class PhoneNumbers
{
    public static string? Normalize(string? value)
    {
        var digits = new string((value ?? string.Empty).Where(char.IsDigit).ToArray());
        if (digits.Length is < 10 or > 15) return null;
        return $"+{digits}";
    }
}

file static class PasswordPolicy
{
    public const string Message = "Use pelo menos 12 caracteres, com letra maiúscula, minúscula, número e símbolo.";

    public static bool IsValid(string? password) =>
        password is { Length: >= 12 } &&
        password.Any(char.IsUpper) &&
        password.Any(char.IsLower) &&
        password.Any(char.IsDigit) &&
        password.Any(character => !char.IsLetterOrDigit(character)) &&
        password.Distinct().Count() >= 4;
}
