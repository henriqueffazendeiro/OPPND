import { buildMessageId, hashUserIdentifier, mergeState } from '../src/utils/id';

describe('id utils', () => {
  test('buildMessageId returns unique ids', () => {
    const first = buildMessageId('ExampleSeed');
    const second = buildMessageId('ExampleSeed');
    expect(first).not.toEqual(second);
    expect(first).toMatch(/exampleseed/);
  });

  test('hashUserIdentifier returns deterministic hash', () => {
    const input = 'user@example.com';
    const hash1 = hashUserIdentifier(input);
    const hash2 = hashUserIdentifier(input);
    expect(hash1).toEqual(hash2);
    expect(hash1).toHaveLength(64);
  });

  test('mergeState merges states', () => {
    const base = { sentAt: new Date('2023-01-01T00:00:00Z') };
    const merged = mergeState(base, { deliveredAt: new Date('2023-01-02T00:00:00Z') });
    expect(merged.sentAt?.toISOString()).toEqual('2023-01-01T00:00:00.000Z');
    expect(merged.deliveredAt?.toISOString()).toEqual('2023-01-02T00:00:00.000Z');
  });
});
