# Plan: peer-review-dmg_20261029

Каждая задача кода идёт по TDD: red → запуск → green. После каждой задачи `bun run check` и `arch:check` должны быть зелёными. Структуру создаёт `bun run gen … --adopt`. Код пишут роли конвейера, коммитит orchestrator ([agents.md](../../architecture/agents.md) §3).

**Конвейер среза:** `tech-lead` (бриф) → `test-designer` (red) → `migrator` (green) → гейт → `data-keeper` (по триггеру) → `reviewer` → решение orchestrator.

**Учёт пилота:** после каждого вызова новой роли в `summary.md` → «Пилот ролей» добавляется строка: роль, задача, модель, повлиял ли отчёт, сколько замечаний принято из общего числа, правился ли промпт.

**С Фазы 1 — автономный режим** ([agents.md](../../architecture/agents.md) §9). В `data/` не пишем. Решения и входной долг — в [spec.md](./spec.md).

## Фаза 0: Роли волны 1 и база [checkpoint: ab586f70]

- [x] Task: Зафиксировать базовую линию в `summary.md`: `CI=true bun test`, `bun run test:bot`, тесты `peer-review` (домен и пакет), `dmg-core` `bun test` и `e2e` 441b90ac
- [x] Task: Роль `architect` в `.agents-core/roles/architect.md` (переименована в `tech-lead`, решение Нурболата 2026-10-29): вопрос, что роль знает, формат выхода — черновик брифа по образцу `conductor/archive/golden-wish_20261020/slices/wish.md`; Sonnet; `bun run agents:sync` df4d1a74
- [x] Task: Роль `test-designer` в `.agents-core/roles/test-designer.md`: характеризация поведения `v0.2.6` и red-тесты по Def среза, список сценариев в брифе; `agents:sync` 91340d90
- [x] Task: Роль `data-keeper` в `.agents-core/roles/data-keeper.md`: совместимость чтения `state` и снимков, путь миграции, нужен ли бэкап, правило данных `AGENTS.md`; триггер по путям diff; `agents:sync` c0269a95
- [x] Task: Место ролей в конвейере — [agents.md](../../architecture/agents.md) §3; каркас раздела «Пилот ролей» в `summary.md` 6ce7ce7a
- [x] Task: `data-keeper` (первый вызов): аудит формата `peer-review/campaigns.json` и `reviews.json` (фикстуры и формат, который читает legacy-репозиторий). Проверить, есть ли живые записи. Отчёт — в бриф 27e35ea7
- [x] Task: `architect`: бриф `slices/review-campaign.md` — границы, Def и реализации, сохраняемое поведение, ID правил, «было → станет», внешние Def (`stream.completed`, UC `user`/`questionnaire`), stories кампаний; проверка брифа orchestrator'ом ec679c9f
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md) ab586f70

## Фаза 1: Срез `review-campaign` [checkpoint: 14ebe343]

- [x] Task: `test-designer`: характеризация `get-my-campaigns`, `get-campaign-recipients` и ER `create-student-campaign` на `v0.2.6`; red-тесты Def-контрактов среза 2d03728b
- [x] Task: `migrator`: домен — state (`F.timestamp`, DEBT-28 в части кампаний), `ReviewCampaignArDef` и Ar, события, ошибки, Policy и правила, DCS/DQS по брифу (`campaign-facts-ds`); без импортов `core`/`app-legacy` (DEBT-25 в части кампаний) 2d03728b
- [x] Task: `migrator`: контракт `stream` (по брифу) — `StudentEvents.completed`/`abandoned`, `GetStreamMembersUcDef`, адаптер TR-11, маршруты `inbound` 2d03728b
- [x] Task: `migrator`: прикладной слой — Def UC и ER, `UseCaseFromDef`/`ReactionFromDef`, репозиторий через UoW (строгий разбор, TR-37), фабрика в `U7App`, мост `create-review-uc`; тест репозитория на `DB_DIR=./data/fixtures` 2d03728b
- [x] Task: Stories кампаний (`campaign.story`, `invite.story`, `campaign-profiles`, вызовы `get-my-campaigns` в `my-reviews.story`) → `dispatch`, подписка на `peer-review.review-campaign.created`; e2e-тесты бота зелёные 2d03728b
- [x] Task: `data-keeper` по diff (state и репозиторий) 345d4065
- [x] Task: `reviewer`; замечания без `error` решает orchestrator (TR) 345d4065
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md; автономно) 14ebe343

**Критерии приёмки Фазы 1** (подробно — бриф `slices/review-campaign.md`):
- `domain/src/peer-review/review-campaign/**` и `modules/peer-review/src/review-campaign/**`: нет `throw*` для штатных отказов, `new Ar`, импортов `@u7-scl/core` и `@u7-scl/app-legacy`.
- Маркеры DEBT-25 и DEBT-28 в части кампаний сняты; `arch:check` — нарушений нет.
- `PeerReviewModuleDef` без `external`, с агрегатом кампании, 2 UC и ER; `checkDefs` зелёный.
- `student.completed`/`abandoned` доходят до ER как Def (`legacy-inbound.test.ts`); `GetStreamMembersUcDef` и адаптер покрыты тестами.
- Тесты репозитория на фикстурах и во временном каталоге: legacy-запись (ISO → число, `updatedAt`, `version`), round-trip, невалидная запись — исключение, файл цел.
- Сценарии старых тестов кампаний перенесены (список — отчёт `test-designer`); тест границы окна при `TZ=Asia/Oral` зелёный.
- UC рецензий работают через мост: тесты `create-review-uc` зелёные.
- `bun run check` зелёный; `bun run test:bot` — не меньше 978 pass; `git status data/` чист.

## Фаза 2: Срез `review` [checkpoint: 72b152e5]

- [x] Task: `tech-lead`: бриф `slices/review.md` (5 UC, ER `notify-review-recipient`, `peer-review-question-pool`, `scope-reviews-ds`, валидация текста — DEBT-29) ab60e36e
- [x] Task: `test-designer`: характеризация `create-review`, `get-my-review`, `list-my-reviews`, `list-scope-reviews`, `list-scope-facts` и ER; red-тесты Def-контрактов 6a4cca7b
- [x] Task: `migrator`: домен — state, `ReviewArDef` и Ar, события, ошибки, Policy и правила (валидация текста вместо `#validateText`, DEBT-29), DQS; DEBT-25 и DEBT-28 полностью 6a4cca7b
- [x] Task: `migrator`: прикладной слой — Def UC и ER, реализации, репозиторий через UoW; тест на фикстурах 6a4cca7b
- [x] Task: Stories рецензий (`campaign`, `my-reviews`, `reviews-for-me`, `scope-reviews`, `review-render`), `school-reviews`, `view-stream` → `dispatch`; подписчик уведомления адресату; e2e бота зелёные 6a4cca7b
- [x] Task: `data-keeper` по diff ec0590ca
- [x] Task: `reviewer`; замечания без `error` решает orchestrator (TR) ec0590ca
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md; автономно) 72b152e5

**Критерии приёмки Фазы 2** (уточняет бриф `slices/review.md`):
- Во всём `domain/src/peer-review/**` и `modules/peer-review/src/**` (кроме legacy, удаляемого в Ф3): нет `throw*` для штатных отказов, `new Ar`, импортов `@u7-scl/core` и `@u7-scl/app-legacy`.
- DEBT-25, DEBT-28, DEBT-29 — маркеров нет; валидация текста — правило или Policy, не `#validateText` в Ar.
- 5 UC — через `UseCaseFromDef`; ER `notify-review-recipient` снят, уведомление адресату — подписка story на `peer-review.review.created` (D-41, решение Нурболата); мост `create-review-uc` из Ф1 снят.
- Тесты репозитория рецензий — как у кампаний (legacy-запись, round-trip, невалидная запись).
- Сценарии старых тестов рецензий перенесены; `bun run check` зелёный; `test:bot` — не меньше 979 pass; `git status data/` чист.

## Фаза 3: Сборка и снятие legacy

- [ ] Task: `PeerReviewModuleDef` без `external` (снят в Ф1 — MAN-06), с агрегатами, UC и ER обоих срезов; `checkDefs` зелёный
- [ ] Task: Фабрика `peer-review` в `U7App` (подключена в Ф1) — legacy-резолвер снят; `@u7-scl/peer-review/**` в ARC-07 корневого `biome.json` (TR-35, п. 5)
- [ ] Task: Удалить legacy `PeerReviewApiModule`, `module.ts` домена (DEBT-26), `commands/*-cmd.ts`, старые репозитории; сверить, что сценарии удалённых тестов перенесены; DEBT-34 в части `peer-review`
- [ ] Task: `reviewer`; замечания без `error` решает orchestrator (TR)
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 3:**
- `PeerReviewApiModule`, `domain/src/peer-review/module.ts`, `commands/*-cmd.ts`, legacy-репозитории удалены; `grep` по репозиторию не находит их импортов.
- DEBT-26 и DEBT-34 в части `peer-review` — маркеров нет; `@u7-scl/peer-review/**` в группе ARC-07 `biome.json`, `bun run lint` зелёный.
- `PeerReviewModuleDef` содержит оба агрегата, все UC и ER; `checkDefs` зелёный.
- Сценарии удалённых тестов сверены с новыми (список в отчёте); `bun run check` зелёный; `test:bot` — не меньше 978 pass.

## Фаза 4: Финал

- [ ] Task: Гейт закрытия ([workflow.md](../../workflow.md)): `CI=true bun test`, `test:bot`, `dmg-core`, триаж и сравнение с базовой линией — в `summary.md`
- [ ] Task: Итог пилота: каждая роль по критериям §5 [agent-roles.md](../../architecture/agent-roles.md), промежуточный вывод (годна, нужна правка или кандидат на удаление)
- [ ] Task: [debt.md](../../architecture/debt.md) — DEBT-25, 26, 28, 29 сняты, маркеры синхронны; [migration.md](../../architecture/migration.md) §6 — состояние, входной долг, следующий трек `stream`
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

**Критерии приёмки Фазы 4** (= критерии spec):
- `CI=true bun test` и `test:bot` — красных нет либо каждый отнесён к промежуточному состоянию с владельцем; регрессов нет; числа и сравнение с базовой линией — в `summary.md`.
- DEBT-25, 26, 28, 29 сняты в `debt.md`, `arch:check` — нарушений нет.
- «Пилот ролей» заполнен по всем вызовам, по каждой роли — промежуточный вывод.
- `migration.md` §6 и формулировка про `stream.completed` (§2.1) исправлены; следующий трек — `stream`.

## Покрытие spec

| Критерий spec | Фаза |
|---|---|
| нет `throw*`, `new Ar`, импортов `core`/`app-legacy` | 1 (кампании), 2 (весь модуль) |
| DEBT-25, 26, 28, 29 погашены, `arch:check` | 1–2 (25, 28, 29), 3 (26), 4 (`debt.md`) |
| `PeerReviewModuleDef` без `external`, legacy удалён | 1 (`external`), 3 (legacy) |
| `check` зелёный, reviewer без `error` | каждая фаза |
| `git status data/` чист | каждая фаза |
| «Пилот ролей» заполнен, вывод по ролям | 0–3 (строки), 4 (вывод) |
