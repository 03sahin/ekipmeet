import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { apiFetch, setAccessToken, setSessionExpiredHandler } from '../api/client';
import { stopRoomHub } from '../realtime/roomHub';
import { AuthResponse, User } from '../types/auth';
import * as tokenStorage from './tokenStorage';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
};

// Context: Oturum bilgisini tüm ekranlarla props geçirmeden paylaşmamızı sağlar
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // useEffect(..., []): Uygulama açılınca bir kez çalışır
  useEffect(() => {
    setSessionExpiredHandler(() => {
      stopRoomHub();
      setUser(null);
    });

    (async () => {
      try {
        // Kayıtlı refresh token varsa /me çağrısı otomatik yenileme yapıp oturumu geri getirir
        if (await tokenStorage.getRefreshToken()) {
          setUser(await apiFetch<User>('/api/auth/me'));
        }
      } catch {
        // Token geçersizse sessizce giriş ekranına düşer
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function handleAuth(data: AuthResponse) {
    setAccessToken(data.accessToken);
    await tokenStorage.saveRefreshToken(data.refreshToken);
    setUser(data.user);
  }

  async function login(email: string, password: string) {
    const data = await apiFetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await handleAuth(data);
  }

  async function register(email: string, password: string, displayName: string) {
    const data = await apiFetch<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    await handleAuth(data);
  }

  async function logout() {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (refreshToken) {
      // Sunucuda iptal et; ağ hatası olsa bile cihazdan çıkış yapılsın
      apiFetch('/api/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }).catch(() => {});
    }
    await stopRoomHub(); // Canlı bağlantı da kapansın; yoksa çıkış yapan kullanıcı odada görünmeye devam eder
    setAccessToken(null);
    await tokenStorage.clearRefreshToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Özel hook: Ekranlarda const { user, login } = useAuth() şeklinde kullanılır
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı.');
  return ctx;
}