import { StreamAr, StreamArDef, type StreamState } from '@u7-scl/domain/stream';
import { MemoryRepo } from 'dmg-core/testing';
import type { StreamFilter, StreamRepo } from './stream.repo';

/**
 * Фейк порта `StreamRepo` для тестов UC: запись — память базы, `findById` —
 * по uuid из памяти, выборки — ответ, который задаёт тест присваиванием поля.
 */
export class StreamRepoFake
  extends MemoryRepo<StreamAr, StreamState>
  implements StreamRepo
{
  constructor() {
    super(StreamArDef, StreamAr.restore);
  }

  findById = async (uuid: string) => this.restored(uuid);
  findAll = this.unanswered<[filter?: StreamFilter], StreamAr[]>('findAll');
  findByTelegramGroup = this.unanswered<
    [telegramGroupId: string],
    StreamAr | undefined
  >('findByTelegramGroup');
}
