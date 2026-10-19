import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { TicketSummaryDTO } from '@bookleaf/shared';
import { api, keys, type TicketFilters } from '../../api/endpoints';
import { MiniCover } from '../../components/BookCover';
import { StatusBadge } from '../../components/badges';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, primaryLinkClass } from '../../components/ui';
import { usePollingFallback } from '../../hooks/useRealtime';
import { formatDate, timeAgo } from '../../lib/format';

const FILTERS: TicketFilters = { sort: 'updated', pageSize: 100 };

const hasNewReply = (t: TicketSummaryDTO) => !t.awaitingTeam && t.status !== 'CLOSED' && !!t.firstResponseAt;

export function TicketsPage() {
  const query = useQuery({
    queryKey: keys.ticketList(FILTERS),
    queryFn: () => api.tickets(FILTERS),
    refetchInterval: usePollingFallback(),
  });

  const newButton = (
    <Link to="/tickets/new" className={primaryLinkClass}>
      New ticket
    </Link>
  );

  return (
    <>
      <PageHeader eyebrow="Support" title="My Tickets" subtitle="Replies from the BookLeaf team appear here instantly." actions={newButton} />
      {query.isPending ? (
        <LoadingState label="Loading your tickets…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          title="You haven't raised any tickets"
          body="Questions about royalties, ISBNs, printing or your book's progress? Our team usually replies within 48 hours."
          action={newButton}
        />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {query.data.items.map((t) => (
              <Link
                key={t.id}
                to={`/tickets/${t.id}`}
                className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-slate-50 sm:px-6"
              >
                <MiniCover id={t.book?.id ?? null} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 group-hover:text-brand-700">{t.subject}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t.reference} · {t.book ? t.book.title : 'General / Account'} · opened {formatDate(t.createdAt)}
                  </p>
                </div>
                {hasNewReply(t) && <span className="rounded-full bg-leaf-100 px-2 py-0.5 text-xs font-medium text-leaf-600">Team replied</span>}
                <StatusBadge status={t.status} />
                <span className="w-20 text-right text-xs text-slate-400">{timeAgo(t.updatedAt)}</span>
              </Link>
            ))}
          </Card>
          <TicketSummaryPanel tickets={query.data.items} />
        </div>
      )}
    </>
  );
}

function TicketSummaryPanel({ tickets }: { tickets: TicketSummaryDTO[] }) {
  const open = tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;
  const replied = tickets.filter(hasNewReply).length;
  const resolved = tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length;
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-slate-900">At a glance</h2>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {[
          ['Open', open],
          ['New replies', replied],
          ['Resolved', resolved],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 px-3 py-3 ring-1 ring-slate-100">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-1 font-display text-2xl font-semibold text-slate-900 tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-xs leading-relaxed text-slate-500">
        A resolved ticket reopens if you reply to it. Closed tickets are final; raise a new one if you still need help.
      </p>
    </Card>
  );
}
