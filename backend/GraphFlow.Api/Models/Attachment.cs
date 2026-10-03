namespace GraphFlow.Api.Models;

public sealed class Attachment
{
    public Guid Id { get; set; }
    public Guid? OwnerId { get; set; }
    public string OriginalName { get; set; } = string.Empty;
    public string StorageName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string Sha256 { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
