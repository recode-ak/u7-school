import { U7UseCase, type User } from '@u7-scl/app-legacy/domain';
import type { UcMeta } from '@u7-scl/core/api';
import { errAccessDenied, errNotFound } from '@u7-scl/core/domain';
import type {
  CourseApiModuleResolver,
  Lesson,
  Module,
  ModuleAccessDeniedUcError,
  ModuleNotFoundUcError,
  Step,
} from '@u7-scl/domain/course';
import {
  LegacyLessonAr,
  LegacyModuleAr,
  LegacyStepAr,
} from '@u7-scl/domain/course';

/**
 * Базовый класс для всех use-case'ов модуля курсов.
 */
export abstract class CourseUseCase<TMeta extends UcMeta> extends U7UseCase<
  TMeta,
  CourseApiModuleResolver
> {
  protected async getModule(moduleId: string): Promise<Module> {
    const module = await this.resolve.moduleRepo.getByUuid(moduleId);
    if (!module) {
      this.throwError(
        errNotFound<ModuleNotFoundUcError>(
          'MODULE_NOT_FOUND',
          'Модуль не найден',
          { uuid: moduleId },
        ),
      );
    }
    return module;
  }

  protected throwAccessDenied(
    message = 'Недостаточно прав для выполнения действия',
  ): never {
    this.throwError(
      errAccessDenied<ModuleAccessDeniedUcError>(
        'MODULE_ACCESS_DENIED',
        message,
        undefined,
      ),
    );
  }

  // ──────────────── Выходные хелперы ────────────────

  /**
   * Возвращает модуль в читаемом виде через LegacyModuleAr.getVisibleFor.
   * Бросает ACCESS_DENIED если модуль не виден актору.
   */
  protected getOutModule(module: Module, actor?: User): Module {
    const ar = new LegacyModuleAr(module);
    const result = ar.getVisibleFor(actor);
    if (!result) {
      this.throwError(
        errAccessDenied<ModuleAccessDeniedUcError>(
          'MODULE_ACCESS_DENIED',
          'Нет доступа к модулю',
          undefined,
        ),
      );
    }
    return result;
  }

  /**
   * Возвращает урок в читаемом виде через LegacyLessonAr.getVisibleFor.
   * Бросает ACCESS_DENIED если урок не виден актору.
   */
  protected async getOutLesson(lesson: Lesson, actor?: User): Promise<Lesson> {
    const module = await this.getModule(lesson.moduleId);
    const ar = new LegacyLessonAr(lesson);
    const result = ar.getVisibleFor(actor, module);
    if (!result) {
      this.throwError(
        errAccessDenied(
          'LESSON_ACCESS_DENIED' as never,
          'Нет доступа к уроку',
          {
            uuid: lesson.uuid,
          },
        ),
      );
    }
    return result;
  }

  /**
   * Возвращает шаг в читаемом виде через LegacyStepAr.getVisibleFor.
   * Бросает ACCESS_DENIED если шаг не виден актору.
   */
  protected async getOutStep(step: Step, actor?: User): Promise<Step> {
    const module = await this.getModule(step.moduleId);
    const ar = new LegacyStepAr(step);
    const result = ar.getVisibleFor(actor, module);
    if (!result) {
      this.throwError(
        errAccessDenied('STEP_ACCESS_DENIED' as never, 'Нет доступа к шагу', {
          uuid: step.uuid,
        }),
      );
    }
    return result;
  }

  /**
   * Получает пользователя по ID (делегирует фасаду).
   */
  protected async getUser(
    userId: string,
    actor?: User,
  ): Promise<User | undefined> {
    return this.resolve.userFacade.getUserByUuid(userId, actor);
  }
}
