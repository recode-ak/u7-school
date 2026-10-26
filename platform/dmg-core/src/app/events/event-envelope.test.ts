import { describe, expect, test } from 'bun:test';
import { Trace } from '#core/kernel/trace/trace';
import { TaskAr, TaskArDef } from '#core/testing/example/todo/index';
import { expectOk, recordingBus } from '#core/testing/index';
import type { Repository } from '../uow/repository';
import { UnitOfWork } from '../uow/unit-of-work';
import type { EventEnvelope } from './event-envelope';
import { InProcOutbox } from './outbox';

const AT = Date.UTC(2026, 9, 18, 12, 0);
const TASK = 'a1b2c3d4-0000-4000-8000-00000000000a';
const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';

const repo: Repository<TaskAr> = { aggregate: TaskArDef, save: async () => {} };

/** Конверты одной фиксации UoW со следом `trace`. */
async function envelopes(trace: Trace): Promise<EventEnvelope[]> {
  const published: EventEnvelope[] = [];
  const uow = new UnitOfWork({
    outbox: new InProcOutbox(recordingBus(published)),
    clock: () => AT,
    trace,
  });
  const ar = expectOk(
    TaskAr.create({ uuid: TASK, ownerId: OWNER, title: 'Задача' }, AT),
  );
  expectOk(ar.complete(AT));
  uow.register(ar, repo);
  expectOk(await uow.commit());
  return published;
}

describe('EventEnvelope — круг через JSON (D-46)', () => {
  test('конверт UoW переживает JSON без потерь и undefined-полей', async () => {
    const traces = [
      Trace.fromRequest({ requestId: 'r-1', channel: { name: 'web' } }),
      Trace.fromEvent({ eventId: 'e-0', correlationId: 'c-0' }),
      Trace.forJob({ name: 'archiveDoneTasks' }),
    ];
    for (const trace of traces) {
      const published = await envelopes(trace);
      expect(published).toHaveLength(2);
      for (const envelope of published) {
        expect(JSON.parse(JSON.stringify(envelope))).toStrictEqual(envelope);
        expect(typeof envelope.occurredAt).toBe('number');
      }
    }
  });
});
