import { API_URL } from './config';
import { AuthResponse } from '../types/auth';
import * as tokenStorage from '../auth/tokenStorage';

// Access token sadece bellekte durur (kısa ömürlü, diske yazılmaz)
let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;
let refreshPromise: Promise<boolean> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Bu adreslerde 401 "şifre yanlış" demektir; token yenilemeye çalışmayız
const NO_REFRESH = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout'];

async function refreshTokens(): Promise<boolean> {
  // Aynı anda birkaç istek 401 alırsa tek bir yenileme yapılsın
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) return false;

      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        await tokenStorage.clearRefreshToken();
        accessToken = null;
        return false;
      }

      const data: AuthResponse = await res.json();
      accessToken = data.accessToken;
      await tokenStorage.saveRefreshToken(data.refreshToken); // Rotation: yenisini sakla
      return true;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// Tüm API çağrıları buradan geçer: token ekler, süresi dolduysa yenileyip tekrar dener
export async function apiFetch<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry && !NO_REFRESH.includes(path)) {
    if (await refreshTokens()) return apiFetch<T>(path, options, false);
    onSessionExpired?.();
    throw new ApiError(401, 'Oturumun sona erdi. Tekrar giriş yap.');
  }

  if (!res.ok) {
    let message = 'Bir hata oluştu.';
    try {
      const body: any = await res.json();
      // Backend ya { message } ya da doğrulama hataları { errors: { Alan: ["..."] } } döner
      message = body.message ?? (body.errors ? (Object.values(body.errors).flat()[0] as string) : message);
    } catch {}
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}