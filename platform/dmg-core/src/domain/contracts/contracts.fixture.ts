// Фикстура контрактов для тестов dmg: по Def каждого вида.
import * as v from 'valibot';
import { ErrorDef } from '#core/kernel/errors/error-def';
import { BaseEntityFields, F } from '#core/kernel/fields/fields';
import { AggregateDef } from '../aggregate/aggregate-def';
import { EventDef } from '../events/event-def';
import { PolicyDef } from '../policy/policy-def';
import { allowAll, Rule } from '../policy/rule';
import { EventReactionDef } from './event-reaction-def';
import { JobDef } from './job-def';
import { ModuleDef } from './module-def';
import { UseCaseDef } from './use-case-def';

export const TaskEvents = EventDef.define('todo.task', {
  created: {
    label: 'Задача создана',
    description: 'Появилась новая задача.',
    payload: v.object({ taskId: v.string() }),
  },
  completed: {
    label: 'Задача выполнена',
    description: 'Задача отмечена выполненной.',
    payload: v.object({ taskId: v.string() }),
  },
});

export const TaskErrors = ErrorDef.define('TASK', {
  NOT_FOUND: {
    kind: 'not_found',
    label: 'Задача не найдена',
    description: 'Задачи с таким идентификатором нет.',
  },
  ALREADY_DONE: {
    kind: 'conflict',
    label: 'Задача уже выполнена',
    description: 'Повторно завершить задачу нельзя.',
  },
});

export const TaskArDef = AggregateDef.define({
  name: 'task',
  label: 'Задача',
  description: 'Пункт списка дел.',
  state: v.object({ ...BaseEntityFields, title: F.string('Название') }),
  events: TaskEvents,
  errors: TaskErrors,
});

export const TaskPolicy = PolicyDef.define({
  name: 'task',
  label: 'Права на задачи',
  description: 'Кто может менять задачи.',
  rules: {
    canComplete: Rule.of({
      name: 'isOwner',
      label: 'Владелец',
      denyMessage: 'Только владелец.',
      check: (subject: { id: string }, ctx: { ownerId: string }) =>
        subject.id === ctx.ownerId,
    }),
  },
});

export const UserArDef = AggregateDef.define({
  name: 'user',
  label: 'Пользователь',
  description: 'Учётная запись.',
  state: v.object({ ...BaseEntityFields }),
  events: {},
  errors: {},
});

/** UC другого модуля — цель `calls` (D-42). */
export const GetUserUcDef = UseCaseDef.define({
  name: 'getUser',
  label: 'Пользователь',
  description: 'Учётная запись по идентификатору.',
  type: 'query',
  aggregate: UserArDef,
  callers: ['system'],
  policy: allowAll,
  input: v.object({ userId: F.uuid('пользователя') }),
  output: v.object({ userId: F.uuid('пользователя') }),
  errors: [],
});

export const CompleteTaskUcDef = UseCaseDef.define({
  name: 'completeTask',
  label: 'Завершить задачу',
  description: 'Отмечает задачу выполненной.',
  type: 'command',
  aggregate: TaskArDef,
  callers: ['user', 'delegate'],
  policy: TaskPolicy.rules.canComplete,
  calls: [GetUserUcDef],
  input: v.object({ taskId: F.uuid('задачи') }),
  output: v.object({ completedAt: F.timestamp('выполнения') }),
  errors: [TaskErrors.NOT_FOUND, TaskErrors.ALREADY_DONE],
  emits: [TaskEvents.completed],
});

export const ListTasksUcDef = UseCaseDef.define({
  name: 'listTasks',
  label: 'Список задач',
  description: 'Все задачи пользователя.',
  type: 'query',
  aggregate: TaskArDef,
  callers: ['user'],
  policy: allowAll,
  input: v.object({}),
  output: v.array(v.object({ taskId: F.uuid('задачи') })),
  errors: [],
});

export const ArchiveDoneErDef = EventReactionDef.define({
  name: 'archiveDone',
  label: 'Архивировать выполненную',
  description: 'Переносит выполненную задачу в архив.',
  on: [TaskEvents.completed, TaskEvents.created],
  touches: [TaskArDef],
});

export const RemindJobDef = JobDef.define({
  name: 'remind',
  label: 'Напоминание',
  description: 'Ежедневно напоминает о задачах.',
  schedule: { kind: 'dailyAt', hour: 6, minute: 0 },
  scans: [TaskArDef],
  emits: [],
});

export const UsersModuleDef = ModuleDef.define({
  name: 'users',
  label: 'Пользователи',
  description: 'Учётные записи.',
  dependsOn: [],
  aggregates: [UserArDef],
  useCases: [GetUserUcDef],
  reactions: [],
  jobs: [],
});

export const TodoModuleDef = ModuleDef.define({
  name: 'todo',
  label: 'Задачи',
  description: 'Список дел.',
  dependsOn: [UsersModuleDef],
  aggregates: [TaskArDef],
  useCases: [CompleteTaskUcDef, ListTasksUcDef],
  reactions: [ArchiveDoneErDef],
  jobs: [RemindJobDef],
});
