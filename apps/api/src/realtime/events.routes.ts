import { Router } from 'express';
import { currentUser } from '../middleware/authenticate';
import { sseHub } from './sseHub';

export const eventsRouter = Router();

const HEARTBEAT_MS = 25_000;

eventsRouter.get('/', (req, res) => {
  const user = currentUser(req);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');
  res.write(`event: ready\ndata: {}\n\n`);

  const remove = sseHub.add({ res, role: user.role, authorId: user.authorId });
  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

  req.on('close', () => {
    clearInterval(heartbeat);
    remove();
  });
});
