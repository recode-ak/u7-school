import { defineModule } from '../../../domain/contracts/define-module';
import { UserDef } from './user/user.ar';

export const UsersModule = defineModule({
  name: 'users',
  label: 'Пользователи',
  description: 'Учётные записи (заглушка для учебного модуля todo).',
  dependsOn: [],
  aggregates: [UserDef],
  useCases: [],
  reactions: [],
  jobs: [],
});
