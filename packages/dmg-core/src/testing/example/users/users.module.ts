import { defineModule } from '#core/domain/contracts/define-module';
import { GetUserUcDef } from './user/uc/get-user.uc';
import { RemoveUserUcDef } from './user/uc/remove-user.uc';
import { UserArDef } from './user/user.ar';

export const UsersModuleDef = defineModule({
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
