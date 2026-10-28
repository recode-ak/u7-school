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
}

export interface GenPlan {
  files: PlannedFile[];
  edits: PlannedEdit[];
  /**
   * Что сделать руками после записи (подключение модуля к приложению):
   * генератор не правит чужие файлы без маркеров. Строки — как печатать.
   */
  notes?: string[];
}

export interface ApplyResult {
  written: string[];
  edited: string[];
  /** Существующие точки входа, не перезаписанные в режиме adopt. */
  skipped: PlannedFile[];
  /** Правки, которые не удалось применить (нет файла или маркера) — вставить вручную. */
  hints: PlannedEdit[];
}
