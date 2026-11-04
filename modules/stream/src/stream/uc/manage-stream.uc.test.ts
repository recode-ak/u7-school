import { beforeEach, describe, expect, it } from 'bun:test';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import type { Result } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import { ActivateStreamUc } from './activate-stream.uc';
import { ArchiveStreamUc } from './archive-stream.uc';
import { CompleteStreamUc } from './complete-stream.uc';
import {
  admin,
  anonymous,
  guestRole,
  MENTOR_ID,
  makeEnv,
  mentor,
  otherMentor,
  REQ,
  STREAM,
  state,
  student,
} from './stream-uc.fixture';

// Перенос `api/stream/{activate,complete,archive}-stream-uc.test.ts`.
// Общее: управляет ментор потока или админ (Policy canManage), чужой, студент и
// пользователь-гость — ACCESS_DENIED «Недостаточно прав…», вызывающий guest —
// UNAUTHORIZED, нет потока — STREAM_NOT_FOUND { streamId } «Поток не найден».

/** Отказ с кодом: форма, общая для трёх команд (код сужает `expectErr`). */
type Failure<C extends string> = C extends string
  ? { code: C; kind: string; label: string; payload?: unknown }
  : never;

/** Итог любой из трёх команд: общие отказы проверяются одним кодом. */
type Outcome = Result<
  unknown,
  Failure<'ACCESS_DENIED' | 'UNAUTHORIZED' | 'STREAM_NOT_FOUND'>
>;

let env: ReturnType<typeof makeEnv>;
const activate = () => new ActivateStreamUc(env.deps, StreamModuleDef);
const complete = () => new CompleteStreamUc(env.deps, StreamModuleDef);
const archive = () => new ArchiveStreamUc(env.deps, StreamModuleDef);
const input = { streamId: STREAM };

beforeEach(() => {
  env = makeEnv();
});

const statusOf = () => env.streams.restoredOrThrow(STREAM).snapshot().status;

describe.each([
  ['activateStream', activate, 'enrollment'],
  ['completeStream', complete, 'active'],
  ['archiveStream', archive, 'completed'],
] as const)('%s — права и поиск', (_, makeUc, from) => {
  beforeEach(() => env.streams.seed(state(from)));

  it('ментор потока — Ok', async () => {
    expectOk(await makeUc().handle(input, mentor, REQ));
  });

  it('админ, не ментор потока — Ok', async () => {
    expectOk(await makeUc().handle(input, admin, REQ));
  });

  it.each([
    ['чужой ментор', otherMentor],
    ['студент', student],
    ['пользователь с ролью GUEST', guestRole],
  ])('%s — ACCESS_DENIED, статус не меняется', async (__, caller) => {
    const res = (await makeUc().handle(input, caller, REQ)) as Outcome;

    const error = expectErr(res, 'ACCESS_DENIED');
    expect((error.payload as { denyMessage: string }).denyMessage).toContain(
      'Недостаточно прав',
    );
    expect(statusOf()).toBe(from);
    expect(env.streams.saved).toEqual([]);
  });

  it('вызывающий guest — UNAUTHORIZED', async () => {
    const res = (await makeUc().handle(input, anonymous, REQ)) as Outcome;

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'guest',
    });
  });

  it('потока нет — STREAM_NOT_FOUND { streamId }', async () => {
    const other = '99999999-9999-4999-8999-999999999999';
    const res = (await makeUc().handle(
      { streamId: other },
      mentor,
      REQ,
    )) as Outcome;

    const error = expectErr(res, 'STREAM_NOT_FOUND');
    expect(error.kind).toBe('not_found');
    expect(error.label).toBe('Поток не найден');
    expect(error.payload).toEqual({ streamId: other });
  });

  it('событий в шину нет', async () => {
    expectOk(await makeUc().handle(input, mentor, REQ));

    expect(env.ctx.published).toEqual([]);
  });
});

describe('ActivateStreamUc', () => {
  it('enrollment → active, запись сохранена', async () => {
    env.streams.seed(state('enrollment'));

    expectOk(await activate().handle(input, mentor, REQ));

    expect(statusOf()).toBe('active');
    expect(env.streams.saved).toHaveLength(1);
  });

  it('первого шага нет — поток активен, студенты не тронуты', async () => {
    env.streams.seed(state('enrollment', { contentSnapshot: [] }));

    expectOk(await activate().handle(input, mentor, REQ));

    expect(statusOf()).toBe('active');
    expect(env.students.saved).toEqual([]);
  });

  it.each(['active', 'completed', 'archived'] as const)(
    'из %s — STREAM_NOT_ENROLLING, студенты не тронуты, ничего не записано',
    async (from) => {
      env.streams.seed(state(from));

      const res = await activate().handle(input, mentor, REQ);

      expect(expectErr(res, 'STREAM_NOT_ENROLLING').kind).toBe('conflict');
      expect(env.students.saved).toEqual([]);
      expect(env.streams.saved).toEqual([]);
    },
  );

  it('чужой ментор — студенты не тронуты', async () => {
    env.streams.seed(state('enrollment'));

    expectErr(
      await activate().handle(input, otherMentor, REQ),
      'ACCESS_DENIED',
    );

    expect(env.students.saved).toEqual([]);
  });
});

describe('CompleteStreamUc', () => {
  beforeEach(() => env.streams.seed(state('active')));

  it('студентов нет — поток завершён', async () => {
    expectOk(await complete().handle(input, mentor, REQ));

    expect(statusOf()).toBe('completed');
  });

  it.each(['enrollment', 'completed', 'archived'] as const)(
    'из %s — STREAM_NOT_ACTIVE, ничего не записано',
    async (from) => {
      env.streams.seed(state(from));

      const res = await complete().handle(input, mentor, REQ);

      expect(expectErr(res, 'STREAM_NOT_ACTIVE').kind).toBe('conflict');
      expect(env.streams.saved).toEqual([]);
    },
  );

  it('stream.completed в шину не уходит', async () => {
    expectOk(await complete().handle(input, mentor, REQ));

    expect(env.ctx.published).toEqual([]);
  });
});

describe('ArchiveStreamUc', () => {
  it('completed → archived', async () => {
    env.streams.seed(state('completed'));

    expectOk(await archive().handle(input, mentor, REQ));

    expect(statusOf()).toBe('archived');
  });

  it.each(['enrollment', 'active'] as const)(
    'из %s — STREAM_NOT_COMPLETED «В архив можно отправить только завершённый поток.»',
    async (from) => {
      env.streams.seed(state(from));

      const res = await archive().handle(input, mentor, REQ);

      expect(expectErr(res, 'STREAM_NOT_COMPLETED').label).toBe(
        'В архив можно отправить только завершённый поток.',
      );
      expect(statusOf()).toBe(from);
    },
  );

  it('из archived — STREAM_ALREADY_ARCHIVED «Поток уже находится в архиве.»', async () => {
    env.streams.seed(state('archived'));

    const res = await archive().handle(input, mentor, REQ);

    expect(expectErr(res, 'STREAM_ALREADY_ARCHIVED').label).toBe(
      'Поток уже находится в архиве.',
    );
  });
});
