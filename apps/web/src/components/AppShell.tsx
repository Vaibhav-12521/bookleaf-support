import clsx from 'clsx';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useLiveStatus } from '../hooks/useRealtime';
import { useSession } from '../hooks/useSession';
import { AccountSwitcher } from './DemoAccounts';

const NAV = {
  AUTHOR: [
    { to: '/books', label: 'My Books', icon: <BooksIcon /> },
    { to: '/tickets', label: 'My Tickets', icon: <InboxIcon /> },
    { to: '/tickets/new', label: 'Get Help', icon: <PlusIcon /> },
  ],
  ADMIN: [{ to: '/admin/tickets', label: 'Ticket Queue', icon: <QueueIcon /> }],
} as const;

export function Logo({ compact = false, tone = 'dark' }: { compact?: boolean; tone?: 'dark' | 'light' }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="size-8 rounded-lg" />
      <span
        className={clsx(
          'font-display text-lg leading-none font-semibold tracking-tight',
          tone === 'light' ? 'text-white' : 'text-brand-900',
          compact && 'sr-only sm:not-sr-only',
        )}
      >
        BookLeaf <span className={clsx('font-normal italic', tone === 'light' ? 'text-brand-300' : 'text-slate-500')}>Support</span>
      </span>
    </div>
  );
}

function LiveIndicator() {
  const status = useLiveStatus();
  const label = { live: 'Live', connecting: 'Connecting…', offline: 'Offline: refreshing every 20s' }[status];
  return (
    <span className="hidden items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200 sm:inline-flex" title="Real-time updates">
      <span
        className={clsx('size-2 rounded-full', {
          'bg-emerald-500': status === 'live',
          'animate-pulse bg-amber-400': status === 'connecting',
          'bg-slate-400': status === 'offline',
        })}
      />
      {label}
    </span>
  );
}

export function AppShell() {
  const { user, logout } = useSession();
  const navigate = useNavigate();
  if (!user) return null;
  const items = NAV[user.role];
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <div className="hidden bg-brand-950 lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="px-6 py-6">
            <Logo tone="light" />
          </div>
          <p className="px-6 pt-2 pb-2 text-[11px] font-semibold tracking-[0.14em] text-brand-300/70 uppercase">
            {user.role === 'ADMIN' ? 'Operations' : 'Your account'}
          </p>
          <nav aria-label="Primary" className="flex flex-col gap-1 px-3">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-white/10 text-white shadow-[inset_3px_0_0_var(--color-leaf-500)]' : 'text-brand-100/80 hover:bg-white/5 hover:text-white',
                  )
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto p-4">
            <div className="rounded-xl bg-white/5 p-4 text-xs leading-relaxed text-brand-100/80 ring-1 ring-white/10">
              <p className="font-display text-sm text-white">{user.role === 'ADMIN' ? 'Reply within 48 hours' : 'We reply within 48 hours'}</p>
              <p className="mt-1">
                {user.role === 'ADMIN'
                  ? 'Critical and overdue tickets are highlighted in the queue. AI drafts are a starting point; every reply is reviewed before it is sent.'
                  : 'Royalties are paid quarterly, within 45 days of each quarter ending. Balances under ₹1,000 roll over.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-paper/85 backdrop-blur">
          <div className="flex flex-wrap items-center gap-x-3 px-4 sm:px-6 lg:h-16 lg:flex-nowrap lg:px-10">
            <div className="lg:hidden">
              <Logo compact />
            </div>
            <nav aria-label="Primary" className="order-last -mx-1 flex w-full gap-1 overflow-x-auto pb-2 lg:hidden">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    clsx(
                      'rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap',
                      isActive ? 'bg-brand-900 text-white' : 'text-slate-600 hover:bg-slate-100',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="ml-auto flex h-14 items-center gap-2 sm:h-16 sm:gap-3">
              <LiveIndicator />
              <div className="hidden items-center gap-2.5 lg:flex">
                <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-brand-900 text-xs font-semibold text-white">
                  {initials}
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-medium text-slate-800">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.role === 'ADMIN' ? 'BookLeaf team' : 'Author'}</p>
                </div>
              </div>
              <AccountSwitcher />
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[100rem] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

function BooksIcon() {
  return (
    <Icon>
      <path d="M4 19V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1ZM9 6h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9M15.5 6.5l3-.8a1 1 0 0 1 1.2.7l3 11.6a1 1 0 0 1-.7 1.2l-3 .8" />
    </Icon>
  );
}
function InboxIcon() {
  return (
    <Icon>
      <path d="M4 13h4l1.5 3h5L16 13h4M5.5 5h13l2.5 8v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5l2.5-8Z" />
    </Icon>
  );
}
function PlusIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </Icon>
  );
}
function QueueIcon() {
  return (
    <Icon>
      <path d="M4 6h16M4 12h16M4 18h10" />
      <circle cx="19" cy="18" r="1.5" />
    </Icon>
  );
}
