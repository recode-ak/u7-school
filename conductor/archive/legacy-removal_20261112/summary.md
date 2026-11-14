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
| Ф7 | — (документы, аудит `throw*`, гейт — Claude: Opus по плану) | — | 0 | — | — | 0 | — |

**Итого DeepSeek:** 8 шагов flash, $0.5944; `error` ревью — 0.

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

**Вывод:** критерий завершения перехода «нет `throw*` для штатных отказов» выполнен не полностью: 1 штатный отказ в раннере бота и 8 пограничных мест — кандидаты на ревизию.

## Гейт закрытия (Ф7, 2026-11-12)

От `6b17ef9f`, рабочее дерево чистое.

| Команда | База Ф0 | Итог | Разница |
|---|---|---|---|
| `CI=true bun test` (`bun run check`) | 3083 | **2899 pass**, 0 fail, 297 файлов | −184 = +3 (Ф1, `dossier.module`) −21 (Ф3, `AppException`, сверено по именам) +7 (Ф4, адаптеры `app`) −173 (Ф5, удалены с legacy — таблица выше) |
| `bun run test:bot` | 921 | **924 pass**, 0 fail | +3 |
| `bun run check` | зелёный | **зелёный** (`arch:check` — нарушений нет) | — |
| `bun test` в `dmg-core` (`bbc4484`) | 1384 | **1415 pass**, 0 fail | +31 (30 перенесены из `core/infra` в Ф2, +1 новый) |

Триаж: красных тестов нет; промежуточных состояний и регрессов нет. Удалённые тесты — перенесены (Ф2, Ф4) или ушли вместе с удалённым кодом (Ф3, Ф5), списки — выше и в git notes контрольных точек.

### Критерии spec

| # | Критерий | Итог | Проверка |
|---|---|---|---|
| 1 | нет `app-legacy`/`legacy-bridge`/`-legacy/` в `*.ts`/`*.json`; нет `platform/app-legacy`, `runners/u7-cli` | ✅ | grep пуст вне `node_modules` и архива; каталогов нет |
| 2 | `@u7-scl/core` — только `ui` и `shared`; legacy-классов нет; остаток расписан | ✅ | `exports` — `./ui`, `./shared`; остаток — `migration.md` §4, `debt.md` (TR-33 закрыт) |
| 3 | `DossierModuleDef` без `external`, README модуля, `arch:check` — обычный модуль | ✅ | `grep external domain/src/dossier` пуст; `modules/dossier/README.md` |
| 4 | нет `sub !== 'index'` и пропуска legacy-пар; DEBT-3, DEBT-34 сняты | ✅ | Ф1, `ff7727d` |
| 5 | `legacy.md` удалён, битых ссылок нет; `migration.md` фиксирует завершение | ✅ | `9df0227`, `6c9f80b`; grep `legacy.md` вне архива и трека пуст |
| 6 | `~/dev/tools/dmg/dmg-cli` с кодом и README; кандидат в `roadmap` | ✅ | `dmg-cli@848afee`; `roadmap.md` п. 11 |
| 7 | `check` зелёный; число тестов сверено, удалённые перечислены | ✅ | таблица выше |
| 8 | аудит `throw*` в `summary.md` | ✅ | раздел «Аудит `throw*`»; критерий `migration.md` §5 по `throw*` — не полностью (1 штатный отказ, 8 пограничных) |

## Приложение: план перехода

Из `conductor/architecture/migration.md` (удалён в треке `pre-dmg-ui-cleanup`, Ф6; принципы — D-22, текущее состояние — `conductor/architecture/index.md`, «Состояние»). Строки 7+ — дальнейшие треки, их последовательность ведёт `roadmap.md`.

### Порядок треков

| # | Трек | Суть | Исполнитель |
|---|---|---|---|
| 0 | **agents-setup** | роли агентов для Claude Code и pi из одного источника, хук гейта в обеих средах, режим оркестратора и передача между средами в `conductor-implement` ([agents.md](../../architecture/agents.md) §8) | orchestrator |
| 1 ✅ | **core-dmg** | `Result`, Def-классы (`XxxDef.define`), `F.*`, `Timestamp`, `ReadonlyAr`, Aggregate v2, UoW, `Caller` и `callers`, `normalize(def)`, `*FromDef`, `appApi.run`, граф-движок, `arch:check`, линт-правила ARC/DOM/CODE | orchestrator + Нурболат |
| 1б ✅ | **dmg-core-extract** | платформа DMG — отдельный пакет `dmg-core` (npm), развязка от legacy, самодостаточные конфиги, готовность модулей к выносу в сервисы ([D-28](../../architecture/decisions.md)); пакет готов к выносу, сам вынос — по чек-листу в spec трека после релиза. Трек: `conductor/archive/dmg-core-extract_20261020` | orchestrator + Нурболат |
| 2 ✅ | **generators** | `bun run gen` для всех видов артефактов по [naming.md](../../architecture/naming.md) | orchestrator + Нурболат |
| 3 ✅ | **domain-package** | трек: `conductor/archive/domain-package_20261020`, реестр долга — [conductor/debt/](../../debt/README.md). Пакет-каркас `@u7-scl/domain` создан в треке generators; наполнить: механически перенести domain-слои снизу вверх: user (+ `User` из app) → course → questionnaire → stream → wish → peer-review → dossier. Старые пути `@u7-scl/<m>/domain` временно реэкспортируют | migrator |
| 4 ✅ | **golden-wish** | перевести `wish` на Def, `Result`, Policy, entity-правило, UoW, Timestamp. Эталон; по нему написаны гайды артефактов — [guides/](../../../node_modules/dmg-core/docs/guides/index.md). Трек: `conductor/archive/golden-wish_20261020` | orchestrator + Нурболат |
| 5 ✅ | **peer-review** | первый модуль конвейером агентов; Ф0 — пилот ролей волны 1 ([agent-roles.md](../../architecture/agent-roles.md) §4). Трек: `conductor/archive/peer-review-dmg_20261029` | агенты |
| 6 ✅ | остальные модули | сверху вниз по графу (§2.1): `stream` → `questionnaire` → `course` → `user`; последний — `legacy-removal` (`dossier` на Def, удаление legacy, `u7-cli` → `dmg-cli`). Трек: `conductor/archive/legacy-removal_20261112` | агенты |
| 7 | **timestamp-data** | после релиза: пакетная миграция живых данных, удаление «чтения строки» (до выкатки `v0.2.6` пишет ISO — миграция до релиза бессмысленна) | orchestrator, с подтверждением |
| 8 | **delegation** | агрегат `Delegation` в user, построение `delegate` в транспорте ([caller.md](../../../node_modules/dmg-core/docs/reference/caller.md) §4) | агенты |
| 9 | **ui-manifests** | Def-манифесты UI, эталонный UI-срез, генерация спецификации экранов; `ui-spec.md` удаляются по мере перевода контроллеров ([ui-manifests.md](../../architecture/ui-manifests.md)) | orchestrator + Нурболат |
| 10+ | потребители графа | CLI `domain`, `docs:domain`/`docs:tech`, `docs:llm`, http + OPTIONS, mcp; с ними — вычистка JSDoc, дублирующего `label`/`description` Def ([docs-strategy.md](../../architecture/docs-strategy.md) §6) | по roadmap |

Треки 1 и 3 независимы; 1б и 2 — после 1; Фазы 1–3 трека 1б выполняются до 2 и 4, Фазы 4–6 — после 4 (golden-wish). Трек 1 выполнен (кроме выноса, он в 1б): 2 (generators) выполнен — `bun run gen` готов (с Ф5 трека 1б — `dmg-core gen` пакета); 3 (domain-package) выполнен и заархивирован; 4 (golden-wish) выполнен — разблокированы Фазы 4–6 трека 1б и трек 5.

### Порядок модулей: сверху вниз по графу

Модули переводились **от потребителей к поставщикам** (`wish` → `peer-review` → `stream` → `questionnaire` → `course` → `user`, `dossier` — последним): обратных мостов (legacy зовёт Def) не строили. Поставщик, ещё не переведённый, был внешним `ModuleDef` (`external: true`, D-37) с **адаптером над legacy-фасадом** — `UseCaseFromDef` над Def контракта, только перевод входа и ответа; адаптер снимался в треке поставщика. Внешних модулей и адаптеров в коде больше нет.

### Что исправил переход

| Сейчас | Становится |
|---|---|
| `_state` мутируется до валидации (`safeUpdate`) | черновик → валидация → фиксация, отказы через `Result` |
| `new Ar(state)` и для создания, и для восстановления | `Ar.create(): Result<Ar>` и `Ar.restore()` |
| геттер `state` клонирует на каждое чтение, все читают поля | `snapshot()` только для репозитория, доменный API |
| domain импортирует api (`commands → api/errors`, Ds бросает UC-ошибки) | контракты и ошибки в domain |
| события — интерфейсы со строками, payload без схемы | `EventDef.define` со схемой и FQN |
| `CompleteStudentUc`: `switch` по исходу, снятие роли, выбор текста | `studentAr.complete(outcome)`; роль — ER модуля user; текст — UI |
| Policy → `boolean`, текст отказа в UC | правила с `denyMessage` в Def |
| фасад: `try/catch` по `kind`, `as Stream` | `Result` и `ReadonlyAr` |
| `StreamDs` — запись и UI-чтение вместе | DCS и DQS |
| `ApiModule`: список UC + union-мета + имя | карта Def → класс, пропуск — ошибка компиляции |
| ER: сбой гасится `console.error` | `Result`, логирование, журнал сбоев |
| `getDocType()` у инстансов | статический граф |

