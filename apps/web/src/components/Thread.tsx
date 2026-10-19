import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { MessageDTO, TicketDetailDTO } from '@bookleaf/shared';
import { formatBytes, formatDateTime } from '../lib/format';

export function Thread({ ticket, viewer }: { ticket: TicketDetailDTO; viewer: 'AUTHOR' | 'ADMIN' }) {
  return (
    <ol className="space-y-4">
      <li>
        <Bubble
          own={viewer === 'AUTHOR'}
          name={viewer === 'AUTHOR' ? 'You' : ticket.author.name}
          role="Author"
          at={ticket.createdAt}
        >
          <p className="mb-1 font-medium text-slate-900">{ticket.subject}</p>
          <p className="whitespace-pre-wrap">{ticket.description}</p>
          {ticket.attachment && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-white/70 px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
              <PaperclipIcon /> {ticket.attachment.fileName} · {formatBytes(ticket.attachment.sizeBytes)}
            </p>
          )}
        </Bubble>
      </li>
      {ticket.messages.map((m) => (
        <li key={m.id}>
          <MessageBubble message={m} viewer={viewer} />
        </li>
      ))}
    </ol>
  );
}

function MessageBubble({ message, viewer }: { message: MessageDTO; viewer: 'AUTHOR' | 'ADMIN' }) {
  if (message.type === 'INTERNAL_NOTE') {
    return (
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm">
        <p className="mb-1 flex items-center gap-2 text-xs font-medium text-amber-800">
          <LockIcon /> Internal note · {message.sender.name} · {formatDateTime(message.createdAt)}
        </p>
        <p className="whitespace-pre-wrap text-amber-950">{message.body}</p>
      </div>
    );
  }
  const fromAuthor = message.type === 'AUTHOR_MESSAGE';
  const own = viewer === 'AUTHOR' ? fromAuthor : !fromAuthor;
  return (
    <Bubble
      own={own}
      name={viewer === 'AUTHOR' && fromAuthor ? 'You' : message.sender.name}
      role={fromAuthor ? 'Author' : 'BookLeaf Support'}
      at={message.createdAt}
    >
      <p className="whitespace-pre-wrap">{message.body}</p>
    </Bubble>
  );
}

function Bubble({ own, name, role, at, children }: { own: boolean; name: string; role: string; at: string; children: ReactNode }) {
  return (
    <div className={clsx('flex', own ? 'justify-end' : 'justify-start')}>
      <div className={clsx('max-w-[85%] rounded-lg px-4 py-3 text-sm', own ? 'bg-brand-50 ring-1 ring-brand-100' : 'bg-white ring-1 ring-slate-200')}>
        <p className="mb-1.5 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{name}</span> · {role} · {formatDateTime(at)}
        </p>
        <div className="text-slate-800">{children}</div>
      </div>
    </div>
  );
}

const LockIcon = () => (
  <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor" aria-hidden>
    <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
  </svg>
);

export const PaperclipIcon = () => (
  <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <path d="M15.5 9.5 10 15a3.5 3.5 0 0 1-5-5l6-6a2.3 2.3 0 0 1 3.3 3.3l-6 6a1.2 1.2 0 0 1-1.7-1.7L12 6" strokeLinecap="round" />
  </svg>
);
