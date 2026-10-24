import { ConversationDetail, ConversationMessage, ConversationSummary, UserSummary } from '../types/chat';
import { apiFetch } from './client';

export const MESSAGE_PAGE_SIZE = 50;

export const searchUsers = (q: string) =>
  apiFetch<UserSummary[]>(`/api/users/search?q=${encodeURIComponent(q)}`);

export const getConversations = () => apiFetch<ConversationSummary[]>('/api/conversations');

export const getConversation = (id: string) => apiFetch<ConversationDetail>(`/api/conversations/${id}`);

export const createDirect = (userId: string) =>
  apiFetch<ConversationDetail>('/api/conversations/direct', { method: 'POST', body: JSON.stringify({ userId }) });

export const createGroup = (name: string, memberIds: string[]) =>
  apiFetch<ConversationDetail>('/api/conversations/group', {
    method: 'POST',
    body: JSON.stringify({ name, memberIds }),
  });

// before verilirse o mesajdan eskileri getirir (yukarı kaydırınca)
export const getMessages = (id: string, before?: number) =>
  apiFetch<ConversationMessage[]>(
    `/api/conversations/${id}/messages?limit=${MESSAGE_PAGE_SIZE}${before ? `&before=${before}` : ''}`
  );

export const sendMessage = (id: string, text: string) =>
  apiFetch<ConversationMessage>(`/api/conversations/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });

export const markRead = (id: string) => apiFetch<void>(`/api/conversations/${id}/read`, { method: 'POST' });

export const addMember = (id: string, userId: string) =>
  apiFetch<ConversationDetail>(`/api/conversations/${id}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });

export const leaveConversation = (id: string) =>
  apiFetch<void>(`/api/conversations/${id}/leave`, { method: 'POST' });
