# Summary: questionnaire-dmg_20261104

## Базовая линия (2026-11-04)

| Где | Команда | Результат |
|---|---|---|
| u7-school (`bc2c0950`) | `CI=true bun test` | 3959 pass, 0 fail (386 файлов) |
| u7-school (`bc2c0950`) | `bun run test:bot` (e2e-тесты бота) | 1039 pass, 0 fail (97 файлов) |
| u7-school (`bc2c0950`) | `CI=true bun test domain/src/questionnaire` | 97 pass, 0 fail (11 файлов) |
| u7-school (`bc2c0950`) | `CI=true bun test modules/questionnaire` | 51 pass, 0 fail (8 файлов) |
| dmg-core (`6cfe5f2`) | `CI=true bun test` | 1397 pass, 0 fail (132 файла) |
| dmg-core (`6cfe5f2`) | `bun run e2e` | `e2e: ok` |

Расхождение со spec: на конец `stream` записано 3947 pass, сейчас 3959 — +12 тестов от трека волны 2 ролей (после закрытия `stream`).

## Пилот ролей

Строка на каждый вызов роли ([agent-roles.md](../../architecture/agent-roles.md) §5). Роли — из пакета `dmg-core` (волна 2).

| # | Роль | Задача | Модель | Повлиял на решение | Принято замечаний | Промпт правился | Оценка orchestrator |
|---|---|---|---|---|---|---|---|

## DeepSeek по фазам (`deepseek.md` §5)

| Фаза | Шаг (`--label`) | Модель | $ | Ходов | hitRate | Кругов доработки | `error` ревью |
|---|---|---|---|---|---|---|---|
