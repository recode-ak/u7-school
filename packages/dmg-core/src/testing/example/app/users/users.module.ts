import type { ModuleDeps } from '#core/app/context';
import {
  ModuleFromDef,
  type ModuleMap,
} from '#core/app/module/module-from-def';
import { UsersModuleDef } from '#core/testing/example/users/index';
import type { ExampleUser } from '../app-user';
import { GetUserUc } from './user/uc/get-user.uc';
import { RemoveUserUc } from './user/uc/remove-user.uc';
import type { UserRepo } from './user/user.repo';

export type UsersDeps = ModuleDeps & { readonly users: UserRepo };

/** Карта «Def → класс» модуля users (API-05). */
export const usersMap = {
  useCases: { removeUser: RemoveUserUc, getUser: GetUserUc },
  reactions: {},
  jobs: {},
} satisfies ModuleMap<typeof UsersModuleDef, UsersDeps, ExampleUser>;

/** Модуль users с зависимостями — для сборки приложения. */
export function createUsersModule(deps: UsersDeps) {
  return new ModuleFromDef<typeof UsersModuleDef, UsersDeps, ExampleUser>(
    UsersModuleDef,
    usersMap,
    deps,
  );
}
