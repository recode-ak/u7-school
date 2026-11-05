import { CourseAr, CourseArDef, type CourseState } from '@u7-scl/domain/course';
import { MemoryRepo } from 'dmg-core/testing';
import type { CourseFilter, CourseRepo } from './course.repo';

/**
 * Фейк порта `CourseRepo` для тестов UC: запись — память базы, `findById` —
 * по uuid из памяти, выборки — ответ, который задаёт тест присваиванием поля.
 */
export class CourseRepoFake
  extends MemoryRepo<CourseAr, CourseState>
  implements CourseRepo
{
  constructor() {
    super(CourseArDef, CourseAr.restore);
  }

  findById = async (uuid: string) => this.restored(uuid);
  findByIds = this.unanswered<[uuids: readonly string[]], CourseAr[]>(
    'findByIds',
  );
  findAll = this.unanswered<[filter?: CourseFilter], CourseAr[]>('findAll');
}
