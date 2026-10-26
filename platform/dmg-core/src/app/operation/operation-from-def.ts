import type { AnyAggregateDef } from '#core/domain/aggregate/aggregate-def';
import type { AnyEventReactionDef } from '#core/domain/contracts/define-event-reaction';
import type { AnyJobDef } from '#core/domain/contracts/define-job';
import type { AnyModuleDef } from '#core/domain/contracts/define-module';
import type {
  AnyUseCaseDef,
  InputOf,
  OutputOf,
  UseCaseErrorOf,
} from '#core/domain/contracts/define-use-case';
import {
  type Caller,
  type OperationRef,
  SystemCaller,
} from '#core/kernel/caller/caller';
import type { DomainError } from '#core/kernel/errors/error';
import { serializeError } from '#core/kernel/errors/serialize-error';
import type { Result } from '#core/kernel/result/result';
import type { Timestamp } from '#core/kernel/time/timestamp';
import type { Trace } from '#core/kernel/trace/trace';
import type { ModuleDeps } from '../context';
import type { OperationRecord } from '../oplog/operation-record';
import { type OperationCall, OperationRun } from '../oplog/operation-run';
import { UnitOfWork } from '../uow/unit-of-work';

/** Def операции приложения: UC, ER или Job. */
export type AnyOperationDef = AnyUseCaseDef | AnyEventReactionDef | AnyJobDef;

/**
 * UC других модулей, которые операция объявила в `calls`. Нет `calls` (или
 * пустой список) — `never`: вызвать нечего.
 */
export type CallsOf<D> = D extends { readonly calls?: infer C }
  ? C extends readonly (infer U extends AnyUseCaseDef)[]
    ? U
    : never
  : never;

/** Где в Def модуля лежат операции каждого вида и как их называть. */
const PLACE = {
  useCase: { list: 'useCases', label: 'UC' },
  eventReaction: { list: 'reactions', label: 'ER' },
  job: { list: 'jobs', label: 'Job' },
} as const;

/**
 * Общая база UC, ER и Job по Def (D-43, Р5): ссылка на операцию (`ref` —
 * `from` её системных вызовов), часы приложения и типизированный вызов UC
 * другого модуля. Модуль-владелец передаёт себя при создании операции
 * (`ModuleFromDef`), база проверяет, что Def входит в модуль. Каждый вызов
 * пишется в лог операций (`journal`, Р6).
 */
export abstract class OperationFromDef<
  D extends AnyOperationDef,
  R extends ModuleDeps,
> {
  /** Эта операция — `from` вызывающего, когда она зовёт другие модули. */
  readonly ref: OperationRef;
  /** Модуль-владелец: его агрегаты — единственные, что меняет UoW (MAN-13). */
  private readonly module: AnyModuleDef;

  /** Def не из модуля — исключение (ошибка сборки). */
  protected constructor(
    readonly def: D,
    protected readonly resolve: R,
    module: AnyModuleDef,
    kind: OperationRef['kind'],
  ) {
    const { list, label } = PLACE[kind];
    const own: readonly AnyOperationDef[] = module[list];
    if (!own.includes(def)) {
      throw new Error(`${label} ${def.name} не входит в модуль ${module.name}`);
    }
    this.ref = { kind, module: module.name, name: def.name };
    this.module = module;
  }

  /** Текущий момент по часам приложения — передаётся в операции домена. */
  protected now(): Timestamp {
    return this.resolve.app.clock();
  }

  /**
   * UoW вызова со сверкой по Def (D-43, Р8): события — по `emits`, агрегаты —
   * только своего модуля (MAN-13) и по `touches` (ER) или `scans` (Job); у
   * UC в пределах модуля агрегаты не ограничены.
   * Расхождение — баг реализации: в test и development — исключение, в
   * production — `warn` в лог от имени операции, а операция завершается
   * (отказ пользователю из-за описания контракта хуже, чем запись для
   * разбора).
   */
  protected createUow(trace: Trace): UnitOfWork {
    const { app } = this.resolve;
    const def: AnyOperationDef = this.def;
    const touches = touchesOf(def);
    return new UnitOfWork({
      outbox: app.outbox,
      clock: app.clock,
      trace,
      module: this.module,
      emits: def.emits ?? [],
      ...(touches === undefined ? {} : { touches }),
      ...(app.mode === 'production'
        ? {
            onViolation: (message: string) =>
              app.logger.warn(def.name, message),
          }
        : {}),
    });
  }

  /**
   * UC другого модуля — только из `calls` Def (тип; согласованность с
   * графом — `checkDefs`). Вызывающий — `SystemCaller` этой операции с
   * человеком пришедшего (`caller.person()`, матрёшки нет), след — дальше
   * по цепочке. Фасад модуля-владельца выбирает `resolve.facades`; отказ
   * вызванного UC — его ответ как есть.
   */
  protected call<C extends CallsOf<D>>(
    def: C,
    input: InputOf<C>,
    caller: Caller,
    trace: Trace,
  ): Promise<Result<OutputOf<C>, UseCaseErrorOf<C>>> {
    return this.resolve.facades.call(
      def,
      input,
      new SystemCaller(this.ref, caller.person()),
      trace,
    );
  }

  /**
   * Вызов операции с записью в лог операций последним шагом — при успехе и
   * при отказе (D-43, Р6). `body` не бросает: исключение наследник уже
   * превратил в `SERVER_INTERNAL` (запись — с ним, детали — в логгере).
   * UoW вызова регистрируются в `run.track` — их события попадают в запись.
   * Сбой записи лога операцию не ломает: данные уже зафиксированы, отказ
   * вызвал бы повтор и дубль — только `warn` в логгер.
   */
  protected async journal<T, E extends DomainError>(
    call: OperationCall,
    body: (run: OperationRun) => Promise<Result<T, E>>,
  ): Promise<Result<T, E>> {
    const run = new OperationRun(this.ref, this.now(), call);
    const result = await body(run);
    await this.append(run.record(result));
    return result;
  }

  private async append(record: OperationRecord): Promise<void> {
    try {
      await this.resolve.app.oplog.append(record);
    } catch (error) {
      this.resolve.app.logger.warn(
        this.def.name,
        'Не удалось записать лог операции',
        serializeError(error),
      );
    }
  }
}

/** Агрегаты, которые операции разрешено менять; у UC — без ограничения. */
function touchesOf(
  def: AnyOperationDef,
): readonly AnyAggregateDef[] | undefined {
  if (def.dmg === 'eventReaction') return def.touches;
  if (def.dmg === 'job') return def.scans;
  return undefined;
}
