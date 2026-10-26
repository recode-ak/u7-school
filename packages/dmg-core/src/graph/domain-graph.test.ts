import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { defineAggregate } from '../domain/aggregate/define-aggregate';
import { defineEventReaction } from '../domain/contracts/define-event-reaction';
import { defineJob } from '../domain/contracts/define-job';
import { defineModule } from '../domain/contracts/define-module';
import {
  type AnyUseCaseDef,
  defineUseCase,
} from '../domain/contracts/define-use-case';
import { allowAll } from '../domain/policy/policy';
import { domainRule } from '../domain/rules/domain-rule';
import { defineErrors } from '../kernel/errors/define-errors';
import { BaseEntityFields } from '../kernel/fields/fields';
import { ok } from '../kernel/result/result';
import {
  CompleteTaskUcDef,
  GetTaskUcDef,
  TaskEvents,
  TodoModuleDef,
} from '../testing/example/todo';
import { buildGraph } from './domain-graph';

// Чужой модуль, который вызывает UC todo через фасад, — для связей «UC → UC».
// `completeTask` система не вызывает (нет `'system'` в `callers`), и тип
// `calls` его не пропустит; здесь он нужен как цель-command для графа —
// список расширен до общего типа (граф строится и по таким Def, отказ —
// забота `checkDefs`).
const NOTIFY_CALLS: readonly AnyUseCaseDef[] = [
  GetTaskUcDef,
  CompleteTaskUcDef,
];
const NotifyTodoErDef = defineEventReaction({
  name: 'notifyTodo',
  label: 'Сообщить о задаче',
  description: 'Читает задачу и завершает её через фасад todo.',
  on: [TaskEvents.created],
  calls: NOTIFY_CALLS,
});

const NoteArDef = defineAggregate({
  name: 'note',
  label: 'Заметка',
  description: 'Заметка к задаче.',
  state: v.object({ ...BaseEntityFields }),
  events: {},
  errors: {},
});

const ShowTaskUcDef = defineUseCase({
  name: 'showTask',
  label: 'Показать задачу',
  description: 'Задача к заметке — через фасад todo.',
  type: 'query',
  aggregate: NoteArDef,
  callers: ['user'],
  policy: allowAll,
  calls: [GetTaskUcDef],
  input: v.object({}),
  output: v.object({}),
  errors: [],
});

const SweepJobDef = defineJob({
  name: 'sweep',
  label: 'Чистка',
  description: 'Проверяет задачи заметок.',
  schedule: { kind: 'dailyAt', hour: 5, minute: 0 },
  calls: [GetTaskUcDef],
});

const NotesModuleDef = defineModule({
  name: 'notes',
  label: 'Заметки',
  description: 'Модуль для теста связей «UC → UC».',
  dependsOn: [TodoModuleDef],
  aggregates: [NoteArDef],
  useCases: [ShowTaskUcDef],
  reactions: [NotifyTodoErDef],
  jobs: [SweepJobDef],
});

/**
 * Агрегат `name` с ошибкой `<PREFIX>_DUPLICATE`, правилом `unique` на неё и
 * UC `<uc>`, который ссылается на `rules` (по умолчанию — на своё правило).
 */
function withUniqueRule(name: string, prefix: string) {
  const errors = defineErrors(prefix, {
    DUPLICATE: {
      kind: 'conflict',
      label: 'Дубль',
      description: 'Такая запись уже есть.',
    },
  });
  const ArDef = defineAggregate({
    name,
    label: name,
    description: `Агрегат ${name}.`,
    state: v.object({ ...BaseEntityFields }),
    events: {},
    errors,
  });
  const unique = domainRule({
    name: 'unique',
    label: 'Запись уникальна',
    description: 'Дубль не создаётся.',
    error: errors.DUPLICATE,
    check: (_: unknown) => ok(),
  });
  return { ArDef, errors, unique };
}

const ruleUc = (
  name: string,
  a: ReturnType<typeof withUniqueRule>,
  rule = a.unique,
) =>
  defineUseCase({
    name,
    label: name,
    description: `UC ${name}.`,
    type: 'command',
    aggregate: a.ArDef,
    callers: ['user'],
    policy: allowAll,
    input: v.object({}),
    output: v.object({}),
    errors: [rule.error],
    rules: [rule],
  });

const shopItem = withUniqueRule('item', 'ITEM');
const shopOrder = withUniqueRule('order', 'ORDER');
const ShopModuleDef = defineModule({
  name: 'shop',
  label: 'Магазин',
  description: 'Два агрегата с правилом unique.',
  dependsOn: [],
  aggregates: [shopItem.ArDef, shopOrder.ArDef],
  useCases: [ruleUc('createItem', shopItem), ruleUc('createOrder', shopOrder)],
  reactions: [],
  jobs: [],
});

const cartLine = withUniqueRule('line', 'LINE');
const CartModuleDef = defineModule({
  name: 'cart',
  label: 'Корзина',
  description: 'UC с правилом чужого модуля.',
  dependsOn: [ShopModuleDef],
  aggregates: [cartLine.ArDef],
  useCases: [ruleUc('addLine', cartLine, shopItem.unique)],
  reactions: [],
  jobs: [],
});

describe('buildGraph', () => {
  const graph = buildGraph([TodoModuleDef]);

  describe('L0 — карта модулей', () => {
    it('модули — замыкание корней по dependsOn', () => {
      expect(Object.keys(graph.modules)).toEqual(['todo', 'users']);
      expect(graph.modules.todo?.def.dependsOn).toEqual(['users']);
      expect('facade' in (graph.modules.todo ?? {})).toBe(false);
    });

    it('связи: dependsOn и поток событий между модулями', () => {
      expect(graph.links).toEqual([
        { kind: 'dependsOn', from: 'todo', to: 'users' },
        {
          kind: 'event',
          from: 'users',
          to: 'todo',
          event: 'users.user.removed',
          reaction: 'todo.releaseRemovedUserTasks',
        },
        {
          kind: 'calls',
          from: 'todo',
          to: 'users',
          operation: 'todo.assignTask',
          useCase: 'users.getUser',
          type: 'query',
        },
      ]);
    });

    it('связь calls — из «UC → UC»: от модуля операции к модулю UC, вид цели', () => {
      const withNotes = buildGraph([NotesModuleDef]);
      expect(withNotes.links.filter((l) => l.kind === 'calls')).toEqual([
        {
          kind: 'calls',
          from: 'notes',
          to: 'todo',
          operation: 'notes.showTask',
          useCase: 'todo.getTask',
          type: 'query',
        },
        {
          kind: 'calls',
          from: 'notes',
          to: 'todo',
          operation: 'notes.notifyTodo',
          useCase: 'todo.getTask',
          type: 'query',
        },
        {
          kind: 'calls',
          from: 'notes',
          to: 'todo',
          operation: 'notes.notifyTodo',
          useCase: 'todo.completeTask',
          type: 'command',
        },
        {
          kind: 'calls',
          from: 'notes',
          to: 'todo',
          operation: 'notes.sweep',
          useCase: 'todo.getTask',
          type: 'query',
        },
        {
          kind: 'calls',
          from: 'todo',
          to: 'users',
          operation: 'todo.assignTask',
          useCase: 'users.getUser',
          type: 'query',
        },
      ]);
    });

    it('события внутри модуля не дают связи L0', () => {
      const withNotes = buildGraph([NotesModuleDef]);
      const events = withNotes.links.filter((l) => l.kind === 'event');
      expect(events.map((l) => `${l.from}→${l.to}`)).toEqual([
        'todo→notes',
        'users→todo',
      ]);
    });
  });

  describe('L1 — модуль', () => {
    it('UC → агрегат, обратная связь — UC агрегата', () => {
      expect(graph.useCases['todo.createTask']?.aggregate).toBe('todo.task');
      expect(graph.aggregates['todo.task']?.useCases).toEqual([
        'todo.createTask',
        'todo.completeTask',
        'todo.listTasks',
        'todo.getTask',
        'todo.assignTask',
      ]);
    });

    it('UC/ER/Job → UC из calls, обратная связь — calledBy у UC', () => {
      const withNotes = buildGraph([NotesModuleDef]);
      expect(withNotes.useCases['notes.showTask']?.calls).toEqual([
        'todo.getTask',
      ]);
      expect(withNotes.reactions['notes.notifyTodo']?.calls).toEqual([
        'todo.getTask',
        'todo.completeTask',
      ]);
      expect(withNotes.jobs['notes.sweep']?.calls).toEqual(['todo.getTask']);
      expect(withNotes.useCases['todo.getTask']?.calledBy).toEqual([
        'notes.showTask',
        'notes.notifyTodo',
        'notes.sweep',
      ]);
      expect(withNotes.useCases['todo.completeTask']?.calledBy).toEqual([
        'notes.notifyTodo',
      ]);
      expect(graph.useCases['todo.createTask']?.calledBy).toEqual([]);
    });

    it('ER и Job → агрегат, обратные связи у агрегата', () => {
      const er = graph.reactions['todo.releaseRemovedUserTasks'];
      expect(er?.touches).toEqual(['todo.task']);
      expect(graph.jobs['todo.archiveDoneTasks']?.scans).toEqual(['todo.task']);
      expect(graph.aggregates['todo.task']?.reactions).toEqual([
        'todo.releaseRemovedUserTasks',
      ]);
      expect(graph.aggregates['todo.task']?.jobs).toEqual([
        'todo.archiveDoneTasks',
      ]);
    });

    it('событие: агрегат-владелец, кто публикует и кто слушает', () => {
      expect(graph.events['todo.task.archived']).toMatchObject({
        aggregate: 'todo.task',
        publishers: ['todo.releaseRemovedUserTasks', 'todo.archiveDoneTasks'],
        subscribers: [],
      });
      expect(graph.events['users.user.removed']).toMatchObject({
        aggregate: 'users.user',
        subscribers: ['todo.releaseRemovedUserTasks'],
      });
    });

    it('ошибка: агрегат-владелец и кто её объявляет', () => {
      expect(graph.errors.TASK_NOT_FOUND).toMatchObject({
        aggregate: 'todo.task',
        usedBy: ['todo.completeTask', 'todo.getTask', 'todo.assignTask'],
      });
      expect(graph.errors.TASK_ARCHIVED?.def.kind).toBe('conflict');
    });

    it('доменное правило: узел с текстами и кодом ошибки, UC ссылается', () => {
      expect(graph.rules['todo.task.withinOpenLimit']).toEqual({
        id: 'todo.task.withinOpenLimit',
        module: 'todo',
        def: {
          dmg: 'domainRule',
          name: 'withinOpenLimit',
          label: 'Открытых задач меньше предела',
          description:
            'Новая задача создаётся, только если у владельца меньше 3 открытых задач.',
          error: 'TASK_TOO_MANY_OPEN',
        },
        usedBy: ['todo.createTask'],
      });
      expect(graph.useCases['todo.createTask']?.rules).toEqual([
        'todo.task.withinOpenLimit',
      ]);
      expect(graph.useCases['todo.completeTask']?.rules).toEqual([]);
    });

    it('правила с одним name у двух агрегатов модуля — два узла', () => {
      const shop = buildGraph([ShopModuleDef]);
      expect(Object.keys(shop.rules)).toEqual([
        'shop.item.unique',
        'shop.order.unique',
      ]);
      expect(shop.rules['shop.item.unique']?.usedBy).toEqual([
        'shop.createItem',
      ]);
      expect(shop.rules['shop.order.unique']?.usedBy).toEqual([
        'shop.createOrder',
      ]);
      expect(shop.useCases['shop.createOrder']?.rules).toEqual([
        'shop.order.unique',
      ]);
    });

    it('правило чужого модуля в UC — id и модуль по владельцу ошибки', () => {
      const cart = buildGraph([CartModuleDef]);
      expect(cart.useCases['cart.addLine']?.rules).toEqual([
        'shop.item.unique',
      ]);
      expect(cart.rules['shop.item.unique']).toMatchObject({
        module: 'shop',
        usedBy: ['cart.addLine', 'shop.createItem'],
      });
      expect(cart.rules['cart.line.unique']).toBeUndefined();
    });

    it('узлы содержат нормализованные Def', () => {
      expect(graph.useCases['todo.listTasks']?.def).toMatchObject({
        dmg: 'useCase',
        type: 'query',
      });
      expect(graph.useCases['todo.listTasks']?.module).toBe('todo');
    });
  });

  describe('L2 — агрегат', () => {
    it('статусы, переходы и ошибки агрегата', () => {
      const task = graph.aggregates['todo.task']?.def;
      expect(Object.keys(task?.statuses ?? {})).toEqual([
        'open',
        'done',
        'archived',
      ]);
      expect(task?.transitions?.complete).toEqual({
        from: ['open'],
        to: 'done',
        rejects: { done: 'TASK_ALREADY_DONE', archived: 'TASK_ARCHIVED' },
      });
      expect(task?.errors).toContain('TASK_ALREADY_DONE');
    });

    it('ошибки операций — у UC агрегата', () => {
      expect(graph.useCases['todo.completeTask']?.def.errors).toEqual([
        'TASK_NOT_FOUND',
        'TASK_ALREADY_DONE',
        'TASK_ARCHIVED',
      ]);
    });
  });

  it('JSON детерминирован: повторная сборка даёт тот же текст', () => {
    expect(JSON.stringify(buildGraph([TodoModuleDef]))).toBe(
      JSON.stringify(graph),
    );
  });
});
