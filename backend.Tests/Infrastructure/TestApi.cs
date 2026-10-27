using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EkipMeet.Api.Tests.Infrastructure;

// Testlerde okunan yanıtların sadece gereken alanları
public record TestUser(Guid Id, string Email, string DisplayName);
public record AuthResult(string AccessToken, string RefreshToken, TestUser User);
public record IdResult(Guid Id);
public record AttachmentResult(Guid Id, string OriginalName, string ContentType, long SizeBytes, bool IsImage);
public record MessageResult(long Id, string Text, AttachmentResult? Attachment);

// Oturum açmış bir test kullanıcısı: kendi HttpClient'ı her istekte kendi token'ını gönderir
public sealed record Session(HttpClient Client, AuthResult Auth)
{
    public Guid UserId => Auth.User.Id;
}

public static class TestApi
{
    public const string Password = "Sifre1234!";

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }, // API enum'ları isim olarak döndürür
    };

    public static async Task<AuthResult> RegisterAsync(HttpClient client, string? name = null)
    {
        name ??= "Test";
        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"{name.ToLowerInvariant()}-{Guid.NewGuid():N}@test.local", // Her test benzersiz kullanıcı
            password = Password,
            displayName = name,
        });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<AuthResult>(Json))!;
    }

    public static async Task<Session> NewSessionAsync(this ApiFactory factory, string name)
    {
        var client = factory.CreateClient();
        var auth = await RegisterAsync(client, name);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return new Session(client, auth);
    }

    public static async Task<T> ReadAsync<T>(this HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<T>(Json))!;

    // İki kişilik birebir sohbet açar, id'sini döner
    public static async Task<Guid> CreateDirectAsync(Session from, Session to)
    {
        var response = await from.Client.PostAsJsonAsync("/api/conversations/direct", new { userId = to.UserId });
        response.EnsureSuccessStatusCode();
        return (await response.ReadAsync<IdResult>()).Id;
    }

    public static MultipartFormDataContent FileForm(string fileName, byte[] content, string clientContentType = "application/octet-stream")
    {
        var file = new ByteArrayContent(content);
        file.Headers.ContentType = new MediaTypeHeaderValue(clientContentType);
        return new MultipartFormDataContent { { file, "file", fileName } };
    }

    // Geçerli PNG imzasıyla başlayan küçük bir "resim"
    public static byte[] PngBytes() =>
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52];
}
