# Итог: `timestamp-data` — даты только числом

## Базовая линия (Фаза 0, 2026-11-15)

| Репо | Команда | Результат |
|---|---|---|
| dmg-core (`edd0dc0`) | `bun run check` | зелёный: 1648 pass / 0 fail, 144 файла; `docs:covers` — 3 warn (domain.md ×2, project.md) |
| u7-school (`8d3591b`) | `CI=true bun run check` | зелёный: 3456 pass / 0 fail, 332 файла |
| u7-school | `CI=true bun test` | 3456 pass / 0 fail, 332 файла |

### Счёт ISO-дат (точка сравнения для Ф5)

Шаблон — `YYYY-MM-DDTHH:MM`.

| Где | Счёт |
|---|---|
| `data/courses/*.json` | 2369: `steps.json` 1865, `lessons.json` 494, `modules.json` 8, `courses.json` 2 |
| `.ts` (без `node_modules`) | 61 файл / 160 строк; вне `Date.parse`/`new Date` — 116 строк |
