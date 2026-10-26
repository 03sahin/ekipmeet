import { Directory, File, Paths, UploadType } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { AttachmentInfo, ConversationMessage } from '../types/chat';
import { ApiError, getValidAccessToken } from './client';
import { API_URL } from './config';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // Backend'deki sınırla aynı

export const attachmentUrl = (id: string) => `${API_URL}/api/attachments/${id}`;

// Seçilen dosya (galeri, kamera ya da belge seçiciden)
export type PickedFile = {
  uri: string;
  name: string; // Sunucuya bu adla gider ve indirirken bu ad görünür
  mimeType?: string;
  size?: number;
};

export type UploadProgress = { sent: number; total: number };

// Dosyayı yükler; sunucu aynı istekte ekli mesajı oluşturup döner.
// İlerleme onProgress ile gelir; signal iptal edilirse istek kesilir ve hiçbir şey kaydedilmez.
export async function uploadAttachment(
  conversationId: string,
  picked: PickedFile,
  options: { text?: string; onProgress?: (p: UploadProgress) => void; signal?: AbortSignal }
): Promise<ConversationMessage> {
  // Seçicinin verdiği dosya adı rastgele olabilir; orijinal adla geçici bir kopya yükleriz
  const folder = new Directory(Paths.cache, 'uploads', String(Date.now()));
  folder.create({ intermediates: true, idempotent: true });
  const file = new File(folder, safeName(picked.name));

  try {
    await new File(picked.uri).copy(file);
    const token = await getValidAccessToken();
    const result = await file.upload(`${API_URL}/api/conversations/${conversationId}/attachments`, {
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType: picked.mimeType ?? 'application/octet-stream',
      parameters: options.text ? { text: options.text } : undefined,
      headers: { Authorization: `Bearer ${token}` },
      onProgress: (p) => options.onProgress?.({ sent: p.bytesSent, total: p.totalBytes }),
      signal: options.signal,
    });

    if (result.status < 200 || result.status >= 300) {
      let message = 'Dosya yüklenemedi.';
      try {
        message = JSON.parse(result.body).message ?? message; // Örn. "Bu dosya türü desteklenmiyor..."
      } catch {}
      throw new ApiError(result.status, message);
    }
    return JSON.parse(result.body) as ConversationMessage;
  } finally {
    folder.delete(); // Geçici kopya kalmasın
  }
}

// Belgeyi önbelleğe indirir (yetkili istekle) ve başka bir uygulamayla açar; açılamazsa paylaşım menüsü
export async function openAttachment(attachment: AttachmentInfo) {
  const folder = new Directory(Paths.cache, 'attachments', attachment.id);
  folder.create({ intermediates: true, idempotent: true });
  const file = new File(folder, safeName(attachment.originalName));

  if (!file.exists) {
    const token = await getValidAccessToken();
    try {
      await File.downloadFileAsync(attachmentUrl(attachment.id), file, {
        headers: { Authorization: `Bearer ${token}` },
        idempotent: true,
      });
    } catch {
      if (file.exists) file.delete(); // Yarım kalan dosya bir sonraki denemede "var" sanılmasın
      throw new Error('Dosya indirilemedi. Hâlâ bu sohbetin üyesi misin?');
    }
  }

  if (await File.canPreview(file, { mimeType: attachment.contentType }).catch(() => false)) {
    await File.preview(file, { mimeType: attachment.contentType, title: attachment.originalName });
  } else if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: attachment.contentType, dialogTitle: attachment.originalName });
  } else {
    throw new Error('Bu dosyayı açabilecek bir uygulama bulunamadı.');
  }
}

// Dosya sistemi için güvenli ad: klasör ayırıcıları ve özel karakterler atılır
function safeName(name: string) {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned.length > 0 ? cleaned : 'dosya';
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
