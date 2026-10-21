using EkipMeet.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace EkipMeet.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Aynı e-postayla iki hesap açılamaz (veritabanı seviyesinde garanti)
        modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique();
        modelBuilder.Entity<RefreshToken>().HasIndex(t => t.TokenHash).IsUnique();
    }
}