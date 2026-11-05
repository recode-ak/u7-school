import { Aggregate } from '@u7-scl/core/domain';
import { isoNow } from '@u7-scl/core/shared';
import type { User } from '@u7-scl/domain/user';
import { Status } from '../status';
import type { AddProjectCmd } from './commands/add-project-cmd';
import type { EnrichModuleCmd } from './commands/enrich-module-cmd';
import type { Module, ModuleArMeta, Project } from './entity';
import { ModuleSchema } from './entity';
import { LegacyModulePolicy } from './policy';

/**
 * Агрегат Module — корень образовательного модуля.
 * Project — value-object внутри Module.
 */
export class LegacyModuleAr extends Aggregate<ModuleArMeta> {
  static readonly arName = 'Module';
  static readonly arLabel = 'Модуль';

  constructor(state: Module) {
    super(state, ModuleSchema);
  }

  /** Этап 1: создание базового модуля. */
  static create(
    title: string,
    description: string,
    authorId: string,
  ): LegacyModuleAr {
    const candidate: Module = {
      uuid: crypto.randomUUID(),
      title,
      description,
      authorId,
      tags: [],
      status: Status.DRAFT,
      projects: [],
      createdAt: isoNow(),
    };

    return new LegacyModuleAr(candidate);
  }

  /** Этап 2: обогащение дополнительными полями. */
  enrich(command: EnrichModuleCmd): void {
    this.safeUpdate({
      targetAudience: command.targetAudience,
      goal: command.goal,
      result: command.result,
      rules: command.rules,
      additional: command.additional,
      tags: command.tags,
    });
  }

  /** Добавить проект в модуль. */
  addProject(command: AddProjectCmd): void {
    const project: Project = {
      uuid: crypto.randomUUID(),
      title: command.title,
      goal: command.goal,
      result: command.result,
      additional: command.additional,
      status: Status.DRAFT,
      lessonIds: [],
    };

    this._state.projects.push(project);
    this.safeUpdate({});
  }

  /** Публикация всего модуля. */
  publish(): void {
    this.safeUpdate({ status: Status.PUBLISHED });
  }

  /**
   * Публикация проекта в корневых проектах модуля.
   */
  publishProject(projectUuid: string): void {
    const project = this.getProject(projectUuid);
    if (!project) this.throwBadRequest('Проект не найден в модуле');
    project.status = Status.PUBLISHED;
    this.safeUpdate({});
  }

  /**
   * Добавляет lessonId в проект.
   */
  addLessonToProject(projectId: string, lessonId: string): void {
    const project = this.getProject(projectId);
    if (!project) this.throwBadRequest('Проект не найден в модуле');
    project.lessonIds.push(lessonId);
    this.safeUpdate({});
  }

  /**
   * Возвращает уроки проекта.
   */
  getLessons(projectId: string): string[] {
    const project = this.getProject(projectId);
    if (!project) this.throwBadRequest('Проект не найден в модуле');
    return project.lessonIds;
  }

  // ════════════════════ утилиты ════════════════════

  /**
   * Находит проект по UUID в корневых проектах модуля.
   */
  getProject(projectId: string): Project | undefined {
    return this._state.projects.find((p) => p.uuid === projectId);
  }

  /**
   * Модуль, видимый актору (или null).
   */
  getVisibleFor(actor?: User): Module | null {
    if (!actor) {
      if (this.state.status !== Status.PUBLISHED) return null;
      return this.#filterPublished();
    }

    if (!LegacyModulePolicy.canRead(actor, this.state)) return null;
    if (LegacyModulePolicy.isAdminOrAuthor(actor, this.state))
      return this.state;

    return this.#filterPublished();
  }

  // biome-ignore lint/plugin: перенос без изменения кода (CODE-02; DEBT-10)
  #filterPublished(): Module {
    return {
      ...this.state,
      projects: this.state.projects.filter(
        (p) => p.status === Status.PUBLISHED,
      ),
    } satisfies Module;
  }
}
