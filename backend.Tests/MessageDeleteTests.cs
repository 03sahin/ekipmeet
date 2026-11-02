using System.Net;
using System.Net.Http.Json;
using EkipMeet.Api.Tests.Infrastructure;

namespace EkipMeet.Api.Tests;

[Collection(ApiCollection.Name)]
public class MessageDeleteTests(ApiFactory factory)
{
    private record PreviewResult(string Text, string? AttachmentName, bool IsDeleted);
    private record ConversationResult(Guid Id, PreviewResult? LastMessage, int UnreadCount);
    private record NotificationResult(string Body);

    private static string MessagesUrl(Guid conversationId) => $"/api/conversations/{conversationId}/messages";

    private static async Task<long> SendAsync(Session from, Guid conversationId, string text)
    {
        var response = await from.Client.PostAsJsonAsync(MessagesUrl(conversationId), new { text });
        response.EnsureSuccessStatusCode();
        return (await response.ReadAsync<MessageResult>()).Id;
    }

    [Fact]
    public async Task Sahibi_silebilir_icerik_listede_donmez_onizleme_silindi_olur()
    {
        var ali = await factory.NewSessionAsync("Ali");
        var ayse = await factory.NewSessionAsync("Ayse");
        var conversationId = await TestApi.CreateDirectAsync(ali, ayse);
        var messageId = await SendAsync(ali, conversationId, "gizli içerik");

        var delete = await ali.Client.DeleteAsync($"{MessagesUrl(conversationId)}/{messageId}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        // Karşı taraf listede sadece "silindi" bilgisini görür, içerik dönmez
        var messages = await (await ayse.Client.GetAsync(MessagesUrl(conversationId))).ReadAsync<List<MessageResult>>();
        var deleted = Assert.Single(messages, m => m.Id == messageId);
        Assert.True(deleted.IsDeleted);
        Assert.Equal("", deleted.Text);
        Assert.Null(deleted.Attachment);

        var conversations = await (await ayse.Client.GetAsync("/api/conversations")).ReadAsync<List<ConversationResult>>();
        var summary = Assert.Single(conversations, c => c.Id == conversationId);
        Assert.True(summary.LastMessage!.IsDeleted);
        Assert.Equal("Bu mesaj silindi", summary.LastMessage.Text);
        Assert.Equal(0, summary.UnreadCount); // Silinen mesaj okunmamış sayılmaz

        // Bildirimde de içerik kalmaz
        var notifications = await (await ayse.Client.GetAsync("/api/notifications")).ReadAsync<List<NotificationResult>>();
        Assert.DoesNotContain(notifications, n => n.Body.Contains("gizli içerik"));
        Assert.Contains(notifications, n => n.Body == "Bu mesaj silindi");

        // Zaten silinmiş mesaj tekrar silinemez
        Assert.Equal(HttpStatusCode.NotFound, (await ali.Client.DeleteAsync($"{MessagesUrl(conversationId)}/{messageId}")).StatusCode);
    }

    [Fact]
    public async Task Baska_uyenin_mesajini_silmek_403()
    {
        var ali = await factory.NewSessionAsync("Ali");
        var ayse = await factory.NewSessionAsync("Ayse");
        var conversationId = await TestApi.CreateDirectAsync(ali, ayse);
        var messageId = await SendAsync(ali, conversationId, "merhaba");

        var response = await ayse.Client.DeleteAsync($"{MessagesUrl(conversationId)}/{messageId}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var messages = await (await ali.Client.GetAsync(MessagesUrl(conversationId))).ReadAsync<List<MessageResult>>();
        Assert.Equal("merhaba", Assert.Single(messages).Text);
    }

    [Fact]
    public async Task Uye_olmayan_404_alir()
    {
        var ali = await factory.NewSessionAsync("Ali");
        var ayse = await factory.NewSessionAsync("Ayse");
        var mehmet = await factory.NewSessionAsync("Mehmet");
        var conversationId = await TestApi.CreateDirectAsync(ali, ayse);
        var messageId = await SendAsync(ali, conversationId, "merhaba");

        var response = await mehmet.Client.DeleteAsync($"{MessagesUrl(conversationId)}/{messageId}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Ekli_mesaj_silinince_ek_de_indirilemez()
    {
        var ali = await factory.NewSessionAsync("Ali");
        var ayse = await factory.NewSessionAsync("Ayse");
        var conversationId = await TestApi.CreateDirectAsync(ali, ayse);
        var upload = await ali.Client.PostAsync($"/api/conversations/{conversationId}/attachments",
            TestApi.FileForm("foto.png", TestApi.PngBytes()));
        var message = await upload.ReadAsync<MessageResult>();
        var attachmentId = message.Attachment!.Id;
        Assert.Equal(HttpStatusCode.OK, (await ayse.Client.GetAsync($"/api/attachments/{attachmentId}")).StatusCode);

        var delete = await ali.Client.DeleteAsync($"{MessagesUrl(conversationId)}/{message.Id}");

        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ayse.Client.GetAsync($"/api/attachments/{attachmentId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ali.Client.GetAsync($"/api/attachments/{attachmentId}")).StatusCode);
        var conversations = await (await ayse.Client.GetAsync("/api/conversations")).ReadAsync<List<ConversationResult>>();
        Assert.Null(Assert.Single(conversations, c => c.Id == conversationId).LastMessage!.AttachmentName);
    }
}
