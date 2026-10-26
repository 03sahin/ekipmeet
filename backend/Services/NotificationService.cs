using System.Text.Json;
using EkipMeet.Api.Data;
using EkipMeet.Api.Dtos;
using EkipMeet.Api.Hubs;
using EkipMeet.Api.Models;
using EkipMeet.Api.Services.Push;
using Microsoft.AspNetCore.SignalR;

namespace EkipMeet.Api.Services;

// Bildirim oluşturmanın tek yolu: veritabanına yazar, SignalR ile canlı yollar, push kuyruğuna ekler.
// Controller kendi değişikliğini kaydettikten SONRA çağırır; bildirim kaydı ayrı bir SaveChanges'tır.
public class NotificationService(
    AppDbContext db,
    IHubContext<RoomHub> hub,
    PushQueue pushQueue,
    ConversationPresence conversationPresence)
{
    private const int PreviewLength = 80; // Push'ta mesajın tamamı değil, kısa önizleme gider

    public static NotificationResponse ToResponse(Notification n) =>
        new(n.Id, n.Type, n.Title, n.Body, JsonDocument.Parse(n.Data).RootElement.Clone(), n.CreatedAt, n.ReadAt);

    // Yeni sohbet mesajı: gönderen hariç, sohbeti şu an ekranında açık tutmayan üyelere
    public Task ChatMessage(Conversation conversation, ChatMessage message, string senderName, Attachment? attachment)
    {
        var viewing = conversationPresence.UsersViewing(conversation.Id);
        var recipients = conversation.Members
            .Select(m => m.UserId)
            .Where(id => id != message.SenderId && !viewing.Contains(id))
            .ToList();

        var preview = attachment is null
            ? Shorten(message.Text)
            : attachment.IsImage ? "📷 Fotoğraf" : $"📎 {attachment.OriginalName}";

        // Birebirde başlık gönderenin adı; grupta grup adı, gövdede "Ali: ..."
        var isGroup = conversation.Type == ConversationType.Group;
        var title = isGroup ? conversation.Name! : senderName;
        var body = isGroup ? $"{senderName}: {preview}" : preview;

        return Create(recipients, NotificationType.ChatMessage, title, body, new()
        {
            ["conversationId"] = conversation.Id.ToString(),
            ["conversationTitle"] = title, // Bildirime dokununca sohbet ekranının başlığı
        });
    }

    public Task Meeting(IEnumerable<Guid> userIds, NotificationType type, Meeting meeting, string organizerName)
    {
        var (title, body) = type switch
        {
            NotificationType.MeetingInvited => ("Toplantı daveti", $"{organizerName} seni \"{meeting.Title}\" toplantısına davet etti."),
            NotificationType.MeetingChanged => ("Toplantı güncellendi", $"\"{meeting.Title}\" toplantısının bilgileri değişti."),
            NotificationType.MeetingCancelled => ("Toplantı iptal edildi", $"\"{meeting.Title}\" toplantısı iptal edildi."),
            NotificationType.MeetingRemoved => ("Toplantıdan çıkarıldın", $"\"{meeting.Title}\" toplantısının katılımcılarından çıkarıldın."),
            _ => throw new ArgumentOutOfRangeException(nameof(type)),
        };
        return Create(userIds.ToList(), type, Shorten(title, 150), Shorten(body, 300), new()
        {
            ["meetingId"] = meeting.Id.ToString(),
        });
    }

    private async Task Create(List<Guid> userIds, NotificationType type, string title, string body, Dictionary<string, string> data)
    {
        userIds = userIds.Distinct().ToList();
        if (userIds.Count == 0) return;

        var json = JsonSerializer.Serialize(data);
        var notifications = userIds
            .Select(id => new Notification { UserId = id, Type = type, Title = title, Body = body, Data = json })
            .ToList();
        db.Notifications.AddRange(notifications);
        await db.SaveChangesAsync();

        // Uygulama açıksa zil rozeti ve banner için
        foreach (var n in notifications)
            await hub.Clients.Group(RoomHub.UserGroup(n.UserId)).SendAsync(RoomHubEvents.NotificationReceived, ToResponse(n));

        // Push'a bildirim id'si ve türü de eklenir: dokununca okundu işaretlenip ilgili ekrana gidilir.
        // Her kullanıcının bildirim id'si farklı olduğu için kişi başına ayrı iş.
        foreach (var n in notifications)
        {
            pushQueue.Enqueue(new PushJob([n.UserId], title, body, new Dictionary<string, string>(data)
            {
                ["notificationId"] = n.Id.ToString(),
                ["type"] = type.ToString(),
            }));
        }
    }

    private static string Shorten(string text, int max = PreviewLength)
    {
        text = text.ReplaceLineEndings(" ").Trim();
        return text.Length <= max ? text : text[..(max - 1)] + "…";
    }
}
