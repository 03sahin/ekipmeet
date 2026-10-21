using System.ComponentModel.DataAnnotations;

namespace EkipMeet.Api.Models;

public class Room
{
    public int Id { get; set; }

    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(300)]
    public string Topic { get; set; } = string.Empty;

    public Guid OwnerId { get; set; } // Odayı oluşturan kullanıcı
    public User Owner { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}