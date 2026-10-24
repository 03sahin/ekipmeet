using EkipMeet.Api.Dtos;
using EkipMeet.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace EkipMeet.Api.Controllers;

[ApiController]
[Route("api/calls")]
[Authorize] // TURN bilgisi eklenince sadece giriş yapanlar görebilsin
public class CallsController(IOptionsSnapshot<WebRtcOptions> options) : ControllerBase
{
    [HttpGet("ice-servers")]
    public ActionResult<List<IceServerResponse>> GetIceServers()
    {
        var servers = options.Value.IceServers
            .Where(s => s.Urls.Count > 0)
            .Select(s => new IceServerResponse(
                [.. s.Urls],
                string.IsNullOrEmpty(s.Username) ? null : s.Username,
                string.IsNullOrEmpty(s.Credential) ? null : s.Credential))
            .ToList();
        return Ok(servers);
    }
}
