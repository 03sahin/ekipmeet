export type Room = {
  id: number;
  name: string;
  topic: string;
  ownerId: string;
  ownerName: string;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string | null;
};

// Oluşturma ve düzenlemede gönderilen alanlar
export type RoomInput = {
  name: string;
  topic: string;
};