export type MeetingStatus = 'Scheduled' | 'Cancelled';
export type ParticipantRole = 'Organizer' | 'Participant';
export type ParticipantResponse = 'Pending' | 'Accepted' | 'Declined';

// Takvim ve "Yaklaşan" listesindeki satır. Tarihler UTC ISO metni; ekranda yerel saate çevrilir.
export type MeetingSummary = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  isInstant: boolean;
  status: MeetingStatus;
  organizerId: string;
  organizerName: string;
  isOrganizer: boolean;
  myResponse: ParticipantResponse;
  participantCount: number;
  acceptedCount: number;
};

export type MeetingParticipant = {
  userId: string;
  displayName: string;
  role: ParticipantRole;
  response: ParticipantResponse;
  respondedAt: string | null;
};

export type MeetingDetail = Omit<MeetingSummary, 'participantCount' | 'acceptedCount'> & {
  description: string;
  createdAt: string;
  updatedAt: string | null;
  participants: MeetingParticipant[];
};

export type MeetingInput = {
  title: string;
  description: string;
  startsAt: string; // toISOString() ile UTC
  durationMinutes: number;
};
