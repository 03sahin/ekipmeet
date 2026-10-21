// EXPO_PUBLIC_ ile başlayan değişkenler .env.local'dan okunur
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:5047';