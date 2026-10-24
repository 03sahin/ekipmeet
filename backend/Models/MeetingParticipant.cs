namespace EkipMeet.Api.Models;

public enum ParticipantRole { Organizer, Participant }

public enum ParticipantResponse { Pending, Accepted, Declined }

// Düzenleyen de bir satır olarak burada (Role = Organizer). Böylece "benim toplantılarım"
// tek bir tablodan sorgulanır ve yetki kontrolü her yerde aynıdır.
public class MeetingParticipant
{
    public Guid MeetingId { get; set; }
    public Meeting Meeting { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public ParticipantRole Role { get; set; } = ParticipantRole.Participant;
    public ParticipantResponse Response { get; set; } = ParticipantResponse.Pending;
    public DateTime? RespondedAt { get; set; }
}
