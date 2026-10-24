using EkipMeet.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace EkipMeet.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<RoomMessage> RoomMessages => Set<RoomMessage>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<ConversationMember> ConversationMembers => Set<ConversationMember>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<Meeting> Meetings => Set<Meeting>();
    public DbSet<MeetingParticipant> MeetingParticipants => Set<MeetingParticipant>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Aynı e-postayla iki hesap açılamaz (veritabanı seviyesinde garanti)
        modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique();
        modelBuilder.Entity<RefreshToken>().HasIndex(t => t.TokenHash).IsUnique();
        // "Bu odanın son 50 mesajı" sorgusu tüm tabloyu taramasın
        modelBuilder.Entity<RoomMessage>().HasIndex(m => new { m.RoomId, m.Id });

        modelBuilder.Entity<Conversation>(e =>
        {
            e.Property(c => c.Type).HasConversion<string>().HasMaxLength(10); // Veritabanında "Direct"/"Group" okunur
            e.HasIndex(c => c.DirectKey).IsUnique(); // Aynı iki kişi arasında tek birebir sohbet
            // Kullanıcı silinirse oluşturduğu gruplar silinmesin
            e.HasOne(c => c.CreatedBy).WithMany().HasForeignKey(c => c.CreatedById).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ConversationMember>(e =>
        {
            e.HasKey(m => new { m.ConversationId, m.UserId }); // Bir kullanıcı bir sohbette en fazla bir kez üye
            e.HasIndex(m => m.UserId); // "Benim sohbetlerim" sorgusu için
            e.Property(m => m.Role).HasConversion<string>().HasMaxLength(10);
        });

        // Sayfalama: "bu sohbette şu id'den küçük son 50 mesaj"
        modelBuilder.Entity<ChatMessage>().HasIndex(m => new { m.ConversationId, m.Id });

        modelBuilder.Entity<Meeting>(e =>
        {
            e.Property(m => m.Status).HasConversion<string>().HasMaxLength(10);
            e.Property(m => m.EndsAt); // private set olduğu için açıkça sütun olarak işaretliyoruz
            e.HasIndex(m => m.StartsAt); // Takvim aralığı ve sıralama
            // Düzenleyen kullanıcı silinirse toplantılar sessizce kaybolmasın
            e.HasOne(m => m.Organizer).WithMany().HasForeignKey(m => m.OrganizerId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<MeetingParticipant>(e =>
        {
            e.HasKey(p => new { p.MeetingId, p.UserId }); // Bir kişi bir toplantıya bir kez davet edilir
            e.HasIndex(p => p.UserId); // "Benim toplantılarım" sorgusu için
            e.Property(p => p.Role).HasConversion<string>().HasMaxLength(12);
            e.Property(p => p.Response).HasConversion<string>().HasMaxLength(10);
        });
    }
}