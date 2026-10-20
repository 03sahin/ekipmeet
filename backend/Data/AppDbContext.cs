using EkipMeet.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace EkipMeet.Api.Data;

// DbContext: Uygulama ile veritabanı arasındaki köprü.
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    // Her DbSet bir tabloya karşılık gelir.
    public DbSet<Room> Rooms => Set<Room>();
}