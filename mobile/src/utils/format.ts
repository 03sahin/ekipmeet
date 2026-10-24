// Sohbet listesindeki saat: bugünse "14:05", dünse "Dün", daha eskiyse "21.10.2026"
export function formatListTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return formatTime(iso);
  if (date.toDateString() === yesterday.toDateString()) return 'Dün';
  return date.toLocaleDateString('tr-TR');
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

// Aynı id'li mesaj hem HTTP cevabıyla hem canlı olayla gelebilir; bir kez tut, id'ye göre sırala
export function mergeById<T extends { id: number }>(a: T[], b: T[]): T[] {
  const byId = new Map<number, T>();
  [...a, ...b].forEach((m) => byId.set(m.id, m));
  return [...byId.values()].sort((x, y) => x.id - y.id);
}
