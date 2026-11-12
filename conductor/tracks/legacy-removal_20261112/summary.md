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

## Аудит `throw*` (Ф7, `dmg-reviewer`, Opus)

Область — `domain/src`, `modules/*/src`, `platform/*/src`, `runners/*/src`, `scripts/*.ts` без тестов. Мерило — `errors-result.md` §1, §3 пакета, ERR-01/06/07. Бывших `throw*`-хелперов нет; в домене все броски — инварианты с обоснованием (`biome-ignore`). Всего 63 `throw` и 10 `assert*`; исправление — за рамками трека.

**Штатный отказ (1, warn):**

| Место | Что | Как должно быть |
|---|---|---|
| `runners/u7-bot/src/create-ui-app.ts:102` | `actorResolver` бросает, если `Caller` не `UserCaller`: незарегистрированный пишет боту без `/start` — `bot.catch` логирует `error`, пользователь ответа не получает | гость — штатный исход: актор допускает гостя, либо вход UiApp делает `ensureRegisteredGuest`/отвечает «наберите /start» (ERR-01, ERR-06) |

**Пограничные (8, info):**

| Место | Суть | Рекомендация |
|---|---|---|
| `modules/peer-review/src/infra/review.json-repo.ts:98`, `review-campaign.json-repo.ts:73` | дубль ключа нового агрегата при гонке → `SERVER_INTERNAL` | `VersionConflict` → `VERSION_CONFLICT` (§3) |
| `runners/u7-bot/.../scope-reviews.story.ts:92` | `STREAM_NOT_FOUND` по `scopeId` из callback_data (устаревшая/подделанная) | ветка `NOT_FOUND` с экраном |
| `.../campaign.story.ts:427`, `.../my-reviews.story.ts:299` | `NOT_FOUND` потока по ссылке из записи — дефект данных | оставить, при случае — `switch` |
| `runners/u7-bot/src/ensure-registered.ts:53` | `first_name` из одних пробелов → `INPUT_VALIDATION`, регистрации нет | имя по умолчанию или обработка ветки |
| `modules/stream/src/student/uc/enroll-student.uc.ts:91`, `stream/uc/activate-stream.uc.ts:54` | по смыслу инварианты, но ERR-01 в `biome.json` не охватывает `modules/*/src` — нет `biome-ignore` с причиной | расширить `includes` ERR-01 на `modules/*/src/**/*.{uc,er}.ts` |

**Допустимые (54):** инварианты/ошибки программиста — 12; UI: переброс базовых ошибок UC с `errors: []` и битых ссылок — 16 (часть ловится локально с `warn`, ERR-07); конфигурация и контент при старте — 11; I/O и повреждённые данные — 2 (`json-file-repo.ts`); CLI `scripts/` — 13.

**Вывод:** критерий [migration.md](../../architecture/migration.md) §5 «нет `throw*` для штатных отказов» выполнен не полностью: 1 штатный отказ в раннере бота и 8 пограничных мест — кандидаты на ревизию.
