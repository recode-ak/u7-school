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

/**
 * Что нужно для сверки версии: идентификатор и версия при загрузке;
 * `storedVersion: undefined` — агрегат новый, ещё не записан.
 */
export type Versioned = {
  readonly uuid: string;
  readonly storedVersion: number | undefined;
};

/** Запись в хранилище для сверки; legacy-запись без `version` — версия 0. */
export type StoredRecord = { readonly version?: number };

/**
 * Оптимистичная блокировка (D-36). `stored` — запись с uuid агрегата в
 * хранилище или `undefined`, если её нет:
 * - новый агрегат — записи быть не должно (иначе `create` перезаписал бы
 *   чужую запись, в т. ч. legacy без `version`);
 * - восстановленный — запись есть, и её версия (без поля — 0) равна той,
 *   с которой агрегат загружен.
 * Иначе запись изменили параллельно — `VersionConflict`.
 */
export function assertVersion(
  aggregate: AnyAggregateDef,
  ar: Versioned,
  stored: StoredRecord | undefined,
): void {
  const ok =
    ar.storedVersion === undefined
      ? stored === undefined
      : stored !== undefined && (stored.version ?? 0) === ar.storedVersion;
  if (!ok) throw new VersionConflict(aggregate, ar.uuid);
}
