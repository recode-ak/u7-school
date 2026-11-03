import { describe, expect, test } from 'bun:test';
import { InProcEventBus } from '@u7-scl/core/infra';
import { legacyEventBus } from '@u7-scl/core/legacy-bridge';
import { StudentAr, StudentEvents } from '@u7-scl/domain/stream';
import type { EventEnvelope } from 'dmg-core/app';
import { streamLegacyInbound } from './legacy-inbound';

const USER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const STREAM = '6f4e2d3c-8b7a-4f9e-8a1b-b2c3d4e5f6a7';
const MODULE = '770e8400-e29b-41d4-a716-446655440003';
const STEP = '33333333-3333-4333-8333-333333333333';

/** Legacy-шина не ждёт промисы обработчиков — дать им отработать. */
const tick = () => Promise.resolve();

/** Шина DMG по карте stream и подписчик на Def; `invalid` — шпион onInvalid. */
function subscribed(def: typeof StudentEvents.enrolled) {
  const legacy = new InProcEventBus();
  const got: EventEnvelope[] = [];
  const invalid: string[] = [];
  legacyEventBus(legacy, {
    inbound: streamLegacyInbound,
    onInvalid: (m) => invalid.push(m),
  }).subscribe(def, async (e) => {
    got.push(e);
  });
  return { legacy, got, invalid };
}

describe('streamLegacyInbound', () => {
  test('student.enrolled от StudentAr приходит в конверте StudentEvents.enrolled', async () => {
    const { legacy, got, invalid } = subscribed(StudentEvents.enrolled);
    const ar = StudentAr.enroll(STREAM, USER, STEP, MODULE);
    const [event] = ar.flushEvents();
    if (!event) throw new Error('StudentAr.enroll не создал событие');
    legacy.publish(event);
    await tick();
    expect(invalid).toEqual([]);
    const id = ar.state.uuid;
    expect(got.map((e) => [e.name, e.payload, e.aggregateId])).toEqual([
      [
        'stream.student.enrolled',
        { studentId: id, userId: USER, streamId: STREAM, moduleId: MODULE },
        id,
      ],
    ]);
  });

  test('payload вне схемы Def — onInvalid, подписчик не вызван', async () => {
    const { legacy, got, invalid } = subscribed(StudentEvents.enrolled);
    const [event] = StudentAr.enroll(STREAM, USER, STEP, MODULE).flushEvents();
    if (!event) throw new Error('StudentAr.enroll не создал событие');
    legacy.publish({ ...event, payload: { ...event.payload, moduleId: 'x' } });
    await tick();
    expect(got).toEqual([]);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]).toContain('stream.student.enrolled');
  });
});
