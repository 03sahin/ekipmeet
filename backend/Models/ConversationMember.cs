namespace EkipMeet.Api.Models;

public enum MemberRole { Owner, Member }

public class ConversationMember
{
    public Guid ConversationId { get; set; }
    public Conversation Conversation { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public MemberRole Role { get; set; } = MemberRole.Member;

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    // Bu andan sonra gelen (başkalarının) mesajları okunmamış sayılır.
    // Katılırken JoinedAt ile aynı başlar; böylece gruba eklenince eski geçmiş "okunmamış" görünmez.
    public DateTime LastReadAt { get; set; } = DateTime.UtcNow;
}
