import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { parseOpeningHours } from './openingHours';

/**
 * Dükkanın kendi web sitesindeki yapılandırılmış veri (schema.org JSON-LD): saatler, telefon, adres.
 * Yalnızca sitenin kendisinin yayımladığı bilgi alınır; bulunamazsa hiçbir şey uydurulmaz.
 *
 * Güvenlik (SSRF): adres OSM'den (herkes düzenleyebilir) geldiği için yalnızca http(s), yalnızca
 * herkese açık IP'lere çözülen alan adları; yönlendirmeler tek tek aynı denetimden geçer.
 */

const USER_AGENT = 'LocalBite/0.1 (street-food discovery app)';
const TIMEOUT_MS = 6_000;
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;

export interface WebsiteInfo {
  /** OSM sözdizimi ("Mo-Fr 09:00-18:00"); doğrulanmış */
  openingHours: string | null;
  phone: string | null;
  address: string | null;
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a = 0, b = 0] = ip.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80') || v6.startsWith('::ffff:');
}

async function isPublicUrl(raw: string): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  const host = url.hostname;
  if (isIP(host)) return isPrivateIp(host) ? null : url;
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.')) return null;
  const addresses = await lookup(host, { all: true }).catch(() => []);
  if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) return null;
  return url;
}

async function fetchHtml(raw: string): Promise<string | null> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = await isPublicUrl(current);
    if (!url) return null;
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location');
      if (!next) return null;
      current = new URL(next, url).toString();
      continue;
    }
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return null;
    const length = Number(res.headers.get('content-length') ?? 0);
    if (length > MAX_BYTES) return null;
    const text = await res.text();
    return text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text;
  }
  return null;
}

const DAY_CODES: Record<string, string> = {
  monday: 'Mo',
  tuesday: 'Tu',
  wednesday: 'We',
  thursday: 'Th',
  friday: 'Fr',
  saturday: 'Sa',
  sunday: 'Su',
};

type Json = Record<string, unknown>;

/** JSON-LD içindeki tüm nesneler (@graph ve iç içe diziler dahil) */
function* walk(node: unknown): Generator<Json> {
  if (Array.isArray(node)) for (const n of node) yield* walk(n);
  else if (node && typeof node === 'object') {
    yield node as Json;
    for (const value of Object.values(node)) if (value && typeof value === 'object') yield* walk(value);
  }
}

const hhmm = (v: unknown) => (typeof v === 'string' ? /^(\d{1,2}):(\d{2})/.exec(v) : null);

function specToOsm(specs: unknown): string | null {
  const rules: string[] = [];
  for (const spec of walk(specs)) {
    const opens = hhmm(spec.opens);
    const closes = hhmm(spec.closes);
    if (!opens || !closes) continue;
    const days = (Array.isArray(spec.dayOfWeek) ? spec.dayOfWeek : [spec.dayOfWeek])
      .map((d) => (typeof d === 'string' ? DAY_CODES[d.split('/').pop()!.toLowerCase()] : undefined))
      .filter(Boolean);
    const time = `${opens[1]!.padStart(2, '0')}:${opens[2]}-${closes[1]!.padStart(2, '0')}:${closes[2]}`;
    for (const day of days) rules.push(`${day} ${time}`);
  }
  return rules.length ? rules.join(', ') : null;
}

function addressText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (!value || typeof value !== 'object') return null;
  const a = value as Json;
  const parts = [a.streetAddress, a.addressLocality, a.addressRegion].filter((p): p is string => typeof p === 'string' && !!p.trim());
  return parts.length ? parts.join(', ') : null;
}

export function extractWebsiteInfo(html: string): WebsiteInfo {
  const info: WebsiteInfo = { openingHours: null, phone: null, address: null };
  const scripts = html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(body!.trim());
    } catch {
      continue;
    }
    for (const node of walk(data)) {
      if (!info.openingHours) {
        const hours = Array.isArray(node.openingHours)
          ? node.openingHours.filter((h): h is string => typeof h === 'string').join('; ')
          : typeof node.openingHours === 'string'
            ? node.openingHours
            : specToOsm(node.openingHoursSpecification);
        // Yalnızca ayrıştırılabilen (anlamlı) saat kabul edilir
        if (hours && parseOpeningHours(hours, 'tr')) info.openingHours = hours;
      }
      if (!info.phone && typeof node.telephone === 'string' && /\d{7,}/.test(node.telephone.replace(/\D/g, ''))) {
        info.phone = node.telephone.trim();
      }
      if (!info.address) info.address = addressText(node.address);
    }
  }
  return info;
}

/** Web sitesinden bilgi; ulaşılamaz/yapılandırılmış veri yoksa boş alanlar */
export async function fetchWebsiteInfo(website: string): Promise<WebsiteInfo> {
  const html = await fetchHtml(website).catch(() => null);
  return html ? extractWebsiteInfo(html) : { openingHours: null, phone: null, address: null };
}
