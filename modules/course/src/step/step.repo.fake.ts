import { StepAr, StepArDef, type StepState } from '@u7-scl/domain/course';
import { MemoryRepo } from 'dmg-core/testing';
import type { StepRepo } from './step.repo';

/**
 * Фейк порта `StepRepo` для тестов UC: запись — память базы, выборка по
 * списку — в порядке переданных uuid (порядок файла у настоящего репозитория
 * проверяет его тест); тест может подменить `findByIds` присваиванием.
 */
export class StepRepoFake
  extends MemoryRepo<StepAr, StepState>
  implements StepRepo
{
  constructor() {
    super(StepArDef, StepAr.restore);
  }

  findById = async (uuid: string) => this.restored(uuid);
  findByIds = async (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const ar = this.restored(id);
      return ar ? [ar] : [];
    });
}
