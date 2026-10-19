// Фикстура контрактов для тестов dmg: по Def каждого вида.
import * as v from 'valibot';
import { defineErrors } from '../../kernel/errors/define-errors';
import { BaseEntityFields, F } from '../../kernel/fields/fields';
import { defineAggregate } from '../aggregate/define-aggregate';
import { defineEvents } from '../events/define-events';
import { definePolicy } from '../policy/define-policy';
import { allowAll, rule } from '../policy/policy';
import { defineEventReaction } from './define-event-reaction';
import { defineFacade, method } from './define-facade';
import { defineJob } from './define-job';
import { defineModule } from './define-module';
import { defineUseCase } from './define-use-case';

export const TaskEvents = defineEvents('todo.task', {
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

export const TaskErrors = defineErrors('TASK', {
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

export const TaskArDef = defineAggregate({
  name: 'task',
  label: 'Задача',
  description: 'Пункт списка дел.',
  state: v.object({ ...BaseEntityFields, title: F.string('Название') }),
  events: TaskEvents,
  errors: TaskErrors,
});

export const TaskPolicy = definePolicy({
  name: 'task',
  label: 'Права на задачи',
  description: 'Кто может менять задачи.',
  rules: {
    canComplete: rule({
      name: 'isOwner',
      label: 'Владелец',
      denyMessage: 'Только владелец.',
      check: (subject: { id: string }, ctx: { ownerId: string }) =>
        subject.id === ctx.ownerId,
    }),
  },
});

export const CompleteTaskUcDef = defineUseCase({
  name: 'completeTask',
  label: 'Завершить задачу',
  description: 'Отмечает задачу выполненной.',
  type: 'command',
  aggregate: TaskArDef,
  callers: ['user', 'delegate'],
  policy: TaskPolicy.rules.canComplete,
  input: v.object({ taskId: F.uuid('задачи') }),
  output: v.object({ completedAt: F.timestamp('выполнения') }),
  errors: [TaskErrors.NOT_FOUND, TaskErrors.ALREADY_DONE],
  emits: [TaskEvents.completed],
});

export const ListTasksUcDef = defineUseCase({
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

export const TodoFacadeDef = defineFacade({
  name: 'todo',
  label: 'Фасад задач',
  description: 'API задач для других модулей.',
  methods: {
    isDone: method<[taskId: string], boolean>()({
      label: 'Задача выполнена?',
      description: 'Проверяет, выполнена ли задача.',
      errors: [TaskErrors.NOT_FOUND],
    }),
  },
});

export const ArchiveDoneErDef = defineEventReaction({
  name: 'archiveDone',
  label: 'Архивировать выполненную',
  description: 'Переносит выполненную задачу в архив.',
  on: [TaskEvents.completed, TaskEvents.created],
  touches: [TaskArDef],
  calls: [TodoFacadeDef],
});

export const RemindJobDef = defineJob({
  name: 'remind',
  label: 'Напоминание',
  description: 'Ежедневно напоминает о задачах.',
  schedule: { kind: 'dailyAt', hour: 6, minute: 0 },
  scans: [TaskArDef],
  emits: [],
});

export const UsersModuleDef = defineModule({
  name: 'users',
  label: 'Пользователи',
  description: 'Учётные записи.',
  dependsOn: [],
  aggregates: [],
  useCases: [],
  reactions: [],
  jobs: [],
});

export const TodoModuleDef = defineModule({
  name: 'todo',
  label: 'Задачи',
  description: 'Список дел.',
  dependsOn: [UsersModuleDef],
  aggregates: [TaskArDef],
  useCases: [CompleteTaskUcDef, ListTasksUcDef],
  reactions: [ArchiveDoneErDef],
  jobs: [RemindJobDef],
  facade: TodoFacadeDef,
});
