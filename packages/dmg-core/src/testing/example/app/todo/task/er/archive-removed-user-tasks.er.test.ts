import { afterEach, beforeEach, describe, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ModuleFacades } from '#core/app/facade/module-facades';
import { testAppContext } from '#core/testing/app-context';
import { TaskAr, TodoModuleDef } from '#core/testing/example/todo/index';
import { UserEvents } from '#core/testing/example/users/index';
import { expectOk } from '#core/testing/expect-result';
import { expectIdempotentReaction } from '#core/testing/reaction-idempotency';
import { TaskJsonRepo } from '../../infra/task.json-repo';
import { ArchiveRemovedUserTasksEr } from './archive-removed-user-tasks.er';

const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const TASK = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const T0 = Date.UTC(2026, 9, 1);

let dir: string;
afterEach(() => rm(dir, { recursive: true, force: true }));
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'dmg-er-'));
});

describe('ArchiveRemovedUserTasksEr — идемпотентность (D-47)', () => {
  test('повтор users.user.removed с новым eventId — без записей и событий', async () => {
    const ctx = testAppContext({ at: T0 });
    const file = path.join(dir, 'tasks.json');
    const tasks = new TaskJsonRepo(file);
    await tasks.save(
      expectOk(
        TaskAr.create({ uuid: TASK, ownerId: OWNER, title: 'Хлеб' }, T0),
      ),
    );
    const er = new ArchiveRemovedUserTasksEr(
      { app: ctx.app, facades: new ModuleFacades(), tasks },
      TodoModuleDef,
    );
    await expectIdempotentReaction({
      event: {
        ...UserEvents.removed.make({ userId: OWNER }),
        eventId: 'e-removed',
        occurredAt: T0,
        aggregateId: OWNER,
        cause: { kind: 'request', requestId: 'r-1' },
        correlationId: 'c-1',
      },
      deliver: (event) => er.handle(event),
      published: ctx.published,
      state: () => Bun.file(file).text(),
    });
  });
});
