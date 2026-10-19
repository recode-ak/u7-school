import { describe, expect, it } from 'bun:test';
import { normalize } from '../../../graph/normalize';
import { TaskArDef } from './task/task.ar';
import { TodoModuleDef } from './todo.module';

describe('TodoModuleDef', () => {
  it('паспорт: зависимость от users и состав', () => {
    expect(normalize(TodoModuleDef)).toMatchObject({
      dependsOn: ['users'],
      aggregates: ['task'],
      useCases: ['createTask', 'completeTask', 'listTasks'],
      reactions: ['archiveRemovedUserTasks'],
      jobs: ['archiveDoneTasks'],
      facade: 'todo',
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
      ],
      errors: ['TASK_NOT_FOUND', 'TASK_ALREADY_DONE', 'TASK_ARCHIVED'],
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
    expect(defs).toHaveLength(12);
  });
});
