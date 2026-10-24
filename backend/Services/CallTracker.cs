using EkipMeet.Api.Dtos;

namespace EkipMeet.Api.Services;

public enum CallJoinResult { Joined, AlreadyInCall, Full }

// Kim hangi görüşmede? PresenceTracker gibi singleton ve bellekte; sunucu yeniden başlarsa sıfırlanır.
// Görüşmede her bağlantı ayrı bir katılımcıdır: WebRTC bağlantısı cihazlar arasında kurulur.
public class CallTracker
{
    public const int MaxParticipants = 6;

    // Görüşme anahtarları her yerde bu biçimde üretilir; aynı toplantı için iki farklı anahtar oluşmasın
    public static string MeetingKey(Guid meetingId) => $"meeting:{meetingId}";
    public static string RoomKey(int roomId) => $"room:{roomId}";

    private sealed class Participant(string callKey, Guid userId, string displayName)
    {
        public string CallKey { get; } = callKey;
        public Guid UserId { get; } = userId;
        public string DisplayName { get; } = displayName;
        public bool AudioEnabled { get; set; } = true; // Görüşmeye mikrofon ve kamera açık girilir
        public bool VideoEnabled { get; set; } = true;
    }

    private readonly Lock _lock = new();
    // Bağlantı → görüşme bilgisi (bağlantı başına tek görüşme)
    private readonly Dictionary<string, Participant> _connections = [];
    // Görüşme → içerideki bağlantılar (katılma sırasıyla)
    private readonly Dictionary<string, List<string>> _calls = [];

    // Doluluk kontrolü ve ekleme aynı kilit içinde: aynı anda gelen iki kişi 7. kişi olamaz
    public CallJoinResult Join(string connectionId, string callKey, Guid userId, string displayName)
    {
        lock (_lock)
        {
            if (_connections.TryGetValue(connectionId, out var current) && current.CallKey == callKey)
                return CallJoinResult.AlreadyInCall;

            if (_calls.TryGetValue(callKey, out var list) && list.Count >= MaxParticipants)
                return CallJoinResult.Full;

            if (!_calls.TryGetValue(callKey, out list))
                _calls[callKey] = list = [];
            list.Add(connectionId);
            _connections[connectionId] = new Participant(callKey, userId, displayName);
            return CallJoinResult.Joined;
        }
    }

    // Görüşmeden çıkarır; çıktığı görüşmenin anahtarını döner (görüşmede değilse null)
    public string? Leave(string connectionId)
    {
        lock (_lock)
        {
            if (!_connections.Remove(connectionId, out var p)) return null;
            if (_calls.TryGetValue(p.CallKey, out var list))
            {
                list.Remove(connectionId);
                if (list.Count == 0) _calls.Remove(p.CallKey);
            }
            return p.CallKey;
        }
    }

    public string? GetCallOf(string connectionId)
    {
        lock (_lock) return _connections.TryGetValue(connectionId, out var p) ? p.CallKey : null;
    }

    public CallPeer? GetPeer(string connectionId)
    {
        lock (_lock) return _connections.TryGetValue(connectionId, out var p) ? ToPeer(connectionId, p) : null;
    }

    // İki bağlantı aynı görüşmede mi? Sinyal mesajları sadece bu durumda iletilir.
    public bool InSameCall(string connectionId, string otherConnectionId)
    {
        lock (_lock)
        {
            return _connections.TryGetValue(connectionId, out var a)
                && _connections.TryGetValue(otherConnectionId, out var b)
                && a.CallKey == b.CallKey;
        }
    }

    // Görüşmedeki diğer kişiler (kendisi hariç)
    public List<CallPeer> GetPeers(string callKey, string exceptConnectionId)
    {
        lock (_lock)
        {
            return _calls.TryGetValue(callKey, out var list)
                ? list.Where(id => id != exceptConnectionId).Select(id => ToPeer(id, _connections[id])).ToList()
                : [];
        }
    }

    public CallPeer? SetMedia(string connectionId, bool audioEnabled, bool videoEnabled)
    {
        lock (_lock)
        {
            if (!_connections.TryGetValue(connectionId, out var p)) return null;
            p.AudioEnabled = audioEnabled;
            p.VideoEnabled = videoEnabled;
            return ToPeer(connectionId, p);
        }
    }

    // Toplantı iptal edildi / oda silindi: görüşmeyi bitirir, içeridekilerin bağlantılarını döner
    public List<string> EndCall(string callKey)
    {
        lock (_lock)
        {
            if (!_calls.Remove(callKey, out var list)) return [];
            foreach (var id in list) _connections.Remove(id);
            return list;
        }
    }

    // Toplantıdan çıkarılan kullanıcının o görüşmedeki tüm bağlantılarını çıkarır
    public List<string> RemoveUser(string callKey, Guid userId)
    {
        lock (_lock)
        {
            if (!_calls.TryGetValue(callKey, out var list)) return [];
            var removed = list.Where(id => _connections[id].UserId == userId).ToList();
            foreach (var id in removed)
            {
                list.Remove(id);
                _connections.Remove(id);
            }
            if (list.Count == 0) _calls.Remove(callKey);
            return removed;
        }
    }

    private static CallPeer ToPeer(string connectionId, Participant p) =>
        new(connectionId, p.UserId, p.DisplayName, p.AudioEnabled, p.VideoEnabled);
}
