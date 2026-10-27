import * as v from 'valibot';
import { defineUseCase } from '#core/domain/contracts/define-use-case';
import { allowAll } from '#core/domain/policy/rule';
import { UserArDef } from '../user.ar';
import { UserErrors } from '../user.errors';
import { UserEvents } from '../user.events';
import { UserState } from '../user.state';

export const RemoveUserUcDef = defineUseCase({
  name: 'removeUser',
  label: 'Удалить пользователя',
  description: 'Удаляет учётную запись; задачи пользователя уходят в архив.',
  type: 'command',
  aggregate: UserArDef,
  callers: ['system'],
  policy: allowAll,
  input: v.object({ userId: UserState.entries.uuid }),
  output: v.object({}),
  errors: [UserErrors.NOT_FOUND, UserErrors.ALREADY_REMOVED],
  emits: [UserEvents.removed],
});
