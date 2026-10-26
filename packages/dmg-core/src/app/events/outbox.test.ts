import { describe, expect, test } from 'bun:test';
import { recordingBus } from '#core/testing/index';
import type { EventEnvelope } from './event-envelope';
import { InProcOutbox } from './outbox';

const envelope = (eventId: string): EventEnvelope => ({
  name: 'todo.task.created',
  payload: {},
  eventId,
  occurredAt: 0,
  aggregateId: 'a-1',
  cause: { kind: 'request', requestId: 'r-1' },
  correlationId: 'c-1',
});

describe('InProcOutbox', () => {
  test('публикует партию в шину сразу и по порядку', async () => {
    const published: EventEnvelope[] = [];
    const outbox = new InProcOutbox(recordingBus(published));
    await outbox.put([envelope('e-1'), envelope('e-2')]);
    expect(published.map((e) => e.eventId)).toEqual(['e-1', 'e-2']);
  });
});
