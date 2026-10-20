import { Room } from '../types/room';

// Sahte veri. Aşama 4'te API'den gelecek.
export const rooms: Room[] = [
  { id: '1', name: 'Genel', topic: 'Ekipçe günlük sohbet', memberCount: 4 },
  { id: '2', name: 'Tasarım', topic: 'Arayüz ve kullanıcı deneyimi', memberCount: 2 },
  { id: '3', name: 'Backend', topic: 'API ve veritabanı işleri', memberCount: 0 },
  { id: '4', name: 'Mobil', topic: 'Expo ve React Native', memberCount: 3 },
  { id: '5', name: 'Test', topic: 'Hata avı ve kalite', memberCount: 0 },
];