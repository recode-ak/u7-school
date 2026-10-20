import { describe, expect, mock, test } from 'bun:test';
import { Role, type User } from '@u7-scl/app/domain';
import type { WishState } from '@u7-scl/domain/wish';
import { WishAr } from '@u7-scl/domain/wish';
import type { WishApiModuleResolver } from '../../wish';
import { CancelWishUc } from './cancel-wish-uc';

function makeUser(uuid: string): User {
  return {
    uuid,
    name: 'Актор',
    telegramId: 1,
    roles: [Role.STUDENT],
    createdAt: '2026-01-01T00:00',
  };
}

function setupUc() {
  const save = mock(async (_wish: WishAr): Promise<void> => {});
  const findCurrentByUserAndTarget = mock(
    async (
      _userId: string,
      _target: WishState['target'],
    ): Promise<WishAr | undefined> => undefined,
  );

  const wishRepo = { save, findCurrentByUserAndTarget };

  const uc = new CancelWishUc();
  uc.init({ wishRepo } as unknown as WishApiModuleResolver);

  return { save, findCurrentByUserAndTarget, uc };
}

function makeExpressedWish(userId: string, courseId: string): WishState {
  return {
    uuid: crypto.randomUUID(),
    userId,
    target: { kind: 'course', courseId },
    status: 'expressed',
    createdAt: Date.UTC(2026, 0, 1, 10),
    updatedAt: Date.UTC(2026, 0, 1, 10),
    version: 0,
  };
}

describe('CancelWishUc', () => {
  const actorId = crypto.randomUUID();
  const actor = makeUser(actorId);
  const courseId = crypto.randomUUID();

  test('отменяет выраженное желание', async () => {
    const { save, findCurrentByUserAndTarget, uc } = setupUc();
    findCurrentByUserAndTarget.mockResolvedValueOnce(
      WishAr.restore(makeExpressedWish(actorId, courseId)),
    );

    await uc.handle({ kind: 'course', courseId }, actor);

    expect(save).toHaveBeenCalledTimes(1);
    const saved = (
      (save as ReturnType<typeof mock>).mock.calls[0]![0] as WishAr
    ).snapshot();
    expect(saved.status).toBe('cancelled');
  });

  test('отменяет подтверждённое желание', async () => {
    const { save, findCurrentByUserAndTarget, uc } = setupUc();
    findCurrentByUserAndTarget.mockResolvedValueOnce(
      WishAr.restore({
        ...makeExpressedWish(actorId, courseId),
        status: 'confirmed' as const,
      }),
    );

    await uc.handle({ kind: 'course', courseId }, actor);

    expect(save).toHaveBeenCalledTimes(1);
    const saved = (
      (save as ReturnType<typeof mock>).mock.calls[0]![0] as WishAr
    ).snapshot();
    expect(saved.status).toBe('cancelled');
  });

  test('выбрасывает WISH_NOT_FOUND для pending (отмена только через abandon)', async () => {
    const { save, findCurrentByUserAndTarget, uc } = setupUc();
    findCurrentByUserAndTarget.mockResolvedValueOnce(
      WishAr.restore({
        ...makeExpressedWish(actorId, courseId),
        status: 'pending' as const,
      }),
    );

    await expect(
      uc.handle({ kind: 'course', courseId }, actor),
    ).rejects.toThrow('Желание не найдено');
    expect(save).toHaveBeenCalledTimes(0);
  });

  test('выбрасывает WISH_NOT_FOUND если желания нет', async () => {
    const { uc } = setupUc();

    await expect(
      uc.handle({ kind: 'course', courseId }, actor),
    ).rejects.toThrow('Желание не найдено');
  });

  test('выбрасывает WISH_NOT_FOUND если желание уже отменено', async () => {
    const { findCurrentByUserAndTarget, uc } = setupUc();
    findCurrentByUserAndTarget.mockResolvedValueOnce(
      WishAr.restore({
        ...makeExpressedWish(actorId, courseId),
        status: 'cancelled' as const,
      }),
    );

    await expect(
      uc.handle({ kind: 'course', courseId }, actor),
    ).rejects.toThrow('Желание не найдено');
  });

  // ── Вариант команды: module ──

  test('отменяет module-желание по варианту { kind: module, moduleId }', async () => {
    const moduleId = crypto.randomUUID();
    const { save, findCurrentByUserAndTarget, uc } = setupUc();
    findCurrentByUserAndTarget.mockResolvedValueOnce(
      WishAr.restore({
        ...makeExpressedWish(actorId, courseId),
        target: { kind: 'module', moduleId },
      }),
    );

    await uc.handle({ kind: 'module', moduleId }, actor);

    expect(findCurrentByUserAndTarget).toHaveBeenCalledWith(actorId, {
      kind: 'module',
      moduleId,
    });
    expect(save).toHaveBeenCalledTimes(1);
    const saved = (
      (save as ReturnType<typeof mock>).mock.calls[0]![0] as WishAr
    ).snapshot();
    expect(saved.status).toBe('cancelled');
  });

  test('module-вариант: неактивное желание — WISH_NOT_FOUND', async () => {
    const moduleId = crypto.randomUUID();
    const { save, findCurrentByUserAndTarget, uc } = setupUc();
    findCurrentByUserAndTarget.mockResolvedValueOnce(
      WishAr.restore({
        ...makeExpressedWish(actorId, courseId),
        target: { kind: 'module', moduleId },
        status: 'fulfilled' as const,
      }),
    );

    await expect(
      uc.handle({ kind: 'module', moduleId }, actor),
    ).rejects.toThrow('Желание не найдено');
    expect(save).not.toHaveBeenCalled();
  });

  test('ошибка «не найдено» — код WISH_NOT_FOUND, kind not-found, payload цели', async () => {
    const { uc } = setupUc();

    await expect(
      uc.handle({ kind: 'course', courseId }, actor),
    ).rejects.toMatchObject({
      error: {
        name: 'WISH_NOT_FOUND',
        kind: 'not-found',
        message: 'Желание не найдено',
        payload: { userId: actorId, courseId },
      },
    });
  });

  test('чужое желание — отказ Policy: ACCESS_DENIED, kind access-denied, нет сохранения', async () => {
    const { save, findCurrentByUserAndTarget, uc } = setupUc();
    findCurrentByUserAndTarget.mockResolvedValueOnce(
      WishAr.restore(makeExpressedWish(crypto.randomUUID(), courseId)),
    );

    await expect(
      uc.handle({ kind: 'course', courseId }, actor),
    ).rejects.toMatchObject({
      error: {
        name: 'ACCESS_DENIED',
        kind: 'access-denied',
        message: 'Отменить желание может только его автор.',
        payload: { rule: 'isAuthor' },
      },
    });
    expect(save).not.toHaveBeenCalled();
  });
});
