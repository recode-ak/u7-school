import { beforeEach, describe, expect, it } from 'bun:test';
import { InactivitySweepJobDef } from '@u7-scl/domain/stream';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { Trace } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';
import {
  DAY,
  makeEnv,
  STREAM,
  STUDENT,
  studentState,
  T0,
  USER,
} from '../uc/student-uc.fixture';
import { InactivitySweepJob } from './inactivity-sweep.job';

// Перенос `api/student/inactivity-sweep-job.test.ts`: предупреждение на 5-й
// день и расписание повтора через 2 дня. Пороги и отбор записей — в домене
// (`student.ar.test.ts`, `student.json-repo.test.ts`). Job доменный:
// пользователя и ментора не читает, события — по одному на запись (UoW).

const OTHER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
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
});
