import { type ModuleAr, ModulePolicy } from '@u7-scl/domain/course';
import {
  type CourseModuleDef,
  GetModuleUcDef,
  ModuleErrors,
} from '@u7-scl/domain/course/contract';
import { type Caller, CoreErrors, err, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { CourseModuleDeps, CourseUser } from '../../course.module';

type Loaded = { readonly module: ModuleAr };
type Input = ParsedInputOf<typeof GetModuleUcDef>;

/**
 * Модуль для показа: чтение открыто всем, право на неопубликованное считает
 * `ModulePolicy` здесь — гость субъекта не имеет, правилом Def UC это не
 * выражается (Т4), а `undefined` от `viewFor` становится отказом.
 */
export class GetModuleUc extends UseCaseFromDef<
  typeof GetModuleUcDef,
  CourseModuleDeps,
  Loaded,
  CourseUser
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetModuleUcDef, deps, module);
  }

  protected async load({ moduleId }: Input) {
    const module = await this.resolve.modules.findById(moduleId);
    return module
      ? ok({ module })
      : err(ModuleErrors.NOT_FOUND.make({ moduleId }));
  }

  protected async execute(
    _: Input,
    { module }: Loaded,
    __: UnitOfWork,
    caller: Caller<CourseUser>,
  ) {
    const { allowed } = ModulePolicy.rules.canSeeUnpublished.evaluate(
      caller.subject(),
      { module },
    );
    const view = module.viewFor(allowed);
    if (view === undefined) {
      return CoreErrors.ACCESS_DENIED.err({
        rule: 'canSeeUnpublished',
        denyMessage: ModulePolicy.rules.canSeeUnpublished.denyMessage,
      });
    }
    return ok(view);
  }
}
