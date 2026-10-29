# Summary: app-assembly_20261029

> Черновик: заполняется по ходу трека.

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
