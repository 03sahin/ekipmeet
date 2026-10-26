using EkipMeet.Api.Data;
using EkipMeet.Api.Dtos;
using EkipMeet.Api.Extensions;
using EkipMeet.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EkipMeet.Api.Controllers;

[ApiController]
[Route("api/devices")]
[Authorize]
public class DevicesController(AppDbContext db) : ControllerBase
{
    // Push token'ı kaydeder. Aynı token başka hesaba kayıtlıysa (cihazda hesap değişti) bu hesaba geçer:
    // eski kullanıcının bildirimleri bu cihaza gitmesin.
    [HttpPost]
    public async Task<IActionResult> Register(RegisterDeviceRequest request)
    {
        var me = User.GetUserId();
        var device = await db.DeviceTokens.FirstOrDefaultAsync(d => d.Token == request.Token);
        if (device is null)
        {
            db.DeviceTokens.Add(new DeviceToken { UserId = me, Token = request.Token, Platform = request.Platform });
        }
        else
        {
            device.UserId = me;
            device.Platform = request.Platform;
            device.LastSeenAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync();
        return NoContent();
    }

    // Çıkış yaparken: sadece kendi token'ımı silebilirim
    [HttpDelete("{token}")]
    public async Task<IActionResult> Unregister(string token)
    {
        var me = User.GetUserId();
        var deleted = await db.DeviceTokens.Where(d => d.Token == token && d.UserId == me).ExecuteDeleteAsync();
        return deleted == 0 ? NotFound(new { message = "Cihaz bulunamadı." }) : NoContent();
    }
}
