import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, LogOut, ShieldCheck, UserX } from 'lucide-react';
import { useEffect } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { adminApi, ApiError, authApi, session, useToken } from '../api';
import { SkeletonList } from './ui';

/**
 * /admin altındaki her şeyi korur: oturum yoksa ya da rol SUPER_ADMIN değilse /auth/login'e yönlendirir.
 * Sunucu da her admin uç noktasında rolü ayrıca doğrular; bu yalnızca arayüz kapısıdır.
 */
export function RequireAdmin() {
  const token = useToken();
  const location = useLocation();
  const me = useQuery({ queryKey: ['me', token], queryFn: authApi.me, enabled: !!token, retry: false });

  // Yalnızca sunucu reddederse (401/403) ya da rol yetmezse çıkış; API geçici olarak kapalıysa oturum korunur
  const rejected = me.error instanceof ApiError && (me.error.status === 401 || me.error.status === 403);
  const forbidden = !!token && (rejected || (me.isSuccess && me.data.user.role !== 'SUPER_ADMIN'));

  // Yetkisiz oturumu kapat (render dışında)
  useEffect(() => {
    if (forbidden) session.set(null);
  }, [forbidden]);

  const next = encodeURIComponent(location.pathname + location.search);
  if (forbidden) return <Navigate to={`/auth/login?next=${next}&reason=forbidden`} replace />;
  if (!token) return <Navigate to={`/auth/login?next=${next}`} replace />;
  if (me.isPending) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <SkeletonList rows={2} />
      </div>
    );
  }
  if (me.isError) {
    return (
      <div className="mx-auto max-w-5xl space-y-3 p-6 text-sm">
        <p>{me.error.message}</p>
        <button type="button" onClick={() => me.refetch()} className="font-semibold text-brand underline">
          Tekrar dene
        </button>
      </div>
    );
  }
  const user = me.data!.user;
  return <AdminShell name={user.fullName ?? user.email ?? ''} />;
}

function AdminShell({ name }: { name: string }) {
  const queryClient = useQueryClient();
  // Sekme rozetleri için bekleyen sayıları (sayfalar da aynı sorguyu kullanır)
  const reports = useQuery({ queryKey: ['reports', 'PENDING'], queryFn: () => adminApi.reports('PENDING') });
  const deletions = useQuery({ queryKey: ['deletions'], queryFn: adminApi.deletionRequests });
  const pendingReports = reports.data?.items.length ?? 0;
  const pendingDeletions = deletions.data?.items.filter((d) => d.status === 'PENDING').length ?? 0;

  const signOut = () => {
    session.set(null);
    queryClient.clear();
  };

  const tab = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
      isActive ? 'bg-brand-soft text-brand' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
    }`;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 font-bold">
            <span className="grid size-8 place-items-center rounded-lg bg-brand text-white">
              <ShieldCheck className="size-4" />
            </span>
            LocalBite <span className="font-medium text-ink-muted">Yönetici</span>
          </div>
          <nav className="order-3 flex w-full gap-1 sm:order-none sm:ml-6 sm:w-auto" aria-label="Bölümler">
            <NavLink to="/admin/reports" className={tab}>
              <Flag className="size-4" /> Şikayetler
              <Count n={pendingReports} />
            </NavLink>
            <NavLink to="/admin/deletions" className={tab}>
              <UserX className="size-4" /> Silme talepleri
              <Count n={pendingDeletions} />
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-ink-muted sm:inline">{name}</span>
            <button onClick={signOut} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-ink-muted hover:bg-surface-muted hover:text-ink">
              <LogOut className="size-4" /> Çıkış
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}

function Count({ n }: { n: number }) {
  if (!n) return null;
  return <span className="min-w-5 rounded-full bg-danger px-1.5 text-center text-xs font-bold text-white">{n}</span>;
}
