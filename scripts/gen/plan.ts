/** Модель «плана файлов»: генератор сначала строит план, потом пишет. */

export interface PlannedFile {
  /** Путь файла (относительно текущего каталога или абсолютный). */
  path: string;
  content: string;
}

/** Строка, которую автор вставляет сам, если в файле нет маркера. */
export interface ManualHint {
  path: string;
  marker: string;
  line: string;
}

export interface GenPlan {
  files: PlannedFile[];
  hints: ManualHint[];
}
