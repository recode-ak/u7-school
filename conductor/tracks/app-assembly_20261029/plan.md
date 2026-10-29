# Plan: app-assembly_20261029

Выполняется после `aggregate-meta_20261029`. Каждая задача — TDD (red → запуск → green, по шагам). Правки пакета — коммит в `~/dev/tools/dmg/dmg-core` (зелёные `check` и `e2e`), затем в u7-school `bun install` (+ `dmg:sync`/`agents:sync` при изменении доставляемых документов), `check`, коммит с SHA пакета. Данные `data/` не трогаем; пушей, деплоя и перезапуска прода нет.

## Фаза 0: Базовая линия [checkpoint: 18f3b93]

- [x] Task: Зафиксировать базовую линию (`bun test` pass/fail в u7-school и в пакете, `bun run e2e` пакета, e2e-тесты бота) в черновике `summary.md` `08ebca5`
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md) — автономно

## Фаза 1: Вызовы после Policy (TR-27, dmg-core) [checkpoint: 615164e]

> Решение (Нурболат, 2026-10-29): шаг `fetch` не вводим — D-58; секретный ответ зависимости — значением в контекст, отказ — правилом после Policy. Задачи `fetch` в `UseCaseFromDef`, учебного `assignTask` и генератора сняты.

- [x] Task: Решение D-58 в `decisions.md` пакета: порядок `load` → Policy → правила → `execute` сохранён, `fetch` отвергнут; согласовано с Нурболатом `dmg-core 12e2791`
- [x] Task: Гайд `use-case`: ловушка «вызов зависимости в `load` идёт до права» — неудобства и способы решения (D-58) `dmg-core 12e2791`
- [x] Task: u7-school: `bun install`, `dmg:sync`; UC `wish` — чужие вызовы в `load` (`createCourseWish`, `createModuleWish`: `allowAll`, ответ о самом субъекте — секретности нет, правок нет); закрыть TR-27 в `debt.md` `79eab71`
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md) — автономно

## Фаза 2: Корень сборки в `@u7-scl/app` (DEBT-39)

- [ ] Task: Разбор `runners/u7-bot/src/create-dmg-modules.ts`: что переезжает в `@u7-scl/app` (контекст, модули, адаптеры TR-11, резолвер `Caller`), что остаётся раннеру; план правок — в `summary.md`
- [ ] Task: Сборка в `@u7-scl/app`
    - [ ] Тесты: приложение собирает модуль `wish` через `ApiApp`, раскладка фасадов по `dependsOn`, резолвер `Caller`; red
    - [ ] Реализация; green
- [ ] Task: Раннер `u7-bot` получает приложение из `AppEnv`; `create-dmg-modules.ts` удалён; e2e-тесты бота зелёные
- [ ] Task: Раннер `u7-cli` — проверить и перевести на сборку приложения, если собирает модули сам
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Правила D-52

- [ ] Task: `DomainArch` с `root` и `runners`; тест-фикстура: раннер импортирует прикладной пакет → ARC-08; red → green
- [ ] Task: ARC-07 корневого `biome.json` — как в пакете (входы `modules/<m>` для app); фикстура `lint-fixtures`
- [ ] Task: ARC-09 — на всё, кроме точек входа раннеров; поправить найденные нарушения или завести DEBT
- [ ] Task: `rules.md` — карта правил; снять маркер и запись DEBT-39
- [ ] Task: Ревью reviewer; правки по ревью
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: Гигиена (TR-28, TR-29, документация)

- [ ] Task: TR-29: `scripts/agents-sync.ts` на `Role` из `dmg-core/cli` либо цель пакета с общим блоком проекта (выбрать по разбору, при смене API пакета — согласовать); тест: вывод `agents:sync` не изменился; закрыть TR-29
- [ ] Task: TR-28: вычистить пути `platform/dmg-core/…` и «остатки legacy» в комментариях пакета, сообщения ARC-10, комментарий `dom-17-snapshot-repo-only.grit` (dmg-core); закрыть TR-28
- [ ] Task: `migration.md` §6 — «Состояние переноса», «Входной долг», «Старт следующих треков» по факту; `index.md` архитектуры при необходимости
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

## Фаза 5: Финал

- [ ] Task: `summary.md`: итог, сравнение с базовой линией, TR трека
- [ ] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md)
