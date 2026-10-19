import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { defineAggregate } from '../domain/aggregate/define-aggregate';
import {
  ArchiveDoneEr,
  CompleteTaskUc,
  ListTasksUc,
  RemindJob,
  TaskDef,
  TaskErrors,
  TaskEvents,
  TaskPolicy,
  TodoFacade,
  TodoModule,
} from '../domain/contracts/contracts.fixture';
import { allOf, anyOf, hasRole } from '../domain/policy/policy';
import { BaseEntityFields, F } from '../kernel/fields/fields';
import { normalize } from './normalize';

const objectSchema = expect.objectContaining({ type: 'object' });

describe('normalize', () => {
  it('ошибка: код, kind, тексты, JSON Schema payload', () => {
    expect(normalize(TaskErrors.NOT_FOUND)).toEqual({
      dmg: 'error',
      code: 'TASK_NOT_FOUND',
      kind: 'not_found',
      label: 'Задача не найдена',
      description: 'Задачи с таким идентификатором нет.',
      payload: undefined,
    });
  });

  it('событие: FQN и JSON Schema payload', () => {
    expect(normalize(TaskEvents.completed)).toEqual({
      dmg: 'event',
      name: 'todo.task.completed',
      label: 'Задача выполнена',
      description: 'Задача отмечена выполненной.',
      payload: objectSchema,
    });
  });

  it('агрегат: схема состояния, группы — FQN и коды', () => {
    expect(normalize(TaskDef)).toEqual({
      dmg: 'aggregate',
      name: 'task',
      label: 'Задача',
      description: 'Пункт списка дел.',
      state: objectSchema,
      statuses: undefined,
      transitions: undefined,
      events: ['todo.task.created', 'todo.task.completed'],
      errors: ['TASK_NOT_FOUND', 'TASK_ALREADY_DONE'],
    });
  });

  it('политика: дерево правил без функций', () => {
    const tree = anyOf(
      { name: 'canEdit', label: 'Редактор', denyMessage: 'Нельзя.' },
      hasRole('admin'),
      allOf(hasRole('author'), TaskPolicy.rules.canComplete),
    );
    expect(normalize(tree)).toEqual({
      dmg: 'rule',
      op: 'anyOf',
      name: 'canEdit',
      label: 'Редактор',
      denyMessage: 'Нельзя.',
      rules: [
        {
          dmg: 'rule',
          op: 'rule',
          name: 'hasRole:admin',
          label: 'Роль admin',
          denyMessage: 'Нужна роль admin.',
          delegable: true,
        },
        {
          dmg: 'rule',
          op: 'allOf',
          rules: [
            expect.objectContaining({ name: 'hasRole:author' }),
            expect.objectContaining({ name: 'isOwner' }),
          ],
        },
      ],
    });
    expect(normalize(TaskPolicy)).toEqual({
      dmg: 'policy',
      name: 'task',
      label: 'Права на задачи',
      description: 'Кто может менять задачи.',
      rules: { canComplete: expect.objectContaining({ name: 'isOwner' }) },
    });
  });

  it('UC: ссылки — имена, FQN и коды; схемы — JSON Schema', () => {
    expect(normalize(CompleteTaskUc)).toEqual({
      dmg: 'useCase',
      name: 'completeTask',
      label: 'Завершить задачу',
      description: 'Отмечает задачу выполненной.',
      type: 'command',
      aggregate: 'task',
      callers: ['user', 'delegate'],
      policy: expect.objectContaining({ op: 'rule', name: 'isOwner' }),
      input: objectSchema,
      output: objectSchema,
      errors: ['TASK_NOT_FOUND', 'TASK_ALREADY_DONE'],
      emits: ['todo.task.completed'],
    });
    expect(normalize(ListTasksUc)).toMatchObject({
      policy: { dmg: 'rule', op: 'allowAll' },
      output: expect.objectContaining({ type: 'array' }),
      emits: [],
    });
  });

  it('ER и Job: ссылки — имена', () => {
    expect(normalize(ArchiveDoneEr)).toEqual({
      dmg: 'eventReaction',
      name: 'archiveDone',
      label: 'Архивировать выполненную',
      description: 'Переносит выполненную задачу в архив.',
      on: ['todo.task.completed', 'todo.task.created'],
      touches: ['task'],
      calls: ['todo'],
      emits: [],
    });
    expect(normalize(RemindJob)).toEqual({
      dmg: 'job',
      name: 'remind',
      label: 'Напоминание',
      description: 'Ежедневно напоминает о задачах.',
      schedule: { kind: 'dailyAt', hour: 6, minute: 0 },
      scans: ['task'],
      emits: [],
    });
  });

  it('фасад и модуль', () => {
    expect(normalize(TodoFacade)).toEqual({
      dmg: 'facade',
      name: 'todo',
      label: 'Фасад задач',
      description: 'API задач для других модулей.',
      methods: {
        isDone: {
          label: 'Задача выполнена?',
          description: 'Проверяет, выполнена ли задача.',
          errors: ['TASK_NOT_FOUND'],
        },
      },
    });
    expect(normalize(TodoModule)).toEqual({
      dmg: 'module',
      name: 'todo',
      label: 'Задачи',
      description: 'Список дел.',
      dependsOn: ['users'],
      aggregates: ['task'],
      useCases: ['completeTask', 'listTasks'],
      reactions: ['archiveDone'],
      jobs: ['remind'],
      facade: 'todo',
    });
  });

  it('стабильность: одинаковый Def — одинаковая сериализация', () => {
    const build = () =>
      defineAggregate({
        name: 'note',
        label: 'Заметка',
        description: 'Заметка со статусом.',
        state: v.object({
          ...BaseEntityFields,
          status: F.picklist(['draft', 'closed'], 'Статус'),
        }),
        statuses: {
          draft: { label: 'Черновик' },
          closed: { label: 'Закрыта' },
        },
        transitions: { close: { from: ['draft'], to: 'closed' } },
        events: {},
        errors: {},
      });
    const a = normalize(build());
    expect(JSON.stringify(a)).toBe(JSON.stringify(normalize(build())));
    expect(a).toMatchObject({
      statuses: { draft: { label: 'Черновик' }, closed: { label: 'Закрыта' } },
      transitions: { close: { from: ['draft'], to: 'closed' } },
    });
  });
});
