import { Aggregate, AggregateDef } from 'dmg-core';
import * as v from 'valibot';
import { VersionOut } from '../version-out';
import { StepErrors } from './step.errors';
import {
  StepCodeState,
  StepFileState,
  StepState,
  StepTextState,
} from './step.state';

/**
 * Def агрегата шага: жизненный цикл объявлен статусами, но операций нет —
 * authoring удалён, поэтому `transitions` пуст.
 */
export const StepArDef = AggregateDef.define({
  name: 'step',
  label: 'Шаг',
  description:
    'Шаг урока: текст, код или файл; публикуется вместе с уроком, архив — для снятых с обучения.',
  state: StepState,
  statuses: {
    draft: { label: 'Черновик' },
    published: { label: 'Опубликован' },
    archived: { label: 'В архиве' },
  },
  transitions: {},
  events: {},
  errors: StepErrors,
});

/** Шаг наружу: state целиком, ветка по `kind`, даты числами. */
export const StepView = v.variant('kind', [
  v.object({ ...StepTextState.entries, version: VersionOut }),
  v.object({ ...StepCodeState.entries, version: VersionOut }),
  v.object({ ...StepFileState.entries, version: VersionOut }),
]);

export type StepView = v.InferOutput<typeof StepView>;

/** Шаг в списке шагов урока — для `getStepsByLessons`; `status` — для отметки у видящих неопубликованное. */
export type StepSummary = {
  readonly uuid: string;
  readonly description: string;
  readonly status: StepState['status'];
};

/**
 * Агрегат Step — шаг урока. Методы-вопросы отвечают на «опубликован ли» и
 * «в каком модуле»; представления собираются по готовому решению Policy
 * (решение о праве — не его).
 */
export class StepAr extends Aggregate<typeof StepArDef> {
  private constructor(state: StepState) {
    super(StepArDef, state);
  }

  /** Восстановление из хранилища — запись разобрана `StepArDef.state`. */
  static restore(state: StepState): StepAr {
    return new StepAr(state);
  }

  // ── Вопросы ──

  /** Модуль-владелец шага (связь, DOM-04). */
  get moduleId(): string {
    return this.state.moduleId;
  }

  isPublished(): boolean {
    return this.state.status === 'published';
  }

  /**
   * Шаг для показа: с правом на неопубликованное — любой статус, без права —
   * только опубликованный, иначе `undefined`.
   */
  viewFor(canSeeUnpublished: boolean): StepView | undefined {
    if (!canSeeUnpublished && !this.isPublished()) return undefined;
    return this.view();
  }

  /** Шаг для списка шагов урока: без права на неопубликованное — `undefined`. */
  summaryFor(canSeeUnpublished: boolean): StepSummary | undefined {
    const view = this.viewFor(canSeeUnpublished);
    if (view === undefined) return undefined;
    return {
      uuid: view.uuid,
      description: view.description,
      status: view.status,
    };
  }
}
