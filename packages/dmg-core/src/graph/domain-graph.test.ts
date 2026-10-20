import { describe, expect, it } from 'bun:test';
import { defineEventReaction } from '../domain/contracts/define-event-reaction';
import { defineModule } from '../domain/contracts/define-module';
import {
  TaskEvents,
  TodoFacadeDef,
  TodoModuleDef,
} from '../testing/example/todo';
import { buildGraph } from './domain-graph';

// Чужой модуль, который вызывает фасад todo, — для связи L0 «вызов фасада».
const NotifyTodoErDef = defineEventReaction({
  name: 'notifyTodo',
  label: 'Сообщить о задаче',
  description: 'Читает задачу через фасад todo.',
  on: [TaskEvents.created],
  calls: [TodoFacadeDef],
});

const NotesModuleDef = defineModule({
  name: 'notes',
  label: 'Заметки',
  description: 'Модуль для теста связей L0.',
  dependsOn: [TodoModuleDef],
  aggregates: [],
  useCases: [],
  reactions: [NotifyTodoErDef],
  jobs: [],
});

describe('buildGraph', () => {
  const graph = buildGraph([TodoModuleDef]);

  describe('L0 — карта модулей', () => {
    it('модули — замыкание корней по dependsOn', () => {
      expect(Object.keys(graph.modules)).toEqual(['todo', 'users']);
      expect(graph.modules.todo?.def.dependsOn).toEqual(['users']);
      expect(graph.modules.todo?.facade?.name).toBe('todo');
      expect(graph.modules.users?.facade).toBeUndefined();
    });

    it('связи: dependsOn и поток событий между модулями', () => {
      expect(graph.links).toEqual([
        { kind: 'dependsOn', from: 'todo', to: 'users' },
        {
          kind: 'event',
          from: 'users',
          to: 'todo',
          event: 'users.user.removed',
          reaction: 'todo.archiveRemovedUserTasks',
        },
      ]);
    });

    it('связь «вызов фасада» — от модуля реакции к владельцу фасада', () => {
      const withNotes = buildGraph([NotesModuleDef]);
      expect(withNotes.links).toContainEqual({
        kind: 'calls',
        from: 'notes',
        to: 'todo',
        facade: 'todo',
        reaction: 'notes.notifyTodo',
      });
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
      ]);
    });

    it('ER и Job → агрегат, обратные связи у агрегата', () => {
      const er = graph.reactions['todo.archiveRemovedUserTasks'];
      expect(er?.touches).toEqual(['todo.task']);
      expect(graph.jobs['todo.archiveDoneTasks']?.scans).toEqual(['todo.task']);
      expect(graph.aggregates['todo.task']?.reactions).toEqual([
        'todo.archiveRemovedUserTasks',
      ]);
      expect(graph.aggregates['todo.task']?.jobs).toEqual([
        'todo.archiveDoneTasks',
      ]);
    });

    it('событие: агрегат-владелец, кто публикует и кто слушает', () => {
      expect(graph.events['todo.task.archived']).toMatchObject({
        aggregate: 'todo.task',
        publishers: ['todo.archiveRemovedUserTasks', 'todo.archiveDoneTasks'],
        subscribers: [],
      });
      expect(graph.events['users.user.removed']).toMatchObject({
        aggregate: 'users.user',
        subscribers: ['todo.archiveRemovedUserTasks'],
      });
    });

    it('ошибка: агрегат-владелец и кто её объявляет', () => {
      expect(graph.errors.TASK_NOT_FOUND).toMatchObject({
        aggregate: 'todo.task',
        usedBy: ['todo.completeTask', 'todo'],
      });
      expect(graph.errors.TASK_ARCHIVED?.def.kind).toBe('conflict');
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
