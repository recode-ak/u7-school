import { beforeEach, describe, expect, it } from 'bun:test';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { GuestCaller, SystemCaller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import { GetUsersByIdsUc } from './get-users-by-ids.uc';
import {
  ADMIN_ID,
  adminState,
  asMember,
  MEMBER_ID,
  MISSING_ID,
  makeEnv,
  OTHER_ID,
  REQ,
  userState,
} from './user-uc.fixture';

// Перенос `api/user/get-users-by-ids-uc.test.ts` (5 → 4: «возвращает всех»
// слилось с порядком). Порог 100 — граница схемы входа Def.

let env: ReturnType<typeof makeEnv>;
const uc = () => new GetUsersByIdsUc(env.deps, UserModuleDef);
const ivan = userState({ name: 'Иван' });
const maria = userState({ uuid: OTHER_ID, name: 'Мария', telegramId: 222 });

beforeEach(() => {
  env = makeEnv();
  env.seed(ivan, maria, adminState);
});

describe('GetUsersByIdsUc', () => {
  it('пустой вход — пустой список, репозиторий не спрашивается', async () => {
    expect(expectOk(await uc().handle({ userIds: [] }, asMember, REQ))).toEqual(
      [],
    );
    expect(env.asked.byIds).toEqual([]);
  });

  it('порядок запроса и дедуп: повтор uuid не удваивает карточку', async () => {
    const res = await uc().handle(
      { userIds: [OTHER_ID, MEMBER_ID, OTHER_ID, ADMIN_ID] },
      asMember,
      REQ,
    );

    expect(expectOk(res)).toEqual([maria, ivan, adminState]);
    expect(env.asked.byIds).toEqual([[OTHER_ID, MEMBER_ID, ADMIN_ID]]);
  });

  it('часть не найдена — вернулись найденные, пропуск — warn в журнале', async () => {
    const res = await uc().handle(
      { userIds: [MEMBER_ID, MISSING_ID] },
      asMember,
      REQ,
    );

    expect(expectOk(res)).toEqual([ivan]);
    const warns = env.logs.filter((r) => r.level === 'warn');
    expect(warns).toHaveLength(1);
    expect(warns[0]?.source).toBe('user');
  });

  it.each([
    [
      'система',
      new SystemCaller({ kind: 'useCase', module: 'probe', name: 'p' }),
    ],
    ['гость', new GuestCaller()],
  ])(
    'без пользователя-актора (%s) — отвечает (peer-review invite)',
    async (_n, caller) => {
      const res = await uc().handle({ userIds: [MEMBER_ID] }, caller, REQ);

      expect(expectOk(res)).toEqual([ivan]);
    },
  );

  it('больше 100 идентификаторов — INPUT_VALIDATION, репозиторий не спрашивается', async () => {
    const userIds = Array.from({ length: 101 }, () => crypto.randomUUID());

    expectErr(
      await uc().handle({ userIds }, asMember, REQ),
      'INPUT_VALIDATION',
    );
    expect(env.asked.byIds).toEqual([]);
  });

  it('ровно 100 идентификаторов — принимается', async () => {
    const userIds = Array.from({ length: 100 }, () => crypto.randomUUID());

    expect(expectOk(await uc().handle({ userIds }, asMember, REQ))).toEqual([]);
  });
});
