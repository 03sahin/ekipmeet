import * as SecureStore from 'expo-secure-store';

// SecureStore: Android Keystore ile şifreli depolama. Refresh token uzun ömürlü olduğu için burada.
const KEY = 'ekipmeet.refreshToken';

export const getRefreshToken = () => SecureStore.getItemAsync(KEY);
export const saveRefreshToken = (token: string) => SecureStore.setItemAsync(KEY, token);
export const clearRefreshToken = () => SecureStore.deleteItemAsync(KEY);