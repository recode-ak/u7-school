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

/**
 * Версия в представлении обязательна: клиент сверяет её при записи, а в
 * state поле необязательно — legacy-запись читается как версия 0 (D-36).
 * Своя схема, а не `BaseEntityFields.version`: `nonOptional` в JSON Schema
 * выхода не выражается (MAN-03).
 */
const versionOut = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.description('Версия сущности (оптимистичная блокировка)'),
);

/** Модуль наружу: state целиком — даты числами, версия включена (D-36). */
export const ModuleView = v.object({
  ...ModuleState.entries,
  version: versionOut,
});

export type ModuleView = v.InferOutput<typeof ModuleView>;

/** Проект модуля в снимке контента: идентификатор, заголовок и уроки. */
export type ProjectOutline = {
  readonly projectId: string;
  readonly projectTitle: string;
  readonly lessonIds: string[];
};

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

  /**
   * Вклад модуля в снимок контента: опубликованные проекты в порядке модуля.
   * Уроки собирает `ModuleSnapshotDqs` — здесь только состав проектов.
   */
  publishedOutline(): ProjectOutline[] {
    return this.state.projects
      .filter((project) => project.status === 'published')
      .map((project) => ({
        projectId: project.uuid,
        projectTitle: project.title,
        lessonIds: [...project.lessonIds],
      }));
  }

  /** Карточка модуля для списков. */
  summary(): ModuleSummary {
    const { uuid, title, description, status, tags } = this.state;
    return { uuid, title, description, status, tags };
  }
}
