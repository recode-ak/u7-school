import type { AnyAggregateDef } from '#core/domain/aggregate/aggregate-def';
import { Lock } from './lock';

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

/**
 * Запись в хранилище для сверки; legacy-запись без `version` — версия 0.
 * Прочие поля записи сверке не нужны.
 */
export type StoredRecord = {
  readonly version?: number;
  readonly [field: string]: unknown;
};

/**
 * База репозитория с оптимистичной блокировкой (D-36): `save` под замком
 * (`Lock`) читает запись хранилища (`stored`), сверяет версию и пишет
 * агрегат (`write`). Наследник реализует только чтение записи и запись —
 * чтение, сверка и запись атомарны в процессе.
 */
export abstract class VersionedRepository<A extends Versioned>
  implements Repository<A>
{
  abstract readonly aggregate: AnyAggregateDef;
  private readonly lock = new Lock();

  save(ar: A): Promise<void> {
    return this.lock.run(async () => {
      this.checkVersion(ar, await this.stored(ar.uuid));
      await this.write(ar);
    });
  }

  /** Запись с этим uuid в хранилище; нет записи — `undefined`. */
  protected abstract stored(uuid: string): Promise<StoredRecord | undefined>;

  /** Записать снапшот агрегата (новую запись или поверх прежней). */
  protected abstract write(ar: A): Promise<void>;

  /**
   * `stored` — запись с uuid агрегата или `undefined`, если её нет:
   * - новый агрегат — записи быть не должно (иначе `create` перезаписал бы
   *   чужую запись, в т. ч. legacy без `version`);
   * - восстановленный — запись есть, и её версия (без поля — 0) равна той,
   *   с которой агрегат загружен.
   * Иначе запись изменили параллельно — `VersionConflict`.
   */
  private checkVersion(ar: A, stored: StoredRecord | undefined): void {
    const ok =
      ar.storedVersion === undefined
        ? stored === undefined
        : stored !== undefined && (stored.version ?? 0) === ar.storedVersion;
    if (!ok) throw new VersionConflict(this.aggregate, ar.uuid);
  }
}
