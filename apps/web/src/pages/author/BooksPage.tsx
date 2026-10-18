import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { BookDTO, RoyaltySummary } from '@bookleaf/shared';
import { api, keys } from '../../api/endpoints';
import { ProductionTracker } from '../../components/ProductionTracker';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, primaryLinkClass } from '../../components/ui';
import { formatDate, formatInr, formatNumber } from '../../lib/format';

export function BooksPage() {
  const query = useQuery({ queryKey: keys.books, queryFn: api.books });

  return (
    <>
      <PageHeader
        title="My Books"
        subtitle="Sales, royalties and production status for every book you publish with BookLeaf."
        actions={
          <Link to="/tickets/new" className={primaryLinkClass}>
            Ask a question
          </Link>
        }
      />
      {query.isPending ? (
        <LoadingState label="Loading your books…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.books.length === 0 ? (
        <EmptyState title="No books yet" body="Once your manuscript is received, your book will appear here." />
      ) : (
        <div className="space-y-6">
          <RoyaltySummaryCards summary={query.data.summary} />
          <div className="grid gap-4 md:grid-cols-2">
            {query.data.books.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function RoyaltySummaryCards({ summary }: { summary: RoyaltySummary }) {
  const stats = [
    { label: 'Copies sold', value: formatNumber(summary.totalCopiesSold) },
    { label: 'Royalty earned', value: formatInr(summary.totalEarned) },
    { label: 'Royalty paid', value: formatInr(summary.totalPaid) },
    { label: 'Royalty pending', value: formatInr(summary.totalPending), highlight: summary.totalPending > 0 },
  ];
  return (
    <Card className="p-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{s.label}</p>
            <p className={clsx('mt-1 text-xl font-semibold', s.highlight ? 'text-brand-700' : 'text-slate-900')}>{s.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        Royalties are calculated quarterly and paid within 45 days of the quarter ending. The next payout window (for the
        quarter ending {formatDate(summary.quarterEndDate)}) closes on{' '}
        <span className="font-medium text-slate-700">{formatDate(summary.nextPayoutDate)}</span>. Balances under ₹1,000
        roll over to the next quarter.
      </p>
    </Card>
  );
}

function BookCard({ book }: { book: BookDTO }) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">{book.title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{book.genre}</p>
        </div>
        <span
          className={clsx(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
            book.isPublished ? 'bg-leaf-100 text-leaf-600' : 'bg-amber-50 text-amber-700',
          )}
        >
          {book.isPublished ? 'Published & Live' : 'In production'}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Detail label="ISBN" value={book.isbn} mono />
        <Detail label="Published" value={book.publicationDate ? formatDate(book.publicationDate) : 'Not yet'} />
        <Detail label="MRP" value={book.mrp !== null ? formatInr(book.mrp) : 'Set at publication'} />
        <Detail label="Copies sold" value={formatNumber(book.copiesSold)} />
      </dl>

      {book.isPublished ? (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <Detail label="Earned" value={formatInr(book.royalty.earned)} />
            <Detail label="Paid" value={formatInr(book.royalty.paid)} />
            <Detail label="Pending" value={formatInr(book.royalty.pending)} strong={book.royalty.pending > 0} />
          </dl>
          <p className="mt-2 text-xs text-slate-500">
            {book.royalty.lastPayoutDate
              ? `Last payout ${formatDate(book.royalty.lastPayoutDate)}`
              : book.royalty.earned > 0
                ? 'No payout yet'
                : 'No royalties earned yet'}
            {book.royalty.perCopy !== null && ` · ${formatInr(book.royalty.perCopy)} per copy`}
          </p>
          {book.royalty.belowThreshold && (
            <p className="mt-2 text-xs text-amber-700">
              Your total pending royalty is under the ₹1,000 minimum payout, so it will roll over to the next quarter.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-lg bg-amber-50/50 p-3">
          <ProductionTracker stage={book.productionStage} />
          <p className="mt-2 text-xs text-slate-500">Sales and royalties will appear here once your book is live.</p>
        </div>
      )}

      {book.platforms.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {book.platforms.map((p) => (
            <span key={p} className="rounded-md bg-white px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">
              {p}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto pt-4">
        <Link to={`/tickets/new?book=${book.id}`} className="text-sm font-medium text-brand-700 hover:underline">
          Get help with this book →
        </Link>
      </div>
    </Card>
  );
}

function Detail({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={clsx(mono && 'font-mono text-xs', strong ? 'font-semibold text-brand-700' : 'text-slate-800')}>
        {value}
      </dd>
    </div>
  );
}
