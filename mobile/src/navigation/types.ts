// Giriş yapmış kullanıcının ekranları
export type RootStackParamList = {
  Rooms: undefined;
  RoomDetail: { roomId: string };
};

// Giriş yapmamış kullanıcının ekranları
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};