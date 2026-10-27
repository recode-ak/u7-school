import { GenError } from '../../gen/cli';
import type { ScaffoldProfile } from './project-scaffold.types';

const PROFILES: readonly ScaffoldProfile[] = ['single', 'monorepo'];

/**
 * Разбор аргументов `dmg-core init [--profile single|monorepo]
 * [--name <имя>] [--dry-run]`. Ошибка ввода — `GenError` (как у `gen`):
 * неизвестный профиль или флаг, флаг без значения или повторно, лишний
 * аргумент, `--name`/`--dry-run` без профиля.
 */
export class InitArgs {
  static parse(argv: readonly string[]): InitArgs {
    const seen = new Set<string>();
    let profile: ScaffoldProfile | undefined;
    let name: string | undefined;
    let dryRun = false;
    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i] ?? '';
      if (seen.has(arg)) throw new GenError(`Флаг ${arg} указан дважды`);
      seen.add(arg);
      if (arg === '--dry-run') {
        dryRun = true;
      } else if (arg === '--profile') {
        profile = InitArgs.profile(InitArgs.value(argv, ++i, arg));
      } else if (arg === '--name') {
        name = InitArgs.value(argv, ++i, arg);
      } else {
        throw new GenError(`Лишний аргумент init: «${arg}»`);
      }
    }
    if (profile === undefined) {
      if (name !== undefined || dryRun) {
        throw new GenError('--name и --dry-run — только вместе с --profile');
      }
    }
    return new InitArgs(profile, name, dryRun);
  }

  private constructor(
    /** Нет — прежний init (`dmg-core.json` и sync). */
    readonly profile: ScaffoldProfile | undefined,
    /** Имя проекта; нет — `name` из package.json или имя каталога. */
    readonly name: string | undefined,
    /** Только план в stdout, ничего не записывать. */
    readonly dryRun: boolean,
  ) {}

  private static value(argv: readonly string[], i: number, flag: string) {
    const value = argv[i];
    if (value === undefined || value.startsWith('--')) {
      throw new GenError(`У ${flag} нет значения`);
    }
    return value;
  }

  private static profile(value: string): ScaffoldProfile {
    const profile = PROFILES.find((p) => p === value);
    if (profile === undefined) {
      throw new GenError(
        `Неизвестный профиль «${value}»: ${PROFILES.join(' | ')}`,
      );
    }
    return profile;
  }
}
