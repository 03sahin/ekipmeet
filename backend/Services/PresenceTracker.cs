using EkipMeet.Api.Dtos;

namespace EkipMeet.Api.Services;

// Odanın üye listesi değişti mi? (Aynı kullanıcının 2. bağlantısı listeyi değiştirmez)
public record PresenceChange(int RoomId, bool MembersChanged);

// Kim hangi odada? Singleton olarak bellekte tutulur; sunucu yeniden başlarsa sıfırlanır.
// Hub'ın her çağrısı farklı thread'de çalışabileceği için tüm erişim kilit altında.
public class PresenceTracker
{
    private sealed class Member(string displayName)
    {
        public string DisplayName { get; } = displayName;
        public int Connections { get; set; } // Aynı kullanıcı 2 cihazdan bağlıysa 2 olur ama 1 kişi sayılır
    }

    private readonly Lock _lock = new();
    // Bağlantı → bulunduğu oda (bağlantı başına tek oda)
    private readonly Dictionary<string, (int RoomId, Guid UserId)> _connections = [];
    // Oda → (kullanıcı → üye bilgisi)
    private readonly Dictionary<int, Dictionary<Guid, Member>> _rooms = [];

    // Bağlantıyı odaya sokar; başka odadaysa önce oradan çıkarır
    public (PresenceChange? Left, PresenceChange Joined) Join(string connectionId, int roomId, Guid userId, string displayName)
    {
        lock (_lock)
        {
            if (_connections.TryGetValue(connectionId, out var current) && current.RoomId == roomId)
                return (null, new PresenceChange(roomId, false)); // Zaten bu odada

            var left = RemoveConnection(connectionId);
            _connections[connectionId] = (roomId, userId);

            if (!_rooms.TryGetValue(roomId, out var members))
                _rooms[roomId] = members = [];
            if (!members.TryGetValue(userId, out var member))
                members[userId] = member = new Member(displayName);
            member.Connections++;

            return (left, new PresenceChange(roomId, member.Connections == 1));
        }
    }

    public PresenceChange? Leave(string connectionId)
    {
        lock (_lock) return RemoveConnection(connectionId);
    }

    public int? GetRoomOf(string connectionId)
    {
        lock (_lock) return _connections.TryGetValue(connectionId, out var c) ? c.RoomId : null;
    }

    public List<RoomMember> GetMembers(int roomId)
    {
        lock (_lock)
        {
            return _rooms.TryGetValue(roomId, out var members)
                ? members.Select(m => new RoomMember(m.Key, m.Value.DisplayName)).OrderBy(m => m.DisplayName).ToList()
                : [];
        }
    }

    public int GetCount(int roomId)
    {
        lock (_lock) return _rooms.TryGetValue(roomId, out var members) ? members.Count : 0;
    }

    // Oda silinince içerideki bağlantıları da unut
    public void RemoveRoom(int roomId)
    {
        lock (_lock)
        {
            _rooms.Remove(roomId);
            foreach (var id in _connections.Where(c => c.Value.RoomId == roomId).Select(c => c.Key).ToList())
                _connections.Remove(id);
        }
    }

    // Kilit içinden çağrılmalı
    private PresenceChange? RemoveConnection(string connectionId)
    {
        if (!_connections.Remove(connectionId, out var c)) return null;
        if (!_rooms.TryGetValue(c.RoomId, out var members) || !members.TryGetValue(c.UserId, out var member))
            return null;

        if (--member.Connections > 0) return new PresenceChange(c.RoomId, false); // Kullanıcının başka bağlantısı hâlâ içeride

        members.Remove(c.UserId);
        if (members.Count == 0) _rooms.Remove(c.RoomId);
        return new PresenceChange(c.RoomId, true);
    }
}
