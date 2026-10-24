// Takvim günleri "2026-10-24" biçiminde anahtarlarla eşleşir. Cihazın YEREL gününe göre hesaplanır
// (toISOString UTC verdiği için gece yarısına yakın toplantıları yanlış güne koyardı).
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

// "10:00 – 11:30"
export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatClock(new Date(startIso))} – ${formatClock(new Date(endIso))}`;
}

// "24 Ekim 2026 Cumartesi"
export function formatLongDate(date: Date): string {
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
}

// Yaklaşan listesindeki gün başlığı: "Bugün", "Yarın" ya da uzun tarih
export function formatDayHeading(date: Date): string {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (toDateKey(date) === toDateKey(today)) return 'Bugün';
  if (toDateKey(date) === toDateKey(tomorrow)) return 'Yarın';
  return formatLongDate(date);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} dk`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} sa` : `${h} sa ${m} dk`;
}
