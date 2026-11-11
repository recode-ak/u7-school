import {
  GetUserByTelegramIdUcDef,
  GetUserUcDef,
  UserAr,
  UserErrors,
  UserModuleDef,
  type UserView,
} from '@u7-scl/domain/user/contract';
import {
  GuestCaller,
  type Identified,
  type OperationRef,
  type PersonCaller,
  type ReadonlyAr,
  type Result,
  SystemCaller,
  UserCaller,
} from 'dmg-core';
import type { ApiApp, Trace } from 'dmg-core/app';

/**
 * Откуда вызов `user.getUser` при разборе вызывающего (D-51): `getUser`
 * допускает системного вызывающего, резолвер — вход корня сборки.
 */
const RESOLVER: OperationRef = {
  kind: 'app',
  module: 'u7-app',
  name: 'resolveCaller',
};

/**
 * Резолвер `Caller` приложения: идентичность из транспорта →
 * человек на входе. Пользователя читает UC `user.getUser` от системы;
 * субъект — `UserAr` (D-69), восстановленный вне модуля. Нет идентичности
 * или пользователя нет — гость; прочий отказ UC — исключение (ERR-01):
 * тихий гость спрятал бы дефект транспорта или конфигурации за отказом в
 * правах.
 */
export class U7CallerResolver {
  private readonly system = new SystemCaller<ReadonlyAr<UserAr>>(RESOLVER);

  constructor(private readonly api: Pick<ApiApp<Identified>, 'dispatch'>) {}

  async resolve(
    uuid: string | undefined,
    trace: Trace,
  ): Promise<PersonCaller<ReadonlyAr<UserAr>>> {
    if (uuid === undefined) return new GuestCaller();
    const res = await this.api.dispatch(
      UserModuleDef,
      GetUserUcDef.command({ uuid }),
      this.system,
      trace,
    );
    return this.#personOf(res, 'user.getUser');
  }

  /**
   * Тот же разбор по telegramId (вход бота): `user.getUserByTelegramId`
   * от системы; нет пользователя — гость, прочий отказ — исключение.
   */
  async resolveByTelegramId(
    telegramId: number,
    trace: Trace,
  ): Promise<PersonCaller<ReadonlyAr<UserAr>>> {
    const res = await this.api.dispatch(
      UserModuleDef,
      GetUserByTelegramIdUcDef.command({ telegramId }),
      this.system,
      trace,
    );
    return this.#personOf(res, 'user.getUserByTelegramId');
  }

  /** Разбор результата чтения пользователя: `Ok` → человек, `NOT_FOUND` → гость. */
  #personOf<E extends { code: string }>(
    res: Result<UserView, E>,
    uc: string,
  ): PersonCaller<ReadonlyAr<UserAr>> {
    if (!res.ok) {
      if (res.error.code === UserErrors.NOT_FOUND.code)
        return new GuestCaller();
      throw new Error(`Резолвер Caller: ${uc} вернул ${res.error.code}`);
    }
    return new UserCaller(UserAr.restore(res.value));
  }
}
