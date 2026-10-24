using System.ComponentModel.DataAnnotations;

namespace EkipMeet.Api.Models;

public enum ConversationType { Direct, Group }

public class Conversation
{
    public Guid Id { get; set; } = Guid.NewGuid(); // Tahmin edilemez: id'leri deneyerek sohbet aranamasın

    public ConversationType Type { get; set; }

    [MaxLength(100)]
    public string? Name { get; set; } // Sadece grupta dolu; birebirde başlık karşı tarafın adıdır

    // Birebir sohbetin iki kez açılmasını önler: iki kullanıcı id'si sıralanıp birleştirilir, unique index'li.
    // Grupta null (PostgreSQL'de birden fazla null unique index'i bozmaz).
    [MaxLength(80)]
    public string? DirectKey { get; set; }

    public Guid CreatedById { get; set; }
    public User CreatedBy { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastMessageAt { get; set; } = DateTime.UtcNow; // Mesaj yoksa oluşturulma zamanı; liste sıralaması için

    public List<ConversationMember> Members { get; set; } = [];
    public List<ChatMessage> Messages { get; set; } = [];

    public static string CreateDirectKey(Guid a, Guid b) =>
        a.CompareTo(b) < 0 ? $"{a}:{b}" : $"{b}:{a}";
}
