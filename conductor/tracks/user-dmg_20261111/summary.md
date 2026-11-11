# Summary: user-dmg_20261111

## Базовая линия (2026-11-11)

| Где | Команда | Результат |
|---|---|---|
| u7-school (`b3b44aea`) | `CI=true bun test` | 3179 pass, 0 fail (335 файлов) |
| u7-school (`b3b44aea`) | `bun run test:bot` (e2e-тесты бота) | 894 pass, 0 fail (94 файла) |
| u7-school (`b3b44aea`) | `CI=true bun test domain/src/user` | 27 pass, 0 fail (4 файла) |
| u7-school (`b3b44aea`) | `CI=true bun test modules/user` | 67 pass, 0 fail (12 файлов) |
| dmg-core (`93333e8`) | `CI=true bun test` | 1379 pass, 0 fail (131 файл) |

## Пилот ролей

Строка на каждый вызов роли ([agent-roles.md](../../architecture/agent-roles.md) §5).

| # | Роль | Задача | Модель | Повлиял на решение | Принято замечаний | Промпт правился | Оценка orchestrator |
|---|---|---|---|---|---|---|---|

## DeepSeek по фазам (`deepseek.md` §5)

| Фаза | Шаг (`--label`) | Модель | $ | Ходов | hitRate | Кругов доработки | `error` ревью |
|---|---|---|---|---|---|---|---|
