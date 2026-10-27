import { readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import type { ModuleLayout } from '../arch/file-checker';

/** Раскладка проекта для генераторов (`dmg-core.json`, `gen`); `{m}` — имя модуля */
export interface GenLayoutSettings {
  /** Каталог модуля домена */
  domain: string;
  /** Каталог прикладного слоя модуля */
  app: string;
  /** Спецификатор импорта домена из прикладного слоя; нет — относительный путь */
  domainImport?: string;
}

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
      if (!['domain', 'app', 'domainImport'].includes(key)) {
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

  /** Применяемая раскладка одной строкой — первая строка вывода `gen` */
  describe(): string {
    const { domain, app, domainImport } = this.settings;
    return `Раскладка: домен — ${domain}, прикладной слой — ${app}, импорт домена — ${domainImport ?? 'относительный'}`;
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
