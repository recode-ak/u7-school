import type { User } from '@u7-scl/app-legacy/domain';
import { errNotFound } from '@u7-scl/core/domain';
import type { LessonNotFoundUcError, Step } from '@u7-scl/domain/course';
import {
  CourseDs,
  type CreateStepCmd,
  type CreateStepCmdMeta,
  CreateStepCmdSchema,
  LegacyLessonAr,
  LegacyModulePolicy,
  LegacyStepAr,
  LegacyStepPolicy,
  StepSchema,
} from '@u7-scl/domain/course';
import { CourseUseCase } from '../course-uc';

/**
 * Use-case создания шага.
 * Требует прав AUTHOR + проверка авторства курса через LegacyModulePolicy.
 */
export class CreateStepUc extends CourseUseCase<CreateStepCmdMeta> {
  protected readonly ucName = 'create-step' as const;
  protected readonly ucLabel = 'Создать шаг' as const;
  protected readonly arMeta = {
    arName: LegacyStepAr.arName as 'Step',
    arLabel: LegacyStepAr.arLabel as 'Шаг',
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = CreateStepCmdSchema;
  protected readonly outputSchema = StepSchema;

  async execute(command: CreateStepCmd, actor: User): Promise<Step> {
    if (!LegacyStepPolicy.canCreate(actor)) {
      this.throwAccessDenied('Недостаточно прав для создания шага');
    }

    const course = await this.getModule(command.moduleId);
    if (!LegacyModulePolicy.canEdit(actor, course)) {
      this.throwAccessDenied('Вы не являетесь автором модуля');
    }

    const lessonState = await this.resolve.lessonRepo.getByUuid(
      command.lessonId,
    );
    if (!lessonState) {
      this.throwError(
        errNotFound<LessonNotFoundUcError>(
          'LESSON_NOT_FOUND',
          'Урок не найден',
          { uuid: command.lessonId },
        ),
      );
    }

    const ds = new CourseDs();
    const lessonAr = new LegacyLessonAr(lessonState);
    const { lesson, step } = ds.createStep(lessonAr, command);

    const db = this.resolve.db;
    if (db) {
      db.begin();
      try {
        await this.resolve.lessonRepo.save(lesson.state);
        await this.resolve.stepRepo.save(step.state);
        await db.commit();
      } catch (e) {
        db.rollback();
        throw e;
      }
    } else {
      await this.resolve.lessonRepo.save(lesson.state);
      await this.resolve.stepRepo.save(step.state);
    }

    return step.state;
  }
}
