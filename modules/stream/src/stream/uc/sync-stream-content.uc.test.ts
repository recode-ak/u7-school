import { beforeEach, describe, expect, it } from 'bun:test';
import {
  GetModuleSnapshotUcDef,
  ModuleErrors,
} from '@u7-scl/domain/course/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { err } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import { StudentRepoFake } from '../../student/student.repo.fake';
import {
  admin,
  anonymous,
  guestRole,
  makeEnv,
  mentor,
  otherMentor,
  REQ,
  SA,
  SB,
  SC,
  SN,
  STREAM,
  STUDENT_1,
  STUDENT_2,
  serveByStream,
  snap,
  state,
  student,
  walking,
} from './stream-uc.fixture';
import { SyncStreamContentUc } from './sync-stream-content.uc';

// F-80, ФР-7…ФР-8а. Исходы DCS (таблица Ф1) здесь не повторяются: проверяется
// то, что добавляет UC — загрузка, права, версия, порядок записи, события.

const OLD = snap(SA, SB, SC);
/** Новый шаг в начале: оба студента стоят на SB, SN оказывается позади. */
const WITH_BEHIND = snap(SN, SA, SB, SC);
const MISSING_STREAM = '99999999-9999-4999-8999-999999999999';

let env: ReturnType<typeof makeEnv>;
const uc = (deps = env.deps) => new SyncStreamContentUc(deps, StreamModuleDef);

/** Поток со снимком `OLD` и два идущих студента на шаге SB. */
const arrange = (
  moduleSnapshot: ReturnType<typeof snap>,
  status: Parameters<typeof state>[0] = 'active',
) => {
  env = makeEnv(moduleSnapshot);
  env.streams.seed(state(status, { contentSnapshot: OLD }));
  env.students.seed(walking(STUDENT_1, SB, [SA]), walking(STUDENT_2, SB, [SA]));
  serveByStream(env.students, STUDENT_1, STUDENT_2);
};

const input = { streamId: STREAM, confirmedStudentIds: [STUDENT_1, STUDENT_2] };
const streamSnapshot = () =>
  env.streams.restoredOrThrow(STREAM).view().contentSnapshot;
const lastRecord = () => env.ctx.oplog.records.at(-1);

beforeEach(() => arrange(WITH_BEHIND));

describe('SyncStreamContentUc — применение', () => {
  it('идущий поток: шаг позади зачтён подтверждённым, снимок потока заменён', async () => {
    const out = expectOk(await uc().handle(input, mentor, REQ));

    expect(out.mode).toBe('sync');
    expect(out.credited).toEqual([
      { studentId: STUDENT_1, stepIds: [SN] },
      { studentId: STUDENT_2, stepIds: [SN] },
    ]);
    expect(streamSnapshot()).toEqual(WITH_BEHIND);
    for (const id of [STUDENT_1, STUDENT_2]) {
      expect(env.students.restoredOrThrow(id).hasCompleted(SN)).toBe(true);
    }
  });

  it('набор: режим replace, снимок заменён, студенты не пишутся', async () => {
    arrange(WITH_BEHIND, 'enrollment');

    const out = expectOk(
      await uc().handle(
        { streamId: STREAM, confirmedStudentIds: [] },
        mentor,
        REQ,
      ),
    );

    expect(out).toEqual({ mode: 'replace', credited: [] });
    expect(streamSnapshot()).toEqual(WITH_BEHIND);
    expect(env.students.saved).toEqual([]);
  });

  it('затронутых студентов нет — применяется с пустым списком подтверждения', async () => {
    arrange(snap(SA, SB, SC, SN));

    const out = expectOk(
      await uc().handle(
        { streamId: STREAM, confirmedStudentIds: [] },
        mentor,
        REQ,
      ),
    );

    expect(out).toEqual({ mode: 'sync', credited: [] });
    expect(env.students.saved).toEqual([]);
    expect(streamSnapshot()).toEqual(snap(SA, SB, SC, SN));
  });

  it('лишний подтверждённый студент — не отказ', async () => {
    const extra = '00000000-0000-4000-8000-0000000000ff';

    expectOk(
      await uc().handle(
        { ...input, confirmedStudentIds: [STUDENT_1, STUDENT_2, extra] },
        mentor,
        REQ,
      ),
    );
  });
});

describe('SyncStreamContentUc — отказы без записи', () => {
  const nothingWritten = () => {
    expect(env.streams.saved).toEqual([]);
    expect(env.students.saved).toEqual([]);
    expect(lastRecord()?.writes).toEqual([]);
  };

  it.each(['completed', 'archived'] as const)(
    '%s — STREAM_CONTENT_NOT_SYNCABLE',
    async (status) => {
      arrange(WITH_BEHIND, status);

      const res = await uc().handle(input, mentor, REQ);

      expect(expectErr(res, 'STREAM_CONTENT_NOT_SYNCABLE').kind).toBe(
        'conflict',
      );
      nothingWritten();
    },
  );

  it('удалён текущий шаг — STREAM_SYNC_REMOVES_CURRENT_STEP { students }', async () => {
    arrange(snap(SA, SC));

    const res = await uc().handle(input, mentor, REQ);

    const error = expectErr(res, 'STREAM_SYNC_REMOVES_CURRENT_STEP');
    expect(error.payload.students.map((s) => s.studentId)).toEqual([
      STUDENT_1,
      STUDENT_2,
    ]);
    nothingWritten();
  });

  it('подтверждение не передано — STREAM_SYNC_NEEDS_CONFIRMATION { affected }', async () => {
    const res = await uc().handle(
      { streamId: STREAM, confirmedStudentIds: [] },
      mentor,
      REQ,
    );

    const error = expectErr(res, 'STREAM_SYNC_NEEDS_CONFIRMATION');
    expect(error.payload.affected).toEqual([STUDENT_1, STUDENT_2]);
    nothingWritten();
  });

  it('подтверждён не каждый затронутый — STREAM_SYNC_NEEDS_CONFIRMATION', async () => {
    const res = await uc().handle(
      { streamId: STREAM, confirmedStudentIds: [STUDENT_1] },
      mentor,
      REQ,
    );

    expectErr(res, 'STREAM_SYNC_NEEDS_CONFIRMATION');
    nothingWritten();
  });

  it('потока нет — STREAM_NOT_FOUND { streamId }', async () => {
    const res = await uc().handle(
      { ...input, streamId: MISSING_STREAM },
      mentor,
      REQ,
    );

    const error = expectErr(res, 'STREAM_NOT_FOUND');
    expect(error.payload).toEqual({ streamId: MISSING_STREAM });
    nothingWritten();
  });

  it('Err курсов пробрасывается: MODULE_NOT_FOUND', async () => {
    env.course.answer(
      GetModuleSnapshotUcDef,
      () =>
        err(
          ModuleErrors.NOT_FOUND.make({ moduleId: state('active').moduleId }),
        ) as never,
    );

    const res = await uc().handle(input, mentor, REQ);

    expectErr(res, 'MODULE_NOT_FOUND');
    nothingWritten();
  });
});

describe('SyncStreamContentUc — версия (D-57)', () => {
  it('expectedVersion не совпадает — VERSION_CONFLICT, ничего не записано', async () => {
    const res = await uc().handle(
      { ...input, expectedVersion: 5 },
      mentor,
      REQ,
    );

    expect(expectErr(res, 'VERSION_CONFLICT').payload).toEqual({
      aggregate: 'stream',
      uuid: STREAM,
    });
    expect(env.streams.saved).toEqual([]);
    expect(env.students.saved).toEqual([]);
  });

  it('expectedVersion совпадает — применяется', async () => {
    expectOk(await uc().handle({ ...input, expectedVersion: 0 }, mentor, REQ));

    expect(streamSnapshot()).toEqual(WITH_BEHIND);
  });

  it('expectedVersion не передан — сверки нет', async () => {
    env.streams.seed(state('active', { contentSnapshot: OLD, version: 7 }));

    expectOk(await uc().handle(input, mentor, REQ));
  });
});

describe('SyncStreamContentUc — права', () => {
  it.each([
    ['ментор потока', mentor],
    ['админ', admin],
  ] as const)('%s — ok', async (_, caller) => {
    expectOk(await uc().handle(input, caller, REQ));
  });

  it.each([
    ['чужой ментор', otherMentor],
    ['студент', student],
    ['пользователь с ролью GUEST', guestRole],
  ] as const)('%s — ACCESS_DENIED, ничего не записано', async (_, caller) => {
    const res = await uc().handle(input, caller, REQ);

    expectErr(res, 'ACCESS_DENIED');
    expect(env.streams.saved).toEqual([]);
    expect(env.students.saved).toEqual([]);
  });

  it('анонимный вызывающий — UNAUTHORIZED', async () => {
    const res = await uc().handle(input, anonymous, REQ);

    expectErr(res, 'UNAUTHORIZED');
  });
});

describe('SyncStreamContentUc — запись и события', () => {
  it('writes: студенты раньше потока, версии from/to', async () => {
    expectOk(await uc().handle(input, mentor, REQ));

    const writes = lastRecord()?.writes ?? [];
    expect(writes.map((w) => [w.aggregate, w.uuid])).toEqual([
      ['student', STUDENT_1],
      ['student', STUDENT_2],
      ['stream', STREAM],
    ]);
    expect(writes.map((w) => w.from)).toEqual([0, 0, 0]);
    expect(writes.at(-1)?.to).toBe(1);
    expect(writes.slice(0, 2).every((w) => w.to > (w.from ?? 0))).toBe(true);
  });

  it('событие stream.stream.contentSynced со счётчиками шагов, студенческих событий нет', async () => {
    expectOk(await uc().handle(input, mentor, REQ));

    expect(env.ctx.published).toHaveLength(1);
    expect(env.ctx.published[0]).toMatchObject({
      name: 'stream.stream.contentSynced',
      aggregateId: STREAM,
      payload: {
        streamId: STREAM,
        moduleId: state('active').moduleId,
        stepsBefore: 3,
        stepsAfter: 4,
      },
    });
  });

  it('повтор после успеха: credited пуст, поток не записан, события нет', async () => {
    expectOk(await uc().handle(input, mentor, REQ));
    const streamWrites = env.streams.saved.length;
    const studentWrites = env.students.saved.length;
    const published = env.ctx.published.length;

    const again = expectOk(await uc().handle(input, mentor, REQ));

    expect(again.credited).toEqual([]);
    expect(env.streams.saved).toHaveLength(streamWrites);
    expect(env.students.saved).toHaveLength(studentWrites);
    expect(env.ctx.published).toHaveLength(published);
    expect(lastRecord()?.writes).toEqual([]);
  });
});

describe('SyncStreamContentUc — сбой посередине (ФР-8а)', () => {
  it('сбой записи второго студента: поток со старым снимком; повтор доводит до конца', async () => {
    env.students.failOn(STUDENT_2);

    const failed = await uc().handle(input, mentor, REQ);

    expectErr(failed, 'SERVER_INTERNAL');
    expect(env.students.saved.map((s) => s.uuid)).toEqual([STUDENT_1]);
    expect(env.streams.saved).toEqual([]);
    expect(streamSnapshot()).toEqual(OLD);

    // Повтор: диск ожил — новый фейк с тем, что реально записано
    const healed = new StudentRepoFake().seed(
      env.students.restoredOrThrow(STUDENT_1).snapshot(),
      walking(STUDENT_2, SB, [SA]),
    );
    serveByStream(healed, STUDENT_1, STUDENT_2);

    const out = expectOk(
      await uc({ ...env.deps, students: healed }).handle(input, mentor, REQ),
    );

    expect(out.credited).toEqual([{ studentId: STUDENT_2, stepIds: [SN] }]);
    expect(streamSnapshot()).toEqual(WITH_BEHIND);
    expect(healed.restoredOrThrow(STUDENT_2).hasCompleted(SN)).toBe(true);
    expect(lastRecord()?.writes.map((w) => w.aggregate)).toEqual([
      'student',
      'stream',
    ]);
  });
});
