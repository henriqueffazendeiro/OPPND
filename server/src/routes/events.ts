import { Request, Response, Router } from 'express';
import { Message, MessageDocument } from '../models/Message';
import { buildSsePayload, serializeMessage } from '../lib/payload';
import { emitSseEvent } from './sse';

const router = Router();

type SentPayload = ReturnType<typeof buildSsePayload>;

router.post('/sent', async (req: Request, res: Response) => {
  const { messageId, userHash, subjectSnippet, threadHint } = req.body || {};
  if (!messageId || !userHash) {
    res.status(400).json({ error: 'Missing messageId or userHash' });
    return;
  }

  const now = new Date();
  try {
    const doc = await Message.findOneAndUpdate(
      { messageId, userHash },
      {
        $set: {
          subjectSnippet: subjectSnippet ?? '',
          threadHint: threadHint ?? null
        },
        $setOnInsert: {
          messageId,
          userHash,
          states: { sentAt: now }
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    if (!doc) {
      res.status(500).json({ error: 'Failed to upsert message' });
      return;
    }

    let shouldEmit = doc.createdAt.getTime() === doc.updatedAt.getTime();
    if (!doc.states.sentAt) {
      doc.states.sentAt = now;
      doc.markModified('states');
      await doc.save();
      shouldEmit = true;
    }

    if (shouldEmit) {
      emitSseEvent(userHash, buildSsePayload('sent', doc));
    }

    res.json(serializeMessage(doc));
  } catch (error) {
    console.error('[Oppnd] Failed to store sent event', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/history', async (req: Request, res: Response) => {
  const userHash = String(req.query.u || '');
  if (!userHash) {
    res.status(400).json({ error: 'Missing user hash' });
    return;
  }

  try {
    const docs = await Message.find({ userHash }).sort({ updatedAt: -1 }).limit(50).exec();
    res.json({ messages: docs.map(serializeMessage) });
  } catch (error) {
    console.error('[Oppnd] Failed to fetch history', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/:messageId', async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const userHash = String(req.query.u || '');
  if (!messageId || !userHash) {
    res.status(400).json({ error: 'Missing messageId or user hash' });
    return;
  }

  try {
    const removed = await Message.findOneAndDelete({ messageId, userHash }).exec();
    if (!removed) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    console.error('[Oppnd] Failed to delete event', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
