import { AppNotification } from '../types/notification';
import { apiFetch } from './client';

export const NOTIFICATION_PAGE_SIZE = 30;

// before verilirse o andan eski bildirimler (aşağı kaydırınca)
export const getNotifications = (before?: string) =>
  apiFetch<AppNotification[]>(
    `/api/notifications?limit=${NOTIFICATION_PAGE_SIZE}${before ? `&before=${encodeURIComponent(before)}` : ''}`
  );

export const getUnreadNotificationCount = () =>
  apiFetch<{ count: number }>('/api/notifications/unread-count').then((r) => r.count);

export const markNotificationRead = (id: string) =>
  apiFetch<void>(`/api/notifications/${id}/read`, { method: 'POST' });

export const markAllNotificationsRead = () => apiFetch<void>('/api/notifications/read-all', { method: 'POST' });

export const registerDevice = (token: string, platform: string) =>
  apiFetch<void>('/api/devices', { method: 'POST', body: JSON.stringify({ token, platform }) });

export const unregisterDevice = (token: string) =>
  apiFetch<void>(`/api/devices/${encodeURIComponent(token)}`, { method: 'DELETE' });
