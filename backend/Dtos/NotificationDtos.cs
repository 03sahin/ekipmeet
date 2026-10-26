using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using EkipMeet.Api.Models;

namespace EkipMeet.Api.Dtos;

// Data, JSON metni olarak değil nesne olarak gider: istemci notification.data.conversationId diye okur
public record NotificationResponse(
    Guid Id,
    NotificationType Type,
    string Title,
    string Body,
    JsonElement Data,
    DateTime CreatedAt,
    DateTime? ReadAt);

public record UnreadCountResponse(int Count);

public class RegisterDeviceRequest
{
    [Required(ErrorMessage = "Token zorunludur.")]
    [MaxLength(200)]
    [RegularExpression(@"^Expo(nent)?PushToken\[[A-Za-z0-9_\-]+\]$", ErrorMessage = "Geçersiz push token.")]
    public string Token { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(android|ios)$", ErrorMessage = "Platform android ya da ios olmalı.")]
    public string Platform { get; set; } = string.Empty;
}
