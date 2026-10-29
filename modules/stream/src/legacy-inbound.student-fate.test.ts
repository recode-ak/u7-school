import { describe, expect, test } from 'bun:test';
import { InProcEventBus } from '@u7-scl/core/infra';
import { legacyEventBus } from '@u7-scl/core/legacy-bridge';
import { StudentEvents } from '@u7-scl/domain/stream/contract';
import type { EventEnvelope } from 'dmg-core/app';
import { streamLegacyInbound } from './legacy-inbound';

// Маршруты student.completed / student.abandoned (потребитель — peer-review).
// Форма legacy-событий — domain/src/stream/student/events.ts.

const STUDENT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const STREAM = '6f4e2d3c-8b7a-4f9e-8a1b-b2c3d4e5f6a7';
const MODULE = '770e8400-e29b-41d4-a716-446655440003';
const tick = () => Promise.resolve();

function subscribed(
  def: typeof StudentEvents.completed | typeof StudentEvents.abandoned,
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

const legacyEvent = (eventName: string, payload: Record<string, unknown>) => ({
  eventId: crypto.randomUUID(),
  eventName,
  occurredAt: '2026-09-20T10:00',
  aggregateName: 'Student',
  aggregateId: STUDENT,
  payload,
});

describe('streamLegacyInbound: судьба студента', () => {
  test('два новых маршрута в карте: student.completed и student.abandoned', () => {
    const routes = Object.fromEntries(
      streamLegacyInbound.map((r) => [r.legacy, r.def]),
    );
    expect(StudentEvents.completed).toBeDefined();
    expect(StudentEvents.abandoned).toBeDefined();
    expect(routes['student.completed']).toBe(StudentEvents.completed);
    expect(routes['student.abandoned']).toBe(StudentEvents.abandoned);
  });

  test('student.completed приходит в конверте StudentEvents.completed', async () => {
    const { legacy, got, invalid } = subscribed(StudentEvents.completed);
    const payload = {
      studentId: STUDENT,
      userId: USER,
      streamId: STREAM,
      moduleId: MODULE,
      outcome: 'not_advanced',
    };
    legacy.publish(legacyEvent('student.completed', payload) as never);
    await tick();
    expect(invalid).toEqual([]);
    expect(got.map((e) => [e.name, e.payload, e.aggregateId])).toEqual([
      ['stream.student.completed', payload, STUDENT],
    ]);
  });

  test('student.abandoned приходит в конверте StudentEvents.abandoned', async () => {
    const { legacy, got, invalid } = subscribed(StudentEvents.abandoned);
    const payload = {
      studentId: STUDENT,
      userId: USER,
      streamId: STREAM,
      who: 'mentor',
      cause: 'by_mentor',
    };
    legacy.publish(legacyEvent('student.abandoned', payload) as never);
    await tick();
    expect(invalid).toEqual([]);
    expect(got.map((e) => [e.name, e.payload])).toEqual([
      ['stream.student.abandoned', payload],
    ]);
  });

  test('payload вне схемы Def — onInvalid, подписчик не вызван', async () => {
    const { legacy, got, invalid } = subscribed(StudentEvents.completed);
    legacy.publish(
      legacyEvent('student.completed', {
        studentId: STUDENT,
        userId: USER,
        streamId: STREAM,
        moduleId: MODULE,
        outcome: 'unknown',
      }) as never,
    );
    await tick();
    expect(got).toEqual([]);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]).toContain('stream.student.completed');
  });
});
