using EkipMeet.Api.Data;
using EkipMeet.Api.Dtos;
using EkipMeet.Api.Extensions;
using EkipMeet.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EkipMeet.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController(AppDbContext db, ChatNotifier notifier) : ControllerBase
{
    private const int MaxPageSize = 50;

    // Sayfalama: before verilmezse en yeniler, verilirse o andan eskiler. Dönüş yeniden eskiye.
    [HttpGet]
    public async Task<ActionResult<List<NotificationResponse>>> GetAll([FromQuery] DateTimeOffset? before, [FromQuery] int limit = 30)
    {
        var me = User.GetUserId();
        limit = Math.Clamp(limit, 1, MaxPageSize);

        var query = db.Notifications.AsNoTracking().Where(n => n.UserId == me); // Sadece kendi bildirimlerim
        if (before is not null)
        {
            var cursor = before.Value.UtcDateTime;
            query = query.Where(n => n.CreatedAt < cursor);
        }

        var items = await query.OrderByDescending(n => n.CreatedAt).Take(limit).ToListAsync();
        return Ok(items.Select(NotificationService.ToResponse).ToList());
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<UnreadCountResponse>> GetUnreadCount()
    {
        var me = User.GetUserId();
        var count = await db.Notifications.CountAsync(n => n.UserId == me && n.ReadAt == null);
        return Ok(new UnreadCountResponse(count));
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        var me = User.GetUserId();
        var notification = await db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == me);
        if (notification is null) return NotFound(new { message = "Bildirim bulunamadı." }); // Başkasınınki de 404

        if (notification.ReadAt is null)
        {
            notification.ReadAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            await notifier.NotificationsChanged(me);
        }
        return NoContent();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        var me = User.GetUserId();
        var updated = await db.Notifications
            .Where(n => n.UserId == me && n.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, DateTime.UtcNow));
        if (updated > 0) await notifier.NotificationsChanged(me);
        return NoContent();
    }
}
