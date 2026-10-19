import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeEvent } from '@bookleaf/shared';
import { keys } from '../api/endpoints';

type LiveStatus = 'connecting' | 'live' | 'offline';

const Ctx = createContext<LiveStatus>('connecting');

const EVENT_TYPES: RealtimeEvent['type'][] = ['ticket.created', 'ticket.updated', 'message.created'];

export function RealtimeProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>('connecting');

  useEffect(() => {
    if (!userId) return;
    const source = new EventSource('/api/v1/events');

    const handle = (e: MessageEvent<string>) => {
      const event = JSON.parse(e.data) as RealtimeEvent;
      void qc.invalidateQueries({ queryKey: keys.ticketLists });
      void qc.invalidateQueries({ queryKey: keys.ticket(event.ticketId) });
      void qc.invalidateQueries({ queryKey: keys.overview });
    };

    source.addEventListener('ready', () => {
      setStatus('live');
      void qc.invalidateQueries({ queryKey: keys.tickets });
      void qc.invalidateQueries({ queryKey: keys.overview });
    });
    source.onerror = () => setStatus(source.readyState === EventSource.CLOSED ? 'offline' : 'connecting');
    EVENT_TYPES.forEach((t) => source.addEventListener(t, handle));

    return () => {
      source.close();
      setStatus('connecting');
    };
  }, [userId, qc]);

  return <Ctx.Provider value={status}>{children}</Ctx.Provider>;
}

export const useLiveStatus = () => useContext(Ctx);

export function usePollingFallback(): number | false {
  return useLiveStatus() === 'live' ? false : 20_000;
}
