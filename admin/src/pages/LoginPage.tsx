import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError, authApi, session } from '../api';
import { Button } from '../components/ui';

/** Admin paneli girişi: e-posta/şifre ya da Google (sosyal hesaplarda şifre yoktur) */
export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const reason = params.get('reason');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const providers = useQuery({ queryKey: ['providers'], queryFn: authApi.providers });

  // Sosyal girişten dönüşte gidilecek sayfa
  useEffect(() => sessionStorage.setItem('localbite.admin.next', next), [next]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await authApi.login(email.trim(), password);
      if (res.user.role !== 'SUPER_ADMIN') {
        setError('Bu hesabın yönetici yetkisi yok.');
        return;
      }
      session.set(res.token);
      navigate(next, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'INVALID_CREDENTIALS'
          ? 'E-posta veya şifre hatalı.'
          : err instanceof ApiError
            ? err.message
            : 'Giriş yapılamadı.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand text-white">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="text-2xl font-bold">LocalBite Yönetici</h1>
          <p className="text-sm text-ink-muted">Şikayetleri ve hesap silme taleplerini yönet.</p>
        </div>

        {reason === 'forbidden' && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            Bu sayfalar yalnızca yönetici hesaplarına açık. Yönetici hesabınla giriş yap.
          </div>
        )}

        <div className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <div className="grid gap-2">
            {(['google'] as const).map((p) => (
              <a
                key={p}
                href={providers.data?.[p] ? authApi.oauthStartUrl(p) : undefined}
                aria-disabled={!providers.data?.[p]}
                className={`inline-flex h-10 items-center justify-center rounded-xl border border-line bg-surface text-sm font-semibold hover:bg-surface-muted ${
                  providers.data?.[p] ? '' : 'pointer-events-none opacity-50'
                }`}
              >
                Google ile giriş yap
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <span className="h-px flex-1 bg-line" /> veya <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            <label className="grid gap-1.5 text-sm font-semibold">
              E-posta
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 rounded-xl border border-line bg-bg px-3 font-normal outline-none focus:border-brand"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Şifre
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 rounded-xl border border-line bg-bg px-3 font-normal outline-none focus:border-brand"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <Button type="submit" loading={busy} className="w-full">
              Giriş yap
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

/** Açık yönlendirmeyi önle: yalnızca /admin altına dön */
export const safeNext = (next: string | null) => (next && next.startsWith('/admin') ? next : '/admin/reports');
