import { describe, expect, it } from 'bun:test';
import { normalize } from '../../../graph/normalize';
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
