import { Request, Response, Router } from 'express';
import { MessageDocument } from '../models/Message';

export type SseEventType = 'sent' | 'delivered' | 'read';

export interface SsePayload {
  type: SseEventType;
  messageId: string;
  at: string;
  states: MessageDocument['states'];
  subjectSnippet?: string;
  threadHint?: string;
}

const router = Router();

const clients = new Map<string, Set<Response>>();

router.get('/', (req: Request, res: Response) => {
  const userHash = String(req.query.u || '');
  if (!userHash) {
    res.status(400).json({ error: 'Missing user hash' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }
  res.write(`: connected ${new Date().toISOString()}\n\n`);

  const set = clients.get(userHash) ?? new Set<Response>();
  set.add(res);
  clients.set(userHash, set);

  const heartbeat = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`);
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    set.delete(res);
    if (set.size === 0) {
      clients.delete(userHash);
    }
    res.end();
  });
});

export function emitSseEvent(userHash: string, payload: SsePayload): void {
  const targets = clients.get(userHash);
  if (!targets || targets.size === 0) {
    return;
  }
  const data = JSON.stringify(payload);
  for (const res of targets) {
    res.write(`event: ${payload.type}\n`);
    res.write(`data: ${data}\n\n`);
  }
}

export default router;
