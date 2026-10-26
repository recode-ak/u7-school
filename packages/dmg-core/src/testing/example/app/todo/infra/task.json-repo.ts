import * as v from 'valibot';
import { createLock } from '#core/app/uow/lock';
import { assertVersion } from '#core/app/uow/repository';
import { TaskAr, TaskArDef } from '#core/testing/example/todo/index';
import { TaskState } from '#core/testing/example/todo/state';
import type { TaskRepo } from '../task/task.repo';

const Rows = v.array(TaskState);

/**
 * Задачи в JSON-файле: массив снапшотов. Только хранение — состояние
 * разбирает схема, агрегат восстанавливает `TaskAr.restore`. Запись —
 * под замком: чтение → сверка версии → запись атомарны в процессе.
 */
export class TaskJsonRepo implements TaskRepo {
  readonly aggregate = TaskArDef;
  private readonly lock = createLock();

  constructor(private readonly filePath: string) {}

  async findById(uuid: string): Promise<TaskAr | undefined> {
    const row = (await this.rows()).find((r) => r.uuid === uuid);
    return row && TaskAr.restore(row);
  }

  async findActiveByOwner(ownerId: string): Promise<TaskAr[]> {
    return this.where((r) => r.ownerId === ownerId && r.status !== 'archived');
  }

  async findActiveByParticipant(userId: string): Promise<TaskAr[]> {
    return this.where(
      (r) =>
        (r.ownerId === userId || r.assignment?.assigneeId === userId) &&
        r.status !== 'archived',
    );
  }

  async findDone(): Promise<TaskAr[]> {
    return this.where((r) => r.status === 'done');
  }

  save(ar: TaskAr): Promise<void> {
    return this.lock(async () => {
      const rows = await this.rows();
      const stored = rows.find((r) => r.uuid === ar.uuid);
      assertVersion(this.aggregate, ar, stored);
      const next = rows.filter((r) => r.uuid !== ar.uuid);
      next.push(ar.snapshot());
      await Bun.write(this.filePath, JSON.stringify(next, undefined, 2));
    });
  }

  private async where(match: (row: TaskState) => boolean): Promise<TaskAr[]> {
    return (await this.rows()).filter(match).map(TaskAr.restore);
  }

  private async rows(): Promise<TaskState[]> {
    const file = Bun.file(this.filePath);
    if (!(await file.exists())) return [];
    return v.parse(Rows, await file.json());
  }
}
