using System.ComponentModel.DataAnnotations;
using EkipMeet.Api.Models;

namespace EkipMeet.Api.Dtos;

// Aramada sadece id + ad döner; e-posta gibi kişisel bilgiler sızmasın
public record UserSummary(Guid Id, string DisplayName);

public record LastMessagePreview(Guid SenderId, string SenderName, string Text, DateTime CreatedAt);

// Sohbet listesindeki bir satır
public record ConversationSummary(
    Guid Id,
    ConversationType Type,
    string Title,
    LastMessagePreview? LastMessage,
    DateTime LastMessageAt,
    int UnreadCount);

public record ConversationMemberResponse(Guid UserId, string DisplayName, MemberRole Role, DateTime JoinedAt);

public record ConversationDetail(
    Guid Id,
    ConversationType Type,
    string Title,
    MemberRole MyRole,
    DateTime CreatedAt,
    List<ConversationMemberResponse> Members);

public record ChatMessageResponse(
    long Id,
    Guid ConversationId,
    Guid SenderId,
    string SenderName,
    string Text,
    DateTime CreatedAt);

public class CreateDirectRequest
{
    [Required(ErrorMessage = "Kullanıcı seçilmedi.")]
    public Guid? UserId { get; set; }
}

public class CreateGroupRequest
{
    [Required(ErrorMessage = "Grup adı zorunludur.")]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(50, ErrorMessage = "Bir grup en fazla 50 kişiyle oluşturulabilir.")]
    public List<Guid> MemberIds { get; set; } = [];
}

public class SendChatMessageRequest
{
    [Required(ErrorMessage = "Mesaj boş olamaz.")]
    [MaxLength(1000, ErrorMessage = "Mesaj en fazla 1000 karakter olabilir.")]
    public string Text { get; set; } = string.Empty;
}

public class AddMemberRequest
{
    [Required(ErrorMessage = "Kullanıcı seçilmedi.")]
    public Guid? UserId { get; set; }
}
