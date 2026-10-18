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
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/tickets" className="text-sm text-slate-500 hover:text-slate-700">
        ← All tickets
      </Link>
      {justCreated && <Banner tone="success">Thanks, your ticket {ticket.reference} has been submitted. You'll see our reply here as soon as it's sent.</Banner>}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {ticket.reference} · {ticket.book ? ticket.book.title : 'General / Account Level'}
          </p>
        </div>
        <StatusBadge status={ticket.status} />
      </div>
      <p className="text-sm text-slate-600">{STATUS_HELP[ticket.status]}</p>

      <Thread ticket={ticket} viewer="AUTHOR" />

      {ticket.status !== 'CLOSED' && <ReplyBox ticketId={ticket.id} />}
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
