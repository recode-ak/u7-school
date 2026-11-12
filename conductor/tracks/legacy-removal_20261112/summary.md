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
| Ф5 | `F5-legacy-removal-migrator` (удаление `core/{api,domain,infra,legacy-bridge}`, `app-legacy`, конфигурация, `PLATFORM`) | flash | 0.0709 | 70 | 99 | 1 (warn ревью: лишняя зависимость в `modules/stream/package.json`) | 0 |

## Удалённые тесты Ф5 (TST-08)

`bun test`: 3072 pass (конец Ф4) → **2899 pass** (−173): 172 `test()` в 25 удалённых файлах + 1 кейс `scripts/lint-rules.test.ts` (фикстура `lint-fixtures/platform/app-legacy/src/arc-07.ts.txt` — проверяла ARC-07 удалённого пакета).

**Перенесены в `dmg-core` в Ф2 (30), здесь удалены старые копии:** `core/infra/job-schedule-planner.test.ts` (16), `scheduled-job-runner.test.ts` (11), `in-proc-job-scheduler.test.ts` — 3 из 5 (`InProcJobScheduler`; 3 теста `JobRunJsonRepo` переехали в `platform/app/src/infra` в Ф4).

**Удалены вместе с legacy-кодом (142)** — где покрыто: таблица «На удаление» в [slices/removal.md](./slices/removal.md#тесты):

| Файл | `test()` |
|---|--:|
| `app-legacy/src/dmg-core.smoke.test.ts` | 1 |
| `core/api/app/{api-app-dmg,api-app}.test.ts` | 10 + 8 |
| `core/api/er/event-reaction.test.ts` | 6 |
| `core/api/job/job.test.ts` | 8 |
| `core/api/module/api-module.test.ts` | 14 |
| `core/api/uc/{use-case-auth,use-case-output,use-case-publish-events,use-case}.test.ts` | 5 + 3 + 3 + 5 |
| `core/domain/ar/aggregate.test.ts` | 13 |
| `core/domain/common/file-metadata.test.ts` | 6 |
| `core/domain/errors/{error-helpers,errors}.test.ts` | 9 + 3 |
| `core/domain/types.test.ts` | 4 |
| `core/infra/base-json-db.test.ts` | 5 |
| `core/infra/in-proc-event-bus.test.ts` | 9 |
| `core/infra/in-proc-job-scheduler.test.ts` (`InProcJobExecutor`) | 2 |
| `core/legacy-bridge/{example-app,legacy-clock,legacy-event-bus,legacy-job}.test.ts` | 8 + 1 + 12 + 4 |
| `core/shared/iso-now.test.ts` | 3 |

Сходится с брифом: 140 + 2 удалено, 30 перенесено. Сверка с базой Ф0 (3083) — в гейте закрытия Ф7.

## Почищенные случаи `test-bloat`

- Ф4: `platform/app/tests/u7-app.test.ts` — структурные проверки `'init' in`/`'getModule' in apiApp` (TST-09, запись Ф3) удалены.
