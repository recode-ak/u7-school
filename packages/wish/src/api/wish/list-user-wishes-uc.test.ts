import { describe, expect, mock, test } from 'bun:test';
import { Role, type User } from '@u7-scl/app/domain';
import type { WishApiModuleResolver, WishState } from '@u7-scl/domain/wish';
import { ListUserWishesUc } from './list-user-wishes-uc';

function makeUser(uuid: string): User {
  return {
    uuid,
    name: 'Актор',
    telegramId: 1,
    roles: [Role.STUDENT],
    createdAt: '2026-01-01T00:00',
  };
}

function setupUc(states: WishState[] = []) {
  const getByUser = mock(
    async (_userId: string): Promise<WishState[]> => states,
  );

  const uc = new ListUserWishesUc();
  uc.init({ wishRepo: { getByUser } } as unknown as WishApiModuleResolver);

  return { getByUser, uc };
}

function makeWish(
  overrides: Partial<WishState> = {},
  targetCourseId = crypto.randomUUID(),
): WishState {
  return {
    uuid: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    target: { kind: 'course', courseId: targetCourseId },
    status: 'expressed',
    createdAt: Date.UTC(2026, 0, 1, 10),
    updatedAt: Date.UTC(2026, 0, 1, 10),
    version: 0,
    ...overrides,
  };
}

describe('ListUserWishesUc', () => {
  const actorId = crypto.randomUUID();
  const actor = makeUser(actorId);

  test('возвращает все желания пользователя (батч для каталога курсов)', async () => {
    const wishes = [
      makeWish(),
      makeWish({ status: 'confirmed' as const }),
      makeWish({ target: { kind: 'module', moduleId: crypto.randomUUID() } }),
    ];
    const { getByUser, uc } = setupUc(wishes);

    const result = await uc.handle({}, actor);

    expect(getByUser).toHaveBeenCalledWith(actorId);
    expect(result).toEqual(wishes);
  });

  test('желаний нет — пустой список', async () => {
    const { uc } = setupUc([]);

    const result = await uc.handle({}, actor);

    expect(result).toEqual([]);
  });
});
