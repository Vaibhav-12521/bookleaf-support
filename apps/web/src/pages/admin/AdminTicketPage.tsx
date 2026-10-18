import clsx from 'clsx';
import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_STATUSES,
  findDraftPlaceholders,
  type TicketDetailDTO,
  type TicketStatus,
  type UpdateTicketInput,
} from '@bookleaf/shared';
import { errorMessage } from '../../api/client';
import { api, keys } from '../../api/endpoints';
import { PriorityBadge, SourceTag, StatusBadge } from '../../components/badges';
import { Thread } from '../../components/Thread';
import { Banner, Button, Card, ErrorState, LoadingState, Spinner, inputClass } from '../../components/ui';
import { usePollingFallback } from '../../hooks/useRealtime';
import { useSession } from '../../hooks/useSession';
import { formatDate, formatDateTime, formatInr } from '../../lib/format';

export function AdminTicketPage() {
  const { id = '' } = useParams();
  const query = useQuery({ queryKey: keys.ticket(id), queryFn: () => api.ticket(id), refetchInterval: usePollingFallback() });

  if (query.isPending) return <LoadingState label="Loading ticket…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const ticket = query.data;

  return (
    <div className="space-y-5">
      <Link to="/admin/tickets" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to queue
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {ticket.reference} · {ticket.author.name} · {ticket.book?.title ?? 'General / Account Level'} · opened {formatDateTime(ticket.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0 space-y-5">
          <Thread ticket={ticket} viewer="ADMIN" />
          <Composer ticket={ticket} />
        </div>
        <aside className="space-y-5 lg:sticky lg:top-24">
          <TriagePanel ticket={ticket} />
          <AuthorPanel ticket={ticket} />
        </aside>
      </div>
    </div>
  );
}

function Composer({ ticket }: { ticket: TicketDetailDTO }) {
  const [tab, setTab] = useState<'reply' | 'note'>('reply');
  return (
    <Card>
      <div className="flex border-b border-slate-200 px-2" role="tablist">
        {(['reply', 'note'] as const).map((t) => (
          <button
            key={t}
            id={`composer-tab-${t}`}
            role="tab"
            aria-selected={tab === t}
            aria-controls="composer-panel"
            type="button"
            onClick={() => setTab(t)}
            className={clsx(
              '-mb-px border-b-2 px-3 py-3 text-sm font-medium',
              tab === t ? 'border-brand-700 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            {t === 'reply' ? 'Reply to author' : 'Internal note'}
          </button>
        ))}
      </div>
      <div id="composer-panel" role="tabpanel" aria-labelledby={`composer-tab-${tab}`} className="p-4">
        {tab === 'reply' ? <ReplyEditor ticket={ticket} /> : <NoteEditor ticketId={ticket.id} />}
      </div>
    </Card>
  );
}

function ReplyEditor({ ticket }: { ticket: TicketDetailDTO }) {
  const qc = useQueryClient();
  const closed = ticket.status === 'CLOSED';
  const draft = useQuery({ queryKey: keys.draft(ticket.id), queryFn: () => api.draft(ticket.id), enabled: !closed, staleTime: Infinity, retry: false });
  const [edited, setEdited] = useState<string | null>(null);
  const body = edited ?? draft.data?.content ?? '';

  const regenerate = useMutation({
    mutationFn: () => api.regenerateDraft(ticket.id),
    onSuccess: (d) => {
      qc.setQueryData(keys.draft(ticket.id), d);
      setEdited(null);
    },
  });

  const send = useMutation({
    mutationFn: (status?: TicketStatus) =>
      api.addMessage(ticket.id, { body, kind: 'REPLY', status, fromAiDraft: draft.data?.source === 'AI' }),
    onSuccess: () => {
      setEdited('');
      void qc.invalidateQueries({ queryKey: keys.ticket(ticket.id) });
      void qc.invalidateQueries({ queryKey: keys.ticketLists });
      void qc.invalidateQueries({ queryKey: keys.overview });
      void qc.invalidateQueries({ queryKey: keys.draft(ticket.id), refetchType: 'none' });
    },
  });

  if (closed) return <p className="text-sm text-slate-500">This ticket is closed. Reopen it from the status menu to reply.</p>;

  const placeholders = findDraftPlaceholders(body);
  const lastAuthorMessage = [...ticket.messages].reverse().find((m) => m.type === 'AUTHOR_MESSAGE');
  const draftStale = draft.data && lastAuthorMessage && new Date(lastAuthorMessage.createdAt) > new Date(draft.data.createdAt);
  const busy = draft.isFetching || regenerate.isPending;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <DraftLabel loading={busy} source={draft.data?.source} model={draft.data?.model} />
        <Button variant="ghost" size="sm" onClick={() => regenerate.mutate()} loading={regenerate.isPending} disabled={draft.isFetching}>
          ↻ Regenerate draft
        </Button>
      </div>

      {draft.data?.notice && <Banner tone="warning">{draft.data.notice} You can edit it or write your own reply.</Banner>}
      {(draft.isError || regenerate.isError) && <Banner tone="error">Couldn't load a draft. You can still write a reply manually.</Banner>}
      {draftStale && <Banner tone="info">The author has replied since this draft was written. Regenerate to include their latest message.</Banner>}

      <div className="relative">
        <textarea
          rows={12}
          className={clsx(inputClass, 'font-[inherit] leading-relaxed')}
          value={body}
          onChange={(e) => setEdited(e.target.value)}
          placeholder={busy ? '' : 'Write your reply to the author…'}
          aria-label="Reply to author"
        />
        {busy && !body && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Spinner className="size-4" /> Drafting a reply from the knowledge base…
          </div>
        )}
      </div>

      {placeholders.length > 0 && (
        <Banner tone="warning">
          Fill in {placeholders.length} placeholder{placeholders.length > 1 ? 's' : ''} before sending:{' '}
          {placeholders.map((p) => (
            <code key={p} className="mx-0.5 rounded bg-amber-100 px-1">
              {p}
            </code>
          ))}
        </Banner>
      )}
      {send.isError && <Banner tone="error">{errorMessage(send.error, 'Could not send the reply.')}</Banner>}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-xs text-slate-400">Replies are visible to the author immediately.</span>
        <Button variant="secondary" disabled={!body.trim() || placeholders.length > 0} loading={send.isPending && send.variables === 'RESOLVED'} onClick={() => send.mutate('RESOLVED')}>
          Send & resolve
        </Button>
        <Button disabled={!body.trim() || placeholders.length > 0} loading={send.isPending && send.variables === undefined} onClick={() => send.mutate(undefined)}>
          Send reply
        </Button>
      </div>
    </div>
  );
}

function DraftLabel({ loading, source, model }: { loading: boolean; source?: 'AI' | 'TEMPLATE'; model?: string | null }) {
  if (loading) return <span className="text-slate-500">Preparing draft…</span>;
  if (source === 'AI')
    return (
      <span className="inline-flex items-center gap-1.5 text-indigo-700">
        <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-medium ring-1 ring-indigo-200">AI draft</span>
        <span className="text-slate-400">{model} · review before sending</span>
      </span>
    );
  if (source === 'TEMPLATE') return <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">Template</span>;
  return <span />;
}

function NoteEditor({ ticketId }: { ticketId: string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const add = useMutation({
    mutationFn: () => api.addMessage(ticketId, { body, kind: 'NOTE' }),
    onSuccess: () => {
      setBody('');
      void qc.invalidateQueries({ queryKey: keys.ticket(ticketId) });
    },
  });
  return (
    <div className="space-y-3">
      <textarea rows={4} className={inputClass} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Context for the team. Never shown to the author." aria-label="Internal note" />
      {add.isError && <Banner tone="error">Could not save the note.</Banner>}
      <div className="flex justify-end">
        <Button variant="secondary" disabled={!body.trim()} loading={add.isPending} onClick={() => add.mutate()}>
          Add internal note
        </Button>
      </div>
    </div>
  );
}

function useUpdateTicket(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTicketInput) => api.updateTicket(ticketId, input),
    onSuccess: (ticket) => {
      qc.setQueryData(keys.ticket(ticketId), ticket);
      void qc.invalidateQueries({ queryKey: keys.ticketLists });
      void qc.invalidateQueries({ queryKey: keys.overview });
    },
  });
}

function TriagePanel({ ticket }: { ticket: TicketDetailDTO }) {
  const { user } = useSession();
  const update = useUpdateTicket(ticket.id);
  const qc = useQueryClient();
  const retriage = useMutation({
    mutationFn: () => api.retriage(ticket.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.ticket(ticket.id) }),
  });
  const triage = ticket.triage;
  const mine = ticket.assignee?.id === user?.id;

  return (
    <Card className="space-y-4 p-4">
      <h2 className="text-sm font-semibold text-slate-900">Ticket</h2>

      <PanelSelect label="Status" value={ticket.status} options={TICKET_STATUSES} labels={STATUS_LABELS} onChange={(status) => update.mutate({ status })} />
      <PanelSelect
        label="Category"
        tag={triage && <SourceTag source={triage.categorySource} />}
        value={ticket.category}
        options={CATEGORIES}
        labels={CATEGORY_LABELS}
        onChange={(category) => update.mutate({ category })}
      />
      <PanelSelect
        label="Priority"
        tag={triage && <SourceTag source={triage.prioritySource} />}
        value={ticket.priority}
        options={PRIORITIES}
        labels={PRIORITY_LABELS}
        onChange={(priority) => update.mutate({ priority })}
      />

      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Assignee</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-slate-800">{ticket.assignee?.name ?? 'Unassigned'}</span>
          {mine ? (
            <Button variant="ghost" size="sm" onClick={() => update.mutate({ assigneeId: null })}>
              Unassign
            </Button>
          ) : (
            user && (
              <Button variant="secondary" size="sm" onClick={() => update.mutate({ assigneeId: user.id })}>
                Assign to me
              </Button>
            )
          )}
        </div>
      </div>
      {update.isError && <Banner tone="error">{errorMessage(update.error, 'Update failed.')}</Banner>}

      {triage && (
        <div className="rounded-lg bg-slate-50 p-3 text-xs">
          <p className="mb-1 font-semibold text-slate-700">AI triage</p>
          {triage.status === 'PENDING' && (
            <p className="flex items-center gap-2 text-slate-500">
              <Spinner className="size-3.5" /> Classifying…
            </p>
          )}
          {triage.status === 'COMPLETED' && (
            <>
              <p className="text-slate-600">
                Suggested <b>{triage.aiCategory && CATEGORY_LABELS[triage.aiCategory]}</b> / <b>{triage.aiPriority && PRIORITY_LABELS[triage.aiPriority]}</b>
                {triage.confidence !== null && <> · {Math.round(triage.confidence * 100)}% confident</>}
              </p>
              {triage.reasoning && <p className="mt-1 text-slate-500 italic">“{triage.reasoning}”</p>}
            </>
          )}
          {triage.status === 'FAILED' && <p className="text-amber-700">{triage.error}</p>}
          {triage.status !== 'PENDING' && (
            <Button variant="ghost" size="sm" className="-ml-2 mt-1" loading={retriage.isPending} onClick={() => retriage.mutate()}>
              ↻ Re-run AI triage
            </Button>
          )}
          {retriage.isError && <p className="mt-1 text-red-600">{errorMessage(retriage.error, 'Could not re-run triage.')}</p>}
          {(triage.categorySource === 'ADMIN' || triage.prioritySource === 'ADMIN') && (
            <p className="mt-1 text-slate-400">Your overrides are kept when AI re-runs.</p>
          )}
        </div>
      )}
    </Card>
  );
}

function PanelSelect<T extends string>({
  label,
  tag,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  tag?: ReactNode;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
}) {
  const id = `panel-${label.toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-500">
        {label} {tag}
      </label>
      <select
        id={id}
        className={inputClass}
        value={value}
        onChange={(e) => {
          const next = options.find((o) => o === e.target.value);
          if (next) onChange(next);
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </select>
    </div>
  );
}

function AuthorPanel({ ticket }: { ticket: TicketDetailDTO }) {
  const author = ticket.authorContext;
  if (!author) return null;
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-slate-900">{author.name}</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        {author.email} · {author.city} · author since {formatDate(author.joinedDate)}
      </p>
      <ul className="mt-3 space-y-2">
        {author.books.map((b) => (
          <li key={b.id} className={clsx('rounded-lg p-2.5 text-xs ring-1', b.id === ticket.book?.id ? 'bg-brand-50 ring-brand-200' : 'ring-slate-200')}>
            <p className="font-medium text-slate-800">
              {b.title} <span className="font-normal text-slate-400">{b.id}</span>
            </p>
            <p className="mt-0.5 text-slate-500">
              {b.isPublished
                ? b.publicationDate
                  ? `Live since ${formatDate(b.publicationDate)}`
                  : 'Live'
                : `In production: ${b.productionStage}`}
            </p>
            {b.isPublished && (
              <p className="mt-1 text-slate-600">
                {b.copiesSold} sold · earned {formatInr(b.royalty.earned)} · paid {formatInr(b.royalty.paid)} ·{' '}
                <span className={b.royalty.pending > 0 ? 'font-medium text-brand-700' : ''}>pending {formatInr(b.royalty.pending)}</span>
                <br />
                Last payout: {b.royalty.lastPayoutDate ? formatDate(b.royalty.lastPayoutDate) : 'never'}
                {b.royalty.belowThreshold && <span className="text-amber-700"> · account below ₹1,000 threshold</span>}
              </p>
            )}
            <p className="mt-1 font-mono text-[10px] text-slate-400">ISBN {b.isbn}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
