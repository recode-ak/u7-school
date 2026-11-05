# Срез `assembly` (Ф3): сборка `questionnaire` и снятие legacy

Перенос без изменения поведения (strangler, роль `migrator`). Образец — `conductor/archive/stream-dmg_20261103/slices/assembly.md`. Все UC и Job уже в Def-модуле (Ф1), бот — на Def-событиях (Ф2); legacy осталась только оболочкой метатипов. Решения — TR-51.

## Состояние на старте (проверено orchestrator'ом)

- `QuestionnaireModuleDef` (`domain/src/questionnaire/questionnaire.module.ts`): `external` нет (Ф1, тест паспорта зелёный), `dependsOn: [UserModuleDef]`. Задача 2 плана в части `external` — только сверка.
- Фабрика `createQuestionnaireModule` и `QuestionnaireJsonRepo` (UoW, строгий разбор) уже в `U7App.dmgApp` (`platform/app/src/u7-app.ts`), legacy-резолвера и `inbound` нет.
- Уже удалены в Ф1–Ф2: `modules/questionnaire/src/api/*`, `module.ts`, `facade.ts`, `QuestionnaireFacade`, `QuestionnaireInProcFacade`, `QuestionnaireUseCase`, legacy-`QuestionnairePolicy` и legacy-репозиторий, `questionnaireLegacyInbound`, поля `questionnaire`/`questionnaireFacade` в `U7App`. `grep` по этим именам пуст. `QuestionnairePolicy` в `domain/src/questionnaire/questionnaire/questionnaire.policy.ts` — **новая** Policy Def, остаётся.
- Осталось legacy:
  - `domain/src/questionnaire/module.ts` — `QuestionnaireApiModuleMeta`, `QuestionnaireUcMetas` (импорт `ApiModuleMeta` из `@u7-scl/core/domain` — DEBT-1);
  - `domain/src/questionnaire/questionnaire/commands/*` — 9 `*-cmd.ts` (метатипы и схемы legacy-команд) и `errors.ts`;
  - `domain/src/questionnaire/questionnaire/entity.ts` — `Answer`, `BaseQuestionnaireState`, `Questionnaire`, `BaseQuestionnaireArMeta` (типы legacy-записи с ISO-датами);
  - реэкспорты всего этого в `domain/src/questionnaire/index.ts`;
  - `QuestionnaireApiModuleMeta` в `U7BotAppMeta` (`platform/app/src/u7-app-meta.ts`);
  - `scripts/call-uc.ts`: анкеты вызываются через legacy `apiApp.execute` — после Ф1 модуля в `ApiApp` нет, вызов не работает; пример `get-questionnaires-by-user` в справке устарел.

## Границы (что меняется)

| Файл | Действие |
|---|---|
| `domain/src/questionnaire/module.ts` | удалить; убрать `export * from './module'` из `index.ts` |
| `domain/src/questionnaire/questionnaire/commands/` (весь каталог) | удалить; убрать реэкспорты из `index.ts` |
| `domain/src/questionnaire/questionnaire/entity.ts` | удалить. `questionnaire-engine.ts` и его тест — на `AnswerVo` из `questionnaire.state.ts` (или `Pick<AnswerVo, 'questionCode' \| 'answerCode'>`, если движку нужны только коды); сценарии теста движка не меняются |
| `domain/src/questionnaire/index.ts` | остаются реэкспорты Def-кода (`contract`, ar, events, errors, policy, types, engine, screen, question, likert, module Def, state) |
| `platform/app/src/u7-app-meta.ts` | убрать `QuestionnaireApiModuleMeta` из `U7BotAppMeta`; `u7-app.types.ts` — сверить, упоминаний анкет быть не должно |
| `biome.json`, блок `platform/app/src/**` | ARC-07: группа `@u7-scl/questionnaire/**` по образцу `@u7-scl/wish/**`/`@u7-scl/stream/**` |
| `runners/u7-bot/tests/worlds/types.ts` | `Questionnaire` → `QuestionnaireView` из `@u7-scl/domain/questionnaire/contract` (числовые даты, variant `kind`). `builder.ts`, `minimal.ts` — сверить |
| `runners/u7-bot/tests/worlds/materializer.ts` (+ тест, если проверяет) | убрать запись `questionnaires/responses.json` (TR-47: legacy-файл, модуль его не читает); `questionnaires.json` — как было |
| `runners/u7-bot/tests/helpers/test-app.ts` | сверить: упоминаний legacy анкет нет — без правок |
| `scripts/call-uc.ts` | анкеты — через `dispatch(QuestionnaireModuleDef, …)` по образцу `wish` (поиск UC по kebab-имени или имени Def — общий для `wish` и `questionnaire`, без дублирования); справка: модули DMG — `wish`, `questionnaire`; пример — `get-current '{"respondentId":"<uuid>"}'` по фактическому входу `GetCurrentUcDef` (сверь с Def) |
| `scripts/domain-arch.ts` | сверить: импорт уже из контракта — без правок, если так |
| `platform/app/tests/u7-app.test.ts` | сверить: `getModule('questionnaire')` → `undefined`, UC через `dispatch` — уже так; без правок, если `tsc` зелёный |
| `scripts/arch-check.test.ts` | в тест графа домена — `expect(external).not.toContain('questionnaire')` (как `peer-review`) |
| `modules/questionnaire/src/questionnaire.module.test.ts` | сверить; упоминаний legacy быть не должно |

**Не трогать:** `modules/questionnaire/src/domain/index.ts` (barrel DEBT-3); `scripts/domain-check.ts` (DEBT-34 общий — пропуск пар legacy-модулей снимается последним треком; questionnaire в проверку попадает сам, т.к. не `external`); модули `user`, `course`, `stream`, `wish`, `peer-review`; `runners/u7-bot/src/**` (stories — Ф2); `dmg-core`; `data/`; `conductor/`. Нужна правка вне границ или контракта — эскалация.

## Сохраняемое поведение

Бот, UC, Job и скрипты — без изменений: `bun test` ≥ 4216 pass за вычетом удалённых тестов (число и список — в отчёте; у `commands/*` и `entity.ts` своих тестов нет — проверь), `test:bot` ≥ 1107 pass. `call-uc` для анкет начинает работать (сейчас падает) — это починка, а не изменение поведения UC. Материализатор миров пишет `questionnaires.json` в том же виде.

## Сверка сценариев удалённых тестов

Если удаляемые файлы покрыты тестами (`grep` по именам `*CmdSchema`, `*CmdMeta`, `BaseQuestionnaire*`) — перечисли сценарии и укажи, где они уже покрыты (тесты UC Def, `questionnaire.state.test.ts`) или почему переносить нечего.

## Критерии приёмки

- `grep -rn "QuestionnaireApiModule\|QuestionnaireInProcFacade\|QuestionnaireFacade\|questionnaireLegacyInbound\|QuestionnaireUcMetas\|BaseQuestionnaireArMeta\|CmdMeta" --include=*.ts domain/src/questionnaire modules/questionnaire platform scripts runners` — пусто.
- `domain/src/questionnaire/**` не импортирует `@u7-scl/core` и `@u7-scl/app-legacy`; каталога `commands/` и `entity.ts` нет.
- `@u7-scl/questionnaire/domain` вне `modules/questionnaire` не импортируется (единственный потребитель — `worlds/types.ts` — переходит на контракт); внутри — только через barrel DEBT-3.
- `@u7-scl/questionnaire/**` в группе ARC-07 блока `platform/app/src/**`; `bun run lint`, `checkDefs`, `arch:check` зелёные.
- `bun run scripts/call-uc.ts --help` показывает анкеты среди DMG-модулей; разбор имени UC анкет покрыт тестом, если у `call-uc` есть тесты, иначе — ручная проверка `--help` в отчёте (без вызова на живых данных).
- `bun run check` зелёный; `bun run test:bot` ≥ 1107 pass; `git status data/` чист.

## Правила (ID)

ARC-04, ARC-07, MAN-06, D-36, D-45 (вход модуля — `contract`), D-53.
