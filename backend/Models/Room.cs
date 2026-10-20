using System.ComponentModel.DataAnnotations;

namespace EkipMeet.Api.Models;

// Entity: Veritabanındaki "Rooms" tablosunun C# karşılığı. Her özellik bir sütun olur.
public class Room
{
    public int Id { get; set; } // Birincil anahtar, otomatik artar

    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(300)]
    public string Topic { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow; // Saatleri hep UTC tutarız
}