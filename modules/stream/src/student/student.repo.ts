import type { StudentAr } from '@u7-scl/domain/stream';
import type { Repository } from 'dmg-core/app';

/** Порт репозитория студентов: принимает и возвращает Ar (API-03). */
export type StudentRepo = Repository<StudentAr> & {
  /** Запись студента по UUID. */
  findById(uuid: string): Promise<StudentAr | undefined>;

  /** Все записи студентов потока (любого статуса). */
  findByStream(streamId: string): Promise<StudentAr[]>;

  /** Все записи пользователя (любого статуса). */
  findByUser(userId: string): Promise<StudentAr[]>;

  /** Записи, которые учатся или зачислены (`active`, `enrolled`) — для обхода Job. */
  findStudying(): Promise<StudentAr[]>;
};
