import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModuleFacades } from '#core/app/facade/module-facades';
import { Trace } from '#core/kernel/trace/trace';
import {
  ArchiveDoneTasksJobDef,
  type TaskAr,
  TodoModuleDef,
} from '#core/testing/example/todo/index';
import type { TaskState } from '#core/testing/example/todo/state';
import { expectOk, testAppContext } from '#core/testing/index';
import { TaskJsonRepo } from '../../infra/task.json-repo';
import { ArchiveDoneTasksJob } from './archive-done-tasks.job';

// Обход выполненных задач: у каждой своя UoW, сбой одной записи не
// прерывает обход; повторный прогон ничего не находит (идемпотентность).

const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const T0 = Date.UTC(2026, 9, 1);
const T1 = Date.UTC(2026, 9, 2, 3);

const row = (status: TaskState['status']): TaskState => ({
  uuid: crypto.randomUUID(),
  ownerId: OWNER,
  title: 'Задача',
  status,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...(status === 'done' && { completedAt: T0 }),
});

/** Репозиторий, у которого запись одной задачи падает — сбой диска. */
class FailingRepo extends TaskJsonRepo {
  constructor(
    filePath: string,
    private readonly failOn: string,
  ) {
    super(filePath);
  }

  override async save(ar: TaskAr): Promise<void> {
    if (ar.uuid === this.failOn) throw new Error('диск недоступен');
    return super.save(ar);
  }
}

let dir: string;
let file: string;
let ctx: ReturnType<typeof testAppContext>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'archive-done-'));
  file = join(dir, 'tasks.json');
  ctx = testAppContext({ at: T1 });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const makeJob = (tasks: TaskJsonRepo) =>
  new ArchiveDoneTasksJob(
    { app: ctx.app, facades: new ModuleFacades(), tasks },
    TodoModuleDef,
  );

const run = (job: ArchiveDoneTasksJob) =>
  job.handle(Trace.forJob(ArchiveDoneTasksJobDef));

describe('ArchiveDoneTasksJob', () => {
  it('выполненные — в архив, открытые не трогает', async () => {
    const done1 = row('done');
    const done2 = row('done');
    const open = row('open');
    await Bun.write(file, JSON.stringify([done1, open, done2]));
    const tasks = new TaskJsonRepo(file);

    const report = expectOk(await run(makeJob(tasks)));

    expect(report).toEqual({ processed: 2, failed: 0 });
    expect((await tasks.findById(done1.uuid))?.isArchived()).toBe(true);
    expect((await tasks.findById(done2.uuid))?.isArchived()).toBe(true);
    expect((await tasks.findById(open.uuid))?.snapshot()).toEqual(open);
    expect(ctx.published.map((e) => [e.name, e.payload])).toEqual([
      ['todo.task.archived', { taskId: done1.uuid, ownerId: OWNER }],
      ['todo.task.archived', { taskId: done2.uuid, ownerId: OWNER }],
    ]);
  });

  it('повторный прогон — ничего не находит и не пишет', async () => {
    await Bun.write(file, JSON.stringify([row('done')]));
    const job = makeJob(new TaskJsonRepo(file));
    expectOk(await run(job));
    const before = await Bun.file(file).text();
    const sent = ctx.published.length;

    expect(expectOk(await run(job))).toEqual({ processed: 0, failed: 0 });
    expect(await Bun.file(file).text()).toBe(before);
    expect(ctx.published).toHaveLength(sent);
  });

  it('сбой записи одной задачи — остальные архивированы, сбой в логе', async () => {
    const broken = row('done');
    const fine = row('done');
    await Bun.write(file, JSON.stringify([broken, fine]));
    const tasks = new FailingRepo(file, broken.uuid);

    const report = expectOk(await run(makeJob(tasks)));

    expect(report).toEqual({ processed: 1, failed: 1 });
    expect((await tasks.findById(broken.uuid))?.isDone()).toBe(true);
    expect((await tasks.findById(fine.uuid))?.isArchived()).toBe(true);
    expect(ctx.logs).toContainEqual(
      expect.objectContaining({ level: 'error', source: 'archiveDoneTasks' }),
    );
  });
});
