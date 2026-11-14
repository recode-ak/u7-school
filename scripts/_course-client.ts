/**
 * `_course-client.ts` — клиент курса для скриптов распространения.
 *
 * Собирает корень сборки `U7App` (D-50) над каталогом данных скрипта и вызывает
 * query-UC модуля `course` через `dispatch` (D-49) от имени администратора:
 * `listModules`, `getModuleSnapshot`, `getLesson`, `getStep`. Отказ UC —
 * исключение скрипта (ERR-01).
 *
 * ```ts
 * const course = await CourseClient.create({ silent: true });
 * const modules = await course.listModules();
 * ```
 */
import { type Logger, LogLevel } from '@u7-scl/core/shared';
import {
  type ContentSnapshot,
  CourseModuleDef,
  GetLessonUcDef,
  GetModuleSnapshotUcDef,
  GetStepUcDef,
  type LessonView,
  ListModulesUcDef,
  type ModuleSummary,
  type StepView,
} from '@u7-scl/domain/course/contract';
import type { InputOf, OutputOf } from 'dmg-core';
import { ScriptApp } from './_app';

/** UC модуля курсов: команда собирается только для его Def. */
type CourseUcDef = (typeof CourseModuleDef)['useCases'][number];

/**
 * Логгер режима `silent`: служебные логи модулей скрыты, но `warn` (например,
 * пропуск неопубликованного при сборке снимка) оператор должен видеть.
 */
export const warnOnlyLogger: Logger = {
  info: () => {},
  warn: (source, message) => console.warn(`[${source}] ${message}`),
  error: () => {},
  debug: () => {},
  setLogLevel: () => {},
  getLogLevel: () => LogLevel.INFO,
  setSourceLevel: () => {},
};

/** Клиент курса: один экземпляр на запуск скрипта. */
export class CourseClient {
  private constructor(private readonly app: ScriptApp) {}

  /**
   * Собирает приложение над каталогом `DB_DIR` (по умолчанию `data`) от имени
   * администратора. `silent` — без служебных логов модулей.
   */
  static async create(
    options: { silent?: boolean } = {},
  ): Promise<CourseClient> {
    const app = await ScriptApp.create(
      options.silent ? { logger: warnOnlyLogger } : {},
    );
    return new CourseClient(app);
  }

  /** Модули для показа — `listModules`. */
  listModules(): Promise<ModuleSummary[]> {
    return this.query(ListModulesUcDef, {});
  }

  /** Снимок контента модуля — `getModuleSnapshot`. */
  moduleSnapshot(moduleId: string): Promise<ContentSnapshot> {
    return this.query(GetModuleSnapshotUcDef, { moduleId });
  }

  /** Урок по идентификатору — `getLesson`. */
  lesson(lessonId: string): Promise<LessonView> {
    return this.query(GetLessonUcDef, { lessonId });
  }

  /** Шаг по идентификатору — `getStep`. */
  step(stepId: string): Promise<StepView> {
    return this.query(GetStepUcDef, { stepId });
  }

  private async query<D extends CourseUcDef>(
    uc: D,
    input: InputOf<D>,
  ): Promise<OutputOf<D>> {
    const res = await this.app.run(CourseModuleDef, uc, input);
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.label}`);
    return res.value;
  }
}
