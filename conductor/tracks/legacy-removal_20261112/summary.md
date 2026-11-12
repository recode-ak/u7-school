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
| Ф1 | `lr-F1-migrator` (green среза `dossier` + 2 доработки: `checkTempMarkers` по эскалации, правки по ревью) | flash | 0.0941 | 77 | 98–100 | 2 (эскалация `checkDebt` — формат закрытия долга orchestrator'а; info ревью) | 0 |
| Ф2 | `lr-F2-migrator` (планировщик в `dmg-core` + 1 доработка по ревью) | flash | 0.0647 | 43 | 96–99 | 1 (warn/info ревью) | 0 |
| Ф6 | `F6-migrator-remove-cli` (удаление `runners/u7-cli`, правки `scripts/*.test.ts`, `README.md`) | flash | 0.0302 | 27 | 96 | 0 | — (ревью — orchestrator по diff, шаг механический) |
| Ф3 | `lr-F3-3b` (stories, закрывающие типы бота, `config.ts`, `U7App` вариант A + 1 доработка по ревью) | flash | 0.1259 | 97 | 99–100 | 1 (5 warn ревью) | 0 |
| Ф4 | `lr-F4-migrator` (сборка `U7App` без legacy, перенос адаптеров + 2 доработки: ревью, чистка `test-bloat`) | flash | 0.1027 | 66 | 98–100 | 2 (2 warn, 1 question, info ревью; журнал `test-bloat`) | 0 |
| Ф4 | `lr-F4-data-keeper` (совместимость `last-runs.json`, сессий бота, `replay/`) | flash | 0.0331 | 31 | 97 | 0 | — |

## Почищенные случаи `test-bloat`

- Ф4: `platform/app/tests/u7-app.test.ts` — структурные проверки `'init' in`/`'getModule' in apiApp` (TST-09, запись Ф3) удалены.
