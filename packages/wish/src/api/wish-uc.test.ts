import { describe, expect, test } from 'bun:test';
import { AppException } from '@u7-scl/core/domain';
import type { CancelWishCmdMeta } from '@u7-scl/domain/wish';
import { WishErrors } from '@u7-scl/domain/wish/contract';
import { WishUseCase } from './wish-uc';

const userId = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const courseId = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

/** UC-заглушка с публичным доступом к `throwWishError` (мета — отмена). */
class ProbeUc extends WishUseCase<CancelWishCmdMeta> {
  protected readonly ucName = 'cancel-wish' as const;
  protected readonly ucLabel = 'probe' as const;
  protected readonly arMeta = {
    arName: 'Wish' as const,
    arLabel: 'Желание' as const,
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = undefined as never;
  protected readonly outputSchema = undefined as never;
  async execute(): Promise<undefined> {
    return undefined;
  }
  notFound() {
    this.throwWishError(WishErrors.NOT_FOUND.make({ userId, courseId }));
  }
  foreign() {
    this.throwWishError(
      // @ts-expect-error ALREADY_EXISTS не объявлена в errors меты cancel-wish
      WishErrors.ALREADY_EXISTS.make({ userId, courseId, status: 'pending' }),
    );
  }
}

describe('WishUseCase.throwWishError', () => {
  test('ошибка из меты бросается как AppException', () => {
    const uc = new ProbeUc();
    expect(() => uc.notFound()).toThrow(AppException);
  });
});
