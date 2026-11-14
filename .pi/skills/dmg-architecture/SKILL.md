---
name: dmg-architecture
description: ЗАГРУЖАТЬ ПЕРВЫМ при создании или редактировании модулей на dmg-core (DMG) — домена, Def, Ar, Policy, UC/ER/Job, репозиториев, модулей. Говорит, где разместить логику, как назвать файлы и объекты, какой гайд и какие правила (ID из rules.md) проверить.
---

<!-- dmg-core@0.2.1: сгенерировано `dmg-core sync` — не править -->

# DMG: как писать модуль на dmg-core

Источник истины — документация пакета `node_modules/dmg-core/docs/` (вход — `index.md`, индекс для LLM — `node_modules/dmg-core/llms.txt`). Скил — маршрутизатор: не дублирует документы, а говорит, что прочитать. Образец любого артефакта — учебный модуль `node_modules/dmg-core/src/testing/example` (`todo`, `users`).

## 1. Где разместить логику

1. Модуль-владелец и объект — `reference/domain-modeling.md` §1 (Ar / Policy / доменное правило / DCS / DQS / делегирование).
2. Ось и пакет, разрешённые импорты, доступ к entity — `reference/layers.md`.
3. Контракт (Def) — `reference/manifests.md`; ошибки и `Result` — `reference/errors-result.md`; кто вызывает — `reference/caller.md`.
4. UC/ER/Job — только техническая оркестрация (API-01): никаких доменных решений.
5. Чужой модуль — только через его `contract.ts` и только по `dependsOn` (ARC-04).

## 2. Как назвать и где положить

`reference/naming.md`: сокращения (Ar, Uc, Er, Job, Dcs, Dqs, Def), суффиксы файлов (`.ar.ts`, `.uc.ts`, …), зеркальная пара контракт ↔ реализация. Корни каталогов задаёт `ArchApp.layout` проекта. Заготовки — генератором `dmg-core gen …` (`reference/naming.md` §5; раскладка — секция `gen` в `dmg-core.json`), а не руками. Новый проект — каркас `dmg-core init --profile single|monorepo`; что он создаёт, как подключить модуль к приложению и кто что правит руками — `guides/project.md`.

## 3. Как написать артефакт вида

Гайд `docs/guides/<вид>.md` (индекс — `guides/index.md`): когда применять, команда генератора, образец в учебном модуле, чеклист ID, типичные ловушки, как тестировать. Виды: state, aggregate, events, errors, policy, repo (с DCS/DQS), facade, use-case, event-reaction, module, job, app (корень сборки и раннер), project (профили и рост проекта).

## 4. Проверь перед завершением

- Пройди применимые ID из `reference/rules.md` (ARC, DOM, MAN, ERR, API, CODE, TST).
- `check` проекта зелёный: lint (правила biome пакета; какие на какие каталоги — «Карта линтера» в `rules.md`), типы, тесты, `ArchChecker` (`dmg-core/arch`).
- Тесты — `reference/testing.md`; TDD: тест до кода.

## 5. Стоп-сигналы

Остановись и спроси владельца проекта, если:
- правило противоречит задаче или другому правилу;
- нужно изменить чужой модуль или контракт, от которого зависят другие;
- нужна новая связь модулей (`dependsOn`) — это архитектурное решение;
- вызов чужого модуля меняет его состояние, а место вызова не выбрано (`guides/use-case.md` §1).
