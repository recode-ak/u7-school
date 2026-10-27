# Plan: command-dispatch_20261027

Старт после `dmg-core-oop`. Каждая задача — TDD (red → запуск → green, по шагам), `bun run check` и `arch:check` зелёные после каждой. Платформа — модель Opus. Данные `data/` не трогаем.

## Фаза 0: Решение и контракт

- [x] Task: D-49 в `decisions.md` («Def — типы клиента, команда — исполнение; модуль адресует транспорт, не команда»); `transport.md` §2 и §4 обновить (`uc` без модуля, `moduleApi` на клиенте) `9f7e822`
- [ ] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md)

## Фаза 1: Команда и ответ

- [ ] Task: Тип `Command<D>` (`{ uc, input, meta? }`, фантомный `D`) и `UseCaseDef.command(input)`; тесты типов (вывод `InputOf`/`OutputOf`)
- [ ] Task: Сериализуемый `Result` (формат `transport.md`) и обратное восстановление; круговой тест через `JSON.stringify/parse`
- [ ] Task: Ревью reviewer
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: Исполнение

- [ ] Task: `ModuleFromDef`: поиск UC по имени вместо `Map` по ссылке на Def; `dispatch(command, caller, trace)`; неизвестный `uc` → `Err` (код уточнить в задаче)
- [ ] Task: `apiApp`: выбор `apiModule` по адресу транспорта, неизвестный модуль → `Err`
- [ ] Task: `ModuleFacade` (D-43) — через команды, типизированный сахар поверх
- [ ] Task: Гайды facade, module
- [ ] Task: Ревью reviewer
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Клиент и потребители

- [ ] Task: In-proc `moduleApi` (адрес модуля + `dispatch(ucDef.command(input))` → типизированный `Result`)
- [ ] Task: Бот-истории `runners/u7-bot` и CLI на `moduleApi`; в раннерах нет `handle(def, …)`
- [ ] Task: Финал: гейт качества (workflow) — полный `CI=true bun test`, `tsc`, `biome`, `arch:check`, триаж в `summary.md`
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)
