import type { StepAr } from '@u7-scl/domain/course';
import type { Repository } from 'dmg-core/app';

/** Порт репозитория шагов: принимает и возвращает Ar (API-03). */
export type StepRepo = Repository<StepAr> & {
  findById(uuid: string): Promise<StepAr | undefined>;

  /** Шаги по списку uuid в порядке записей файла; отсутствующие пропускаются. */
  findByIds(ids: readonly string[]): Promise<StepAr[]>;
};
