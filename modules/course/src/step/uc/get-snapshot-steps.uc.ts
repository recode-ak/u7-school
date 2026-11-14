import type { StepAr } from '@u7-scl/domain/course';
import {
  type CourseModuleDef,
  GetSnapshotStepsUcDef,
} from '@u7-scl/domain/course/contract';
import { ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { CourseModuleDeps, CourseUser } from '../../course.module';

type Loaded = { readonly steps: readonly StepAr[] };
type Input = ParsedInputOf<typeof GetSnapshotStepsUcDef>;

/**
 * Шаги снимка потока для модуля `stream`: любой статус, один запрос в
 * репозиторий, порядок — как в `stepIds`. Модуль-владелец не спрашивается —
 * право на чтение проверил `stream` по снимку.
 */
export class GetSnapshotStepsUc extends UseCaseFromDef<
  typeof GetSnapshotStepsUcDef,
  CourseModuleDeps,
  Loaded,
  CourseUser
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetSnapshotStepsUcDef, deps, module);
  }

  protected async load({ stepIds }: Input) {
    const steps =
      stepIds.length === 0 ? [] : await this.resolve.steps.findByIds(stepIds);
    return ok({ steps });
  }

  protected async execute(
    { stepIds }: Input,
    { steps }: Loaded,
    __: UnitOfWork,
  ) {
    const byId = new Map(steps.map((it) => [it.uuid, it]));
    return ok(
      stepIds
        .map((stepId) => byId.get(stepId))
        .filter((it): it is StepAr => it !== undefined)
        .map((it) => it.view()),
    );
  }
}
