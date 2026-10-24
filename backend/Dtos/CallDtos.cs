using System.Text.Json.Serialization;

namespace EkipMeet.Api.Dtos;

// Görüşmedeki bir katılımcı. ConnectionId sinyal mesajlarının hedefidir.
public record CallPeer(string ConnectionId, Guid UserId, string DisplayName, bool AudioEnabled, bool VideoEnabled);

// JoinCall'un dönüşü: benim bağlantı id'm + içeride zaten olanlar (yeni gelen onlara teklif gönderir)
public record JoinCallResponse(string CallKey, string ConnectionId, List<CallPeer> Peers);

public record IceCandidateMessage(string Candidate, string? SdpMid, int? SdpMLineIndex);

// GET /api/calls/ice-servers yanıtı; boş kullanıcı adı/şifre JSON'a hiç yazılmaz (STUN'da yoktur)
public record IceServerResponse(
    string[] Urls,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Username,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Credential);
