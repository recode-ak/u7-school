import type { Repository } from '#core/app/uow/repository';
import type { TaskAr } from '#core/testing/example/todo/index';

/** Порт репозитория задач: принимает и возвращает Ar (API-03). */
export type TaskRepo = Repository<TaskAr> & {
  findById(uuid: string): Promise<TaskAr | undefined>;
  /** Неархивные задачи владельца. */
  findActiveByOwner(ownerId: string): Promise<TaskAr[]>;
  findDone(): Promise<TaskAr[]>;
};
