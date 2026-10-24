using EkipMeet.Api.Data;
using EkipMeet.Api.Dtos;
using EkipMeet.Api.Extensions;
using EkipMeet.Api.Models;
using EkipMeet.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace EkipMeet.Api.Hubs;

// İstemciye gönderilen olay adları (mobil tarafla birebir aynı olmalı)
public static class RoomHubEvents
{
    public const string PresenceChanged = "PresenceChanged";   // Sadece o odadakilere: üye listesi
    public const string RoomCountChanged = "RoomCountChanged"; // Herkese: oda listesindeki kişi sayısı
    public const string ReceiveMessage = "ReceiveMessage";
    public const string RoomDeleted = "RoomDeleted";
}

[Authorize] // Token'sız bağlantı kurulamaz; tüm metotlar giriş ister
public class RoomHub(AppDbContext db, PresenceTracker presence) : Hub
{
    public const int MaxMessageLength = 1000;
    private const int HistorySize = 50;

    public static string GroupName(int roomId) => $"room-{roomId}";

    public async Task<JoinRoomResponse> JoinRoom(int roomId)
    {
        if (!await db.Rooms.AnyAsync(r => r.Id == roomId))
            throw new HubException("Oda bulunamadı."); // HubException mesajı istemciye iletilir, diğer hatalar gizlenir

        var user = Context.User!;
        var (left, joined) = presence.Join(Context.ConnectionId, roomId, user.GetUserId(), user.GetDisplayName());

        // Bağlantı başka odadaysa oradan çıkarıldı; o odaya da haber ver
        if (left is not null)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(left.RoomId));
            if (left.MembersChanged) await NotifyPresence(left.RoomId);
        }

        // Geçmişi okumadan ÖNCE gruba gir: arada gelen mesaj kaçmasın (mobil tekrarları id ile eler)
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(roomId));
        if (joined.MembersChanged) await NotifyPresence(roomId);

        var messages = await db.RoomMessages.AsNoTracking()
            .Where(m => m.RoomId == roomId)
            .OrderByDescending(m => m.Id)
            .Take(HistorySize)
            .Select(m => new RoomMessageResponse(m.Id, m.RoomId, m.SenderId, m.Sender.DisplayName, m.Text, m.SentAt))
            .ToListAsync();
        messages.Reverse(); // Eskiden yeniye

        return new JoinRoomResponse(roomId, presence.GetMembers(roomId), messages);
    }

    public async Task LeaveRoom()
    {
        var left = presence.Leave(Context.ConnectionId);
        if (left is null) return; // Zaten bir odada değil

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(left.RoomId));
        if (left.MembersChanged) await NotifyPresence(left.RoomId);
    }

    public async Task SendMessage(string text)
    {
        // Oda id'sini istemciden almıyoruz: sadece gerçekten katıldığı odaya yazabilir
        var roomId = presence.GetRoomOf(Context.ConnectionId)
            ?? throw new HubException("Mesaj göndermek için önce odaya katılmalısın.");

        text = text?.Trim() ?? string.Empty;
        if (text.Length == 0) throw new HubException("Mesaj boş olamaz.");
        if (text.Length > MaxMessageLength) throw new HubException($"Mesaj en fazla {MaxMessageLength} karakter olabilir.");

        var user = Context.User!;
        var message = new RoomMessage { RoomId = roomId, SenderId = user.GetUserId(), Text = text };
        db.RoomMessages.Add(message);
        await db.SaveChangesAsync();

        await Clients.Group(GroupName(roomId)).SendAsync(RoomHubEvents.ReceiveMessage,
            new RoomMessageResponse(message.Id, roomId, message.SenderId, user.GetDisplayName(), message.Text, message.SentAt));
    }

    // Uygulama kapanınca/bağlantı kopunca odadan otomatik çık
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var left = presence.Leave(Context.ConnectionId);
        if (left is { MembersChanged: true }) await NotifyPresence(left.RoomId);
        // Kopan bağlantı gruplardan SignalR tarafından zaten çıkarılır
        await base.OnDisconnectedAsync(exception);
    }

    private async Task NotifyPresence(int roomId)
    {
        var members = presence.GetMembers(roomId);
        await Clients.Group(GroupName(roomId)).SendAsync(RoomHubEvents.PresenceChanged, roomId, members);
        await Clients.All.SendAsync(RoomHubEvents.RoomCountChanged, roomId, members.Count);
    }
}
