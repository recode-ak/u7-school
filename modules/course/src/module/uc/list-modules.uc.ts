import {
  type ModuleAr,
  ModulePolicy,
  type ModuleSummary,
} from '@u7-scl/domain/course';
import {
  type CourseModuleDef,
  ListModulesUcDef,
} from '@u7-scl/domain/course/contract';
import { type Caller, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { CourseModuleDeps, CourseUser } from '../../course.module';

type Input = ParsedInputOf<typeof ListModulesUcDef>;

/**
 * Модули карточками: выборку, сортировку и `limit` делает репозиторий, поэтому
 * `limit` отсекает **до** отбора видимых (как в v0.2.6, Т6): невидимые не
 * отбрасываются с добором — ответ может быть короче `limit`.
 */
export class ListModulesUc extends UseCaseFromDef<
  typeof ListModulesUcDef,
  CourseModuleDeps,
  undefined,
  CourseUser
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(ListModulesUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute(
    filter: Input,
    _: undefined,
    __: UnitOfWork,
    caller: Caller<CourseUser>,
  ) {
    const visible: ModuleSummary[] = [];
    for (const module of await this.resolve.modules.findAll(filter)) {
      if (this.visible(module, caller)) visible.push(module.summary());
    }
    return ok(visible);
  }

  /** Видимость решает `viewFor` по праву `canSeeUnpublished`; карточке хватает `summary`. */
  private visible(module: ModuleAr, caller: Caller<CourseUser>): boolean {
    const { allowed } = ModulePolicy.rules.canSeeUnpublished.evaluate(
      caller.subject(),
      { module },
    );
    return module.viewFor(allowed) !== undefined;
  }
}
