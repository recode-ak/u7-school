import * as v from 'valibot';
import { TaskAr, TaskArDef } from '#core/testing/example/todo/index';
import { TaskState } from '#core/testing/example/todo/task/task.state';
import type { TaskRepo } from '../task/task.repo';

const Rows = v.array(TaskState);

/**
 * Задачи в JSON-файле: массив снапшотов. Только хранение — состояние
 * разбирает схема, агрегат восстанавливает `TaskAr.restore`.
 */
export class TaskJsonRepo implements TaskRepo {
  readonly aggregate = TaskArDef;

  constructor(private readonly filePath: string) {}

  async findById(uuid: string): Promise<TaskAr | undefined> {
    const row = (await this.rows()).find((r) => r.uuid === uuid);
    return row && TaskAr.restore(row);
  }

  async findActiveByOwner(ownerId: string): Promise<TaskAr[]> {
    return this.where((r) => r.ownerId === ownerId && r.status !== 'archived');
  }

  async findDone(): Promise<TaskAr[]> {
    return this.where((r) => r.status === 'done');
  }

  async save(ar: TaskAr): Promise<void> {
    const rows = (await this.rows()).filter((r) => r.uuid !== ar.uuid);
    rows.push(ar.snapshot());
    await Bun.write(this.filePath, JSON.stringify(rows, undefined, 2));
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
