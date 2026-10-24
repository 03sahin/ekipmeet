import { NavigatorScreenParams } from '@react-navigation/native';

// Alt sekmeler
export type TabParamList = {
  Rooms: undefined;
  Conversations: undefined;
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
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};
