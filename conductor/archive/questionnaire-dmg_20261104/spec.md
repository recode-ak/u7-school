# Spec: questionnaire-dmg_20261104

## Обзор

Трек 6 из migration.md, второй модуль группы «остальные модули». Модуль `questionnaire` (домен `domain/src/questionnaire`, прикладной слой `modules/questionnaire`) переводится с legacy на Def по эталону `wish`. Шаблон трека — `conductor/archive/stream-dmg_20261103`. Работает конвейер ролей из пакета `dmg-core`: `dmg-tech-lead` → `dmg-test-designer` → `migrator` → гейт → `dmg-data-keeper` (по триггеру) → `dmg-reviewer`. Бриф механической сборки готовит orchestrator (TR-45).

**Исполнители — по таблице §2 [deepseek.md](../../architecture/deepseek.md)** (решение Нурболата): orchestrator и `dmg-reviewer` — Opus; `dmg-tech-lead` — Sonnet (итог пилота ролей, `migration.md` §6; приёмка брифа — orchestrator на Opus), red-тесты `dmg-test-designer` и UI-stories — Sonnet; `migrator` (домен, прикладной слой, подписчики, механика), `dmg-data-keeper`, точечные правки тестов — DeepSeek `flash` через `scripts/pi-role.ts`. После каждого шага на DeepSeek — гейт, `git diff --numstat`, grep-критерии брифа; строка расхода — в `summary.md`.

## Решения

- **Порядок.** После `stream` у `questionnaire` не осталось legacy-клиентов. На Def его вызывают `wish` и (контрактом) `peer-review`, поэтому обратных мостов нет. `user` подключается как внешний `ModuleDef` с адаптерами.
- **Срезы (уточнит `dmg-tech-lead`):**
  - агрегат `questionnaire`: варианты standard и likert, 9 UC (`start`, `start-by-invite`, `send-likert-invite`, `decline-invite`, `handle-action`, `abandon`, `get-questionnaire`, `get-current`, `get-questionnaires-by-user`) и Job `sweep-abandoned-questionnaires` (ступени 3/6/9 ч, только standard);
  - UI — stories анкет;
  - сборка.
- **Режим.** Работа автономная ([agents.md](../../architecture/agents.md) §9). Тактические решения записываются в `TR-<n>`.
- **Перепроектирование — как в `stream-dmg`.** Пересматривать решения можно на любом уровне. Каждое предложение — стратегический вопрос Нурболату: «сейчас в срезе» или «в `debt.md`». Без его одобрения ничего не меняется.
- **Мосты.**
  - Адаптер `start-questionnaire` (DEBT-44) заменяется настоящим UC. Субъект — `Identified` вместо entity `User` (DEBT-32). Правило «только за себя» — в Policy (TR-11).
  - `questionnaireLegacyInbound` удаляется: события публикует агрегат.
### Решения Нурболата (2026-11-04)

- **Q1. События Def — 6 вместо 10 legacy:** `started`, `invited`, `completed`, `abandoned` (`reason`: `timeout` / `by_user` / `declined` — `decline` сливается с `abandoned`), `abandonWarning`, `continueInvite`. Likert — поле `kind` в payload вместо отдельных `likert-*`; `completed` likert несёт `likertScores`.
- **Q2. `ownerInfo` — одно имя во всех слоях.** В state поле остаётся `ownerInfo` (формат на диске не меняется). В Def-событиях и во входе `StartQuestionnaireUcDef` поле `owner` переименовывается в `ownerInfo`; клиенты `wish` (`create-course-wish`, ER `confirm-wish`/`abandon-wish`) обновляются. Собственное поле `wish` (`questionnaire.owner` в его state) не трогается.
- **Q3. Без `telegramId` и `response` в событиях.** События несут только id; story получает адрес через `GetTelegramAddressesUcDef` (как `inactivity` студента), экран строит по `get-current`. Job становится доменным.
- **Q5. Likert переносится** (понадобится анкетам в кампаниях peer-review), хотя production-вызывающих `send-likert-invite` сейчас нет.

### Тактические решения (TR при Ф0)

- Один `QuestionnaireArDef`, state — `v.variant('kind')`. Если `AggregateDef` не поддерживает variant-state — правка `dmg-core` отдельным коммитом.
- `get-questionnaire`, `get-current`, `get-questionnaires-by-user` — query-UC (бот вызывает через `dispatch`).
- Мёртвый `questionnaires/responses.json` в `materializer.ts` удаляется в Ф3.
- Фикстура `data/fixtures/questionnaires` пуста — `dmg-data-keeper` проверяет на собственных фикстурах (ISO и число, оба `kind`, `warnedAt`, `abandonReason`).

- **Сосуществование срезов.** Моста нет. Красная зона между срезами допустима, если записана в `debt.md` с критерием снятия «конец трека».
- **Данные.** Формат записей `questionnaires` не меняется: `F.timestamp` читает ISO и пишет число. Трек не пишет в `data/`, проверка идёт на `DB_DIR=./data/fixtures`.

## Входной долг

| Долг | Решение |
|---|---|
| DEBT-1, 2, 5, 10 (часть questionnaire) | погашаются |
| DEBT-32, DEBT-44 (часть questionnaire) | погашаются |
| DEBT-34 (часть questionnaire) | погашается |
| TR-11 (часть questionnaire) | снимается |
| DEBT-3 (barrel `modules/questionnaire/src/domain`) | остаётся до последнего трека |

Реестр — debt.md.

## Функциональные требования

- **Ф0. База.** Зафиксировать базовую линию тестов (на конец `stream`: 3947 pass, 1039 bot).
- **Ф1. Срез `questionnaire`.**
  - State, Ar (standard и likert), события, ошибки, Policy, правила, DCS/DQS, Def UC, репозиторий через UoW.
  - UC через `UseCaseFromDef`, Job через `JobFromDef`.
  - Адаптер `start-questionnaire` и legacy inbound снимаются, `wish` переходит на настоящий UC и Def-события.
- **Ф2. UI.** Stories `questionnaire/*` (`invite`, `fill`, `render`, `controller`) и вызовы анкет в `courses/*` переводятся на `dispatch` и подписку на 5 Def-событий, которые получает бот (`started`, `invited`, `abandonWarning`, `continueInvite`, `abandoned`). Красная зона Ф1 закрывается.
- **Ф3. Сборка.**
  - Фабрика в `U7App`, `@u7-scl/questionnaire/**` — в ARC-07 `biome.json`, `external` снят.
  - Удаляются legacy `QuestionnaireFacade`, `QuestionnaireInProcFacade`, `api/*`, `commands/*-cmd.ts`, legacy-репозиторий.
  - На модуль Def переводятся `test-app`, тестовые миры и `scripts/call-uc.ts`/`domain-arch.ts`.
- **Ф4. Итог.**
  - `debt.md`: снять погашенное.
  - `migration.md` §6: состояние, следующий трек — `course`.
  - `summary.md` с гейтом закрытия.

## Нефункциональные требования

- Поведение бота сохраняется, кроме одобренных перепроектирований.
- e2e зелёные к концу Ф2 и Ф3. На каждое событие, которое бот получает по подписке, есть e2e.
- TDD: red → запуск → green.
- Без новых зависимостей, деплоя, пуша и рестарта прода.
- Правка `dmg-core` — отдельным коммитом в репо пакета, его SHA — в коммите u7-school (`architecture/index.md`, «Правка платформы»).

## Критерии приёмки

- В `domain/src/questionnaire` и `modules/questionnaire` нет `throw*` для штатных отказов, `new …Ar`, `#` в Ar, импортов `core` и `app-legacy`.
- Долг из таблицы погашен, `arch:check` синхронен.
- У `QuestionnaireModuleDef` нет `external`. Legacy-фасад, inbound и адаптер удалены.
- Бот подписан только на Def-события questionnaire; в событиях нет `telegramId` и `response`; имя `owner` в контракте questionnaire не используется (только `ownerInfo`).
- `check` зелёный, в отчётах reviewer нет `error`, красной зоны в `debt.md` нет.
- `git status data/` чист.
- Каждое перепроектирование одобрено Нурболатом и записано в `TR-<n>`, `decisions.md` или `debt.md`.

## За рамками

- Перевод `user` и `course` на Def.
- Анкеты в кампаниях peer-review (техдолг peer-review).
- Миграция живых данных (трек 7), DEBT-3, DEBT-4.
- Продуктовые доработки UX анкет.
