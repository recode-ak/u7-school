import type { AnyAggregateDef } from '#core/domain/aggregate/aggregate-def';

/**
 * Минимальный контракт репозитория для UoW. Порт репозитория модуля
 * (с поиском) объявляется в модульном пакете и расширяет этот тип.
 * `save` сверяет версию и при расхождении бросает `VersionConflict`;
 * чтение-сверка-запись выполняется атомарно (база — `VersionedRepository`).
 */
export type Repository<A> = {
  /** Чьи агрегаты хранит — для сверки с `touches`/`scans` (ER, Job). */
  readonly aggregate: AnyAggregateDef;
  save(ar: A): Promise<void>;
};

/**
 * Что нужно для сверки версии: идентификатор и версия при загрузке;
 * `storedVersion: undefined` — агрегат новый, ещё не записан.
 */
export type Versioned = {
  readonly uuid: string;
  readonly storedVersion: number | undefined;
};

/**
 * Запись в хранилище для сверки; legacy-запись без `version` — версия 0.
 * Прочие поля записи сверке не нужны.
 */
export type StoredRecord = {
  readonly version?: number;
  readonly [field: string]: unknown;
};
