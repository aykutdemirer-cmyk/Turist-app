import type { AdminReportDTO, ContentReportReason, ModerationStatus, ReportableContent } from '@localbite/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, FileText, Flag, MessageSquare, RefreshCw, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { adminApi, ApiError } from '../api';
import { Button, EmptyState, formatDate, SkeletonList, useToast } from '../components/ui';

type Filter = 'ALL' | 'COMMENTS' | 'POSTS';

const FILTERS: { id: Filter; label: string; types: ReportableContent[] }[] = [
  { id: 'ALL', label: 'Tümü', types: ['POST', 'COMMENT', 'REVIEW'] },
  { id: 'COMMENTS', label: 'Yorumlar', types: ['COMMENT', 'REVIEW'] },
  { id: 'POSTS', label: 'Gönderiler', types: ['POST'] },
];

const STATUSES: { id: ModerationStatus; label: string }[] = [
  { id: 'PENDING', label: 'Bekleyen' },
  { id: 'REMOVED', label: 'Kaldırılan' },
  { id: 'DISMISSED', label: 'Yoksayılan' },
];

const REASON_LABEL: Record<ContentReportReason, string> = {
  SPAM: 'Spam / reklam',
  ABUSE: 'Hakaret / nefret / taciz',
  MISLEADING: 'Yanıltıcı',
  OTHER: 'Diğer',
};

const TYPE_META: Record<ReportableContent, { label: string; Icon: typeof FileText }> = {
  POST: { label: 'Topluluk gönderisi', Icon: FileText },
  COMMENT: { label: 'Gönderi yanıtı', Icon: MessageSquare },
  REVIEW: { label: 'Mekan yorumu', Icon: Star },
};

export function ReportsPage() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [status, setStatus] = useState<ModerationStatus>('PENDING');
  const reports = useQuery({ queryKey: ['reports', status], queryFn: () => adminApi.reports(status) });

  const types = FILTERS.find((f) => f.id === filter)!.types;
  const all = reports.data?.items ?? [];
  const items = all.filter((r) => types.includes(r.contentType));
  const countFor = (f: (typeof FILTERS)[number]) => all.filter((r) => f.types.includes(r.contentType)).length;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Şikayetler</h1>
          <p className="text-sm text-ink-muted">Kullanıcıların bildirdiği içerikler; aynı içeriğe gelen şikayetler tek kayıtta toplanır.</p>
        </div>
        <Button variant="outline" onClick={() => reports.refetch()} loading={reports.isRefetching} icon={<RefreshCw className="size-4" />}>
          Yenile
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="İçerik türü" className="inline-flex rounded-xl border border-line bg-surface p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                filter === f.id ? 'bg-brand text-white' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-70">{countFor(f)}</span>
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-muted">
          Durum
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ModerationStatus)}
            className="h-9 rounded-lg border border-line bg-surface px-2 font-semibold text-ink"
          >
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {reports.isPending ? (
        <SkeletonList />
      ) : reports.isError ? (
        <EmptyState
          icon={<Flag className="size-8" />}
          title="Şikayetler yüklenemedi"
          body={reports.error instanceof ApiError ? reports.error.message : undefined}
          action={<Button onClick={() => reports.refetch()}>Tekrar dene</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Check className="size-8" />}
          title={status === 'PENDING' ? 'Bekleyen şikayet yok' : 'Kayıt yok'}
          body={status === 'PENDING' ? 'Her şey temiz görünüyor.' : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <ReportCard key={r.id} report={r} status={status} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReportCard({ report, status }: { report: AdminReportDTO; status: ModerationStatus }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const { label, Icon } = TYPE_META[report.contentType];

  const action = useMutation({
    mutationFn: (kind: 'remove' | 'dismiss') => (kind === 'remove' ? adminApi.removeContent(report.id) : adminApi.dismiss(report.id)),
    // Anında listeden çıkar; hata olursa geri getir
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['reports', status] });
      const prev = queryClient.getQueryData<{ items: AdminReportDTO[] }>(['reports', status]);
      queryClient.setQueryData<{ items: AdminReportDTO[] }>(['reports', status], (old) =>
        old ? { items: old.items.filter((i) => i.id !== report.id) } : old,
      );
      return { prev };
    },
    onError: (err, _kind, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['reports', status], ctx.prev);
      toast('error', err instanceof ApiError ? err.message : 'İşlem başarısız oldu.');
    },
    onSuccess: (_res, kind) => toast('success', kind === 'remove' ? 'İçerik kaldırıldı.' : 'Şikayet yoksayıldı.'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['reports'] }),
  });

  const text = report.content?.text ?? '';
  const long = text.length > 280;

  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 text-sm sm:px-5">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Icon className="size-4 text-brand" /> {label}
        </span>
        <span className="text-ink-muted">·</span>
        <span className="text-ink-muted">{formatDate(report.firstReportedAt)}</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger">
          <Flag className="size-3" /> {report.reportCount} şikayet
        </span>
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(report.reasons) as [ContentReportReason, number][]).map(([reason, n]) => (
            <span key={reason} className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">
              {REASON_LABEL[reason]}
              {n > 1 && ` ×${n}`}
            </span>
          ))}
        </div>

        {report.content ? (
          <blockquote className="rounded-xl border-l-4 border-brand bg-surface-muted px-4 py-3">
            <p className="mb-1 text-xs font-semibold text-ink-muted">
              {report.content.authorName}
              {report.content.removed && <span className="ml-2 text-danger">· yayından kaldırılmış</span>}
            </p>
            <p className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${!expanded && long ? 'line-clamp-4' : ''}`}>{text}</p>
            {long && (
              <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs font-semibold text-brand hover:underline">
                {expanded ? 'Daralt' : 'Tamamını göster'}
              </button>
            )}
          </blockquote>
        ) : (
          <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-ink-muted">İçerik artık yok (yazar hesabını silmiş olabilir).</p>
        )}

        {report.notes.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-ink-muted">Şikayet notları</p>
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
              {report.notes.map((n, i) => (
                <li key={i} className="break-words">
                  {n}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {status === 'PENDING' && (
        <div className="flex flex-col-reverse gap-2 border-t border-line bg-surface-muted px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <Button
            variant="outline"
            onClick={() => action.mutate('dismiss')}
            loading={action.isPending && action.variables === 'dismiss'}
            disabled={action.isPending}
            icon={<Check className="size-4" />}
          >
            Şikayeti Yoksay
          </Button>
          <Button
            variant="danger"
            onClick={() => action.mutate('remove')}
            loading={action.isPending && action.variables === 'remove'}
            disabled={action.isPending}
            icon={<Trash2 className="size-4" />}
          >
            İçeriği Kaldır
          </Button>
        </div>
      )}
    </li>
  );
}
