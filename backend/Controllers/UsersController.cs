using EkipMeet.Api.Data;
using EkipMeet.Api.Dtos;
using EkipMeet.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EkipMeet.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController(AppDbContext db) : ControllerBase
{
    [HttpGet("search")]
    public async Task<ActionResult<List<UserSummary>>> Search([FromQuery] string? q)
    {
        var term = q?.Trim() ?? string.Empty;
        if (term.Length < 2)
            return BadRequest(new { message = "Aramak için en az 2 karakter yaz." });
        if (term.Length > 50) term = term[..50];

        // % ve _ LIKE'ta joker karakterdir; kullanıcı yazarsa düz karakter olarak aransın
        var pattern = $"%{term.Replace(@"\", @"\\").Replace("%", @"\%").Replace("_", @"\_")}%";
        var me = User.GetUserId();

        var users = await db.Users.AsNoTracking()
            .Where(u => u.Id != me && EF.Functions.ILike(u.DisplayName, pattern, @"\")) // ILike: büyük/küçük harf duyarsız
            .OrderBy(u => u.DisplayName)
            .Take(20)
            .Select(u => new UserSummary(u.Id, u.DisplayName)) // E-posta bilerek döndürülmüyor
            .ToListAsync();

        return Ok(users);
    }
}
