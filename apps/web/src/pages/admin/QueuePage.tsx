import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_STATUSES,
  UNRESOLVED_STATUSES,
  type TicketOverviewDTO,
  type TicketStatus,
  type TicketSummaryDTO,
} from '@bookleaf/shared';
import { api, keys, type TicketFilters } from '../../api/endpoints';
import { CategoryBadge, PriorityBadge, StatusBadge } from '../../components/badges';
import { Banner, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, inputBaseClass } from '../../components/ui';
import { usePollingFallback } from '../../hooks/useRealtime';
import { hoursSince, timeAgo } from '../../lib/format';

const DEFAULT_STATUS: TicketStatus[] = ['OPEN', 'IN_PROGRESS'];
const ASSIGNEES = ['me', 'unassigned'] as const;
const SORTS = ['urgency', 'oldest', 'newest', 'updated'] as const;
const PAGE_SIZE = 25;
const SLA_HOURS = 48;

type FilterPatch = Record<string, string | string[] | undefined>;

const isOneOf = <T extends string>(allowed: readonly T[], value: string | null): value is T =>
  value !== null && (allowed as readonly string[]).includes(value);

function useFilters() {
  const [params, setParams] = useSearchParams();
  const list = <T extends string>(key: string, allowed: readonly T[], fallback: T[] = []): T[] => {
    const raw = params.get(key);
    return raw === null ? fallback : raw.split(',').filter((v): v is T => isOneOf(allowed, v));
  };
  const assignee = params.get('assignee');
  const sort = params.get('sort');
  const page = Number(params.get('page'));

  const filters: TicketFilters = {
    status: list('status', TICKET_STATUSES, DEFAULT_STATUS),
    category: list('category', CATEGORIES),
    priority: list('priority', PRIORITIES),
    assignee: isOneOf(ASSIGNEES, assignee) ? assignee : undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    q: params.get('q') || undefined,
    sort: isOneOf(SORTS, sort) ? sort : 'urgency',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: PAGE_SIZE,
  };

  const update = (patch: FilterPatch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      const value = Array.isArray(v) ? v.join(',') : v;
      if (value === undefined || (value === '' && k !== 'status')) next.delete(k);
      else next.set(k, value);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  return { filters, update, reset: () => setParams({}, { replace: true }) };
}

export function QueuePage() {
  const { filters, update, reset } = useFilters();
  const refetchInterval = usePollingFallback();
  const tickets = useQuery({ queryKey: keys.ticketList(filters), queryFn: () => api.tickets(filters), refetchInterval, placeholderData: (prev) => prev });
  const overview = useQuery({ queryKey: keys.overview, queryFn: api.overview, refetchInterval });

  return (
    <>
      <PageHeader eyebrow="Operations" title="Ticket queue" subtitle="Sorted by urgency: Critical first, then oldest first." />

      {overview.data && !overview.data.aiEnabled && (
        <div className="mb-4">
          <Banner tone="warning">
            AI assistance is offline. New tickets are classified by keyword rules and reply drafts use templates. Everything else works normally.
          </Banner>
        </div>
      )}
      {overview.data && <OverviewStrip overview={overview.data.overview} onFilter={update} />}

      <Card className="mb-4 p-4">
        <FilterBar filters={filters} update={update} reset={reset} />
      </Card>

      {tickets.isPending ? (
        <LoadingState label="Loading tickets…" />
      ) : tickets.isError ? (
        <ErrorState error={tickets.error} onRetry={() => tickets.refetch()} />
      ) : tickets.data.items.length === 0 ? (
        <EmptyState
          title="No tickets match these filters"
          body="Try clearing a filter or widening the date range."
          action={<Button variant="secondary" onClick={reset}>Reset filters</Button>}
        />
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {tickets.data.items.map((t) => (
              <TicketCard key={t.id} ticket={t} />
            ))}
          </div>
          <Card className={clsx('hidden overflow-hidden md:block', tickets.isFetching && 'opacity-80')}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Ticket</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assignee</th>
                    <th className="px-4 py-3 text-right">Age</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tickets.data.items.map((t) => (
                    <TicketRow key={t.id} ticket={t} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Pagination total={tickets.data.total} page={filters.page ?? 1} onPage={(p) => update({ page: String(p) })} />
        </>
      )}
    </>
  );
}

function OverviewStrip({ overview, onFilter }: { overview: TicketOverviewDTO; onFilter: (patch: FilterPatch) => void }) {
  const oldestHours = overview.oldestUnresolvedAt ? hoursSince(overview.oldestUnresolvedAt) : 0;
  const tiles = [
    { label: 'Critical', value: overview.unresolvedByPriority.CRITICAL, tone: 'text-red-600', onClick: () => onFilter({ priority: 'CRITICAL' }) },
    { label: 'High', value: overview.unresolvedByPriority.HIGH, tone: 'text-orange-600', onClick: () => onFilter({ priority: 'HIGH' }) },
    { label: 'Awaiting reply', value: overview.awaitingTeam, tone: 'text-slate-900' },
    { label: 'Unassigned', value: overview.unassigned, tone: 'text-slate-900', onClick: () => onFilter({ assignee: 'unassigned' }) },
    {
      label: 'Oldest unresolved',
      value: overview.oldestUnresolvedAt ? timeAgo(overview.oldestUnresolvedAt).replace(' ago', '') : '–',
      tone: oldestHours > SLA_HOURS ? 'text-red-600' : 'text-slate-900',
      onClick: () => onFilter({ sort: 'oldest' }),
    },
  ];
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <button
          key={t.label}
          type="button"
          disabled={!t.onClick}
          onClick={t.onClick}
          className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm enabled:hover:border-brand-200 disabled:cursor-default"
        >
          <p className="text-xs text-slate-500">{t.label}</p>
          <p className={clsx('mt-1 font-display text-2xl font-semibold tabular-nums', t.tone)}>{t.value}</p>
        </button>
      ))}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" title="AI calls logged since launch">
        <p className="text-xs text-slate-500">AI usage</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">
          {overview.ai.calls} calls · ${overview.ai.estimatedCostUsd.toFixed(3)}
        </p>
        <p className="text-xs text-slate-400">{overview.ai.failures} failed, fell back</p>
      </div>
    </div>
  );
}

function FilterBar({ filters, update, reset }: { filters: TicketFilters; update: (patch: FilterPatch) => void; reset: () => void }) {
  const toggle = <T extends string>(key: 'status' | 'priority', current: T[], value: T) =>
    update({ [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          key={filters.q ?? ''}
          type="search"
          placeholder="Search subject, author, book or BL-00042"
          className={clsx(inputBaseClass, 'w-full sm:w-72')}
          defaultValue={filters.q}
          onKeyDown={(e) => e.key === 'Enter' && update({ q: e.currentTarget.value.trim() || undefined })}
          onBlur={(e) => update({ q: e.currentTarget.value.trim() || undefined })}
          aria-label="Search tickets"
        />
        <select className={inputBaseClass} value={filters.category?.[0] ?? ''} onChange={(e) => update({ category: e.target.value || undefined })} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select className={inputBaseClass} value={filters.assignee ?? ''} onChange={(e) => update({ assignee: e.target.value || undefined })} aria-label="Assignee">
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
        </select>
        <select className={inputBaseClass} value={filters.sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort">
          <option value="urgency">Most urgent</option>
          <option value="oldest">Oldest first</option>
          <option value="newest">Newest first</option>
          <option value="updated">Recently updated</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          From
          <input type="date" className={inputBaseClass} value={filters.from ?? ''} onChange={(e) => update({ from: e.target.value || undefined })} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          To
          <input type="date" className={inputBaseClass} value={filters.to ?? ''} onChange={(e) => update({ to: e.target.value || undefined })} />
        </label>
        <Button variant="ghost" size="sm" onClick={reset}>
          Reset
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <ChipGroup label="Status" options={TICKET_STATUSES} labels={STATUS_LABELS} selected={filters.status ?? []} onToggle={(v) => toggle('status', filters.status ?? [], v)} />
        <ChipGroup label="Priority" options={PRIORITIES} labels={PRIORITY_LABELS} selected={filters.priority ?? []} onToggle={(v) => toggle('priority', filters.priority ?? [], v)} />
      </div>
    </div>
  );
}

function ChipGroup<T extends string>({ label, options, labels, selected, onToggle }: { label: string; options: readonly T[]; labels: Record<T, string>; selected: T[]; onToggle: (v: T) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="mr-1 text-xs font-medium text-slate-500">{label}:</span>
      {options.map((o) => {
        const active = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(o)}
            className={clsx(
              'rounded-full px-2.5 py-1 text-xs font-medium ring-1',
              active ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50',
            )}
          >
            {labels[o]}
          </button>
        );
      })}
      {selected.length === 0 && <span className="text-xs text-slate-400">(all)</span>}
    </div>
  );
}

function queueFlags(t: TicketSummaryDTO) {
  const open = UNRESOLVED_STATUSES.includes(t.status);
  return {
    awaitingReply: open && t.awaitingTeam,
    overdue: open && t.awaitingTeam && hoursSince(t.createdAt) > SLA_HOURS,
    critical: open && t.priority === 'CRITICAL',
  };
}

function TicketRow({ ticket: t }: { ticket: TicketSummaryDTO }) {
  const { awaitingReply, overdue, critical } = queueFlags(t);
  return (
    <tr className={clsx('hover:bg-slate-50', critical && 'bg-red-50/60')}>
      <td className="px-4 py-3 align-top">
        <PriorityBadge priority={t.priority} />
      </td>
      <td className="max-w-md px-4 py-3">
        <Link to={`/admin/tickets/${t.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
          {t.subject}
        </Link>
        <p className="mt-0.5 text-xs text-slate-500">
          {t.reference} · {t.author.name} · {t.book?.title ?? 'General'}
          {awaitingReply && <span className="ml-2 font-medium text-brand-700">● Awaiting reply</span>}
        </p>
      </td>
      <td className="px-4 py-3 align-top">
        <CategoryBadge category={t.category} />
      </td>
      <td className="px-4 py-3 align-top">
        <StatusBadge status={t.status} />
      </td>
      <td className="px-4 py-3 align-top text-slate-600">{t.assignee?.name ?? <span className="text-slate-400">Unassigned</span>}</td>
      <td className={clsx('px-4 py-3 text-right align-top whitespace-nowrap', overdue ? 'font-medium text-red-600' : 'text-slate-500')} title={overdue ? `Over ${SLA_HOURS}h without a reply` : undefined}>
        {timeAgo(t.createdAt)}
      </td>
    </tr>
  );
}

function TicketCard({ ticket: t }: { ticket: TicketSummaryDTO }) {
  const { awaitingReply, overdue, critical } = queueFlags(t);
  return (
    <Link
      to={`/admin/tickets/${t.id}`}
      className={clsx('block rounded-xl border bg-white p-4 shadow-sm', critical ? 'border-red-200 bg-red-50/60' : 'border-slate-200')}
    >
      <div className="flex items-center justify-between gap-2">
        <PriorityBadge priority={t.priority} />
        <span className={clsx('text-xs', overdue ? 'font-medium text-red-600' : 'text-slate-500')}>{timeAgo(t.createdAt)}</span>
      </div>
      <p className="mt-2 font-medium text-slate-900">{t.subject}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {t.reference} · {t.author.name} · {t.book?.title ?? 'General'}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={t.status} />
        <CategoryBadge category={t.category} />
        {awaitingReply && <span className="text-xs font-medium text-brand-700">● Awaiting reply</span>}
      </div>
    </Link>
  );
}

function Pagination({ total, page, onPage }: { total: number; page: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
      <span>
        {total} ticket{total === 1 ? '' : 's'}
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {pages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
