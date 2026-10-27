import * as v from 'valibot';
import type { AppMode } from '#core/app/context';
import { F } from '#core/kernel/fields/fields';
import type { ExampleAppEnv } from '../app/example-app.types';
import type { EnvVars } from './example-env.types';

const MODES: readonly AppMode[] = ['test', 'development', 'production'];

const USER_ID = F.uuid('пользователя');

/**
 * Окружение раннера → `ExampleAppEnv` (ARC-09: `process.env` читает только
 * точка входа и передаёт сюда словарём). Переменные: `EXAMPLE_MODE`
 * (по умолчанию `development`), `EXAMPLE_DATA_DIR` (обязателен),
 * `EXAMPLE_USERS` — uuid через запятую. Неверный режим, нет каталога или
 * не-uuid в списке — исключение (ошибка конфигурации, ERR-01).
 */
export class ExampleEnv {
  constructor(private readonly vars: EnvVars) {}

  toAppEnv(): ExampleAppEnv {
    const { vars } = this;
    return {
      mode: ExampleEnv.mode(vars.EXAMPLE_MODE),
      dataDir: ExampleEnv.dataDir(vars.EXAMPLE_DATA_DIR),
      users: ExampleEnv.users(vars.EXAMPLE_USERS),
    };
  }

  private static users(raw: string | undefined): readonly string[] {
    const users = (raw ?? '')
      .split(',')
      .map((uuid) => uuid.trim())
      .filter((uuid) => uuid !== '');
    for (const uuid of users) {
      if (!v.is(USER_ID, uuid)) {
        throw new Error(`EXAMPLE_USERS: «${uuid}» — не uuid`);
      }
    }
    return users;
  }

  private static dataDir(raw: string | undefined): string {
    if (raw === undefined || raw === '') {
      throw new Error('EXAMPLE_DATA_DIR: не задан каталог данных');
    }
    return raw;
  }

  private static mode(raw: string | undefined): AppMode {
    if (raw === undefined || raw === '') return 'development';
    const mode = MODES.find((m) => m === raw);
    if (mode === undefined) {
      throw new Error(
        `EXAMPLE_MODE: «${raw}» — ожидается ${MODES.join(' | ')}`,
      );
    }
    return mode;
  }
}
