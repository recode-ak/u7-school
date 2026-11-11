import { mock } from 'bun:test';
import { UserErrors, type UserView } from '@u7-scl/domain/user/contract';
import type { Command } from 'dmg-core';

/** Отказ UC модуля `user` в моке `dispatch`: ответ-значение `Err`. */
export const userErr = (code: string, kind = 'conflict') => ({
  ok: false as const,
  error: { code, kind, label: code },
});

const ok = <T>(value: T) => ({ ok: true as const, value });

/** Профиль пользователя в форме `UserView` (даты — числа). */
export const userView = (overrides: Partial<UserView> = {}): UserView => ({
  uuid: '77777777-7777-4777-8777-777777777777',
  name: 'Анна',
  telegramId: 555,
  roles: ['GUEST'],
  createdAt: 1,
  updatedAt: 1,
  version: 0,
  ...overrides,
});

export const BOT_ADMIN_UUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/**
 * Приложение с модулем `user` на моках для `ensureRegisteredGuest`: поиск по
 * `telegramId` и регистрация гостя отвечают заданными значениями, вызовы
 * видны в `dispatch.mock.calls` (модуль, команда, `Caller`, след), а запросы
 * резолвера `Caller` — в `callers.resolve.mock.calls`.
 */
export function userApiMock(
  opts: {
    /** Ответ `getUserByTelegramId`: профиль или `Err`; по умолчанию — не найден. */
    lookup?: UserView | ReturnType<typeof userErr>;
    /** Ответ `registerGuest`; по умолчанию — новый гость. */
    register?: UserView | ReturnType<typeof userErr>;
  } = {},
) {
  const answerOf = (value: UserView | ReturnType<typeof userErr>) =>
    'error' in value ? value : ok(value);
  const dispatch = mock(
    async (_module: unknown, command: Command, _caller: unknown) => {
      if (command.uc === 'getUserByTelegramId') {
        return opts.lookup === undefined
          ? userErr(UserErrors.NOT_FOUND.code, 'not_found')
          : answerOf(opts.lookup);
      }
      if (command.uc === 'registerGuest') {
        return answerOf(opts.register ?? userView());
      }
      throw new Error(`Нет ответа на UC user: ${command.uc}`);
    },
  );
  const callers = {
    resolve: mock(async (uuid: string | undefined, _trace: unknown) => ({
      uuid,
    })),
  };
  return {
    appApi: { dispatch } as never,
    callers: callers as never,
    botAdminUuid: BOT_ADMIN_UUID,
    dispatch,
    resolve: callers.resolve,
    /** Команды, ушедшие в `dispatch`, в порядке вызова. */
    commands: () => dispatch.mock.calls.map((c) => c[1] as Command),
  };
}
