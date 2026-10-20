import type { User } from '@u7-scl/app/domain';
import type { Course } from '@u7-scl/domain/course';
import {
  CourseSchema,
  type ListCoursesCmd,
  type ListCoursesCmdMeta,
  ListCoursesCmdSchema,
  Status,
} from '@u7-scl/domain/course';
import * as v from 'valibot';
import { CourseUseCase } from '../course-uc';

const CoursesListOutputSchema = v.array(CourseSchema);

/**
 * Use-case получения списка курсов.
 * Без actor — только PUBLISHED.
 */
export class ListCoursesUc extends CourseUseCase<ListCoursesCmdMeta> {
  protected readonly ucName = 'list-courses' as const;
  protected readonly ucLabel = 'Получить список курсов' as const;
  protected readonly arMeta = {
    arName: 'Course' as const,
    arLabel: 'Курс' as const,
  };
  protected readonly type = 'query' as const;
  protected readonly requiresAuth = false as const;
  protected readonly inputSchema = ListCoursesCmdSchema;
  protected readonly outputSchema = CoursesListOutputSchema;

  async execute(command: ListCoursesCmd, _actor?: User): Promise<Course[]> {
    const courses = await this.resolve.courseRepo.getAll({
      status: command.status ?? Status.PUBLISHED,
      authorId: command.authorId,
      title: command.title,
      sort: command.sort,
      limit: command.limit,
    });

    return courses;
  }
}
