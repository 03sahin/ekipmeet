using EkipMeet.Api.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace EkipMeet.Api.Services;

// Toplantı olaylarını ilgili kullanıcıların kişisel gruplarına (user-{id}) yollar.
// Sadece toplantı id'si gider; istemci detayı yetki kontrolü olan REST endpoint'inden çeker.
public class MeetingNotifier(IHubContext<RoomHub> hub)
{
    private Task Send(string eventName, IEnumerable<Guid> userIds, Guid meetingId)
    {
        var groups = userIds.Distinct().Select(RoomHub.UserGroup).ToList();
        return groups.Count == 0 ? Task.CompletedTask : hub.Clients.Groups(groups).SendAsync(eventName, meetingId);
    }

    public Task Invited(IEnumerable<Guid> userIds, Guid meetingId) => Send(RoomHubEvents.MeetingInvited, userIds, meetingId);

    public Task Changed(IEnumerable<Guid> userIds, Guid meetingId) => Send(RoomHubEvents.MeetingChanged, userIds, meetingId);

    public Task Cancelled(IEnumerable<Guid> userIds, Guid meetingId) => Send(RoomHubEvents.MeetingCancelled, userIds, meetingId);

    // Katılımcı listeden çıkarıldı: artık bu toplantıyı göremez
    public Task Removed(Guid userId, Guid meetingId) => Send(RoomHubEvents.MeetingRemoved, [userId], meetingId);
}
