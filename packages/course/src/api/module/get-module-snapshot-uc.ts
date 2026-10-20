import type { User } from '@u7-scl/app/domain';
import type {
  ContentSnapshot,
  GetModuleSnapshotCmd,
  GetModuleSnapshotCmdMeta,
  Lesson,
} from '@u7-scl/domain/course';
import { CourseDs, GetModuleSnapshotCmdSchema } from '@u7-scl/domain/course';
import * as v from 'valibot';
import { CourseUseCase } from '../course-uc';

/**
 * Use-case получения снимка контента модуля.
 * Собирает полное дерево: проекты → уроки → stepIds.
 */
export class GetModuleSnapshotUc extends CourseUseCase<GetModuleSnapshotCmdMeta> {
  protected readonly ucName = 'get-module-snapshot' as const;
  protected readonly ucLabel = 'Получить снимок контента модуля' as const;
  protected readonly arMeta = {
    arName: 'Module' as const,
    arLabel: 'Модуль' as const,
  };
  protected readonly type = 'query' as const;
  protected readonly requiresAuth = false as const;
  protected readonly inputSchema = GetModuleSnapshotCmdSchema;
  protected readonly outputSchema = v.array(v.any());

  async execute(
    command: GetModuleSnapshotCmd,
    actor?: User,
  ): Promise<ContentSnapshot> {
    const module = await this.getModule(command.moduleId);
    // Актор приходит параметром (объект или undefined для анонимных запросов)

    // Проверяем видимость модуля
    this.getOutModule(module, actor);

    // Собираем уроки для всех проектов модуля
    const allLessonIds = module.projects.flatMap((p) => p.lessonIds);
    const uniqueLessonIds = [...new Set(allLessonIds)];

    const lessons: Lesson[] = [];
    for (const lessonId of uniqueLessonIds) {
      const lesson = await this.resolve.lessonRepo.getByUuid(lessonId);
      if (lesson) {
        // Применяем фильтр видимости
        const outLesson = await this.getOutLesson(lesson, actor);
        lessons.push(outLesson);
      }
    }

    const ds = new CourseDs();
    return ds.buildSnapshot(module, lessons);
  }
}
