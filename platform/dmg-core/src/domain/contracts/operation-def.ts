import { Def } from '#core/kernel/def/def';
import type { AnyErrorDef } from '#core/kernel/errors/error-def';
import type { AnyAggregateDef } from '../aggregate/aggregate-def';
import type { AnyUseCaseDef } from './define-use-case';
import type {
  OperationAbbr,
  OperationDmg,
  OperationFileKind,
  OperationSpec,
} from './operation-def.types';

export type {
  OperationAbbr,
  OperationDmg,
  OperationFileKind,
  OperationSpec,
} from './operation-def.types';

/**
 * База операций модуля (UC, ER, Job): межмодульные вызовы `calls`
 * и то, чем проверки графа и файлов различают виды, — агрегаты, ошибки,
 * сокращение и каталог файла. `C` — тип `calls` вида (`DeclaredCalls`):
 * не объявлены — пустой кортеж.
 */
export abstract class OperationDef<
  N extends string = string,
  C extends readonly AnyUseCaseDef[] = readonly AnyUseCaseDef[],
> extends Def<N> {
  abstract override readonly dmg: OperationDmg;
  abstract readonly abbr: OperationAbbr;
  abstract readonly fileKind: OperationFileKind;
  readonly calls: C;

  constructor(spec: OperationSpec<N>) {
    super(spec);
    // Необъявленные `calls` — пустой кортеж: тип `C` вида это и выводит.
    this.calls = (spec.calls ?? []) as C;
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
