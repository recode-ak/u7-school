import type { Repository } from '#dmg/app/uow/repository';
import type { UserAr } from '#dmg/testing/example/users/index';

/** Порт репозитория пользователей. */
export type UserRepo = Repository<UserAr> & {
  findById(uuid: string): Promise<UserAr | undefined>;
};
