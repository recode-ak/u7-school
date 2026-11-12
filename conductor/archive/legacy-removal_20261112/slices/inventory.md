# Инвентаризация legacy — трек `legacy-removal_20261112`, Ф0/s0

Сгенерировано скриптом `.cache/legacy-removal/inventory.ts` 2026-11-12. Только факты, без выводов.

## 0. Охват и методика

- Просканировано `*.ts`: **871** (исключены `node_modules`, `data/`, `conductor/archive`, `.git`, `.cache`, `logs`).
- Целевые файлы (без `*.test.ts`): **77** — `platform/core/src` 66, `platform/app-legacy/src` 6, `platform/app/src` 5 (сверено с `find … | wc -l`).
- Тестовые файлы в тех же каталогах + `platform/app/tests`: **50**, в них `test()`/`it()`: **507**.
- Разрешённые формы импорта: относительные пути, `#*-legacy/*` (по `imports` ближайшего `package.json`), `@u7-scl/core/{domain,api,ui,shared,infra,legacy-bridge}`, `@u7-scl/app-legacy[/domain|/infra]`, `@u7-scl/app` (по `exports` пакетов).
- Импорт через barrel (`index.ts`) раскрывается: имя относится к файлу, где оно объявлено, и одновременно к самому barrel.
- «Пакет» = ближайший `package.json`; файлы корневого пакета сгруппированы по первому каталогу (`scripts`, `domain`, …).
- Не разрешено внутренних спецификаторов: **0**.
- `prod` — файлы без `*.test.ts` в имени, `test` — тестовые файлы.

## 1. Файлы платформы

| Файл | Строк | Экспортирует | Импортёры вне пакета (prod/test) | Имена, использованные снаружи | В пакете |
|---|---:|---|---|---|---:|
| `platform/app-legacy/src/domain/api.ts` | 20 | U7AppResolver, U7ApiApp | platform/app (2/0); runners/u7-bot (1/0) | U7ApiApp, U7AppResolver | 1 |
| `platform/app-legacy/src/domain/index.ts` | 12 | U7ApiApp, U7AppResolver, School, createSchool, SchoolSchema, TEST_SCHOOL, U7_SCHOOL_ID, U7_SCHOOL_STATIC | platform/app (3/0); scripts (3/1); runners/u7-bot (4/9); runners/u7-cli (1/0) | School, TEST_SCHOOL, U7ApiApp, U7AppResolver, U7_SCHOOL_ID, createSchool | 1 |
| `platform/app-legacy/src/domain/school.ts` | 118 | U7_SCHOOL_ID, U7_SCHOOL_STATIC, SchoolSchema, School, createSchool, TEST_SCHOOL | platform/app (3/0); scripts (3/1); runners/u7-bot (4/9); runners/u7-cli (1/0) | School, TEST_SCHOOL, U7_SCHOOL_ID, createSchool | 4 |
| `platform/app-legacy/src/index.ts` | 3 | реэкспорт `*` (8 имён, §1.1) | — | — | 0 |
| `platform/app-legacy/src/infra/logger/composite-logger.ts` | 55 | CompositeLogger | runners/u7-bot (1/0) | CompositeLogger | 1 |
| `platform/app-legacy/src/infra/logger/index.ts` | 9 | CompositeLogger | runners/u7-bot (1/0) | CompositeLogger | 0 |
| `platform/app/src/index.ts` | 5 | U7App, U7AppEnv, U7AppPorts, U7BotApp, U7BotAppMeta, U7CallerResolver | scripts (2/0); runners/u7-bot (5/0); runners/u7-cli (2/0) | U7App, U7BotApp, U7BotAppMeta, U7CallerResolver | 0 |
| `platform/app/src/u7-app-meta.ts` | 16 | U7BotAppMeta, U7BotApp | runners/u7-bot (3/0); runners/u7-cli (1/0) | U7BotApp, U7BotAppMeta | 2 |
| `platform/app/src/u7-app.ts` | 263 | U7App | scripts (2/0); runners/u7-bot (3/0); runners/u7-cli (1/0) | U7App | 4 |
| `platform/app/src/u7-app.types.ts` | 29 | U7AppEnv, U7AppPorts | — | — | 4 |
| `platform/app/src/u7-caller-resolver.ts` | 88 | U7CallerResolver | runners/u7-bot (2/0) | U7CallerResolver | 3 |
| `platform/core/src/api/app/api-app.ts` | 183 | ApiApp | platform/app-legacy (1/0); platform/app (1/0); runners/u7-cli (1/0) | ApiApp | 7 |
| `platform/core/src/api/app/app.ts` | 32 | App | — | — | 3 |
| `platform/core/src/api/er/event-reaction.ts` | 76 | ErMeta, ErDocType, EventReaction | — | — | 8 |
| `platform/core/src/api/index.ts` | 13 | ApiApp, App, ErDocType, ErMeta, EventReaction, JobMeta, JobSchedule, Job, JobExecutor, JobScheduler, ApiModule, UcDocType, UcMeta, UseCase | platform/app-legacy (1/0); platform/app (1/0); runners/u7-cli (1/0) | ApiApp, UcDocType | 2 |
| `platform/core/src/api/job/job-executor.ts` | 18 | JobExecutor | — | — | 4 |
| `platform/core/src/api/job/job-scheduler.ts` | 16 | JobScheduler | — | — | 4 |
| `platform/core/src/api/job/job.ts` | 61 | JobSchedule, JobMeta, Job | — | — | 17 |
| `platform/core/src/api/module/api-module.ts` | 141 | ApiModule | — | — | 4 |
| `platform/core/src/api/uc/use-case.ts` | 243 | UcMeta, UcDocType, UseCase | runners/u7-cli (1/0) | UcDocType | 10 |
| `platform/core/src/domain/ar/aggregate.ts` | 168 | ArMeta, Aggregate | — | — | 11 |
| `platform/core/src/domain/common/file-metadata.ts` | 20 | FileMetadataSchema, FileMetadata | — | — | 3 |
| `platform/core/src/domain/common/notify-kind.ts` | 23 | NOTIFY_KINDS, NotifyKind, NotifyKindSchema | — | — | 3 |
| `platform/core/src/domain/errors/error-helpers.ts` | 128 | throwError, fromError, errNotFound, errConflict, errAccessDenied, errBadRequest, errUnauthorized, errValidation, errInternal, errDomain | runners/u7-bot (0/7) | errAccessDenied, errBadRequest, errConflict, errInternal, errNotFound, errUnauthorized, errValidation | 12 |
| `platform/core/src/domain/errors/errors.ts` | 148 | ErrorKind, AppError, ValidationIssues, NotFoundError, ConflictError, AccessDeniedError, BadRequestError, UnauthorizedError, ValidationError, InternalError, DomainError, InputValidationError, OutputValidationError, AuthError, NoCommandFoundError, ServerInternalError, BaseUcErrors, AppException | runners/u7-bot (0/1) | AppException | 22 |
| `platform/core/src/domain/events/domain-event.ts` | 19 | DomainEvent | runners/u7-bot (7/0) | DomainEvent | 20 |
| `platform/core/src/domain/events/event-bus.ts` | 24 | EventBus | platform/app (1/0); runners/u7-bot (1/0) | EventBus | 10 |
| `platform/core/src/domain/events/index.ts` | 3 | DomainEvent, EventBus | — | — | 1 |
| `platform/core/src/domain/index.ts` | 54 | ArMeta, Aggregate, FileMetadata, FileMetadataSchema, NotifyKind, NOTIFY_KINDS, NotifyKindSchema, errAccessDenied, errBadRequest, errConflict, errDomain, errInternal, errNotFound, errUnauthorized, errValidation, fromError, throwError, AccessDeniedError, AppError, AuthError, BadRequestError, BaseUcErrors, ConflictError, DomainError, ErrorKind, InputValidationError, InternalError, NoCommandFoundError, NotFoundError, OutputValidationError, ServerInternalError, UnauthorizedError, ValidationError, ValidationIssues, AppException, DomainEvent, EventBus, ApiExecutor, ApiModuleMeta, AppEnvMode, AppMeta, AppResolver, ExtractUcMetaFromMeta, GetUcNamesFromMeta, ModuleResolver | platform/app-legacy (1/0); platform/app (2/0); runners/u7-bot (9/1) | AppEnvMode, AppException, AppMeta, AppResolver, DomainEvent, EventBus, errAccessDenied, errBadRequest, errConflict, errInternal, errNotFound, errUnauthorized, errValidation | 4 |
| `platform/core/src/domain/types.ts` | 76 | ApiModuleMeta, AppMeta, AppEnvMode, AppResolver, ModuleResolver, GetUcNamesFromMeta, ExtractUcMetaFromMeta, ApiExecutor | platform/app-legacy (2/0); platform/app (1/0); runners/u7-bot (1/0) | AppEnvMode, AppMeta, AppResolver | 27 |
| `platform/core/src/index.ts` | 11 | реэкспорт `*` (161 имён, §1.1) | — | — | 0 |
| `platform/core/src/infra/base-json-db.ts` | 123 | BaseJsonDb | — | — | 3 |
| `platform/core/src/infra/file-replay-store.ts` | 175 | FileReplayStore | runners/u7-bot (1/0) | FileReplayStore | 2 |
| `platform/core/src/infra/in-proc-event-bus.ts` | 67 | InProcEventBus | platform/app (1/0); runners/u7-bot (1/0) | InProcEventBus | 5 |
| `platform/core/src/infra/in-proc-job-executor.ts` | 16 | InProcJobExecutor | — | — | 4 |
| `platform/core/src/infra/in-proc-job-scheduler.ts` | 103 | InProcJobSchedulerDeps, InProcJobScheduler | platform/app (1/1) | InProcJobScheduler | 2 |
| `platform/core/src/infra/index.ts` | 18 | BaseJsonDb, FileReplayStore, InProcEventBus, InProcJobExecutor, InProcJobScheduler, InProcJobSchedulerDeps, JobRunJsonRepo, JobRunRepo, MemoryJobRunRepo, JobSchedulePlanner, JsonFileRepo, JsonFileRepoError, DEFAULT_START_DELAY_MS, ScheduledJobRunner | platform/app (1/1); runners/u7-bot (3/2) | FileReplayStore, InProcEventBus, InProcJobScheduler, JobRunJsonRepo, JsonFileRepo, JsonFileRepoError | 1 |
| `platform/core/src/infra/job-run-json-repo.ts` | 65 | JobRunJsonRepo | platform/app (1/0) | JobRunJsonRepo | 2 |
| `platform/core/src/infra/job-run-repo.ts` | 30 | JobRunRepo, MemoryJobRunRepo | — | — | 7 |
| `platform/core/src/infra/job-schedule-planner.ts` | 105 | JobSchedulePlanner | — | — | 5 |
| `platform/core/src/infra/json-file-repo.ts` | 178 | JsonFileRepoError, JsonFileRepo | runners/u7-bot (1/2) | JsonFileRepo, JsonFileRepoError | 2 |
| `platform/core/src/infra/scheduled-job-runner.ts` | 132 | DEFAULT_START_DELAY_MS, ScheduledJobRunnerDeps, ScheduledJobRunner | — | — | 3 |
| `platform/core/src/legacy-bridge/index.ts` | 11 | legacyClock, LegacyEventBusOptions, LegacyInbound, legacyEventBus, legacyJob, legacyJobsOf | platform/app (1/0); runners/u7-bot (1/0) | legacyClock, legacyEventBus | 2 |
| `platform/core/src/legacy-bridge/legacy-clock.ts` | 11 | legacyClock | platform/app (1/0); runners/u7-bot (1/0) | legacyClock | 3 |
| `platform/core/src/legacy-bridge/legacy-event-bus.ts` | 185 | LegacyInbound, LegacyEventBusOptions, legacyEventBus | platform/app (1/0) | legacyEventBus | 3 |
| `platform/core/src/legacy-bridge/legacy-job.ts` | 57 | JobOwner, legacyJob, legacyJobsOf | — | — | 4 |
| `platform/core/src/shared/console-logger.ts` | 80 | ConsoleLogger | platform/app (1/3); scripts (2/0); runners/u7-bot (2/0); runners/u7-cli (1/0) | ConsoleLogger | 2 |
| `platform/core/src/shared/index.ts` | 35 | ConsoleLogger, isoNow, Logger, getGlobalLogger, LogLevel, parseLogLevel, setGlobalLogger, escapeMarkdown, MdText, md, mdCodeBlock, mdConcat, mdInlineCode, mdJoin, mdRaw, safeConvert, MarkdownIssue, MarkdownValidationResult, assertMarkdownV2Safe, MarkdownV2ValidationError, validateMarkdownV2, now, serializeError, stringUtility, truncateByWords | platform/app-legacy (1/0); platform/app (3/3); scripts (4/0); runners/u7-bot (46/23); runners/u7-cli (1/0) | *, ConsoleLogger, LogLevel, Logger, MdText, assertMarkdownV2Safe, escapeMarkdown, getGlobalLogger, md, mdConcat, mdInlineCode, mdJoin, mdRaw, now, parseLogLevel, safeConvert, serializeError, setGlobalLogger, validateMarkdownV2 | 4 |
| `platform/core/src/shared/iso-now.ts` | 10 | isoNow | — | — | 4 |
| `platform/core/src/shared/logger.ts` | 68 | LogLevel, LogEntry, Logger, setGlobalLogger, getGlobalLogger, parseLogLevel | platform/app-legacy (2/0); platform/app (2/0); scripts (4/0); runners/u7-bot (21/17); runners/u7-cli (1/0) | LogLevel, Logger, getGlobalLogger, parseLogLevel, setGlobalLogger | 21 |
| `platform/core/src/shared/markdown-validator.ts` | 257 | MarkdownIssue, MarkdownValidationResult, validateMarkdownV2, MarkdownV2ValidationError, assertMarkdownV2Safe | runners/u7-bot (1/12) | assertMarkdownV2Safe, validateMarkdownV2 | 7 |
| `platform/core/src/shared/markdown.ts` | 334 | MdText, md, mdRaw, mdConcat, mdJoin, mdCodeBlock, mdInlineCode, escapeMarkdown, safeConvert | scripts (1/0); runners/u7-bot (103/13) | MdText, escapeMarkdown, md, mdConcat, mdInlineCode, mdJoin, mdRaw, safeConvert | 14 |
| `platform/core/src/shared/now.ts` | 10 | now | scripts (1/0); runners/u7-bot (4/0) | now | 6 |
| `platform/core/src/shared/serialize-error.ts` | 62 | serializeError | runners/u7-bot (1/0) | serializeError | 3 |
| `platform/core/src/shared/string-utility.ts` | 265 | truncateByWords, stringUtility | — | — | 3 |
| `platform/core/src/ui/bot/app-types.ts` | 17 | BotUiAppResolve | runners/u7-bot (1/0) | BotUiAppResolve | 4 |
| `platform/core/src/ui/bot/bot-controller.ts` | 410 | BotController | runners/u7-bot (1/1) | BotController | 5 |
| `platform/core/src/ui/bot/bot-request-context.ts` | 47 | BotRequestContext | runners/u7-bot (2/5) | BotRequestContext | 2 |
| `platform/core/src/ui/bot/bot-session-repo.ts` | 32 | BotSessionRepo | runners/u7-bot (2/1) | BotSessionRepo | 1 |
| `platform/core/src/ui/bot/bot-ui-story.ts` | 468 | BotUiStory | runners/u7-bot (1/0) | BotUiStory | 6 |
| `platform/core/src/ui/bot/dialog-cache.ts` | 67 | DialogCache | runners/u7-bot (2/0) | DialogCache | 5 |
| `platform/core/src/ui/bot/page-nav.ts` | 79 | BotLimitOpts, BotPaginator | runners/u7-bot (1/0) | BotPaginator | 2 |
| `platform/core/src/ui/bot/response-assert.ts` | 29 | assertDialogResponseMarkdownSafe | runners/u7-bot (1/25) | assertDialogResponseMarkdownSafe | 2 |
| `platform/core/src/ui/bot/response-builders.ts` | 79 | KbButton, btn, btnUrl, kb, screen, ask, notify, warn, note, go | runners/u7-bot (25/0) | KbButton, btn, kb, notify, screen, warn | 10 |
| `platform/core/src/ui/bot/types.ts` | 214 | KeyboardDescription, NoticeKind, NotificationPayload, ChatMemberUser, MessengerEvent, MessengerEventReaction, MessengerAction, ProactiveSender, Screen, DialogResponse, DialogState, ScreenState, BotSession, BotUpdate, CommandUpdate, CommandReaction | runners/u7-bot (110/73) | BotSession, BotUpdate, ChatMemberUser, CommandReaction, CommandUpdate, DialogResponse, DialogState, KeyboardDescription, MessengerAction, MessengerEvent, MessengerEventReaction, NoticeKind, NotificationPayload, ProactiveSender, Screen | 15 |
| `platform/core/src/ui/bot/ui-app.ts` | 314 | BotUiApp | runners/u7-bot (1/1) | BotUiApp | 3 |
| `platform/core/src/ui/content-nav/index.ts` | 4 | реэкспорт `*` (17 имён, §1.1) | — | — | 1 |
| `platform/core/src/ui/content-nav/presenter.ts` | 271 | STATUS_ICONS, MAX_PARENT_BREADCRUMB_LENGTH, formatBreadcrumbs, formatNavLevelText, buildNavLevelKeyboard, presentNavLevel | runners/u7-bot (5/1) | STATUS_ICONS, formatBreadcrumbs, presentNavLevel | 2 |
| `platform/core/src/ui/content-nav/step-render.ts` | 28 | StepContentData, formatStepBody | runners/u7-bot (7/0) | StepContentData, formatStepBody | 1 |
| `platform/core/src/ui/content-nav/types.ts` | 186 | NavNodeStatus, NavLevelKind, NavSubChild, NavChild, NavTarget, NavLevel, ParsedNavAddress, formatNavAddress, parseNavAddress | runners/u7-bot (12/0) | NavChild, NavLevel, NavNodeStatus, formatNavAddress, parseNavAddress | 4 |
| `platform/core/src/ui/event-subscription.ts` | 20 | UiEventSubscription, eventSubscription | runners/u7-bot (17/0) | UiEventSubscription, eventSubscription | 8 |
| `platform/core/src/ui/index.ts` | 19 | реэкспорт `*` (63 имён, §1.1) | runners/u7-bot (54/60) | BotController, BotPaginator, BotRequestContext, BotSession, BotSessionRepo, BotUiApp, BotUiAppResolve, BotUiStory, BotUpdate, ChatMemberUser, CommandReaction, CommandUpdate, DialogCache, DialogResponse, DialogState, KbButton, KeyboardDescription, MessengerAction, MessengerEvent, MessengerEventReaction, NavChild, NavLevel, NavNodeStatus, NoticeKind, NotificationPayload, Page, Paged, ProactiveSender, STATUS_ICONS, Screen, StepContentData, UiEventSubscription, assertDialogResponseMarkdownSafe, btn, eventSubscription, formatBreadcrumbs, formatNavAddress, formatStepBody, kb, notify, parseNavAddress, presentNavLevel, screen, warn | 1 |
| `platform/core/src/ui/pagination/paginator.ts` | 143 | PaginateOpts, Page, Paged, Paginator | runners/u7-bot (3/0) | Page, Paged | 4 |
| `platform/core/src/ui/types.ts` | 9 | UiAppResolve | — | — | 5 |
| `platform/core/src/ui/ui-app.ts` | 92 | UiApp | — | — | 3 |
| `platform/core/src/ui/ui-controller.ts` | 25 | UiController | — | — | 5 |
| `platform/core/src/ui/ui-story.ts` | 19 | UiStory | — | — | 5 |

### 1.1 Полные списки экспорта barrel-файлов

- `platform/app-legacy/src/index.ts` (8): `U7ApiApp`, `U7AppResolver`, `School`, `createSchool`, `SchoolSchema`, `TEST_SCHOOL`, `U7_SCHOOL_ID`, `U7_SCHOOL_STATIC`
- `platform/core/src/index.ts` (161): `ApiApp`, `App`, `ErDocType`, `ErMeta`, `EventReaction`, `JobMeta`, `JobSchedule`, `Job`, `JobExecutor`, `JobScheduler`, `ApiModule`, `UcDocType`, `UcMeta`, `UseCase`, `ArMeta`, `Aggregate`, `FileMetadata`, `FileMetadataSchema`, `NotifyKind`, `NOTIFY_KINDS`, `NotifyKindSchema`, `errAccessDenied`, `errBadRequest`, `errConflict`, `errDomain`, `errInternal`, `errNotFound`, `errUnauthorized`, `errValidation`, `fromError`, `throwError`, `AccessDeniedError`, `AppError`, `AuthError`, `BadRequestError`, `BaseUcErrors`, `ConflictError`, `DomainError`, `ErrorKind`, `InputValidationError`, `InternalError`, `NoCommandFoundError`, `NotFoundError`, `OutputValidationError`, `ServerInternalError`, `UnauthorizedError`, `ValidationError`, `ValidationIssues`, `AppException`, `DomainEvent`, `EventBus`, `ApiExecutor`, `ApiModuleMeta`, `AppEnvMode`, `AppMeta`, `AppResolver`, `ExtractUcMetaFromMeta`, `GetUcNamesFromMeta`, `ModuleResolver`, `BaseJsonDb`, `FileReplayStore`, `InProcEventBus`, `InProcJobExecutor`, `InProcJobScheduler`, `InProcJobSchedulerDeps`, `JobRunJsonRepo`, `JobRunRepo`, `MemoryJobRunRepo`, `JobSchedulePlanner`, `JsonFileRepo`, `JsonFileRepoError`, `DEFAULT_START_DELAY_MS`, `ScheduledJobRunner`, `ConsoleLogger`, `isoNow`, `Logger`, `getGlobalLogger`, `LogLevel`, `parseLogLevel`, `setGlobalLogger`, `escapeMarkdown`, `MdText`, `md`, `mdCodeBlock`, `mdConcat`, `mdInlineCode`, `mdJoin`, `mdRaw`, `safeConvert`, `MarkdownIssue`, `MarkdownValidationResult`, `assertMarkdownV2Safe`, `MarkdownV2ValidationError`, `validateMarkdownV2`, `now`, `serializeError`, `stringUtility`, `truncateByWords`, `BotUiAppResolve`, `BotController`, `BotRequestContext`, `BotSessionRepo`, `BotUiStory`, `DialogCache`, `BotLimitOpts`, `BotPaginator`, `assertDialogResponseMarkdownSafe`, `KbButton`, `btn`, `btnUrl`, `kb`, `screen`, `ask`, `notify`, `warn`, `note`, `go`, `KeyboardDescription`, `NoticeKind`, `NotificationPayload`, `ChatMemberUser`, `MessengerEvent`, `MessengerEventReaction`, `MessengerAction`, `ProactiveSender`, `Screen`, `DialogResponse`, `DialogState`, `ScreenState`, `BotSession`, `BotUpdate`, `CommandUpdate`, `CommandReaction`, `BotUiApp`, `STATUS_ICONS`, `MAX_PARENT_BREADCRUMB_LENGTH`, `formatBreadcrumbs`, `formatNavLevelText`, `buildNavLevelKeyboard`, `presentNavLevel`, `StepContentData`, `formatStepBody`, `NavNodeStatus`, `NavLevelKind`, `NavSubChild`, `NavChild`, `NavTarget`, `NavLevel`, `ParsedNavAddress`, `formatNavAddress`, `parseNavAddress`, `UiEventSubscription`, `eventSubscription`, `PaginateOpts`, `Page`, `Paged`, `Paginator`, `UiAppResolve`, `UiApp`, `UiController`, `UiStory`
- `platform/core/src/ui/content-nav/index.ts` (17): `STATUS_ICONS`, `MAX_PARENT_BREADCRUMB_LENGTH`, `formatBreadcrumbs`, `formatNavLevelText`, `buildNavLevelKeyboard`, `presentNavLevel`, `StepContentData`, `formatStepBody`, `NavNodeStatus`, `NavLevelKind`, `NavSubChild`, `NavChild`, `NavTarget`, `NavLevel`, `ParsedNavAddress`, `formatNavAddress`, `parseNavAddress`
- `platform/core/src/ui/index.ts` (63): `BotUiAppResolve`, `BotController`, `BotRequestContext`, `BotSessionRepo`, `BotUiStory`, `DialogCache`, `BotLimitOpts`, `BotPaginator`, `assertDialogResponseMarkdownSafe`, `KbButton`, `btn`, `btnUrl`, `kb`, `screen`, `ask`, `notify`, `warn`, `note`, `go`, `KeyboardDescription`, `NoticeKind`, `NotificationPayload`, `ChatMemberUser`, `MessengerEvent`, `MessengerEventReaction`, `MessengerAction`, `ProactiveSender`, `Screen`, `DialogResponse`, `DialogState`, `ScreenState`, `BotSession`, `BotUpdate`, `CommandUpdate`, `CommandReaction`, `BotUiApp`, `STATUS_ICONS`, `MAX_PARENT_BREADCRUMB_LENGTH`, `formatBreadcrumbs`, `formatNavLevelText`, `buildNavLevelKeyboard`, `presentNavLevel`, `StepContentData`, `formatStepBody`, `NavNodeStatus`, `NavLevelKind`, `NavSubChild`, `NavChild`, `NavTarget`, `NavLevel`, `ParsedNavAddress`, `formatNavAddress`, `parseNavAddress`, `UiEventSubscription`, `eventSubscription`, `PaginateOpts`, `Page`, `Paged`, `Paginator`, `UiAppResolve`, `UiApp`, `UiController`, `UiStory`

Итого строк таблицы: 77. Файлов с импортёрами вне пакета: 51. Без импортёров вообще: 2 — `platform/app-legacy/src/index.ts`, `platform/core/src/index.ts`.

Файлы-импортёры по именам — §5 (для legacy-имён) и §5.1 (остальные имена, использованные снаружи).

## 2. Тесты платформы

| Файл | `test()`/`it()` | Тестирует (импорт из файла) |
|---|---:|---|
| `platform/app-legacy/src/dmg-core.smoke.test.ts` | 1 | — |
| `platform/app-legacy/src/domain/school.test.ts` | 9 | `platform/app-legacy/src/domain/school.ts` |
| `platform/app/src/u7-caller-resolver.test.ts` | 11 | `platform/app/src/u7-app.ts`, `platform/app/src/u7-caller-resolver.ts`, `platform/core/src/shared/index.ts` |
| `platform/app/tests/u7-app.student.test.ts` | 3 | `platform/app/src/u7-app.ts`, `platform/app/src/u7-app.types.ts`, `platform/core/src/shared/index.ts` |
| `platform/app/tests/u7-app.test.ts` | 11 | `platform/app/src/u7-app.ts`, `platform/app/src/u7-app.types.ts`, `platform/core/src/infra/index.ts`, `platform/core/src/shared/index.ts` |
| `platform/core/src/api/app/api-app-dmg.test.ts` | 10 | `platform/core/src/api/app/api-app.ts`, `platform/core/src/api/job/job.ts`, `platform/core/src/domain/types.ts` |
| `platform/core/src/api/app/api-app.test.ts` | 8 | `platform/core/src/api/app/api-app.ts`, `platform/core/src/api/app/app.ts`, `platform/core/src/api/job/job-scheduler.ts`, `platform/core/src/api/job/job.ts`, `platform/core/src/domain/types.ts` |
| `platform/core/src/api/er/event-reaction.test.ts` | 6 | `platform/core/src/api/er/event-reaction.ts`, `platform/core/src/domain/events/domain-event.ts`, `platform/core/src/domain/types.ts` |
| `platform/core/src/api/job/job.test.ts` | 8 | `platform/core/src/api/er/event-reaction.ts`, `platform/core/src/api/job/job.ts`, `platform/core/src/api/module/api-module.ts`, `platform/core/src/domain/events/domain-event.ts`, `platform/core/src/domain/types.ts`, `platform/core/src/shared/logger.ts` |
| `platform/core/src/api/module/api-module.test.ts` | 14 | `platform/core/src/api/er/event-reaction.ts`, `platform/core/src/api/module/api-module.ts`, `platform/core/src/api/uc/use-case.ts`, `platform/core/src/domain/ar/aggregate.ts`, `platform/core/src/domain/errors/errors.ts`, `platform/core/src/domain/events/domain-event.ts`, `platform/core/src/domain/types.ts`, `platform/core/src/shared/logger.ts` |
| `platform/core/src/api/uc/use-case-auth.test.ts` | 5 | `platform/core/src/api/uc/use-case.ts`, `platform/core/src/domain/ar/aggregate.ts`, `platform/core/src/domain/errors/errors.ts`, `platform/core/src/domain/events/event-bus.ts`, `platform/core/src/domain/types.ts` |
| `platform/core/src/api/uc/use-case-output.test.ts` | 3 | `platform/core/src/api/uc/use-case.ts`, `platform/core/src/domain/ar/aggregate.ts`, `platform/core/src/domain/errors/errors.ts`, `platform/core/src/domain/events/event-bus.ts`, `platform/core/src/domain/types.ts` |
| `platform/core/src/api/uc/use-case-publish-events.test.ts` | 3 | `platform/core/src/api/uc/use-case.ts`, `platform/core/src/domain/events/domain-event.ts`, `platform/core/src/domain/types.ts`, `platform/core/src/infra/in-proc-event-bus.ts` |
| `platform/core/src/api/uc/use-case.test.ts` | 5 | `platform/core/src/api/uc/use-case.ts`, `platform/core/src/domain/ar/aggregate.ts`, `platform/core/src/domain/errors/error-helpers.ts`, `platform/core/src/domain/errors/errors.ts`, `platform/core/src/domain/events/event-bus.ts`, `platform/core/src/domain/types.ts` |
| `platform/core/src/domain/ar/aggregate.test.ts` | 13 | `platform/core/src/domain/ar/aggregate.ts`, `platform/core/src/domain/errors/errors.ts`, `platform/core/src/domain/events/domain-event.ts` |
| `platform/core/src/domain/common/file-metadata.test.ts` | 6 | `platform/core/src/domain/common/file-metadata.ts` |
| `platform/core/src/domain/errors/error-helpers.test.ts` | 9 | `platform/core/src/domain/errors/error-helpers.ts`, `platform/core/src/domain/errors/errors.ts` |
| `platform/core/src/domain/errors/errors.test.ts` | 3 | `platform/core/src/domain/errors/error-helpers.ts`, `platform/core/src/domain/errors/errors.ts` |
| `platform/core/src/domain/types.test.ts` | 4 | `platform/core/src/domain/index.ts`, `platform/core/src/domain/types.ts` |
| `platform/core/src/infra/base-json-db.test.ts` | 5 | `platform/core/src/infra/base-json-db.ts` |
| `platform/core/src/infra/file-replay-store.test.ts` | 14 | `platform/core/src/infra/file-replay-store.ts` |
| `platform/core/src/infra/in-proc-event-bus.test.ts` | 9 | `platform/core/src/domain/events/domain-event.ts`, `platform/core/src/infra/in-proc-event-bus.ts` |
| `platform/core/src/infra/in-proc-job-scheduler.test.ts` | 8 | `platform/core/src/api/job/job.ts`, `platform/core/src/infra/in-proc-job-executor.ts`, `platform/core/src/infra/in-proc-job-scheduler.ts`, `platform/core/src/infra/job-run-json-repo.ts`, `platform/core/src/infra/job-run-repo.ts`, `platform/core/src/shared/logger.ts` |
| `platform/core/src/infra/job-schedule-planner.test.ts` | 16 | `platform/core/src/api/job/job.ts`, `platform/core/src/infra/job-schedule-planner.ts` |
| `platform/core/src/infra/json-file-repo.test.ts` | 13 | `platform/core/src/infra/json-file-repo.ts` |
| `platform/core/src/infra/scheduled-job-runner.test.ts` | 11 | `platform/core/src/api/job/job.ts`, `platform/core/src/infra/job-run-repo.ts`, `platform/core/src/infra/job-schedule-planner.ts`, `platform/core/src/infra/scheduled-job-runner.ts`, `platform/core/src/shared/logger.ts` |
| `platform/core/src/legacy-bridge/example-app.test.ts` | 8 | `platform/core/src/api/app/api-app.ts`, `platform/core/src/domain/events/domain-event.ts`, `platform/core/src/domain/types.ts`, `platform/core/src/infra/in-proc-event-bus.ts`, `platform/core/src/legacy-bridge/index.ts` |
| `platform/core/src/legacy-bridge/legacy-clock.test.ts` | 1 | `platform/core/src/legacy-bridge/legacy-clock.ts`, `platform/core/src/shared/now.ts` |
| `platform/core/src/legacy-bridge/legacy-event-bus.test.ts` | 12 | `platform/core/src/domain/events/domain-event.ts`, `platform/core/src/infra/in-proc-event-bus.ts`, `platform/core/src/legacy-bridge/legacy-event-bus.ts` |
| `platform/core/src/legacy-bridge/legacy-job.test.ts` | 4 | `platform/core/src/infra/in-proc-job-executor.ts`, `platform/core/src/legacy-bridge/legacy-job.ts` |
| `platform/core/src/shared/console-logger.test.ts` | 2 | `platform/core/src/shared/console-logger.ts`, `platform/core/src/shared/logger.ts` |
| `platform/core/src/shared/iso-now.test.ts` | 3 | `platform/core/src/shared/iso-now.ts` |
| `platform/core/src/shared/markdown-validator.test.ts` | 37 | `platform/core/src/shared/markdown-validator.ts` |
| `platform/core/src/shared/markdown.test.ts` | 32 | `platform/core/src/shared/markdown-validator.ts`, `platform/core/src/shared/markdown.ts` |
| `platform/core/src/shared/now.test.ts` | 1 | `platform/core/src/shared/index.ts` |
| `platform/core/src/shared/string-utility.test.ts` | 22 | `platform/core/src/shared/string-utility.ts` |
| `platform/core/src/ui/bot/bot-controller.test.ts` | 25 | `platform/core/src/domain/errors/error-helpers.ts`, `platform/core/src/domain/errors/errors.ts`, `platform/core/src/domain/types.ts`, `platform/core/src/shared/logger.ts`, `platform/core/src/shared/markdown-validator.ts`, `platform/core/src/shared/markdown.ts`, `platform/core/src/ui/bot/bot-controller.ts`, `platform/core/src/ui/bot/bot-ui-story.ts`, `platform/core/src/ui/bot/types.ts` |
| `platform/core/src/ui/bot/bot-request-context.test.ts` | 6 | `platform/core/src/ui/bot/bot-request-context.ts` |
| `platform/core/src/ui/bot/bot-ui-story.test.ts` | 27 | `platform/core/src/domain/errors/error-helpers.ts`, `platform/core/src/domain/errors/errors.ts`, `platform/core/src/domain/types.ts`, `platform/core/src/shared/logger.ts`, `platform/core/src/shared/markdown-validator.ts`, `platform/core/src/shared/markdown.ts`, `platform/core/src/ui/bot/bot-ui-story.ts`, `platform/core/src/ui/bot/response-builders.ts`, `platform/core/src/ui/bot/types.ts` |
| `platform/core/src/ui/bot/dialog-cache.test.ts` | 11 | `platform/core/src/domain/types.ts`, `platform/core/src/ui/bot/bot-controller.ts`, `platform/core/src/ui/bot/bot-ui-story.ts`, `platform/core/src/ui/bot/dialog-cache.ts`, `platform/core/src/ui/bot/types.ts`, `platform/core/src/ui/bot/ui-app.ts` |
| `platform/core/src/ui/bot/page-nav.test.ts` | 12 | `platform/core/src/ui/bot/page-nav.ts` |
| `platform/core/src/ui/bot/response-assert.test.ts` | 5 | `platform/core/src/shared/markdown.ts`, `platform/core/src/ui/bot/response-assert.ts`, `platform/core/src/ui/bot/types.ts` |
| `platform/core/src/ui/bot/response-builders.test.ts` | 15 | `platform/core/src/shared/markdown.ts`, `platform/core/src/ui/bot/response-builders.ts` |
| `platform/core/src/ui/bot/types.test.ts` | 4 | `platform/core/src/ui/bot/types.ts` |
| `platform/core/src/ui/bot/ui-app.test.ts` | 30 | `platform/core/src/domain/types.ts`, `platform/core/src/shared/markdown.ts`, `platform/core/src/ui/bot/bot-controller.ts`, `platform/core/src/ui/bot/bot-ui-story.ts`, `platform/core/src/ui/bot/types.ts`, `platform/core/src/ui/bot/ui-app.ts` |
| `platform/core/src/ui/content-nav/nav-level.test.ts` | 5 | `platform/core/src/ui/content-nav/types.ts` |
| `platform/core/src/ui/content-nav/presenter.test.ts` | 14 | `platform/core/src/ui/content-nav/presenter.ts`, `platform/core/src/ui/content-nav/types.ts` |
| `platform/core/src/ui/pagination/paginator.test.ts` | 11 | `platform/core/src/ui/pagination/paginator.ts` |
| `platform/core/src/ui/ui-app.test.ts` | 9 | `platform/core/src/domain/events/domain-event.ts`, `platform/core/src/domain/events/event-bus.ts`, `platform/core/src/ui/event-subscription.ts`, `platform/core/src/ui/ui-app.ts`, `platform/core/src/ui/ui-controller.ts`, `platform/core/src/ui/ui-story.ts` |
| `platform/core/src/ui/ui-controller.test.ts` | 3 | `platform/core/src/domain/events/domain-event.ts`, `platform/core/src/ui/event-subscription.ts`, `platform/core/src/ui/ui-controller.ts`, `platform/core/src/ui/ui-story.ts` |

Без импорта файлов платформы: `platform/app-legacy/src/dmg-core.smoke.test.ts`.

## 3. `runners/u7-cli`

### 3.1 Файлы

- `runners/u7-cli/src/cli-controller.ts`
- `runners/u7-cli/src/controller/command-parser.ts`
- `runners/u7-cli/src/controller/format-valibot-errors.ts`
- `runners/u7-cli/src/main.ts`

Прочее в каталоге:

- `runners/u7-cli/about.md`
- `runners/u7-cli/bunfig.toml`
- `runners/u7-cli/demo-module/about.md`
- `runners/u7-cli/package.json`
- `runners/u7-cli/tsconfig.json`

### 3.2 `runners/u7-cli/package.json`

- name: `@u7-scl/cli`, version: `0.1.0`, type: `module`
- зависимости:

| Пакет | Версия |
|---|---|
| `@u7-scl/app` | `workspace:*` |
| `@u7-scl/app-legacy` | `workspace:*` |
| `@u7-scl/core` | `workspace:*` |
| `@u7-scl/domain` | `workspace:*` |
| `dmg-core` | `file:../../../../tools/dmg/dmg-core` |
| `valibot` | `^1.2.0` |

Скрипты: `start` = `bun src/main.ts`, `test` = `bun test --pass-with-no-tests`, `lint` = `bunx biome check .`, `tslint` = `tsc --noEmit`, `format` = `bunx biome check . --write`, `check` = `bun run lint && bun run tslint && bun test --pass-with-no-tests`.

### 3.3 Ссылки на `u7-cli` / `@u7-scl/cli` в репозитории

| Файл:строка | Строка |
|---|---|
| `CHANGELOG.md:15` | запись «Раскладка монорепо по осям архитектуры» (трек repo-layout): упоминает `runners/` (`u7-bot`, `u7-cli`) — история, не правится |
| `scripts/domain-arch.test.ts:27` | join(ROOT, 'runners/u7-cli/src'), |
| `scripts/domain-check.test.ts:83` | "import { X } from '../../../user/src/infra/repo';\nimport { B } from '@u7-scl/bot';\nimport { Y } from '@u7-scl/cli';", |
| `scripts/domain-check.test.ts:89` | "ARC-06: domain/src/user/a.ts: домен не импортирует прикладной слой (import '@u7-scl/cli')", |
| `scripts/domain-check.test.ts:156` | const ASSEMBLY = ['@u7-scl/app', '@u7-scl/bot', '@u7-scl/cli']; |
| `scripts/domain-check.test.ts:194` | "import { B } from '@u7-scl/bot';\nimport { C } from '@u7-scl/cli';\nimport { M } from '../../../../runners/u7-bot/src/main';\nimport { U } from '../../../../platform/app/src/u7-app';", |
| `scripts/domain-check.test.ts:199` | "ARC-06: modules/user/src/infra/a.ts: прикладной пакет не импортирует корень сборки и раннеры (import '@u7-scl/cli')", |
| `scripts/call-uc.ts:3` | * Отдельный от u7-cli ручной вход; свести с ним после перехода. |
| `scripts/arch-check.test.ts:40` | '@u7-scl/cli', |
| `README.md:40` | - **[u7-cli](./runners/u7-cli/)**: Интерактивный CLI для работы с приложением. |
| `README.md:182` | ### CLI (`u7-cli`) |
| `README.md:187` | cd runners/u7-cli |

`bun.lock` (генерируется): `bun.lock:166`, `bun.lock:167`, `bun.lock:298`, `bun.lock:606`, `bun.lock:634`, `bun.lock:656` — workspace-запись `runners/u7-cli` и её зависимости.

## 4. Алиасы и зависимости: `package.json` и `tsconfig*.json`

Шаблон: `@u7-scl/app-legacy`, `@u7-scl/core` (включая подпути), `#*-legacy/*`.

| Файл:строка | Строка |
|---|---|
| `platform/app-legacy/package.json:2` | "name": "@u7-scl/app-legacy", |
| `platform/app-legacy/package.json:20` | "@u7-scl/core": "workspace:*", |
| `platform/app/package.json:18` | "@u7-scl/core": "workspace:*", |
| `platform/app/package.json:19` | "@u7-scl/app-legacy": "workspace:*", |
| `platform/core/package.json:2` | "name": "@u7-scl/core", |
| `platform/core/package.json:23` | "#domain-legacy/*": "./src/domain/*.ts", |
| `platform/core/package.json:24` | "#api-legacy/*": "./src/api/*.ts", |
| `platform/core/package.json:25` | "#ui-legacy/*": "./src/ui/*.ts", |
| `platform/core/package.json:26` | "#shared-legacy/*": "./src/shared/*.ts" |
| `tsconfig.json:23` | "@u7-scl/core/domain": ["./platform/core/src/domain/index.ts"], |
| `tsconfig.json:24` | "@u7-scl/core/api": ["./platform/core/src/api/index.ts"], |
| `tsconfig.json:25` | "@u7-scl/core/ui": ["./platform/core/src/ui/index.ts"], |
| `tsconfig.json:26` | "@u7-scl/core/shared": ["./platform/core/src/shared/index.ts"], |
| `tsconfig.json:41` | "@u7-scl/app-legacy": ["./platform/app-legacy/src/index.ts"], |
| `tsconfig.json:42` | "@u7-scl/app-legacy/domain": [ |
| `modules/peer-review/package.json:15` | "@u7-scl/app-legacy": "workspace:*", |
| `modules/peer-review/package.json:16` | "@u7-scl/core": "workspace:*", |
| `modules/peer-review/package.json:25` | "#api-legacy/*": "./src/api/*.ts" |
| `modules/wish/package.json:15` | "@u7-scl/app-legacy": "workspace:*", |
| `modules/wish/package.json:16` | "@u7-scl/core": "workspace:*", |
| `modules/wish/package.json:29` | "#infra-legacy/*": "./src/infra/*.ts" |
| `modules/stream/package.json:15` | "@u7-scl/app-legacy": "workspace:*", |
| `modules/stream/package.json:16` | "@u7-scl/core": "workspace:*", |
| `modules/stream/package.json:27` | "#api-legacy/*": "./src/api/*.ts" |
| `runners/u7-bot/package.json:15` | "@u7-scl/core": "workspace:*", |
| `runners/u7-bot/package.json:24` | "@u7-scl/app-legacy": "workspace:*", |
| `runners/u7-cli/package.json:16` | "@u7-scl/app-legacy": "workspace:*", |
| `runners/u7-cli/package.json:17` | "@u7-scl/core": "workspace:*", |

## 5. Потребители legacy-имён по пакетам

Учтены имена, объявленные в файлах `platform/core/src/{domain,api,infra,legacy-bridge}` и `platform/app-legacy/src` (напрямую или через barrel). Пакеты-«потребители» — все, кроме пакета-владельца файла.

### `platform/app`

| Имя | Файлов-потребителей | Файлы-потребители | Объявлено в |
|---|---:|---|---|
| `ApiApp` | 1 | `platform/app/src/u7-app.ts` | `platform/core/src/api/app/api-app.ts`, `platform/core/src/api/index.ts` |
| `AppMeta` | 1 | `platform/app/src/u7-app-meta.ts` | `platform/core/src/domain/index.ts`, `platform/core/src/domain/types.ts` |
| `createSchool` | 1 | `platform/app/src/u7-app.ts` | `platform/app-legacy/src/domain/index.ts`, `platform/app-legacy/src/domain/school.ts` |
| `EventBus` | 1 | `platform/app/src/u7-app.ts` | `platform/core/src/domain/events/event-bus.ts`, `platform/core/src/domain/index.ts` |
| `InProcEventBus` | 1 | `platform/app/src/u7-app.ts` | `platform/core/src/infra/in-proc-event-bus.ts`, `platform/core/src/infra/index.ts` |
| `InProcJobScheduler` | 2 | `platform/app/src/u7-app.ts`, `platform/app/tests/u7-app.test.ts` | `platform/core/src/infra/in-proc-job-scheduler.ts`, `platform/core/src/infra/index.ts` |
| `JobRunJsonRepo` | 1 | `platform/app/src/u7-app.ts` | `platform/core/src/infra/index.ts`, `platform/core/src/infra/job-run-json-repo.ts` |
| `legacyClock` | 1 | `platform/app/src/u7-app.ts` | `platform/core/src/legacy-bridge/index.ts`, `platform/core/src/legacy-bridge/legacy-clock.ts` |
| `legacyEventBus` | 1 | `platform/app/src/u7-app.ts` | `platform/core/src/legacy-bridge/index.ts`, `platform/core/src/legacy-bridge/legacy-event-bus.ts` |
| `School` | 1 | `platform/app/src/u7-app.ts` | `platform/app-legacy/src/domain/index.ts`, `platform/app-legacy/src/domain/school.ts` |
| `TEST_SCHOOL` | 1 | `platform/app/src/u7-app.ts` | `platform/app-legacy/src/domain/index.ts`, `platform/app-legacy/src/domain/school.ts` |
| `U7ApiApp` | 1 | `platform/app/src/u7-app-meta.ts` | `platform/app-legacy/src/domain/api.ts`, `platform/app-legacy/src/domain/index.ts` |
| `U7AppResolver` | 1 | `platform/app/src/u7-app.ts` | `platform/app-legacy/src/domain/api.ts`, `platform/app-legacy/src/domain/index.ts` |

### `runners/u7-bot`

| Имя | Файлов-потребителей | Файлы-потребители | Объявлено в |
|---|---:|---|---|
| `AppEnvMode` | 1 | `runners/u7-bot/src/config.ts` | `platform/core/src/domain/index.ts`, `platform/core/src/domain/types.ts` |
| `AppException` | 1 | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts` | `platform/core/src/domain/errors/errors.ts`, `platform/core/src/domain/index.ts` |
| `CompositeLogger` | 1 | `runners/u7-bot/src/main.ts` | `platform/app-legacy/src/infra/logger/composite-logger.ts`, `platform/app-legacy/src/infra/logger/index.ts` |
| `DomainEvent` | 7 | `runners/u7-bot/src/controllers/courses/stories/wish-confirmed.story.ts`, `runners/u7-bot/src/controllers/courses/stories/wish-invite.story.ts`, `runners/u7-bot/src/controllers/learning/stories/hub.ts`, `runners/u7-bot/src/controllers/peer-review/stories/invite.story.ts`, `runners/u7-bot/src/controllers/peer-review/stories/review-notify.story.ts`, `runners/u7-bot/src/controllers/questionnaire/stories/questionnaire-events.ts`, `runners/u7-bot/src/controllers/streams/stories/inactivity.story.ts` | `platform/core/src/domain/events/domain-event.ts`, `platform/core/src/domain/index.ts` |
| `errAccessDenied` | 1 | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts` | `platform/core/src/domain/errors/error-helpers.ts`, `platform/core/src/domain/index.ts` |
| `errBadRequest` | 1 | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts` | `platform/core/src/domain/errors/error-helpers.ts`, `platform/core/src/domain/index.ts` |
| `errConflict` | 1 | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts` | `platform/core/src/domain/errors/error-helpers.ts`, `platform/core/src/domain/index.ts` |
| `errInternal` | 1 | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts` | `platform/core/src/domain/errors/error-helpers.ts`, `platform/core/src/domain/index.ts` |
| `errNotFound` | 1 | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts` | `platform/core/src/domain/errors/error-helpers.ts`, `platform/core/src/domain/index.ts` |
| `errUnauthorized` | 1 | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts` | `platform/core/src/domain/errors/error-helpers.ts`, `platform/core/src/domain/index.ts` |
| `errValidation` | 1 | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts` | `platform/core/src/domain/errors/error-helpers.ts`, `platform/core/src/domain/index.ts` |
| `EventBus` | 1 | `runners/u7-bot/tests/helpers/test-app.ts` | `platform/core/src/domain/events/event-bus.ts`, `platform/core/src/domain/index.ts` |
| `FileReplayStore` | 1 | `runners/u7-bot/src/main.ts` | `platform/core/src/infra/file-replay-store.ts`, `platform/core/src/infra/index.ts` |
| `InProcEventBus` | 1 | `runners/u7-bot/tests/helpers/test-bot-transport.ts` | `platform/core/src/infra/in-proc-event-bus.ts`, `platform/core/src/infra/index.ts` |
| `JsonFileRepo` | 1 | `runners/u7-bot/src/infra/json-bot-session-repo.ts` | `platform/core/src/infra/index.ts`, `platform/core/src/infra/json-file-repo.ts` |
| `JsonFileRepoError` | 2 | `runners/u7-bot/src/infra/bot-transport-persist.test.ts`, `runners/u7-bot/src/infra/json-bot-session-repo.test.ts` | `platform/core/src/infra/index.ts`, `platform/core/src/infra/json-file-repo.ts` |
| `legacyClock` | 1 | `runners/u7-bot/src/main.ts` | `platform/core/src/legacy-bridge/index.ts`, `platform/core/src/legacy-bridge/legacy-clock.ts` |
| `School` | 1 | `runners/u7-bot/src/core/u7-bot-app-meta.ts` | `platform/app-legacy/src/domain/index.ts`, `platform/app-legacy/src/domain/school.ts` |
| `TEST_SCHOOL` | 11 | `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts`, `runners/u7-bot/src/controllers/school/controller.test.ts`, `runners/u7-bot/src/controllers/school/stories/community.story.test.ts`, `runners/u7-bot/src/controllers/school/stories/school-hub.story.test.ts`, `runners/u7-bot/src/controllers/school/stories/school-info.story.test.ts`, `runners/u7-bot/src/controllers/school/stories/school-reviews.story.test.ts`, `runners/u7-bot/src/core/ui-app.test.ts`, `runners/u7-bot/src/create-ui-app.test.ts`, `runners/u7-bot/tests/e2e/guest-registration.e2e.test.ts`, `runners/u7-bot/tests/helpers/test-app.ts`, `runners/u7-bot/tests/helpers/test-bot-transport.ts` | `platform/app-legacy/src/domain/index.ts`, `platform/app-legacy/src/domain/school.ts` |
| `U7_SCHOOL_ID` | 1 | `runners/u7-bot/tests/worlds/builder.ts` | `platform/app-legacy/src/domain/index.ts`, `platform/app-legacy/src/domain/school.ts` |
| `U7AppResolver` | 1 | `runners/u7-bot/src/core/u7-bot-app-meta.ts` | `platform/app-legacy/src/domain/api.ts`, `platform/app-legacy/src/domain/index.ts` |

### `scripts`

| Имя | Файлов-потребителей | Файлы-потребители | Объявлено в |
|---|---:|---|---|
| `TEST_SCHOOL` | 2 | `scripts/_course-client.ts`, `scripts/call-uc.ts` | `platform/app-legacy/src/domain/index.ts`, `platform/app-legacy/src/domain/school.ts` |
| `U7_SCHOOL_ID` | 2 | `scripts/migrate-streams-school-id.test.ts`, `scripts/migrate-streams-school-id.ts` | `platform/app-legacy/src/domain/index.ts`, `platform/app-legacy/src/domain/school.ts` |

### `runners/u7-cli`

| Имя | Файлов-потребителей | Файлы-потребители | Объявлено в |
|---|---:|---|---|
| `ApiApp` | 1 | `runners/u7-cli/src/cli-controller.ts` | `platform/core/src/api/app/api-app.ts`, `platform/core/src/api/index.ts` |
| `TEST_SCHOOL` | 1 | `runners/u7-cli/src/main.ts` | `platform/app-legacy/src/domain/index.ts`, `platform/app-legacy/src/domain/school.ts` |
| `UcDocType` | 1 | `runners/u7-cli/src/cli-controller.ts` | `platform/core/src/api/index.ts`, `platform/core/src/api/uc/use-case.ts` |

### `platform/app-legacy`

| Имя | Файлов-потребителей | Файлы-потребители | Объявлено в |
|---|---:|---|---|
| `ApiApp` | 1 | `platform/app-legacy/src/domain/api.ts` | `platform/core/src/api/app/api-app.ts`, `platform/core/src/api/index.ts` |
| `AppMeta` | 1 | `platform/app-legacy/src/domain/api.ts` | `platform/core/src/domain/index.ts`, `platform/core/src/domain/types.ts` |
| `AppResolver` | 1 | `platform/app-legacy/src/domain/api.ts` | `platform/core/src/domain/index.ts`, `platform/core/src/domain/types.ts` |

Пакеты без имён из legacy-файлов (по этому разбору): `modules`, `domain`, `(корень)` (у `modules/*` нет ни одного импорта `@u7-scl/core*`).

### 5.1 Не-legacy имена, использованные снаружи

Имена из файлов платформы вне legacy-набора (`ui/`, `shared/`, `platform/app/src`) → пакеты-потребители (сводка из таблицы §1, без путей файлов):

| Файл | Пакеты-потребители |
|---|---|
| `platform/app/src/index.ts` | scripts (2/0); runners/u7-bot (5/0); runners/u7-cli (2/0) |
| `platform/app/src/u7-app-meta.ts` | runners/u7-bot (3/0); runners/u7-cli (1/0) |
| `platform/app/src/u7-app.ts` | scripts (2/0); runners/u7-bot (3/0); runners/u7-cli (1/0) |
| `platform/app/src/u7-caller-resolver.ts` | runners/u7-bot (2/0) |
| `platform/core/src/shared/console-logger.ts` | platform/app (1/3); scripts (2/0); runners/u7-bot (2/0); runners/u7-cli (1/0) |
| `platform/core/src/shared/index.ts` | platform/app-legacy (1/0); platform/app (3/3); scripts (4/0); runners/u7-bot (46/23); runners/u7-cli (1/0) |
| `platform/core/src/shared/logger.ts` | platform/app-legacy (2/0); platform/app (2/0); scripts (4/0); runners/u7-bot (21/17); runners/u7-cli (1/0) |
| `platform/core/src/shared/markdown-validator.ts` | runners/u7-bot (1/12) |
| `platform/core/src/shared/markdown.ts` | scripts (1/0); runners/u7-bot (103/13) |
| `platform/core/src/shared/now.ts` | scripts (1/0); runners/u7-bot (4/0) |
| `platform/core/src/shared/serialize-error.ts` | runners/u7-bot (1/0) |
| `platform/core/src/ui/bot/app-types.ts` | runners/u7-bot (1/0) |
| `platform/core/src/ui/bot/bot-controller.ts` | runners/u7-bot (1/1) |
| `platform/core/src/ui/bot/bot-request-context.ts` | runners/u7-bot (2/5) |
| `platform/core/src/ui/bot/bot-session-repo.ts` | runners/u7-bot (2/1) |
| `platform/core/src/ui/bot/bot-ui-story.ts` | runners/u7-bot (1/0) |
| `platform/core/src/ui/bot/dialog-cache.ts` | runners/u7-bot (2/0) |
| `platform/core/src/ui/bot/page-nav.ts` | runners/u7-bot (1/0) |
| `platform/core/src/ui/bot/response-assert.ts` | runners/u7-bot (1/25) |
| `platform/core/src/ui/bot/response-builders.ts` | runners/u7-bot (25/0) |
| `platform/core/src/ui/bot/types.ts` | runners/u7-bot (110/73) |
| `platform/core/src/ui/bot/ui-app.ts` | runners/u7-bot (1/1) |
| `platform/core/src/ui/content-nav/presenter.ts` | runners/u7-bot (5/1) |
| `platform/core/src/ui/content-nav/step-render.ts` | runners/u7-bot (7/0) |
| `platform/core/src/ui/content-nav/types.ts` | runners/u7-bot (12/0) |
| `platform/core/src/ui/event-subscription.ts` | runners/u7-bot (17/0) |
| `platform/core/src/ui/index.ts` | runners/u7-bot (54/60) |
| `platform/core/src/ui/pagination/paginator.ts` | runners/u7-bot (3/0) |

## 6. `throw*`-хелперы

### 6.1 Где определены

| Файл:строка | Хелпер | Вид |
|---|---|---|
| `platform/core/src/domain/errors/error-helpers.ts:14` | `throwError` | функция |
| `platform/core/src/domain/ar/aggregate.ts:133` | `throwInternal` | метод |
| `platform/core/src/domain/ar/aggregate.ts:148` | `throwBadRequest` | метод |
| `platform/core/src/domain/ar/aggregate.ts:155` | `throwInvariant` | метод |
| `platform/core/src/api/uc/use-case.ts:158` | `throwError` | метод |
| `platform/core/src/api/uc/use-case.ts:162` | `throwBaseErrors` | метод |
| `platform/core/src/api/module/api-module.ts:121` | `throwNoCommandFound` | метод |

### 6.2 Все вызовы

| Файл:строка | Хелпер | Зона |
|---|---|---|
| `platform/core/src/domain/errors/errors.test.ts:16` | `throwError` | тест |
| `platform/core/src/domain/ar/aggregate.ts:57` | `throwInvariant` | platform/core/src |
| `platform/core/src/domain/ar/aggregate.ts:134` | `throwError` | platform/core/src |
| `platform/core/src/domain/ar/aggregate.ts:149` | `throwError` | platform/core/src |
| `platform/core/src/domain/ar/aggregate.ts:159` | `throwError` | platform/core/src |
| `platform/core/src/domain/ar/aggregate.test.ts:40` | `throwInvariant` | тест |
| `platform/core/src/domain/ar/aggregate.test.ts:48` | `throwInternal` | тест |
| `platform/core/src/api/app/api-app.ts:158` | `throwError` | platform/core/src |
| `platform/core/src/api/uc/use-case.test.ts:84` | `throwError` | тест |
| `platform/core/src/api/uc/use-case.test.ts:89` | `throwError` | тест |
| `platform/core/src/api/uc/use-case.ts:159` | `throwError` | platform/core/src |
| `platform/core/src/api/uc/use-case.ts:163` | `throwError` | platform/core/src |
| `platform/core/src/api/uc/use-case.ts:172` | `throwBaseErrors` | platform/core/src |
| `platform/core/src/api/uc/use-case.ts:198` | `throwBaseErrors` | platform/core/src |
| `platform/core/src/api/uc/use-case.ts:230` | `throwBaseErrors` | platform/core/src |
| `platform/core/src/api/module/api-module.ts:107` | `throwNoCommandFound` | platform/core/src |
| `platform/core/src/api/module/api-module.ts:122` | `throwError` | platform/core/src |

Вызовов вне `platform/core/src` и вне тестов: **0**.

Отдельно: `new AppException(...)` вне `platform/core/src` — только в тесте `runners/u7-bot/src/core/u7-bot-ui-story.test.ts` (13 вхождений).

## 7. Что не разрешилось

Нет: все импорты внутренних форм (`./`, `#…`, `@u7-scl/core*`, `@u7-scl/app*`, `@u7-scl/app-legacy*`) разрешены в файлы.

## 8. Ограничения разбора

- Импорт `import * as X` и импорт без имён привязываются к barrel, а не к конкретным файлам: имена внутри `X.*` статически не раскрываются (см. `*` в §1).
- `export * as … from …` учитывается как `*`; переименования (`as`) в «экспортирует» показаны исходным именем.
- Импорты, записанные строкой внутри тестовых фикстур (например, `scripts/domain-check.test.ts`), импортами не считаются.
- Глубина импортёров — один уровень: файл, который импортирует barrel, указан как импортёр и barrel, и файла-объявления имени.
