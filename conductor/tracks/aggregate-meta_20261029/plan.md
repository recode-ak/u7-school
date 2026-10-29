# Plan: aggregate-meta_20261029

Каждая задача — TDD (red → запуск → green, по шагам). Правки пакета — коммит в `~/dev/tools/dmg/dmg-core` (зелёные `check` и `e2e`), затем в u7-school `bun install` (+ `dmg:sync`/`agents:sync` при изменении доставляемых документов), `check`, коммит с SHA пакета. Данные `data/` не трогаем; пушей и деплоя нет.

## Фаза 0: Базовая линия [checkpoint: a7f2f74]

- [x] Task: Зафиксировать базовую линию (`bun test` pass/fail в u7-school и в пакете, `bun run e2e` пакета) в черновике `summary.md` f5d9a4f
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md)

## Фаза 1: Решение D-57 [checkpoint: f9ee988]

- [x] Task: Черновик D-57 в `decisions.md` пакета: `EntityMeta`, плоское хранение, `view().meta`, судьба геттера `version`; варианты канала ожидаемой версии (`CommandMeta.expectedVersion` vs поле входа UC) с плюсами и минусами 6e877f3; пересмотрено — VO `meta` отвергнут (dmg-core b64a0b4)
- [x] Task: Обсудить канал ожидаемой версии с Нурболатом; записать D-57 (dmg-core) 6e877f3 (выбран вариант B — поле входа UC)
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: Ожидаемая версия от клиента (dmg-core)

- [x] Task: `F.expectedVersion()` и удаление `CommandMeta.version` (dmg-core 53e66d1)
    - [x] Тесты: схема поля (целое ≥ 0, необязательное, отказ на отрицательном/дробном); команда без `version` в `meta`; red
    - [x] Реализация; green
- [x] Task: Шаг `expectVersion(ar, expected)` в `UseCaseFromDef` (dmg-core 0156ec3)
    - [x] Тесты: совпала — операция идёт; расходится — `Err(VERSION_CONFLICT)` без фиксации и событий; не прислана — сверки нет; red
    - [x] Реализация; green
- [x] Task: Учебный модуль: `completeTask` с `expectedVersion`, тест; генератор — по необходимости (dmg-core 6ed31b6; генератор не меняется — сверка по выбору UC)
- [x] Task: Документация: гайд `use-case`, `transport.md` §2, `llms.txt` (dmg-core 275661f; плюс `errors-result.md` и описание `VERSION_CONFLICT`)
- [x] Task: Ревью reviewer; правки по ревью (dmg-core dbfbbe0; error нет; warning о сверке после мутации — задокументировано, `storedVersion` не подходит для `ReadonlyAr`; принято: метка `F.expectedVersion(label)`, тесты через вход и порядок отказов; при релизе отметить удаление `CommandMeta.version`)
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: `wish` в u7-school

- [ ] Task: `bun install`, `dmg:sync`/`agents:sync`; `check` — список поломок
- [ ] Task: `cancelWish` с `expectedVersion`: тест (совпала / расходится / не прислана) red → green
- [ ] Task: Ревью reviewer; правки по ревью
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: Финал

- [ ] Task: `summary.md`: итог, сравнение с базовой линией, TR трека; `migration.md`/`debt.md` при необходимости
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)
