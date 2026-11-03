import type { User, UserFacade } from '@u7-scl/domain/user/contract';
import { GuestCaller, type PersonCaller, UserCaller } from 'dmg-core';
import type { Trace } from 'dmg-core/app';

/**
 * Резолвер `Caller` приложения (D-50): идентичность из транспорта →
 * человек на входе. Пользователя ищет legacy-фасад `user` (адаптер над legacy-фасадом):
 * найден — `UserCaller` над ним; нет идентичности или пользователя нет —
 * гость. Сбой фасада — исключение (ERR-01): тихий гость спрятал бы дефект
 * транспорта или конфигурации за отказом в правах.
 */
export class U7CallerResolver {
  constructor(private readonly users: Pick<UserFacade, 'getUserByUuid'>) {}

  // `trace` — по контракту резолвера (D-50): legacy-фасад след не принимает.
  async resolve(
    uuid: string | undefined,
    _trace: Trace,
  ): Promise<PersonCaller<User>> {
    if (uuid === undefined) return new GuestCaller();
    const user = await this.users.getUserByUuid(uuid);
    return user === undefined ? new GuestCaller() : new UserCaller(user);
  }
}
