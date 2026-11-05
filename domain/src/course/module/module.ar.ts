import { Aggregate, AggregateDef } from 'dmg-core';
import * as v from 'valibot';
import { ModuleErrors } from './module.errors';
import { ModuleState } from './module.state';

/**
 * Def агрегата модуля курса: жизненный цикл объявлен статусами, но операций
 * нет — authoring удалён, поэтому `transitions` пуст.
 */
export const ModuleArDef = AggregateDef.define({
  name: 'module',
  label: 'Модуль',
  description:
    'Модуль курса: проекты из уроков; публикуется для обучения, архив — для снятых с обучения.',
  state: ModuleState,
  statuses: {
    draft: { label: 'Черновик' },
    published: { label: 'Опубликован' },
    archived: { label: 'В архиве' },
  },
  transitions: {},
  events: {},
  errors: ModuleErrors,
});

/** Модуль наружу: state целиком — даты числами, версия включена (D-36). */
export const ModuleView = v.object({ ...ModuleState.entries });

export type ModuleView = v.InferOutput<typeof ModuleView>;

/** Карточка модуля для списков — без проектов и текстов карточки. */
export const ModuleSummary = v.object({
  uuid: ModuleState.entries.uuid,
  title: ModuleState.entries.title,
  description: ModuleState.entries.description,
  status: ModuleState.entries.status,
  tags: ModuleState.entries.tags,
});

export type ModuleSummary = v.InferOutput<typeof ModuleSummary>;

/**
 * Агрегат Module — модуль курса. Методы-вопросы отвечают на «опубликован
 * ли» и «кто автор», представление для показа собирает `viewFor` по
 * готовому решению Policy (решение о праве — не его).
 */
export class ModuleAr extends Aggregate<typeof ModuleArDef> {
  private constructor(state: ModuleState) {
    super(ModuleArDef, state);
  }

  /** Восстановление из хранилища — запись разобрана `ModuleArDef.state`. */
  static restore(state: ModuleState): ModuleAr {
    return new ModuleAr(state);
  }

  // ── Вопросы ──

  isPublished(): boolean {
    return this.state.status === 'published';
  }

  /** Автор ли модуля этот пользователь (роль `AUTHOR` не нужна). */
  isAuthoredBy(userId: string): boolean {
    return this.state.authorId === userId;
  }

  /**
   * Модуль для показа: с правом на неопубликованное — целиком, без права —
   * только опубликованный и только его опубликованные проекты, иначе
   * `undefined`.
   */
  viewFor(canSeeUnpublished: boolean): ModuleView | undefined {
    const view = this.view();
    if (canSeeUnpublished) return view;
    if (!this.isPublished()) return undefined;
    return {
      ...view,
      projects: view.projects.filter(
        (project) => project.status === 'published',
      ),
    };
  }

  /** Карточка модуля для списков. */
  summary(): ModuleSummary {
    const { uuid, title, description, status, tags } = this.state;
    return { uuid, title, description, status, tags };
  }
}
