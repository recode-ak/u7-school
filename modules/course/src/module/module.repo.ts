import type { ModuleAr, ModuleState } from '@u7-scl/domain/course';
import type { Repository } from 'dmg-core/app';

/** Необязательные условия выборки модулей; заданные объединяются по «и». */
export type ModuleFilter = {
  readonly status?: ModuleState['status'];
  readonly authorId?: string;
  readonly title?: string;
  readonly tags?: readonly string[];
  readonly sort?: string;
  readonly limit?: number;
};

/** Порт репозитория модулей: принимает и возвращает Ar (API-03). */
export type ModuleRepo = Repository<ModuleAr> & {
  findById(uuid: string): Promise<ModuleAr | undefined>;

  /** Модули по фильтру; без условий — все записи файла по порядку. */
  findAll(filter?: ModuleFilter): Promise<ModuleAr[]>;
};
