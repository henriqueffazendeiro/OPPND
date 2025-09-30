import crypto from 'crypto';

export function buildMessageId(seed?: string): string {
  const base = seed ?? crypto.randomUUID();
  const normalized = base.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `${normalized}${Date.now().toString(36)}`;
}

export function hashUserIdentifier(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export type MessageState = {
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
};

export function mergeState(existing: MessageState, updates: Partial<MessageState>): MessageState {
  return {
    ...existing,
    ...updates
  };
}
