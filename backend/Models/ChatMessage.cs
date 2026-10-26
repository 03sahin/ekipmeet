using System.ComponentModel.DataAnnotations;

namespace EkipMeet.Api.Models;

public class ChatMessage
{
    public long Id { get; set; } // Artan sayı: "şu mesajdan eskiler" sayfalaması bununla yapılır

    public Guid ConversationId { get; set; }
    public Conversation Conversation { get; set; } = null!; // Sohbet silinince mesajları da silinir

    public Guid SenderId { get; set; }
    public User Sender { get; set; } = null!;

    [MaxLength(1000)]
    public string Text { get; set; } = string.Empty; // Ekli mesajda boş olabilir (açıklama isteğe bağlı)

    // Mesajın eki (en fazla bir dosya)
    public Guid? AttachmentId { get; set; }
    public Attachment? Attachment { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
