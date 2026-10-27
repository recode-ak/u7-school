#!/usr/bin/env bun
/**
 * CLI пакета: доставка скилов, ролей и вставки в инструкции агентов проекта.
 *
 *   dmg-core init          — создать dmg-core.json (если нет) и выполнить sync
 *   dmg-core init --profile single|monorepo [--name <имя>] [--dry-run]
 *                          — каркас проекта, затем sync
 *   dmg-core sync          — обновить копии
 *   dmg-core sync --check  — проверить копии (для check проекта)
 *   dmg-core gen <вид> …   — создать файлы модуля (dry-run без --write)
 */
import { join } from 'node:path';
import { DmgCoreCli } from './dmg-core-cli';
import { PackageSource } from './package-source';

const USAGE = [
  'Использование: dmg-core init | sync [--check] | gen <вид> <модуль>[.<агрегат>] [<имя>] [--write] [--dry-run] [--adopt]',
  '               dmg-core init --profile single|monorepo [--name <имя>] [--dry-run]',
].join('\n');

const [command, ...flags] = process.argv.slice(2);
const cli = new DmgCoreCli(
  await PackageSource.load(join(import.meta.dir, '../..')),
);
const root = process.cwd();

// gen и init: план и список файлов — в stdout, ошибка ввода или коллизия —
// в stderr, код 1. Пути gen — от корня проекта («.»); прежний init без
// аргументов при успехе ничего не печатает.
const planned =
  command === 'gen'
    ? await cli.gen('.', flags)
    : command === 'init'
      ? await cli.init(root, flags)
      : undefined;
if (planned) {
  const print = planned.ok ? console.log : console.error;
  for (const message of planned.messages) print(message);
  process.exit(planned.ok ? 0 : 1);
}

const check = flags.includes('--check');

const result =
  command === 'sync'
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
