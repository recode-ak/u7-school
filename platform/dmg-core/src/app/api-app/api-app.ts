import type { Command } from '#core/domain/contracts/command';
import type { AnyModuleDef } from '#core/domain/contracts/module-def';
import type {
  OutputOf,
  UseCaseErrorOf,
} from '#core/domain/contracts/use-case-def';
import type { Caller, Identified } from '#core/kernel/caller/caller';
import { CoreErrors } from '#core/kernel/errors/core-errors';
import type { DomainError } from '#core/kernel/errors/error';
import type { Result } from '#core/kernel/result/result';
import type { Trace } from '#core/kernel/trace/trace';
import type { AppContext } from '../context';
import { ModuleFacade } from '../facade/module-facade';
import { ModuleFacades } from '../facade/module-facades';
import type { JobReport } from '../job/job-from-def';
import type { AnyModuleFromDef } from '../module/module-from-def';
import type { ModuleFactory } from './api-app.types';

/**
 * Корень сборки и in-proc клиент приложения (D-49, D-50). Собирает модули
 * из фабрик в порядке `dependsOn`: каждый получает `ModuleFacades` только
 * своих зависимостей. Граф строится по имени Def (повтор, зависимость без
 * фабрики, цикл), затем при сборке Def сверяются по ссылке: Def из
 * `dependsOn` и Def собранного модуля — тот же объект, что у фабрики.
 * Иначе `ModuleFacade.serves` (сравнение UC по ссылке) не узнает свои UC и
 * ошибка всплывёт только в рантайме («Нет фасада»). Любое нарушение —
 * исключение сборки (ERR-01). Дальше — единственный вход в модули:
 * `dispatch`, `runJob`, `subscribe`.
 */
export class ApiApp<U extends Identified> {
  /** Собранные модули по имени — в порядке сборки. */
  private readonly modules = new Map<string, AnyModuleFromDef<U>>();
  /** Отписки действующей подписки `subscribe()`; `undefined` — не подписано. */
  private subscribed: readonly (() => void)[] | undefined;

  constructor(
    private readonly app: AppContext,
    factories: readonly ModuleFactory<U>[],
  ) {
    for (const factory of this.ordered(factories)) this.build(factory);
  }

  /**
   * Команда модулю (`ModuleFromDef.dispatch`): команда UC чужого модуля —
   * ошибка компиляции. Модуль не подключён (клиент другой версии, стёртый
   * тип) — `OPERATION_NOT_FOUND`, а не исключение.
   */
  dispatch<M extends AnyModuleDef, D extends M['useCases'][number]>(
    module: M,
    command: Command<D>,
    caller: Caller<U>,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
    const target = this.modules.get(module.name);
    if (target === undefined) {
      return Promise.resolve(
        CoreErrors.OPERATION_NOT_FOUND.err({
          module: module.name,
          uc: command.uc,
        }),
      );
    }
    return target.dispatch(command, caller, trace);
  }

  /**
   * Прогон Job модуля (`ModuleFromDef.runJob`). Расписание знает свои Job
   * заранее: модуль не подключён — ошибка конфигурации приложения в
   * рантайме, исключение, а не `Result` (ERR-01, как Job не из модуля в
   * `ModuleFromDef.runJob`).
   */
  runJob<M extends AnyModuleDef>(
    module: M,
    job: M['jobs'][number],
    trace: Trace,
  ): Promise<Result<JobReport, DomainError>> {
    const target = this.modules.get(module.name);
    if (target === undefined) {
      return Promise.reject(
        new Error(`Модуль ${module.name} не подключён к приложению`),
      );
    }
    return target.runJob(job, trace);
  }

  /**
   * Подписывает реакции всех модулей на шину; возвращает общую отписку.
   * Повторная подписка без отписки — исключение (ERR-01: ошибка
   * конфигурации, иначе каждое событие обработается дважды). После отписки
   * можно подписаться снова; повторный вызов старой отписки ничего не снимает.
   */
  subscribe(): () => void {
    if (this.subscribed !== undefined) {
      throw new Error(
        'Реакции приложения уже подписаны на шину: повторный subscribe() без отписки обработал бы каждое событие дважды',
      );
    }
    const offs = [...this.modules.values()].map((m) => m.subscribe());
    this.subscribed = offs;
    return () => {
      if (this.subscribed !== offs) return;
      this.subscribed = undefined;
      for (const off of offs) off();
    };
  }

  /**
   * Сборка модуля: зависимости уже собраны (`ordered`), их Def сверены по
   * ссылке с `dependsOn`; Def собранного модуля — объект фабрики.
   */
  private build(factory: ModuleFactory<U>): void {
    const facades = new ModuleFacades(
      factory.def.dependsOn.map(
        (dep) => new ModuleFacade(this.dependency(factory.def, dep)),
      ),
    );
    const module = factory.create({ app: this.app, facades });
    if (module.def !== factory.def) {
      throw new Error(
        module.def.name === factory.def.name
          ? `Фабрика модуля ${factory.def.name} вернула модуль ${module.def.name}: другой объект Def с тем же именем`
          : `Фабрика модуля ${factory.def.name} вернула модуль ${module.def.name}`,
      );
    }
    this.modules.set(module.def.name, module);
  }

  /**
   * Собранная зависимость `owner`, если её Def — тот же объект, что `dep`.
   * `ordered()` собирает каждую зависимость до зависимого и бросает, если у
   * неё нет фабрики, — модуль с именем `dep` уже собран.
   */
  private dependency(
    owner: AnyModuleDef,
    dep: AnyModuleDef,
  ): AnyModuleFromDef<U> {
    const module = this.modules.get(dep.name);
    if (module?.def !== dep) {
      throw new Error(
        `Модуль ${owner.name} зависит от ${dep.name}, но фабрика ${dep.name} подключила другой объект Def с тем же именем`,
      );
    }
    return module;
  }

  /**
   * Порядок сборки — обход в глубину по `dependsOn`: зависимость раньше
   * зависимого. Порядок фабрик во входе не важен.
   */
  private ordered(
    factories: readonly ModuleFactory<U>[],
  ): readonly ModuleFactory<U>[] {
    const byName = new Map<string, ModuleFactory<U>>();
    for (const factory of factories) {
      if (byName.has(factory.def.name)) {
        throw new Error(`Модуль ${factory.def.name} подключён дважды`);
      }
      byName.set(factory.def.name, factory);
    }
    const order: ModuleFactory<U>[] = [];
    const done = new Set<string>();
    /** Путь обхода от корня — для текста цикла. */
    const path: string[] = [];
    const visit = (factory: ModuleFactory<U>): void => {
      const { name } = factory.def;
      if (done.has(name)) return;
      if (path.includes(name)) {
        const cycle = [...path.slice(path.indexOf(name)), name];
        throw new Error(`Цикл в dependsOn: ${cycle.join(' → ')}`);
      }
      path.push(name);
      for (const dep of factory.def.dependsOn) {
        const next = byName.get(dep.name);
        if (next === undefined) {
          throw new Error(
            `Модуль ${name} зависит от ${dep.name}, но фабрики ${dep.name} в приложении нет`,
          );
        }
        visit(next);
      }
      path.pop();
      done.add(name);
      order.push(factory);
    };
    for (const factory of factories) visit(factory);
    return order;
  }
}
