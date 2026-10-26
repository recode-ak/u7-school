import { describe, expect, it } from 'bun:test';
import { normalize } from '#core/graph/normalize';
import { ReleaseRemovedUserTasksErDef } from './release-removed-user-tasks.er';

describe('ReleaseRemovedUserTasksErDef', () => {
  it('на удаление пользователя: свои задачи — в архив, назначенные — владельцам', () => {
    expect(normalize(ReleaseRemovedUserTasksErDef)).toMatchObject({
      name: 'releaseRemovedUserTasks',
      on: ['users.user.removed'],
      touches: ['task'],
      emits: ['todo.task.archived', 'todo.task.unassigned'],
    });
  });
});
