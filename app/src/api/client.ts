import { getLocale } from '../i18n';
import { getDeviceId } from '../lib/deviceId';
import { API_BASE } from './config';

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
  method?: 'GET' | 'POST';
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

/** Her isteğe x-device-id ve Accept-Language ekler; hata gövdesini ApiError'a çevirir. */
export async function api<T>(path: string, { method = 'GET', query, body, signal }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': getLocale(),
    'x-device-id': await getDeviceId(),
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}${toSearch(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', `Cannot reach ${API_BASE}`);
  }

  const data = (await res.json().catch(() => null)) as
    | (T & { error?: string; message?: string; details?: unknown })
    | null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? 'HTTP_ERROR', data?.message ?? res.statusText, data?.details);
  }
  return data as T;
}
