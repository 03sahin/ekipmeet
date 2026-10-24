export type RootStackParamList = {
  Rooms: undefined;
  RoomDetail: { roomId: number };
  RoomForm: { roomId?: number }; // roomId varsa düzenleme, yoksa yeni oda
  RoomLive: { roomId: number; roomName: string };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};