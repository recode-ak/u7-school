import { type ErrorOf, err, ok, type ReadonlyAr, type Result } from 'dmg-core';
import type { CreateWish, WishAr } from './wish/wish.ar';
import { WishErrors } from './wish/wish.errors';

type AlreadyExists = ErrorOf<typeof WishErrors.ALREADY_EXISTS>;

/**
 * Доменные решения над несколькими желаниями (DOM-06).
 * Синхронный и без состояния: желания загружает вызывающий UC.
 */
export class WishDcs {
  /**
   * Не более одного активного желания на пару (user, target).
   * `wishes` — **все** желания пользователя на цель (не «последнее»):
   * при равных `createdAt` активное может оказаться не первым.
   * Отказ несёт статус существующего — по нему ветвится UI.
   */
  checkUnique(
    userId: string,
    target: CreateWish['target'],
    wishes: readonly ReadonlyAr<WishAr>[],
  ): Result<void, AlreadyExists> {
    const active = wishes.find((wish) => wish.isActive());
    if (active === undefined) return ok();
    const { status } = active;
    return err(
      target.kind === 'course'
        ? WishErrors.ALREADY_EXISTS.make({
            userId,
            courseId: target.courseId,
            status,
          })
        : WishErrors.ALREADY_EXISTS.make({
            userId,
            moduleId: target.moduleId,
            status,
          }),
    );
  }
}
