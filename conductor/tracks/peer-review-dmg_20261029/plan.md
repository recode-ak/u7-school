# Plan: peer-review-dmg_20261029

Каждая задача кода идёт по TDD: red → запуск → green. После каждой задачи `bun run check` и `arch:check` должны быть зелёными. Структуру создаёт `bun run gen … --adopt`. Код пишут роли конвейера, коммитит orchestrator ([agents.md](../../architecture/agents.md) §3).

**Конвейер среза:** `architect` (бриф) → `test-designer` (red) → `migrator` (green) → гейт → `data-keeper` (по триггеру) → `reviewer` → решение orchestrator.

**Учёт пилота:** после каждого вызова новой роли в `summary.md` → «Пилот ролей» добавляется строка: роль, задача, модель, повлиял ли отчёт, сколько замечаний принято из общего числа, правился ли промпт.

**С Фазы 1 — автономный режим** ([agents.md](../../architecture/agents.md) §9). В `data/` не пишем. Решения и входной долг — в [spec.md](./spec.md).

## Фаза 0: Роли волны 1 и база

- [x] Task: Зафиксировать базовую линию в `summary.md`: `CI=true bun test`, `bun run test:bot`, тесты `peer-review` (домен и пакет), `dmg-core` `bun test` и `e2e` 441b90ac
- [x] Task: Роль `architect` в `.agents-core/roles/architect.md`: вопрос, что роль знает, формат выхода — черновик брифа по образцу `conductor/archive/golden-wish_20261020/slices/wish.md`; Sonnet; `bun run agents:sync` df4d1a74
- [x] Task: Роль `test-designer` в `.agents-core/roles/test-designer.md`: характеризация поведения `v0.2.6` и red-тесты по Def среза, список сценариев в брифе; `agents:sync` 91340d90
- [x] Task: Роль `data-keeper` в `.agents-core/roles/data-keeper.md`: совместимость чтения `state` и снимков, путь миграции, нужен ли бэкап, правило данных `AGENTS.md`; триггер по путям diff; `agents:sync` c0269a95
- [x] Task: Место ролей в конвейере — [agents.md](../../architecture/agents.md) §3; каркас раздела «Пилот ролей» в `summary.md` 6ce7ce7a
- [~] Task: `data-keeper` (первый вызов): аудит формата `peer-review/campaigns.json` и `reviews.json` (фикстуры и формат, который читает legacy-репозиторий). Проверить, есть ли живые записи. Отчёт — в бриф
    - Передача (2026-10-29, claude, ec679c9f): сделано — аудит по коду и фикстурам в брифе; осталось — проверка живых записей с разрешения Нурболата; check — не требуется (только документы)
- [x] Task: `architect`: бриф `slices/review-campaign.md` — границы, Def и реализации, сохраняемое поведение, ID правил, «было → станет», внешние Def (`stream.completed`, UC `user`/`questionnaire`), stories кампаний; проверка брифа orchestrator'ом ec679c9f
- [ ] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md)

## Фаза 1: Срез `review-campaign`

- [ ] Task: `test-designer`: характеризация `get-my-campaigns`, `get-campaign-recipients` и ER `create-student-campaign` на `v0.2.6`; red-тесты Def-контрактов среза
- [ ] Task: `migrator`: домен — state (`F.timestamp`, DEBT-28 в части кампаний), `ReviewCampaignArDef` и Ar, события, ошибки, Policy и правила, DCS/DQS по брифу (`campaign-facts-ds`); без импортов `core`/`app-legacy` (DEBT-25 в части кампаний)
- [ ] Task: `migrator`: прикладной слой — Def UC и ER, `UseCaseFromDef`/`ReactionFromDef`, репозиторий через UoW, `inbound` для `stream.completed`, адаптеры TR-11 к `user`/`questionnaire`/`stream`; тест репозитория на `DB_DIR=./data/fixtures`
- [ ] Task: Stories кампаний (`campaign.story`, `invite.story`, `campaign-profiles`) → `dispatch`; e2e-тесты бота зелёные
- [ ] Task: `data-keeper` по diff (state и репозиторий)
- [ ] Task: `reviewer`; замечания без `error` решает orchestrator (TR)
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md; автономно)

## Фаза 2: Срез `review`

- [ ] Task: `architect`: бриф `slices/review.md` (5 UC, ER `notify-review-recipient`, `peer-review-question-pool`, `scope-reviews-ds`, валидация текста — DEBT-29)
- [ ] Task: `test-designer`: характеризация `create-review`, `get-my-review`, `list-my-reviews`, `list-scope-reviews`, `list-scope-facts` и ER; red-тесты Def-контрактов
- [ ] Task: `migrator`: домен — state, `ReviewArDef` и Ar, события, ошибки, Policy и правила (валидация текста вместо `#validateText`, DEBT-29), DQS; DEBT-25 и DEBT-28 полностью
- [ ] Task: `migrator`: прикладной слой — Def UC и ER, реализации, репозиторий через UoW; тест на фикстурах
- [ ] Task: Stories рецензий (`my-reviews`, `scope-reviews`, `review-render`) и `school-reviews` → `dispatch`; e2e бота зелёные
- [ ] Task: `data-keeper` по diff
- [ ] Task: `reviewer`; замечания без `error` решает orchestrator (TR)
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md; автономно)

## Фаза 3: Сборка и снятие legacy

- [ ] Task: `PeerReviewModuleDef` без `external`, с агрегатами, UC и ER; `checkDefs` зелёный
- [ ] Task: Фабрика `peer-review` в `U7App` через вход пакета (как `wish`); `@u7-scl/peer-review/**` в ARC-07 корневого `biome.json` (TR-35, п. 5)
- [ ] Task: Удалить legacy `PeerReviewApiModule`, `module.ts` домена (DEBT-26), `commands/*-cmd.ts`, старые репозитории; сверить, что сценарии удалённых тестов перенесены; DEBT-34 в части `peer-review`
- [ ] Task: `reviewer`; замечания без `error` решает orchestrator (TR)
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md; автономно)

## Фаза 4: Финал

- [ ] Task: Гейт закрытия ([workflow.md](../../workflow.md)): `CI=true bun test`, `test:bot`, `dmg-core`, триаж и сравнение с базовой линией — в `summary.md`
- [ ] Task: Итог пилота: каждая роль по критериям §5 [agent-roles.md](../../architecture/agent-roles.md), промежуточный вывод (годна, нужна правка или кандидат на удаление)
- [ ] Task: [debt.md](../../architecture/debt.md) — DEBT-25, 26, 28, 29 сняты, маркеры синхронны; [migration.md](../../architecture/migration.md) §6 — состояние, входной долг, следующий трек `stream`
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)
