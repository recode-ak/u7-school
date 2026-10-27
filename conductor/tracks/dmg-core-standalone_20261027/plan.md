# Plan: dmg-core-standalone_20261027

Каждая задача — TDD (red → запуск → green, по шагам), `bun run check` зелёный в пакете и в проекте после каждой. Платформенный эталон — модель Opus. Данные `data/` не трогаем; пушей и публикаций нет.

## Фаза 0: Базовая линия [checkpoint: 4bf6b412]

- [x] Task: Зафиксировать базовую линию (`bun test` pass/fail по репо и по `dmg-core`, `bun run e2e` пакета) в черновике `summary.md` f1698d2
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md)

## Фаза 1: Корень сборки и учебное приложение

- [x] Task: Решение D-50 пакета «Корень сборки приложения»: что собирает пакет приложения (фабрика из окружения → `AppContext`, модули, `ModuleFacades` по `dependsOn`, резолвер `Caller`), что остаётся раннеру (точка входа, транспорт, окружение); обсудить с Нурболатом, записать в `docs/decisions.md`, `layers.md` §6 b167bda1
- [x] Task: `ApiApp` в `dmg-core/app` (D-50): фабрики модулей → порядок по `dependsOn`, `ModuleFacades` только зависимостей, `dispatch`/`runJob`/`subscribe` 094bd69d
    - [x] Тесты: порядок и фасады по `dependsOn`; цикл, отсутствующая зависимость, повтор — ошибка сборки; `dispatch` неизвестного модуля — `OPERATION_NOT_FOUND`; red
    - [x] Реализация; экспорт из `dmg-core/app`; green
- [~] Task: Учебное приложение `src/testing/example/app` — сборка
    - [x] Боевые `InProcEventBus` и `ConsoleLogger` в `dmg-core/app`, `AwaitingBus` в `dmg-core/testing` (решение Нурболата 2026-10-27); тесты red → green 3fca9f3c
    - [ ] Плавающий `platform/core/src/legacy-bridge/example-app.test.ts` (`settle` через `setTimeout`) — ожидание доставки по образцу `AwaitingBus` (решение Нурболата 2026-10-27)
    - [ ] Тесты: фабрика собирает `todo` и `users` с фасадами по `dependsOn`, UC через модуль, событие доходит до реакции, запись в oplog; запуск — red
    - [ ] Реализация фабрики (`InProcOutbox`/`InProcInbox`, лог операций, `Logger`); запуск — green
- [ ] Task: Минимальный in-proc раннер учебного примера (CLI-команда → `Caller` → UC → вывод `Result`)
    - [ ] Тест раннера (команда вызывает UC; ошибка ввода — код 1); red
    - [ ] Реализация; green
- [ ] Task: `ExampleArch` и `arch:check` пакета охватывают приложение и раннер; какие правила (ARC) на них распространяются
- [ ] Task: Гайд `docs/guides/app.md` (по `_template.md`) на учебном приложении; ссылки из `guides/index.md`, `layers.md`, `llms.txt`
- [ ] Task: Ревью reviewer
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: `init --profile` и `gen module` в монорепо

- [ ] Task: Каркас как план файлов (по образцу `GenPlan`/`applyPlan`: без перезаписи, dry-run)
    - [ ] Тесты плана `single`: `package.json` со скриптами, tsconfig, `biome.json` с картой плагинов, `dmg-core.json`, `arch-check.ts` на `GenLayout`, каркас приложения и раннера; red
    - [ ] Реализация; green
- [ ] Task: Профиль `monorepo`
    - [ ] Тесты плана: workspace, пакет домена (`exports` `./*/contract`, `./*`), пакет приложения, `modules/`, `runners/`, секция `gen` с `domainImport`, карта плагинов по пакетам, корневой `check`; red
    - [ ] Реализация; green
- [ ] Task: CLI `dmg-core init --profile single|monorepo` (без профиля — прежнее поведение; неизвестный профиль — ошибка); тесты CLI red → green
- [ ] Task: `gen module` в профиле monorepo создаёт пакет модуля (`package.json`, tsconfig); как узнаётся профиль — поле `dmg-core.json` или признак раскладки (решить в задаче); тесты red → green
- [ ] Task: `consumer-e2e.sh` — оба профиля: `init --profile` → `gen module/aggregate/uc` → сборка приложения → раннер вызывает UC → `check` зелёный
- [ ] Task: Документация
    - [ ] Гайд `docs/guides/project.md`: оба профиля, что создаёт `init`, как растёт проект, кто что правит руками
    - [ ] README — быстрый старт обоих профилей
    - [ ] Карта «плагин → каталоги слоёв» в `rules.md`
    - [ ] `naming.md` §5, `llms.txt`, скил `dmg-architecture`
- [ ] Task: Ревью reviewer
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Агентная приёмка

- [ ] Task: Прогон: субагент в пустом каталоге вне репо, только tarball пакета (`bun pm pack`), без доступа к u7-school; задача — поднять monorepo с модулем `todo`, агрегатом, UC и вызовом через раннер, `check` зелёный; протокол: какие документы читал, где застрял, что угадал
- [ ] Task: Закрыть найденные пробелы (документация или каркас; с тестами, если код)
- [ ] Task: Повторный прогон — чистый, без угадываний; профиль `single` — короткий прогон
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: Локальный вынос

- [ ] Task: Способ подключения в u7-school (`link:` / `file:` / workspace-путь вне репо): проверка `dmg-core sync`, `gen`, biome-плагинов `node_modules/dmg-core/…`, tsc; согласовать с Нурболатом
- [ ] Task: Репозиторий пакета: `git subtree split --prefix=platform/dmg-core` → `~/dev/kalki/tools/dmg/dmg-core` (с историей); в нём `bun install && bun run check && bun run e2e` зелёные
- [ ] Task: u7-school на вынесенном пакете
    - [ ] Замена зависимости `workspace:*`
    - [ ] Удаление `platform/dmg-core` — после подтверждения Нурболата
    - [ ] `extract:check` — убрать из `check` или переделать на проверку внешнего репо
    - [ ] `bun run check` зелёный
- [ ] Task: Документация проекта: ссылки `platform/dmg-core/…` → `node_modules/dmg-core/…` (`conductor/architecture`, скилы, `AGENTS.md`, `tech-stack.md`); процесс правки платформы (репо пакета → u7-school)
- [ ] Task: Чек-лист публикации в репо пакета: актуальные пути, сравнение npm / приватный registry или scope / git с рекомендацией
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

## Финал

- [ ] Task: Гейт качества (workflow): полный `CI=true bun test` проекта и репо пакета, триаж, сверка тестов (тесты пакета ушли в его репо)
- [ ] Task: `summary.md`, `tracks.md`, архив
