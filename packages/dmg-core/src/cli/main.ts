#!/usr/bin/env bun
/**
 * CLI пакета: доставка скилов, ролей и вставки в инструкции агентов проекта.
 *
 *   dmg-core init          — создать dmg-core.json (если нет) и выполнить sync
 *   dmg-core sync          — обновить копии
 *   dmg-core sync --check  — проверить копии (для check проекта)
 */
import { join } from 'node:path';
import { DmgCoreCli } from './dmg-core-cli';
import { PackageSource } from './package-source';

const USAGE = 'Использование: dmg-core init | sync [--check]';

const [command, ...flags] = process.argv.slice(2);
const cli = new DmgCoreCli(
  await PackageSource.load(join(import.meta.dir, '../..')),
);
const root = process.cwd();
const check = flags.includes('--check');

const result =
  command === 'init'
    ? await cli.init(root)
    : command === 'sync'
      ? check
        ? await cli.check(root)
        : await cli.sync(root)
      : undefined;

if (!result) {
  console.error(USAGE);
  process.exit(2);
}
for (const message of result.messages) console.error(message);
if (!result.ok) {
  if (check) console.error('Обнови копии: dmg-core sync');
  process.exit(1);
}
