using System.ComponentModel.DataAnnotations;

namespace EkipMeet.Api.Dtos;

public class CreateRoomRequest
{
    [Required(ErrorMessage = "Oda adı zorunludur.")]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(300)]
    public string? Topic { get; set; }
}

// Güncelleme aynı alanları kullanır. Dikkat: OwnerId istemciden ASLA alınmaz.
public class UpdateRoomRequest : CreateRoomRequest { }