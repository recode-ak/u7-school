import type { Lesson } from './entity';

/** Интерфейс репозитория уроков */
export interface LegacyLessonRepo {
  save(lesson: Lesson): Promise<void>;
  getByUuid(uuid: string): Promise<Lesson | undefined>;
  getByIds(ids: string[]): Promise<Lesson[]>;
  getByCourseId(moduleId: string): Promise<Lesson[]>;
}
