namespace EkipMeet.Api.Services;

// Hangi bağlantı hangi sohbeti şu an ekranında açık tutuyor? (Bağlantı başına en fazla bir sohbet)
// Sohbeti açık olan kullanıcıya o sohbetin mesajı için bildirim/push gönderilmez.
public class ConversationPresence
{
    private readonly Lock _lock = new();
    private readonly Dictionary<string, (Guid UserId, Guid ConversationId)> _open = [];

    public void Open(string connectionId, Guid userId, Guid conversationId)
    {
        lock (_lock) _open[connectionId] = (userId, conversationId);
    }

    public void Close(string connectionId)
    {
        lock (_lock) _open.Remove(connectionId);
    }

    // Kullanıcının herhangi bir cihazında bu sohbet açık mı?
    public HashSet<Guid> UsersViewing(Guid conversationId)
    {
        lock (_lock)
        {
            return _open.Values.Where(v => v.ConversationId == conversationId).Select(v => v.UserId).ToHashSet();
        }
    }

    // Gruptan ayrılan kullanıcının açık ekranı artık sayılmasın
    public void CloseForUser(Guid userId, Guid conversationId)
    {
        lock (_lock)
        {
            foreach (var id in _open.Where(o => o.Value == (userId, conversationId)).Select(o => o.Key).ToList())
                _open.Remove(id);
        }
    }
}
