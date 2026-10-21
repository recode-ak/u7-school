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
import type { Result } from '#core/kernel/result/result';
import type { Timestamp } from '#core/kernel/time/timestamp';
import type { ModuleDeps } from '../context';
import type { Trace } from '../trace';

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
 * (`ModuleFromDef`), база проверяет, что Def входит в модуль.
 */
export abstract class OperationFromDef<
  D extends AnyOperationDef,
  R extends ModuleDeps,
> {
  /** Эта операция — `from` вызывающего, когда она зовёт другие модули. */
  readonly ref: OperationRef;

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
  }

  /** Текущий момент по часам приложения — передаётся в операции домена. */
  protected now(): Timestamp {
    return this.resolve.app.clock();
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
}
