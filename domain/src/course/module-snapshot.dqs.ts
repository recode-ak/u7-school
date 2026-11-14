import type { ReadonlyAr } from 'dmg-core';
import type { ContentSnapshot } from './content-snapshot';
import type { LessonAr, LessonOutline } from './lesson/lesson.ar';
import type { ModuleAr } from './module/module.ar';
import type { StepAr } from './step/step.ar';

/** Что не вошло в снимок: неопубликованный урок или шаг (шага нет — тоже). */
export type SkippedSnapshotItem =
  | { readonly kind: 'lesson'; readonly lessonId: string }
  | {
      readonly kind: 'step';
      readonly lessonId: string;
      readonly stepId: string;
    };

type Walk = {
  readonly snapshot: ContentSnapshot;
  readonly skipped: readonly SkippedSnapshotItem[];
};

/**
 * DQS снимка контента модуля: опубликованные проекты с опубликованными уроками
 * и шагами в порядке модуля. Только читает; пропущенное отдаёт `skipped()` —
 * warn о нём пишет вызывающий (в домене логгера нет).
 *
 * Урок проекта, которого нет среди переданных, молча пропускается (DOM-13;
 * долг — маскирует рассогласование данных). Урок в нескольких проектах
 * перечисляется в `skipped()` один раз.
 */
export class ModuleSnapshotDqs {
  private walked: Walk | undefined;

  constructor(
    private readonly module: ReadonlyAr<ModuleAr>,
    private readonly lessons: readonly ReadonlyAr<LessonAr>[],
    private readonly steps: readonly ReadonlyAr<StepAr>[],
  ) {}

  /** Снимок: `[{ projectId, projectTitle, lessons: [{ lessonId, lessonTitle, stepIds }] }]`. */
  build(): ContentSnapshot {
    return this.walk().snapshot;
  }

  /** Пропущенное в порядке обхода; пропущенный урок — без своих шагов. */
  skipped(): readonly SkippedSnapshotItem[] {
    return this.walk().skipped;
  }

  private walk(): Walk {
    if (this.walked !== undefined) return this.walked;
    const lessonsById = new Map(this.lessons.map((it) => [it.uuid, it]));
    const stepsById = new Map(this.steps.map((it) => [it.uuid, it]));
    const outlines = new Map<string, LessonOutline | undefined>();
    const skipped: SkippedSnapshotItem[] = [];

    const outlineOf = (lesson: ReadonlyAr<LessonAr>) => {
      if (outlines.has(lesson.uuid)) return outlines.get(lesson.uuid);
      let outline: LessonOutline | undefined;
      if (!lesson.isPublished()) {
        skipped.push({ kind: 'lesson', lessonId: lesson.uuid });
      } else {
        const full = lesson.outline();
        const stepIds = full.stepIds.filter((stepId) => {
          const published = stepsById.get(stepId)?.isPublished() === true;
          if (!published) {
            skipped.push({ kind: 'step', lessonId: lesson.uuid, stepId });
          }
          return published;
        });
        outline = { ...full, stepIds };
      }
      outlines.set(lesson.uuid, outline);
      return outline;
    };

    const snapshot = this.module.publishedOutline().map((project) => ({
      projectId: project.projectId,
      projectTitle: project.projectTitle,
      lessons: project.lessonIds
        .map((lessonId) => lessonsById.get(lessonId))
        .filter((it): it is ReadonlyAr<LessonAr> => it !== undefined)
        .map(outlineOf)
        .filter((it): it is LessonOutline => it !== undefined)
        .map((it) => ({ ...it, stepIds: [...it.stepIds] })),
    }));

    this.walked = { snapshot, skipped };
    return this.walked;
  }
}
