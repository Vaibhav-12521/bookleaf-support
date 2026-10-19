import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { BookDTO, RoyaltySummary } from '@bookleaf/shared';
import { api, keys } from '../../api/endpoints';
import { BookCover } from '../../components/BookCover';
import { ProductionTracker } from '../../components/ProductionTracker';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, primaryLinkClass } from '../../components/ui';
import { formatDate, formatInr, formatNumber } from '../../lib/format';

export function BooksPage() {
  const query = useQuery({ queryKey: keys.books, queryFn: api.books });

  return (
    <>
      <PageHeader
        eyebrow="Author dashboard"
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
        <div className="space-y-8">
          <RoyaltyOverview summary={query.data.summary} />
          <section aria-label="Books">
            <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {query.data.books.map((b) => (
                <BookCard key={b.id} book={b} />
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

const daysUntil = (isoDate: string) =>
  Math.max(0, Math.ceil((new Date(`${isoDate}T23:59:59`).getTime() - Date.now()) / 86_400_000));

function RoyaltyOverview({ summary }: { summary: RoyaltySummary }) {
  const stats = [
    { label: 'Copies sold', value: formatNumber(summary.totalCopiesSold) },
    { label: 'Royalty earned', value: formatInr(summary.totalEarned) },
    { label: 'Royalty paid', value: formatInr(summary.totalPaid) },
    { label: 'Royalty pending', value: formatInr(summary.totalPending), highlight: summary.totalPending > 0 },
  ];
  const days = daysUntil(summary.nextPayoutDate);
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Card className="p-6 sm:p-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="border-l-2 border-slate-200 pl-4 first:border-leaf-500">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{s.label}</p>
              <p className={clsx('mt-2 font-display text-2xl font-semibold tabular-nums sm:text-3xl', s.highlight ? 'text-gold-700' : 'text-slate-900')}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
          Royalties are calculated quarterly and paid within 45 days of the quarter ending. The next payout window (for the
          quarter ending {formatDate(summary.quarterEndDate)}) closes on{' '}
          <span className="font-medium text-slate-700">{formatDate(summary.nextPayoutDate)}</span>. Balances under ₹1,000
          roll over to the next quarter.
        </p>
      </Card>
      <div className="relative overflow-hidden rounded-lg bg-brand-700 p-6 text-white sm:p-8">
        <p className="relative text-xs font-semibold tracking-[0.16em] text-brand-200 uppercase">Next payout</p>
        <p className="relative mt-3 font-display text-3xl font-semibold">{formatDate(summary.nextPayoutDate)}</p>
        <p className="relative mt-1 text-sm text-brand-100/80">{days === 0 ? 'Payout window closes today' : `in ${days} day${days === 1 ? '' : 's'}`}</p>
        <div className="relative mt-6 flex items-end justify-between border-t border-white/10 pt-4">
          <span className="text-xs text-brand-100/70">Pending across all books</span>
          <span className="font-display text-xl tabular-nums">{formatInr(summary.totalPending)}</span>
        </div>
      </div>
    </div>
  );
}

function BookCard({ book }: { book: BookDTO }) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex gap-5 p-5 sm:p-6">
        <BookCover id={book.id} title={book.title} genre={book.genre} className="w-24 shrink-0 sm:w-28" />
        <div className="min-w-0 flex-1">
          <span
            className={clsx(
              'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
              book.isPublished ? 'bg-leaf-100 text-leaf-600' : 'bg-gold-100 text-gold-700',
            )}
          >
            {book.isPublished ? 'Published & Live' : 'In production'}
          </span>
          <h2 className="mt-2 text-xl leading-snug font-semibold text-slate-900">{book.title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{book.genre}</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Detail label="ISBN" value={book.isbn} mono />
            <Detail label="Published" value={book.publicationDate ? formatDate(book.publicationDate) : 'Not yet'} />
            <Detail label="MRP" value={book.mrp !== null ? formatInr(book.mrp) : 'Set at publication'} />
            <Detail label="Copies sold" value={formatNumber(book.copiesSold)} />
          </dl>
        </div>
      </div>

      <div className="mx-5 mb-5 sm:mx-6">
        {book.isPublished ? (
          <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-100">
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <Detail label="Earned" value={formatInr(book.royalty.earned)} />
              <Detail label="Paid" value={formatInr(book.royalty.paid)} />
              <Detail label="Pending" value={formatInr(book.royalty.pending)} strong={book.royalty.pending > 0} />
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              {book.royalty.lastPayoutDate
                ? `Last payout ${formatDate(book.royalty.lastPayoutDate)}`
                : book.royalty.earned > 0
                  ? 'No payout yet'
                  : 'No royalties earned yet'}
              {book.royalty.perCopy !== null && ` · ${formatInr(book.royalty.perCopy)} per copy`}
            </p>
            {book.royalty.belowThreshold && (
              <p className="mt-2 text-xs text-gold-700">
                Your total pending royalty is under the ₹1,000 minimum payout, so it will roll over to the next quarter.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-gold-100/50 p-4 ring-1 ring-gold-100">
            <ProductionTracker stage={book.productionStage} />
            <p className="mt-2 text-xs text-slate-500">Sales and royalties will appear here once your book is live.</p>
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap gap-1.5">
          {book.platforms.length > 0 ? (
            book.platforms.map((p) => (
              <span key={p} className="rounded-md bg-slate-50 px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">
                {p}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400">Not listed on any platform yet</span>
          )}
        </div>
        <Link to={`/tickets/new?book=${book.id}`} className="text-sm font-medium text-brand-700 hover:underline">
          Get help with this book →
        </Link>
      </div>
    </Card>
  );
}

function Detail({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={clsx(mono ? 'font-mono text-xs break-all' : 'break-words', strong ? 'font-semibold text-gold-700' : 'text-slate-800')}>{value}</dd>
    </div>
  );
}
