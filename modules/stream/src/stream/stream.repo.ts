import type { StreamAr, StreamState } from '@u7-scl/domain/stream';
import type { Repository } from 'dmg-core/app';

/** Необязательные условия выборки потоков; заданные объединяются по «и». */
export type StreamFilter = {
  readonly status?: StreamState['status'];
  readonly mentorId?: string;
  readonly schoolId?: string;
};

/** Порт репозитория потоков: принимает и возвращает Ar (API-03). */
export type StreamRepo = Repository<StreamAr> & {
  /** Поток по UUID. */
  findById(uuid: string): Promise<StreamAr | undefined>;

  /** Потоки по фильтру; без условий — все. */
  findAll(filter?: StreamFilter): Promise<StreamAr[]>;

  /** Первый поток с этой Telegram-группой (сравнение строк). */
  findByTelegramGroup(telegramGroupId: string): Promise<StreamAr | undefined>;
};
