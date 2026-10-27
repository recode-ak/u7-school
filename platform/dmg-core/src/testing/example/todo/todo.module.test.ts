import { describe, expect, it } from 'bun:test';
import { ArchChecker } from '#core/arch/arch-checker';
import { normalize } from '#core/graph/normalize';
import { TaskArDef } from './task/task.ar';
import { TodoModuleDef } from './todo.module';

describe('TodoModuleDef', () => {
  it('паспорт: зависимость от users и состав', () => {
    expect(normalize(TodoModuleDef)).toMatchObject({
      dependsOn: ['users'],
      aggregates: ['task'],
      useCases: [
        'createTask',
        'completeTask',
        'listTasks',
        'getTask',
        'assignTask',
      ],
      reactions: ['releaseRemovedUserTasks'],
      jobs: ['archiveDoneTasks'],
    });
  });

  it('агрегат: статусы, переходы, события и ошибки', () => {
    expect(normalize(TaskArDef)).toMatchObject({
      name: 'task',
      statuses: {
        open: { label: 'Открыта' },
        done: { label: 'Выполнена' },
        archived: { label: 'В архиве' },
      },
      transitions: {
        complete: { from: ['open'], to: 'done' },
        archive: { from: ['open', 'done'], to: 'archived' },
      },
      events: [
        'todo.task.created',
        'todo.task.completed',
        'todo.task.archived',
        'todo.task.assigned',
        'todo.task.unassigned',
      ],
      errors: [
        'TASK_NOT_FOUND',
        'TASK_ALREADY_DONE',
        'TASK_ARCHIVED',
        'TASK_TOO_MANY_OPEN',
        'TASK_NOT_ASSIGNABLE',
        'TASK_ASSIGNEE_INACTIVE',
      ],
    });
  });

  it('все Def нормализуются (схемы конвертируются в JSON Schema)', () => {
    const defs = [
      ...TodoModuleDef.aggregates,
      ...TodoModuleDef.useCases,
      ...TodoModuleDef.reactions,
      ...TodoModuleDef.jobs,
      ...TodoModuleDef.aggregates.flatMap((a) => Object.values(a.events)),
      ...TodoModuleDef.aggregates.flatMap((a) => Object.values(a.errors)),
    ];
    for (const def of defs) expect(() => normalize(def)).not.toThrow();
    expect(defs).toHaveLength(19);
  });

  it('ArchChecker вместе с users — без нарушений', () => {
    expect(ArchChecker.defsOf([TodoModuleDef]).report()).toEqual([]);
  });
});
