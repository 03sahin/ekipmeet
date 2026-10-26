export type NotificationType = 'ChatMessage' | 'MeetingInvited' | 'MeetingChanged' | 'MeetingCancelled' | 'MeetingRemoved';

// Dokununca gidilecek yer. Push'un data'sında da aynı alanlar + notificationId ve type gelir.
export type NotificationData = {
  conversationId?: string;
  conversationTitle?: string;
  meetingId?: string;
};

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: NotificationData;
  createdAt: string;
  readAt: string | null;
};
