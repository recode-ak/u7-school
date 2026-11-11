import type {
  UserAr,
  UserRole,
  UserSort as UserSortSchema,
} from '@u7-scl/domain/user';
import type { Repository } from 'dmg-core/app';
import type { InferOutput } from 'valibot';

/** Поле и направление сортировки `field:dir` — выход `UserSort` контракта. */
export type UserSort = InferOutput<typeof UserSortSchema>;

/** Необязательные условия выборки пользователей; заданные объединяются по «и». */
export type UserFilter = {
  readonly limit?: number;
  readonly role?: UserRole;
  /** Подстрока имени, регистронезависимо. */
  readonly name?: string;
  readonly telegramId?: number;
  /** Поле и направление `field:dir`. */
  readonly sort?: UserSort;
};

/** Порт репозитория пользователей: принимает и возвращает Ar (API-03). */
export type UserRepo = Repository<UserAr> & {
  findById(uuid: string): Promise<UserAr | undefined>;

  findByTelegramId(telegramId: number): Promise<UserAr | undefined>;

  /**
   * Пользователи по списку uuid; неизвестные пропускаются. Порядок не
   * гарантирован — порядок запроса и дедуп собирает UC.
   */
  findByIds(uuids: string[]): Promise<UserAr[]>;

  /** Пользователи по фильтру; без условий — все. Порядок не гарантирован. */
  findAll(filter?: UserFilter): Promise<UserAr[]>;
};
