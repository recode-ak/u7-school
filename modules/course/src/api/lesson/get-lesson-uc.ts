import type { User } from '@u7-scl/app-legacy/domain';
import { errNotFound } from '@u7-scl/core/domain';
import type {
  LegacyLessonRepo,
  Lesson,
  LessonNotFoundUcError,
} from '@u7-scl/domain/course';
import {
  type GetLessonCmd,
  type GetLessonCmdMeta,
  GetLessonCmdSchema,
  LegacyLessonAr,
  LessonSchema,
} from '@u7-scl/domain/course';
import { CourseUseCase } from '../course-uc';

/**
 * Use-case получения урока по UUID.
 * Без actor — только PUBLISHED. С actor — через LegacyLessonPolicy.
 */
export class GetLessonUc extends CourseUseCase<GetLessonCmdMeta> {
  protected readonly ucName = 'get-lesson' as const;
  protected readonly ucLabel = 'Получить урок по UUID' as const;
  protected readonly arMeta = {
    arName: LegacyLessonAr.arName as 'Lesson',
    arLabel: LegacyLessonAr.arLabel as 'Урок',
  };
  protected readonly type = 'query' as const;
  protected readonly requiresAuth = false as const;
  protected readonly inputSchema = GetLessonCmdSchema;
  protected readonly outputSchema = LessonSchema;

  async execute(command: GetLessonCmd, actor?: User): Promise<Lesson> {
    const lesson = await (
      this.resolve.lessonRepo as LegacyLessonRepo
    ).getByUuid(command.uuid);
    if (!lesson) {
      this.throwError(
        errNotFound<LessonNotFoundUcError>(
          'LESSON_NOT_FOUND',
          'Урок не найден',
          { uuid: command.uuid },
        ),
      );
    }

    // Актор приходит параметром (объект или undefined для анонимных запросов)

    return this.getOutLesson(lesson, actor);
  }
}
