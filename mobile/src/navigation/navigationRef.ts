import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './types';

// Ekran dışından (bildirime dokununca) gezinmek için. NavigationContainer'a ref olarak verilir.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Uygulama bildirime dokunularak açıldıysa navigasyon henüz hazır olmayabilir; hazır olunca çalıştır
export function whenNavigationReady(action: () => void, attempts = 50) {
  if (navigationRef.isReady()) {
    action();
  } else if (attempts > 0) {
    setTimeout(() => whenNavigationReady(action, attempts - 1), 100);
  }
}
