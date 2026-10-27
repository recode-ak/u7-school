import { Def } from '#core/kernel/def/def';
import type { AnyErrorDef } from '#core/kernel/errors/error-def';
import type { AnyAggregateDef } from '../aggregate/aggregate-def';
import type {
  OperationAbbr,
  OperationDmg,
  OperationFileKind,
  OperationSpec,
} from './operation-def.types';
import type { AnyUseCaseDef } from './use-case-def.types';

export type {
  OperationAbbr,
  OperationDmg,
  OperationFileKind,
  OperationSpec,
} from './operation-def.types';

/**
 * База операций модуля (UC, ER, Job): межмодульные вызовы `calls`
 * и то, чем проверки графа и файлов различают виды, — агрегаты, ошибки,
 * сокращение и каталог файла. Вид сужает тип `calls` через
 * `declare readonly calls: DeclaredCalls<S>` (не параметром базы:
 * `AnyUseCaseDef` выводится из наследника, аргумент `extends` дал бы цикл).
 */
export abstract class OperationDef<N extends string = string> extends Def<N> {
  abstract override readonly dmg: OperationDmg;
  abstract readonly abbr: OperationAbbr;
  abstract readonly fileKind: OperationFileKind;
  readonly calls: readonly AnyUseCaseDef[];

  constructor(spec: OperationSpec<N>) {
    super(spec);
    // Необъявленные `calls` — пустой кортеж: так их и типизирует вид.
    this.calls = spec.calls ?? [];
  }

  /** Агрегаты своего модуля, которые операция меняет или читает (MAN-13). */
  abstract aggregates(): readonly AnyAggregateDef[];

  /** Ошибки, на которые ссылается контракт; базовые ядра не входят. */
  referencedErrors(): readonly AnyErrorDef[] {
    return [];
  }

  /** Агрегат, в папке которого лежит файл операции; нет — любой. */
  mainAggregate(): AnyAggregateDef | undefined {
    return this.aggregates()[0];
  }

  /** Вид и id в модуле для сообщений: `UC todo.createTask`. */
  title(module: { readonly name: string }): string {
    return `${this.abbr} ${module.name}.${this.name}`;
  }
}
