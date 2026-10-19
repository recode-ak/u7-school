import type { AnyAggregateDef } from '../../domain/aggregate/define-aggregate';

/**
 * Минимальный контракт репозитория для UoW. Порт репозитория модуля
 * (с поиском) объявляется в модульном пакете и расширяет этот тип.
 */
export type Repository<A> = {
  /** Чьи агрегаты хранит — для сверки с `touches`/`scans` (ER, Job). */
  readonly aggregate: AnyAggregateDef;
  save(ar: A): Promise<void>;
};
