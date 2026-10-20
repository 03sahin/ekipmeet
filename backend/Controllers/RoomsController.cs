using EkipMeet.Api.Data;
using EkipMeet.Api.Dtos;
using EkipMeet.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EkipMeet.Api.Controllers;

[ApiController]
[Route("api/[controller]")] // Adres: /api/rooms
public class RoomsController(AppDbContext db) : ControllerBase
{
    // GET /api/rooms → tüm odalar
    [HttpGet]
    public async Task<ActionResult<List<RoomResponse>>> GetAll()
    {
        var rooms = await db.Rooms
            .AsNoTracking() // Sadece okuyoruz, takip etmeye gerek yok (daha hızlı)
            .OrderBy(r => r.Id)
            .Select(r => new RoomResponse(r.Id, r.Name, r.Topic, r.CreatedAt))
            .ToListAsync();

        return Ok(rooms);
    }

    // GET /api/rooms/5 → tek oda
    [HttpGet("{id:int}")]
    public async Task<ActionResult<RoomResponse>> GetById(int id)
    {
        var room = await db.Rooms.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id);
        if (room is null) return NotFound();

        return Ok(new RoomResponse(room.Id, room.Name, room.Topic, room.CreatedAt));
    }

    // POST /api/rooms → yeni oda
    [HttpPost]
    public async Task<ActionResult<RoomResponse>> Create(CreateRoomRequest request)
    {
        var room = new Room
        {
            Name = request.Name.Trim(),
            Topic = request.Topic?.Trim() ?? string.Empty,
        };

        db.Rooms.Add(room);
        await db.SaveChangesAsync(); // INSERT burada çalışır, Id atanır

        var response = new RoomResponse(room.Id, room.Name, room.Topic, room.CreatedAt);
        // 201 Created + yeni odanın adresi
        return CreatedAtAction(nameof(GetById), new { id = room.Id }, response);
    }
}