import type { Repository } from '../../../../../app/uow/repository';
import type { TaskAr } from '../../../todo';

/** Порт репозитория задач: принимает и возвращает Ar (API-03). */
export type TaskRepo = Repository<TaskAr> & {
  findById(uuid: string): Promise<TaskAr | undefined>;
  /** Неархивные задачи владельца. */
  findActiveByOwner(ownerId: string): Promise<TaskAr[]>;
  findDone(): Promise<TaskAr[]>;
};
