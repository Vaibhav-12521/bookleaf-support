import type { Response } from 'express';
import type { RealtimeEvent, Role } from '@bookleaf/shared';

interface Client {
  res: Response;
  role: Role;
  authorId: string | null;
}

export interface Audience {
  authorId: string;
  adminsOnly?: boolean;
}

class SseHub {
  private clients = new Set<Client>();

  add(client: Client): () => void {
    this.clients.add(client);
    return () => this.clients.delete(client);
  }

  publish(event: RealtimeEvent, audience: Audience): void {
    const frame = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) {
      const allowed =
        client.role === 'ADMIN' || (!audience.adminsOnly && client.authorId === audience.authorId);
      if (allowed) client.res.write(frame);
    }
  }

  get size(): number {
    return this.clients.size;
  }
}

export const sseHub = new SseHub();
