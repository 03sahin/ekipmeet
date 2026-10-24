using System.Linq.Expressions;
using EkipMeet.Api.Data;
using EkipMeet.Api.Dtos;
using EkipMeet.Api.Extensions;
using EkipMeet.Api.Hubs;
using EkipMeet.Api.Models;
using EkipMeet.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace EkipMeet.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] // Bu controller'daki TÜM endpoint'ler giriş ister
public class RoomsController(AppDbContext db, PresenceTracker presence, IHubContext<RoomHub> hub, CallNotifier callNotifier)
    : ControllerBase
{
    // Entity → yanıt dönüşümü. Expression olduğu için EF bunu SQL'e çevirebilir.
    // MemberCount SQL'de bilinmez; 0 yazıp sonra WithCount ile bellekten dolduruyoruz.
    private static Expression<Func<Room, RoomResponse>> ToResponse(Guid userId) =>
        r => new RoomResponse(r.Id, r.Name, r.Topic, r.OwnerId, r.Owner.DisplayName,
            r.OwnerId == userId, r.CreatedAt, r.UpdatedAt, 0);

    private RoomResponse WithCount(RoomResponse room) => room with { MemberCount = presence.GetCount(room.Id) };

    [HttpGet]
    public async Task<ActionResult<List<RoomResponse>>> GetAll()
    {
        var userId = User.GetUserId();
        var rooms = await db.Rooms.AsNoTracking()
            .OrderByDescending(r => r.CreatedAt) // En yeni oda en üstte
            .Select(ToResponse(userId))
            .ToListAsync();
        return Ok(rooms.Select(WithCount).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<RoomResponse>> GetById(int id)
    {
        var room = await db.Rooms.AsNoTracking()
            .Where(r => r.Id == id)
            .Select(ToResponse(User.GetUserId()))
            .FirstOrDefaultAsync();

        return room is null ? NotFound(new { message = "Oda bulunamadı." }) : Ok(WithCount(room));
    }

    [HttpPost]
    public async Task<ActionResult<RoomResponse>> Create(CreateRoomRequest request)
    {
        var userId = User.GetUserId();
        var room = new Room
        {
            Name = request.Name.Trim(),
            Topic = request.Topic?.Trim() ?? string.Empty,
            OwnerId = userId, // Sahip token'dan gelir, istemci başkası adına oda açamaz
        };
        db.Rooms.Add(room);
        await db.SaveChangesAsync();

        var response = await db.Rooms.Where(r => r.Id == room.Id).Select(ToResponse(userId)).FirstAsync();
        return CreatedAtAction(nameof(GetById), new { id = room.Id }, response);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<RoomResponse>> Update(int id, UpdateRoomRequest request)
    {
        var userId = User.GetUserId();
        var room = await db.Rooms.FindAsync(id);
        if (room is null) return NotFound(new { message = "Oda bulunamadı." });

        // IDOR koruması: Oda id'sini bilmek yetmez, sahibi olmak gerekir
        if (room.OwnerId != userId)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Bu odayı sadece sahibi düzenleyebilir." });

        room.Name = request.Name.Trim();
        room.Topic = request.Topic?.Trim() ?? string.Empty;
        room.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var response = await db.Rooms.Where(r => r.Id == id).Select(ToResponse(userId)).FirstAsync();
        return Ok(WithCount(response));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var room = await db.Rooms.FindAsync(id);
        if (room is null) return NotFound(new { message = "Oda bulunamadı." });

        if (room.OwnerId != User.GetUserId())
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Bu odayı sadece sahibi silebilir." });

        db.Rooms.Remove(room); // Mesajları da cascade ile silinir
        await db.SaveChangesAsync();

        // İçeride olanlar artık yok olan odaya mesaj yazamasın; ekranlarına da haber ver
        presence.RemoveRoom(id);
        await hub.Clients.Group(RoomHub.GroupName(id)).SendAsync(RoomHubEvents.RoomDeleted, id);
        await callNotifier.EndCall(CallTracker.RoomKey(id), "Oda sahibi tarafından silindi.");
        return NoContent();
    }
}