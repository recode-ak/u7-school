import type { ReadonlyAr } from 'dmg-core';
import type { ContentSnapshot } from './content-snapshot';
import type { LessonAr } from './lesson/lesson.ar';
import type { ModuleAr } from './module/module.ar';

/**
 * DQS снимка контента модуля: проекты модуля с опубликованными уроками в
 * порядке проекта. Заменяет `CourseDs.buildSnapshot`. Только читает.
 *
 * Урок проекта, которого нет среди переданных, и невидимый урок молча
 * пропускаются (DOM-13; долг — маскирует рассогласование данных). `stepIds`
 * урока входят целиком: статусов шагов DQS не видит (С1, поведение v0.2.6).
 */
export class ModuleSnapshotDqs {
  constructor(
    private readonly module: ReadonlyAr<ModuleAr>,
    private readonly lessons: readonly ReadonlyAr<LessonAr>[],
  ) {}

  /** Снимок: `[{ projectId, projectTitle, lessons: [{ lessonId, lessonTitle, stepIds }] }]`. */
  build(): ContentSnapshot {
    return this.module.publishedOutline().map((project) => ({
      projectId: project.projectId,
      projectTitle: project.projectTitle,
      lessons: project.lessonIds
        .map((lessonId) => this.lessons.find((it) => it.uuid === lessonId))
        .filter((it): it is ReadonlyAr<LessonAr> => it !== undefined)
        .filter((it) => it.isPublished())
        .map((it) => it.outline()),
    }));
  }
}
