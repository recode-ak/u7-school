/** Модель «плана файлов»: генератор сначала строит план, потом пишет. */

export interface PlannedFile {
  /** Путь файла (относительно текущего каталога или абсолютный). */
  path: string;
  content: string;
}

/**
 * Правка существующего файла по маркеру: строка `line` вставляется перед
 * строкой с `marker` (маркер остаётся для следующих вставок).
 */
export interface PlannedEdit {
  path: string;
  /** Например `// gen:exports`. */
  marker: string;
  line: string;
  /**
   * Связанные правки: не вставлена одна (нет файла, маркера, конфликт
   * имён) — следующие правки группы тоже уходят в «Вставь вручную».
   */
  group?: string;
}

/** Правка, которую генератор не применил: вставить вручную; `reason` — почему. */
export type HintedEdit = PlannedEdit & { reason?: string };

/**
 * Зависимость в `dependencies` существующего `package.json`: правка JSON,
 * а не текста; уже объявленная не меняется.
 */
export interface PlannedDependency {
  path: string;
  name: string;
  version: string;
}

export interface GenPlan {
  files: PlannedFile[];
  edits: PlannedEdit[];
  dependencies?: PlannedDependency[];
  /** Что сделать после записи (например, `bun install`). Строки — как печатать. */
  notes?: string[];
}

export interface ApplyResult {
  written: string[];
  edited: string[];
  /** Существующие точки входа, не перезаписанные в режиме adopt. */
  skipped: PlannedFile[];
  /** Правки, которые не удалось применить (нет файла или маркера) — вставить вручную. */
  hints: HintedEdit[];
  /** Зависимости, которые не удалось вписать (нет `package.json`) — вручную. */
  dependencyHints: PlannedDependency[];
}
