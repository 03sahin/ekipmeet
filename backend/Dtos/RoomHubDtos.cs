namespace EkipMeet.Api.Dtos;

public record RoomMember(Guid UserId, string DisplayName);

public record RoomMessageResponse(
    long Id,
    int RoomId,
    Guid SenderId,
    string SenderName,
    string Text,
    DateTime SentAt);

// JoinRoom'un dönüşü: içeridekiler + son mesajlar (eskiden yeniye)
public record JoinRoomResponse(int RoomId, List<RoomMember> Members, List<RoomMessageResponse> Messages);
