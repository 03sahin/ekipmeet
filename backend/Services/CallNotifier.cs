using EkipMeet.Api.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace EkipMeet.Api.Services;

// Hub dışından (controller'lardan) görüşmeyi bitirmek için: toplantı iptal edildi, oda silindi,
// katılımcı toplantıdan çıkarıldı. Yetkisi kalmayan kişi görüşmede kalmasın.
public class CallNotifier(IHubContext<RoomHub> hub, CallTracker calls)
{
    public async Task EndCall(string callKey, string message)
    {
        var connectionIds = calls.EndCall(callKey);
        if (connectionIds.Count == 0) return;

        foreach (var id in connectionIds)
            await hub.Groups.RemoveFromGroupAsync(id, RoomHub.CallGroup(callKey));
        await hub.Clients.Clients(connectionIds).SendAsync(RoomHubEvents.CallEnded, callKey, message);
    }

    public async Task RemoveUser(string callKey, Guid userId, string message)
    {
        var connectionIds = calls.RemoveUser(callKey, userId);
        if (connectionIds.Count == 0) return;

        foreach (var id in connectionIds)
        {
            await hub.Groups.RemoveFromGroupAsync(id, RoomHub.CallGroup(callKey));
            await hub.Clients.Group(RoomHub.CallGroup(callKey)).SendAsync(RoomHubEvents.CallPeerLeft, id);
        }
        await hub.Clients.Clients(connectionIds).SendAsync(RoomHubEvents.CallEnded, callKey, message);
    }
}
