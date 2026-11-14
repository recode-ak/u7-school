import { UserAr, type UserState } from '@u7-scl/domain/user';
import { UserCaller } from 'dmg-core';
import { ModuleFacades } from 'dmg-core/app';
import { TEST_TRACE, testAppContext } from 'dmg-core/testing';
import { UserRepoFake } from '../user.repo.fake';

/** Общие данные тестов UC пользователей (фейк репозитория, субъекты). */
export const REQ = TEST_TRACE;
export const T0 = Date.UTC(2026, 5, 1, 10);
export const T1 = Date.UTC(2026, 5, 2, 12);

export const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const MEMBER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const OTHER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const MISSING_ID = '99999999-9999-4999-8999-999999999999';

export const userState = (overrides: Partial<UserState> = {}): UserState => ({
  uuid: MEMBER_ID,
  name: 'Иван',
  telegramId: 111,
  roles: ['GUEST'],
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...overrides,
});

export const adminState = userState({
  uuid: ADMIN_ID,
  name: 'Админ',
  telegramId: 1,
  roles: ['ADMIN'],
});

/** Субъекты вызова: Policy зовёт `subject.isAdmin()`, поэтому это настоящий `UserAr`. */
export const asAdmin = new UserCaller(UserAr.restore(adminState));
export const asMember = new UserCaller(
  UserAr.restore(userState({ roles: ['MENTOR'] })),
);

/**
 * Окружение UC: часы стоят на `T1`, фейк репозитория с подключёнными к его
 * памяти выборками (`findByTelegramId`, `findByIds` — в обратном порядке,
 * чтобы порядок запроса держал UC; `findAll` запоминает фильтр в `filters`).
 */
export function makeEnv() {
  const ctx = testAppContext({ at: T1 });
  const users = new UserRepoFake();
  const known = new Set<string>();
  const rows = (): UserAr[] => {
    for (const saved of users.saved) known.add(saved.uuid);
    return [...known]
      .map((id) => users.restored(id))
      .filter((u): u is UserAr => u !== undefined);
  };
  const asked = { byIds: [] as string[][], filters: [] as unknown[] };

  users.findByTelegramId = async (telegramId: number) =>
    rows().find((u) => u.view().telegramId === telegramId);
  users.findByIds = async (ids: string[]) => {
    asked.byIds.push(ids);
    return rows()
      .filter((u) => ids.includes(u.uuid))
      .reverse();
  };
  users.findAll = async (filter: unknown) => {
    asked.filters.push(filter);
    return rows();
  };

  const seed = (...states: UserState[]) => {
    users.seed(...states);
    for (const s of states) known.add(s.uuid);
  };
  return {
    deps: { app: ctx.app, facades: new ModuleFacades(), users },
    users,
    seed,
    asked,
    logs: ctx.logs,
    stored: (uuid: string) => users.restoredOrThrow(uuid).view(),
  };
}
