import { beforeEach, describe, expect, it } from 'bun:test';
import {
  InactivitySweepJobDef,
  NOTICE_EVERY_DAYS,
  REMOVE_AFTER_DAYS,
  WARN_AFTER_DAYS,
} from '@u7-scl/domain/stream';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { Trace } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';
import {
  DAY,
  done,
  issued,
  makeEnv,
  STEP_1,
  STREAM,
  STUDENT,
  studentState,
  T0,
  USER,
} from '../uc/student-uc.fixture';
import { InactivitySweepJob } from './inactivity-sweep.job';

// Перенос `api/student/inactivity-sweep-job.test.ts`: пороги 5/7, повтор через
// 2 дня, сброс при activate/completeStep, `wasWarned` до прогона, сбой одной
// записи не прерывает обход. Job доменный: пользователя и ментора не читает,
// события — по одному на запись (UoW).

const OTHER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BROKEN = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
let env: ReturnType<typeof makeEnv>;

/** Прогон Job в момент `T0 + days`; события шины — в `env.ctx.published`. */
async function sweepAt(days: number) {
  env.ctx.setNow(T0 + days * DAY);
  const job = new InactivitySweepJob(env.deps, StreamModuleDef);
  return expectOk(await job.handle(Trace.forJob(InactivitySweepJobDef)));
}
const names = () => env.ctx.published.map((e) => e.name);
const stored = (id = STUDENT) => env.students.restoredOrThrow(id).snapshot();

beforeEach(() => {
  env = makeEnv();
});

describe('InactivitySweepJob — пороги', () => {
  it('константы: WARN=5, REMOVE=7, NOTICE_EVERY=2', () => {
    expect(WARN_AFTER_DAYS).toBe(5);
    expect(REMOVE_AFTER_DAYS).toBe(7);
    expect(NOTICE_EVERY_DAYS).toBe(2);
  });

  it('4 дня — тихо', async () => {
    env.seedStudents(studentState('enrolled'));
    await sweepAt(4);
    expect(env.ctx.published).toEqual([]);
    expect(env.students.saved).toEqual([]);
  });

  it('5 дней без шагов (от enrolledAt): предупреждение студенту, маркер записан', async () => {
    env.seedStudents(studentState('enrolled'));

    await sweepAt(5);

    expect(env.ctx.published.map((e) => [e.name, e.payload])).toEqual([
      [
        'stream.student.inactivityWarning',
        { studentId: STUDENT, userId: USER, streamId: STREAM, days: 5 },
      ],
    ]);
    expect(stored().notices).toEqual([
      { kind: 'inactivity_warn_student', sentAt: T0 + 5 * DAY },
    ]);
  });

  it('7 дней впервые: студенту и ментору, wasWarned = false', async () => {
    env.seedStudents(studentState('active'));

    await sweepAt(7);

    expect(names()).toEqual([
      'stream.student.inactivityWarning',
      'stream.student.inactivityRemoveCandidate',
    ]);
    expect(env.ctx.published[1]?.payload).toEqual({
      studentId: STUDENT,
      userId: USER,
      streamId: STREAM,
      days: 7,
      wasWarned: false,
    });
  });

  it('wasWarned = true, если предупреждение уходило раньше (маркер до прогона)', async () => {
    env.seedStudents(studentState('active'));
    await sweepAt(5);
    env.ctx.published.length = 0;

    await sweepAt(7);

    expect(names()).toEqual([
      'stream.student.inactivityWarning',
      'stream.student.inactivityRemoveCandidate',
    ]);
    expect(env.ctx.published[1]?.payload).toMatchObject({
      days: 7,
      wasWarned: true,
    });
  });
});

describe('InactivitySweepJob — повтор «через 2 дня»', () => {
  it('на 5-й — студенту; на 6-й тихо; на 7-й студенту и ментору; на 8-й тихо; на 9-й оба', async () => {
    env.seedStudents(studentState('active'));
    const seen: string[][] = [];
    for (const day of [5, 6, 7, 8, 9]) {
      env.ctx.published.length = 0;
      await sweepAt(day);
      seen.push(names().map((n) => n.split('.').at(-1) ?? n));
    }
    expect(seen).toEqual([
      ['inactivityWarning'],
      [],
      ['inactivityWarning', 'inactivityRemoveCandidate'],
      [],
      ['inactivityWarning', 'inactivityRemoveCandidate'],
    ]);
  });

  it('повторный прогон в тот же момент ничего не публикует и не пишет', async () => {
    env.seedStudents(studentState('active'));
    await sweepAt(5);
    env.ctx.published.length = 0;
    const writes = env.students.saved.length;

    await sweepAt(5);

    expect(env.ctx.published).toEqual([]);
    expect(env.students.saved).toHaveLength(writes);
  });
});

describe('InactivitySweepJob — отбор и сброс', () => {
  it('дни считаются от последней активности по шагам', async () => {
    env.seedStudents(
      studentState('active', { steps: [done(STEP_1, T0, T0 + 3 * DAY)] }),
    );
    await sweepAt(7); // 4 дня от шага
    expect(env.ctx.published).toEqual([]);
    await sweepAt(8);
    expect(names()).toEqual(['stream.student.inactivityWarning']);
  });

  it('терминальные и чужие по статусу записи не обходятся (findStudying)', async () => {
    env.seedStudents(
      studentState('abandoned'),
      studentState('advanced', { uuid: OTHER }),
      studentState('not_advanced', { uuid: BROKEN }),
    );
    expect(await sweepAt(30)).toMatchObject({ failed: 0 });
    expect(env.ctx.published).toEqual([]);
  });

  it('возобновление учёбы сбрасывает цепочку: шаг в день 5 → предупреждения снова ждут порога', async () => {
    env.seedStudents(studentState('active', { steps: [issued(STEP_1, T0)] }));
    await sweepAt(5);
    env.ctx.published.length = 0;
    const ar = env.students.restoredOrThrow(STUDENT);
    ar.completeStep(STEP_1, undefined, T0 + 5 * DAY);
    await env.students.save(ar);

    await sweepAt(9); // 4 дня от завершённого шага
    expect(env.ctx.published).toEqual([]);
    expect(stored().notices ?? []).toEqual([]);
  });
});

describe('InactivitySweepJob — отказоустойчивость', () => {
  it('сбой записи одной студенческой записи — остальные обработаны, failed: 1, сбой в логе', async () => {
    env.seedStudents(
      studentState('active', { uuid: BROKEN }),
      studentState('active', {
        uuid: OTHER,
        userId: '99999999-9999-4999-8999-999999999999',
      }),
    );
    env.students.failOn(BROKEN);

    const report = await sweepAt(5);

    expect(report).toMatchObject({ failed: 1 });
    expect(
      env.ctx.published.map(
        (e) => (e.payload as { studentId: string }).studentId,
      ),
    ).toEqual([OTHER]);
    expect(env.ctx.logs).toContainEqual(
      expect.objectContaining({ level: 'error', source: 'inactivitySweep' }),
    );
  });
});
