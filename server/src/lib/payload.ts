import { MessageDocument } from '../models/Message';
import { SseEventType, SsePayload } from '../routes/sse';

export function buildSsePayload(type: SseEventType, doc: MessageDocument): SsePayload {
  const states = doc.states || {};
  const lastAt = states.readAt ?? states.deliveredAt ?? states.sentAt ?? new Date();
  const iso = lastAt instanceof Date ? lastAt.toISOString() : new Date(lastAt).toISOString();
  return {
    type,
    messageId: doc.messageId,
    at: iso,
    states,
    subjectSnippet: doc.subjectSnippet,
    threadHint: doc.threadHint
  };
}

export function serializeMessage(doc: MessageDocument) {
  const plain = doc.toObject({ getters: true });
  return {
    messageId: plain.messageId,
    userHash: plain.userHash,
    subjectSnippet: plain.subjectSnippet,
    threadHint: plain.threadHint,
    states: {
      sentAt: plain.states?.sentAt ?? null,
      deliveredAt: plain.states?.deliveredAt ?? null,
      readAt: plain.states?.readAt ?? null
    },
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
}
