import type { ModuleDeps } from '#dmg/app/context';
import { ModuleFromDef, type ModuleMap } from '#dmg/app/module/module-from-def';
import { UsersModuleDef } from '#dmg/testing/example/users/index';
import type { ExampleUser } from '../app-user';
import { RemoveUserUc } from './user/uc/remove-user.uc';
import type { UserRepo } from './user/user.repo';

export type UsersDeps = ModuleDeps & { readonly users: UserRepo };

/** Карта «Def → класс» модуля users (API-05). */
export const usersMap = {
  useCases: { removeUser: RemoveUserUc },
  reactions: {},
  jobs: {},
} satisfies ModuleMap<typeof UsersModuleDef, UsersDeps, ExampleUser>;

/** Модуль users с зависимостями — для `ApiApp.addDmgModules`. */
export function createUsersModule(deps: UsersDeps) {
  return new ModuleFromDef<typeof UsersModuleDef, UsersDeps, ExampleUser>(
    UsersModuleDef,
    usersMap,
    deps,
  );
}
