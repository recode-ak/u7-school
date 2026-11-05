import type { User } from '@u7-scl/app-legacy/domain';
import { errNotFound } from '@u7-scl/core/domain';
import type { Course, CourseNotFoundUcError } from '@u7-scl/domain/course';
import {
  type AddPhaseToCourseCmd,
  type AddPhaseToCourseCmdMeta,
  AddPhaseToCourseCmdSchema,
  CourseSchema,
  LegacyCourseAr,
  LegacyCoursePolicy,
} from '@u7-scl/domain/course';
import { CourseUseCase } from '../course-uc';

/**
 * Use-case добавления фазы в курс.
 * Требует прав ADMIN или автор курса.
 */
export class AddPhaseToCourseUc extends CourseUseCase<AddPhaseToCourseCmdMeta> {
  protected readonly ucName = 'add-phase-to-course' as const;
  protected readonly ucLabel = 'Добавить фазу в курс' as const;
  protected readonly arMeta = {
    arName: LegacyCourseAr.arName as 'Course',
    arLabel: LegacyCourseAr.arLabel as 'Курс',
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = AddPhaseToCourseCmdSchema;
  protected readonly outputSchema = CourseSchema;

  async execute(command: AddPhaseToCourseCmd, actor: User): Promise<Course> {
    const course = await this.getCourse(command.courseId);

    if (!LegacyCoursePolicy.canEdit(actor, course)) {
      this.throwAccessDenied('Недостаточно прав для редактирования курса');
    }

    const ar = new LegacyCourseAr(course);
    ar.addPhase(command.title, command.track);
    await this.resolve.courseRepo.save(ar.state);

    return ar.state;
  }

  private async getCourse(uuid: string): Promise<Course> {
    const course = await this.resolve.courseRepo.getByUuid(uuid);
    if (!course) {
      this.throwError(
        errNotFound<CourseNotFoundUcError>(
          'COURSE_NOT_FOUND',
          'Курс не найден',
          {
            uuid,
          },
        ),
      );
    }
    return course;
  }
}
