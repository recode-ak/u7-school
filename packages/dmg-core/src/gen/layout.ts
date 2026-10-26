import { isAbsolute, join, relative, sep } from 'node:path';

/** Раскладка проекта для генераторов (`dmg-core.json`, `gen`); `{m}` — имя модуля */
export interface GenLayoutSettings {
  /** Каталог модуля домена */
  domain: string;
  /** Каталог прикладного слоя модуля */
  app: string;
  /** Спецификатор импорта домена из прикладного слоя; null — относительный путь */
  domainImport: string | null;
}

/**
 * Где генератор создаёт файлы модуля и как прикладной слой импортирует
 * домен. Пакет не знает раскладки проекта: она — в настройках, у каждого
 * поля есть значение по умолчанию (`src/domain/{m}`, `src/app/{m}`).
 */
export class GenLayout {
  static readonly defaults: GenLayoutSettings = {
    domain: 'src/domain/{m}',
    app: 'src/app/{m}',
    domainImport: null,
  };

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

  /** Спецификатор импорта домена модуля из файла в каталоге fromDir */
  domainImport(module: string, fromDir: string): string {
    if (this.settings.domainImport !== null) {
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
