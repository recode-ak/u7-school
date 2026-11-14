import { Aggregate, AggregateDef } from 'dmg-core';
import * as v from 'valibot';
import { VersionOut } from '../version-out';
import { LessonErrors } from './lesson.errors';
import { LessonState } from './lesson.state';

/**
 * Def агрегата урока: жизненный цикл объявлен статусами, но операций нет —
 * authoring удалён, поэтому `transitions` пуст.
 */
export const LessonArDef = AggregateDef.define({
  name: 'lesson',
  label: 'Урок',
  description:
    'Урок курса: шаги одного модуля; публикуется вместе с проектом, архив — для снятых с обучения.',
  state: LessonState,
  statuses: {
    draft: { label: 'Черновик' },
    published: { label: 'Опубликован' },
    archived: { label: 'В архиве' },
  },
  transitions: {},
  events: {},
  errors: LessonErrors,
});

/** Урок наружу: state целиком — даты числами, версия включена (D-36). */
export const LessonView = v.object({
  ...LessonState.entries,
  version: VersionOut,
});

export type LessonView = v.InferOutput<typeof LessonView>;

/** Вклад урока в снимок контента модуля. */
export type LessonOutline = {
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly stepIds: string[];
};

/**
 * Агрегат Lesson — урок курса. Методы-вопросы отвечают на «опубликован ли»
 * и «в каком модуле»; представление для показа собирает `viewFor` по готовому
 * решению Policy (решение о праве — не его).
 */
export class LessonAr extends Aggregate<typeof LessonArDef> {
  private constructor(state: LessonState) {
    super(LessonArDef, state);
  }

  /** Восстановление из хранилища — запись разобрана `LessonArDef.state`. */
  static restore(state: LessonState): LessonAr {
    return new LessonAr(state);
  }

  // ── Вопросы ──

  /** Модуль-владелец урока (связь, DOM-04). */
  get moduleId(): string {
    return this.state.moduleId;
  }

  isPublished(): boolean {
    return this.state.status === 'published';
  }

  /**
   * Урок для показа: с правом на неопубликованное — любой статус, без права —
   * только опубликованный, иначе `undefined`.
   */
  viewFor(canSeeUnpublished: boolean): LessonView | undefined {
    if (!canSeeUnpublished && !this.isPublished()) return undefined;
    return this.view();
  }

  /** Шаги урока по порядку прохождения — копия, чтобы не отдать state. */
  stepIds(): string[] {
    return [...this.state.stepIds];
  }

  /** Вклад урока в снимок: идентификатор, заголовок и шаги по порядку. */
  outline(): LessonOutline {
    return {
      lessonId: this.state.uuid,
      lessonTitle: this.state.title,
      stepIds: this.stepIds(),
    };
  }
}
