import { describe, expect, it } from 'bun:test';
import { expectErr, expectOk } from 'dmg-core/testing';
import { StreamAr } from './stream/stream.ar';
import { STEP_1, stored as streamStored } from './stream/stream.fixture';
import { StreamLaunchDcs } from './stream-launch.dcs';
import { StudentAr } from './student/student.ar';
import { issued, STUDENT, stored, T0, T1 } from './student/student.fixture';

// Перенос `StreamStudents.launch` (legacy-stream-students.test.ts) в DCS:
// сначала поток `activate`, затем каждому `enrolled` — activate, каждому без
// шагов (статус не важен) — первый шаг. Возвращает изменённых студентов.

const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '33333333-3333-4333-8333-333333333334';
const U4 = '44444444-4444-4444-8444-444444444445';
const ids = (list: readonly { uuid: string }[]) => list.map((s) => s.uuid);

const stream = (status: 'enrollment' | 'active' = 'enrollment', extra = {}) =>
  StreamAr.restore(streamStored(status, extra));
const student = (
  uuid: string,
  status: Parameters<typeof stored>[0],
  extra = {},
) => StudentAr.restore(stored(status, { uuid, ...extra }));

describe('StreamLaunchDcs.launch', () => {
  it('поток переходит в active', () => {
    const s = stream();
    expectOk(new StreamLaunchDcs(s, []).launch(T1));
    expect(s.snapshot().status).toBe('active');
  });

  it('поток не в наборе — STREAM_NOT_ENROLLING, студенты не тронуты', () => {
    const s = student(STUDENT, 'enrolled');
    expectErr(
      new StreamLaunchDcs(stream('active'), [s]).launch(T1),
      'STREAM_NOT_ENROLLING',
    );
    expect(s.snapshot().status).toBe('enrolled');
  });

  it('enrolled → active и получает первый шаг снимка', () => {
    const s = student(STUDENT, 'enrolled');
    const changed = expectOk(new StreamLaunchDcs(stream(), [s]).launch(T1));
    expect(ids(changed)).toEqual([STUDENT]);
    expect(s.snapshot().status).toBe('active');
    expect(s.snapshot().steps).toEqual([issued(STEP_1, T1)]);
    expect(s.snapshot().currentStepId).toBe(STEP_1);
  });

  it('active без шагов получает первый шаг, статус остаётся', () => {
    const s = student(STUDENT, 'active');
    const changed = expectOk(new StreamLaunchDcs(stream(), [s]).launch(T1));
    expect(ids(changed)).toEqual([STUDENT]);
    expect(s.snapshot().status).toBe('active');
    expect(s.snapshot().steps).toHaveLength(1);
  });

  it('студент с шагами не меняется и не возвращается', () => {
    const s = student(STUDENT, 'active', { steps: [issued(STEP_1, T0)] });
    const changed = expectOk(new StreamLaunchDcs(stream(), [s]).launch(T1));
    expect(changed).toEqual([]);
    expect(s.snapshot().steps).toEqual([issued(STEP_1, T0)]);
  });

  it('первый шаг выдаётся и ушедшему без шагов (статус не учитывается, как в legacy)', () => {
    const s = student(STUDENT, 'abandoned');
    const changed = expectOk(new StreamLaunchDcs(stream(), [s]).launch(T1));
    expect(ids(changed)).toEqual([STUDENT]);
    expect(s.snapshot().status).toBe('abandoned');
    expect(s.snapshot().steps).toEqual([issued(STEP_1, T1)]);
  });

  it('смесь студентов: возвращаются только изменённые, в порядке входа', () => {
    const a = student(STUDENT, 'enrolled');
    const b = student(U2, 'active', { steps: [issued(STEP_1, T0)] });
    const c = student(U3, 'enrolled', { steps: [issued(STEP_1, T0)] });
    const d = student(U4, 'advanced', { steps: [issued(STEP_1, T0)] });
    const changed = expectOk(
      new StreamLaunchDcs(stream(), [a, b, c, d]).launch(T1),
    );
    expect(ids(changed)).toEqual([STUDENT, U3]);
    expect(c.snapshot().status).toBe('active');
    expect(d.snapshot().status).toBe('advanced');
  });

  it('первого шага в потоке нет — поток активен, студенты не меняются', () => {
    const s = student(STUDENT, 'enrolled');
    const flow = stream('enrollment', { contentSnapshot: [] });
    const changed = expectOk(new StreamLaunchDcs(flow, [s]).launch(T1));
    expect(changed).toEqual([]);
    expect(flow.snapshot().status).toBe('active');
    expect(s.snapshot().status).toBe('enrolled');
    expect(s.snapshot().steps).toEqual([]);
  });
});
