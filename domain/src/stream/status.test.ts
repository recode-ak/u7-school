import { describe, expect, test } from 'bun:test';
import { StreamStatus } from './status';

describe('StreamStatus (перечисление)', () => {
  test('определены все необходимые статусы', () => {
    expect(StreamStatus.ENROLLMENT as string).toBe('enrollment');
    expect(StreamStatus.ACTIVE as string).toBe('active');
    expect(StreamStatus.COMPLETED as string).toBe('completed');
    expect(StreamStatus.ARCHIVED as string).toBe('archived');
  });
});
