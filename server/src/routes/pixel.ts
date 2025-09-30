import { Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Message } from '../models/Message';
import { buildSsePayload } from '../lib/payload';
import { emitSseEvent } from './sse';

const router = Router();

const pixelLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
});

const PIXEL_BUFFER = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');

router.get('/', pixelLimiter, async (req: Request, res: Response) => {
  const messageId = String(req.query.mid || '');
  const userHash = String(req.query.u || '');
  if (!messageId || !userHash) {
    res.status(400).send('Missing parameters');
    return;
  }

  const now = new Date();
  let eventType: 'delivered' | 'read' | null = null;

  try {
    const doc = await Message.findOne({ messageId, userHash }).exec();
    if (!doc) {
      const created = await Message.create({
        messageId,
        userHash,
        states: {
          sentAt: now,
          deliveredAt: now
        }
      });
      emitSseEvent(userHash, buildSsePayload('delivered', created));
    } else {
      if (!doc.states.sentAt) {
        doc.states.sentAt = now;
      }
      if (!doc.states.deliveredAt) {
        doc.states.deliveredAt = now;
        eventType = 'delivered';
      } else {
        doc.states.readAt = now;
        eventType = 'read';
      }
      await doc.save();
      emitSseEvent(userHash, buildSsePayload(eventType ?? 'delivered', doc));
    }
  } catch (error) {
    console.error('[Oppnd] Failed to process pixel hit', error);
  }

  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.setHeader('Content-Length', PIXEL_BUFFER.length.toString());
  res.status(200).end(PIXEL_BUFFER);
});

export default router;
