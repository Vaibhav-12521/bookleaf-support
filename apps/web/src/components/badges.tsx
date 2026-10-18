import clsx from 'clsx';
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Category,
  type Priority,
  type TicketStatus,
} from '@bookleaf/shared';

const pill = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset';

const STATUS_STYLES: Record<TicketStatus, string> = {
  OPEN: 'bg-sky-50 text-sky-700 ring-sky-200',
  IN_PROGRESS: 'bg-violet-50 text-violet-700 ring-violet-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={clsx(pill, STATUS_STYLES[status])}>{STATUS_LABELS[status]}</span>;
}

const PRIORITY_STYLES: Record<Priority, string> = {
  CRITICAL: 'bg-red-600 text-white ring-red-600',
  HIGH: 'bg-orange-50 text-orange-700 ring-orange-200',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-amber-200',
  LOW: 'bg-slate-50 text-slate-600 ring-slate-200',
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={clsx(pill, PRIORITY_STYLES[priority])}>
      {priority === 'CRITICAL' && <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden />}
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function CategoryBadge({ category }: { category: Category }) {
  return <span className={clsx(pill, 'bg-brand-50 text-brand-700 ring-brand-200')}>{CATEGORY_LABELS[category]}</span>;
}

export function SourceTag({ source }: { source: 'AI' | 'RULES' | 'ADMIN' }) {
  const styles = {
    AI: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    RULES: 'bg-slate-100 text-slate-600 ring-slate-200',
    ADMIN: 'bg-leaf-100 text-leaf-600 ring-leaf-500/30',
  }[source];
  const label = { AI: 'AI', RULES: 'Rules', ADMIN: 'Overridden' }[source];
  return <span className={clsx(pill, styles, 'px-1.5 text-[10px] uppercase tracking-wide')}>{label}</span>;
}
