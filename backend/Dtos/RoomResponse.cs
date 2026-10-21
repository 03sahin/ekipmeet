namespace EkipMeet.Api.Dtos;

public record RoomResponse(
    int Id,
    string Name,
    string Topic,
    Guid OwnerId,
    string OwnerName,
    bool IsOwner,
    DateTime CreatedAt,
    DateTime? UpdatedAt);