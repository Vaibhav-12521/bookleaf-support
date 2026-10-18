import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Role } from '@bookleaf/shared';
import { AppShell } from './components/AppShell';
import { LoadingState } from './components/ui';
import { RealtimeProvider } from './hooks/useRealtime';
import { useSession } from './hooks/useSession';
import { homeFor } from './lib/routes';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { BooksPage } from './pages/author/BooksPage';
import { NewTicketPage } from './pages/author/NewTicketPage';
import { TicketDetailPage } from './pages/author/TicketDetailPage';
import { TicketsPage } from './pages/author/TicketsPage';
import { AdminTicketPage } from './pages/admin/AdminTicketPage';
import { QueuePage } from './pages/admin/QueuePage';

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useSession();
  const location = useLocation();
  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

export function App() {
  const { user, loading } = useSession();
  if (loading) return <LoadingState label="Starting up…" />;

  return (
    <RealtimeProvider userId={user?.id ?? null}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={homeFor(user.role)} replace /> : <LoginPage />} />
        <Route element={<RequireRole role="AUTHOR"><AppShell /></RequireRole>}>
          <Route path="/books" element={<BooksPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/new" element={<NewTicketPage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
        </Route>
        <Route element={<RequireRole role="ADMIN"><AppShell /></RequireRole>}>
          <Route path="/admin/tickets" element={<QueuePage />} />
          <Route path="/admin/tickets/:id" element={<AdminTicketPage />} />
        </Route>
        <Route path="/" element={<Navigate to={user ? homeFor(user.role) : '/login'} replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </RealtimeProvider>
  );
}
