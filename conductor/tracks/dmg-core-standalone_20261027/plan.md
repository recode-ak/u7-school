# Plan: dmg-core-standalone_20261027

Каждая задача — TDD (red → запуск → green, по шагам), `bun run check` зелёный в пакете и в проекте после каждой. Платформенный эталон — модель Opus. Данные `data/` не трогаем; пушей и публикаций нет.

## Фаза 0: Базовая линия [checkpoint: 4bf6b412]

- [x] Task: Зафиксировать базовую линию (`bun test` pass/fail по репо и по `dmg-core`, `bun run e2e` пакета) в черновике `summary.md` f1698d2
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md)

## Фаза 1: Корень сборки и учебное приложение [checkpoint: 9f458e0f]

- [x] Task: Решение D-50 пакета «Корень сборки приложения»: что собирает пакет приложения (фабрика из окружения → `AppContext`, модули, `ModuleFacades` по `dependsOn`, резолвер `Caller`), что остаётся раннеру (точка входа, транспорт, окружение); обсудить с Нурболатом, записать в `docs/decisions.md`, `layers.md` §6 b167bda1
- [x] Task: `ApiApp` в `dmg-core/app` (D-50): фабрики модулей → порядок по `dependsOn`, `ModuleFacades` только зависимостей, `dispatch`/`runJob`/`subscribe` 094bd69d
    - [x] Тесты: порядок и фасады по `dependsOn`; цикл, отсутствующая зависимость, повтор — ошибка сборки; `dispatch` неизвестного модуля — `OPERATION_NOT_FOUND`; red
    - [x] Реализация; экспорт из `dmg-core/app`; green
- [x] Task: Учебное приложение `src/testing/example/app` — сборка 161af694
    - [x] Боевые `InProcEventBus` и `ConsoleLogger` в `dmg-core/app`, `AwaitingBus` в `dmg-core/testing` (решение Нурболата 2026-10-27); тесты red → green 3fca9f3c
    - [x] Плавающий `platform/core/src/legacy-bridge/example-app.test.ts` (`settle` через `setTimeout`) — ожидание доставки по образцу `AwaitingBus` (решение Нурболата 2026-10-27) 596286e6
    - [x] Тесты: фабрика собирает `todo` и `users` с фасадами по `dependsOn`, UC через модуль, событие доходит до реакции, запись в oplog; запуск — red 74c0ceac
    - [x] Реализация фабрики (`InProcOutbox`/`InProcInbox`, лог операций, `Logger`); запуск — green 74c0ceac
    - [x] `OperationRef.kind: 'app'` — вызов от корня сборки (резолвер `Caller`); запись D-NN в `decisions.md` пакета, резолвер `ExampleApp` на нём (решение Нурболата 2026-10-27); тесты red → green 161af694
- [x] Task: Минимальный in-proc раннер учебного примера (CLI-команда → `Caller` → UC → вывод `Result`) 9d89ac84
    - [x] Тест раннера (команда вызывает UC; ошибка ввода — код 1); red 9d89ac84
    - [x] Реализация; green 9d89ac84
- [x] Task: `ExampleArch` и `arch:check` пакета охватывают приложение и раннер; какие правила (ARC) на них распространяются 277f86d2
    - Решение D-52: ARC-07/08/09 под корень сборки и раннер; ARC-09 — всё, кроме точки входа раннера
- [x] Task: Гайд `docs/guides/app.md` (по `_template.md`) на учебном приложении; ссылки из `guides/index.md`, `layers.md`, `llms.txt` 44a8aa5b
- [x] Task: Ревью reviewer 41bd6e7e
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md) 9f458e0f

## Фаза 2: `init --profile` и `gen module` в монорепо [checkpoint: 48bd5c05]

- [x] Task: Каркас как план файлов (по образцу `GenPlan`/`applyPlan`: без перезаписи, dry-run) 00ca6cde
    - [x] Тесты плана `single`: `package.json` со скриптами, tsconfig, `biome.json` с картой плагинов, `dmg-core.json`, `arch-check.ts` на `GenLayout`, каркас приложения и раннера; red
    - [x] Реализация; green
- [x] Task: Профиль `monorepo` 5ef27a47
    - [x] Тесты плана: workspace, пакет домена (`exports` `./*/contract`, `./*`), пакет приложения, `modules/`, `runners/`, секция `gen` с `domainImport`, карта плагинов по пакетам, корневой `check`; red
    - [x] Реализация; green
- [x] Task: CLI `dmg-core init --profile single|monorepo` (без профиля — прежнее поведение; неизвестный профиль — ошибка); тесты CLI red → green e2f56aee
- [x] Task: `gen module` в профиле monorepo создаёт пакет модуля (`package.json`, tsconfig); признак — поле `gen.package` (решение Нурболата 2026-10-27); тесты red → green 9220518f
    - Учесть D-52: `gen module` создаёт `index.ts` прикладного пакета (фабрика, `*Deps`, репозитории) — корень сборки берёт фабрику только из него; `GenLayout`/шаблон `ArchApp` отдают `root` и `runners`
- [x] Task: `consumer-e2e.sh` — оба профиля: `init --profile` → `gen module/aggregate/uc` → сборка приложения → раннер вызывает UC → `check` зелёный dcbe6f68
    - Пробелы каркаса monorepo из e2e: домен в корне, `overrides.dmg-core` при установке не из реестра (решение Нурболата 2026-10-28)
- [x] Task: Документация 19397630
    - [x] Гайд `docs/guides/project.md`: оба профиля, что создаёт `init`, как растёт проект, кто что правит руками
    - [x] README — быстрый старт обоих профилей
    - [x] Карта «плагин → каталоги слоёв» в `rules.md`
    - [x] `naming.md` §5 (`gen.package`, вход прикладного слоя `index.ts`, `--adopt` пропускает `package.json`/`tsconfig.json`), `llms.txt`, скил `dmg-architecture`
- [x] Task: Ревью reviewer 305a8dea
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Агентная приёмка

- [x] Task: Прогон: субагент в пустом каталоге вне репо, только tarball пакета (`bun pm pack`), без доступа к u7-school; задача — поднять monorepo с модулем `todo`, агрегатом, UC и вызовом через раннер, `check` зелёный; протокол: какие документы читал, где застрял, что угадал 8bf3c0a4
- [~] Task: Закрыть найденные пробелы (документация или каркас; с тестами, если код); бриф — `slices/phase-3.md`
    - [x] Подключение модуля генератором по маркерам: `app.ts`, `arch-check.ts`, `app/package.json`, репозиторий агрегата (G8, R1) 2caf0bbb
    - [x] Заготовка UC: `emits` по имени, типизированный `execute`, `callers`, готовый репозиторий в тесте (G2, G3, G6) ab580052
    - [ ] Раннер каркаса: `call <module>.<operation>` (G10)
    - [ ] `overrides` с относительным путём к tarball (R2)
    - [ ] `scripts/gen-e2e.test.ts` без гонки: срез не в каталогах репо или без обнаружения чужим `bun test` (плавающий `ENOENT reading …/genprobe/…test.ts`)
    - [ ] Документация: `use-case.md`, `project.md`, `aggregate.md`, `naming.md` §5 (G1, G4, G5, G7, G9, G11)
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
