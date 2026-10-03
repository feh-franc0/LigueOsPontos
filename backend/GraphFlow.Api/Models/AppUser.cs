using Microsoft.AspNetCore.Identity;

namespace GraphFlow.Api.Models;

public sealed class AppUser : IdentityUser<Guid>
{
    public string? FullName { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
