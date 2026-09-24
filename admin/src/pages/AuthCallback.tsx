import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { authApi, session } from '../api';
import { safeNext } from './LoginPage';

/** Google/GitHub dönüşü: tek kullanımlık kodu oturuma çevirir, rolü kontrol eder */
export function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = params.get('code');
    const next = safeNext(sessionStorage.getItem('localbite.admin.next'));
    if (!code) {
      navigate('/auth/login', { replace: true });
      return;
    }
    authApi
      .exchange(code)
      .then((res) => {
        if (res.user.role !== 'SUPER_ADMIN') {
          navigate(`/auth/login?reason=forbidden`, { replace: true });
          return;
        }
        session.set(res.token);
        navigate(next, { replace: true });
      })
      .catch(() => navigate('/auth/login', { replace: true }));
  }, [params, navigate]);

  return (
    <div className="grid min-h-dvh place-items-center text-ink-muted">
      <Loader2 className="size-6 animate-spin" aria-label="Giriş yapılıyor" />
    </div>
  );
}
