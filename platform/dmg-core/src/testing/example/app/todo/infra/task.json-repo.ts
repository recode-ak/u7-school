import * as v from 'valibot';
import {
  type StoredRecord,
  VersionedRepository,
} from '#core/app/uow/repository';
import { TaskAr, TaskArDef } from '#core/testing/example/todo/index';
import { TaskState } from '#core/testing/example/todo/state';
import type { TaskRepo } from '../task/task.repo';

const Rows = v.array(TaskState);

/**
 * Задачи в JSON-файле: массив снапшотов. Только хранение — состояние
 * разбирает схема, агрегат восстанавливает `TaskAr.restore`. Запись —
 * под замком: чтение → сверка версии → запись атомарны в процессе.
 */
export class TaskJsonRepo
  extends VersionedRepository<TaskAr>
  implements TaskRepo
{
  readonly aggregate = TaskArDef;

  constructor(private readonly filePath: string) {
    super();
  }

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

  protected async stored(uuid: string): Promise<StoredRecord | undefined> {
    return (await this.rows()).find((r) => r.uuid === uuid);
  }

  protected async write(ar: TaskAr): Promise<void> {
    const next = (await this.rows()).filter((r) => r.uuid !== ar.uuid);
    next.push(ar.snapshot());
    await Bun.write(this.filePath, JSON.stringify(next, undefined, 2));
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
