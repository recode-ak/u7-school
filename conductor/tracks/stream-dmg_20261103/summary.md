# Summary: stream-dmg_20261103

## Базовая линия (2026-11-03)

| Где | Команда | Результат |
|---|---|---|
| u7-school (`a52989f3`) | `CI=true bun test` | 3568 pass, 0 fail (366 файлов) |
| u7-school (`a52989f3`) | `bun run test:bot` (e2e-тесты бота) | 996 pass, 0 fail (92 файла) |
| u7-school (`a52989f3`) | `CI=true bun test domain/src/stream` | 243 pass, 0 fail (14 файлов) |
| u7-school (`a52989f3`) | `CI=true bun test modules/stream` | 103 pass, 0 fail (24 файла) |
| dmg-core (`1789b42`) | `CI=true bun test` | 1397 pass, 0 fail (132 файла) |
| dmg-core (`1789b42`) | `bun run e2e` | `e2e: ok` |

## Пилот ролей

Критерии — [agent-roles.md](../../architecture/agent-roles.md) §5. Второй трек пилота: строка на каждый вызов роли. Промпты в треке не правятся.

| # | Роль | Задача | Модель | Повлиял на решение | Принято замечаний | Промпт правился | Оценка orchestrator |
|---|---|---|---|---|---|---|---|
