import { randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEY = 'localbite.deviceId';

let cached: Promise<string> | undefined;

/**
 * İlk açılışta UUIDv4 üretip SecureStore'a yazar, sonra hep aynısını döner.
 * SecureStore erişilemezse (ör. web) oturum boyunca geçerli bir kimlik kullanılır.
 */
export function getDeviceId(): Promise<string> {
  cached ??= (async () => {
    try {
      const existing = await SecureStore.getItemAsync(KEY);
      if (existing) return existing;
      const id = randomUUID();
      await SecureStore.setItemAsync(KEY, id);
      return id;
    } catch {
      return randomUUID();
    }
  })();
  return cached;
}
