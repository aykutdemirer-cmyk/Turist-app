import type {
  AdminReportDTO,
  AuthResponseDTO,
  AuthUserDTO,
  DeletionRequestDTO,
  ModerationStatus,
  OAuthProvidersDTO,
} from '@localbite/shared';
import { useSyncExternalStore } from 'react';

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
const API_BASE = `${API_URL}/api/v1`;

// ─────────────────────────────────────────────
// Oturum (sekme kapanınca biten sessionStorage: paylaşılan bilgisayarda kalıcı admin oturumu bırakmaz)
// ─────────────────────────────────────────────

const TOKEN_KEY = 'localbite.admin.token';
type Listener = () => void;
const listeners = new Set<Listener>();
let token: string | null = sessionStorage.getItem(TOKEN_KEY);

export const session = {
  get: () => token,
  set(next: string | null) {
    token = next;
    if (next) sessionStorage.setItem(TOKEN_KEY, next);
    else sessionStorage.removeItem(TOKEN_KEY);
    listeners.forEach((l) => l());
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export const useToken = () => useSyncExternalStore(session.subscribe, session.get);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': 'tr' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', `API'ye ulaşılamıyor (${API_URL})`);
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T & { error?: string; message?: string }) : null;
  if (!res.ok) {
    // Oturum geçersiz/silinmiş: çıkış yap, koruma girişe yönlendirir
    if (res.status === 401 && token) session.set(null);
    throw new ApiError(res.status, data?.error ?? 'HTTP_ERROR', data?.message ?? res.statusText);
  }
  return data as T;
}

// ─────────────────────────────────────────────
// Uç noktalar
// ─────────────────────────────────────────────

export const authApi = {
  me: () => api<{ user: AuthUserDTO }>('/auth/me'),
  login: (email: string, password: string) =>
    api<AuthResponseDTO>('/auth/login', { method: 'POST', body: { email, password } }),
  providers: () => api<OAuthProvidersDTO>('/auth/oauth/providers'),
  exchange: (code: string) => api<AuthResponseDTO>('/auth/oauth/exchange', { method: 'POST', body: { code } }),
  /** Tarayıcıda sağlayıcıya gider; dönüş /auth/callback */
  oauthStartUrl: (provider: keyof OAuthProvidersDTO) =>
    `${API_BASE}/auth/oauth/${provider}/start?${new URLSearchParams({ redirect: `${window.location.origin}/auth/callback` })}`,
};

export type { DeletionRequestDTO };

export const adminApi = {
  reports: (status: ModerationStatus) => api<{ items: AdminReportDTO[] }>(`/admin/reports?status=${status}&limit=100`),
  removeContent: (id: string) => api<void>(`/admin/reports/${encodeURIComponent(id)}/remove`, { method: 'POST' }),
  dismiss: (id: string) => api<void>(`/admin/reports/${encodeURIComponent(id)}/dismiss`, { method: 'POST' }),
  deletionRequests: () => api<{ items: DeletionRequestDTO[] }>('/admin/deletion-requests'),
  processDeletion: (id: string, action: 'complete' | 'reject') =>
    api<{ status: string; accountDeleted: boolean }>(`/admin/deletion-requests/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
    }),
};
