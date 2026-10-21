using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;

namespace EkipMeet.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    // Giriş yapmış kullanıcının kimliğini imzalı token'dan okur
    public static Guid GetUserId(this ClaimsPrincipal user) =>
        Guid.Parse(user.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);
}