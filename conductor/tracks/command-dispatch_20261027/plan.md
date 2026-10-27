# Plan: command-dispatch_20261027

Старт после `dmg-core-oop`. Каждая задача — TDD (red → запуск → green, по шагам), `bun run check` и `arch:check` зелёные после каждой. Платформа — модель Opus. Данные `data/` не трогаем.

## Фаза 0: Решение и контракт [checkpoint: feeb6ae]

- [x] Task: D-49 в `decisions.md` («Def — типы клиента, команда — исполнение; модуль адресует транспорт, не команда»); `transport.md` §2 и §4 обновить (`uc` без модуля, `moduleApi` на клиенте) `9f7e822`
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md) `feeb6ae`

## Фаза 1: Команда и ответ [checkpoint: 2063d07]

- [x] Task: Тип `Command<D>` (`{ uc, input, meta? }`, фантомный `D`) и `UseCaseDef.command(input)`; тесты типов (вывод `InputOf`/`OutputOf`) `050c1b5`
- [x] Task: Сериализуемый `Result` (формат `transport.md`) и обратное восстановление; круговой тест через `JSON.stringify/parse` `2702e42`
- [x] Task: Ревью reviewer `21af1c5`
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md) `2063d07`

## Фаза 2: Исполнение [checkpoint: ac0ac06]

- [x] Task: `ModuleFromDef`: поиск UC по имени вместо `Map` по ссылке на Def; `dispatch(command, caller, trace)`; неизвестный `uc` → `Err` `OPERATION_NOT_FOUND` (базовая ошибка ядра) `75de786`
- [x] Task: `apiApp`: выбор `apiModule` по адресу транспорта, неизвестный модуль → `Err` `bcadc01`
- [x] Task: `ModuleFacade` (D-43) — через команды, типизированный сахар поверх; сборка команды в обобщённом коде — в одном месте с `UseCaseDef.command` (ревью Ф1: `command` исключён из `AnyUseCaseDef`) `f993bf6`
- [x] Task: Гайды facade, module `78e745e`
- [x] Task: Ревью reviewer `ba32277`
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md) `ac0ac06`

## Фаза 3: Клиент и потребители [checkpoint: 8b3c8ec]

- [x] Task: In-proc `moduleApi` (адрес модуля + `dispatch(ucDef.command(input))` → типизированный `Result`); расхождение ответа с контрактом (`restoreResult` → `SERVER_INTERNAL`) — `warn` в лог с исходным `code` (ERR-07, ревью Ф1) `0a9c3f3`
- [x] Task: Бот-истории `runners/u7-bot` и CLI на `moduleApi`; в раннерах нет `handle(def, …)` `19b63bc`
- [x] Task: Финал: гейт качества (workflow) — полный `CI=true bun test`, `tsc`, `biome`, `arch:check`, триаж в `summary.md` `93e019d`
- [x] Task: Переделка B (решение Нурболата): in-proc потребители — `ApiApp.dispatch(moduleDef, command, …)` с проверкой UC модуля по типу, без `ModuleApi`; `ModuleApi` — клиент wire-транспорта (`SerializedResult` → `restore` + `warn`) `1dbdd05`
- [x] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md) `8b3c8ec`
