import { useState, type FormEvent } from 'react';
import type { TicketStatus } from '@bookleaf/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { api, keys } from '../../api/endpoints';
import { StatusBadge } from '../../components/badges';
import { Thread } from '../../components/Thread';
import { Banner, Button, Card, ErrorState, LoadingState, inputClass } from '../../components/ui';
import { usePollingFallback } from '../../hooks/useRealtime';
import { formatDateTime } from '../../lib/format';

const STATUS_HELP: Record<TicketStatus, string> = {
  OPEN: "We've received your ticket and a team member will reply soon.",
  IN_PROGRESS: 'A BookLeaf team member is working on this.',
  RESOLVED: 'We believe this is resolved. Reply below if you still need help and we will reopen it.',
  CLOSED: 'This ticket is closed. Please raise a new ticket if you need more help.',
};

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const justCreated = (location.state as { justCreated?: boolean } | null)?.justCreated;
  const query = useQuery({ queryKey: keys.ticket(id), queryFn: () => api.ticket(id), refetchInterval: usePollingFallback() });

  if (query.isPending) return <LoadingState label="Loading ticket…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const ticket = query.data;

  return (
    <div className="space-y-6">
      <Link to="/tickets" className="text-sm text-slate-500 hover:text-slate-700">
        ← All tickets
      </Link>
      {justCreated && <Banner tone="success">Thanks, your ticket {ticket.reference} has been submitted. You'll see our reply here as soon as it's sent.</Banner>}

      <div>
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-leaf-600 uppercase">{ticket.reference}</p>
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{ticket.subject}</h1>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <aside className="lg:sticky lg:top-24 lg:order-last">
          <Card className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Status</h2>
              <StatusBadge status={ticket.status} />
            </div>
            <p className="text-sm text-slate-600">{STATUS_HELP[ticket.status]}</p>
            <dl className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm lg:grid-cols-1">
              <Fact label="About" value={ticket.book ? ticket.book.title : 'General / Account Level'} />
              <Fact label="Opened" value={formatDateTime(ticket.createdAt)} />
              <Fact label="Last update" value={formatDateTime(ticket.updatedAt)} />
              <Fact label="First reply" value={ticket.firstResponseAt ? formatDateTime(ticket.firstResponseAt) : 'Usually within 48 hours'} />
            </dl>
          </Card>
        </aside>
        <div className="min-w-0 space-y-5">
          <Thread ticket={ticket} viewer="AUTHOR" />
          {ticket.status !== 'CLOSED' && <ReplyBox ticketId={ticket.id} />}
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}

function ReplyBox({ ticketId }: { ticketId: string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const send = useMutation({
    mutationFn: () => api.addMessage(ticketId, { body }),
    onSuccess: () => {
      setBody('');
      void qc.invalidateQueries({ queryKey: keys.ticket(ticketId) });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (body.trim()) send.mutate();
  }

  return (
    <Card className="p-4">
      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="reply" className="text-sm font-medium text-slate-700">
          Add a reply
        </label>
        <textarea id="reply" rows={3} className={inputClass} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />
        {send.isError && <Banner tone="error">{errorMessage(send.error, 'Could not send your reply.')}</Banner>}
        <div className="flex justify-end">
          <Button type="submit" loading={send.isPending} disabled={!body.trim()}>
            Send reply
          </Button>
        </div>
      </form>
    </Card>
  );
}
