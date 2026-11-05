import type { User } from '@u7-scl/app-legacy/domain';
import type { Lesson } from '@u7-scl/domain/course';
import {
  CourseDs,
  type CreateLessonCmd,
  type CreateLessonCmdMeta,
  CreateLessonCmdSchema,
  LegacyLessonAr,
  LegacyLessonPolicy,
  LegacyModuleAr,
  LegacyModulePolicy,
  LessonSchema,
} from '@u7-scl/domain/course';
import { CourseUseCase } from '../course-uc';

/**
 * Use-case создания урока.
 * Требует прав AUTHOR + проверка авторства курса через LegacyModulePolicy.
 * Использует CourseDs для координации Course + Lesson + транзакционное сохранение.
 */
export class CreateLessonUc extends CourseUseCase<CreateLessonCmdMeta> {
  protected readonly ucName = 'create-lesson' as const;
  protected readonly ucLabel = 'Создать урок' as const;
  protected readonly arMeta = {
    arName: LegacyLessonAr.arName as 'Lesson',
    arLabel: LegacyLessonAr.arLabel as 'Урок',
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = CreateLessonCmdSchema;
  protected readonly outputSchema = LessonSchema;

  async execute(command: CreateLessonCmd, actor: User): Promise<Lesson> {
    if (!LegacyLessonPolicy.canCreate(actor)) {
      this.throwAccessDenied('Недостаточно прав для создания урока');
    }

    const courseState = await this.getModule(command.moduleId);
    if (!LegacyModulePolicy.canEdit(actor, courseState)) {
      this.throwAccessDenied('Вы не являетесь автором модуля');
    }

    const courseAr = new LegacyModuleAr(courseState);
    const ds = new CourseDs();
    const { module, lesson } = ds.createLesson(
      courseAr,
      command,
      command.projectId,
    );

    const db = this.resolve.db;
    if (db) {
      db.begin();
      try {
        await this.resolve.moduleRepo.save(module.state);
        await this.resolve.lessonRepo.save(lesson.state);
        await db.commit();
      } catch (e) {
        db.rollback();
        throw e;
      }
    } else {
      await this.resolve.moduleRepo.save(module.state);
      await this.resolve.lessonRepo.save(lesson.state);
    }

    return lesson.state;
  }
}
