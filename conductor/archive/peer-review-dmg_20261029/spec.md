# Spec: peer-review-dmg_20261029

## Обзор

Трек 5 из migration.md. Модуль `peer-review` (домен `domain/src/peer-review`, прикладной слой `modules/peer-review`) переводится с legacy на Def по эталону `wish`. Это первый модуль, который проходит через конвейер агентов. В Ф0 пилотируются роли волны 1 ([agent-roles.md](../../architecture/agent-roles.md) §4): `architect`, `test-designer` и `data-keeper`.

## Решения

- **Порядок.** Модули переводятся сверху вниз по графу (migration.md §2.1). `peer-review` стоит на вершине, legacy-клиентов у него нет, поэтому обратных мостов нет. Зависимости `user`, `questionnaire` и `stream` подключаются как внешние `ModuleDef` с адаптерами TR-11. Событие `stream.completed` приходит через `inbound`.
- **Срезы:** `review-campaign` (2 UC и ER `create-student-campaign`), затем `review` (5 UC и ER `notify-review-recipient`). Job нет.
- **Конвейер среза:** `tech-lead` пишет бриф → `test-designer` пишет характеризацию поведения `v0.2.6` (red) → `migrator` переносит → гейт → `data-keeper`, если diff затрагивает `state`, `*.repo.ts` или снимки → `reviewer`.
- **Режим.** Ф0 проверяется вместе с Нурболатом. С Ф1 работа идёт автономно ([agents.md](../../architecture/agents.md) §9): тактические решения записываются в `TR-<n>`, к Нурболату — только стратегические вопросы.
- **Модели.** Новые роли работают на Sonnet. Если роль не справляется, она переключается на Opus, а причина записывается в «Пилот ролей».
- **UI.** Stories бота (`peer-review/*` и `school-reviews`) переводятся на `dispatch` в срезе своего агрегата.
- **Данные.** Формат записей не меняется: `F.timestamp` читает ISO-строку и пишет число, пакетная миграция — трек 7. Трек не пишет в `data/`. Репозитории проверяются на `DB_DIR=./data/fixtures`.

## Входной долг

| Долг | Что | Решение в треке |
|---|---|---|
| DEBT-25 | импорты `@u7-scl/core` в `domain/peer-review` | погашается |
| DEBT-26 | импорт `@u7-scl/app-legacy/domain` в `module.ts` | погашается |
| DEBT-28 | `v.isoDateTime` в схеме (DOM-12) | погашается через `F.timestamp` |
| DEBT-29 | `#validateText` в Ar | погашается: валидация текста переносится в Policy или правило |
| DEBT-27 | barrel `modules/peer-review/src/domain/index.ts` | остаётся до последнего трека |
| DEBT-34 | импорты чужого `index` (peer-review: 2) | погашается в части `peer-review` |

Реестр — debt.md.

## Функциональные требования

**Ф0. Роли волны 1.**
- Добавить `tech-lead` (вначале — `architect`), `test-designer` и `data-keeper` в `.agents-core/roles/` и выполнить `bun run agents:sync`. Роли должны появиться и в Claude Code, и в pi.
- Описать их место в конвейере в [agents.md](../../architecture/agents.md) §3.
- Завести в `summary.md` раздел «Пилот ролей». На каждый вызов в нём фиксируется: повлиял ли отчёт на решение, сколько замечаний принято, правился ли промпт.

**Ф1. Срез `review-campaign`.**
- Описать через Def: state, Ar, события, ошибки, Policy, правила, Def UC и ER, репозиторий через UoW.
- `get-my-campaigns` и `get-campaign-recipients` реализуются через `UseCaseFromDef`, ER `create-student-campaign` — через `ReactionFromDef` (подписка на `stream.completed` через `inbound`).
- Отказы возвращаются как `Result`, не через `throw*`.
- Перевести stories кампаний на `dispatch`.

**Ф2. Срез `review`.**
- То же для `create-review`, `get-my-review`, `list-my-reviews`, `list-scope-reviews` и `list-scope-facts`, а также ER `notify-review-recipient`.
- Сохранить `peer-review-question-pool` и Ds фактов и рецензий как DQS или доменные сервисы, конкретику решает бриф.
- Перевести stories рецензий и `school-reviews` на `dispatch`.

**Ф3. Сборка.**
- Модуль собирает фабрика в `U7App`, как `wish`, через вход пакета.
- Добавить `@u7-scl/peer-review/**` в группу ARC-07 корневого `biome.json` (TR-35, п. 5).
- Снять у `PeerReviewModuleDef` флаг `external`.
- Удалить legacy `PeerReviewApiModule`.

**Ф4. Итог пилота.**
- Оценить роли по критериям §5 [agent-roles.md](../../architecture/agent-roles.md) и предварительно решить судьбу каждой. Окончательное решение — после трека `stream`.
- Обновить migration.md §6: состояние переноса, входной долг, следующий трек — `stream`.

## Нефункциональные требования

- Поведение бота сохраняется: e2e-тесты бота зелёные, тесты домена и пакета переносятся без потери сценариев.
- Новые тесты пишутся по TDD: red → запуск → green.
- Без новых зависимостей. Прод не перезапускается, деплоя и пуша нет.
- Базовая линия фиксируется в Ф0 (на конец `app-assembly` было 3330 pass и 978 e2e).

## Критерии приёмки

- В `domain/peer-review` и `modules/peer-review` нет `throw*` для штатных отказов, нет `new Ar` и импортов `core`, `app-legacy`.
- DEBT-25, 26, 28 и 29 погашены, маркеры и записи синхронны (`arch:check`).
- У `PeerReviewModuleDef` нет `external`, legacy `PeerReviewApiModule` удалён.
- `check` зелёный, отчёты reviewer без `error`.
- `git status data/` чист.
- Раздел «Пилот ролей» заполнен по всем вызовам, по каждой роли есть промежуточный вывод.

## За рамками

- Миграция живых данных и удаление чтения ISO-строки (трек 7).
- Barrel DEBT-27 и `User` в `app-legacy` (DEBT-4).
- Роли волн 2–4 и перенос ролей в пакет.
- Модуль `stream` и снятие его адаптера TR-11.
