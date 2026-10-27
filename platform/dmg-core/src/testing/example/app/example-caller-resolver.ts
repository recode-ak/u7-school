import type { ApiApp } from '#core/app/api-app/api-app';
import {
  GuestCaller,
  type OperationRef,
  type PersonCaller,
  SystemCaller,
  UserCaller,
} from '#core/kernel/caller/caller';
import type { Trace } from '#core/kernel/trace/trace';
import {
  GetUserUcDef,
  UserErrors,
  UsersModuleDef,
} from '#core/testing/example/users/contract';
import type { ExampleUser } from './app-user';

/**
 * Откуда вызов `users` при разборе вызывающего: `getUser` — только для
 * системы, резолвер — вход корня сборки (D-51).
 */
const RESOLVER: OperationRef = {
  kind: 'app',
  module: 'example-app',
  name: 'resolveCaller',
};

/**
 * Резолвер `Caller` приложения (D-50): идентичность из транспорта →
 * человек на входе. Активен ли пользователь, решает `users` (`getUser`);
 * нет идентичности, пользователя нет (`USER_NOT_FOUND`) или он удалён —
 * гость. Прочий отказ `getUser` (модуль не подключён, невалидный uuid от
 * транспорта, сбой) — исключение (ERR-01): это дефект конфигурации или
 * транспорта, а тихий гость спрятал бы его за отказом в правах.
 */
export class ExampleCallerResolver {
  private readonly system = new SystemCaller<ExampleUser>(RESOLVER);

  constructor(private readonly api: ApiApp<ExampleUser>) {}

  async resolve(
    uuid: string | undefined,
    trace: Trace,
  ): Promise<PersonCaller<ExampleUser>> {
    if (uuid === undefined) return new GuestCaller();
    const res = await this.api.dispatch(
      UsersModuleDef,
      GetUserUcDef.command({ userId: uuid }),
      this.system,
      trace,
    );
    if (!res.ok) {
      if (res.error.code === UserErrors.NOT_FOUND.code)
        return new GuestCaller();
      throw new Error(
        `Резолвер Caller: users.getUser вернул ${res.error.code}`,
      );
    }
    if (!res.value.active) return new GuestCaller();
    // Ролей в домене users нет — субъект без ролей.
    return new UserCaller({ uuid, hasRole: () => false });
  }
}
