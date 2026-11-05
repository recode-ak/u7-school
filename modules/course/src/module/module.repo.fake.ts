import { ModuleAr, ModuleArDef, type ModuleState } from '@u7-scl/domain/course';
import { MemoryRepo } from 'dmg-core/testing';
import type { ModuleFilter, ModuleRepo } from './module.repo';

/**
 * Фейк порта `ModuleRepo` для тестов UC: запись — память базы, `findById` —
 * по uuid из памяти, выборка — ответ, который задаёт тест присваиванием поля.
 */
export class ModuleRepoFake
  extends MemoryRepo<ModuleAr, ModuleState>
  implements ModuleRepo
{
  constructor() {
    super(ModuleArDef, ModuleAr.restore);
  }

  findById = async (uuid: string) => this.restored(uuid);
  findAll = this.unanswered<[filter?: ModuleFilter], ModuleAr[]>('findAll');
}
