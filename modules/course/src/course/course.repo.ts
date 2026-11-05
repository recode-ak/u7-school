import type { CourseAr, CourseState } from '@u7-scl/domain/course';
import type { Repository } from 'dmg-core/app';

/** Необязательные условия выборки курсов; заданные объединяются по «и». */
export type CourseFilter = {
  readonly status?: CourseState['status'];
  readonly authorId?: string;
  readonly title?: string;
  /** Поле и направление `field:dir`; направление не `asc` — по убыванию. */
  readonly sort?: string;
  /** Сколько курсов вернуть — срез после сортировки. */
  readonly limit?: number;
};

/** Порт репозитория курсов: принимает и возвращает Ar (API-03). */
export type CourseRepo = Repository<CourseAr> & {
  findById(uuid: string): Promise<CourseAr | undefined>;

  /**
   * Курсы по списку uuid в порядке записей файла; неизвестные и повторные
   * uuid отбрасываются.
   */
  findByIds(uuids: readonly string[]): Promise<CourseAr[]>;

  /** Курсы по фильтру; без условий — все записи файла по порядку. */
  findAll(filter?: CourseFilter): Promise<CourseAr[]>;
};
