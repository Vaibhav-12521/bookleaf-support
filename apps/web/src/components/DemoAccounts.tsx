import clsx from 'clsx';
import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Role } from '@bookleaf/shared';
import { errorMessage } from '../api/client';
import { useSession } from '../hooks/useSession';
import { homeFor } from '../lib/routes';
import { Spinner } from './ui';

export const DEMO_ENABLED = import.meta.env.VITE_DEMO_MODE !== 'false';

interface DemoAccount {
  email: string;
  password: string;
  name: string;
  role: Role;
  scenario: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: 'ananya.reddy@email.com', password: 'Author@123', name: 'Ananya Reddy', role: 'AUTHOR', scenario: 'Royalty never paid, critical ticket' },
  { email: 'sneha.kulkarni@email.com', password: 'Author@123', name: 'Sneha Kulkarni', role: 'AUTHOR', scenario: 'Book in production, ongoing thread' },
  { email: 'priya.sharma@email.com', password: 'Author@123', name: 'Priya Sharma', role: 'AUTHOR', scenario: 'No tickets yet: raise the first one' },
  { email: 'lead@bookleaf.demo', password: 'Admin@123', name: 'Aisha Khan', role: 'ADMIN', scenario: 'Support lead: queue, AI drafts' },
];

function useDemoSignIn(onDone: () => void) {
  const { login } = useSession();
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (account: DemoAccount) => {
    setPending(account.email);
    setError(null);
    try {
      const user = await login({ email: account.email, password: account.password });
      onDone();
      navigate(homeFor(user.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not sign in to the demo account.'));
    } finally {
      setPending(null);
    }
  };
  return { signIn, pending, error };
}

function useDismiss(open: boolean, close: () => void, ref: RefObject<HTMLElement | null>, trigger: RefObject<HTMLButtonElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        trigger.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, close, ref, trigger]);
}

function AccountMenu({
  id,
  currentEmail,
  onDone,
  className,
}: {
  id: string;
  currentEmail?: string;
  onDone: () => void;
  className?: string;
}) {
  const { signIn, pending, error } = useDemoSignIn(onDone);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);

  return (
    <div id={id} role="menu" aria-label="Demo accounts" className={clsx('rounded-lg border border-slate-200 bg-white p-2 shadow-lg', className)}>
      <p className="px-2 pt-1 pb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Demo accounts</p>
      {DEMO_ACCOUNTS.map((a, i) => {
        const current = a.email === currentEmail;
        return (
          <button
            key={a.email}
            ref={i === 0 ? first : undefined}
            type="button"
            role="menuitem"
            disabled={current || pending !== null}
            onClick={() => signIn(a)}
            className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50 focus-visible:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
          >
            <span
              className={clsx(
                'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
                a.role === 'ADMIN' ? 'bg-brand-700 text-white' : 'bg-leaf-100 text-leaf-600',
              )}
            >
              {a.role === 'ADMIN' ? 'Team' : 'Author'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-800">
                {a.name}
                {current && <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span>}
              </span>
              <span className="block text-xs text-slate-500">{a.scenario}</span>
            </span>
            {pending === a.email && <Spinner className="mt-1 size-4 text-slate-400" />}
          </button>
        );
      })}
      {error && (
        <p role="alert" className="px-2 pt-1 text-xs text-red-600">
          {error}
        </p>
      )}
      <p className="border-t border-slate-100 px-2 pt-2 mt-1 text-xs text-slate-500">
        Any author in the dataset can also sign in with their email and <code>Author@123</code>.
      </p>
    </div>
  );
}

export function DemoLauncher() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, root, trigger);

  if (!DEMO_ENABLED) return null;
  return (
    <div ref={root} className="fixed right-4 bottom-4 z-30 flex flex-col items-end gap-2 sm:right-6 sm:bottom-6">
      {open && <AccountMenu id={menuId} onDone={close} className="w-80 max-w-[calc(100vw-2rem)]" />}
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-brand-800"
      >
        <PlayIcon />
        Try the demo
      </button>
    </div>
  );
}

export function AccountSwitcher() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, root, trigger);

  if (!DEMO_ENABLED) return null;
  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Switch demo account"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
      >
        <SwitchIcon />
        <span className="hidden sm:inline">Switch</span>
      </button>
      {open && <AccountMenu id={menuId} currentEmail={user?.email} onDone={close} className="fixed inset-x-4 top-16 z-30 sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-80" />}
    </div>
  );
}

const PlayIcon = () => (
  <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden>
    <path d="M6.3 3.3A1 1 0 0 0 4.8 4.2v11.6a1 1 0 0 0 1.5.9l9.3-5.8a1 1 0 0 0 0-1.8L6.3 3.3Z" />
  </svg>
);

const SwitchIcon = () => (
  <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <path d="M4 7h11l-3-3M16 13H5l3 3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
