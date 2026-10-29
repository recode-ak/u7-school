# Бриф среза: корень сборки `@u7-scl/app` — `U7App` (D-50, DEBT-39, TR-33)

Читай до старта: D-50…D-54 в `node_modules/dmg-core/docs/decisions.md`; образец — учебное приложение `node_modules/dmg-core/src/testing/example/app/example-app{,.types,.test}.ts` и `example-caller-resolver.ts`; разбор и решения — раздел «Разбор сборки» в `conductor/tracks/app-assembly_20261029/summary.md`; TR-33 в `conductor/architecture/debt.md`; `conductor/architecture/legacy.md` (legacy-модули правятся по образцу соседнего кода).

## Исходное (что переносится)

- `runners/u7-bot/src/create-api-app.ts` (`createApiApp`, `ApiAppBundle`) — сборка legacy-модулей, фасадов, legacy `ApiApp`, `init(InProcJobScheduler)`.
- `runners/u7-bot/src/create-dmg-modules.ts` (`createDmgAppContext`, `createDmgApp`, типы `DmgPlatform`, `DmgLegacyFacades`) — контекст DMG поверх legacy-шины и `ApiApp` пакета на фабриках.
- `runners/u7-bot/src/create-api-app.test.ts` — тесты сборки (переезжают вместе с кодом).
- `U7BotAppMeta` (`runners/u7-bot/src/core/u7-bot-app-meta.ts`) — композиция `*ApiModuleMeta` legacy `ApiApp`: корню нужен этот тип, а раннер корню недоступен. Тип API (`U7BotAppMeta`, `U7BotApp`) переезжает в `@u7-scl/app`; раннер импортирует его оттуда (переэкспорт из `u7-bot-app-meta.ts` допустим, UI-типы `U7BotUiAppResolve` остаются в раннере).

## Границы

- Новый пакет `platform/app` — `@u7-scl/app` (`package.json`: зависимости — `@u7-scl/core`, `@u7-scl/app-legacy`, `@u7-scl/domain`, пакеты модулей, `dmg-core` как у `runners/u7-bot`; `tsconfig.json` пакета — по образцу `platform/app-legacy`; путь `@u7-scl/app` в корневом `tsconfig.json`). `bun install`.
- Файлы пакета: `src/index.ts` (вход), `src/u7-app.ts`, `src/u7-app.types.ts` (`U7AppEnv`, `U7AppPorts`), `src/u7-caller-resolver.ts`, `src/u7-app-meta.ts`, тесты рядом. Имена — по образцу учебного приложения.
- Не трогать: `domain/**`, `modules/**` (кроме случая из «Эскалации»), `node_modules/dmg-core`, `data/`, `biome.json` (ARC-07 для нового пакета — Фаза 3), `conductor/`.

## Решения брифа

- **`U7App`** — класс: `constructor(env: U7AppEnv, ports?: U7AppPorts)`.
  - `U7AppEnv` — простые данные (ARC-09: приложение `process.env` не читает): `mode`, `dbDir`, параметры школы (`communityGroup`, `studentGroup`, `mentors?` — как сейчас из `BotConfig` в `createApiApp`), `replay?` (`ReplayStore` бота). Логгер — в `U7AppPorts` (`logger?`, по умолчанию `ConsoleLogger`), как `ExampleAppPorts`.
  - Строит всё, что сейчас строит `createApiApp`: резолвер legacy, репозитории `<dbDir>/…` (пути не меняются), legacy-модули и фасады, контекст DMG (`createDmgAppContext`), `ApiApp` DMG на фабриках (`createDmgApp`), legacy `ApiApp` с `.withDmg(...)` и `init(InProcJobScheduler)`.
  - Отдаёт поля, которые сейчас отдаёт `ApiAppBundle` (их использует UI раннера): `apiApp`, `eventBus`, `userFacade`, `userRepo`, `questionnaireFacade`, `streamModule`, `courseModule`, `school`, `appResolver`. Плюс `callers` (резолвер). `start()`/`stop()` — делегирование в legacy `apiApp.start()/stop()` (планировщик Job), если раннеру это удобнее; иначе раннер зовёт `apiApp` сам — выбери по коду `main.ts` и опиши в отчёте.
- **Резолвер `Caller`** (`U7CallerResolver`, D-50, TR-33): `resolve(uuid: string | undefined, trace: Trace): Promise<PersonCaller<…>>` над legacy `userFacade.getUserByUuid` (мост TR-11, контракт `user` не меняется): пользователь найден — `UserCaller` над ним (как сейчас `new UserCaller(actor)` в `U7BotUiStory.dispatchUc`), не найден или `uuid` нет — `GuestCaller`. Сбой фасада — исключение наружу (ERR-01, как в `ExampleCallerResolver`). Статуса «удалён» у legacy-пользователя нет — не выдумывай.
- Поведение бота не меняется: те же пути данных, тот же порядок `init`, та же шина (DMG поверх legacy, D-37).

## Шаги

### Шаг 1 — `U7App` в `@u7-scl/app` (эта задача)

TDD: тесты → запуск (red) → реализация → green.

- Тесты `U7App` (временный `dbDir`, по образцу `create-api-app.test.ts` и `example-app.test.ts`): сборка отдаёт поля бандла; модуль `wish` собран через `ApiApp` — UC `wish` исполняется через `apiApp.dispatch`; фасады по `dependsOn` — вызов `wish` доходит до зависимости (ошибка или ответ зависимости через фасад); резолвер — найденный пользователь → `UserCaller`, неизвестный uuid и `undefined` → `GuestCaller`.
- Перенеси существующие тесты `create-api-app.test.ts`, которые проверяют сборку, в пакет.
- **Раннер в этом шаге не трогай**: `create-api-app.ts`/`create-dmg-modules.ts` остаются до шага 2 (дублирование на один коммит допустимо).

### Шаг 2 — раннер `u7-bot` на `U7App`

- `main.ts`: `BotConfig` → `U7AppEnv` (чтение `process.env` остаётся в `config.ts`, ARC-09), `new U7App(env, { logger })`; UI (`create-ui-app.ts`) получает поля из `U7App`.
- Удалить `create-api-app.ts`, `create-dmg-modules.ts`, `create-api-app.test.ts`; `u7-bot-app-meta.ts` берёт `U7BotAppMeta`/`U7BotApp` из `@u7-scl/app` (дубль снят), UI-типы остаются.
- `U7BotUiStory.dispatchUc`: `Caller` — из `app.callers.resolve(actor.uuid, trace)` вместо `new UserCaller(actor)`; резолвер доходит до истории через резолв UI (`U7BotUiAppResolve`) — по образцу соседних полей. Поведение: актор истории всегда зарегистрирован, ответы UC не меняются.
- `tests/helpers/test-app.ts`: на `U7App`, если раскладка фикстур совпадает с `<dbDir>/…` (`U7AppEnv.dbDir = fixtures.dbDir`); если не совпадает — оставь как есть (только `createDmgApp` → из `U7App` недоступен: тогда эскалация) и опиши расхождение.
- Приёмка: гейт зелёный, `bun run test:bot` зелёный (980 pass на базовой линии), `grep` по `runners/` — импортов прикладных пакетов модулей нет, кроме того, что опишешь в отчёте.

### Шаг 3 — `u7-cli` и `scripts/call-uc.ts` на `U7App` (придёт отдельным сообщением)

## Критерии приёмки (шаг 1)

- `bun run scripts/agent-gate.ts` зелёный; `bun test platform/app` зелёный.
- `@u7-scl/app` не импортирует раннеры (D-53); пакеты модулей не импортируют `@u7-scl/app` (ARC-06, проверит `domain-check`).
- Правила: ARC-07 (D-52 — приложение импортирует входы прикладных пакетов, не внутренности: где legacy-модуль доступен только через подпуть `…/api`, `…/infra`, — бери как есть и перечисли в отчёте), ARC-09, ERR-01, D-53.

## Эскалация

- Нужна правка `modules/**`, `domain/**` или контракта модуля.
- Тип `U7BotAppMeta`/`Caller<U>` не сходится без `as unknown as` или type-level трюков.

## Открытые вопросы

—

## Отчёты

### migrator (Opus), шаг 1

Готово, гейт зелёный, `platform/app` — 11 pass. `U7App(env, ports?)` — перенос `createApiApp` как есть (пути, порядок, `withDmg`, `init`); `createDmgAppContext`/`createDmgApp` — приватные статические `dmgContext`/`dmgApp`; `start()`/`stop()` делегируют в `apiApp` (порядок в `main.ts` сохраняется). `U7CallerResolver` над `getUserByUuid`. `U7BotAppMeta`/`U7BotApp` — копия в `u7-app-meta.ts` (дубль снимается в шаге 2). Тесты `create-api-app.test.ts` перенесены без ослабления + 3 теста сборки + 4 резолвера (включая ERR-01). `DmgPlatform` не перенесён — поля из `U7AppEnv`/`U7AppPorts`.

Подпути legacy, которые берёт приложение (ARC-07, D-52 — свести в Ф3): `@u7-scl/{user,course,questionnaire}/{api,infra,domain}`, `@u7-scl/wish/{infra,wish}`, `@u7-scl/peer-review/domain`, `@u7-scl/app-legacy/domain`, `@u7-scl/core/*`.

Вопросы — решены оркестратором: `_trace` с комментарием — как в `wish`; повторный `init` в перенесённом тесте оставлен (проверяет переподписку); дубль меты — шаг 2.

### migrator (Opus), шаг 2

Готово, гейт зелёный, `test:bot` — 977 pass (980 − 4 перенесённых в `platform/app` + 1 новый). `main.ts` → `new U7App(env, { logger })`, `app.start()/stop()`; `createUiApp(app: UiAppSource, …)`; `U7BotUiAppResolve.callers`; `dispatchUc` — `callers.resolve(actor.uuid, trace)` (тест red → green); мета — переэкспорт из `@u7-scl/app`; `create-api-app{,.test}.ts` удалены; `test-app.ts` на `U7App` (`dbDir = fixtures.dbDir`, материализатор пишет и вложенные пути). Отклонение: `create-dmg-modules.ts` остаётся до шага 3 — его импортирует `scripts/call-uc.ts`.

Остались импорты прикладных пакетов в `runners/`: `tests/helpers/test-app.ts` (репозитории для проверки состояния, warn ARC-08 был и раньше), `controllers/streams/controller.ts` (`@u7-scl/stream`: `Student`, `StudentAr`, `StudentOutcomeCategory` — было до трека), `u7-cli` (шаг 3) — разобрать в Ф3.

Вопрос `callers` обязателен или нет — решено оркестратором: обязателен (один путь построения `Caller`).
