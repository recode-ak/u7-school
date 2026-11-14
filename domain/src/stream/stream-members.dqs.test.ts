import { describe, expect, it } from 'bun:test';
import { testUuid } from 'dmg-core/testing';
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
      withActivity(testUuid(1), 'enrolled'),
      withActivity(testUuid(2), 'active', 2),
      withActivity(testUuid(3), 'abandoned'),
      withActivity(testUuid(4), 'advanced', 2),
      withActivity(testUuid(5), 'not_advanced', 2),
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
      [testUuid(1), 'enrolled', false, true, false],
      [testUuid(2), 'active', false, true, false],
      [testUuid(3), 'abandoned', true, false, true],
      [testUuid(4), 'advanced', true, false, false],
      [testUuid(5), 'not_advanced', true, false, false],
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
      withActivity(testUuid(1), 'active', 3),
      withActivity(testUuid(2), 'active', 5),
    );
    expect(res.map((r) => r.studentId)).toEqual([testUuid(1), testUuid(2)]);
    expect(res[0]?.hoursSinceLastActivity).toBe(3);
  });

  it('студент без шагов — on_track, 0 часов', () => {
    const res = roster(withActivity(testUuid(1), 'active'));
    expect(res[0]).toMatchObject({
      lagLevel: 'on_track',
      hoursSinceLastActivity: 0,
    });
  });

  it('больше 7 суток — critical', () => {
    expect(lag(withActivity(testUuid(1), 'active', 7 * 24 + 1))).toEqual([
      'critical',
    ]);
  });

  it('больше 4 суток — lagging; ровно 4 суток — on_track', () => {
    expect(lag(withActivity(testUuid(1), 'active', 4 * 24 + 1))).toEqual([
      'lagging',
    ]);
    expect(lag(withActivity(testUuid(1), 'active', 4 * 24))).toEqual([
      'on_track',
    ]);
  });

  it('терминальные статусы — всегда on_track', () => {
    expect(
      lag(
        withActivity(testUuid(1), 'abandoned', 30 * 24),
        withActivity(testUuid(2), 'advanced', 30 * 24),
        withActivity(testUuid(3), 'not_advanced', 30 * 24),
      ),
    ).toEqual(['on_track', 'on_track', 'on_track']);
  });

  it('медиана: on_track по времени, но отстаёт на 30%+ → lagging', () => {
    // 1 ч и 50 ч: медиана 25.5, порог 33.15
    expect(
      lag(
        withActivity(testUuid(1), 'active', 1),
        withActivity(testUuid(2), 'active', 50),
      ),
    ).toEqual(['on_track', 'lagging']);
  });

  it('медиана считается только по учащимся: ушедшие с давней активностью её не сдвигают', () => {
    expect(
      lag(
        withActivity(testUuid(1), 'active', 10),
        withActivity(testUuid(2), 'abandoned', 3 * 24),
      ),
    ).toEqual(['on_track', 'on_track']);
  });
});
