import type { WishState, WishStatus, WishTarget } from './wish.state';

/** Интерфейс репозитория желаний. */
export interface WishRepo {
  /** Сохранить желание. */
  save(state: WishState): Promise<void>;

  /** Получить желание по UUID. */
  getByUuid(uuid: string): Promise<WishState | undefined>;

  /** Получить последнее желание пользователя по цели. */
  getByUserAndTarget(
    userId: string,
    target: WishTarget,
  ): Promise<WishState | undefined>;

  /** Получить все желания пользователя по цели (в любом статусе). */
  findAllByUserAndTarget(
    userId: string,
    target: WishTarget,
  ): Promise<WishState[]>;

  /** Получить все желания пользователя. */
  getByUser(userId: string): Promise<WishState[]>;

  /**
   * Все желания по виду цели (независимо от пользователя).
   * statuses не задан — все статусы; задан — фильтр на стороне хранилища.
   * Идентичность цели (форки) решается фасадом курсов, не выборкой.
   */
  findAllByKind(
    kind: 'course' | 'module',
    statuses?: WishStatus[],
  ): Promise<WishState[]>;
}
