// Общие фикстуры тестов прикладного слоя DMG.
import { TaskAr, TaskArDef } from '../testing/example/todo';
import type { TaskState } from '../testing/example/todo/task/task.state';
import { assertVersion } from './uow/repository';

export const TASK = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
export const TASK_2 = '1c7a3d2f-9b5e-4a4c-8d3f-2e6b8c0f4a21';
export const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
export const T0 = Date.UTC(2026, 9, 1);

export function taskRow(
  uuid: string,
  status: TaskState['status'] = 'open',
): TaskState {
  return {
    uuid,
    ownerId: OWNER,
    title: 'Купить хлеб',
    status,
    createdAt: T0,
    updatedAt: T0,
    version: 0,
  };
}

/** Репозиторий задач в памяти; `failOnFind` — имитация сбоя диска. */
export class MemoryTasks {
  readonly aggregate = TaskArDef;
  readonly rows = new Map<string, TaskState>();
  failOnFind = false;

  async findById(id: string): Promise<TaskAr | undefined> {
    if (this.failOnFind) throw new Error('диск недоступен');
    const row = this.rows.get(id);
    return row && TaskAr.restore(row);
  }

  async findByOwner(ownerId: string): Promise<TaskAr[]> {
    return this.where((row) => row.ownerId === ownerId);
  }

  async findDone(): Promise<TaskAr[]> {
    return this.where((row) => row.status === 'done');
  }

  async save(ar: TaskAr): Promise<void> {
    assertVersion(this.aggregate, ar, this.rows.get(ar.uuid)?.version);
    this.rows.set(ar.uuid, ar.snapshot());
  }

  private where(match: (row: TaskState) => boolean): TaskAr[] {
    return [...this.rows.values()].filter(match).map(TaskAr.restore);
  }
}
