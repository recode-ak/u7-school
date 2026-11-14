import { beforeEach, describe, expect, it } from 'bun:test';
import {
  GetModuleSnapshotUcDef,
  ModuleErrors,
} from '@u7-scl/domain/course/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { err } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import { PreviewStreamContentSyncUc } from './preview-stream-content-sync.uc';
import {
  admin,
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
  serveByStream,
  snap,
  state,
  walking,
} from './stream-uc.fixture';

// F-80, ФР-7. Таблица исходов плана — в тестах DCS (Ф1); здесь — что UC
// отдаёт наружу: план, версию потока, отсутствие записи, права.

const OLD = snap(SA, SB, SC);

let env: ReturnType<typeof makeEnv>;
const uc = () => new PreviewStreamContentSyncUc(env.deps, StreamModuleDef);
const input = { streamId: STREAM };

const arrange = (
  moduleSnapshot: ReturnType<typeof snap>,
  status: Parameters<typeof state>[0] = 'active',
  version = 0,
) => {
  env = makeEnv(moduleSnapshot);
  env.streams.seed(state(status, { contentSnapshot: OLD, version }));
  env.students.seed(walking(STUDENT_1, SB, [SA]));
  serveByStream(env.students, STUDENT_1);
};

const nothingWritten = () => {
  expect(env.streams.saved).toEqual([]);
  expect(env.students.saved).toEqual([]);
  expect(env.ctx.oplog.records.at(-1)?.writes ?? []).toEqual([]);
  expect(env.ctx.published).toEqual([]);
};

beforeEach(() => arrange(snap(SN, SA, SB, SC)));

describe('PreviewStreamContentSyncUc', () => {
  it('отдаёт план и версию потока, ничего не записывает', async () => {
    arrange(snap(SN, SA, SB, SC), 'active', 4);

    const out = expectOk(await uc().handle(input, mentor, REQ));

    expect(out.streamVersion).toBe(4);
    expect(out.plan.mode).toBe('sync');
    expect(out.plan.affected).toEqual([STUDENT_1]);
    expect(out.plan.blockers).toEqual([]);
    nothingWritten();
  });

  it('набор: план replace без студентов', async () => {
    arrange(snap(SN, SA, SB, SC), 'enrollment');

    const out = expectOk(await uc().handle(input, mentor, REQ));

    expect(out.plan.mode).toBe('replace');
    expect(out.plan.students).toEqual([]);
  });

  it('завершённый поток — не Err, а блокер CONTENT_NOT_SYNCABLE в плане', async () => {
    arrange(snap(SN, SA, SB, SC), 'completed');

    const out = expectOk(await uc().handle(input, mentor, REQ));

    expect(out.plan.mode).toBe('refused');
    expect(out.plan.blockers).toEqual([{ code: 'CONTENT_NOT_SYNCABLE' }]);
    nothingWritten();
  });

  it('удалён текущий шаг — не Err, а блокер SYNC_REMOVES_CURRENT_STEP в плане', async () => {
    arrange(snap(SA, SC));

    const out = expectOk(await uc().handle(input, mentor, REQ));

    expect(out.plan.blockers.map((b) => b.code)).toEqual([
      'SYNC_REMOVES_CURRENT_STEP',
    ]);
  });

  it('админ видит предпросмотр', async () => {
    expectOk(await uc().handle(input, admin, REQ));
  });

  it('чужой ментор — ACCESS_DENIED', async () => {
    const res = await uc().handle(input, otherMentor, REQ);

    expectErr(res, 'ACCESS_DENIED');
  });

  it('потока нет — STREAM_NOT_FOUND { streamId }', async () => {
    const missing = '99999999-9999-4999-8999-999999999999';

    const res = await uc().handle({ streamId: missing }, mentor, REQ);

    expect(expectErr(res, 'STREAM_NOT_FOUND').payload).toEqual({
      streamId: missing,
    });
  });

  it('Err курсов пробрасывается: MODULE_NOT_FOUND, ничего не записано', async () => {
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
