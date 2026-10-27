import { describe, expect, expectTypeOf, it } from 'bun:test';
import { Def } from '#core/kernel/def/def';
import type { AnyErrorDef } from '#core/kernel/errors/error-def';
import type { AnyAggregateDef } from '../aggregate/aggregate-def';
import {
  GetUserUcDef,
  TaskArDef,
  TaskErrors,
  UserArDef,
} from './contracts.fixture';
import type { AnyUseCaseDef, DeclaredCalls } from './define-use-case';
import { OperationDef, type OperationSpec } from './operation-def';

type ScanSpec = OperationSpec & {
  readonly scans?: readonly AnyAggregateDef[];
};

/** Минимальный вид операции: агрегаты из `scans`, без своих ошибок. */
class ScanDef<const S extends ScanSpec = ScanSpec> extends OperationDef<
  S['name'],
  DeclaredCalls<S>
> {
  readonly dmg = 'job';
  readonly abbr = 'Job';
  readonly fileKind = 'job';
  readonly scans: readonly AnyAggregateDef[];

  constructor(spec: S) {
    super(spec);
    this.scans = spec.scans ?? [];
  }

  static define<const S extends ScanSpec>(spec: S): ScanDef<S> {
    return new ScanDef(spec);
  }

  aggregates(): readonly AnyAggregateDef[] {
    return this.scans;
  }

  normalize(): { readonly dmg: 'job' } {
    return { dmg: this.dmg };
  }
}

/** Вид с ошибками: переопределяет `referencedErrors()`. */
class FailingDef extends OperationDef {
  readonly dmg = 'useCase';
  readonly abbr = 'UC';
  readonly fileKind = 'uc';
  readonly errors: readonly AnyErrorDef[] = [TaskErrors.NOT_FOUND];

  aggregates(): readonly AnyAggregateDef[] {
    return [TaskArDef];
  }

  override referencedErrors(): readonly AnyErrorDef[] {
    return this.errors;
  }

  normalize(): { readonly dmg: 'useCase' } {
    return { dmg: this.dmg };
  }
}

const texts = { label: 'Метка', description: 'Описание.' };

describe('OperationDef', () => {
  it('наследник Def', () => {
    const op = ScanDef.define({ name: 'remind', ...texts });
    expect(op).toBeInstanceOf(OperationDef);
    expect(op).toBeInstanceOf(Def);
    expectTypeOf(op.name).toEqualTypeOf<'remind'>();
  });

  it('calls не объявлены — пустой кортеж из конструктора', () => {
    const op = ScanDef.define({ name: 'remind', ...texts });
    expect(op.calls).toEqual([]);
    expectTypeOf(op.calls).toEqualTypeOf<readonly []>();
  });

  it('calls объявлены — те же Def по ссылке, литеральный тип', () => {
    const op = ScanDef.define({
      name: 'remind',
      ...texts,
      calls: [GetUserUcDef],
    });
    expect(op.calls[0]).toBe(GetUserUcDef);
    expectTypeOf(op.calls).toEqualTypeOf<readonly [typeof GetUserUcDef]>();
    const any: readonly AnyUseCaseDef[] = op.calls;
    expect(any.includes(GetUserUcDef)).toBe(true);
  });

  it('aggregates() и mainAggregate() — первый из агрегатов вида', () => {
    const op = ScanDef.define({
      name: 'remind',
      ...texts,
      scans: [UserArDef, TaskArDef],
    });
    expect(op.aggregates()).toEqual([UserArDef, TaskArDef]);
    expect(op.mainAggregate()).toBe(UserArDef);
  });

  it('mainAggregate() без агрегатов — undefined', () => {
    const op = ScanDef.define({ name: 'remind', ...texts });
    expect(op.mainAggregate()).toBeUndefined();
  });

  it('referencedErrors() — по умолчанию нет, вид дополняет', () => {
    expect(
      ScanDef.define({ name: 'remind', ...texts }).referencedErrors(),
    ).toEqual([]);
    const op = new FailingDef({ name: 'completeTask', ...texts });
    expect(op.referencedErrors()).toEqual([TaskErrors.NOT_FOUND]);
  });

  it('title(module) — сокращение вида и id в модуле', () => {
    const job = ScanDef.define({ name: 'remind', ...texts });
    const uc = new FailingDef({ name: 'completeTask', ...texts });
    expect(job.title({ name: 'todo' })).toBe('Job todo.remind');
    expect(uc.title({ name: 'todo' })).toBe('UC todo.completeTask');
  });

  it('fileKind — каталог и суффикс файла операции', () => {
    expect(ScanDef.define({ name: 'remind', ...texts }).fileKind).toBe('job');
    expect(new FailingDef({ name: 'x', ...texts }).fileKind).toBe('uc');
  });

  it('полиморфно: список операций разных видов', () => {
    const ops: readonly OperationDef[] = [
      ScanDef.define({ name: 'remind', ...texts, scans: [UserArDef] }),
      new FailingDef({ name: 'completeTask', ...texts }),
    ];
    expect(ops.map((op) => op.mainAggregate())).toEqual([UserArDef, TaskArDef]);
  });

  it('структурная типизация: нет private/#', () => {
    type PublicShape = { [K in keyof ScanDef]: ScanDef[K] };
    expectTypeOf<PublicShape>().toExtend<ScanDef>();
  });
});
