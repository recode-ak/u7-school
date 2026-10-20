import { describe, expect, test } from 'bun:test';
import { InProcEventBus } from '@u7-scl/core/infra';
import { legacyEventBus } from '@u7-scl/core/legacy-bridge';
import type { ContentSnapshot } from '@u7-scl/domain/course';
import {
  StreamAr,
  StreamEvents,
  StudentAr,
  StudentEvents,
} from '@u7-scl/domain/stream';
import type { EventEnvelope } from 'dmg-core/app';
import { streamLegacyInbound } from './legacy-inbound';

const USER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const STREAM = '6f4e2d3c-8b7a-4f9e-8a1b-b2c3d4e5f6a7';
const MODULE = '770e8400-e29b-41d4-a716-446655440003';
const STEP = '33333333-3333-4333-8333-333333333333';

const snapshot: ContentSnapshot = [
  {
    projectId: '11111111-1111-4111-8111-111111111111',
    projectTitle: 'Введение',
    lessons: [
      {
        lessonId: '22222222-2222-4222-8222-222222222222',
        lessonTitle: 'Урок 1',
        stepIds: [STEP],
      },
    ],
  },
];

const streamInput = {
  title: 'Поток JS-1',
  description: 'Основной поток курса JavaScript',
  mentorId: USER,
  moduleId: MODULE,
  startDate: '2026-06-01T12:00',
};

/** Legacy-шина не ждёт промисы обработчиков — дать им отработать. */
const tick = () => Promise.resolve();

/** Шина DMG по карте stream и подписчик на Def; `invalid` — шпион onInvalid. */
function subscribed(
  def: typeof StudentEvents.enrolled | typeof StreamEvents.created,
) {
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

  test('stream.created от StreamAr приходит в конверте StreamEvents.created', async () => {
    const { legacy, got, invalid } = subscribed(StreamEvents.created);
    const ar = StreamAr.create(streamInput, snapshot);
    const [event] = ar.flushEvents();
    if (!event) throw new Error('StreamAr.create не создал событие');
    legacy.publish(event);
    await tick();
    expect(invalid).toEqual([]);
    expect(got.map((e) => [e.name, e.payload, e.aggregateId])).toEqual([
      [
        'stream.stream.created',
        { streamId: ar.state.uuid, moduleId: MODULE },
        ar.state.uuid,
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
