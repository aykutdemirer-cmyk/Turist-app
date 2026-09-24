import { CircleAlert, CircleCheck, Loader2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

// ─────────────────────────────────────────────
// Buton
// ─────────────────────────────────────────────

type Variant = 'primary' | 'danger' | 'ghost' | 'outline';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:opacity-90',
  danger: 'bg-danger text-white hover:opacity-90',
  outline: 'border border-line bg-surface text-ink hover:bg-surface-muted',
  ghost: 'text-ink-muted hover:bg-surface-muted',
};

export function Button({
  variant = 'primary',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────

interface Toast {
  id: number;
  kind: 'success' | 'error';
  message: string;
}

const ToastContext = createContext<(kind: Toast['kind'], message: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind: Toast['kind'], message: string) => {
      const id = nextId.current++;
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      {/* Ekran okuyucular bildirimleri duyar */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
              t.kind === 'success' ? 'border-ok/30 bg-ok-soft text-ok' : 'border-danger/30 bg-danger-soft text-danger'
            }`}
          >
            {t.kind === 'success' ? <CircleCheck className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}
            <span className="flex-1 font-medium">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Kapat" className="opacity-70 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Onay penceresi (yerel <dialog>: odak tuzağı ve Esc ile kapanma tarayıcıdan gelir)
// ─────────────────────────────────────────────

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!loading) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <div className="space-y-3 p-6">
        <h2 className="text-lg font-bold">{title}</h2>
        <div className="text-sm leading-relaxed text-ink-muted">{body}</div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-surface-muted px-6 py-4">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          Vazgeç
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading} autoFocus>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}

// ─────────────────────────────────────────────
// Boş / hata / yükleniyor durumları
// ─────────────────────────────────────────────

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
      <div className="mb-1 text-ink-muted">{icon}</div>
      <p className="font-semibold">{title}</p>
      {body && <p className="max-w-sm text-sm text-ink-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Yükleniyor">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-36 animate-pulse rounded-2xl bg-surface-muted" />
      ))}
    </div>
  );
}

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
