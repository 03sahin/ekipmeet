using System.Text;

namespace EkipMeet.Api.Services;

// Dosyanın türüne, istemcinin gönderdiği Content-Type'a göre DEĞİL; uzantı + dosyanın ilk baytlarına
// (imza, "magic bytes") göre karar verir. İkisi uyuşmazsa dosya reddedilir (örn. adı .jpg olan bir .exe).
public static class FileTypeInspector
{
    public const int HeaderSize = 8192; // İmzaya bakmak ve txt'yi denetlemek için okunan baş kısım

    private enum Signature { Jpeg, Png, Webp, Heic, Pdf, Zip, Text }

    private sealed record AllowedType(string ContentType, Signature Signature);

    private static readonly Dictionary<string, AllowedType> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = new("image/jpeg", Signature.Jpeg),
        [".jpeg"] = new("image/jpeg", Signature.Jpeg),
        [".png"] = new("image/png", Signature.Png),
        [".webp"] = new("image/webp", Signature.Webp),
        [".heic"] = new("image/heic", Signature.Heic),
        [".pdf"] = new("application/pdf", Signature.Pdf),
        // Office dosyaları aslında zip arşividir; imza aynı, türü uzantı belirler
        [".docx"] = new("application/vnd.openxmlformats-officedocument.wordprocessingml.document", Signature.Zip),
        [".xlsx"] = new("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", Signature.Zip),
        [".pptx"] = new("application/vnd.openxmlformats-officedocument.presentationml.presentation", Signature.Zip),
        [".zip"] = new("application/zip", Signature.Zip),
        [".txt"] = new("text/plain", Signature.Text),
    };

    public static string AllowedList => "jpg, png, webp, heic, pdf, docx, xlsx, pptx, txt, zip";

    // Uygunsa gerçek içerik türünü, değilse null döner
    public static string? Detect(string fileName, ReadOnlySpan<byte> header)
    {
        if (!Allowed.TryGetValue(Path.GetExtension(fileName), out var type)) return null;
        return Matches(type.Signature, header) ? type.ContentType : null;
    }

    private static bool Matches(Signature signature, ReadOnlySpan<byte> h) => signature switch
    {
        Signature.Jpeg => h.StartsWith((ReadOnlySpan<byte>)[0xFF, 0xD8, 0xFF]),
        Signature.Png => h.StartsWith((ReadOnlySpan<byte>)[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        Signature.Webp => h.Length >= 12 && h[..4].SequenceEqual("RIFF"u8) && h[8..12].SequenceEqual("WEBP"u8),
        Signature.Heic => IsHeic(h),
        Signature.Pdf => h.StartsWith("%PDF-"u8),
        // PK\3\4: normal zip, PK\5\6: boş zip
        Signature.Zip => h.StartsWith((ReadOnlySpan<byte>)[0x50, 0x4B, 0x03, 0x04]) || h.StartsWith((ReadOnlySpan<byte>)[0x50, 0x4B, 0x05, 0x06]),
        Signature.Text => IsText(h),
        _ => false,
    };

    // HEIC: 4. bayttan itibaren "ftyp" kutusu ve HEIF ailesinden bir marka
    private static bool IsHeic(ReadOnlySpan<byte> h)
    {
        if (h.Length < 12 || !h[4..8].SequenceEqual("ftyp"u8)) return false;
        var brand = Encoding.ASCII.GetString(h[8..12]);
        return brand is "heic" or "heix" or "hevc" or "hevx" or "heim" or "heis" or "mif1" or "msf1";
    }

    // Metin dosyasının imzası yoktur: NUL baytı içermemeli ve geçerli UTF-8 olmalı
    private static bool IsText(ReadOnlySpan<byte> h)
    {
        if (h.IndexOf((byte)0) >= 0) return false;
        // Baş kısım bir UTF-8 karakterin ortasında kesilmiş olabilir; sondaki 3 baytı hoş görürüz
        var check = h.Length == HeaderSize ? h[..^3] : h;
        try
        {
            new UTF8Encoding(false, throwOnInvalidBytes: true).GetCharCount(check);
            return true;
        }
        catch (DecoderFallbackException)
        {
            return false;
        }
    }
}
