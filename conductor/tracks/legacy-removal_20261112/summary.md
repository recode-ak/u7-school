# Summary: legacy-removal_20261112

## Базовая линия (2026-11-12, Ф0)

От `bf7c640b`, рабочее дерево чистое.

| Команда | Итог |
|---|---|
| `CI=true bun test` | 3083 pass, 0 fail, 320 файлов |
| `bun run test:bot` | 921 pass, 0 fail, 94 файла |
| `bun run check` | зелёный (`dmg:check`, `agents:check`, biome, `tsc`, `arch:check`, `gen:e2e` 4 pass, тесты 3083 pass) |
| `bun test` в `dmg-core` | 1384 pass, 0 fail, 131 файл |

`runners/u7-bot/tests/courses/course-catalog.integration.test.ts` входит в прогон (2 pass); ошибки `@u7-scl/user/domain`/`userFacade` — устаревшая диагностика редактора: в файле их нет, `tsc --noEmit` чист.

## DeepSeek по фазам (`deepseek.md` §5)

Установка Нурболата: DeepSeek — по максимуму, без потери качества. Распределение — по §2 `deepseek.md`; механические списки для брифов (инвентаризация файлов и импортёров) готовит flash, бриф и приёмка — Claude.

| Фаза | Шаг (`--label`) | Модель | $ | Ходов | hitRate | Кругов доработки | `error` ревью |
|---|---|---|---|---|---|---|---|
| Ф0 | `lr-F0-inventory` (инвентаризация legacy, `slices/inventory.md`) | flash | 0.0728 | 37 | 98 | 0 | — |
