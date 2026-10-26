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

    // Sohbetler (kişisel gruplara gider)
    public const string ConversationMessage = "ConversationMessage";
    public const string ConversationChanged = "ConversationChanged";
    public const string ConversationRemoved = "ConversationRemoved";

    // Toplantılar (kişisel gruplara gider)
    public const string MeetingInvited = "MeetingInvited";
    public const string MeetingChanged = "MeetingChanged";
    public const string MeetingCancelled = "MeetingCancelled";
    public const string MeetingRemoved = "MeetingRemoved";

    // Görüntülü görüşme (sinyaller sadece hedef bağlantıya, diğerleri görüşme grubuna gider)
    public const string CallPeerJoined = "CallPeerJoined";
    public const string CallPeerLeft = "CallPeerLeft";
    public const string CallMediaChanged = "CallMediaChanged";
    public const string CallOffer = "CallOffer";
    public const string CallAnswer = "CallAnswer";
    public const string CallIceCandidate = "CallIceCandidate";
    public const string CallEnded = "CallEnded";

    // Bildirimler (kişisel gruplara gider)
    public const string NotificationReceived = "NotificationReceived";
    public const string NotificationsChanged = "NotificationsChanged"; // Okundu işaretlendi: diğer cihazlar sayacı yenilesin
}

[Authorize] // Token'sız bağlantı kurulamaz; tüm metotlar giriş ister
public class RoomHub(AppDbContext db, PresenceTracker presence, CallTracker calls, ConversationPresence conversations) : Hub
{
    public const int MaxMessageLength = 1000;
    private const int HistorySize = 50;
    private const int MaxSdpLength = 30_000; // SignalR'ın varsayılan mesaj sınırı 32 KB
    private const int MaxCandidateLength = 2_000;
    private static readonly TimeSpan CallEarlyJoin = TimeSpan.FromMinutes(10); // Mobildeki "Toplantıya katıl" kuralıyla aynı

    public static string GroupName(int roomId) => $"room-{roomId}";
    public static string UserGroup(Guid userId) => $"user-{userId}";
    public static string CallGroup(string callKey) => $"call-{callKey}";

    // Her bağlantı kişisel gruba girer: aynı kullanıcının tüm cihazları sohbet olaylarını alır.
    // Yeniden bağlanınca bağlantı id'si değişir; bu metot tekrar çalışıp gruba yeniden ekler.
    public override async Task OnConnectedAsync()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(Context.User!.GetUserId()));
        await base.OnConnectedAsync();
    }

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

    // ---------- Açık sohbet ekranı ----------
    // Sohbet ekranı önde açıkken bu sohbetin mesajları için bildirim/push gönderilmez.

    public async Task OpenConversation(Guid conversationId)
    {
        var me = Context.User!.GetUserId();
        // Üye olmadığı bir sohbeti "açık" gösterip başkalarının bildirimlerini etkileyemesin
        if (!await db.ConversationMembers.AnyAsync(m => m.ConversationId == conversationId && m.UserId == me))
            throw new HubException("Sohbet bulunamadı.");
        conversations.Open(Context.ConnectionId, me, conversationId);
    }

    public void CloseConversation() => conversations.Close(Context.ConnectionId);

    // ---------- Görüntülü görüşme ----------
    // Akış: yeni gelen JoinCall ile içeridekilerin listesini alır ve HER birine teklif (offer) yollar;
    // içeridekiler sadece cevap (answer) verir. Böylece iki taraf aynı anda teklif göndermez.

    public async Task<JoinCallResponse> JoinCall(string callKey)
    {
        // Anahtarı istemcinin yazdığı haliyle değil, ayrıştırıp yeniden üreterek kullanıyoruz
        callKey = await AuthorizeCall(callKey);
        var connectionId = Context.ConnectionId;

        // Başka bir görüşmedeyse önce oradan çık
        if (calls.GetCallOf(connectionId) is { } current && current != callKey) await LeaveCurrentCall();

        var user = Context.User!;
        var result = calls.Join(connectionId, callKey, user.GetUserId(), user.GetDisplayName());
        if (result == CallJoinResult.Full)
            throw new HubException($"Görüşme dolu. Bir görüşmede en fazla {CallTracker.MaxParticipants} kişi olabilir.");

        if (result == CallJoinResult.Joined)
        {
            // Önce içeridekilere haber ver, sonra gruba gir: kendi katılma olayımız bize gelmesin
            await Clients.Group(CallGroup(callKey)).SendAsync(RoomHubEvents.CallPeerJoined, calls.GetPeer(connectionId));
            await Groups.AddToGroupAsync(connectionId, CallGroup(callKey));
        }

        return new JoinCallResponse(callKey, connectionId, calls.GetPeers(callKey, connectionId));
    }

    public Task LeaveCall() => LeaveCurrentCall();

    public Task SendOffer(string targetConnectionId, string sdp)
    {
        ValidateSdp(sdp);
        EnsureSameCall(targetConnectionId);
        var from = calls.GetPeer(Context.ConnectionId)
            ?? throw new HubException("Önce görüşmeye katılmalısın.");
        // Teklifle birlikte gönderenin bilgisi de gider: alıcı CallPeerJoined'ı kaçırdıysa bile kartı oluşturabilir
        return Clients.Client(targetConnectionId).SendAsync(RoomHubEvents.CallOffer, from, sdp);
    }

    public Task SendAnswer(string targetConnectionId, string sdp)
    {
        ValidateSdp(sdp);
        EnsureSameCall(targetConnectionId);
        return Clients.Client(targetConnectionId).SendAsync(RoomHubEvents.CallAnswer, Context.ConnectionId, sdp);
    }

    public Task SendIceCandidate(string targetConnectionId, IceCandidateMessage candidate)
    {
        if (string.IsNullOrEmpty(candidate?.Candidate) || candidate.Candidate.Length > MaxCandidateLength)
            throw new HubException("Geçersiz ICE adayı.");
        EnsureSameCall(targetConnectionId);
        return Clients.Client(targetConnectionId).SendAsync(RoomHubEvents.CallIceCandidate, Context.ConnectionId, candidate);
    }

    // Mikrofon/kamera durumu: görüntü kapalıyken diğerleri baş harfi, mikrofon kapalıyken simgeyi gösterir
    public async Task ToggleMedia(bool audioEnabled, bool videoEnabled)
    {
        var callKey = calls.GetCallOf(Context.ConnectionId)
            ?? throw new HubException("Önce görüşmeye katılmalısın.");
        var peer = calls.SetMedia(Context.ConnectionId, audioEnabled, videoEnabled);
        if (peer is null) return; // Bu arada görüşmeden çıkarıldı
        await Clients.OthersInGroup(CallGroup(callKey)).SendAsync(RoomHubEvents.CallMediaChanged, peer);
    }

    // Görüşmeye kim katılabilir? Yetki yoksa HubException; varsa standart biçimdeki anahtarı döner.
    private async Task<string> AuthorizeCall(string callKey)
    {
        var parts = (callKey ?? string.Empty).Split(':', 2);
        if (parts.Length == 2 && parts[0] == "meeting" && Guid.TryParse(parts[1], out var meetingId))
        {
            var me = Context.User!.GetUserId();
            // Katılımcı değilse "bulunamadı": toplantının varlığı sızmasın (REST'teki 404 ile aynı)
            var meeting = await db.Meetings.AsNoTracking()
                .Where(m => m.Id == meetingId && m.Participants.Any(p => p.UserId == me))
                .Select(m => new { m.Status, m.StartsAt, m.EndsAt })
                .FirstOrDefaultAsync()
                ?? throw new HubException("Toplantı bulunamadı.");

            var now = DateTime.UtcNow;
            if (meeting.Status == MeetingStatus.Cancelled) throw new HubException("Bu toplantı iptal edildi.");
            if (meeting.EndsAt <= now) throw new HubException("Bu toplantı sona erdi.");
            if (now < meeting.StartsAt - CallEarlyJoin)
                throw new HubException("Toplantıya başlangıçtan en erken 10 dakika önce katılabilirsin.");
            return CallTracker.MeetingKey(meetingId);
        }

        if (parts.Length == 2 && parts[0] == "room" && int.TryParse(parts[1], out var roomId))
        {
            // Oda görüşmesine giriş yapmış herkes katılabilir; odanın var olması yeter
            if (!await db.Rooms.AnyAsync(r => r.Id == roomId)) throw new HubException("Oda bulunamadı.");
            return CallTracker.RoomKey(roomId);
        }

        throw new HubException("Geçersiz görüşme.");
    }

    // Hedef bağlantı benimle aynı görüşmede değilse mesaj iletilmez (başka görüşmeye sızma engeli)
    private void EnsureSameCall(string targetConnectionId)
    {
        if (calls.GetCallOf(Context.ConnectionId) is null) throw new HubException("Önce görüşmeye katılmalısın.");
        if (string.IsNullOrEmpty(targetConnectionId) || targetConnectionId == Context.ConnectionId
            || !calls.InSameCall(Context.ConnectionId, targetConnectionId))
            throw new HubException("Bu kişi görüşmede değil.");
    }

    private static void ValidateSdp(string sdp)
    {
        if (string.IsNullOrEmpty(sdp) || sdp.Length > MaxSdpLength) throw new HubException("Geçersiz oturum bilgisi.");
    }

    private async Task LeaveCurrentCall()
    {
        var callKey = calls.Leave(Context.ConnectionId);
        if (callKey is null) return; // Zaten bir görüşmede değil

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, CallGroup(callKey));
        await Clients.Group(CallGroup(callKey)).SendAsync(RoomHubEvents.CallPeerLeft, Context.ConnectionId);
    }

    // Uygulama kapanınca/bağlantı kopunca odadan ve görüşmeden otomatik çık
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var left = presence.Leave(Context.ConnectionId);
        if (left is { MembersChanged: true }) await NotifyPresence(left.RoomId);
        await LeaveCurrentCall(); // Diğerleri bu kişinin karesini kaldırsın
        conversations.Close(Context.ConnectionId); // Uygulama kapandı: artık bildirim alsın
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
