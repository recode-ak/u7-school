# Итог трека F-111 (в работе)

## Базовая линия (Ф0, 2026-11-15)

| Репо | Команда | Итог |
|---|---|---|
| dmg-core (`72bdf0a`) | `bun run check` | 1504 pass, 0 fail, 137 файлов; lint, tslint, docs:covers, docs:jsdoc — зелёные |
| dmg-core | `bun run e2e` | ok |
| u7-school (`d00cfad6`) | `CI=true bun run check` | 3420 pass, 0 fail, 324 файла |
| u7-school | `bun run test:bot` | 1232 pass, 0 fail, 111 файлов |

**Объём лога фикстур:** `data/fixtures/oplog/2026-11-13.jsonl` — 93 226 байт (единственный файл) — точка сравнения для Ф1.
