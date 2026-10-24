using EkipMeet.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace EkipMeet.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<RoomMessage> RoomMessages => Set<RoomMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Aynı e-postayla iki hesap açılamaz (veritabanı seviyesinde garanti)
        modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique();
        modelBuilder.Entity<RefreshToken>().HasIndex(t => t.TokenHash).IsUnique();
        // "Bu odanın son 50 mesajı" sorgusu tüm tabloyu taramasın
        modelBuilder.Entity<RoomMessage>().HasIndex(m => new { m.RoomId, m.Id });
    }
}