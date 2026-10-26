using System.ComponentModel.DataAnnotations;

namespace EkipMeet.Api.Models;

// Sohbete yüklenen dosya. Dosyanın kendisi IFileStorage'da, burada sadece bilgisi var.
public class Attachment
{
    public Guid Id { get; set; } = Guid.NewGuid(); // Tahmin edilemez: id deneyerek başkasının dosyası bulunamasın

    public Guid ConversationId { get; set; }
    public Conversation Conversation { get; set; } = null!; // Sohbet silinince kayıt da silinir (dosyayı kod siler)

    public Guid UploaderId { get; set; }
    public User Uploader { get; set; } = null!;

    // Sadece indirirken gösterilir; diskte ASLA yol olarak kullanılmaz
    [MaxLength(255)]
    public string OriginalName { get; set; } = string.Empty;

    // İstemcinin söylediği değil, dosya imzasından bizim belirlediğimiz tür
    [MaxLength(100)]
    public string ContentType { get; set; } = string.Empty;

    public long SizeBytes { get; set; }

    // Depodaki anahtar (rastgele Guid). Bulut depolamaya geçilirse aynı alan nesne adı olur.
    [MaxLength(100)]
    public string StorageKey { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsImage => ContentType.StartsWith("image/");
}
