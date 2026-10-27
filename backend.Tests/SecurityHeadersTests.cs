using System.Net;
using EkipMeet.Api.Tests.Infrastructure;

namespace EkipMeet.Api.Tests;

[Collection(ApiCollection.Name)]
public class SecurityHeadersTests(ApiFactory factory)
{
    [Fact]
    public async Task Yanitlarda_guvenlik_basliklari_var_ve_hata_govdesi_ProblemDetails()
    {
        var response = await factory.CreateClient().GetAsync("/api/auth/me"); // Token yok → 401

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Testing_ortaminda_swagger_kapali()
    {
        var response = await factory.CreateClient().GetAsync("/swagger/v1/swagger.json");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
