import type { Repository } from '../../../../../app/uow/repository';
import type { UserAr } from '../../../users';

/** Порт репозитория пользователей. */
export type UserRepo = Repository<UserAr> & {
  findById(uuid: string): Promise<UserAr | undefined>;
};
