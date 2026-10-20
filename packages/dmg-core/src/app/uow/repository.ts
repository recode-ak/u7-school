import type { AnyAggregateDef } from '#core/domain/aggregate/define-aggregate';

/**
 * Минимальный контракт репозитория для UoW. Порт репозитория модуля
 * (с поиском) объявляется в модульном пакете и расширяет этот тип.
 * `save` сверяет версию (`assertVersion`) и при расхождении бросает
 * `VersionConflict`; чтение-сверка-запись выполняется атомарно.
 */
export type Repository<A> = {
  /** Чьи агрегаты хранит — для сверки с `touches`/`scans` (ER, Job). */
  readonly aggregate: AnyAggregateDef;
  save(ar: A): Promise<void>;
};

/**
 * Версия в хранилище не совпала с `storedVersion` агрегата: запись изменили
 * параллельно (D-36). Бросает репозиторий; UoW превращает в `VERSION_CONFLICT`.
 */
export class VersionConflict extends Error {
  constructor(
    readonly aggregate: AnyAggregateDef,
    readonly uuid: string,
  ) {
    super(`Конфликт версии: ${aggregate.name} ${uuid} изменён параллельно`);
    this.name = 'VersionConflict';
  }
}

/** Что нужно для сверки версии: идентификатор и версия при загрузке. */
export type Versioned = {
  readonly uuid: string;
  readonly storedVersion: number;
};

/**
 * Оптимистичная блокировка (D-36): в хранилище должна лежать версия, с
 * которой агрегат загружен (новой записи нет — версия 0). Иначе запись
 * изменили параллельно — `VersionConflict`.
 */
export function assertVersion(
  aggregate: AnyAggregateDef,
  ar: Versioned,
  stored: number | undefined,
): void {
  if ((stored ?? 0) !== ar.storedVersion) {
    throw new VersionConflict(aggregate, ar.uuid);
  }
}
