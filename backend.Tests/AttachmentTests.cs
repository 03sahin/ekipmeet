using System.Net;
using System.Text;
using EkipMeet.Api.Controllers;
using EkipMeet.Api.Tests.Infrastructure;

namespace EkipMeet.Api.Tests;

[Collection(ApiCollection.Name)]
public class AttachmentTests(ApiFactory factory)
{
    private static string UploadUrl(Guid conversationId) => $"/api/conversations/{conversationId}/attachments";

    [Fact]
    public async Task Ek_sadece_sohbet_uyelerince_indirilir_disaridakine_404()
    {
        var ali = await factory.NewSessionAsync("Ali");
        var ayse = await factory.NewSessionAsync("Ayse");
        var mehmet = await factory.NewSessionAsync("Mehmet");
        var conversationId = await TestApi.CreateDirectAsync(ali, ayse);

        var upload = await ali.Client.PostAsync(UploadUrl(conversationId), TestApi.FileForm("foto.png", TestApi.PngBytes()));
        Assert.Equal(HttpStatusCode.Created, upload.StatusCode);
        var attachment = (await upload.ReadAsync<MessageResult>()).Attachment!;
        Assert.Equal("image/png", attachment.ContentType);

        var download = await ayse.Client.GetAsync($"/api/attachments/{attachment.Id}");
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        Assert.Equal(TestApi.PngBytes(), await download.Content.ReadAsByteArrayAsync());
        Assert.Equal("inline", download.Content.Headers.ContentDisposition?.DispositionType);

        Assert.Equal(HttpStatusCode.NotFound, (await mehmet.Client.GetAsync($"/api/attachments/{attachment.Id}")).StatusCode);
        // Üye olmayan o sohbete dosya da yükleyemez
        var foreignUpload = await mehmet.Client.PostAsync(UploadUrl(conversationId), TestApi.FileForm("x.png", TestApi.PngBytes()));
        Assert.Equal(HttpStatusCode.NotFound, foreignUpload.StatusCode);
    }

    [Fact]
    public async Task Gruptan_ayrilan_eski_dosyalari_artik_indiremez()
    {
        var ali = await factory.NewSessionAsync("Ali");
        var ayse = await factory.NewSessionAsync("Ayse");
        var created = await ali.Client.PostAsync("/api/conversations/group",
            System.Net.Http.Json.JsonContent.Create(new { name = "Proje", memberIds = new[] { ayse.UserId } }));
        var groupId = (await created.ReadAsync<IdResult>()).Id;
        var upload = await ali.Client.PostAsync(UploadUrl(groupId), TestApi.FileForm("rapor.pdf", Encoding.ASCII.GetBytes("%PDF-1.7\n...")));
        var attachmentId = (await upload.ReadAsync<MessageResult>()).Attachment!.Id;

        Assert.Equal(HttpStatusCode.OK, (await ayse.Client.GetAsync($"/api/attachments/{attachmentId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await ayse.Client.PostAsync($"/api/conversations/{groupId}/leave", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ayse.Client.GetAsync($"/api/attachments/{attachmentId}")).StatusCode);
    }

    [Theory]
    [InlineData("sahte.jpg", "image/jpeg")] // Adı .jpg ama içi düz metin
    [InlineData("virus.exe", "application/octet-stream")] // İzinli olmayan uzantı
    [InlineData("belge.pdf", "application/pdf")] // Adı .pdf ama PDF imzası yok
    public async Task Uzantisi_ve_icerigi_uyusmayan_ya_da_izinsiz_dosya_400(string fileName, string clientContentType)
    {
        var ali = await factory.NewSessionAsync("Ali");
        var ayse = await factory.NewSessionAsync("Ayse");
        var conversationId = await TestApi.CreateDirectAsync(ali, ayse);

        var content = Encoding.UTF8.GetBytes("Bu bir resim değil, düz metin.");
        var response = await ali.Client.PostAsync(UploadUrl(conversationId), TestApi.FileForm(fileName, content, clientContentType));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task On_megabayttan_buyuk_dosya_reddedilir()
    {
        var ali = await factory.NewSessionAsync("Ali");
        var ayse = await factory.NewSessionAsync("Ayse");
        var conversationId = await TestApi.CreateDirectAsync(ali, ayse);

        // Geçerli PNG imzası ama 10 MB + 1 bayt
        var big = new byte[AttachmentsController.MaxFileBytes + 1];
        TestApi.PngBytes().CopyTo(big, 0);
        var response = await ali.Client.PostAsync(UploadUrl(conversationId), TestApi.FileForm("buyuk.png", big));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("10 MB", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Dosya_adindaki_klasor_yolu_atilir()
    {
        var ali = await factory.NewSessionAsync("Ali");
        var ayse = await factory.NewSessionAsync("Ayse");
        var conversationId = await TestApi.CreateDirectAsync(ali, ayse);

        var response = await ali.Client.PostAsync(UploadUrl(conversationId), TestApi.FileForm("../../etc/foto.png", TestApi.PngBytes()));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("foto.png", (await response.ReadAsync<MessageResult>()).Attachment!.OriginalName);
    }
}
