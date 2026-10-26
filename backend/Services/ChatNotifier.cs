using EkipMeet.Api.Dtos;
using EkipMeet.Api.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace EkipMeet.Api.Services;

// Controller'lardan hub'a olay yollamak için (IHubContext): hub metodu çağrılmadan da istemcilere ulaşırız.
// Olaylar sadece ilgili kullanıcıların kişisel gruplarına (user-{id}) gider; üye olmayan hiçbir şey duymaz.
public class ChatNotifier(IHubContext<RoomHub> hub)
{
    private static IReadOnlyList<string> GroupsOf(IEnumerable<Guid> userIds) =>
        userIds.Distinct().Select(RoomHub.UserGroup).ToList();

    public Task MessageSent(IEnumerable<Guid> memberIds, ChatMessageResponse message) =>
        hub.Clients.Groups(GroupsOf(memberIds)).SendAsync(RoomHubEvents.ConversationMessage, message);

    // Sohbet oluşturuldu, üye eklendi/ayrıldı, sahip değişti: istemci listeyi/detayı yeniden çeker
    public Task ConversationChanged(IEnumerable<Guid> memberIds, Guid conversationId) =>
        hub.Clients.Groups(GroupsOf(memberIds)).SendAsync(RoomHubEvents.ConversationChanged, conversationId);

    // Kullanıcı artık bu sohbetin üyesi değil: listesinden kaldırsın, açık ekranı kapatsın
    public Task ConversationRemoved(Guid userId, Guid conversationId) =>
        hub.Clients.Group(RoomHub.UserGroup(userId)).SendAsync(RoomHubEvents.ConversationRemoved, conversationId);

    // Bildirimler okundu işaretlendi: kullanıcının diğer cihazları zil rozetini yenilesin
    public Task NotificationsChanged(Guid userId) =>
        hub.Clients.Group(RoomHub.UserGroup(userId)).SendAsync(RoomHubEvents.NotificationsChanged);
}
