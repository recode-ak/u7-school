/**
 * oplog — чтение лога операций (D-86): запускает CLI пакета `dmg-core oplog`
 * над `${DB_DIR:-./data}/oplog`. Только чтение. Без аргументов — подсказка
 * (код 2): лента всего лога без фильтра нужна редко и велика.
 *
 *   bun run oplog --request <id>
 *   bun run oplog --aggregate <uuid>
 *   bun run oplog --subject <id> --since 2026-11-14
 *
 * Флаги — в `node_modules/dmg-core/docs/reference/oplog.md` §3.
 */
import { join } from 'node:path';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error(
    'Использование: bun run oplog [--request <id>] [--aggregate <uuid>] [--subject <id>] [--module <m>] [--op <o>] [--failed] [--since <d>] [--until <d>] [--json]',
  );
  process.exit(2);
}

const dir = join(process.env.DB_DIR ?? './data', 'oplog');
const cli = join(import.meta.dir, '../node_modules/.bin/dmg-core');
const proc = Bun.spawnSync([cli, 'oplog', dir, ...args], {
  stdout: 'inherit',
  stderr: 'inherit',
});
process.exit(proc.exitCode ?? 1);
