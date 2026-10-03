namespace GraphFlow.Api.Models;

public sealed class Board
{
    public Guid Id { get; set; }
    public Guid? OwnerId { get; set; }
    public string Title { get; set; } = "Novo board";
    public string Document { get; set; } = "{}";
    public int Version { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
