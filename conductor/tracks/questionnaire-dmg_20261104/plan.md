# Plan: questionnaire-dmg_20261104

Каждая задача кода идёт по TDD: red → запуск → green. Структуру создаёт `bun run gen … --adopt`. Код пишут роли конвейера, коммитит orchestrator ([agents.md](../../architecture/agents.md) §3).

**Конвейер среза:** `dmg-tech-lead` (бриф) → `dmg-test-designer` (red) → `migrator` (green) → гейт → `dmg-data-keeper` (по триггеру) → `dmg-reviewer` → решение orchestrator.

**Исполнители** — по таблице §2 [deepseek.md](../../architecture/deepseek.md); метка в скобках у задачи:
- **Opus:** orchestrator (в т.ч. приёмка брифов), `dmg-reviewer`.
- **Sonnet:** `dmg-tech-lead`, red-тесты, UI-stories.
- **flash:** через `scripts/pi-role.ts`, один шаг — один `--label`.

После каждого шага на flash — гейт (`bun run scripts/agent-gate.ts`), `git diff --numstat` (не удалены ли проверки) и grep-критерии брифа. Строка расхода по фазе — в `summary.md` → «DeepSeek». Отклонение от таблицы записывается в отчёт фазы с причиной.

**Режим — автономный** ([agents.md](../../architecture/agents.md) §9). В `data/` не пишем. Решения и входной долг — в [spec.md](./spec.md).

**Перепроектирование** — только с разрешения Нурболата. Предложение оформляется вопросом «сейчас или в `debt.md`». Ответ записывается в TR или `decisions.md` до выполнения.

**Красная зона Ф1–Ф2.** После Ф1 stories и e2e бота на legacy-именах `questionnaire:*` падают: моста нет. Гейт Ф1 — `check` зелёный, кроме тестов из записи красной зоны в `debt.md`. Список поимённый, критерий снятия — конец Ф2. С конца Ф2 `check` полностью зелёный.

## Фаза 0: База и решения

- [x] Task: Зафиксировать базовую линию в `summary.md`: `CI=true bun test`, `bun run test:bot`, тесты `domain/src/questionnaire` и `modules/questionnaire`, `dmg-core` `bun test`. Создать каркасы разделов «Пилот ролей» и «DeepSeek» (Opus) d117baaa
- [x] Task: Записать решения Q1–Q3, Q5 и тактические (один агрегат с variant-state, query-UC, `responses.json`, фикстуры) в TR в `debt.md` и `decisions.md` (Opus) ed2b01c8
- [x] Task: `dmg-tech-lead`: бриф `slices/questionnaire.md` (Sonnet). Содержание: 0f36309f
    - 9 UC и Job `sweep-abandoned-questionnaires`: пороги, тексты, только standard;
    - 6 Def-событий (Q1) и `ownerInfo` в контракте (Q2), события без `telegramId`/`response` (Q3);
    - разбор `a-root.ts` по Ar, Policy, правилам и DQS; `QuestionnaireEngine` остаётся чистым классом;
    - проверка поддержки `v.variant` в `AggregateDef`;
    - Policy «только за себя» через `Identified` (TR-11, DEBT-32);
    - клиенты `wish`, ожидаемая красная зона, ID `rules.md`.
- [x] Task: orchestrator проверяет бриф (Opus). Вопросы перепроектирования — Нурболату 0f36309f
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 0:**
- Базовая линия (pass/fail по командам) — в `summary.md`.
- Решения Q1–Q3, Q5 и тактические записаны в TR и `decisions.md`.
- Бриф покрывает UC, события, Job и клиентов. Открытых стратегических вопросов нет.

## Фаза 1: Срез `questionnaire`

- [ ] Task: `dmg-test-designer`: характеризация на `v0.2.6` и red-тесты (Sonnet)
    - [ ] `start` (пул, `ownerInfo`, `started`), `handle-action` (choice/text/next, `stale-answer`, завершение, `completed` с `kind`, likert — `likertScores`), `start-by-invite`, `decline-invite` (`abandoned` с `reason: declined`), `abandon` (`by_user`), `send-likert-invite` (`invited`), `get-questionnaire`, `get-current`, `get-questionnaires-by-user`, правила доступа (респондент/admin)
    - [ ] Job: пороги 3/6/9 ч, флаги `warnedAt`/`continueInvitedAt`, сброс при активности, сбой одной анкеты не прерывает обход, likert не затрагивается; события без `telegramId`
    - [ ] Перенос сценариев старых тестов (`questionnaire-engine`, `questionnaire-ar`, `likert-questionnaire-ar`, `warned-at`, `continue-invited-at`, `stale-answer`, `question`, `factory`, `repo-*`), список — в отчёте
    - [ ] Red Def-контрактов (6 событий, `ownerInfo`) и репозитория: legacy ISO → число, round-trip, невалидная запись
- [ ] Task: `migrator`, домен (flash):
    - state (`F.timestamp`, variant `kind`, поле `ownerInfo`), `QuestionnaireArDef` и Ar без `#` и с `Result` вместо `throw*`;
    - 6 событий, ошибки, Policy и правила, DCS/DQS, Def 9 UC и Job;
    - без `core`, `app-legacy` и чужого `index`. DEBT-1, 2, 5, 10 (questionnaire).
- [ ] Task: `migrator`, прикладной слой (flash): `UseCaseFromDef`, `JobFromDef`, адрес через `GetTelegramAddressesUcDef`; репозиторий через UoW (строгий разбор) с тестом на `DB_DIR=./data/fixtures`
- [ ] Task: `migrator`, клиенты `wish` и сборка Ф1 (flash; С1 TR-48 — `external` и legacy снимаются в Ф1):
    - `u7-app.ts`, `u7-app.types.ts`, `u7-app.test.ts` на модуль Def; типовые импорты stories (Т16);
    - `StartQuestionnaireUcDef` реализован настоящим UC, адаптер `start-questionnaire` удалён (DEBT-44, DEBT-32);
    - `owner` → `ownerInfo` во входе UC и в ER `confirm-wish`/`abandon-wish` с тестами (Q2);
    - `questionnaireLegacyInbound` и его тест удалены, ER подписаны на Def-события агрегата.
- [ ] Task: Записать красную зону в `debt.md`: поимённый список падающих stories, dialog- и e2e-тестов бота, `u7-app.test`; критерий снятия — конец Ф2 (Opus)
- [ ] Task: `dmg-data-keeper` (flash): state и репозиторий — чтение `questionnaires.json` (ISO и число, оба `kind`, `ownerInfo`, `warnedAt`/`continueInvitedAt`/`abandonReason`), собственные фикстуры, откат
- [ ] Task: `dmg-reviewer` (Opus). Замечания без `error` решает orchestrator (TR), предложения перепроектирования — Нурболату
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 1** (уточняет бриф):
- В `domain/src/questionnaire/questionnaire/**` и `modules/questionnaire/src/questionnaire/**` нет:
  - `throw*` для штатных отказов;
  - `new …Ar`;
  - `#` в Ar;
  - импортов `@u7-scl/core` и `@u7-scl/app-legacy`.
  Исключение — legacy-код, который удаляется в Ф3.
- UC — через `UseCaseFromDef`, Job — через `JobFromDef`. `checkDefs` и `arch:check` зелёные. Маркеров DEBT-1, 2, 5, 10 (questionnaire) нет.
- Адаптера `start-questionnaire` и `questionnaireLegacyInbound` нет.
- `grep -rn "\bowner\b"` по контракту questionnaire и событиям в `wish` пуст: в контракте только `ownerInfo`.
- Тесты репозитория:
  - legacy-запись читается (ISO → число);
  - round-trip;
  - на невалидной записи — исключение, файл цел.
- Сценарии старых тестов перенесены (список — в отчёте `dmg-test-designer`).
- `bun run check` зелёный, кроме тестов из записи красной зоны. `git status data/` чист.

## Фаза 2: Срез UI

- [ ] Task: `dmg-test-designer`: e2e на каждое событие, которое бот получает по подписке (`started`, `invited`, `abandonWarning`, `continueInvite`, `abandoned`/timeout); тесты переведённых stories с «Сохраняемым поведением» (Sonnet)
- [ ] Task: UI на `dispatch` и Def-подписки (Sonnet):
    - `questionnaire/{invite,fill,render}`, `controller`;
    - `ownerInfo.courseId` из payload, адрес через `GetTelegramAddressesUcDef`, экран по `get-current`;
    - типы `render.ts` из контракта;
    - `course-catalog.story` и `course-nav-resolver` — проверить вызовы анкет.
- [ ] Task: Обновить `fill.dialog.test`, `invite.dialog.test`, `inventory.test`, `questionnaire-ux.e2e`, `wish-questionnaire.e2e` на Def-имена (flash). Снять запись красной зоны из `debt.md`
- [ ] Task: `dmg-reviewer` (Opus)
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 2:**
- `grep -rn "'questionnaire:" runners` пуст, кроме маршрутов `Routes.questionnaire.*`: бот подписан только на Def-события.
- `grep -rn "appApi.execute('\(get-current\|handle-action\|abandon\|start-by-invite\|decline-invite\|get-questionnaires-by-user\)'" runners` пуст.
- На каждое событие, которое бот получает по подписке, есть e2e.
- `bun run check` полностью зелёный, `test:bot` не ниже базовой линии. Записи красной зоны в `debt.md` нет. `git status data/` чист.

## Фаза 3: Сборка и снятие legacy

- [ ] Task: orchestrator (TR-45): бриф `slices/assembly.md` по образцу `stream` (Opus)
- [ ] Task: `migrator` (flash): `QuestionnaireModuleDef` без `external`; фабрика в `U7App` без legacy-резолвера и `inbound`; `@u7-scl/questionnaire/**` — в группу ARC-07 `biome.json`
- [ ] Task: `migrator` (flash), удаление legacy:
    - `api/*`, `module.ts`, `facade.ts` и `commands/*-cmd.ts`;
    - `QuestionnaireFacade`, `QuestionnaireInProcFacade`, `QuestionnaireUseCase` и legacy-`QuestionnairePolicy`;
    - legacy-репозиторий;
    - поля `questionnaire`/`questionnaireFacade` в `u7-app.ts`, `u7-app-meta.ts`, `u7-app.types.ts`.
  Также погасить DEBT-34 в части questionnaire.
- [ ] Task: `migrator` (flash): перевести на модуль Def:
    - `tests/helpers/test-app.ts` и тестовые миры (`types`, `builder`, `minimal`, `materializer` — без `responses.json`);
    - `scripts/{call-uc,domain-arch}.ts` (исправить устаревший пример `get-current`);
    - `platform/app/tests/u7-app.test.ts`, `scripts/arch-check.test.ts`, `questionnaire.module.test`.
- [ ] Task: `dmg-data-keeper` (flash), если скрипты или миры пишут `questionnaires`; `dmg-reviewer` (Opus)
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 3:**
- `grep -rn "QuestionnaireApiModule\|QuestionnaireInProcFacade\|QuestionnaireFacade\|questionnaireLegacyInbound" --include=*.ts .` пуст.
- `@u7-scl/questionnaire/domain` импортируется только через barrel DEBT-3.
- У `QuestionnaireModuleDef` нет `external`. `checkDefs` и `bun run lint` (ARC-07) зелёные. Маркеров DEBT-34 (questionnaire) нет.
- Сценарии удалённых тестов сверены, список — в отчёте.
- `bun run check` зелёный, `test:bot` не ниже базовой линии. `git status data/` чист.

## Фаза 4: Итог

- [ ] Task: Гейт закрытия: `CI=true bun test`, `bun run test:bot`, `dmg-core` `bun test`. Сравнение с базовой линией — в `summary.md`
- [ ] Task: Итоги в `summary.md`: «Пилот ролей» и «DeepSeek» (шаги, модель, $, круги доработок, `error` ревью). Сверка с §2 `deepseek.md`, правка документа при расхождении; в §1 — «`dmg-tech-lead` — Sonnet, приёмка брифа — Opus» (источник — пилот ролей)
- [ ] Task: `debt.md`: снять DEBT-1, 2, 5, 10, 32, 34, 44 и TR-11 в части questionnaire, завести новые долги. `migration.md` §6: состояние модуля, входной долг, следующий трек — `course`
- [ ] Task: Сверить критерии приёмки spec с итогом (таблица в `summary.md`)
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

**Критерии приёмки Фазы 4:** все критерии приёмки spec выполнены, `arch:check` чист, `debt.md` и `migration.md` синхронны с кодом, разделы `summary.md` заполнены.

## Покрытие критериев spec

| Критерий spec | Фаза |
|---|---|
| нет `throw*`, `new …Ar`, `#`, `core`/`app-legacy` | 1, остатки — 3 |
| долг погашен, `arch:check` | 1 (1, 2, 5, 10, 32, 44), 3 (34), 4 (`debt.md`) |
| нет `external`, фасад, inbound и адаптер удалены | 1 (inbound, адаптер), 3 (`external`, фасад) |
| бот только на Def-событиях, без `telegramId`/`response`, `ownerInfo` | 1 (контракт), 2 (бот) |
| `check` зелёный, у reviewer нет `error`, красной зоны нет | каждая фаза; запись — 1, снятие — 2 |
| `git status data/` чист | каждая фаза |
| перепроектирования одобрены и записаны | 0, далее по ходу |

## Риски

- **Красная зона Ф1–Ф2:** UI читает legacy-события (`ownerInfo`, `telegramId`, `response`).
- **Пропущенная подписка молча гасит уведомление.** Поэтому e2e на каждое событие.
- **Адрес через `GetTelegramAddressesUcDef`.** Поведение при отсутствии адреса должно совпасть с текущим: сейчас Job не публикует событие без `telegramId`.
- **`a-root.ts` (590 строк)** надо разложить по Ar, Policy и DQS.
- **variant-state в `AggregateDef`.** Если он не поддерживается — правка `dmg-core` отдельным коммитом.
- **flash на домене:** качество держат тесты Sonnet. Гейт и `--numstat` — после каждого шага.
