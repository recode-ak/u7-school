import {
  type ModuleAr,
  ModulePolicy,
  type StepAr,
} from '@u7-scl/domain/course';
import {
  type CourseModuleDef,
  GetStepUcDef,
  ModuleErrors,
  StepErrors,
} from '@u7-scl/domain/course/contract';
import { type Caller, CoreErrors, err, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { CourseModuleDeps, CourseUser } from '../../course.module';

type Loaded = { readonly step: StepAr; readonly module: ModuleAr };
type Input = ParsedInputOf<typeof GetStepUcDef>;

/**
 * Шаг для показа: доступ решают правила `ModulePolicy` модуля-владельца
 * (в Def UC не выражается: контекст правила — загруженный модуль, а не шаг).
 */
export class GetStepUc extends UseCaseFromDef<
  typeof GetStepUcDef,
  CourseModuleDeps,
  Loaded,
  CourseUser
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetStepUcDef, deps, module);
  }

  protected async load({ stepId }: Input) {
    const step = await this.resolve.steps.findById(stepId);
    if (!step) return err(StepErrors.NOT_FOUND.make({ stepId }));

    const module = await this.resolve.modules.findById(step.moduleId);
    if (!module) {
      return err(ModuleErrors.NOT_FOUND.make({ moduleId: step.moduleId }));
    }
    return ok({ step, module });
  }

  protected async execute(
    _: Input,
    { step, module }: Loaded,
    __: UnitOfWork,
    caller: Caller<CourseUser>,
  ) {
    // Тело — canReadStepBody, только если опубликованы и шаг, и его модуль;
    // иначе (черновик, архив шага или модуля) — canSeeUnpublished.
    const rules = ModulePolicy.rules;
    const rule =
      step.isPublished() && module.isPublished()
        ? rules.canReadStepBody
        : rules.canSeeUnpublished;
    const decision = rule.evaluate(caller.subject(), { module });
    if (decision.allowed) return ok(step.view());
    return CoreErrors.ACCESS_DENIED.err({
      rule: rule.name,
      denyMessage: rule.denyMessage,
    });
  }
}
