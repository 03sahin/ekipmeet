import { IceServer } from '../types/call';
import { apiFetch } from './client';

export const getIceServers = () => apiFetch<IceServer[]>('/api/calls/ice-servers');
