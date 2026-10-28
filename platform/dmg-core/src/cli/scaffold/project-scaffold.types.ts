import type { GenLayoutSettings } from '../../gen/layout';
import type { PackageSource } from '../package-source';
import type { LintMap } from './lint-map';

/**
 * Профиль каркаса: `single` — один пакет (домен, прикладной слой,
 * приложение и раннер в `src/`); `monorepo` — пакеты workspaces `domain`,
 * `app`, `modules/*`, `runners/*`.
 */
export type ScaffoldProfile = 'single' | 'monorepo';

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

/** Пакет workspaces каркаса monorepo. */
export type ScaffoldPackage = {
  /** Каталог пакета от корня проекта. */
  readonly dir: string;
  readonly name: string;
  readonly exports?: Readonly<Record<string, string>>;
  /** Внешние зависимости: версии — из пакета dmg-core (`PackageSource`). */
  readonly dependencies: readonly string[];
  /** Пакеты workspaces: версия `workspace:*`. */
  readonly workspace: readonly string[];
};

/** Спецификаторы импортов между частями каркаса. */
export type ScaffoldImports = {
  /** Тип пользователя `AppUser` — из корня сборки. */
  readonly appUser: string;
  /** Класс `App` — из раннера. */
  readonly app: string;
  /** Типы `AppEnv` и др. корня сборки — из раннера. */
  readonly appTypes: string;
};

/** Данные раскладки профиля (`ScaffoldLayout`); пути — от корня проекта. */
export type ScaffoldLayoutData = {
  /** Исходники домена: тип пользователя — в `<domain>/shared`. */
  readonly domain: string;
  /** Корень сборки. */
  readonly app: string;
  /** Раннер CLI. */
  readonly runner: string;
  /** `include` корневого tsconfig.json. */
  readonly include: readonly string[];
  /** Секция `gen` dmg-core.json. */
  readonly gen: GenLayoutSettings;
  readonly imports: ScaffoldImports;
  /** Вход прикладного пакета модуля — в подсказке корня сборки. */
  readonly moduleEntry: string;
  /** Глобы workspaces корневого package.json; нет — проект из одного пакета. */
  readonly workspaces?: readonly string[];
  /**
   * Пакеты workspaces, которые импортирует корень (`scripts/arch-check.ts`
   * — контракты домена): dev-зависимости корня `workspace:*`. bun ≥1.3
   * ставит workspaces изолированно и не поднимает их в корневой
   * node_modules без явной зависимости.
   */
  readonly rootWorkspace: readonly string[];
  readonly packages: readonly ScaffoldPackage[];
  readonly lint: LintMap;
};

/** Что нужно `ProjectInit`: аргументы `dmg-core init --profile`. */
export type InitOptions = {
  readonly profile: ScaffoldProfile;
  /** Имя проекта; нет — `name` из package.json или имя каталога. */
  readonly name?: string;
  /** Только план, ничего не записывать. */
  readonly dryRun: boolean;
};
