// --- Görüntülü görüşme (SignalR sinyalleşme + WebRTC) ---

// Görüşme anahtarı backend'deki biçimle aynı: "meeting:{guid}" ya da "room:{id}"
export const meetingCallKey = (meetingId: string) => `meeting:${meetingId}`;
export const roomCallKey = (roomId: number) => `room:${roomId}`;

// Sunucunun bildiği katılımcı bilgisi; connectionId sinyal mesajlarının hedefi
export type CallPeer = {
  connectionId: string;
  userId: string;
  displayName: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
};

export type JoinCallResult = {
  callKey: string;
  connectionId: string;
  peers: CallPeer[]; // Benden önce içeride olanlar
};

export type IceCandidateMessage = {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
};

export type IceServer = {
  urls: string[];
  username?: string;
  credential?: string;
};
