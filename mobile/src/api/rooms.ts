import { Room, RoomInput } from '../types/room';
import { apiFetch } from './client';

export const getRooms = () => apiFetch<Room[]>('/api/rooms');

export const getRoom = (id: number) => apiFetch<Room>(`/api/rooms/${id}`);

export const createRoom = (input: RoomInput) =>
  apiFetch<Room>('/api/rooms', { method: 'POST', body: JSON.stringify(input) });

export const updateRoom = (id: number, input: RoomInput) =>
  apiFetch<Room>(`/api/rooms/${id}`, { method: 'PUT', body: JSON.stringify(input) });

export const deleteRoom = (id: number) => apiFetch<void>(`/api/rooms/${id}`, { method: 'DELETE' });