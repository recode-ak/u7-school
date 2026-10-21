import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { defineAggregate } from '../domain/aggregate/define-aggregate';
import {
  ArchiveDoneErDef,
  CompleteTaskUcDef,
  GetUserUcDef,
  ListTasksUcDef,
  RemindJobDef,
  TaskArDef,
  TaskErrors,
  TaskEvents,
  TaskPolicy,
  TodoModuleDef,
} from '../domain/contracts/contracts.fixture';
import { defineJob } from '../domain/contracts/define-job';
import { defineUseCase } from '../domain/contracts/define-use-case';
import { allOf, anyOf, hasRole } from '../domain/policy/policy';
import { defineRules } from '../domain/rules/define-rules';
import { domainRule } from '../domain/rules/domain-rule';
import { defineErrors } from '../kernel/errors/define-errors';
import { BaseEntityFields, F } from '../kernel/fields/fields';
import { ok } from '../kernel/result/result';
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
    expect(normalize(TaskArDef)).toEqual({
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
    expect(normalize(CompleteTaskUcDef)).toEqual({
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
      rules: [],
      calls: ['getUser'],
      emits: ['todo.task.completed'],
    });
    expect(normalize(ListTasksUcDef)).toMatchObject({
      policy: { dmg: 'rule', op: 'allowAll' },
      output: expect.objectContaining({ type: 'array' }),
      calls: [],
      emits: [],
    });
  });

  it('доменные правила: тексты и код ошибки; UC ссылается по имени', () => {
    const notDone = domainRule({
      name: 'notDone',
      label: 'Задача не выполнена',
      description: 'Действие допустимо только над невыполненной задачей.',
      error: TaskErrors.ALREADY_DONE,
      check: (_: unknown) => ok(),
    });
    const normalized = {
      dmg: 'domainRule',
      name: 'notDone',
      label: 'Задача не выполнена',
      description: 'Действие допустимо только над невыполненной задачей.',
      error: 'TASK_ALREADY_DONE',
    } as const;
    expect(normalize(notDone)).toEqual(normalized);
    const TaskRules = defineRules({
      name: 'task',
      label: 'Правила задачи',
      description: 'Допустимость действий с задачей.',
      rules: { notDone },
    });
    expect(normalize(TaskRules)).toEqual({
      dmg: 'rules',
      name: 'task',
      label: 'Правила задачи',
      description: 'Допустимость действий с задачей.',
      rules: { notDone: normalized },
    });
    const uc = defineUseCase({ ...CompleteTaskUcDef, rules: [notDone] });
    expect(normalize(uc)).toMatchObject({ rules: ['notDone'] });
  });

  it('ER и Job: ссылки — имена', () => {
    expect(normalize(ArchiveDoneErDef)).toEqual({
      dmg: 'eventReaction',
      name: 'archiveDone',
      label: 'Архивировать выполненную',
      description: 'Переносит выполненную задачу в архив.',
      on: ['todo.task.completed', 'todo.task.created'],
      touches: ['task'],
      calls: [],
      emits: [],
    });
    expect(normalize(RemindJobDef)).toEqual({
      dmg: 'job',
      name: 'remind',
      label: 'Напоминание',
      description: 'Ежедневно напоминает о задачах.',
      schedule: { kind: 'dailyAt', hour: 6, minute: 0 },
      scans: ['task'],
      calls: [],
      emits: [],
    });
    expect(
      normalize(defineJob({ ...RemindJobDef, calls: [GetUserUcDef] })),
    ).toMatchObject({ calls: ['getUser'] });
  });

  it('модуль: состав по именам, фасада нет (D-42)', () => {
    expect(normalize(TodoModuleDef)).toEqual({
      dmg: 'module',
      name: 'todo',
      label: 'Задачи',
      description: 'Список дел.',
      external: false,
      dependsOn: ['users'],
      aggregates: ['task'],
      useCases: ['completeTask', 'listTasks'],
      reactions: ['archiveDone'],
      jobs: ['remind'],
    });
  });

  it('стабильность: одинаковый Def — одинаковая сериализация; отказы переходов — коды', () => {
    const NoteErrors = defineErrors('NOTE', {
      CLOSED: {
        kind: 'conflict',
        label: 'Закрыта',
        description: 'Уже закрыта.',
      },
    });
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
        transitions: {
          close: {
            from: ['draft'],
            to: 'closed',
            rejects: { closed: NoteErrors.CLOSED },
          },
        },
        events: {},
        errors: NoteErrors,
      });
    const a = normalize(build());
    expect(JSON.stringify(a)).toBe(JSON.stringify(normalize(build())));
    expect(a).toMatchObject({
      statuses: { draft: { label: 'Черновик' }, closed: { label: 'Закрыта' } },
      transitions: {
        close: {
          from: ['draft'],
          to: 'closed',
          rejects: { closed: 'NOTE_CLOSED' },
        },
      },
    });
  });
});
