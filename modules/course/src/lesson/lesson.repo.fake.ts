import { LessonAr, LessonArDef, type LessonState } from '@u7-scl/domain/course';
import { MemoryRepo } from 'dmg-core/testing';
import type { LessonRepo } from './lesson.repo';

/**
 * Фейк порта `LessonRepo` для тестов UC: запись — память базы, выборка по
 * списку — в порядке переданных uuid (порядок файла у настоящего репозитория
 * проверяет его тест); тест может подменить `findByIds` присваиванием.
 */
export class LessonRepoFake
  extends MemoryRepo<LessonAr, LessonState>
  implements LessonRepo
{
  constructor() {
    super(LessonArDef, LessonAr.restore);
  }

  findById = async (uuid: string) => this.restored(uuid);
  findByIds = async (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const ar = this.restored(id);
      return ar ? [ar] : [];
    });
}
