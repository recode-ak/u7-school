import type { AppMode } from '#core/app/context';
import type { ExampleAppEnv } from '../app/example-app.types';
import type { EnvVars } from './example-env.types';

const MODES: readonly AppMode[] = ['test', 'development', 'production'];

/**
 * Окружение раннера → `ExampleAppEnv` (ARC-09: `process.env` читает только
 * точка входа и передаёт сюда словарём). Переменные: `EXAMPLE_MODE`
 * (по умолчанию `development`), `EXAMPLE_DATA_DIR` (обязателен),
 * `EXAMPLE_USERS` — uuid через запятую. Неверный режим — исключение
 * (ошибка конфигурации, ERR-01).
 */
export class ExampleEnv {
  constructor(private readonly vars: EnvVars) {}

  toAppEnv(): ExampleAppEnv {
    const { vars } = this;
    return {
      mode: ExampleEnv.mode(vars.EXAMPLE_MODE),
      dataDir: ExampleEnv.dataDir(vars.EXAMPLE_DATA_DIR),
      users: (vars.EXAMPLE_USERS ?? '')
        .split(',')
        .map((uuid) => uuid.trim())
        .filter((uuid) => uuid !== ''),
    };
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
