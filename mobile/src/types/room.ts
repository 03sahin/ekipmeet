export type Room = {
  id: number;
  name: string;
  topic: string;
  ownerId: string;
  ownerName: string;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string | null;
  memberCount: number; // Şu an odada olan kişi sayısı (canlı güncellenir)
};

// --- Canlı oda (SignalR) ---
export type RoomMember = {
  userId: string;
  displayName: string;
};

export type ChatMessage = {
  id: number;
  roomId: number;
  senderId: string;
  senderName: string;
  text: string;
  sentAt: string;
};

export type JoinRoomResult = {
  roomId: number;
  members: RoomMember[];
  messages: ChatMessage[];
};

// Oluşturma ve düzenlemede gönderilen alanlar
export type RoomInput = {
  name: string;
  topic: string;
};