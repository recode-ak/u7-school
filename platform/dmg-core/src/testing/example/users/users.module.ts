import { ModuleDef } from '#core/domain/contracts/module-def';
import { GetUserUcDef } from './user/uc/get-user.uc';
import { RemoveUserUcDef } from './user/uc/remove-user.uc';
import { UserArDef } from './user/user.ar';

export const UsersModuleDef = ModuleDef.define({
  name: 'users',
  label: 'Пользователи',
  description:
    'Учётные записи — зависимость учебного модуля todo: событие удаления и ответ «активен ли».',
  dependsOn: [],
  aggregates: [UserArDef],
  useCases: [RemoveUserUcDef, GetUserUcDef],
  reactions: [],
  jobs: [],
});
