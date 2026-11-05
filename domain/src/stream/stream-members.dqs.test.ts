import { describe, expect, it } from 'bun:test';
import { StreamAr } from './stream/stream.ar';
import { stored as streamStored } from './stream/stream.fixture';
import { StreamMembersDqs } from './stream-members.dqs';
import { StudentAr } from './student/student.ar';
import { stored } from './student/student.fixture';
import type { StudentState } from './student/student.state';

// `facts` — вход правила `studentsSettled` (бывш. порт `StreamStudents.factsOf`,
// legacy-stream-students.test.ts); `roster` — `categorizeStudents` (stream-ds.test.ts):
// отставание считается по всем студентам, медиана — только по учащимся.

const HOUR = 3_600_000;
const AT = Date.UTC(2026, 7, 1, 12);
const STEP = '33333333-3333-4333-8333-333333333333';
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

const hoursAgo = (hours: number) => AT - hours * HOUR;
const withActivity = (
  uuid: string,
  status: StudentState['status'],
  lastHoursAgo?: number,
) =>
  StudentAr.restore(
    stored(status, {
      uuid,
      userId: `11111111-1111-4111-8111-11111111111${uuid.at(-1)}`,
      steps:
        lastHoursAgo === undefined
          ? []
          : [
              {
                stepId: STEP,
                status: 'completed',
                issuedAt: hoursAgo(lastHoursAgo + 1),
                completedAt: hoursAgo(lastHoursAgo),
              },
            ],
    }),
  );

const stream = StreamAr.restore(streamStored('active'));

describe('StreamMembersDqs.facts', () => {
  it('факт по каждому студенту: статус, settled, inProgress, neverStarted', () => {
    const facts = new StreamMembersDqs(stream, [
      withActivity(id(1), 'enrolled'),
      withActivity(id(2), 'active', 2),
      withActivity(id(3), 'abandoned'),
      withActivity(id(4), 'advanced', 2),
      withActivity(id(5), 'not_advanced', 2),
    ]).facts();
    expect(
      facts.map((f) => [
        f.studentId,
        f.status,
        f.settled,
        f.inProgress,
        f.neverStarted,
      ]),
    ).toEqual([
      [id(1), 'enrolled', false, true, false],
      [id(2), 'active', false, true, false],
      [id(3), 'abandoned', true, false, true],
      [id(4), 'advanced', true, false, false],
      [id(5), 'not_advanced', true, false, false],
    ]);
    expect(facts[0]?.userId).toBe(`11111111-1111-4111-8111-111111111111`);
  });
});

describe('StreamMembersDqs.roster', () => {
  const roster = (...students: StudentAr[]) =>
    new StreamMembersDqs(stream, students).roster(AT);
  const lag = (...students: StudentAr[]) =>
    roster(...students).map((r) => r.lagLevel);

  it('запись на студента, порядок входа, hoursSinceLastActivity', () => {
    const res = roster(
      withActivity(id(1), 'active', 3),
      withActivity(id(2), 'active', 5),
    );
    expect(res.map((r) => r.studentId)).toEqual([id(1), id(2)]);
    expect(res[0]?.hoursSinceLastActivity).toBe(3);
  });

  it('студент без шагов — on_track, 0 часов', () => {
    const res = roster(withActivity(id(1), 'active'));
    expect(res[0]).toMatchObject({
      lagLevel: 'on_track',
      hoursSinceLastActivity: 0,
    });
  });

  it('больше 7 суток — critical', () => {
    expect(lag(withActivity(id(1), 'active', 7 * 24 + 1))).toEqual([
      'critical',
    ]);
  });

  it('больше 4 суток — lagging; ровно 4 суток — on_track', () => {
    expect(lag(withActivity(id(1), 'active', 4 * 24 + 1))).toEqual(['lagging']);
    expect(lag(withActivity(id(1), 'active', 4 * 24))).toEqual(['on_track']);
  });

  it('терминальные статусы — всегда on_track', () => {
    expect(
      lag(
        withActivity(id(1), 'abandoned', 30 * 24),
        withActivity(id(2), 'advanced', 30 * 24),
        withActivity(id(3), 'not_advanced', 30 * 24),
      ),
    ).toEqual(['on_track', 'on_track', 'on_track']);
  });

  it('медиана: on_track по времени, но отстаёт на 30%+ → lagging', () => {
    // 1 ч и 50 ч: медиана 25.5, порог 33.15
    expect(
      lag(withActivity(id(1), 'active', 1), withActivity(id(2), 'active', 50)),
    ).toEqual(['on_track', 'lagging']);
  });

  it('медиана считается только по учащимся: ушедшие с давней активностью её не сдвигают', () => {
    expect(
      lag(
        withActivity(id(1), 'active', 10),
        withActivity(id(2), 'abandoned', 3 * 24),
      ),
    ).toEqual(['on_track', 'on_track']);
  });
});
