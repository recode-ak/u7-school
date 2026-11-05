import type { User } from '@u7-scl/app-legacy/domain';
import type { Course } from '@u7-scl/domain/course';
import {
  CourseSchema,
  type CreateCourseCmd,
  type CreateCourseCmdMeta,
  CreateCourseCmdSchema,
  LegacyCourseAr,
  LegacyCoursePolicy,
} from '@u7-scl/domain/course';
import { CourseUseCase } from '../course-uc';

/**
 * Use-case создания курса.
 */
export class CreateCourseUc extends CourseUseCase<CreateCourseCmdMeta> {
  protected readonly ucName = 'create-course' as const;
  protected readonly ucLabel = 'Создать курс' as const;
  protected readonly arMeta = {
    arName: LegacyCourseAr.arName as 'Course',
    arLabel: LegacyCourseAr.arLabel as 'Курс',
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = CreateCourseCmdSchema;
  protected readonly outputSchema = CourseSchema;

  async execute(command: CreateCourseCmd, actor: User): Promise<Course> {
    if (!LegacyCoursePolicy.canCreate(actor)) {
      this.throwAccessDenied('Недостаточно прав для создания курса');
    }

    const ar = LegacyCourseAr.create(
      command.title,
      command.description,
      actor.uuid,
    );
    await this.resolve.courseRepo.save(ar.state);

    return ar.state;
  }
}
