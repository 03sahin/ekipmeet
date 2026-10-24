import { MeetingDetail, MeetingInput, MeetingSummary } from '../types/meeting';
import { apiFetch } from './client';

// from/to Date olarak alınır, sunucuya UTC gider
export const getMeetingsInRange = (from: Date, to: Date) =>
  apiFetch<MeetingSummary[]>(
    `/api/meetings?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`
  );

export const getUpcomingMeetings = () => apiFetch<MeetingSummary[]>('/api/meetings/upcoming');

export const getMeeting = (id: string) => apiFetch<MeetingDetail>(`/api/meetings/${id}`);

export const createMeeting = (input: MeetingInput & { participantIds: string[] }) =>
  apiFetch<MeetingDetail>('/api/meetings', { method: 'POST', body: JSON.stringify(input) });

export const createInstantMeeting = (title: string, participantIds: string[]) =>
  apiFetch<MeetingDetail>('/api/meetings/instant', {
    method: 'POST',
    body: JSON.stringify({ title: title.trim() || null, participantIds }),
  });

export const updateMeeting = (id: string, input: MeetingInput) =>
  apiFetch<MeetingDetail>(`/api/meetings/${id}`, { method: 'PUT', body: JSON.stringify(input) });

export const cancelMeeting = (id: string) =>
  apiFetch<MeetingDetail>(`/api/meetings/${id}/cancel`, { method: 'POST' });

export const respondToMeeting = (id: string, response: 'Accepted' | 'Declined') =>
  apiFetch<MeetingDetail>(`/api/meetings/${id}/respond`, { method: 'POST', body: JSON.stringify({ response }) });

export const addParticipant = (id: string, userId: string) =>
  apiFetch<MeetingDetail>(`/api/meetings/${id}/participants`, { method: 'POST', body: JSON.stringify({ userId }) });

export const removeParticipant = (id: string, userId: string) =>
  apiFetch<MeetingDetail>(`/api/meetings/${id}/participants/${userId}`, { method: 'DELETE' });
