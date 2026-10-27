#!/usr/bin/env bun
/**
 * Точка входа CLI учебного приложения (D-50): окружение → `ExampleApp`,
 * запуск реакций, одна команда, код выхода. `process` — только здесь
 * (ARC-09).
 *
 *   EXAMPLE_USERS=<uuid> bun src/testing/example/runner/main.ts \
 *     create-task --title Хлеб --user <uuid>
 */
import { ExampleApp } from '../app/example-app';
import { ExampleCli } from './example-cli';
import { ExampleEnv } from './example-env';

const app = new ExampleApp(new ExampleEnv(process.env).toAppEnv());
const stop = app.start();
try {
  process.exitCode = await new ExampleCli(app).run(process.argv.slice(2), {
    out: (line) => console.log(line),
    err: (line) => console.error(line),
  });
} finally {
  stop();
}
