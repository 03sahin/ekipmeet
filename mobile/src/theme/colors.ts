// Sekmelerin vurgu rengi. Açık temada solid ve text aynı; koyu temada text daha açık tutulur ki koyu zeminde okunsun.
export type Accent = {
  solid: string; // Dolu buton, FAB, seçili çip (üstünde beyaz yazı)
  text: string; // Zemin üstündeki vurgulu yazı ve simgeler
  soft: string; // Hafif renkli zemin (çip, rozet, etiket)
  onSoft: string; // soft zemin üstündeki yazı
  border: string;
  faint: string; // Çok hafif zemin (okunmamış satır, toplantı ekranı zemini)
};

export type ThemeColors = {
  background: string; // Ekran zemini
  surface: string; // Kart, başlık çubuğu, sekme çubuğu, alt sayfa
  surfaceMuted: string; // Arama kutusu, nötr çip, basılı satır
  text: string;
  textSecondary: string;
  textTertiary: string; // İpucu, boş liste yazısı
  textMuted: string; // Saat gibi en sönük yazılar
  border: string;
  inputBorder: string;
  placeholder: string;
  onAccent: string; // Dolu renkli zemin üstündeki yazı
  disabled: string;
  backdrop: string; // Modal arkası

  danger: string; // Hata yazısı, kırmızı kenarlıklı buton
  dangerSolid: string; // Kırmızı rozet / dolu zemin
  dangerSoft: string;
  onDangerSoft: string;
  warningSoft: string;
  onWarningSoft: string;

  // Uygulama içi bildirim şeridi (açık temada da koyu durur)
  banner: string;
  bannerBorder: string;
  bannerTitle: string;
  bannerBody: string;

  // Birebir/grup sohbet ekranı (mesajlaşma uygulaması tarzı)
  chatWallpaper: string;
  bubbleMine: string;
  bubbleOther: string;
  bubbleText: string;
  bubbleTime: string;
  chatInput: string;
  attachmentCard: string;

  rooms: Accent; // Mavi
  chats: Accent; // Yeşil
  meetings: Accent; // Turuncu
};

export const lightColors: ThemeColors = {
  background: '#f3f4f6',
  surface: '#ffffff',
  surfaceMuted: '#f3f4f6',
  text: '#111827',
  textSecondary: '#4b5563',
  textTertiary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  inputBorder: '#d1d5db',
  placeholder: '#9ca3af',
  onAccent: '#ffffff',
  disabled: '#d1d5db',
  backdrop: 'rgba(0,0,0,0.35)',

  danger: '#dc2626',
  dangerSolid: '#dc2626',
  dangerSoft: '#fee2e2',
  onDangerSoft: '#991b1b',
  warningSoft: '#fef3c7',
  onWarningSoft: '#92400e',

  banner: '#1f2937',
  bannerBorder: '#1f2937',
  bannerTitle: '#ffffff',
  bannerBody: '#d1d5db',

  chatWallpaper: '#efeae2',
  bubbleMine: '#d9fdd3',
  bubbleOther: '#ffffff',
  bubbleText: '#111827',
  bubbleTime: '#6b7280',
  chatInput: '#ffffff',
  attachmentCard: 'rgba(0,0,0,0.05)',

  rooms: {
    solid: '#2563eb',
    text: '#2563eb',
    soft: '#dbeafe',
    onSoft: '#1e40af',
    border: '#bfdbfe',
    faint: '#eff6ff',
  },
  chats: {
    solid: '#16a34a',
    text: '#16a34a',
    soft: '#dcfce7',
    onSoft: '#166534',
    border: '#bbf7d0',
    faint: '#f0fdf4',
  },
  meetings: {
    solid: '#ea580c',
    text: '#ea580c',
    soft: '#fff7ed',
    onSoft: '#9a3412',
    border: '#fed7aa',
    faint: '#fffbf7',
  },
};

export const darkColors: ThemeColors = {
  background: '#0f1115',
  surface: '#1a1d23',
  surfaceMuted: '#272b33',
  text: '#f1f3f5',
  textSecondary: '#c4c9d1',
  textTertiary: '#9aa1ad',
  textMuted: '#7d8491',
  border: '#2c3039',
  inputBorder: '#3b404a',
  placeholder: '#6f7682',
  onAccent: '#ffffff',
  disabled: '#3b404a',
  backdrop: 'rgba(0,0,0,0.6)',

  danger: '#f87171',
  dangerSolid: '#dc2626',
  dangerSoft: '#3b1618',
  onDangerSoft: '#fca5a5',
  warningSoft: '#3a2a0a',
  onWarningSoft: '#fcd34d',

  // Koyu zeminde kaybolmasın diye biraz daha açık + ince kenarlık
  banner: '#2a2f38',
  bannerBorder: '#3b404a',
  bannerTitle: '#ffffff',
  bannerBody: '#c4c9d1',

  chatWallpaper: '#0b141a',
  bubbleMine: '#144d37',
  bubbleOther: '#1f2c34',
  bubbleText: '#e9edef',
  bubbleTime: '#8696a0',
  chatInput: '#1f2c34',
  attachmentCard: 'rgba(255,255,255,0.06)',

  // Dolu butonlar açık temadakiyle aynı (beyaz yazı okunur); yazı/simge renkleri koyu zemine göre açıldı
  rooms: {
    solid: '#2563eb',
    text: '#60a5fa',
    soft: '#1e2a47',
    onSoft: '#bfdbfe',
    border: '#28407a',
    faint: '#151c2b',
  },
  chats: {
    solid: '#16a34a',
    text: '#4ade80',
    soft: '#15301f',
    onSoft: '#bbf7d0',
    border: '#1f5132',
    faint: '#13201a',
  },
  meetings: {
    solid: '#ea580c',
    text: '#fb923c',
    soft: '#33200f',
    onSoft: '#fdba74',
    border: '#4a2c14',
    faint: '#131110',
  },
};
