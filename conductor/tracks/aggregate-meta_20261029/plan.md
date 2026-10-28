# Plan: aggregate-meta_20261029

Каждая задача — TDD (red → запуск → green, по шагам). Правки пакета — коммит в `~/dev/tools/dmg/dmg-core` (зелёные `check` и `e2e`), затем в u7-school `bun install` (+ `dmg:sync`/`agents:sync` при изменении доставляемых документов), `check`, коммит с SHA пакета. Данные `data/` не трогаем; пушей и деплоя нет.

## Фаза 0: Базовая линия [checkpoint: a7f2f74]

- [x] Task: Зафиксировать базовую линию (`bun test` pass/fail в u7-school и в пакете, `bun run e2e` пакета) в черновике `summary.md` f5d9a4f
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md)

## Фаза 1: Решение D-57

- [x] Task: Черновик D-57 в `decisions.md` пакета: `EntityMeta`, плоское хранение, `view().meta`, судьба геттера `version`; варианты канала ожидаемой версии (`CommandMeta.expectedVersion` vs поле входа UC) с плюсами и минусами 6e877f3
- [x] Task: Обсудить канал ожидаемой версии с Нурболатом; записать D-57 (dmg-core) 6e877f3 (выбран вариант B — поле входа UC)
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: VO `meta` в агрегате (dmg-core)

- [ ] Task: `EntityMeta` и `Aggregate.meta`
    - [ ] Тесты: `meta` нового и восстановленного агрегата, рост `version` и `updatedAt` после `change`/`transition`, неизменяемость VO, `storedVersion` без изменений; red
    - [ ] Реализация, экспорт из корня `dmg-core`; green
- [ ] Task: `view()` по умолчанию с `meta`
    - [ ] Тесты: форма `view()` (`uuid`, `meta`, поля предметки без плоских метаполей), агрегат со своей `V`; red
    - [ ] Реализация; green
- [ ] Task: Учебный модуль и генератор (`gen` aggregate) — на `meta`; тесты генератора и `consumer-e2e` зелёные
- [ ] Task: Тест репозитория: формат записи в хранилище не изменился (плоские поля)
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Ожидаемая версия от клиента (dmg-core)

- [ ] Task: Канал ожидаемой версии по D-57 (`CommandMeta` → контекст UC или поле входа)
    - [ ] Тесты: версия доходит от `dispatch`/`dispatchByName` до UC; без версии — `undefined`; red
    - [ ] Реализация; green
- [ ] Task: Шаг `expectVersion(ar)` в `UseCaseFromDef`
    - [ ] Тесты: совпала — операция идёт; расходится — `Err(VERSION_CONFLICT)` без фиксации и событий; не прислана — сверки нет; red
    - [ ] Реализация; green
- [ ] Task: Учебный модуль: `completeTask` с ожидаемой версией, тест
- [ ] Task: Документация: гайды `aggregate`, `use-case`, `transport.md` §2, `llms.txt`
- [ ] Task: Ревью reviewer; правки по ревью
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: `wish` в u7-school

- [ ] Task: `bun install`, `dmg:sync`/`agents:sync`; `check` — список поломок
- [ ] Task: Домен `wish`: правила и Ar читают `meta` (`createdAt` в выборе «последнего»); тесты домена red → green
- [ ] Task: Прикладной слой `wish`: репозиторий (сортировка по `meta.createdAt`), выходы UC; тест формата JSON-записи прежний
- [ ] Task: Бот: потребители `view` желаний (рендереры, stories) — на `meta`; e2e-тесты бота зелёные
- [ ] Task: UC `wish` со сменой статуса — тест ожидаемой версии (совпала / расходится)
- [ ] Task: Ревью reviewer; правки по ревью
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

## Фаза 5: Финал

- [ ] Task: `summary.md`: итог, сравнение с базовой линией, TR трека; `migration.md`/`debt.md` при необходимости
- [ ] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md)
