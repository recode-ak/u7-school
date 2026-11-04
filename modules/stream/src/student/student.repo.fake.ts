import {
  StudentAr,
  StudentArDef,
  type StudentState,
} from '@u7-scl/domain/stream';
import { MemoryRepo } from 'dmg-core/testing';
import type { StudentRepo } from './student.repo';

/**
 * Фейк порта `StudentRepo` для тестов UC: запись — память базы, `findById` —
 * по uuid из памяти, выборки — ответ, который задаёт тест присваиванием поля.
 */
export class StudentRepoFake
  extends MemoryRepo<StudentAr, StudentState>
  implements StudentRepo
{
  constructor() {
    super(StudentArDef, StudentAr.restore);
  }

  findById = async (uuid: string) => this.restored(uuid);
  findByStream = this.unanswered<[streamId: string], StudentAr[]>(
    'findByStream',
  );
  findByUser = this.unanswered<[userId: string], StudentAr[]>('findByUser');
  findStudying = this.unanswered<[], StudentAr[]>('findStudying');
}
