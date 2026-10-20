using System.ComponentModel.DataAnnotations;

namespace EkipMeet.Api.Dtos;

// İstemciden gelen veri. Entity'yi doğrudan dışarı açmıyoruz.
public class CreateRoomRequest
{
    [Required(ErrorMessage = "Oda adı zorunludur.")]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(300)]
    public string? Topic { get; set; }
}