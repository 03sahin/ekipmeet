// Her ekranın adı ve aldığı parametreler.
export type RootStackParamList = {
  Rooms: undefined; // Parametre almaz
  RoomDetail: { roomId: string }; // Hangi odanın açılacağını alır
};