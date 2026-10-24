import { PermissionsAndroid, Platform } from 'react-native';

// granted: ikisi de verildi; denied: reddedildi (tekrar sorulabilir);
// blocked: "Bir daha sorma" seçildi, artık sadece Ayarlar'dan açılabilir
export type CallPermissionResult = 'granted' | 'denied' | 'blocked';

export async function requestCallPermissions(): Promise<CallPermissionResult> {
  // iOS'ta izin penceresini getUserMedia kendisi açar
  if (Platform.OS !== 'android') return 'granted';

  const { CAMERA, RECORD_AUDIO } = PermissionsAndroid.PERMISSIONS;
  const result = await PermissionsAndroid.requestMultiple([CAMERA, RECORD_AUDIO]);
  const values = [result[CAMERA], result[RECORD_AUDIO]];

  if (values.every((v) => v === PermissionsAndroid.RESULTS.GRANTED)) return 'granted';
  if (values.some((v) => v === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) return 'blocked';
  return 'denied';
}
