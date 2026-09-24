import { deletionRequestSchema, legalDocument, type LegalDocId, type LegalLocale } from '@localbite/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { env } from '../env';
import { createDeletionRequest } from '../services/privacy.service';

/**
 * Mağaza başvurusunda istenen herkese açık sayfalar:
 *  - GET  /legal/terms, /legal/privacy          → Kullanım Şartları / Gizlilik Politikası (?lang=en)
 *  - GET  /privacy/delete-account-request       → web tabanlı hesap silme talebi formu (Google Play zorunluluğu)
 *  - POST /privacy/delete-account-request       → talebi kaydeder
 */

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function page(title: string, lang: LegalLocale, body: string) {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} · LocalBite</title>
<style>
  :root { color-scheme: light dark; --bg:#FFFBF5; --fg:#1F1A14; --muted:#6F6557; --accent:#C2410C; --card:#fff; --border:#EAE2D6; }
  @media (prefers-color-scheme: dark) { :root { --bg:#121212; --fg:#F4F1EA; --muted:#A8A29A; --accent:#FF7A1A; --card:#1C1C1E; --border:#303034; } }
  body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  main { max-width:720px; margin:0 auto; padding:32px 16px 64px; }
  h1 { font-size:26px; margin:0 0 4px; } h2 { font-size:18px; margin:28px 0 8px; }
  .muted { color:var(--muted); font-size:14px; } a { color:var(--accent); }
  nav { display:flex; gap:12px; margin-bottom:24px; font-size:14px; flex-wrap:wrap; }
  form { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:20px; display:grid; gap:12px; margin-top:20px; }
  label { font-weight:600; font-size:14px; display:grid; gap:6px; }
  input, textarea { font:inherit; padding:10px 12px; border-radius:10px; border:1px solid var(--border); background:var(--bg); color:var(--fg); }
  button { font:inherit; font-weight:700; padding:12px; border:0; border-radius:10px; background:#B91C1C; color:#fff; cursor:pointer; }
  .ok { background:var(--card); border:1px solid var(--border); border-left:4px solid #16A34A; border-radius:10px; padding:16px; }
  .err { color:#B91C1C; font-weight:600; }
</style>
</head>
<body><main>
<nav><a href="/legal/terms?lang=${lang}">${lang === 'tr' ? 'Kullanım Şartları' : 'Terms'}</a>
<a href="/legal/privacy?lang=${lang}">${lang === 'tr' ? 'Gizlilik' : 'Privacy'}</a>
<a href="/privacy/delete-account-request?lang=${lang}">${lang === 'tr' ? 'Hesap silme' : 'Delete account'}</a>
<a href="?lang=${lang === 'tr' ? 'en' : 'tr'}">${lang === 'tr' ? 'English' : 'Türkçe'}</a></nav>
${body}
</main></body></html>`;
}

const langQuery = z.object({ lang: z.enum(['tr', 'en']).optional() });
const pickLang = (lang: LegalLocale | undefined, acceptLanguage: string | undefined): LegalLocale =>
  lang ?? (acceptLanguage?.toLowerCase().startsWith('tr') ? 'tr' : 'en');

function renderLegal(id: LegalDocId, lang: LegalLocale) {
  const doc = legalDocument(id, lang, env.LEGAL_CONTACT_EMAIL);
  const sections = doc.sections
    .map((s) => `<h2>${esc(s.heading)}</h2>${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}`)
    .join('');
  return page(doc.title, lang, `<h1>${esc(doc.title)}</h1><p class="muted">${lang === 'tr' ? 'Güncelleme' : 'Updated'}: ${doc.updated}</p>${sections}`);
}

function deletionForm(lang: LegalLocale, error?: string, email = '') {
  const tr = lang === 'tr';
  return page(
    tr ? 'Hesap silme talebi' : 'Account deletion request',
    lang,
    `<h1>${tr ? 'Hesabınızı ve verilerinizi silin' : 'Delete your account and data'}</h1>
<p>${
      tr
        ? 'En hızlı yol: uygulamada <b>Profil › Güvenlik ve Gizlilik › Hesabımı ve Tüm Verilerimi Sil</b>. Uygulamaya erişemiyorsanız aşağıdaki formu doldurun.'
        : 'Fastest way: in the app, go to <b>Profile › Security &amp; Privacy › Delete my account and all data</b>. If you cannot access the app, fill in the form below.'
    }</p>
<p class="muted">${
      tr
        ? 'Silinecekler: profiliniz, e-postanız, yorumlarınız, gönderi ve yanıtlarınız, beğenileriniz, teyitleriniz, şikayet ve engelleme kayıtlarınız. Güvenliğiniz için hesabın size ait olduğunu e-postayla doğruluyoruz; talep en geç 30 gün içinde tamamlanır.'
        : 'We delete: your profile, email, reviews, posts and replies, likes, confirmations, reports and blocks. To protect you, we verify by email that the account is yours; requests are completed within 30 days.'
    }</p>
<form method="post" action="/privacy/delete-account-request?lang=${lang}">
  ${error ? `<p class="err">${esc(error)}</p>` : ''}
  <label>${tr ? 'Hesabınızın e-posta adresi' : 'Your account email'}
    <input type="email" name="email" required maxlength="254" autocomplete="email" value="${esc(email)}"></label>
  <label>${tr ? 'Not (isteğe bağlı)' : 'Note (optional)'}
    <textarea name="note" rows="3" maxlength="1000"></textarea></label>
  <button type="submit">${tr ? 'Silme talebi gönder' : 'Request deletion'}</button>
</form>`,
  );
}

export const privacyRoutes: FastifyPluginAsyncZod = async (app) => {
  // HTML formları application/x-www-form-urlencoded gönderir; yalnızca bu eklenti kapsamında ayrıştırılır
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string', bodyLimit: 8_192 }, (_req, body, done) =>
    done(null, Object.fromEntries(new URLSearchParams(body as string))),
  );

  for (const id of ['terms', 'privacy'] as const) {
    app.get(`/legal/${id}`, { schema: { querystring: langQuery } }, async (req, reply) =>
      reply.type('text/html; charset=utf-8').send(renderLegal(id, pickLang(req.query.lang, req.headers['accept-language']))),
    );
  }

  app.get('/privacy/delete-account-request', { schema: { querystring: langQuery } }, async (req, reply) =>
    reply.type('text/html; charset=utf-8').send(deletionForm(pickLang(req.query.lang, req.headers['accept-language']))),
  );

  app.post(
    '/privacy/delete-account-request',
    {
      schema: { querystring: langQuery },
      config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    },
    async (req, reply) => {
      const lang = pickLang(req.query.lang, req.headers['accept-language']);
      const raw = (req.body ?? {}) as Record<string, string>;
      const parsed = deletionRequestSchema.safeParse({ email: raw.email, note: raw.note || undefined });
      if (!parsed.success) {
        return reply
          .code(400)
          .type('text/html; charset=utf-8')
          .send(deletionForm(lang, lang === 'tr' ? 'Geçerli bir e-posta adresi girin.' : 'Enter a valid email address.', raw.email ?? ''));
      }
      await createDeletionRequest(parsed.data.email, parsed.data.note);
      // Hesap var/yok ayrımı yapılmaz: e-posta adreslerinin kayıtlı olup olmadığı sızmasın
      const tr = lang === 'tr';
      return reply.type('text/html; charset=utf-8').send(
        page(
          tr ? 'Talep alındı' : 'Request received',
          lang,
          `<div class="ok"><h1>${tr ? 'Talebiniz alındı' : 'Request received'}</h1><p>${
            tr
              ? `Bu adrese kayıtlı bir hesap varsa, sahipliğini doğrulamak için size e-posta ile ulaşacağız ve silme işlemini en geç 30 gün içinde tamamlayacağız. Sorularınız için: ${esc(env.LEGAL_CONTACT_EMAIL)}`
              : `If an account exists for this address, we will contact you by email to verify ownership and complete the deletion within 30 days. Questions: ${esc(env.LEGAL_CONTACT_EMAIL)}`
          }</p></div>`,
        ),
      );
    },
  );
};
