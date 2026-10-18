import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, keys, type TicketFilters } from '../../api/endpoints';
import { StatusBadge } from '../../components/badges';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, primaryLinkClass } from '../../components/ui';
import { usePollingFallback } from '../../hooks/useRealtime';
import { formatDate, timeAgo } from '../../lib/format';

const FILTERS: TicketFilters = { sort: 'updated', pageSize: 100 };

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
      <PageHeader title="My Tickets" subtitle="Replies from the BookLeaf team appear here instantly." actions={newButton} />
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
        <Card className="divide-y divide-slate-100">
          {query.data.items.map((t) => {
            const hasNewReply = !t.awaitingTeam && t.status !== 'CLOSED' && t.firstResponseAt;
            return (
              <Link key={t.id} to={`/tickets/${t.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{t.subject}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t.reference} · {t.book ? t.book.title : 'General / Account'} · opened {formatDate(t.createdAt)}
                  </p>
                </div>
                {hasNewReply && (
                  <span className="rounded-full bg-leaf-100 px-2 py-0.5 text-xs font-medium text-leaf-600">Team replied</span>
                )}
                <StatusBadge status={t.status} />
                <span className="w-20 text-right text-xs text-slate-400">{timeAgo(t.updatedAt)}</span>
              </Link>
            );
          })}
        </Card>
      )}
    </>
  );
}
