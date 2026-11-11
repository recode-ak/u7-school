import { beforeEach, describe, expect, it } from 'bun:test';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import type { Result } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import { ActivateStreamUc } from './activate-stream.uc';
import { ArchiveStreamUc } from './archive-stream.uc';
import { CompleteStreamUc } from './complete-stream.uc';
import {
  makeEnv,
  mentor,
  otherMentor,
  REQ,
  STREAM,
  state,
} from './stream-uc.fixture';

// Перенос `api/stream/{activate,complete,archive}-stream-uc.test.ts`.
// Общее: управляет ментор потока или админ (Policy canManage), чужой ментор —
// ACCESS_DENIED, нет потока — STREAM_NOT_FOUND { streamId }.

/** Отказ с кодом: форма, общая для трёх команд (код сужает `expectErr`). */
type Failure<C extends string> = C extends string
  ? { code: C; kind: string; label: string; payload?: unknown }
  : never;

/** Итог любой из трёх команд: общие отказы проверяются одним кодом. */
type Outcome = Result<unknown, Failure<'ACCESS_DENIED' | 'STREAM_NOT_FOUND'>>;

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

  it('чужой ментор — ACCESS_DENIED, статус не меняется', async () => {
    const res = (await makeUc().handle(input, otherMentor, REQ)) as Outcome;

    expectErr(res, 'ACCESS_DENIED');
    expect(statusOf()).toBe(from);
    expect(env.streams.saved).toEqual([]);
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
    expect(error.payload).toEqual({ streamId: other });
  });
});

describe('ActivateStreamUc', () => {
  it('enrollment → active, запись сохранена', async () => {
    env.streams.seed(state('enrollment'));

    expectOk(await activate().handle(input, mentor, REQ));

    expect(statusOf()).toBe('active');
    expect(env.streams.saved).toHaveLength(1);
  });

  it('из active — STREAM_NOT_ENROLLING, студенты не тронуты, ничего не записано', async () => {
    env.streams.seed(state('active'));

    const res = await activate().handle(input, mentor, REQ);

    expect(expectErr(res, 'STREAM_NOT_ENROLLING').kind).toBe('conflict');
    expect(env.students.saved).toEqual([]);
    expect(env.streams.saved).toEqual([]);
  });
});

describe('CompleteStreamUc', () => {
  beforeEach(() => env.streams.seed(state('active')));

  it('студентов нет — поток завершён', async () => {
    expectOk(await complete().handle(input, mentor, REQ));

    expect(statusOf()).toBe('completed');
  });

  it('из enrollment — STREAM_NOT_ACTIVE, ничего не записано', async () => {
    env.streams.seed(state('enrollment'));

    const res = await complete().handle(input, mentor, REQ);

    expect(expectErr(res, 'STREAM_NOT_ACTIVE').kind).toBe('conflict');
    expect(env.streams.saved).toEqual([]);
  });
});

describe('ArchiveStreamUc', () => {
  it('completed → archived', async () => {
    env.streams.seed(state('completed'));

    expectOk(await archive().handle(input, mentor, REQ));

    expect(statusOf()).toBe('archived');
  });

  it('из enrollment — STREAM_NOT_COMPLETED, статус не меняется', async () => {
    env.streams.seed(state('enrollment'));

    const res = await archive().handle(input, mentor, REQ);

    expectErr(res, 'STREAM_NOT_COMPLETED');
    expect(statusOf()).toBe('enrollment');
  });
});
