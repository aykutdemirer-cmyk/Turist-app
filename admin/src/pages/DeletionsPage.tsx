import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Mail, RefreshCw, UserX, X } from 'lucide-react';
import { useState } from 'react';
import { adminApi, ApiError, type DeletionRequestDTO } from '../api';
import { Button, ConfirmDialog, EmptyState, formatDate, SkeletonList, useToast } from '../components/ui';

const STATUS_STYLE: Record<DeletionRequestDTO['status'], { label: string; className: string }> = {
  PENDING: { label: 'Bekliyor', className: 'bg-warn-soft text-warn' },
  COMPLETED: { label: 'Tamamlandı', className: 'bg-ok-soft text-ok' },
  REJECTED: { label: 'Reddedildi', className: 'bg-surface-muted text-ink-muted' },
};

/**
 * Web formundan gelen silme talepleri. Talep, e-posta sahipliği doğrulanmadan tamamlanmamalı
 * (formu herkes doldurabilir); bu yüzden onay penceresi bunu hatırlatır.
 */
export function DeletionsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showDone, setShowDone] = useState(false);
  const [confirming, setConfirming] = useState<DeletionRequestDTO | null>(null);
  const requests = useQuery({ queryKey: ['deletions'], queryFn: adminApi.deletionRequests });

  const process = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'complete' | 'reject' }) => adminApi.processDeletion(id, action),
    onSuccess: (res, { action }) => {
      toast(
        'success',
        action === 'reject'
          ? 'Talep reddedildi.'
          : res.accountDeleted
            ? 'Hesap ve tüm verileri silindi.'
            : 'Talep kapatıldı (bu e-postaya kayıtlı hesap yoktu).',
      );
      setConfirming(null);
    },
    onError: (err) => toast('error', err instanceof ApiError ? err.message : 'İşlem başarısız oldu.'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['deletions'] }),
  });

  const all = requests.data?.items ?? [];
  const items = showDone ? all : all.filter((r) => r.status === 'PENDING');

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hesap silme talepleri</h1>
          <p className="text-sm text-ink-muted">
            Web formundan gelen talepler (Google Play zorunluluğu). Uygulama içi silmeler anında yapılır ve burada görünmez.
          </p>
        </div>
        <Button variant="outline" onClick={() => requests.refetch()} loading={requests.isRefetching} icon={<RefreshCw className="size-4" />}>
          Yenile
        </Button>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-ink-muted">
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="size-4 accent-[var(--primary)]" />
        İşlenmiş talepleri de göster
      </label>

      {requests.isPending ? (
        <SkeletonList rows={2} />
      ) : requests.isError ? (
        <EmptyState
          icon={<UserX className="size-8" />}
          title="Talepler yüklenemedi"
          action={<Button onClick={() => requests.refetch()}>Tekrar dene</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState icon={<Check className="size-8" />} title="Bekleyen talep yok" />
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex items-center gap-2 font-semibold break-all">
                    <Mail className="size-4 shrink-0 text-brand" /> {r.email}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {formatDate(r.createdAt)}
                    {r.processedAt && ` · işlendi ${formatDate(r.processedAt)}`}
                  </p>
                  <p className="text-sm">
                    {r.accountExists ? (
                      <span className="font-medium text-ok">Bu e-postaya kayıtlı hesap var</span>
                    ) : (
                      <span className="text-ink-muted">Kayıtlı hesap bulunamadı</span>
                    )}
                  </p>
                  {r.note && <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm break-words whitespace-pre-wrap">{r.note}</p>}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[r.status].className}`}>
                  {STATUS_STYLE[r.status].label}
                </span>
              </div>

              {r.status === 'PENDING' && (
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    icon={<X className="size-4" />}
                    loading={process.isPending && process.variables?.id === r.id && process.variables.action === 'reject'}
                    disabled={process.isPending}
                    onClick={() => process.mutate({ id: r.id, action: 'reject' })}
                  >
                    Reddet
                  </Button>
                  <Button variant="danger" icon={<UserX className="size-4" />} disabled={process.isPending} onClick={() => setConfirming(r)}>
                    Talebi Tamamla ve Hesabı Sil
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title="Hesap kalıcı olarak silinsin mi?"
        confirmLabel="Hesabı Sil"
        loading={process.isPending}
        onCancel={() => setConfirming(null)}
        onConfirm={() => confirming && process.mutate({ id: confirming.id, action: 'complete' })}
        body={
          <>
            <p>
              <strong className="text-ink">{confirming?.email}</strong> hesabı ve tüm verileri (yorumlar, gönderiler, yanıtlar, beğeniler,
              teyitler) kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </p>
            <p className="mt-2 font-medium text-warn">Devam etmeden önce talebin bu e-postanın sahibinden geldiğini doğruladığından emin ol.</p>
          </>
        }
      />
    </section>
  );
}
