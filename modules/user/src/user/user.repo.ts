import type { UserAr, UserRole } from '@u7-scl/domain/user';
import type { Repository } from 'dmg-core/app';

/** Необязательные условия выборки пользователей; заданные объединяются по «и». */
export type UserFilter = {
  readonly limit?: number;
  readonly role?: UserRole;
  /** Подстрока имени, регистронезависимо. */
  readonly name?: string;
  readonly telegramId?: number;
  /** Поле и направление `field:dir`; направление не `asc` — по убыванию. */
  readonly sort?: string;
};

/** Порт репозитория пользователей: принимает и возвращает Ar (API-03). */
export type UserRepo = Repository<UserAr> & {
  findById(uuid: string): Promise<UserAr | undefined>;

  findByTelegramId(telegramId: number): Promise<UserAr | undefined>;

  /**
   * Пользователи по списку uuid в порядке записей файла; неизвестные
   * пропускаются. Порядок запроса и дедуп собирает UC.
   */
  findByIds(uuids: string[]): Promise<UserAr[]>;

  /** Пользователи по фильтру; без условий — все записи файла по порядку. */
  findAll(filter?: UserFilter): Promise<UserAr[]>;
};
