import type { LessonAr } from '@u7-scl/domain/course';
import type { Repository } from 'dmg-core/app';

/** Порт репозитория уроков: принимает и возвращает Ar (API-03). */
export type LessonRepo = Repository<LessonAr> & {
  findById(uuid: string): Promise<LessonAr | undefined>;

  /** Уроки по списку uuid в порядке записей файла; отсутствующие пропускаются. */
  findByIds(ids: readonly string[]): Promise<LessonAr[]>;
};
