import { NavigatorScreenParams } from '@react-navigation/native';

// Alt sekmeler
export type TabParamList = {
  Rooms: undefined;
  Conversations: undefined;
  Meetings: undefined;
};

// Sekmelerin üstünde açılan ekranlar (alt çubuk bu ekranlarda gizlenir)
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  RoomDetail: { roomId: number };
  RoomForm: { roomId?: number }; // roomId varsa düzenleme, yoksa yeni oda
  RoomLive: { roomId: number; roomName: string };
  Chat: { conversationId: string; title: string };
  NewChat: undefined;
  GroupInfo: { conversationId: string };
  MeetingDetail: { meetingId: string };
  MeetingForm: { meetingId?: string; date?: string }; // meetingId varsa düzenleme; date ("2026-10-24") yeni toplantının günü
  InstantMeeting: undefined;
  Call: { callKey: string; title: string }; // callKey: "meeting:{guid}" ya da "room:{id}"
  ImageViewer: { attachmentId: string; name: string };
  Notifications: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};
