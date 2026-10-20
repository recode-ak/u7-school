import type { Repository } from '#core/app/uow/repository';
import type { UserAr } from '#core/testing/example/users/index';

/** Порт репозитория пользователей. */
export type UserRepo = Repository<UserAr> & {
  findById(uuid: string): Promise<UserAr | undefined>;
};
