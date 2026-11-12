# Бриф среза: assembly (Ф4) — сборка `U7App` без legacy, перенос проектных адаптеров

Черновик `dmg-tech-lead` (Sonnet). Трек `legacy-removal_20261112`. Раскладка файлов — [removal.md](./removal.md); строки этого брифа — все «Ф4» в таблице.

Вход Ф4: Ф2 (планировщик в `dmg-core`, D-71) и Ф3 (UI на `ApiApp`/шине DMG) выполнены; `bun install` и `dmg:sync` после Ф2 сделаны.

## Границы

Правим:
- `platform/app/src/`: `u7-app.ts`, `u7-app.types.ts`, `index.ts`; новые `school/{school.ts,school.test.ts,index.ts}`, `infra/{file-replay-store.ts,job-run-json-repo.ts}` + тесты рядом, `app-clock.ts` (часы корня сборки, вопрос С2); удалить `u7-app-meta.ts`.
- `platform/app-legacy/src/**` — перенос `school.ts`, `school.test.ts`, `composite-logger.ts`; удалить `domain/{api,index}.ts`, `index.ts`, `infra/logger/index.ts`. Остаются `dmg-core.smoke.test.ts` и конфиги пакета — каталог целиком удаляет Ф5.
- `runners/u7-bot/src`: `main.ts`, `infra/json-file-repo.ts` (+ тест), `infra/logger/{composite-logger.ts,index.ts}`, `infra/json-bot-session-repo.ts`, `core/u7-bot-app-meta.ts`; тесты и помощники — список ниже.
- `scripts/`: `_course-client.ts`, `call-uc.ts`, `migrate-streams-school-id.ts` (+ `.test.ts`) — импорты `School`/`TEST_SCHOOL`/`U7_SCHOOL_ID`.
- `platform/core/src/infra/{file-replay-store,job-run-json-repo,json-file-repo}.ts` и их тесты — `git mv` (удаление из `core`).

Не трогаем: `platform/core/src/{api,domain,legacy-bridge}`, остальной `infra` (удаляет Ф5), `package.json`/`tsconfig.json`/`biome.json` (Ф5), модули и домен, `u7-cli`, `data/`.

## Решения брифа

Принято по образцу:
1. **`School` → `platform/app/src/school/`**: `school.ts` (`School`, `SchoolSchema`, `createSchool`, `U7_SCHOOL_ID`, `U7_SCHOOL_STATIC`, `TEST_SCHOOL`) как есть; `index.ts` — вход каталога; `platform/app/src/index.ts` экспортирует `School`, `createSchool`, `TEST_SCHOOL`, `U7_SCHOOL_ID`, `SchoolSchema`. Потребители: 11 тестов/помощников бота (`create-stream.test`, `school/controller.test`, `school/stories/{community,school-hub,school-info,school-reviews}.story.test`, `core/ui-app.test`, `create-ui-app.test`, `e2e/guest-registration.e2e.test`, `helpers/{test-app,test-bot-transport}`), `worlds/builder.ts` (`U7_SCHOOL_ID`), `u7-bot-app-meta.ts` (`School`), `scripts/*` — импорт `@u7-scl/app`. Тест `school.test.ts` (9) переезжает без изменений.
2. **`U7AppResolver` — явный тип в `u7-app.types.ts`**: `{ readonly logger: Logger; readonly mode: AppMode; readonly eventBus: EventBus; readonly school: School }` (поля как у присваивания в `u7-app.ts:92-97`; `eventBus` — dmg `EventBus`). `U7App.appResolver` остаётся полем (читают `platform/app/tests/u7-app.test.ts:91-92, 144, 149`); реэкспорт `U7AppResolver` в `u7-bot-app-meta.ts` удалить (потребителей нет). Вариант: убрать поле и тип вовсе — **не рекомендую** (правка тестов без пользы).
3. **`U7App` на dmg `ApiApp`** (если Ф3 пошла по варианту A — убрать приватную оболочку, иначе сделать всё здесь): `apiApp: DmgApiApp<Identified>`; шина — `new InProcEventBus(logger)` из `dmg-core/app` (единственная, без `legacyEventBus`); `AppContext` — `bus`, `outbox: new InProcOutbox(bus)`, `inbox`, `clock`, `logger`, `mode`, `oplog: JsonlOperationLog(<dbDir>/oplog)`, `replay: env.replay ?? new InProcReplayStore({ clock })`; конструктор: `this.stopSubscription = api.subscribe()` (вместо `init()` оболочки); `start()/stop()` — планировщик пакета: `new InProcJobScheduler({ api, modules: <Def модулей>, clock, logger, store: new JobRunJsonRepo(<dbDir>/jobs/last-runs.json) })` (форма входа — по D-71; здесь вариант B). `legacyClock`, `legacyEventBus`, `legacyJobsOf`, `InProcJobScheduler` из `core/infra`, `ApiApp` из `core/api` не используются. `U7CallerResolver(apiApp)` — без изменений.
4. **Часы корня сборки — `app-clock.ts`: `export const appClock: Clock = () => now().getTime()`** (`now` из `@u7-scl/core/shared`), а не `systemClock` пакета (план): иначе `spyOn(Shared, 'now')` перестаёт замораживать время в DMG — на это опираются `runners/u7-bot/tests/e2e/peer-review-smoke.e2e.test.ts:63`, тест `legacy-clock.test`, `shared/now.test`. Тот же `appClock` берёт `main.ts` для `FileReplayStore.open({ dir, clock })`. Альтернатива — `systemClock` + `U7AppPorts.clock` для тестов — вопрос **С2** в `removal.md`.
5. **`JobRunJsonRepo` → `platform/app/src/infra/job-run-json-repo.ts`**: реализует порт `JobRunRepo` пакета (`Timestamp`); файл `data/jobs/last-runs.json` читается и пишется в прежнем формате (`{ version: 1, lastRuns: { <имя>: <ISO> } }`), конвертация `Date.parse` / `new Date(at).toISOString()` на границе; нечитаемая дата → `undefined`. Повреждённый файл — «история начинается заново», как сейчас. **Данные не мигрируем.** Тесты: 3 из `in-proc-job-scheduler.test.ts` («get без записи», «set → новый экземпляр читает», «повреждённый файл») + 2 новых на конвертацию (число ↔ ISO) → `job-run-json-repo.test.ts`. Решение Opus: ключ — `def.name` (D-71).
6. **`FileReplayStore` → `platform/app/src/infra/file-replay-store.ts`** (git mv, код без изменений); экспорт из `@u7-scl/app`; `main.ts` берёт оттуда. Тест (14) переезжает.
7. **`JsonFileRepo` → `runners/u7-bot/src/infra/json-file-repo.ts` без `BaseJsonDb`**: убрать параметры конструктора `db`, `collectionName`, поле `#db`, ветки `readCollection`/`writeCollection` (`json-file-repo.ts:33-61, 75-80, 137-143`); `JsonFileRepoError` — рядом. Штамп бэкапа битого файла вместо `isoNow()` — `now().toISOString().slice(0, 16).replace(/[:.]/g, '-')` (имя файла-копии не меняется). `getGlobalLogger` — из `@u7-scl/core/shared`. Тест (13) переезжает; потребители: `json-bot-session-repo.ts`, `json-bot-session-repo.test.ts`, `bot-transport-persist.test.ts` — относительный импорт.
8. **`CompositeLogger` → `runners/u7-bot/src/infra/logger/composite-logger.ts`** + `export` в существующем `infra/logger/index.ts`; `main.ts:3` — относительный импорт.
9. **Приватные legacy-поля `U7App` (если Ф3 вариант A) и `u7-app-meta.ts` удаляются**; `U7BotApp`/`U7BotAppMeta` в `runners/u7-bot/src/core/u7-bot-app-meta.ts` (реэкспорт) и `tests/helpers/test-bot-transport.ts:2, 183` → `U7App['apiApp']`.
10. **`u7-cli`** к началу Ф4 уже удалён (Ф6 идёт до Ф3 — см. `removal.md`, «Порядок»); иначе `tsc` корня падает на `runners/u7-cli` (импортирует `U7BotAppMeta`, `app-legacy`, `core/api`).

## Шаги

1. **`dmg-test-designer` (Sonnet)** — red:
   - `platform/app/tests/u7-app.test.ts`: переписать 3 теста: «приложение собирается» (убрать `getModule`; оставить `school`, `appResolver.mode/school`), «init(): подписка ER» → «`apiApp` — dmg `ApiApp`: query-UC `peer-review` отвечает» (без повторного `init` с планировщиком), «отдаёт поля бандла» (убрать `getModule`×4; `app.eventBus` — dmg `EventBus`); + тест «`start()` запускает, `stop()` останавливает планировщик» (на подмене `store`/задержки — без реальных таймеров 3 мин); + тест «часы `U7App` следуют `now()`» (`spyOn(Shared, 'now')` → отметка времени в `oplog`/событии) — замена `legacy-clock.test`.
   - перенос тестов (`git mv`, импорты): `school.test.ts`, `file-replay-store.test.ts`, `json-file-repo.test.ts`; `job-run-json-repo.test.ts` (3 + 2 новых).
   - импорты в 11 тестах/помощниках бота + `scripts/migrate-streams-school-id.test.ts` (`U7_SCHOOL_ID`).
2. **`migrator` (flash)** — по тестам: `school/`, `infra/`, `app-clock.ts`, `u7-app.ts`, `u7-app.types.ts`, `index.ts`, перенос файлов бота, импорты `scripts/*`, `main.ts`, `test-bot-transport.ts`. Flash уместен (сборка и механический перенос по готовым тестам — `deepseek.md` §2); осторожно в `u7-app.ts` — порядок: `subscribe()` до первого `dispatch`; `start()` не вызывается в конструкторе; повторного `start()` без `stop()` нет. Отдельной строкой: «`spyOn(Shared,'now')`-тесты не править, они должны остаться зелёными»; «не ослаблять типы: `as unknown as` для совместимости с `ApiApp` — запрещено, это эскалация».
3. **Гейт (orchestrator):** `bun run scripts/agent-gate.ts`, grep-критерии ниже, `bun run test:bot`, e2e.
4. **Smoke бота (Opus):** `DB_DIR` — **временная копия** `data/fixtures` (не сам каталог: бот пишет `oplog`, `replay`, `bot/`), `git status data/` до/после — чисто. Если запуск `main.ts` без боевого токена невозможен — smoke = e2e/`createTestApp` + новый тест `start/stop`; зафиксировать в отчёте.
5. **`dmg-reviewer` (Opus).**

**Из Ф3 (TR-65):** `u7-app.test.ts` уже переписан по варианту A (`apiApp` — dmg `ApiApp`, шина DMG, без повторного `init`) — п. 1 сводится к тестам `start/stop` и часов. Удалить приватные `#legacyApiApp` и legacy-шину `legacyBus` в `u7-app.ts`; публичный `appResolver.eventBus` ещё отдаёт legacy-шину — перевести на шину DMG (ревью Ф3, question). Проверки `'init' in`/`'getModule' in apiApp` в `u7-app.test.ts` — кандидат в чистку (`test-bloat.md`).

## Было → станет

| Было | Станет | Ссылка |
|---|---|---|
| `U7App.apiApp: ApiApp<U7BotAppMeta>` (оболочка), `init(scheduler)`, `start/stop` оболочки | `DmgApiApp<Identified>`; `subscribe()` в конструкторе; планировщик пакета | `platform/app/src/u7-app.ts:72, 126-137, 146-155` |
| `legacyEventBus(legacyBus, {inbound: []})` + `legacyClock()` | `InProcEventBus(logger)` + `appClock` | `u7-app.ts:155-182` |
| `U7App.appResolver: U7AppResolver` (legacy `AppResolver`) | явный тип в `u7-app.types.ts` | `u7-app.ts:75, 92-97` |
| `School`, `createSchool`, `TEST_SCHOOL`… в `@u7-scl/app-legacy/domain` | `@u7-scl/app` (`platform/app/src/school/`) | `platform/app-legacy/src/domain/school.ts` |
| `FileReplayStore`, `JobRunJsonRepo` в `@u7-scl/core/infra` | `@u7-scl/app` (`platform/app/src/infra/`) | `core/infra/{file-replay-store,job-run-json-repo}.ts` |
| `JsonFileRepo` (с `BaseJsonDb`) в `core/infra` | `runners/u7-bot/src/infra/json-file-repo.ts` без `BaseJsonDb` | `core/infra/json-file-repo.ts` |
| `CompositeLogger` в `app-legacy/infra/logger` | `runners/u7-bot/src/infra/logger/composite-logger.ts` | `app-legacy/src/infra/logger/composite-logger.ts` |
| `U7BotApp`/`U7BotAppMeta`/`u7-app-meta.ts` | удалены; `U7App['apiApp']` | `platform/app/src/u7-app-meta.ts` |

## Сохраняемое поведение

- Бот ведёт себя как прежде: команды (`dispatch`), реакции ER на события модулей (подписка `api.subscribe()` до старта транспорта), периодические задания (`inactivitySweep`, `sweepAbandonedQuestionnaires`) по расписанию с misfire-политикой; отсев повторов `replay` переживает рестарт; `oplog` пишется в `<dbDir>/oplog`.
- Формат `data/jobs/last-runs.json` и ключи заданий не меняются; `data/` не трогается (ни скриптов миграции, ни seed).
- Время: замороженные тесты (`spyOn(Shared, 'now')`) по-прежнему замораживают и DMG (п. 4).
- Журнал: ошибка обработчика события теперь пишет `logger.error('event-bus', …)` (DMG) вместо `console.error` (legacy-шина) — единственное видимое изменение логов; на поведение не влияет.
- `U7App.start()` не вызывается конструктором; `stop()` не отписывает ER (как сейчас).
- **Тесты, закрепляющие состав:** `platform/app/tests/u7-app.test.ts` («отдаёт поля бандла» — `getModule` ×5), `scripts/arch-check.test.ts` (граф), `scripts/domain-check.test.ts`/`domain-arch.test.ts` — без изменений в Ф4 (строки `app-legacy` в `domain-check.test.ts` правит Ф5; `u7-cli` — Ф6). Вне границ тестов, перечисляющих модули приложения, нет.

### Тесты Ф4

| Тест | Судьба |
|---|---|
| `platform/app-legacy/src/domain/school.test.ts` (9) | переносится → `platform/app/src/school/school.test.ts` |
| `platform/core/src/infra/file-replay-store.test.ts` (14) | переносится → `platform/app/src/infra/` |
| `platform/core/src/infra/json-file-repo.test.ts` (13) | переносится → `runners/u7-bot/src/infra/` |
| 3 из `core/infra/in-proc-job-scheduler.test.ts` (`JobRunJsonRepo`) | переносятся → `platform/app/src/infra/job-run-json-repo.test.ts`; + 2 новых (конвертация) |
| `platform/app/tests/u7-app.test.ts` (11) | 3 переписаны; + 2 новых (start/stop, часы) |
| `platform/core/src/legacy-bridge/legacy-clock.test.ts` (1) | удаляется в Ф5; заменён тестом «часы следуют `now()`» (TST-08) |
| `u7-caller-resolver.test.ts` (11), `u7-app.student.test.ts` (3) | правка по тайпчеку |
| 11 тестов/помощников бота с `TEST_SCHOOL`, `worlds/builder.ts`, `bot-transport-persist.test.ts`, `json-bot-session-repo.test.ts` | правка импортов |
| `scripts/migrate-streams-school-id.test.ts` | правка импорта |

## Внешние зависимости

- `dmg-core/app`: `ApiApp`, `InProcEventBus`, `InProcOutbox`, `InProcInbox`, `InProcReplayStore`, `JsonlOperationLog`, `InProcJobScheduler` + порты `JobScheduler`/`JobRunRepo` (Ф2), `Clock`, `ReplayStore`, `AppMode`.
- Модули — только существующие `dependsOn`/пакеты (`@u7-scl/{user,course,questionnaire,stream,wish,peer-review,dossier}`); новых связей нет. `@u7-scl/core` остаётся зависимостью `platform/app` (`ConsoleLogger`, `now`, `Logger`).
- Адаптеры: `JobRunJsonRepo`, `FileReplayStore` (порты пакета); входящих событий legacy → DMG нет (`inbound: []`).

## Открытые вопросы

**Стратегическое:** — (С2 «часы корня сборки» вынесен в `removal.md` как общий для Ф4/Ф5).

Тактическое (предлагаемое решение):
1. `appClock = () => now().getTime()` в `platform/app/src/app-clock.ts` — **да** (п. 4).
2. `U7AppResolver` как явный тип с полем `appResolver` — **да** (п. 2).
3. Smoke бота: временная копия `data/fixtures`, без реального токена — Opus выбирает команду на гейте (п. шаг 4).
4. `JobRunJsonRepo`: нечитаемая дата → `undefined` (а не исключение) — **да**: как «история начинается заново».

## Правила (ID `rules.md`)

ARC-06/ARC-07 (корень сборки — домен только `contract`, пакеты модулей — через вход), ARC-08 (раннер — только `appApi`), ARC-09 (`process.env` читает только `main.ts`/`config.ts`; `U7App` — данные из `U7AppEnv`), ARC-10, DOM-12 (часы — `Timestamp`), API-06 (расписания UTC), ERR-07, TST-05, TST-06, TST-08, TST-09, CODE-02/04.

## Документы

Срез не правит `dmg-core`. Проектные — Ф7: `conductor/architecture/{migration,index}.md` (корень сборки без legacy), `debt.md` (TR-33 закрыт; запись «`shared` остаток» — вопрос С3).

## Критерии приёмки

- `grep -rn "legacy-bridge\|U7ApiApp\|U7AppResolver\|legacyClock\|legacyEventBus\|legacyJobsOf" --include=*.ts platform/app runners scripts` — пусто (`U7AppResolver` допустим **только** в `platform/app/src/u7-app.types.ts`, `u7-app.ts`, `index.ts` и `platform/app/tests/u7-app.test.ts`: тип объявлен там сознательно; исключить эти файлы из грепа — `grep … | grep -v "platform/app/"`).
- `grep -rn "@u7-scl/core/infra\|@u7-scl/app-legacy\|@u7-scl/core/legacy-bridge" --include=*.ts runners platform/app scripts` — пусто.
- `ls platform/app-legacy/src` — только `dmg-core.smoke.test.ts`; `grep -rn "BaseJsonDb" --include=*.ts runners platform/app` — пусто.
- `grep -rn "isoNow" --include=*.ts runners platform/app scripts` — пусто.
- `bun run check` зелёный; `bun run test:bot` и e2e не ниже базовой Ф0 (тесты Ф4 переносятся, +4 новых); записи красной зоны Ф3–Ф4 в `debt.md` сняты (если были); бот поднимается на копии фикстур (шаг 4); `git status data/` чист.
- `git diff --numstat` на перенесённых тестах: счёт `test()` у файла-назначения равен источнику (9, 14, 13; 3 + 2 новых).

## Отчёты Ф4

**`dmg-test-designer` (Sonnet).** Red: +4 теста в `u7-app.test.ts` (start/stop ×2, «конструктор не стартует», часы следуют `now()` — замена `legacy-clock.test`); `git mv` `school.test.ts` (9), `file-replay-store.test.ts` (14), `json-file-repo.test.ts` (13; тестов на `BaseJsonDb` не было); `job-run-json-repo.test.ts` — 3 перенесено из `in-proc-job-scheduler.test.ts` + 2 новых; импорты `@u7-scl/app` в 13 файлах бота и `scripts`. Нужный шов — `U7AppPorts.jobStartDelayMs`.

**`migrator` (flash, `lr-F4-migrator`).** Green по п. 1–11 промпта; отклонения: `U7BotApp`/`U7BotAppMeta` удалены (потребителей нет), функция отписки `subscribe()` не хранится. Гейт зелёный, `test:bot` 924 pass, grep-критерии пусты. Доработка 1 (ревью): `Logger` и `warn` в `JobRunJsonRepo` (ERR-07), комментарии CODE-04, порт `jobRunRepo` убран — тесты через файл `<dbDir>/jobs/last-runs.json`, `appResolver.eventBus === eventBus`, без псевдонима `clock`, экспорт `JobRunJsonRepo` снят, тест «`set` сохраняет ключи других заданий». Доработка 2: удалены структурные проверки `'init' in`/`'getModule' in apiApp` (журнал `test-bloat`, Ф3).

**`dmg-data-keeper` (flash, подсказка гейта).** Форматы `jobs/last-runs.json`, `bot/{sessions,short-ids}.json`, `replay/` не менялись; путь `JsonFileRepo` через `BaseJsonDb` в проде не использовался; миграция не нужна, откат безопасен. Ключи живой истории — сверить на ревизии (TR-66).

**Smoke (Opus).** Скрипт по пути `main.ts` до верификации админа на временной копии `data/fixtures` (без Telegram): `U7App`, `createUiApp`, админ подтверждён; с давней историей оба задания прогнаны, `last-runs.json` записан в ISO, oplog пишется; `git status data/` чист.

**`dmg-reviewer` (Opus).** 0 error, 2 warn (ERR-07 и CODE-04 в `JobRunJsonRepo`), 6 info, 1 question (порт `jobRunRepo`) — всё принято и исправлено в доработке 1, кроме info: CODE-02 (`#`-поля — обычай `platform/app`), отбрасывание отписки (по брифу), документы `README.md`/`TODO.md` — Ф7. Решения — TR-66.
