export type UserSummary = {
  id: string;
  displayName: string;
};

export type ConversationType = 'Direct' | 'Group';
export type MemberRole = 'Owner' | 'Member';

export type LastMessagePreview = {
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
};

// Sohbet listesindeki bir satır
export type ConversationSummary = {
  id: string;
  type: ConversationType;
  title: string; // Grupta grup adı, birebirde karşı tarafın adı
  lastMessage: LastMessagePreview | null;
  lastMessageAt: string;
  unreadCount: number;
};

export type ConversationMember = {
  userId: string;
  displayName: string;
  role: MemberRole;
  joinedAt: string;
};

export type ConversationDetail = {
  id: string;
  type: ConversationType;
  title: string;
  myRole: MemberRole;
  createdAt: string;
  members: ConversationMember[];
};

// Oda sohbetindeki ChatMessage'dan ayrı: bu birebir/grup sohbet mesajı
export type ConversationMessage = {
  id: number;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
};
