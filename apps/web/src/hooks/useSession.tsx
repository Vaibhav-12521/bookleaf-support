import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, SessionUser } from '@bookleaf/shared';
import { api, keys } from '../api/endpoints';
import { UNAUTHORIZED_EVENT } from '../api/client';

interface SessionContext {
  user: SessionUser | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<SessionUser>;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionContext | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: keys.me,
    queryFn: () => api.me().then((r) => r.user).catch(() => null),
    staleTime: Infinity,
  });

  const resetCache = (user: SessionUser | null) => {
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== keys.me[0] });
    qc.setQueryData(keys.me, user);
  };

  const login = async (input: LoginInput) => {
    const { user } = await api.login(input);
    resetCache(user);
    return user;
  };

  const logout = async () => {
    await api.logout().catch(() => undefined);
    resetCache(null);
  };

  useEffect(() => {
    const onUnauthorized = () => qc.setQueryData(keys.me, null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [qc]);

  return (
    <Ctx.Provider value={{ user: me.data ?? null, loading: me.isPending, login, logout }}>{children}</Ctx.Provider>
  );
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
