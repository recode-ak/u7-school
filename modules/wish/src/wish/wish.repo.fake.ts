import {
  WishAr,
  WishArDef,
  type WishState,
  type WishTargetVo,
} from '@u7-scl/domain/wish';
import { MemoryRepo } from 'dmg-core/testing';
import type { WishRepo } from './wish.repo';

/**
 * Фейк порта `WishRepo` для тестов UC/ER: запись — память базы, `findById`
 * и простые выборки — по снимкам из памяти, выборка по цели — ответ задаёт
 * тест присваиванием поля.
 */
export class WishRepoFake
  extends MemoryRepo<WishAr, WishState>
  implements WishRepo
{
  constructor() {
    super(WishArDef, WishAr.restore);
  }

  findById = async (uuid: string) => this.restored(uuid);
  findByUser = async (userId: string) => this.where((s) => s.userId === userId);
  findAllByKind = async (kind: 'course' | 'module') =>
    this.where((s) => s.target.kind === kind);
  findAllByUserAndTarget = this.unanswered<
    [userId: string, target: WishTargetVo],
    WishAr[]
  >('findAllByUserAndTarget');
}
