import clsx from 'clsx';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useLiveStatus } from '../hooks/useRealtime';
import { useSession } from '../hooks/useSession';
import { AccountSwitcher } from './DemoAccounts';

const NAV = {
  AUTHOR: [
    { to: '/books', label: 'My Books' },
    { to: '/tickets', label: 'My Tickets' },
    { to: '/tickets/new', label: 'Get Help' },
  ],
  ADMIN: [{ to: '/admin/tickets', label: 'Ticket Queue' }],
} as const;

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <img src="/favicon.svg" alt="" className="size-7" />
      <span className={clsx('font-semibold tracking-tight text-brand-800', compact && 'sr-only sm:not-sr-only')}>
        BookLeaf <span className="font-normal text-slate-500">Support</span>
      </span>
    </div>
  );
}

function LiveIndicator() {
  const status = useLiveStatus();
  const label = { live: 'Live', connecting: 'Connecting…', offline: 'Offline: refreshing every 20s' }[status];
  return (
    <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:inline-flex" title="Real-time updates">
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

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 px-4 sm:h-14 sm:flex-nowrap sm:gap-x-6">
          <Logo compact />
          <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto pb-2 sm:order-none sm:mx-0 sm:w-auto sm:pb-0">
            {NAV[user.role].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  clsx(
                    'rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap',
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex h-14 items-center gap-2 sm:gap-4">
            <LiveIndicator />
            <div className="hidden text-right lg:block">
              <p className="text-sm font-medium text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-500">{user.role === 'ADMIN' ? 'BookLeaf team' : 'Author'}</p>
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
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
