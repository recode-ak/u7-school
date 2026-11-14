import { describe, expect, it } from 'bun:test';
import { expectErr, expectOk } from 'dmg-core/testing';
import { sid, tree } from './content-sync.fixture';
import { StreamAr } from './stream/stream.ar';
import { StreamEvents } from './stream/stream.events';
import {
  MODULE,
  STREAM,
  stored as streamStored,
} from './stream/stream.fixture';
import type { StreamState } from './stream/stream.state';
import { StreamContentSyncDcs } from './stream-content-sync.dcs';
import { StudentAr } from './student/student.ar';
import { completed, issued, stored, T0 } from './student/student.fixture';
import type { StudentState } from './student/student.state';
import { StudentProgressDqs } from './student-progress.dqs';

// Синхронизация контента идущего потока (F-80): план по таблице исходов 1–20
// из брифа `stream-content-sync/slices/domain.md` и применение с зачётом.

const AT = T0 + 3_600_000;
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const S1 = uid(1);
const S2 = uid(2);
const U1 = uid(101);
const U2 = uid(102);

// Шаги, уроки и проект — uuid: state агрегатов проходит схему
const [A, B, C, D, E, N, X, Y] = ['A', 'B', 'C', 'D', 'E', 'N', 'X', 'Y'].map(
  sid,
) as [string, string, string, string, string, string, string, string];
const P = sid('P');
const L = sid('L');
const L1 = sid('L1');
const L2 = sid('L2');
const flat = (stepIds: string[]) => tree({ [P]: { [L]: stepIds } });

type Snapshot = ReturnType<typeof tree>;
type Step = StudentState['steps'][number];

const done = (stepId: string): Step => completed(stepId, T0, T0);
const open = (stepId: string): Step => issued(stepId, T0);

const stream = (
  status: StreamState['status'],
  contentSnapshot: Snapshot,
): StreamAr => StreamAr.restore(streamStored(status, { contentSnapshot }));

const student = (
  n: number,
  status: StudentState['status'],
  currentStepId: string,
  steps: Step[],
): StudentAr =>
  StudentAr.restore(
    stored(status, {
      uuid: uid(n),
      userId: uid(100 + n),
      currentStepId,
      steps,
    }),
  );

/** Студент по умолчанию: идёт, текущий шаг `c`, пройденные — до него. */
const walking = (
  n: number,
  current: string,
  steps: Step[],
  status: StudentState['status'] = 'active',
) => student(n, status, current, steps);

const sync = (
  status: StreamState['status'],
  before: Snapshot,
  students: StudentAr[],
) => {
  const flow = stream(status, before);
  return { flow, dcs: new StreamContentSyncDcs(flow, students) };
};

const stepsOf = (s: StudentAr) => s.snapshot().steps;
const ids = (list: readonly StudentAr[]) => list.map((s) => s.snapshot().uuid);
const credit = (stepId: string, issuedAt = AT): Step => ({
  ...completed(stepId, issuedAt, AT),
  completionSource: 'content_sync',
});

describe('StreamContentSyncDcs.plan — строки 1–4: студент на последнем шаге', () => {
  it('1: шаг добавлен в конец — tail, студент не в affected и не меняется', () => {
    const s = walking(1, C, [done(A), done(B), done(C)]);
    const { dcs } = sync('active', flat([A, B, C]), [s]);
    const plan = dcs.plan(flat([A, B, C, D]));
    expect(plan.mode).toBe('sync');
    expect(plan.affected).toEqual([]);
    expect(plan.blockers).toEqual([]);
    expect(plan.students).toHaveLength(1);
    expect(plan.students[0]).toMatchObject({
      studentId: S1,
      userId: U1,
      status: 'active',
      kind: 'in_progress',
      behind: [],
      tail: D,
      removesCurrent: false,
    });
    const outcome = expectOk(dcs.apply(flat([A, B, C, D]), [], AT));
    expect(outcome.changedStudents).toEqual([]);
    expect(s.snapshot().version).toBe(0);
  });

  it('2: шаг добавлен перед текущим — behind, зачёт с пометкой', () => {
    const s = walking(1, C, [done(A), done(B), done(C)]);
    const after = flat([A, N, B, C]);
    const { dcs } = sync('active', flat([A, B, C]), [s]);
    const plan = dcs.plan(after);
    expect(plan.students[0]?.behind).toEqual([N]);
    expect(plan.affected).toEqual([S1]);
    const outcome = expectOk(dcs.apply(after, [S1], AT));
    expect(ids(outcome.changedStudents)).toEqual([S1]);
    expect(outcome.credited).toEqual([{ studentId: S1, stepIds: [N] }]);
    expect(stepsOf(s)).toEqual([done(A), done(B), done(C), credit(N)]);
    expect(s.snapshot().currentStepId).toBe(C);
  });

  it('3: удалён текущий (последний) шаг — блокер SYNC_REMOVES_CURRENT_STEP', () => {
    const s = walking(1, C, [done(A), done(B), done(C)]);
    const after = flat([A, B]);
    const { dcs } = sync('active', flat([A, B, C]), [s]);
    const plan = dcs.plan(after);
    expect(plan.students[0]?.removesCurrent).toBe(true);
    expect(plan.blockers).toEqual([
      {
        code: 'SYNC_REMOVES_CURRENT_STEP',
        students: [{ studentId: S1, userId: U1 }],
      },
    ]);
    const error = expectErr(
      dcs.apply(after, [], AT),
      'STREAM_SYNC_REMOVES_CURRENT_STEP',
    );
    expect(error.kind).toBe('conflict');
    expect(error.payload).toEqual({
      students: [{ studentId: S1, userId: U1 }],
    });
  });

  it('4: несколько шагов в конец — первый tail, остальные в ahead', () => {
    const s = walking(1, C, [done(A), done(B), done(C)]);
    const { dcs } = sync('active', flat([A, B, C]), [s]);
    const plan = dcs.plan(flat([A, B, C, D, E]));
    expect(plan.students[0]?.tail).toBe(D);
    expect(plan.students[0]?.ahead).toEqual([E]);
    expect(plan.affected).toEqual([]);
  });
});

describe('StreamContentSyncDcs.plan — строки 5–6: кого анализируем', () => {
  it.each(['enrolled', 'active'] as const)(
    '5: %s без шагов — not_started, ничего не зачитывается, блокера нет даже при удалённом currentStepId',
    (status) => {
      const s = student(1, status, A, []);
      const after = flat([X, Y]);
      const { dcs } = sync('active', flat([A, B]), [s]);
      const plan = dcs.plan(after);
      expect(plan.students[0]).toMatchObject({
        studentId: S1,
        kind: 'not_started',
        behind: [],
        removesCurrent: false,
      });
      expect(plan.affected).toEqual([]);
      expect(plan.blockers).toEqual([]);
      const outcome = expectOk(dcs.apply(after, [], AT));
      expect(outcome.changedStudents).toEqual([]);
      expect(s.snapshot().version).toBe(0);
    },
  );

  it('6: поток в наборе — mode replace, студенты не анализируются и не меняются', () => {
    const s = student(1, 'enrolled', A, []);
    const after = flat([N, A, B]);
    const { flow, dcs } = sync('enrollment', flat([A, B]), [s]);
    const plan = dcs.plan(after);
    expect(plan).toMatchObject({
      mode: 'replace',
      students: [],
      affected: [],
      blockers: [],
    });
    const outcome = expectOk(dcs.apply(after, [], AT));
    expect(outcome.mode).toBe('replace');
    expect(outcome.changedStudents).toEqual([]);
    expect(outcome.credited).toEqual([]);
    expect(flow.snapshot().contentSnapshot).toEqual(after);
    expect(s.snapshot().version).toBe(0);
  });
});

describe('StreamContentSyncDcs.plan — строки 7–12: переносы и перестановки', () => {
  const lessons = (l1: string[], l2: string[]) =>
    tree({ [P]: { [L1]: l1, [L2]: l2 } });

  it('7: перенесён в другой урок, был после текущего, стал перед — behind, зачёт', () => {
    const s = walking(1, B, [done(A), open(B)]);
    const before = lessons([A, B], [C, D]);
    const after = lessons([A, D, B], [C]);
    const { dcs } = sync('active', before, [s]);
    const plan = dcs.plan(after);
    expect(plan.students[0]?.behind).toEqual([D]);
    expect(plan.diff.steps.moved.map((m) => m.stepId)).toEqual([D]);
    const outcome = expectOk(dcs.apply(after, [S1], AT));
    expect(outcome.credited).toEqual([{ studentId: S1, stepIds: [D] }]);
    expect(s.hasCompleted(D)).toBe(true);
    expect(s.snapshot().currentStepId).toBe(B);
  });

  it('8: перенесён, порядок относительно текущего прежний — не зачёт, moved в diff', () => {
    const s = walking(1, A, [open(A)]);
    const before = lessons([A, B], [C, D]);
    const after = lessons([A, B, D], [C]);
    const { dcs } = sync('active', before, [s]);
    const plan = dcs.plan(after);
    expect(plan.students[0]?.behind).toEqual([]);
    expect(plan.affected).toEqual([]);
    expect(plan.diff.steps.moved.map((m) => m.stepId)).toEqual([D]);
    expect(expectOk(dcs.apply(after, [], AT)).credited).toEqual([]);
    expect(stepsOf(s)).toEqual([open(A)]);
  });

  it('9: пройденный шаг перенесён после текущего — completedAhead, запись цела, студент не тронут (S1)', () => {
    const s = walking(1, C, [done(A), done(B), open(C)]);
    const after = flat([B, C, D, A]);
    const { dcs } = sync('active', flat([A, B, C, D]), [s]);
    const plan = dcs.plan(after);
    expect(plan.students[0]?.completedAhead).toEqual([A]);
    expect(plan.students[0]?.behind).toEqual([]);
    expect(plan.affected).toEqual([]);
    expect(plan.blockers).toEqual([]);
    const outcome = expectOk(dcs.apply(after, [], AT));
    expect(outcome.changedStudents).toEqual([]);
    expect(stepsOf(s)).toEqual([done(A), done(B), open(C)]);
    expect(s.snapshot().currentStepId).toBe(C);
  });

  it('10: переставлены два пройденных шага перед текущим — зачёта нет, не в affected', () => {
    const s = walking(1, D, [done(A), done(B), done(C), open(D)]);
    const after = flat([B, A, C, D]);
    const { dcs } = sync('active', flat([A, B, C, D]), [s]);
    const plan = dcs.plan(after);
    expect(plan.students[0]?.behind).toEqual([]);
    expect(plan.affected).toEqual([]);
    expect(plan.blockers).toEqual([]);
    expect(expectOk(dcs.apply(after, [], AT)).changedStudents).toEqual([]);
  });

  it('11: шаг перешёл «после текущего» → «перед текущим» — behind, зачёт', () => {
    const s = walking(1, B, [done(A), open(B)]);
    const after = flat([A, C, B, D]);
    const { dcs } = sync('active', flat([A, B, C, D]), [s]);
    expect(dcs.plan(after).students[0]?.behind).toEqual([C]);
    const outcome = expectOk(dcs.apply(after, [S1], AT));
    expect(outcome.credited).toEqual([{ studentId: S1, stepIds: [C] }]);
    expect(s.hasCompleted(C)).toBe(true);
  });

  it('12: текущий шаг перенесён и остался текущим — removesCurrent=false, пересёкшие зачитываются', () => {
    const s = walking(1, B, [done(A), open(B)]);
    const after = flat([A, C, D, B]);
    const { dcs } = sync('active', flat([A, B, C, D]), [s]);
    const plan = dcs.plan(after);
    expect(plan.students[0]?.removesCurrent).toBe(false);
    expect(plan.students[0]?.behind).toEqual([C, D]);
    expect(plan.blockers).toEqual([]);
    const outcome = expectOk(dcs.apply(after, [S1], AT));
    expect(outcome.credited).toEqual([{ studentId: S1, stepIds: [C, D] }]);
    expect(s.snapshot().currentStepId).toBe(B);
  });
});

describe('StreamContentSyncDcs.plan — строки 13–16: удаления, замены, переименования', () => {
  const before = flat([A, B, C, D]);

  it('13а: удалён пройденный и добавлен под новым id перед текущим — removedPassed и behind', () => {
    const s = walking(1, C, [done(A), done(B), open(C)]);
    const after = flat([A, X, C, D]);
    const { dcs } = sync('active', before, [s]);
    const plan = dcs.plan(after);
    expect(plan.diff.steps.removed.map((r) => r.stepId)).toEqual([B]);
    expect(plan.diff.steps.added.map((a) => a.stepId)).toEqual([X]);
    expect(plan.students[0]?.removedPassed).toEqual([B]);
    expect(plan.students[0]?.behind).toEqual([X]);
    expect(plan.blockers).toEqual([]);
  });

  it('13б: удалён текущий и добавлен под новым id — блокер', () => {
    const s = walking(1, C, [done(A), done(B), open(C)]);
    const { dcs } = sync('active', before, [s]);
    const plan = dcs.plan(flat([A, B, Y, D]));
    expect(plan.students[0]?.removesCurrent).toBe(true);
    expect(plan.blockers.map((b) => b.code)).toEqual([
      'SYNC_REMOVES_CURRENT_STEP',
    ]);
  });

  it('13в: добавлен под новым id после текущего — ahead, не behind', () => {
    const s = walking(1, B, [done(A), open(B)]);
    const { dcs } = sync('active', before, [s]);
    const plan = dcs.plan(flat([A, B, C, Y]));
    expect(plan.students[0]?.behind).toEqual([]);
    expect(plan.students[0]?.ahead).toContain(Y);
    expect(plan.affected).toEqual([]);
  });

  it('14: удалён пройденный — не блокер, запись остаётся, computeProgress её не считает', () => {
    const s = walking(1, C, [done(A), done(B), open(C)]);
    const after = flat([A, C, D]);
    const { dcs } = sync('active', before, [s]);
    const plan = dcs.plan(after);
    expect(plan.students[0]?.removedPassed).toEqual([B]);
    expect(plan.blockers).toEqual([]);
    expect(plan.affected).toEqual([]);
    expectOk(dcs.apply(after, [], AT));
    expect(stepsOf(s)).toContainEqual(done(B));
    expect(new StudentProgressDqs(after, s).computeProgress()).toEqual({
      completed: 1,
      total: 3,
      percent: 33,
    });
  });

  it('15: добавлен перед текущим, у студента запись issued — становится completed с пометкой, issuedAt цел', () => {
    const s = walking(1, C, [done(A), done(B), open(C), open(N)]);
    const after = flat([A, N, B, C, D]);
    const { dcs } = sync('active', before, [s]);
    expect(dcs.plan(after).students[0]?.behind).toEqual([N]);
    expectOk(dcs.apply(after, [S1], AT));
    expect(stepsOf(s)).toContainEqual(credit(N, T0));
  });

  it('16: только переименования — renamed, affected пуст, changed=true, поток обновлён', () => {
    const s = walking(1, B, [done(A), open(B)]);
    const titled = tree({ [P]: { [L]: [A, B, C, D] } }, { [L]: 'Новое имя' });
    const { flow, dcs } = sync('active', before, [s]);
    const plan = dcs.plan(titled);
    expect(plan.diff.changed).toBe(true);
    expect(plan.diff.lessons.renamed).toHaveLength(1);
    expect(plan.affected).toEqual([]);
    expect(plan.blockers).toEqual([]);
    const outcome = expectOk(dcs.apply(titled, [], AT));
    expect(outcome.changedStudents).toEqual([]);
    expect(flow.snapshot().contentSnapshot).toEqual(titled);
    expect(flow.snapshot().version).toBe(1);
  });
});

describe('StreamContentSyncDcs — строки 17–20: пограничные', () => {
  it('17: снимки идентичны — changed=false, unchanged, ни студентов, ни события', () => {
    const s = walking(1, B, [done(A), open(B)]);
    const same = flat([A, B, C]);
    const { flow, dcs } = sync('active', flat([A, B, C]), [s]);
    expect(dcs.plan(structuredClone(same)).diff.changed).toBe(false);
    const outcome = expectOk(dcs.apply(structuredClone(same), [], AT));
    expect(outcome.changedStudents).toEqual([]);
    expect(outcome.credited).toEqual([]);
    expect(flow.snapshot().version).toBe(0);
    expect(flow.pullEvents()).toEqual([]);
    expect(s.snapshot().version).toBe(0);
  });

  it.each(['completed', 'archived'] as const)(
    '18: поток %s — mode refused, блокер CONTENT_NOT_SYNCABLE, apply — отказ без мутаций',
    (status) => {
      const s = walking(1, B, [done(A), open(B)]);
      const after = flat([N, A, B]);
      const { flow, dcs } = sync(status, flat([A, B]), [s]);
      const plan = dcs.plan(after);
      expect(plan).toMatchObject({
        mode: 'refused',
        students: [],
        affected: [],
        blockers: [{ code: 'CONTENT_NOT_SYNCABLE' }],
      });
      const error = expectErr(
        dcs.apply(after, [], AT),
        'STREAM_CONTENT_NOT_SYNCABLE',
      );
      expect(error.kind).toBe('conflict');
      expect(flow.snapshot().contentSnapshot).toEqual(flat([A, B]));
      expect(s.snapshot().version).toBe(0);
    },
  );

  it('19: повторный apply — changedStudents и credited пусты, поток unchanged', () => {
    const s = walking(1, C, [done(A), done(B), open(C)]);
    const after = flat([A, N, B, C]);
    const { flow, dcs } = sync('active', flat([A, B, C]), [s]);
    expectOk(dcs.apply(after, [S1], AT));
    const version = flow.snapshot().version;
    const studentVersion = s.snapshot().version;
    const again = expectOk(dcs.apply(after, [], AT + 1));
    expect(again.changedStudents).toEqual([]);
    expect(again.credited).toEqual([]);
    expect(flow.snapshot().version).toBe(version);
    expect(s.snapshot().version).toBe(studentVersion);
  });

  it('19: повтор со старым списком подтверждения — успех без изменений', () => {
    const s = walking(1, C, [done(A), done(B), open(C)]);
    const after = flat([A, N, B, C]);
    const { flow, dcs } = sync('active', flat([A, B, C]), [s]);
    expectOk(dcs.apply(after, [S1], AT));
    const version = flow.snapshot().version;
    const studentVersion = s.snapshot().version;
    const again = expectOk(dcs.apply(after, [S1], AT + 1));
    expect(again.changedStudents).toEqual([]);
    expect(again.credited).toEqual([]);
    expect(flow.snapshot().version).toBe(version);
    expect(s.snapshot().version).toBe(studentVersion);
  });

  it('19: повтор после частичного зачёта (поток не заменён) с исходным списком — доводит обновление (ФР-8а)', () => {
    const first = walking(1, C, [done(A), done(B), open(C)]);
    const second = walking(2, C, [done(A), done(B), open(C)]);
    const after = flat([A, N, B, C]);
    const { flow, dcs } = sync('active', flat([A, B, C]), [first, second]);
    // Сбой посередине: первый студент записан, второй и поток — нет
    expectOk(first.creditStep(N, AT));
    const firstVersion = first.snapshot().version;
    const outcome = expectOk(dcs.apply(after, [S1, S2], AT + 1));
    expect(ids(outcome.changedStudents)).toEqual([S2]);
    expect(outcome.credited).toEqual([{ studentId: S2, stepIds: [N] }]);
    expect(first.snapshot().version).toBe(firstVersion);
    expect(second.hasCompleted(N)).toBe(true);
    expect(flow.snapshot().contentSnapshot).toEqual(after);
  });

  it('20: блокер и непустой affected — первым SYNC_REMOVES_CURRENT_STEP, даже без подтверждения', () => {
    const blocked = walking(1, D, [done(A), done(B), done(C), open(D)]);
    const behind = walking(2, C, [done(A), done(B), open(C)]);
    const after = flat([A, N, B, C]);
    const { dcs } = sync('active', flat([A, B, C, D]), [blocked, behind]);
    const plan = dcs.plan(after);
    expect(plan.affected).toEqual([S2]);
    expect(plan.blockers.map((b) => b.code)).toEqual([
      'SYNC_REMOVES_CURRENT_STEP',
    ]);
    const error = expectErr(
      dcs.apply(after, [], AT),
      'STREAM_SYNC_REMOVES_CURRENT_STEP',
    );
    expect(error.payload).toEqual({
      students: [{ studentId: S1, userId: U1 }],
    });
  });
});

describe('StreamContentSyncDcs — терминальные студенты', () => {
  it.each(['abandoned', 'advanced', 'not_advanced'] as const)(
    '%s не попадает в план, не зачитывается и не блокирует',
    (status) => {
      const s = student(1, status, C, [done(A), done(B), open(C)]);
      const after = flat([A, B]);
      const { dcs } = sync('active', flat([A, B, C]), [s]);
      const plan = dcs.plan(after);
      expect(plan.students).toEqual([]);
      expect(plan.affected).toEqual([]);
      expect(plan.blockers).toEqual([]);
      const outcome = expectOk(dcs.apply(after, [], AT));
      expect(outcome.changedStudents).toEqual([]);
      expect(s.snapshot().version).toBe(0);
      expect(s.snapshot().status).toBe(status);
    },
  );

  it('смесь: зачёт получает только идущий, терминальный не меняется', () => {
    const live = walking(1, C, [done(A), done(B), open(C)]);
    const gone = student(2, 'abandoned', C, [done(A), done(B), open(C)]);
    const after = flat([A, N, B, C]);
    const { dcs } = sync('active', flat([A, B, C]), [live, gone]);
    const outcome = expectOk(dcs.apply(after, [S1], AT));
    expect(ids(outcome.changedStudents)).toEqual([S1]);
    expect(gone.snapshot().version).toBe(0);
  });
});

describe('StreamContentSyncDcs.apply — подтверждение', () => {
  const before = flat([A, B, C]);
  const after = flat([A, N, B, C]);
  const two = () => [
    walking(1, C, [done(A), done(B), open(C)]),
    walking(2, C, [done(A), done(B), open(C)]),
  ];

  it('affected непуст, подтверждения нет — SYNC_NEEDS_CONFIRMATION с актуальным affected, без мутаций', () => {
    const students = two();
    const { flow, dcs } = sync('active', before, students);
    const error = expectErr(
      dcs.apply(after, [], AT),
      'STREAM_SYNC_NEEDS_CONFIRMATION',
    );
    expect(error.kind).toBe('conflict');
    expect(error.payload).toEqual({ affected: [S1, S2] });
    expect(flow.snapshot().contentSnapshot).toEqual(before);
    expect(flow.snapshot().version).toBe(0);
    for (const s of students) expect(s.snapshot().version).toBe(0);
  });

  it('лишний id в подтверждении — принимается, зачёт только затронутым', () => {
    const { flow, dcs } = sync('active', before, two());
    const outcome = expectOk(dcs.apply(after, [S1, S2, uid(3)], AT));
    expect(ids(outcome.changedStudents)).toEqual([S1, S2]);
    expect(flow.snapshot().contentSnapshot).toEqual(after);
  });

  it('недостающий id в подтверждении — SYNC_NEEDS_CONFIRMATION', () => {
    const { dcs } = sync('active', before, two());
    const error = expectErr(
      dcs.apply(after, [S1], AT),
      'STREAM_SYNC_NEEDS_CONFIRMATION',
    );
    expect(error.payload).toEqual({ affected: [S1, S2] });
  });

  it('верный набор в другом порядке — принимается', () => {
    const students = two();
    const { flow, dcs } = sync('active', before, students);
    const outcome = expectOk(dcs.apply(after, [S2, S1], AT));
    expect(ids(outcome.changedStudents)).toEqual([S1, S2]);
    expect(flow.snapshot().contentSnapshot).toEqual(after);
  });

  it('affected пуст, подтверждение пустое — принимается', () => {
    const s = walking(1, C, [done(A), done(B), open(C)]);
    const { flow, dcs } = sync('active', before, [s]);
    expectOk(dcs.apply(flat([A, B, C, D]), [], AT));
    expect(flow.snapshot().version).toBe(1);
  });

  it('affected пуст, но подтверждён лишний id — принимается, студент не меняется', () => {
    const s = walking(1, C, [done(A), done(B), open(C)]);
    const { flow, dcs } = sync('active', before, [s]);
    const outcome = expectOk(dcs.apply(flat([A, B, C, D]), [S1], AT));
    expect(outcome.changedStudents).toEqual([]);
    expect(s.snapshot().version).toBe(0);
    expect(flow.snapshot().version).toBe(1);
  });

  it('успех: поток публикует contentSynced со счётчиками, у студентов событий нет', () => {
    const students = two();
    const { flow, dcs } = sync('active', before, students);
    expectOk(dcs.apply(after, [S1, S2], AT));
    expect(flow.pullEvents()).toEqual([
      StreamEvents.contentSynced.make({
        streamId: STREAM,
        moduleId: MODULE,
        stepsBefore: 3,
        stepsAfter: 4,
      }),
    ]);
    for (const s of students) expect(s.pullEvents()).toEqual([]);
  });

  it('успех: mode sync, credited — по студентам в порядке входа', () => {
    const { dcs } = sync('active', before, two());
    const outcome = expectOk(dcs.apply(after, [S1, S2], AT));
    expect(outcome.mode).toBe('sync');
    expect(outcome.credited).toEqual([
      { studentId: S1, stepIds: [N] },
      { studentId: S2, stepIds: [N] },
    ]);
  });
});

describe('StreamContentSyncDcs — чистота', () => {
  it('plan ничего не мутирует: потоки, студенты, события', () => {
    const s = walking(1, C, [done(A), done(B), open(C)]);
    const { flow, dcs } = sync('active', flat([A, B, C]), [s]);
    const flowBefore = structuredClone(flow.snapshot());
    const studentBefore = structuredClone(s.snapshot());
    dcs.plan(flat([A, N, B, C]));
    dcs.plan(flat([A, B]));
    expect(flow.snapshot()).toEqual(flowBefore);
    expect(s.snapshot()).toEqual(studentBefore);
    expect(flow.pullEvents()).toEqual([]);
    expect(s.pullEvents()).toEqual([]);
  });

  it('plan не меняет переданный снимок', () => {
    const s = walking(1, C, [done(A), done(B), open(C)]);
    const next = flat([A, N, B, C]);
    const copy = structuredClone(next);
    sync('active', flat([A, B, C]), [s]).dcs.plan(next);
    expect(next).toEqual(copy);
  });

  it('apply при отказе блокера не мутирует студентов и поток', () => {
    const blocked = walking(1, C, [done(A), done(B), open(C)]);
    const behind = walking(2, B, [done(A), open(B)]);
    const { flow, dcs } = sync('active', flat([A, B, C]), [blocked, behind]);
    const flowBefore = structuredClone(flow.snapshot());
    expectErr(
      dcs.apply(flat([N, A, B]), [S2], AT),
      'STREAM_SYNC_REMOVES_CURRENT_STEP',
    );
    expect(flow.snapshot()).toEqual(flowBefore);
    expect(blocked.snapshot().version).toBe(0);
    expect(behind.snapshot().version).toBe(0);
    expect(stepsOf(behind)).toEqual([done(A), open(B)]);
  });
});
