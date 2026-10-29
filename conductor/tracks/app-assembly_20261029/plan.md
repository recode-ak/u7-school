# Plan: app-assembly_20261029

Выполняется после `aggregate-meta_20261029`. Каждая задача — TDD (red → запуск → green, по шагам). Правки пакета — коммит в `~/dev/tools/dmg/dmg-core` (зелёные `check` и `e2e`), затем в u7-school `bun install` (+ `dmg:sync`/`agents:sync` при изменении доставляемых документов), `check`, коммит с SHA пакета. Данные `data/` не трогаем; пушей, деплоя и перезапуска прода нет.

## Фаза 0: Базовая линия [checkpoint: 18f3b93]

- [x] Task: Зафиксировать базовую линию (`bun test` pass/fail в u7-school и в пакете, `bun run e2e` пакета, e2e-тесты бота) в черновике `summary.md` `08ebca5`
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md) — автономно

## Фаза 1: Шаг `fetch` после Policy (TR-27, dmg-core)

> Пересмотр (Нурболат, 2026-10-29): первое решение «`fetch` не вводим» (`dmg-core 12e2791`, `79eab714`, контрольная точка `615164e3`) отменено — для системы, выходящей за монолит, право проверяется до чужих вызовов платформой. Порядок исправлен против спеки: правила — после `fetch` (правилам нужен ответ зависимости, `assigneeActive`).

- [x] Task: Решение в `decisions.md` пакета — согласовано с Нурболатом (первая редакция D-58 `dmg-core 12e2791`, отменена)
- [x] Task: D-58 — новая редакция: `load` (контекст Policy) → Policy → `fetch` (необязательный, чужие вызовы после права) → правила (`L & F`) → `execute`; правило API-07 `dmg-core 8b6b8e2`
- [x] Task: Шаг `fetch` в `UseCaseFromDef` `dmg-core 65d8917`
    - [x] Тесты: `fetch` не вызывается при отказе Policy; правила видят результат `fetch`; результат `fetch` доходит до `execute`; ошибка `fetch` возвращается как есть без фиксации; UC без `fetch` работает как прежде; red
    - [x] Реализация; green (`F` по умолчанию `unknown`: UC без `fetch` и с `load` → `ok(undefined)` не меняются; контекст правил — по `L & F` в конструкторе, типовой тест переписан)
- [x] Task: Учебный модуль: `assignTask` — `users.getUser` в `fetch`; тест «не-владелец получает `ACCESS_DENIED`, `users` не вызывается» `dmg-core 54a0c03`
- [x] Task: API-07 — GritQL `this.call` в `load` (`error`, подавление `// biome-ignore lint/plugin: <зачем Policy>`); фикстуры, `LintMap`, `biome.json` пакета, `rules.md` `dmg-core 1551f28`
- [x] Task: Генератор UC (шаблон — при необходимости), гайд `use-case` (шаг `fetch`, ловушка снята), `llms.txt` `dmg-core ae345a4` — шаблон и `llms.txt` без правок (`this.call` не генерируется, жизненного цикла в `llms.txt` нет); попутно `policy.md`, `errors-result.md`, `domain-modeling.md`
- [~] Task: u7-school: `bun install`, `dmg:sync`/`agents:sync`, API-07 в корневом `biome.json`; UC `wish` — чужие вызовы из `load` в `fetch`; TR-27 закрыт
- [ ] Task: Ревью reviewer; правки по ревью
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

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
