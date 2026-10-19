import { defineModule } from '../../../domain/contracts/define-module';
import { UserArDef } from './user/user.ar';

export const UsersModuleDef = defineModule({
  name: 'users',
  label: 'Пользователи',
  description: 'Учётные записи (заглушка для учебного модуля todo).',
  dependsOn: [],
  aggregates: [UserArDef],
  useCases: [],
  reactions: [],
  jobs: [],
});
