namespace EkipMeet.Api.Dtos;

// İstemciye dönen veri. Sadece göstermek istediğimiz alanlar.
public record RoomResponse(int Id, string Name, string Topic, DateTime CreatedAt);