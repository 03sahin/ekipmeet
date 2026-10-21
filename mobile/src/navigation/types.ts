export type RootStackParamList = {
  Rooms: undefined;
  RoomDetail: { roomId: number };
  RoomForm: { roomId?: number }; // roomId varsa düzenleme, yoksa yeni oda
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};