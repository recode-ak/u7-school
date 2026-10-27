import type { PackageSource } from '../package-source';

/** Профиль каркаса: `single` — один пакет (домен, прикладной слой, приложение и раннер в `src/`). */
export type ScaffoldProfile = 'single';

/** Что нужно каркасу проекта. */
export type ScaffoldOptions = {
  readonly profile: ScaffoldProfile;
  /** Имя пакета проекта (`package.json`, `ArchApp.name`). */
  readonly name: string;
  /** Пакет dmg-core: версия, версии зависимостей, значения `dmg-core.json`. */
  readonly pkg: PackageSource;
  /** Корень проекта; нет — пути плана относительные (как у `GenLayout`). */
  readonly root?: string;
};

/** Файл каркаса до привязки к корню: путь от корня проекта. */
export type ScaffoldFile = {
  readonly path: string;
  readonly content: string;
};
