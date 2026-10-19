import { describe, expect, it } from 'bun:test';
import { normalize } from '../../../graph/normalize';
import { TaskDef } from './task/task.ar';
import { TodoModule } from './todo.module';

describe('TodoModule', () => {
  it('паспорт: зависимость от users и состав', () => {
    expect(normalize(TodoModule)).toMatchObject({
      dependsOn: ['users'],
      aggregates: ['task'],
      useCases: ['createTask', 'completeTask', 'listTasks'],
      reactions: ['archiveRemovedUserTasks'],
      jobs: ['archiveDoneTasks'],
      facade: 'todo',
    });
  });

  it('агрегат: статусы, переходы, события и ошибки', () => {
    expect(normalize(TaskDef)).toMatchObject({
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
      ...TodoModule.aggregates,
      ...TodoModule.useCases,
      ...TodoModule.reactions,
      ...TodoModule.jobs,
      ...TodoModule.aggregates.flatMap((a) => Object.values(a.events)),
      ...TodoModule.aggregates.flatMap((a) => Object.values(a.errors)),
    ];
    for (const def of defs) expect(() => normalize(def)).not.toThrow();
    expect(defs).toHaveLength(12);
  });
});
