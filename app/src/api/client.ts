import { getLocale } from '../i18n';
import { getDeviceId } from '../lib/deviceId';
import { getAuthToken, useAuthStore } from '../store/auth';
import { API_BASE } from './config';

/** Yanıt gelmezse istek bu süre sonunda TIMEOUT hatasıyla kesilir */
export const REQUEST_TIMEOUT_MS = 10_000;

/** Sunucuya hiç ulaşılamadı (ağ yok, adres yanlış ya da zaman aşımı) */
export const isConnectionError = (err: unknown) =>
  err instanceof ApiError && (err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Query = Record<string, string | number | boolean | string[] | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

function toSearch(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || (Array.isArray(value) && value.length === 0)) continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

/**
 * Her isteğe x-device-id, Accept-Language ve (üyeyse) Authorization ekler; hata gövdesini ApiError'a çevirir.
 * Sunucu oturumu reddederse (süresi dolmuş/silinmiş hesap) yerel oturum kapatılır, kullanıcı misafire düşer.
 */
export async function api<T>(path: string, { method = 'GET', query, body, signal }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': getLocale(),
    'x-device-id': await getDeviceId(),
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  // Test tüneli (localtunnel) uyarı sayfasını atlar; normal sunucular bu başlığı yok sayar
  headers['bypass-tunnel-reminder'] = '1';
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  // Ulaşılamayan sunucuda fetch dakikalarca asılı kalabilir: 10 sn sonra kes.
  // Çağıranın sinyali (sorgu iptali) de aynı denetleyiciye bağlanır.
  const url = `${API_BASE}${path}${toSearch(query)}`;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', onCallerAbort);
  const startedAt = Date.now();

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    // Sorgu iptali (ekrandan çıkıldı) hata değildir
    if (!timedOut && signal?.aborted) throw err;
    const code = timedOut ? 'TIMEOUT' : 'NETWORK_ERROR';
    console.warn(`[api] ${method} ${url} → ${code} (${Date.now() - startedAt} ms): ${(err as Error).message}`);
    throw new ApiError(0, code, timedOut ? `No response from ${API_BASE} in ${REQUEST_TIMEOUT_MS / 1000}s` : `Cannot reach ${API_BASE}`);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }
  if (res.status >= 500) console.warn(`[api] ${method} ${url} → HTTP ${res.status}`);

  const data = (await res.json().catch(() => null)) as
    | (T & { error?: string; message?: string; details?: unknown })
    | null;
  if (!res.ok) {
    // Yalnızca bu istekte gönderilen oturum reddedildiyse (arada yeniden giriş yapılmış olabilir)
    if (res.status === 401 && token && data?.error === 'UNAUTHORIZED' && getAuthToken() === token) {
      useAuthStore.getState().signOut();
    }
    throw new ApiError(res.status, data?.error ?? 'HTTP_ERROR', data?.message ?? res.statusText, data?.details);
  }
  return data as T;
}
