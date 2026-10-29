# Summary: app-assembly_20261029


## Базовая линия (2026-10-29)

| Где | Команда | Результат |
|---|---|---|
| u7-school (`258e50da`) | `CI=true bun test` | 3308 pass, 0 fail (342 файла) |
| u7-school (`258e50da`) | `bun run test:bot` (e2e-тесты бота) | 980 pass, 0 fail (90 файлов) |
| dmg-core (`dbfbbe0`) | `CI=true bun test` | 1330 pass, 0 fail (130 файлов) |
| dmg-core (`dbfbbe0`) | `bun run e2e` | `e2e: ok` |

## Разбор сборки (Фаза 2, 2026-10-29)

**Что есть.** `runners/u7-bot/src/create-api-app.ts` собирает всё приложение: legacy-модули (`user`, `course`, `questionnaire`, `stream`, `peer-review`) с репозиториями и фасадами, затем `create-dmg-modules.ts` — контекст DMG поверх legacy-шины и модули DMG (внешние `user`/`course`/`questionnaire`/`stream` над legacy-фасадами, TR-11, и `wish`), фасады раскладываются руками. Все модули подключаются к legacy `ApiApp` из `@u7-scl/core/api` (`addDmgModules`). Этот объект — общий `appApi` историй: legacy `execute`, DMG `dispatch`, подписка реакций DMG в `init`, Job DMG в общем планировщике (`legacyJobsOf`). `UserCaller` строит бот сам, в `U7BotUiStory.dispatchUc` над legacy-актором. Собственные сборки есть ещё у `runners/u7-cli/src/main.ts` (legacy `user` + `course`), у `scripts/call-uc.ts` и у `runners/u7-bot/tests/helpers/test-app.ts`.

**Препятствие.** `@u7-scl/app` сейчас — legacy-ядро приложения: из `@u7-scl/app/domain` его импортируют `domain/` и все `modules/*` (~184 импорта: `U7ModuleResolver`, `U7UseCase`, `U7ApiModule`, `School`, `U7_SCHOOL_ID`). Корень сборки в этом пакете дал бы цикл `app ↔ modules/*` (D-53, ARC-06).

**Решения (Нурболат, 2026-10-29; TR-33):**
1. Legacy-содержимое `@u7-scl/app` (`domain/`, `infra/logger`) переезжает в новый пакет `@u7-scl/app-legacy` (`platform/app-legacy`). Импорты правятся механически, поведение не меняется. После этого `@u7-scl/app` — чистый корень сборки по D-50.
2. Корень собирает **всё** приложение (legacy и DMG): `create-api-app.ts` и `create-dmg-modules.ts` переезжают в `@u7-scl/app`. Раннеры (`u7-bot`, `u7-cli`) и `call-uc.ts` получают приложение из `AppEnv`. ARC-08 на раннерах — без исключений.
3. Резолвер `Caller` — в приложении, над legacy `userFacade` (мост TR-11): uuid → активный пользователь → `UserCaller`, иначе `GuestCaller`. Контракт `user` не меняется.

**Что переезжает в `@u7-scl/app`:**
- `U7App` — класс приложения: `AppEnv` (режим, `dbDir`, параметры школы, `replay`, порты для тестов) → legacy-резолвер, репозитории, legacy-модули и фасады, `AppContext` DMG (бывший `createDmgAppContext`), фабрики модулей DMG (`ModuleFactory`) → `ApiApp` из `dmg-core/app` (раскладка по `dependsOn`), legacy `ApiApp` (`appApi`), резолвер `callers`, `start()`/`stop()`.
- Legacy `ApiApp` (`@u7-scl/core/api`) принимает вместо `addDmgModules` готовый `ApiApp` DMG и Def его модулей: `dispatch` делегирует в него, подписка — `subscribe()`, Job — `legacyJobsOf` над `runJob` DMG.

**Что остаётся раннеру:** чтение `process.env` → `AppEnv` (ARC-09), транспорт (grammy/elysia, CLI), `Trace` (канал, `requestId`), запуск и остановка. `dispatchUc` получает `Caller` из `app.callers` вместо `new UserCaller(actor)`. UI-слой (`create-ui-app.ts`, истории, контроллеры) остаётся в раннере, а поля `ApiAppBundle` (фасады и модули, которые использует UI) отдаёт `U7App`.

**Порядок правок (задачи Фазы 2):** вынос `@u7-scl/app-legacy` → делегирование DMG в legacy `ApiApp` → `U7App` с тестами → бот → CLI и `call-uc.ts`.

## Итог (2026-10-29)

**Сделано по spec:**
1. **Шаг `fetch` после Policy (TR-27, D-58 пакета):** `load` (контекст Policy) → Policy → `fetch` (чужие вызовы после права) → правила (`L & F`) → `execute`; API-07 запрещает `this.call` в `load`. UC `wish` перенесли чужие вызовы в `fetch`. TR-27 закрыт.
2. **Корень сборки (DEBT-39):** legacy-ядро вынесено в `@u7-scl/app-legacy` (TR-33), `@u7-scl/app` — `U7App` собирает всё приложение по `AppEnv` через `ApiApp` пакета; резолвер `Caller` — `U7CallerResolver`. Раннеры `u7-bot`, `u7-cli` и `call-uc.ts` получают приложение из `U7App`; `create-api-app.ts`, `create-dmg-modules.ts` удалены. Поведение бота проверено Нурболатом (фикстуры, «Хочу на курс», oplog).
3. **Правила D-52 — машинные:** ARC-08 (`DomainArch` с `root`/`runners`), ARC-07 в корневом `biome.json` для `platform/app/src/**`, D-53 (ARC-06) — `checkModuleImports`, ARC-09 — на всё, кроме точек входа раннеров. DEBT-39 снят.
4. **Гигиена:** `agents:sync` на `Role` пакета (`Role.renderEnv`, TR-29 закрыт); комментарии пакета без «legacy» приложения (TR-28 закрыт); `migration.md` §6 по факту.

**Сравнение с базовой линией:**

| Где | База (`258e50da` / `dbfbbe0`) | Финал (`6811ea3e` / `00bda68`) | Разница |
|---|---|---|---|
| u7-school `CI=true bun test` | 3308 pass, 0 fail, 342 файла | 3330 pass, 0 fail, 343 файла | +22: тесты `U7App`, `U7CallerResolver`, `withDmg` legacy `ApiApp`, `DomainArch`/ARC-08, `checkModuleImports`, `config`; характеризация `buildCopies` вместо тестов разбора (сценарии — в `role.test.ts` пакета) |
| `bun run test:bot` | 980 pass, 90 файлов | 978 pass, 89 файлов | −4 перенесены вместе с `create-api-app.test.ts` в `platform/app/tests/u7-app.test.ts`; +1 (Ф2) и +1 `config.test.ts` (ARC-09, окружение — параметр) |
| dmg-core `CI=true bun test` | 1330 pass, 130 файлов | 1345 pass, 130 файлов | +15: шаг `fetch`, учебный `assignTask`, API-07, `Role.renderEnv` |
| dmg-core `bun run e2e` | `e2e: ok` | `e2e: ok` | — |

**Триаж (гейт закрытия):** красных тестов нет — промежуточных состояний и регрессов нет. Удалённые и переписанные тестовые файлы (`create-api-app.test.ts`, тесты `parseRole`/`renderRole`) — сценарии перенесены и сверены (ревью Ф2 и Ф4).

**TR трека:** TR-32 (`fetch` — типовые ограничения `F`, склейка `L & F`), TR-33 (корень `@u7-scl/app`, legacy — `app-legacy`), TR-34 (ревью Ф2), TR-35 (нарушения ARC-07/08 при включении `root`/`runners`), TR-36 (охват ARC-09). Закрыты: TR-27, TR-28, TR-29.

**Новый долг:** DEBT-42 (`u7-cli` и `call-uc` — два ручных входа; `u7-cli` сейчас не стартует без `about.md`).

**Ревью:** reviewer по Ф1–Ф4 — без `error`; warning исправлены (`c8d0e93` пакета, `d9d2417`, `62b7768`).

**Следующий трек:** `stream-student` — шаги старта в `migration.md` §6.
