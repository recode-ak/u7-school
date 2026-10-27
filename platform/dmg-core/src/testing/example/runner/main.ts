#!/usr/bin/env bun
/**
 * Точка входа CLI учебного приложения (D-50): окружение → `ExampleApp`,
 * запуск реакций, одна команда, код выхода; ошибка окружения —
 * `EXIT_CONFIG`. `process` — только здесь (ARC-09).
 *
 *   EXAMPLE_USERS=<uuid> bun src/testing/example/runner/main.ts \
 *     create-task --title Хлеб --user <uuid>
 */

import { ExampleApp } from '../app/example-app';
import type { ExampleAppEnv } from '../app/example-app.types';
import { EXIT_CONFIG, ExampleCli } from './example-cli';
import { ExampleEnv } from './example-env';

// Ошибка окружения — ошибка конфигурации запуска: сообщение без стека и
// `EXIT_CONFIG`. Прочие исключения не ловятся — это сбой, нужен стек.
let env: ExampleAppEnv | undefined;
try {
  env = new ExampleEnv(process.env).toAppEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = EXIT_CONFIG;
}

if (env !== undefined) {
  const app = new ExampleApp(env);
  const stop = app.start();
  try {
    process.exitCode = await new ExampleCli(app).run(process.argv.slice(2), {
      out: (line) => console.log(line),
      err: (line) => console.error(line),
    });
  } finally {
    stop();
  }
}
