# Бриф среза: removal (Ф5 + Ф6) — удаление legacy и `u7-cli` → `dmg-cli`; сводная раскладка

Черновик `dmg-tech-lead` (Sonnet). Трек `legacy-removal_20261112`. Сводный документ по всему треку: раскладка «файл → куда / удалить» (все файлы `inventory.md` §1–§3), списки тестов, расхождения spec/plan с кодом, порядок фаз. Брифы фаз: [dossier.md](./dossier.md) (Ф1), [job-scheduler.md](./job-scheduler.md) (Ф2), [core-ui.md](./core-ui.md) (Ф3), [assembly.md](./assembly.md) (Ф4).

## Границы

**Ф5 — удаление legacy.** Правим: `platform/core/src/{api,domain,infra,legacy-bridge}` (удалить), `platform/core/src/index.ts` (удалить), `platform/core/src/shared/{iso-now.ts,iso-now.test.ts,index.ts,now.test.ts}`; `platform/app-legacy/` (удалить каталог целиком); `package.json` — `platform/core`, `platform/app`, `runners/u7-bot`, `modules/{peer-review,wish,stream}`; корневые `tsconfig.json` (paths), `biome.json`, `README.md`; `scripts/domain-check.ts` и тесты `scripts/domain-check.test.ts`; `bun install`.
Не трогаем: `platform/core/src/{ui,shared}` (кроме перечисленного), `domain/`, код модулей, `data/`, `conductor/` (Ф7).

**Ф6 — `u7-cli` → `dmg-cli`.** Правим: `runners/u7-cli/` (удалить), новый репо `~/dev/tools/dmg/dmg-cli` (вне u7-school: `git init`, `src/` без `package.json` и `node_modules`, `README.md`, первый коммит); `scripts/{arch-check,domain-arch,domain-check}.test.ts` (строки `@u7-scl/cli`, `runners/u7-cli`), `scripts/call-uc.ts` (комментарий `:3`), корневой `README.md` (строки об `u7-cli`), `conductor/architecture/debt.md` (DEBT-42), `conductor/roadmap.md` (кандидат `dmg-cli`) — два последних Opus.

## Решения брифа

1. **Порядок: Ф6 — до Ф3.** `runners/u7-cli` компилируется корневым `tsc` и использует legacy: `ApiApp<U7BotAppMeta>`, `app.getModules()`, `UcDocType` из `core/api`, `TEST_SCHOOL` из `app-legacy` (`cli-controller.ts:6, 84, 99`, `main.ts:2`). Любая из Ф3 (`U7App.apiApp` — dmg `ApiApp`), Ф4 (`U7BotAppMeta` удалён), Ф5 (`core/api` удалён) делает `tsc` красным. План разрешает Ф6 «параллельно Ф3–Ф5» — это нарушает «`check` зелёный на конце каждой фазы» (spec, нефункциональные требования). Рекомендуемый порядок: **Ф0 → Ф1 ‖ Ф2 ‖ Ф6 → Ф3 → Ф4 → Ф5 → Ф7.**
2. **`@u7-scl/core` в конце — `ui` + `shared` (без `iso-now`)** (вопрос С3): `shared` оставляем почти целиком — `console-logger`, `logger`, `now`, `serialize-error`, `string-utility`, `markdown*` используют `app`, бот и `scripts`; «часть `shared`, нужная `ui`» (spec) уже, чем реальные потребители. Остаток — записью в `debt.md` с погашением `dmg-ui` (Ф7).
3. **`core/src/index.ts` удаляется** (161 имя, импортёров нет): `exports` пакета — только `./ui`, `./shared`; поле `module` в `package.json` убирается.
4. **Конфигурация (вне списка плана):** `biome.json` — удалить override `platform/app-legacy/**` (`:514-540`) и исключения `!@u7-scl/core/infra*`, `!@u7-scl/app-legacy/infra*` из ARC-08 для `runners/**` (`:607-610`); без этого критерий spec 1 (`grep … *.json`) не выполнится. `tsconfig.json` — убрать `paths` `@u7-scl/core/domain`, `@u7-scl/core/api`, `@u7-scl/app-legacy`, `@u7-scl/app-legacy/domain` (`:23-24, 41-44`). `platform/core/package.json` — убрать блок `imports` (4 алиаса `#*-legacy/*`) и `exports` `./domain`, `./api`, `./infra`, `./legacy-bridge`. `modules/{peer-review,stream}/package.json` — убрать `#api-legacy/*`, `modules/wish/package.json` — `#infra-legacy/*` (код модулей эти алиасы не использует) и `@u7-scl/app-legacy` во всех трёх; `platform/app`, `runners/u7-bot` — `@u7-scl/app-legacy`. `@u7-scl/core` в `modules/*/package.json` — вне spec, не трогать (мёртвая зависимость, записать в TR).
5. **ARC-02 (`PLATFORM` в `domain-check.ts:25`)** → `/^@u7-scl\/core(\/|$)/`; комментарии «legacy» в `domain-check.ts` (`:124`, `:168`, `:450`) уточнить; тесты — строки `@u7-scl/app-legacy` → `@u7-scl/core` (по плану; см. таблицу «Тесты `scripts/*`»).
6. **`u7-cli` → `dmg-cli`** (spec §5): переносятся 4 файла кода как есть; `about.md` (2), `bunfig.toml`, `package.json`, `tsconfig.json` — не переносятся (`about.md` — legacy-контракт «модуль без `about.md` не стартует», 4 строки приветствия). README `dmg-cli`:
   - первая строка: «**Нерабочая заготовка — не собирается, не используется.**»; код — из `u7-school`, коммит `legacy-removal` Ф6;
   - концепция: автоматический текстовый интерфейс к бэку на `dmg-core` без своего UI-кода — модули и UC из графа Def, ввод по схеме входа, вызов через `dispatch`/`dispatchByName` (D-49, D-54), выполнение от чужого имени (подмена `Caller`), одна механика для терминала (CLI) и бота с адаптацией под канал (в боте — кнопки); заменит `scripts/call-uc.ts`;
   - отличие от `dmg-core/cli` (генератор `dmg-core gen`); ссылка на DEBT-42 и на этот трек.
   `git init` без удалённого репозитория; ветка — как по умолчанию в окружении.
7. **DEBT-42 — переформулировать в том же шаге, что и удаление** (до гейта): `checkDebt` краснеет, когда glob Места `runners/u7-cli/src/main.ts` не находит файла. Новое Место — `scripts/call-uc.ts`; причина — `u7-cli` вынесен в заготовку `dmg-cli`, `call-uc` остаётся; Корень — `scripts/**`. Запись не закрывается (spec §5).

## Шаги

### Ф6 (идёт раньше Ф3)
1. **Opus:** `~/dev/tools/dmg/dmg-cli` — `git init`, перенос `src/` (4 файла), `README.md` (п. 6), первый коммит.
2. **Opus:** DEBT-42 переформулировать; `conductor/roadmap.md` — кандидат «`dmg-cli`» со ссылкой на README (`~/dev/tools/dmg/dmg-cli/README.md`).
3. **`migrator` (flash):** удалить `runners/u7-cli`; правки `scripts/domain-arch.test.ts:27` (раннеры — только `u7-bot`), `scripts/arch-check.test.ts:40` (`assemblyPackages` → `['@u7-scl/app', '@u7-scl/bot']`), `scripts/domain-check.test.ts` (5 фикстур-строк `@u7-scl/cli`), `scripts/call-uc.ts:3`, корневой `README.md` (`:40`, `:182-190`); `bun install`. Механика, красный тест — `domain-arch.test.ts`/`arch-check.test.ts` (правит migrator по тайпчеку/падению; `dmg-test-designer` не нужен: поведение — «пакета нет»). Отдельной строкой: «правки `arch-check.test.ts`/`domain-arch.test.ts` — это не ослабление: ожидание отражает удаление пакета».
4. **Гейт**, `dmg-reviewer` (Opus).

### Ф5 (после Ф4)
1. **`migrator` (flash):** удалить по таблице; правки конфигурации (п. 4); `domain-check.ts` (п. 5) и строки в тестах; `bun install`. Для flash — grep-критерии ниже; каждое поручение «правка старых тестов» — отдельной строкой (строки `app-legacy` в `domain-check.test.ts`, `shared/now.test.ts`).
2. **Opus (orchestrator):** список удалённых тестов в `summary.md` (из раздела «Тесты» ниже) и сверка числа с базой Ф0.
3. **`dmg-reviewer` (Opus).**


## Раскладка «файл → куда / удалить»

Сверка: строк **136** = 77 (`inventory.md` §1: `platform/core/src` 66 + `platform/app-legacy/src` 6 + `platform/app/src` 5) + 50 (§2: тесты) + 9 (§3.1: `runners/u7-cli`, 4 файла кода и 5 прочих). «Фаза» — когда файл меняется/переезжает; «Ф3, Ф5» — замена потребителей в Ф3, удаление в Ф5. «Остаётся» без правок — `—`.

| № | Файл | Вид | `test()` | Куда / удалить | Фаза | Бриф |
|--:|---|---|--:|---|---|---|
| 1 | `platform/app-legacy/src/domain/api.ts` | src | — | Удалить. `U7AppResolver` → явный тип в `platform/app/src/u7-app.types.ts`; `U7ApiApp` не нужен | Ф4 | assembly |
| 2 | `platform/app-legacy/src/domain/index.ts` | src | — | Удалить (barrel; потребители переведены в Ф4) | Ф4 | assembly |
| 3 | `platform/app-legacy/src/domain/school.ts` | src | — | → `platform/app/src/school/school.ts` (git mv) | Ф4 | assembly |
| 4 | `platform/app-legacy/src/index.ts` | src | — | Удалить (barrel) | Ф4 | assembly |
| 5 | `platform/app-legacy/src/infra/logger/composite-logger.ts` | src | — | → `runners/u7-bot/src/infra/logger/composite-logger.ts` (git mv) | Ф4 | assembly |
| 6 | `platform/app-legacy/src/infra/logger/index.ts` | src | — | Удалить; `export { CompositeLogger }` — в `runners/u7-bot/src/infra/logger/index.ts` | Ф4 | assembly |
| 7 | `platform/app/src/index.ts` | src | — | Правка экспортов: + `School`, `createSchool`, `TEST_SCHOOL`, `U7_SCHOOL_ID`, `FileReplayStore`, тип `U7AppResolver`; − `U7BotApp`, `U7BotAppMeta` | Ф4 | assembly |
| 8 | `platform/app/src/u7-app-meta.ts` | src | — | Удалить (legacy-мета не нужна после Ф3) | Ф4 | assembly |
| 9 | `platform/app/src/u7-app.ts` | src | — | Правка: фабрика `dossier` (Ф1); `eventBus` = шина DMG (Ф3, вариант A); сборка без legacy (Ф4) | Ф1, Ф3, Ф4 | dossier, core-ui, assembly |
| 10 | `platform/app/src/u7-app.types.ts` | src | — | Правка: + явный тип `U7AppResolver` | Ф4 | assembly |
| 11 | `platform/app/src/u7-caller-resolver.ts` | src | — | Остаётся без изменений (уже на dmg `ApiApp`) | — | assembly |
| 12 | `platform/core/src/api/app/api-app.ts` | src | — | Удалить. `dispatch`/`runJob` — в dmg `ApiApp`; `init`/`start`/`stop` — в `U7App` (Ф4) | Ф5 | removal |
| 13 | `platform/core/src/api/app/app.ts` | src | — | Удалить | Ф5 | removal |
| 14 | `platform/core/src/api/er/event-reaction.ts` | src | — | Удалить | Ф5 | removal |
| 15 | `platform/core/src/api/index.ts` | src | — | Удалить | Ф5 | removal |
| 16 | `platform/core/src/api/job/job-executor.ts` | src | — | Удалить. порт не переносится (прогон — `ApiApp.runJob`; воркер — вне объёма) | Ф5 | removal |
| 17 | `platform/core/src/api/job/job-scheduler.ts` | src | — | Порт → `dmg-core` `src/app/job/job-scheduler.ts` (Ф2, новый вход — `AnyJobDef`); здесь удалить | Ф2, Ф5 | job-scheduler, removal |
| 18 | `platform/core/src/api/job/job.ts` | src | — | Удалить. `JobSchedule` уже есть в `dmg-core` (Def Job) | Ф5 | removal |
| 19 | `platform/core/src/api/module/api-module.ts` | src | — | Удалить | Ф5 | removal |
| 20 | `platform/core/src/api/uc/use-case.ts` | src | — | Удалить | Ф5 | removal |
| 21 | `platform/core/src/domain/ar/aggregate.ts` | src | — | Удалить | Ф5 | removal |
| 22 | `platform/core/src/domain/common/file-metadata.ts` | src | — | Удалить. потребителей нет | Ф5 | removal |
| 23 | `platform/core/src/domain/common/notify-kind.ts` | src | — | Тип `NotifyKind` → `ui/bot/types.ts` (Ф3); `NOTIFY_KINDS`/`NotifyKindSchema` — удалить (потребителей нет); файл удалить | Ф3, Ф5 | core-ui, removal |
| 24 | `platform/core/src/domain/errors/error-helpers.ts` | src | — | `fromError` → локальный разбор `unknown` в `bot-ui-story.ts`/`bot-controller.ts` (Ф3); файл удалить | Ф3, Ф5 | core-ui, removal |
| 25 | `platform/core/src/domain/errors/errors.ts` | src | — | `AppException` исчезает из `ui`/`serialize-error` (Ф3); файл удалить | Ф3, Ф5 | core-ui, removal |
| 26 | `platform/core/src/domain/events/domain-event.ts` | src | — | Заменён конвертом DMG `EventEnvelope`/`EnvelopeOf` (Ф3); файл удалить | Ф3, Ф5 | core-ui, removal |
| 27 | `platform/core/src/domain/events/event-bus.ts` | src | — | Заменён `EventBus` из `dmg-core/app` (Ф3); файл удалить | Ф3, Ф5 | core-ui, removal |
| 28 | `platform/core/src/domain/events/index.ts` | src | — | Удалить | Ф5 | removal |
| 29 | `platform/core/src/domain/index.ts` | src | — | Удалить. `AppEnvMode` в `runners/u7-bot/src/config.ts` → `AppMode` из `dmg-core/app` (Ф3) | Ф5 | removal |
| 30 | `platform/core/src/domain/types.ts` | src | — | Удалить. `AppMeta`/`AppResolver`/`ModuleResolver` — legacy | Ф5 | removal |
| 31 | `platform/core/src/index.ts` | src | — | Удалить. barrel без импортёров; убрать поле `module` в `package.json` | Ф5 | removal |
| 32 | `platform/core/src/infra/base-json-db.ts` | src | — | Удалить. `JsonFileRepo` переезжает без `BaseJsonDb` | Ф5 | removal |
| 33 | `platform/core/src/infra/file-replay-store.ts` | src | — | → `platform/app/src/infra/file-replay-store.ts` (git mv) | Ф4 | assembly |
| 34 | `platform/core/src/infra/in-proc-event-bus.ts` | src | — | Заменён `InProcEventBus` из `dmg-core/app` (тестовые помощники — Ф3, `U7App` — Ф4); файл удалить | Ф4, Ф5 | assembly, removal |
| 35 | `platform/core/src/infra/in-proc-job-executor.ts` | src | — | Не переносится (порт `JobExecutor` не входит в пакет); файл удалить | Ф5 | removal |
| 36 | `platform/core/src/infra/in-proc-job-scheduler.ts` | src | — | → `dmg-core` `src/app/job/in-proc-job-scheduler.ts` (переписан под `AnyJobDef`/`Clock`); здесь удалить | Ф2, Ф5 | job-scheduler, removal |
| 37 | `platform/core/src/infra/index.ts` | src | — | Удалить | Ф5 | removal |
| 38 | `platform/core/src/infra/job-run-json-repo.ts` | src | — | → `platform/app/src/infra/job-run-json-repo.ts` (git mv; реализует порт пакета, формат файла — ISO-строки — не меняется) | Ф4 | assembly |
| 39 | `platform/core/src/infra/job-run-repo.ts` | src | — | → `dmg-core` `src/app/job/job-run-repo.ts` (порт `JobRunRepo` + `MemoryJobRunRepo`); здесь удалить | Ф2, Ф5 | job-scheduler, removal |
| 40 | `platform/core/src/infra/job-schedule-planner.ts` | src | — | → `dmg-core` `src/app/job/job-schedule-planner.ts`; здесь удалить | Ф2, Ф5 | job-scheduler, removal |
| 41 | `platform/core/src/infra/json-file-repo.ts` | src | — | → `runners/u7-bot/src/infra/json-file-repo.ts` (без `BaseJsonDb`, `isoNow` → локальный штамп) | Ф4 | assembly |
| 42 | `platform/core/src/infra/scheduled-job-runner.ts` | src | — | → `dmg-core` `src/app/job/scheduled-job-runner.ts` (часы — `Clock`); здесь удалить | Ф2, Ф5 | job-scheduler, removal |
| 43 | `platform/core/src/legacy-bridge/index.ts` | src | — | Удалить | Ф5 | removal |
| 44 | `platform/core/src/legacy-bridge/legacy-clock.ts` | src | — | Удалить. часы корня сборки — `() => now().getTime()` в `U7App` (Ф4) | Ф5 | removal |
| 45 | `platform/core/src/legacy-bridge/legacy-event-bus.ts` | src | — | Удалить. шина DMG `InProcEventBus` в `U7App` (Ф4) | Ф5 | removal |
| 46 | `platform/core/src/legacy-bridge/legacy-job.ts` | src | — | Удалить. задания — планировщик пакета (Ф2, Ф4) | Ф5 | removal |
| 47 | `platform/core/src/shared/console-logger.ts` | src | — | Остаётся (`@u7-scl/core/shared`) | — | core-ui |
| 48 | `platform/core/src/shared/index.ts` | src | — | Правка: − `isoNow` | Ф5 | removal |
| 49 | `platform/core/src/shared/iso-now.ts` | src | — | Удалить. потребители (`Aggregate`, `JsonFileRepo`) уходят | Ф5 | removal |
| 50 | `platform/core/src/shared/logger.ts` | src | — | Остаётся | — | core-ui |
| 51 | `platform/core/src/shared/markdown-validator.ts` | src | — | Остаётся (нужен `ui/bot/response-assert`) | — | core-ui |
| 52 | `platform/core/src/shared/markdown.ts` | src | — | Остаётся | — | core-ui |
| 53 | `platform/core/src/shared/now.ts` | src | — | Остаётся (точка заморозки времени, `spyOn(Shared, now)`) | — | core-ui |
| 54 | `platform/core/src/shared/serialize-error.ts` | src | — | Правка: убрать ветку `AppException` | Ф3 | core-ui |
| 55 | `platform/core/src/shared/string-utility.ts` | src | — | Остаётся (нужен `ui/content-nav/presenter`) | — | core-ui |
| 56 | `platform/core/src/ui/bot/app-types.ts` | src | — | Правка: `BotUiAppResolve` без `TAppMeta`; `appApi` — тип `ApiApp` из `dmg-core/app` | Ф3 | core-ui |
| 57 | `platform/core/src/ui/bot/bot-controller.ts` | src | — | Правка: без `TAppMeta`; `handleError` — локальный разбор `unknown`; `#*-legacy` → относительные импорты | Ф3 | core-ui |
| 58 | `platform/core/src/ui/bot/bot-request-context.ts` | src | — | Остаётся без изменений | — | core-ui |
| 59 | `platform/core/src/ui/bot/bot-session-repo.ts` | src | — | Остаётся без изменений | — | core-ui |
| 60 | `platform/core/src/ui/bot/bot-ui-story.ts` | src | — | Правка: без `TAppMeta`; `handleError`/`errorNotify` — локальный разбор `unknown`; `#*-legacy` → относительные импорты | Ф3 | core-ui |
| 61 | `platform/core/src/ui/bot/dialog-cache.ts` | src | — | Остаётся без изменений | — | core-ui |
| 62 | `platform/core/src/ui/bot/page-nav.ts` | src | — | Остаётся без изменений | — | core-ui |
| 63 | `platform/core/src/ui/bot/response-assert.ts` | src | — | Остаётся без изменений | — | core-ui |
| 64 | `platform/core/src/ui/bot/response-builders.ts` | src | — | Остаётся без изменений | — | core-ui |
| 65 | `platform/core/src/ui/bot/types.ts` | src | — | Правка: `NotifyKind` объявляется здесь | Ф3 | core-ui |
| 66 | `platform/core/src/ui/bot/ui-app.ts` | src | — | Правка: без `TAppMeta` | Ф3 | core-ui |
| 67 | `platform/core/src/ui/content-nav/index.ts` | src | — | Остаётся без изменений | — | core-ui |
| 68 | `platform/core/src/ui/content-nav/presenter.ts` | src | — | Остаётся без изменений | — | core-ui |
| 69 | `platform/core/src/ui/content-nav/step-render.ts` | src | — | Остаётся без изменений | — | core-ui |
| 70 | `platform/core/src/ui/content-nav/types.ts` | src | — | Остаётся без изменений | — | core-ui |
| 71 | `platform/core/src/ui/event-subscription.ts` | src | — | Правка: `UiEventSubscription`/`eventSubscription` по Def: `{ def, handle(EnvelopeOf<D>) }` | Ф3 | core-ui |
| 72 | `platform/core/src/ui/index.ts` | src | — | Правка: экспорт по итогам правок | Ф3 | core-ui |
| 73 | `platform/core/src/ui/pagination/paginator.ts` | src | — | Остаётся без изменений | — | core-ui |
| 74 | `platform/core/src/ui/types.ts` | src | — | Правка: `UiAppResolve.eventBus` — `EventBus` из `dmg-core/app` | Ф3 | core-ui |
| 75 | `platform/core/src/ui/ui-app.ts` | src | — | Правка: `subscribeEvents` — `eventBus.subscribe(subscription.def, subscription.handle)` | Ф3 | core-ui |
| 76 | `platform/core/src/ui/ui-controller.ts` | src | — | Правка: по тайпчеку (тип `UiEventSubscription`); возможно без изменений | Ф3 | core-ui |
| 77 | `platform/core/src/ui/ui-story.ts` | src | — | Правка: по тайпчеку (тип `UiEventSubscription`); возможно без изменений | Ф3 | core-ui |
| 78 | `platform/app-legacy/src/dmg-core.smoke.test.ts` | test | 1 | Удалить: проверяет только импорт пакета `dmg-core`, кода проекта нет | Ф5 | removal |
| 79 | `platform/app-legacy/src/domain/school.test.ts` | test | 9 | Перенос → `platform/app/src/school/school.test.ts` (git mv) | Ф4 | assembly |
| 80 | `platform/app/src/u7-caller-resolver.test.ts` | test | 11 | Остаётся; правка по тайпчеку при смене типов `U7App` | Ф4 | assembly |
| 81 | `platform/app/tests/u7-app.student.test.ts` | test | 3 | Остаётся; правка по тайпчеку | Ф4 | assembly |
| 82 | `platform/app/tests/u7-app.test.ts` | test | 11 | Остаётся; переписать 3 теста (legacy `getModule`, `appResolver`, повторный `init`); + тест `dossier` в графе (Ф1) | Ф1, Ф4 | dossier, assembly |
| 83 | `platform/core/src/api/app/api-app-dmg.test.ts` | test | 10 | Удалить: оболочка `withDmg` исчезает; `dispatch`/`runJob` покрыты `dmg-core/src/app/api-app/api-app.test.ts` | Ф5 | removal |
| 84 | `platform/core/src/api/app/api-app.test.ts` | test | 8 | Удалить: legacy `ApiApp` | Ф5 | removal |
| 85 | `platform/core/src/api/er/event-reaction.test.ts` | test | 6 | Удалить: legacy `EventReaction` | Ф5 | removal |
| 86 | `platform/core/src/api/job/job.test.ts` | test | 8 | Удалить: legacy `Job` | Ф5 | removal |
| 87 | `platform/core/src/api/module/api-module.test.ts` | test | 14 | Удалить: legacy `ApiModule` | Ф5 | removal |
| 88 | `platform/core/src/api/uc/use-case-auth.test.ts` | test | 5 | Удалить: legacy `UseCase` | Ф5 | removal |
| 89 | `platform/core/src/api/uc/use-case-output.test.ts` | test | 3 | Удалить: legacy `UseCase` | Ф5 | removal |
| 90 | `platform/core/src/api/uc/use-case-publish-events.test.ts` | test | 3 | Удалить: legacy `UseCase` | Ф5 | removal |
| 91 | `platform/core/src/api/uc/use-case.test.ts` | test | 5 | Удалить: legacy `UseCase` | Ф5 | removal |
| 92 | `platform/core/src/domain/ar/aggregate.test.ts` | test | 13 | Удалить: legacy `Aggregate` | Ф5 | removal |
| 93 | `platform/core/src/domain/common/file-metadata.test.ts` | test | 6 | Удалить вместе с `file-metadata.ts` | Ф5 | removal |
| 94 | `platform/core/src/domain/errors/error-helpers.test.ts` | test | 9 | Удалить: `throw*`/`err*` legacy | Ф5 | removal |
| 95 | `platform/core/src/domain/errors/errors.test.ts` | test | 3 | Удалить: `AppError`/`AppException` | Ф5 | removal |
| 96 | `platform/core/src/domain/types.test.ts` | test | 4 | Удалить: legacy `ModuleResolver` | Ф5 | removal |
| 97 | `platform/core/src/infra/base-json-db.test.ts` | test | 5 | Удалить вместе с `BaseJsonDb` | Ф5 | removal |
| 98 | `platform/core/src/infra/file-replay-store.test.ts` | test | 14 | Перенос → `platform/app/src/infra/file-replay-store.test.ts` (git mv) | Ф4 | assembly |
| 99 | `platform/core/src/infra/in-proc-event-bus.test.ts` | test | 9 | Удалить: legacy-шина; шина DMG покрыта `dmg-core/src/app/events/in-proc-event-bus.test.ts` | Ф5 | removal |
| 100 | `platform/core/src/infra/in-proc-job-scheduler.test.ts` | test | 8 | Разделить: 3 `InProcJobScheduler` → `dmg-core` (Ф2); 2 `InProcJobExecutor` — удалить; 3 `JobRunJsonRepo` → `platform/app/src/infra/job-run-json-repo.test.ts` (Ф4) | Ф2, Ф4 | job-scheduler, assembly |
| 101 | `platform/core/src/infra/job-schedule-planner.test.ts` | test | 16 | Перенос → `dmg-core` `src/app/job/job-schedule-planner.test.ts` | Ф2 | job-scheduler |
| 102 | `platform/core/src/infra/json-file-repo.test.ts` | test | 13 | Перенос → `runners/u7-bot/src/infra/json-file-repo.test.ts` (git mv) | Ф4 | assembly |
| 103 | `platform/core/src/infra/scheduled-job-runner.test.ts` | test | 11 | Перенос → `dmg-core` `src/app/job/scheduled-job-runner.test.ts` (часы — `Clock`) | Ф2 | job-scheduler |
| 104 | `platform/core/src/legacy-bridge/example-app.test.ts` | test | 8 | Удалить: legacy `ApiApp` над учебным приложением пакета; сценарии покрыты `dmg-core` | Ф5 | removal |
| 105 | `platform/core/src/legacy-bridge/legacy-clock.test.ts` | test | 1 | Удалить; заменить тестом «часы `U7App` следуют `now()`» (новый, `platform/app/tests`) | Ф4, Ф5 | assembly, removal |
| 106 | `platform/core/src/legacy-bridge/legacy-event-bus.test.ts` | test | 12 | Удалить: мост шин | Ф5 | removal |
| 107 | `platform/core/src/legacy-bridge/legacy-job.test.ts` | test | 4 | Удалить: мост заданий | Ф5 | removal |
| 108 | `platform/core/src/shared/console-logger.test.ts` | test | 2 | Остаётся | — | core-ui |
| 109 | `platform/core/src/shared/iso-now.test.ts` | test | 3 | Удалить вместе с `isoNow` | Ф5 | removal |
| 110 | `platform/core/src/shared/markdown-validator.test.ts` | test | 37 | Остаётся | — | core-ui |
| 111 | `platform/core/src/shared/markdown.test.ts` | test | 32 | Остаётся | — | core-ui |
| 112 | `platform/core/src/shared/now.test.ts` | test | 1 | Правка: убрать проверку `isoNow` (останется заморозка `now()`) | Ф5 | removal |
| 113 | `platform/core/src/shared/string-utility.test.ts` | test | 22 | Остаётся | — | core-ui |
| 114 | `platform/core/src/ui/bot/bot-controller.test.ts` | test | 25 | Правка: типы, `AppException`-кейсы `handleError` (см. core-ui) | Ф3 | core-ui |
| 115 | `platform/core/src/ui/bot/bot-request-context.test.ts` | test | 6 | Остаётся | — | core-ui |
| 116 | `platform/core/src/ui/bot/bot-ui-story.test.ts` | test | 27 | Правка: типы; `AppException`-кейсы `handleError`/`errorNotify` удалить (см. core-ui) | Ф3 | core-ui |
| 117 | `platform/core/src/ui/bot/dialog-cache.test.ts` | test | 11 | Правка по тайпчеку (мок `ApiApp`/шины) | Ф3 | core-ui |
| 118 | `platform/core/src/ui/bot/page-nav.test.ts` | test | 12 | Остаётся | — | core-ui |
| 119 | `platform/core/src/ui/bot/response-assert.test.ts` | test | 5 | Остаётся | — | core-ui |
| 120 | `platform/core/src/ui/bot/response-builders.test.ts` | test | 15 | Остаётся | — | core-ui |
| 121 | `platform/core/src/ui/bot/types.test.ts` | test | 4 | Остаётся | — | core-ui |
| 122 | `platform/core/src/ui/bot/ui-app.test.ts` | test | 30 | Правка по тайпчеку (мок `ApiApp`/шины) | Ф3 | core-ui |
| 123 | `platform/core/src/ui/content-nav/nav-level.test.ts` | test | 5 | Остаётся | — | core-ui |
| 124 | `platform/core/src/ui/content-nav/presenter.test.ts` | test | 14 | Остаётся | — | core-ui |
| 125 | `platform/core/src/ui/pagination/paginator.test.ts` | test | 11 | Остаётся | — | core-ui |
| 126 | `platform/core/src/ui/ui-app.test.ts` | test | 9 | Переписать подписки на конверты DMG (`def`, `occurredAt` числом) | Ф3 | core-ui |
| 127 | `platform/core/src/ui/ui-controller.test.ts` | test | 3 | Переписать подписки на конверты DMG | Ф3 | core-ui |
| 128 | `runners/u7-cli/about.md` | прочее | — | Удалить (требование `about.md` — legacy-контракт; 4 строки приветствия) | Ф6 | removal |
| 129 | `runners/u7-cli/bunfig.toml` | прочее | — | Удалить (конфиг пакета, не код) | Ф6 | removal |
| 130 | `runners/u7-cli/demo-module/about.md` | прочее | — | Удалить (то же) | Ф6 | removal |
| 131 | `runners/u7-cli/package.json` | прочее | — | Удалить (в `dmg-cli` не переносится) | Ф6 | removal |
| 132 | `runners/u7-cli/src/cli-controller.ts` | src | — | → `~/dev/tools/dmg/dmg-cli/src/cli-controller.ts` (как есть, заготовка) | Ф6 | removal |
| 133 | `runners/u7-cli/src/controller/command-parser.ts` | src | — | → `dmg-cli/src/controller/command-parser.ts` | Ф6 | removal |
| 134 | `runners/u7-cli/src/controller/format-valibot-errors.ts` | src | — | → `dmg-cli/src/controller/format-valibot-errors.ts` | Ф6 | removal |
| 135 | `runners/u7-cli/src/main.ts` | src | — | → `dmg-cli/src/main.ts` | Ф6 | removal |
| 136 | `runners/u7-cli/tsconfig.json` | прочее | — | Удалить (конфиг пакета) | Ф6 | removal |

### Конфигурация и прочее (вне §1–§3 `inventory.md`)

| Файл | Что | Фаза | Бриф |
|---|---|---|---|
| `platform/app-legacy/{package.json,bunfig.toml,tsconfig.json}` | удалить вместе с каталогом | Ф5 | removal |
| `platform/core/package.json` | `exports` → `./ui`, `./shared`; убрать `imports` (`#*-legacy/*`), поле `module` | Ф5 | removal |
| `tsconfig.json` (корень) | убрать `paths`: `core/domain`, `core/api`, `app-legacy`, `app-legacy/domain` | Ф5 | removal |
| `biome.json` | удалить override `platform/app-legacy/**`; убрать `!@u7-scl/core/infra*`, `!@u7-scl/app-legacy/infra*` из ARC-08 | Ф5 | removal |
| `platform/app/package.json`, `runners/u7-bot/package.json` | убрать `@u7-scl/app-legacy` | Ф5 | removal |
| `modules/{peer-review,stream,wish}/package.json` | убрать `@u7-scl/app-legacy`, блок `imports` (`#api-legacy/*`, `#infra-legacy/*`) | Ф5 | removal |
| `modules/dossier/package.json`, `platform/app/package.json` | + `dmg-core`, + `@u7-scl/dossier` (workspace) | Ф1 | dossier |
| `scripts/{_course-client,call-uc,migrate-streams-school-id}.ts`, `migrate-streams-school-id.test.ts` | импорты `School`/`TEST_SCHOOL`/`U7_SCHOOL_ID` из `@u7-scl/app` | Ф4 | assembly |
| `scripts/domain-check.ts` | Ф1: `sub !== 'index'` ×2, `DomainModules.dmg`; Ф5: `PLATFORM` → `core` | Ф1, Ф5 | dossier, removal |
| `README.md` (корень) | `:28` строка `app-legacy` (Ф5); `:40`, `:182-190` — `u7-cli` (Ф6) | Ф5, Ф6 | removal |
| `conductor/**`, `.agents-core/`, `.pi/skills/*`, `AGENTS.md` | ссылки на `legacy.md`, `app-legacy`, `u7-cli` — по Ф7 | Ф7 | вне брифов |
| `bun.lock` | регенерируется `bun install` (Ф1, Ф5, Ф6) | Ф1, Ф5, Ф6 | — |
| `CHANGELOG.md:15` | история, не править | — | — |

## Тесты

Счёт — `test()`/`it()` по `inventory.md` §2 (без `test.each`; фактическое число кейсов bun выше). Сумма по 50 файлам: **507**.

### На перенос (TST-08: переезжают, не копируются) — 5 файлов, 63 `test()` (+ части одного файла)

- `platform/app-legacy/src/domain/school.test.ts` (9) → `platform/app/src/school/` (Ф4)
- `platform/core/src/infra/file-replay-store.test.ts` (14) → `platform/app/src/infra/` (Ф4)
- `platform/core/src/infra/json-file-repo.test.ts` (13) → `runners/u7-bot/src/infra/` (Ф4)
- `platform/core/src/infra/job-schedule-planner.test.ts` (16) → `dmg-core` (Ф2)
- `platform/core/src/infra/scheduled-job-runner.test.ts` (11) → `dmg-core` (Ф2)
- `platform/core/src/infra/in-proc-job-scheduler.test.ts` (8) делится: 3 `InProcJobScheduler` → `dmg-core` (Ф2); 3 `JobRunJsonRepo` → `platform/app/src/infra/` (Ф4); 2 `InProcJobExecutor` — удаляются.
- В `dmg-core` уходит 16 + 11 + 3 = **30** `test()`: в u7-school они пропадают в Ф5 (старые файлы удаляются) — в сверке с базой Ф0 учитывать отдельной строкой «перенесено в `dmg-core`». До Ф5 копии в двух репо живут одновременно (старый код ещё работает).

### На удаление вместе с legacy-кодом — 22 файла, 140 `test()` (+ 2 из `in-proc-job-scheduler.test.ts`)

| Файл | `test()` | Где покрыто |
|---|--:|---|
| `platform/app-legacy/src/dmg-core.smoke.test.ts` | 1 | нет кода проекта (импорт пакета) |
| `platform/core/src/api/app/api-app-dmg.test.ts` | 10 | `dmg-core/src/app/api-app/api-app.test.ts` (`dispatch`, `runJob`) |
| `platform/core/src/api/app/api-app.test.ts` | 8 | legacy-оболочка; UC/ER/Job — тесты модулей |
| `platform/core/src/api/er/event-reaction.test.ts` | 6 | `dmg-core` (`ReactionFromDef`) |
| `platform/core/src/api/job/job.test.ts` | 8 | `dmg-core` (`job-from-def.test.ts`) |
| `platform/core/src/api/module/api-module.test.ts` | 14 | `dmg-core` (`module-from-def.test.ts`) |
| `platform/core/src/api/uc/use-case-auth.test.ts` | 5 | `dmg-core` (Policy/`UseCaseFromDef`) |
| `platform/core/src/api/uc/use-case-output.test.ts` | 3 | то же |
| `platform/core/src/api/uc/use-case-publish-events.test.ts` | 3 | `dmg-core` (UoW, outbox) |
| `platform/core/src/api/uc/use-case.test.ts` | 5 | то же |
| `platform/core/src/domain/ar/aggregate.test.ts` | 13 | `dmg-core` (`AggregateRoot`) и тесты Ar модулей |
| `platform/core/src/domain/common/file-metadata.test.ts` | 6 | потребителей нет |
| `platform/core/src/domain/errors/error-helpers.test.ts` | 9 | `dmg-core` (`Result`, `CoreErrors`) |
| `platform/core/src/domain/errors/errors.test.ts` | 3 | то же |
| `platform/core/src/domain/types.test.ts` | 4 | legacy-типы |
| `platform/core/src/infra/base-json-db.test.ts` | 5 | `BaseJsonDb` не нужен |
| `platform/core/src/infra/in-proc-event-bus.test.ts` | 9 | `dmg-core/src/app/events/in-proc-event-bus.test.ts` |
| `platform/core/src/legacy-bridge/example-app.test.ts` | 8 | `dmg-core` (учебное приложение) |
| `platform/core/src/legacy-bridge/legacy-clock.test.ts` | 1 | новый тест «часы `U7App` следуют `now()`» (Ф4) |
| `platform/core/src/legacy-bridge/legacy-event-bus.test.ts` | 12 | мост удалён; доставка — `dmg-core` |
| `platform/core/src/legacy-bridge/legacy-job.test.ts` | 4 | мост удалён; задания — `dmg-core` (Ф2) |
| `platform/core/src/shared/iso-now.test.ts` | 3 | `isoNow` удалён |

Плюс удаляются вызовы `test()` по ветке `AppException` (Ф3, [core-ui.md](./core-ui.md)): `bot-ui-story.test.ts` 6, `u7-bot-ui-story.test.ts` 10, `bot-controller.test.ts` 1 = **17**. Итого вне переноса удаляется **140 + 2 + 17 = 159** вызовов `test()`; в `dmg-core` уходит 30; новых в u7-school: `dossier.module.test` (1–2), `job-run-json-repo.test` (+2), `u7-app.test` (+2).

### Правка без смены числа

`platform/app/src/u7-caller-resolver.test.ts` (11), `platform/app/tests/u7-app.student.test.ts` (3), `platform/app/tests/u7-app.test.ts` (11; 3 переписаны), `platform/core/src/shared/now.test.ts` (1; убрать `isoNow`), `ui/bot/{bot-controller (25), bot-ui-story (27), dialog-cache (11), ui-app (30)}.test.ts`, `ui/ui-app.test.ts` (9), `ui/ui-controller.test.ts` (3) — **10 файлов, 131 `test()`**.

### Остаются без изменений — 12 файлов, 165 `test()`

`shared/{console-logger (2), markdown-validator (37), markdown (32), string-utility (22)}.test.ts`; `ui/bot/{bot-request-context (6), page-nav (12), response-assert (5), response-builders (15), types (4)}.test.ts`; `ui/content-nav/{nav-level (5), presenter (14)}.test.ts`; `ui/pagination/paginator.test.ts` (11).

(63 + 8 + 140 + 131 + 165 = 507 — сходится с инвентаризацией.)

### Тесты `scripts/*` (состав модулей и граф) — что меняется по фазам

| Файл (`test()`) | Ф1 | Ф4 | Ф5 | Ф6 |
|---|---|---|---|---|
| `arch-check.test.ts` (6) | граф: `external` пуст, убрать `toContain('dossier')` (`:51-62`) | — | — | `assemblyPackages` → `['@u7-scl/app','@u7-scl/bot']` (`:36-42`, строка `:40`) |
| `domain-check.test.ts` (64) | 3 теста правятся («через index» `:20`, тексты `:44`, `:66`), фикстуры `{all, dmg}` → массив (`:141-152`, `:270-272`); удалить 2: «чужой legacy» (`:298`), «пары legacy-модулей» (`:332`) | — | строки `app-legacy` → `core`: `:105-109`, `:127`, `:171`, `LEGACY` (`:352`), `:540-545` (DEBT-2-фикстура; кандидат в чистку — дубль `arch-check.test.ts`/`runDebtCheck`) | фикстуры `@u7-scl/cli` (`:83, :89, :156, :194, :199`) → другое имя раннера |
| `domain-arch.test.ts` (4) | — | — | — | список раннеров (`:27`) — только `u7-bot` |
| `agent-gate.test.ts` (31) | — | — | — | — (ws-фикстуры, имён пакетов `app-legacy`/`u7-cli` нет) |

Вне границ среза закрепляющих состав тестов нет; `repo-layout.test.ts` (страж старой раскладки монорепо) не затронут.

## Сохраняемое поведение

- Бот, миры, e2e: поведение не меняется (удаляется код без потребителей после Ф3–Ф4); `data/` — не трогается, форматы не меняются; новых npm-зависимостей нет.
- `call-uc` остаётся рабочим ручным входом (DEBT-42): его импорты переведены в Ф4.
- Удалённые legacy-тесты проверяют только удаляемый код; их сценарии не переносятся (список «где покрыто» выше).

## Расхождения spec/plan с кодом

Идут в spec/plan до начала Ф1 (решает orchestrator):

1. **Порядок Ф6 (план «параллельно Ф3–Ф5»)** — `runners/u7-cli` ломает `tsc` корня с Ф3: `cli-controller.ts:6, 84, 99` (legacy `ApiApp`, `getModules()`, `U7BotAppMeta`), `main.ts:2` (`TEST_SCHOOL` из `app-legacy`). Нужно Ф6 до Ф3.
2. **`biome.json` не в плане** — `:514-540` (override `platform/app-legacy/**`), `:607-610` (`@u7-scl/app-legacy/infra`, `@u7-scl/core/infra`); без правки критерий spec 1 (`*.json`) не выполнится и `biome check` ссылается на несуществующий пакет.
3. **Barrel `modules/dossier/src/index.ts`** — spec §2 «удалён», план Ф1 «вход модуля»: файл остаётся входом пакета (`exports['.']`, ARC-07), удаляется реэкспорт домена.
4. **`DomainModules.dmg`** — план называет `arch-check.ts` («`modules.dmg` → `modules.all`, если применимо»); фактически поле объявлено в `domain-check.ts:149-152` и используется в `checkContractImports` (`:173-195`), тесты — `domain-check.test.ts:141-152, :270-272`.
5. **Порядок закрытия долга** — `checkDebt` краснеет, как только признак исчез, а запись открыта: DEBT-3/DEBT-34 закрывать до гейта Ф1 (план ставит после migrator), DEBT-42 — до гейта Ф6.
6. **Ф3: «8 stories»** — подписок 14 в 8 файлах; также типы `questionnaire-events.ts`, помощник `questionnaire-dmg.test-kit.ts` и **4 e2e**, публикующих legacy-форму напрямую в `app.eventBus` (`inactivity.e2e` ×3, `questionnaire-events.e2e`, `questionnaire-ux.e2e`) — в плане нет.
7. **Ф3: `AppException`-тесты** — план называет `u7-bot-ui-story.test`, `bot-ui-story.test`; ещё `platform/core/src/ui/bot/bot-controller.test.ts` (1 удалить, 4 переписать).
8. **Ф3: `@u7-scl/core/domain` в `runners/u7-bot`** — помимо `DomainEvent` (7 stories): `src/config.ts:1` (`AppEnvMode` → `AppMode` из `dmg-core/app`) и `tests/helpers/test-app.ts:3` (`EventBus`).
9. **Ф4: `U7AppResolver`** — spec: «его читает `u7-bot-app-meta`»; там только реэкспорт (`:35`) без потребителей; живые читатели — поле `U7App.appResolver` и `platform/app/tests/u7-app.test.ts:91-92, 144, 149`.
10. **Ф4: тесты `JobRunJsonRepo`** — отдельного файла нет: 3 теста внутри `core/infra/in-proc-job-scheduler.test.ts` (вместе с `InProcJobScheduler` → `dmg-core` и `InProcJobExecutor` → удалить).
11. **Ф4/Ф5: `isoNow`** — потребители `Aggregate` (уходит) и `JsonFileRepo` (`json-file-repo.ts:162`, переезжает в Ф4); `shared/now.test.ts` ссылается на `Shared.isoNow()` — правка теста.
12. **Ф5: «убрать `paths` в `tsconfig`»** — в `paths` только `core/{domain,api,ui,shared}` и `app-legacy*`; `core/infra`/`legacy-bridge` резолвились через `exports` пакета (в `package.json` — убрать).
13. **spec §4 «`#*-legacy/*` внутри `ui` → относительные»** — `ui` импортирует через 4 алиаса, включая `#shared-legacy/*` (`logger`, `markdown`, `serialize-error`) и `#ui-legacy/types`; в `platform/core/package.json` `imports` — все 4.
14. **Ф6/Ф5: тесты `scripts` с `@u7-scl/cli`** — план называет только `domain-arch.test.ts`; ещё `arch-check.test.ts:40` (меняется результат `assemblyPackages`) и 5 фикстур `domain-check.test.ts`.
15. **Критерий spec 2 («только `ui` и используемая часть `shared`»)** — реальные потребители `shared` шире (бот, `app`, `scripts`: `ConsoleLogger`, `now`, `Logger`, `serializeError`…) — вопрос С3.
16. **`@u7-scl/core` в `modules/*/package.json`** — мёртвая зависимость (импортов нет), spec её не называет; предлагается не трогать, записать в TR.
17. **Ф4: `systemClock` (план)** — ломает `spyOn(Shared, 'now')` в `peer-review-smoke.e2e.test.ts:63` и замену `legacy-clock.test` — вопрос С2.
18. **Ф7: ссылки на `u7-cli`** кроме названных: `conductor/architecture/ui/bot-architecture.md`, `conductor/roadmap/{content-management,bot-ui-refactoring}.md`, `conductor/tracks.md`, `conductor/architecture/{migration,deepseek}.md`; `README.md`/`call-uc.ts` — Ф6 (в таблице).

## Порядок и зависимости

Ф0 → (Ф1 ‖ Ф2 ‖ Ф6) → Ф3 → Ф4 → Ф5 → Ф7. Ф2 нужна Ф4; Ф3 нужна Ф4 (шина/`ApiApp`); Ф6 независима от остальных и снимает конфликт `tsc`. Ф1 и Ф2 не пересекаются по файлам (Ф1 — `domain/dossier`, `modules/dossier`, `scripts`; Ф2 — только `dmg-core`) — параллельны. Ф3 при варианте A правит `u7-app.ts` минимально (пересечение с Ф1: фабрика `dossier` — разные строки; Ф1 коммитится первой).

## Открытые вопросы

**Стратегические (рекомендация по умолчанию; autonomous-режим берёт её, если Нурболат не возразит):**
- **С1.** Время публичного порта `JobRunRepo` в `dmg-core` — `Timestamp` (число) вместо ISO; адаптер проекта сохраняет формат файла. Подробно — [job-scheduler.md](./job-scheduler.md).
- **С2.** Часы корня сборки: `() => now().getTime()` из `core/shared` (план — `systemClock` пакета). Рекомендация: `now()`; иначе — `systemClock` + `U7AppPorts.clock`, и тесты замораживают время через порт (правка `peer-review-smoke.e2e.test.ts`, `shared/now.test.ts`).
- **С3.** Остаток `@u7-scl/core/shared` (всё, кроме `iso-now`) вместо «части, нужной `ui`». Рекомендация: оставить, записать в `debt.md` «остаток legacy — уходит с `dmg-ui`» (пакет — кандидат на удаление, spec §4). Альтернатива: перенести `ConsoleLogger`/`now`/`Logger` в `@u7-scl/app` (потребители — `app`, бот, `scripts`) — новая миграция вне spec.

**Тактические (предлагаемое решение):**
- Ф3 без красной зоны (вариант A, [core-ui.md](./core-ui.md) п. 1) — **A**.
- `about.md` `u7-cli` не переносить — **не переносить**.
- `JobExecutor` не переносить в `dmg-core` — **не переносить** (D-71).
- Фикстура `domain-check.test.ts:540` (DEBT-2) — переписать на `core` (по плану); кандидат в чистку — дубль `arch-check.test.ts`.
- Переименование `@u7-scl/cli` в фикстурах `domain-check.test.ts` — на `@u7-scl/tool`.

Кандидаты в чистку тестов (`conductor/roadmap/test-bloat.md`, журнал ведёт orchestrator): `scripts/domain-check.test.ts:540-545` — дублирует `scripts/arch-check.test.ts` («долг вне Места»).

## Правила (ID `rules.md`)

ARC-01 (core не импортирует домен/приложение), ARC-02 (домен — только `dmg-core`/`valibot`; `PLATFORM` → `core`), ARC-04, ARC-06/07/08/10, TST-05 (правки в области задачи), TST-06 (`check` после каждого шага), TST-08 (удалённый → где покрыт), CODE-04, DEBT-учёт проекта (`debt.md`: DEBT-3, DEBT-34, TR-33; остаток legacy).

## Документы

`dmg-core` Ф5/Ф6 не правятся. Проектные (Ф7, вне этого брифа): `conductor/architecture/{legacy (удалить),migration,debt,index,rules,decisions}.md`, `AGENTS.md`, `.agents-core/`, `.pi/skills/*`, `conductor/roadmap/tasks-system-*.md`, `conductor/roadmap.md` (`dmg-cli`).

## Критерии приёмки

**Ф6:**
- `ls runners/u7-cli` — нет; `grep -rn --include='*.ts' --include='*.json' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.cache --exclude-dir=archive --exclude-dir=data --exclude-dir=conductor -e 'u7-cli' -e '@u7-scl/cli' .` — пусто (`conductor/` исключён: `metadata.json` трека описывает `u7-cli`; `CHANGELOG.md` — история, `*.md` не проверяется).
- `ls ~/dev/tools/dmg/dmg-cli/README.md ~/dev/tools/dmg/dmg-cli/src/cli-controller.ts` — есть; `git -C ~/dev/tools/dmg/dmg-cli log --oneline | wc -l` ≥ 1; `ls ~/dev/tools/dmg/dmg-cli/package.json` — нет.
- DEBT-42 в `debt.md`: Место — `scripts/call-uc.ts`; `bun run arch:check` зелёный; кандидат `dmg-cli` в `roadmap.md` ссылается на README.
- `bun run check` зелёный; число тестов в `scripts/` не меняется (6 + 64 + 4 + 31).

**Ф5:**
- `grep -rn --include='*.ts' --include='*.json' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.cache --exclude-dir=archive --exclude-dir=data -e 'app-legacy' -e 'legacy-bridge' -e '-legacy/' .` — пусто (после Ф5 каталога `platform/app-legacy` и `biome.json`/`tsconfig.json`-строк нет; `.md` не проверяются).
- `ls platform/app-legacy` — нет; `ls platform/core/src` — только `shared`, `ui`; `cat platform/core/package.json | grep -c "legacy\|\"./domain\"\|\"./api\"\|\"./infra\""` — 0.
- `grep -rn "class UseCase\|class ApiModule\|class ApiApp\|class Aggregate\|AppError\b" platform/core/src` — пусто.
- `grep -rn "isoNow\|BaseJsonDb\|AppException\|DomainEvent" --include=*.ts platform runners scripts` — пусто.
- `grep -n "app-legacy" biome.json tsconfig.json` — пусто; `grep -n "PLATFORM" scripts/domain-check.ts` — `core` без `app-legacy`.
- `bun run check` зелёный; число тестов: база Ф0 − 159 удалённых − 30 перенесённых в `dmg-core` + новые Ф1–Ф4 (список в `summary.md`; сверка по файлам таблицы).
- `bun run arch:check` зелёный; `bun run test:bot` и e2e не ниже базовой Ф0 с поправкой.
