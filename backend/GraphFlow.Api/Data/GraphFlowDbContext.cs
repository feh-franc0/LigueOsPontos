using GraphFlow.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace GraphFlow.Api.Data;

public sealed class GraphFlowDbContext(DbContextOptions<GraphFlowDbContext> options)
    : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<Board> Boards => Set<Board>();
    public DbSet<Attachment> Attachments => Set<Attachment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.ToTable("users");
            entity.Property(item => item.FullName).HasMaxLength(120);
            entity.HasIndex(item => item.PhoneNumber).IsUnique();
        });
        modelBuilder.Entity<IdentityRole<Guid>>(entity => entity.ToTable("roles"));
        modelBuilder.Entity<IdentityUserRole<Guid>>(entity => entity.ToTable("user_roles"));
        modelBuilder.Entity<IdentityUserClaim<Guid>>(entity => entity.ToTable("user_claims"));
        modelBuilder.Entity<IdentityUserLogin<Guid>>(entity => entity.ToTable("user_logins"));
        modelBuilder.Entity<IdentityRoleClaim<Guid>>(entity => entity.ToTable("role_claims"));
        modelBuilder.Entity<IdentityUserToken<Guid>>(entity => entity.ToTable("user_tokens"));
        modelBuilder.Entity<Board>(entity =>
        {
            entity.ToTable("boards");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Title).HasMaxLength(160).HasDefaultValue("Novo board");
            entity.Property(item => item.Document).HasColumnType("jsonb");
            entity.Property(item => item.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(item => new { item.OwnerId, item.UpdatedAt });
        });
        modelBuilder.Entity<Attachment>(entity =>
        {
            entity.ToTable("attachments");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.OriginalName).HasMaxLength(255);
            entity.Property(item => item.StorageName).HasMaxLength(128);
            entity.Property(item => item.ContentType).HasMaxLength(128);
            entity.Property(item => item.Sha256).HasMaxLength(64);
            entity.HasIndex(item => item.Sha256);
            entity.HasIndex(item => item.OwnerId);
        });
    }
}
