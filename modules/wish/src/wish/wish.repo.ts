import type { WishAr, WishStatus, WishTargetVo } from '@u7-scl/domain/wish';
import type { Repository } from 'dmg-core/app';

/** Порт репозитория желаний: принимает и возвращает Ar (API-03). */
export type WishRepo = Repository<WishAr> & {
  /** Желание по UUID. */
  findById(uuid: string): Promise<WishAr | undefined>;

  /** Все желания пользователя по цели (в любом статусе). */
  findAllByUserAndTarget(
    userId: string,
    target: WishTargetVo,
  ): Promise<WishAr[]>;

  /** Все желания пользователя. */
  findByUser(userId: string): Promise<WishAr[]>;

  /**
   * Все желания по виду цели (независимо от пользователя).
   * statuses не задан — все статусы; задан — фильтр на стороне хранилища.
   * Идентичность цели (форки) решается фасадом курсов, не выборкой.
   */
  findAllByKind(
    kind: 'course' | 'module',
    statuses?: WishStatus[],
  ): Promise<WishAr[]>;
};
