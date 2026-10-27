using System.Net;
using System.Net.Http.Json;
using EkipMeet.Api.Tests.Infrastructure;

namespace EkipMeet.Api.Tests;

// Kaynak id'sini bilmek yetmez: sahiplik ve üyelik kontrolleri (IDOR)
[Collection(ApiCollection.Name)]
public class AuthorizationTests(ApiFactory factory)
{
    [Fact]
    public async Task Oda_sadece_sahibi_tarafindan_duzenlenip_silinebilir_digerlerine_403()
    {
        var owner = await factory.NewSessionAsync("Sahip");
        var other = await factory.NewSessionAsync("Diger");

        var created = await owner.Client.PostAsJsonAsync("/api/rooms", new { name = "Ekip odası", topic = "Planlama" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var roomId = (await created.Content.ReadFromJsonAsync<RoomResult>(TestApi.Json))!.Id;

        var update = await other.Client.PutAsJsonAsync($"/api/rooms/{roomId}", new { name = "Ele geçirildi" });
        var delete = await other.Client.DeleteAsync($"/api/rooms/{roomId}");
        Assert.Equal(HttpStatusCode.Forbidden, update.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, delete.StatusCode);

        var ownerUpdate = await owner.Client.PutAsJsonAsync($"/api/rooms/{roomId}", new { name = "Yeni ad" });
        Assert.Equal(HttpStatusCode.OK, ownerUpdate.StatusCode);
    }

    private record RoomResult(int Id);

    [Fact]
    public async Task Sohbete_uye_olmayan_hicbir_seye_erisemez_404()
    {
        var ali = await factory.NewSessionAsync("Ali");
        var ayse = await factory.NewSessionAsync("Ayse");
        var mehmet = await factory.NewSessionAsync("Mehmet");
        var conversationId = await TestApi.CreateDirectAsync(ali, ayse);

        Assert.Equal(HttpStatusCode.OK, (await ayse.Client.GetAsync($"/api/conversations/{conversationId}")).StatusCode);

        // Üye olmayan: varlığı bile sızmasın diye 403 değil 404
        Assert.Equal(HttpStatusCode.NotFound, (await mehmet.Client.GetAsync($"/api/conversations/{conversationId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await mehmet.Client.GetAsync($"/api/conversations/{conversationId}/messages")).StatusCode);
        var send = await mehmet.Client.PostAsJsonAsync($"/api/conversations/{conversationId}/messages", new { text = "Merhaba" });
        Assert.Equal(HttpStatusCode.NotFound, send.StatusCode);

        // Liste de sadece kendi sohbetlerini içerir
        var list = await mehmet.Client.GetFromJsonAsync<List<IdResult>>("/api/conversations", TestApi.Json);
        Assert.DoesNotContain(list!, c => c.Id == conversationId);
    }

    [Fact]
    public async Task Toplantiyi_sadece_duzenleyen_degistirebilir_katilimciya_403_disaridakine_404()
    {
        var organizer = await factory.NewSessionAsync("Duzenleyen");
        var participant = await factory.NewSessionAsync("Katilimci");
        var outsider = await factory.NewSessionAsync("Disaridaki");

        var startsAt = DateTimeOffset.UtcNow.AddDays(1);
        var created = await organizer.Client.PostAsJsonAsync("/api/meetings", new
        {
            title = "Sprint planlama",
            description = "",
            startsAt,
            durationMinutes = 60,
            participantIds = new[] { participant.UserId },
        });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var meetingId = (await created.ReadAsync<IdResult>()).Id;

        var update = new { title = "Değişti", description = "", startsAt, durationMinutes = 90 };
        Assert.Equal(HttpStatusCode.Forbidden, (await participant.Client.PutAsJsonAsync($"/api/meetings/{meetingId}", update)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await participant.Client.PostAsync($"/api/meetings/{meetingId}/cancel", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await outsider.Client.PutAsJsonAsync($"/api/meetings/{meetingId}", update)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await outsider.Client.GetAsync($"/api/meetings/{meetingId}")).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await organizer.Client.PutAsJsonAsync($"/api/meetings/{meetingId}", update)).StatusCode);
    }

    [Fact]
    public async Task Baskasinin_bildirimini_okundu_yapamaz_404()
    {
        var ali = await factory.NewSessionAsync("Ali");
        var ayse = await factory.NewSessionAsync("Ayse");
        var conversationId = await TestApi.CreateDirectAsync(ali, ayse);
        await ali.Client.PostAsJsonAsync($"/api/conversations/{conversationId}/messages", new { text = "Selam" });

        var notifications = await ayse.Client.GetFromJsonAsync<List<IdResult>>("/api/notifications", TestApi.Json);
        var notificationId = Assert.Single(notifications!).Id;

        // Ali, Ayşe'nin bildirimini göremez ve değiştiremez
        Assert.Empty((await ali.Client.GetFromJsonAsync<List<IdResult>>("/api/notifications", TestApi.Json))!);
        Assert.Equal(HttpStatusCode.NotFound, (await ali.Client.PostAsync($"/api/notifications/{notificationId}/read", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await ayse.Client.PostAsync($"/api/notifications/{notificationId}/read", null)).StatusCode);
    }
}
