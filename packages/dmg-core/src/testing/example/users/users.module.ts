import { defineModule } from '#core/domain/contracts/define-module';
import { RemoveUserUcDef } from './user/uc/remove-user.uc';
import { UserArDef } from './user/user.ar';

export const UsersModuleDef = defineModule({
  name: 'users',
  label: 'Пользователи',
  description: 'Учётные записи — минимальная зависимость учебного модуля todo.',
  dependsOn: [],
  aggregates: [UserArDef],
  useCases: [RemoveUserUcDef],
  reactions: [],
  jobs: [],
});
