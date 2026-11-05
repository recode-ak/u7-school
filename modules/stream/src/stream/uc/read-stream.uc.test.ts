import { beforeEach, describe, expect, it } from 'bun:test';
import type { StreamState } from '@u7-scl/domain/stream';
import {
  type ListStreamsUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import type { Caller } from 'dmg-core';
import type { ParsedInputOf } from 'dmg-core/app';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { StreamUser } from '../../stream.module';
import { FindStreamByTelegramGroupUc } from './find-stream-by-telegram-group.uc';
import { GetStreamUc } from './get-stream.uc';
import { GetStreamMembersUc } from './get-stream-members.uc';
import { GetStreamPresenceUc } from './get-stream-presence.uc';
import { ListStreamsUc } from './list-streams.uc';
import {
  admin,
  anonymous,
  MENTOR_ID,
  makeEnv,
  mentor,
  otherMentor,
  REQ,
  SCHOOL,
  STREAM,
  state,
  student,
  system,
} from './stream-uc.fixture';

// Перенос `get-stream-uc`, `list-streams-uc`, `stream-in-proc-facade` (getMembers),
// `get-stream-members.uc`: чтение открыто всем (allowAll), включая гостя;
// ключ записи в ответ не попадает.

let env: ReturnType<typeof makeEnv>;
beforeEach(() => {
  env = makeEnv();
});

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '33333333-3333-4333-8333-333333333334';

describe('GetStreamUc', () => {
  const uc = () => new GetStreamUc(env.deps, StreamModuleDef);
  beforeEach(() =>
    env.streams.seed(state('active', { title: 'Тестовый поток' })),
  );

  it('возвращает поток по streamId (даты — числа)', async () => {
    const view = expectOk(
      await uc().handle({ streamId: STREAM }, student, REQ),
    );

    expect(view).toMatchObject({
      uuid: STREAM,
      title: 'Тестовый поток',
      status: 'active',
      mentorId: MENTOR_ID,
      schoolId: SCHOOL,
    });
    expect(typeof view.startDate).toBe('number');
  });

  it('вызывающий system не допущен (callers: user, guest) — UNAUTHORIZED', async () => {
    const res = await uc().handle({ streamId: STREAM }, system as never, REQ);

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'system',
    });
  });

  it('нет потока — STREAM_NOT_FOUND { streamId }', async () => {
    const other = '99999999-9999-4999-8999-999999999999';

    const error = expectErr(
      await uc().handle({ streamId: other }, student, REQ),
      'STREAM_NOT_FOUND',
    );

    expect(error.payload).toEqual({ streamId: other });
  });

  it.each([
    ['ментор потока', mentor, true],
    ['админ', admin, true],
    ['чужой ментор', otherMentor, false],
    ['студент', student, false],
    ['гость', anonymous, false],
  ] as const)('canManage для: %s — %s', async (_, caller, expected) => {
    const view = expectOk(await uc().handle({ streamId: STREAM }, caller, REQ));

    expect(view.canManage).toBe(expected);
  });

  it('кодовое слово не отдаётся: requiresEnrollmentKey вместо enrollmentKey (С1)', async () => {
    env.streams.seed(state('active', { enrollmentKey: 'секрет' }));

    const view = expectOk(
      await uc().handle({ streamId: STREAM }, student, REQ),
    );

    expect('enrollmentKey' in view).toBe(false);
    expect(view.requiresEnrollmentKey).toBe(true);
  });
});

describe('ListStreamsUc', () => {
  const uc = () => new ListStreamsUc(env.deps, StreamModuleDef);

  type FilterCase = [
    title: string,
    input: ParsedInputOf<typeof ListStreamsUcDef>,
    caller: Caller<StreamUser>,
    seeded: StreamState[],
    filter: object,
    statuses: StreamState['status'][],
  ];

  const filterCases: FilterCase[] = [
    [
      'фильтр status, mentorId, schoolId уходит в репозиторий как есть',
      { status: 'active', mentorId: MENTOR_ID, schoolId: SCHOOL },
      student,
      [state('active')],
      { status: 'active', mentorId: MENTOR_ID, schoolId: SCHOOL },
      ['active'],
    ],
    [
      'только schoolId — фильтр { schoolId }',
      { schoolId: SCHOOL },
      student,
      [state('enrollment')],
      { schoolId: SCHOOL },
      ['enrollment'],
    ],
    [
      'без фильтра — все потоки',
      {},
      anonymous,
      [state('enrollment'), state('archived', { uuid: U1 })],
      {},
      ['enrollment', 'archived'],
    ],
  ];

  it.each(filterCases)(
    '%s',
    async (_, input, caller, seeded, filter, statuses) => {
      env.answerWith(...seeded);

      const list = expectOk(await uc().handle(input, caller, REQ));

      expect(env.asked.filter).toEqual(filter);
      expect(list.map((s) => s.status)).toEqual(statuses);
      expect(list[0]?.schoolId).toBe(SCHOOL);
    },
  );
});

describe('FindStreamByTelegramGroupUc', () => {
  const uc = () => new FindStreamByTelegramGroupUc(env.deps, StreamModuleDef);

  it('группа привязана к потоку — представление потока', async () => {
    env.answerWith(state('active', { telegramGroupId: '-1001234567890' }));

    const view = expectOk(
      await uc().handle({ telegramGroupId: '-1001234567890' }, anonymous, REQ),
    );

    expect(env.asked.telegramGroupId).toBe('-1001234567890');
    expect(view).toMatchObject({ uuid: STREAM, mentorId: MENTOR_ID });
  });

  it('чужая группа — Ok(undefined), не ошибка', async () => {
    env.answerWith(state('active', { telegramGroupId: '-1001234567890' }));

    expect(
      expectOk(await uc().handle({ telegramGroupId: '-100999' }, student, REQ)),
    ).toBeUndefined();
  });

  it('идентификатор группы числом — INPUT_VALIDATION (Т8)', async () => {
    const res = await uc().handle(
      { telegramGroupId: -1001234567890 } as never,
      student,
      REQ,
    );

    expectErr(res, 'INPUT_VALIDATION');
  });
});

describe('GetStreamMembersUc', () => {
  const uc = () => new GetStreamMembersUc(env.deps, StreamModuleDef);

  it('нет потока — Ok(undefined), не ошибка', async () => {
    expect(
      expectOk(await uc().handle({ streamId: STREAM }, system, REQ)),
    ).toBeUndefined();
  });
});

describe('GetStreamPresenceUc', () => {
  const uc = () => new GetStreamPresenceUc(env.deps, StreamModuleDef);

  it('поток есть — exists: true', async () => {
    env.streams.seed(state('active'));

    expect(
      expectOk(await uc().handle({ streamId: STREAM }, system, REQ)),
    ).toEqual({
      exists: true,
    });
  });

  it('потока нет — exists: false без ошибки', async () => {
    expect(
      expectOk(await uc().handle({ streamId: STREAM }, system, REQ)),
    ).toEqual({
      exists: false,
    });
  });
});
