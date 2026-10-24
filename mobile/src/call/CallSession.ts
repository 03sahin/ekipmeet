import {
  MediaStream,
  mediaDevices,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';
import { getIceServers } from '../api/calls';
import {
  connectRoomHub,
  getHubErrorMessage,
  leaveCall,
  onClosed,
  onHubEvent,
  onReconnected,
  onReconnecting,
} from '../realtime/roomHub';
import { CallPeer, IceCandidateMessage, IceServer, JoinCallResult } from '../types/call';

// Backend'e ulaşılamazsa yine de doğrudan bağlanmayı deneyelim
const FALLBACK_ICE_SERVERS: IceServer[] = [{ urls: ['stun:stun.l.google.com:19302'] }];

// 6 kişide her cihaz 5 görüntü gönderir; çözünürlüğü düşük tutmak pili ve interneti korur
const VIDEO_CONSTRAINTS = { width: 640, height: 480, frameRate: 24 };

export type Facing = 'user' | 'environment';
export type PeerStatus = 'connecting' | 'connected' | 'failed';
export type CallPhase = 'joining' | 'live' | 'reconnecting';

// Ekranda bir kare
export type CallTile = {
  key: string; // Kendi karem için "local", diğerleri için bağlantı id'si
  displayName: string;
  isLocal: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  streamURL: string | null; // RTCView'a verilir; görüntü henüz gelmediyse null
  status: PeerStatus;
};

export type CallSnapshot = {
  phase: CallPhase;
  tiles: CallTile[];
  audioEnabled: boolean;
  videoEnabled: boolean;
  facing: Facing;
};

type Handlers = {
  onChange: (snapshot: CallSnapshot) => void;
  onEnded: (message: string) => void; // Sunucu görüşmeyi bitirdi ya da bağlantı tamamen koptu
};

type Peer = {
  info: CallPeer;
  pc: RTCPeerConnection;
  streamURL: string | null;
  pendingCandidates: IceCandidateMessage[]; // Karşının SDP'si gelmeden önce gelen ICE adayları
  status: PeerStatus;
};

// Bir görüşmenin tüm WebRTC ve sinyal işleri. Ekran sadece start/leave ve butonları çağırır.
// "Mesh" yapı: herkes herkese ayrı bir RTCPeerConnection açar (6 kişiye kadar yeterli).
export class CallSession {
  private peers = new Map<string, Peer>();
  private localStream: MediaStream | null = null;
  private iceServers: IceServer[] = FALLBACK_ICE_SERVERS;
  private myConnectionId: string | null = null;
  private joinedKey: string | null = null;
  private unsubscribers: (() => void)[] = [];
  private closed = false;

  private phase: CallPhase = 'joining';
  private audioEnabled = true;
  private videoEnabled = true;
  private inBackground = false; // Arka planda Android kamerayı keser; diğerlerine "kamera kapalı" görünsün
  private facing: Facing = 'user';

  constructor(
    private callKey: string,
    private localName: string,
    private handlers: Handlers
  ) {}

  // Hata olursa kullanıcıya gösterilecek Türkçe mesajla Error fırlatır
  async start() {
    this.iceServers = await getIceServers()
      .then((servers) => (servers.length > 0 ? servers : FALLBACK_ICE_SERVERS))
      .catch(() => FALLBACK_ICE_SERVERS);
    if (this.closed) return;

    try {
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: 'user', ...VIDEO_CONSTRAINTS },
      });
    } catch {
      throw new Error('Kamera veya mikrofon açılamadı. Başka bir uygulama kullanıyor olabilir.');
    }
    if (this.closed) {
      this.stopLocalStream(); // Bu arada ekrandan çıkıldı
      return;
    }
    this.emit(); // Kendi görüntüm bağlanırken de görünsün

    this.subscribe();
    try {
      await this.join();
    } catch (e) {
      throw new Error(getHubErrorMessage(e)); // Örn. "Görüşme dolu..."
    }
  }

  // Ekrandan çıkınca, görüşme bitince: her şeyi kapat. Birden çok kez çağrılabilir.
  leave() {
    if (this.closed) return;
    this.closed = true;
    this.unsubscribers.forEach((off) => off());
    this.unsubscribers = [];
    leaveCall();
    this.closeAllPeers();
    this.stopLocalStream();
  }

  toggleAudio() {
    this.audioEnabled = !this.audioEnabled;
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = this.audioEnabled));
    this.sendMediaState();
    this.emit();
  }

  toggleVideo() {
    this.videoEnabled = !this.videoEnabled;
    this.applyVideoEnabled();
  }

  async switchCamera() {
    const track = this.localStream?.getVideoTracks()[0];
    if (!track) return;
    const next: Facing = this.facing === 'user' ? 'environment' : 'user';
    try {
      // Verilmeyen kısıtlar varsayılana döner; çözünürlüğü de tekrar veriyoruz
      await track.applyConstraints({ facingMode: next, ...VIDEO_CONSTRAINTS });
    } catch {
      track._switchCamera(); // Eski yöntem: applyConstraints desteklenmezse
    }
    this.facing = next;
    this.emit();
  }

  setInBackground(inBackground: boolean) {
    if (this.inBackground === inBackground) return;
    this.inBackground = inBackground;
    this.applyVideoEnabled();
  }

  // ---------- Sinyalleşme ----------

  private subscribe() {
    this.unsubscribers = [
      onHubEvent('CallPeerJoined', (peer: CallPeer) => {
        // Yeni gelen bize teklif gönderecek; biz sadece karesini hazırlayıp bekleriz
        if (!this.peers.has(peer.connectionId)) this.createPeer(peer);
        this.emit();
      }),
      onHubEvent('CallPeerLeft', (connectionId: string) => {
        this.closePeer(connectionId);
        this.emit();
      }),
      onHubEvent('CallMediaChanged', (peer: CallPeer) => {
        const existing = this.peers.get(peer.connectionId);
        if (!existing) return;
        existing.info = peer;
        this.emit();
      }),
      onHubEvent('CallOffer', (from: CallPeer, sdp: string) => this.handleOffer(from, sdp)),
      onHubEvent('CallAnswer', (fromId: string, sdp: string) => this.handleAnswer(fromId, sdp)),
      onHubEvent('CallIceCandidate', (fromId: string, candidate: IceCandidateMessage) =>
        this.handleCandidate(fromId, candidate)
      ),
      onHubEvent('CallEnded', (callKey: string, message: string) => {
        if (callKey === this.joinedKey) this.end(message);
      }),
      // Bağlantı koptu: sunucu bizi görüşmeden çıkardı, eşler de bizi kaldırdı. Eşleri kapatıp bekle.
      onReconnecting(() => {
        if (this.closed) return;
        this.closeAllPeers();
        this.phase = 'reconnecting';
        this.emit();
      }),
      // Geri geldi: yeni bağlantı id'siyle tekrar katıl ve herkese yeniden teklif gönder
      onReconnected(() => {
        if (this.closed) return;
        this.join().catch((e) => this.end(getHubErrorMessage(e)));
      }),
      // Yeniden bağlanma denemeleri de bitti
      onClosed(() => this.end('Sunucu bağlantısı koptu, görüşmeden çıkıldı.')),
    ];
  }

  private async join() {
    const hub = await connectRoomHub();
    const result = await hub.invoke<JoinCallResult>('JoinCall', this.callKey);
    if (this.closed) {
      hub.invoke('LeaveCall').catch(() => {}); // Beklerken ekrandan çıkıldı
      return;
    }

    this.myConnectionId = result.connectionId;
    this.joinedKey = result.callKey;
    this.phase = 'live';
    // Sunucu herkesi "açık" sayar; kapattıklarım varsa (örn. yeniden bağlanınca) bildir
    if (!this.audioEnabled || !this.isVideoOn()) this.sendMediaState();

    for (const info of result.peers) {
      if (this.peers.has(info.connectionId)) continue; // Bizden sonra geldi; o bize teklif gönderecek
      this.makeOffer(this.createPeer(info));
    }
    this.emit();
  }

  private createPeer(info: CallPeer): Peer {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer: Peer = { info, pc, streamURL: null, pendingCandidates: [], status: 'connecting' };
    this.peers.set(info.connectionId, peer);

    const stream = this.localStream;
    stream?.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.addEventListener('icecandidate', (event) => {
      if (!event.candidate) return; // null: aday toplama bitti
      this.send('SendIceCandidate', info.connectionId, {
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid ?? null,
        sdpMLineIndex: event.candidate.sdpMLineIndex ?? null,
      });
    });

    pc.addEventListener('track', (event) => {
      const remote = event.streams[0];
      if (!remote || this.peers.get(info.connectionId) !== peer) return;
      peer.streamURL = remote.toURL();
      this.emit();
    });

    pc.addEventListener('connectionstatechange', () => {
      if (this.peers.get(info.connectionId) !== peer) return;
      const state = pc.connectionState;
      peer.status = state === 'connected' ? 'connected' : state === 'failed' ? 'failed' : 'connecting';
      this.emit();
    });

    return peer;
  }

  private async makeOffer(peer: Peer) {
    try {
      const offer = await peer.pc.createOffer({});
      await peer.pc.setLocalDescription(offer);
      this.send('SendOffer', peer.info.connectionId, offer.sdp);
    } catch {
      this.markFailed(peer);
    }
  }

  private async handleOffer(from: CallPeer, sdp: string) {
    if (this.closed || !this.localStream) return;

    let peer = this.peers.get(from.connectionId);
    // Nadir durum: ikimiz aynı anda katılıp birbirimize teklif gönderdik. Bağlantı id'si küçük olan
    // geri adım atar (kendi teklifini bırakıp cevap verir), büyük olan gelen teklifi yok sayar.
    if (peer && peer.pc.signalingState === 'have-local-offer') {
      if ((this.myConnectionId ?? '') > from.connectionId) return;
      this.closePeer(from.connectionId);
      peer = undefined;
    }
    peer ??= this.createPeer(from);
    peer.info = from;

    try {
      await peer.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
      this.flushCandidates(peer);
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      this.send('SendAnswer', from.connectionId, answer.sdp);
    } catch {
      this.markFailed(peer);
    }
    this.emit();
  }

  private async handleAnswer(fromId: string, sdp: string) {
    const peer = this.peers.get(fromId);
    if (!peer || peer.pc.signalingState !== 'have-local-offer') return;
    try {
      await peer.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
      this.flushCandidates(peer);
    } catch {
      this.markFailed(peer);
    }
  }

  private handleCandidate(fromId: string, candidate: IceCandidateMessage) {
    const peer = this.peers.get(fromId);
    if (!peer) return;
    if (!peer.pc.remoteDescription) {
      peer.pendingCandidates.push(candidate);
      return;
    }
    peer.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
  }

  private flushCandidates(peer: Peer) {
    const pending = peer.pendingCandidates;
    peer.pendingCandidates = [];
    pending.forEach((c) => peer.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
  }

  // ---------- Yardımcılar ----------

  private isVideoOn() {
    return this.videoEnabled && !this.inBackground;
  }

  private applyVideoEnabled() {
    const on = this.isVideoOn();
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = on));
    this.sendMediaState();
    this.emit();
  }

  private sendMediaState() {
    if (this.phase !== 'live') return; // Yeniden katılınca join() zaten gönderir
    this.send('ToggleMedia', this.audioEnabled, this.isVideoOn());
  }

  // Sinyal mesajı gönder; hata olursa görüşmeyi bozmasın (bağlantı koptuysa yeniden katılınca düzelir)
  private send(method: string, ...args: unknown[]) {
    if (this.closed) return;
    connectRoomHub()
      .then((hub) => hub.invoke(method, ...args))
      .catch(() => {});
  }

  private markFailed(peer: Peer) {
    peer.status = 'failed';
    this.emit();
  }

  private closePeer(connectionId: string) {
    const peer = this.peers.get(connectionId);
    if (!peer) return;
    this.peers.delete(connectionId);
    peer.pc.close();
  }

  private closeAllPeers() {
    [...this.peers.keys()].forEach((id) => this.closePeer(id));
  }

  private stopLocalStream() {
    this.localStream?.getTracks().forEach((t) => t.stop()); // Kamera ışığı söner, mikrofon bırakılır
    this.localStream?.release();
    this.localStream = null;
  }

  private end(message: string) {
    if (this.closed) return;
    this.leave();
    this.handlers.onEnded(message);
  }

  private emit() {
    if (this.closed) return;
    const local: CallTile = {
      key: 'local',
      displayName: this.localName,
      isLocal: true,
      audioEnabled: this.audioEnabled,
      videoEnabled: this.isVideoOn(),
      streamURL: this.localStream?.toURL() ?? null,
      status: 'connected',
    };
    const remotes: CallTile[] = [...this.peers.values()].map((p) => ({
      key: p.info.connectionId,
      displayName: p.info.displayName,
      isLocal: false,
      audioEnabled: p.info.audioEnabled,
      videoEnabled: p.info.videoEnabled,
      streamURL: p.streamURL,
      status: p.status,
    }));
    this.handlers.onChange({
      phase: this.phase,
      tiles: [local, ...remotes],
      audioEnabled: this.audioEnabled,
      videoEnabled: this.videoEnabled,
      facing: this.facing,
    });
  }
}
