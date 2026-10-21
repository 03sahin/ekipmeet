import { ApiError } from './client';

// Ekranlarda gösterilecek hata mesajı
export function getErrorMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Sunucuya ulaşılamadı. Backend çalışıyor mu?';
}