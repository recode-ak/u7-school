import {
  GetUsersByIdsUcDef,
  type UserModuleDef,
  type UserView,
} from '@u7-scl/domain/user/contract';
import { type Identified, ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { UserDeps } from '../../user.module';

type Input = ParsedInputOf<typeof GetUsersByIdsUcDef>;

/**
 * Профили одним запросом к порту: дубли отбрасываются, порядок — как во
 * входе, ненайденные пропускаются с предупреждением в журнал (UI рисует
 * запасной вариант карточки). Пустой вход — пустой ответ без запроса.
 */
export class GetUsersByIdsUc extends UseCaseFromDef<
  typeof GetUsersByIdsUcDef,
  UserDeps,
  undefined,
  Identified
> {
  constructor(deps: UserDeps, module: typeof UserModuleDef) {
    super(GetUsersByIdsUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute({ userIds }: Input) {
    if (userIds.length === 0) return ok([]);

    const unique = [...new Set(userIds)];
    const found = await this.resolve.users.findByIds(unique);
    const byUuid = new Map(found.map((user) => [user.uuid, user]));
    const views: UserView[] = [];
    const missing: string[] = [];
    for (const uuid of unique) {
      const user = byUuid.get(uuid);
      if (user === undefined) {
        missing.push(uuid);
      } else {
        views.push(user.view());
      }
    }
    if (missing.length > 0) {
      this.resolve.app.logger.warn(
        'user',
        'get-users-by-ids: часть пользователей не найдена',
        { missing },
      );
    }
    return ok(views);
  }
}
