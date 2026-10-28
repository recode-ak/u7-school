import { readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import type { ModuleLayout } from '../arch/file-checker';
import type { ModulePackage } from './layout.types';

/** Раскладка проекта для генераторов (`dmg-core.json`, `gen`); `{m}` — имя модуля */
export interface GenLayoutSettings {
  /** Каталог модуля домена */
  domain: string;
  /** Каталог прикладного слоя модуля */
  app: string;
  /** Спецификатор импорта домена из прикладного слоя; нет — относительный путь */
  domainImport?: string;
  /**
   * Имя пакета модуля (`@acme/{m}`): задан — `gen module` создаёт пакет
   * workspaces над каталогом прикладного слоя (`app` оканчивается на
   * `/src`); нужен `domainImport` — по нему зависимость на пакет домена.
   */
  package?: string;
  /**
   * Каталог корня сборки (`app.ts`, D-50) — без `{m}`: `gen module` и
   * `gen aggregate` подключают модуль по маркерам его `app.ts`; при
   * `gen.package` и пути на `/src` — ещё зависимость в `package.json` пакета.
   */
  compositionRoot?: string;
}

/** Поля секции `gen`. */
const FIELDS = ['domain', 'app', 'domainImport', 'package', 'compositionRoot'];

/** Суффикс каталога прикладного слоя в пакете модуля. */
const SRC = '/src';

/**
 * Где генератор создаёт файлы модуля и как прикладной слой импортирует
 * домен. Пакет не знает раскладки проекта: она — в настройках, у каждого
 * поля есть значение по умолчанию (`src/domain/{m}`, `src/app/{m}`).
 * Гибки только корни каталогов: форма внутри модуля фиксирована
 * (MAN-10, ARC-06). Один источник путей для `gen` и `ArchApp.layout`.
 */
export class GenLayout {
  /** Файл настроек проекта; раскладка — его секция `gen` */
  static readonly configFile = 'dmg-core.json';

  static readonly defaults: GenLayoutSettings = {
    domain: 'src/domain/{m}',
    app: 'src/app/{m}',
  };

  /**
   * Корень сборки по умолчанию — только при раскладке по умолчанию: при
   * своей раскладке без `gen.compositionRoot` он неизвестен, и генератор
   * не подключает модуль сам, а печатает общую подсказку.
   */
  static readonly defaultCompositionRoot = 'src/app';

  /** Скрипт `arch:check` проекта (пишет `dmg-core init`) — от корня проекта */
  static readonly archCheck = 'scripts/arch-check.ts';

  /** Раскладка проекта из `dmg-core.json`; нет файла или секции — по умолчанию */
  static async read(root: string): Promise<GenLayout> {
    const text = await readFile(join(root, GenLayout.configFile), 'utf8').catch(
      () => undefined,
    );
    const gen = text === undefined ? undefined : JSON.parse(text).gen;
    const settings =
      gen === undefined
        ? { ...GenLayout.defaults }
        : GenLayout.settingsFrom(gen);
    return new GenLayout(settings, root);
  }

  /** Секция `gen`: шаблоны с `{m}` поверх значений по умолчанию; бросает Error с полем */
  static settingsFrom(json: unknown): GenLayoutSettings {
    if (typeof json !== 'object' || json === null || Array.isArray(json)) {
      return GenLayout.fail('gen — объект');
    }
    const data = json as Record<string, unknown>;
    for (const key of Object.keys(data)) {
      if (!FIELDS.includes(key)) {
        GenLayout.fail(`неизвестное поле «gen.${key}»`);
      }
    }
    const gen = { ...GenLayout.defaults };
    for (const key of ['domain', 'app'] as const) {
      const value = data[key];
      if (value === undefined) continue;
      if (typeof value !== 'string' || !value.includes('{m}')) {
        GenLayout.fail(`gen.${key} — шаблон пути с {m}`);
      }
      gen[key] = value as string;
    }
    if (data.domainImport !== undefined) {
      const value = data.domainImport;
      if (typeof value !== 'string' || !value.includes('{m}')) {
        GenLayout.fail('gen.domainImport — шаблон с {m}');
      }
      gen.domainImport = value as string;
    }
    if (data.compositionRoot !== undefined) {
      const value = data.compositionRoot;
      if (typeof value !== 'string' || value.includes('{m}')) {
        GenLayout.fail('gen.compositionRoot — путь каталога без {m}');
      }
      gen.compositionRoot = value as string;
    }
    if (data.package !== undefined) {
      const value = data.package;
      if (typeof value !== 'string' || !value.includes('{m}')) {
        GenLayout.fail('gen.package — шаблон имени пакета с {m}');
      }
      if (!gen.app.endsWith(SRC)) {
        GenLayout.fail(`gen.package — gen.app должен оканчиваться на ${SRC}`);
      }
      if (gen.domainImport === undefined) {
        GenLayout.fail('gen.package — нужен gen.domainImport');
      }
      gen.package = value as string;
    }
    return gen;
  }

  private static fail(message: string): never {
    throw new Error(`${GenLayout.configFile}: ${message}`);
  }

  /** root — корень проекта; «.» оставляет пути относительными */
  constructor(
    private readonly settings: GenLayoutSettings,
    private readonly root: string,
  ) {}

  domainDir(module: string): string {
    return this.path(this.settings.domain, module);
  }

  appDir(module: string): string {
    return this.path(this.settings.app, module);
  }

  /** Обе стороны модуля — значение `ArchApp.layout` */
  module(module: string): ModuleLayout {
    return { domain: this.domainDir(module), app: this.appDir(module) };
  }

  /**
   * Каталог корня сборки (`gen.compositionRoot`); не задан — `src/app` при
   * раскладке по умолчанию, иначе undefined
   */
  compositionDir(): string | undefined {
    const dir = this.compositionRoot();
    return dir === undefined ? undefined : this.path(dir, '');
  }

  private compositionRoot(): string | undefined {
    const { domain, app, compositionRoot } = this.settings;
    if (compositionRoot !== undefined) return compositionRoot;
    const { defaults } = GenLayout;
    return domain === defaults.domain && app === defaults.app
      ? GenLayout.defaultCompositionRoot
      : undefined;
  }

  /**
   * `package.json` пакета корня сборки: каталог корня оканчивается на
   * `/src`, а модули — пакеты (`gen.package`); иначе undefined
   */
  compositionPackage(): string | undefined {
    const dir = this.compositionDir();
    if (
      dir === undefined ||
      this.settings.package === undefined ||
      !dir.endsWith(SRC)
    ) {
      return undefined;
    }
    return join(dir.slice(0, -SRC.length), 'package.json');
  }

  /** Скрипт `arch:check` проекта */
  archCheckFile(): string {
    return this.path(GenLayout.archCheck, '');
  }

  /** Пакет прикладного слоя модуля; нет `gen.package` — undefined */
  package(module: string): ModulePackage | undefined {
    const { package: name, domainImport } = this.settings;
    if (name === undefined || domainImport === undefined) return undefined;
    const dir = this.appDir(module).slice(0, -SRC.length);
    const domain = this.fill(domainImport, module).split('/');
    return {
      dir,
      name: this.fill(name, module),
      domain: domain.slice(0, domain[0]?.startsWith('@') ? 2 : 1).join('/'),
      root: relative(dir, this.root).split(sep).join('/'),
    };
  }

  /** Применяемая раскладка одной строкой — первая строка вывода `gen` */
  describe(): string {
    const { domain, app, domainImport, package: name } = this.settings;
    const line = `Раскладка: домен — ${domain}, прикладной слой — ${app}, импорт домена — ${domainImport ?? 'относительный'}`;
    const withPackage =
      name === undefined ? line : `${line}, пакет модуля — ${name}`;
    const root = this.compositionRoot() ?? 'не задан (gen.compositionRoot)';
    return `${withPackage}, корень сборки — ${root}`;
  }

  /** Импорт домена по шаблону (`gen.domainImport`), а не относительный */
  hasDomainImport(): boolean {
    return this.settings.domainImport !== undefined;
  }

  /** Спецификатор импорта домена модуля из файла в каталоге fromDir */
  domainImport(module: string, fromDir: string): string {
    if (this.settings.domainImport !== undefined) {
      return this.fill(this.settings.domainImport, module);
    }
    const path = relative(fromDir, this.domainDir(module)).split(sep).join('/');
    return path.startsWith('.') ? path : `./${path}`;
  }

  private path(template: string, module: string): string {
    const path = this.fill(template, module);
    return isAbsolute(path) ? path : join(this.root, path);
  }

  private fill(template: string, module: string): string {
    return template.replaceAll('{m}', module);
  }
}
