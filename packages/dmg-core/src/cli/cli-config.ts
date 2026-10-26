import { GenLayout, type GenLayoutSettings } from '../gen/layout';
import type { PackageSource } from './package-source';
import type { RoleFormat } from './role';

/** Куда и в каком формате доставлять роли */
export type RoleTarget =
  | { dir: string; format: 'claude' | 'pi' }
  /** common — файл общего блока пакета для сборщика ролей проекта */
  | { dir: string; format: 'neutral'; common: string };

/** Полные настройки доставки (`dmg-core.json` со значениями по умолчанию) */
export interface CliSettings {
  skills: { names: string[]; dirs: string[] };
  roles: { names: string[]; targets: RoleTarget[] };
  /** Файл инструкций агентов для вставки; null — не вставлять */
  instructions: string | null;
  /** Раскладка модулей для `dmg-core gen` */
  gen: GenLayoutSettings;
}

const FORMATS: readonly RoleFormat[] = ['neutral', 'claude', 'pi'];

/**
 * Настройки проекта из `dmg-core.json`: что взять из пакета и куда положить.
 * Пакет не знает раскладки проекта — у каждого поля разумное значение
 * по умолчанию (всё из пакета, Claude Code, `AGENTS.md`).
 */
export class CliConfig {
  static readonly file = 'dmg-core.json';

  constructor(private readonly pkg: PackageSource) {}

  /** Значения по умолчанию — их пишет `init` в новый конфиг */
  defaults(): CliSettings {
    return {
      skills: { names: [...this.pkg.skills.keys()], dirs: ['.claude/skills'] },
      roles: {
        names: this.pkg.roles.map((role) => role.name),
        targets: [{ dir: '.claude/agents', format: 'claude' }],
      },
      instructions: 'AGENTS.md',
      gen: { ...GenLayout.defaults },
    };
  }

  /** Разбирает конфиг поверх значений по умолчанию; бросает Error с полем */
  parse(json: unknown): CliSettings {
    const data = this.object(json, 'конфиг');
    this.known(data, ['skills', 'roles', 'instructions', 'gen'], '');
    const settings = this.defaults();

    if (data.skills !== undefined) {
      const skills = this.object(data.skills, 'skills');
      this.known(skills, ['names', 'dirs'], 'skills.');
      if (skills.names !== undefined) {
        settings.skills.names = this.strings(skills.names, 'skills.names');
      }
      if (skills.dirs !== undefined) {
        settings.skills.dirs = this.strings(skills.dirs, 'skills.dirs');
      }
    }
    for (const name of settings.skills.names) {
      if (!this.pkg.skills.has(name)) this.fail(`нет скила «${name}» в пакете`);
    }

    if (data.roles !== undefined) {
      const roles = this.object(data.roles, 'roles');
      this.known(roles, ['names', 'targets'], 'roles.');
      if (roles.names !== undefined) {
        settings.roles.names = this.strings(roles.names, 'roles.names');
      }
      if (roles.targets !== undefined) {
        if (!Array.isArray(roles.targets)) {
          this.fail('roles.targets — массив целей');
        }
        settings.roles.targets = (roles.targets as unknown[]).map((item, i) =>
          this.target(item, `roles.targets[${i}]`),
        );
      }
    }
    const roleNames = new Set(this.pkg.roles.map((role) => role.name));
    for (const name of settings.roles.names) {
      if (!roleNames.has(name)) this.fail(`нет роли «${name}» в пакете`);
    }

    if (data.instructions !== undefined) {
      if (data.instructions !== null && typeof data.instructions !== 'string') {
        this.fail('instructions — путь файла или null');
      }
      settings.instructions = data.instructions as string | null;
    }

    if (data.gen !== undefined) settings.gen = this.gen(data.gen);
    return settings;
  }

  /** Секция `gen`: шаблоны путей с `{m}` поверх значений по умолчанию */
  private gen(json: unknown): GenLayoutSettings {
    const data = this.object(json, 'gen');
    this.known(data, ['domain', 'app', 'domainImport'], 'gen.');
    const gen = { ...GenLayout.defaults };
    for (const key of ['domain', 'app'] as const) {
      const value = data[key];
      if (value === undefined) continue;
      if (typeof value !== 'string' || !value.includes('{m}')) {
        this.fail(`gen.${key} — шаблон пути с {m}`);
      }
      gen[key] = value as string;
    }
    if (data.domainImport !== undefined) {
      const value = data.domainImport;
      if (typeof value !== 'string' || !value.includes('{m}')) {
        this.fail('gen.domainImport — шаблон с {m}');
      }
      gen.domainImport = value as string;
    }
    return gen;
  }

  private target(json: unknown, field: string): RoleTarget {
    const data = this.object(json, field);
    this.known(data, ['dir', 'format', 'common'], `${field}.`);
    if (typeof data.dir !== 'string') this.fail(`${field}.dir — каталог ролей`);
    const dir = data.dir as string;
    if (!FORMATS.includes(data.format as RoleFormat)) {
      this.fail(`${field}.format — neutral, claude или pi`);
    }
    if (data.format !== 'neutral') {
      return { dir, format: data.format as 'claude' | 'pi' };
    }
    if (typeof data.common !== 'string') {
      this.fail(`${field}.common — путь общего блока для neutral`);
    }
    return { dir, format: 'neutral', common: data.common as string };
  }

  private object(json: unknown, field: string): Record<string, unknown> {
    if (typeof json !== 'object' || json === null || Array.isArray(json)) {
      return this.fail(`${field} — объект`);
    }
    return json as Record<string, unknown>;
  }

  private known(
    data: Record<string, unknown>,
    keys: string[],
    prefix: string,
  ): void {
    for (const key of Object.keys(data)) {
      if (!keys.includes(key)) this.fail(`неизвестное поле «${prefix}${key}»`);
    }
  }

  private strings(json: unknown, field: string): string[] {
    if (!Array.isArray(json) || json.some((item) => typeof item !== 'string')) {
      this.fail(`${field} — массив строк`);
    }
    return json as string[];
  }

  private fail(message: string): never {
    throw new Error(`${CliConfig.file}: ${message}`);
  }
}
