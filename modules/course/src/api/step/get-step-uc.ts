import type { User } from '@u7-scl/app-legacy/domain';
import { errNotFound } from '@u7-scl/core/domain';
import type {
  LegacyStepRepo,
  Step,
  StepNotFoundUcError,
} from '@u7-scl/domain/course';
import {
  type GetStepCmd,
  type GetStepCmdMeta,
  GetStepCmdSchema,
  LegacyStepAr,
  StepSchema,
} from '@u7-scl/domain/course';
import { CourseUseCase } from '../course-uc';

/**
 * Use-case получения шага по UUID.
 * Без actor — только PUBLISHED. С actor — через LegacyStepPolicy.
 */
export class GetStepUc extends CourseUseCase<GetStepCmdMeta> {
  protected readonly ucName = 'get-step' as const;
  protected readonly ucLabel = 'Получить шаг по UUID' as const;
  protected readonly arMeta = {
    arName: LegacyStepAr.arName as 'Step',
    arLabel: LegacyStepAr.arLabel as 'Шаг',
  };
  protected readonly type = 'query' as const;
  protected readonly requiresAuth = false as const;
  protected readonly inputSchema = GetStepCmdSchema;
  protected readonly outputSchema = StepSchema;

  async execute(command: GetStepCmd, actor?: User): Promise<Step> {
    const step = await (this.resolve.stepRepo as LegacyStepRepo).getByUuid(
      command.uuid,
    );
    if (!step) {
      this.throwError(
        errNotFound<StepNotFoundUcError>('STEP_NOT_FOUND', 'Шаг не найден', {
          uuid: command.uuid,
        }),
      );
    }

    // Актор приходит параметром (объект или undefined для анонимных запросов)

    return this.getOutStep(step, actor);
  }
}
