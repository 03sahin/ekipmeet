namespace EkipMeet.Api.Services;

// appsettings.json'daki "WebRtc" bölümü. TURN sunucusunun kullanıcı adı/şifresi koda veya
// appsettings.json'a yazılmaz; User Secrets ya da ortam değişkeninden eklenir (README'ye bak).
public class WebRtcOptions
{
    public List<IceServerOptions> IceServers { get; set; } = [];
}

public class IceServerOptions
{
    public List<string> Urls { get; set; } = [];
    public string? Username { get; set; }
    public string? Credential { get; set; }
}
