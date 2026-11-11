# Инвентаризация тестов домена `questionnaire`

Трек `tst-cleanup_20261105`, фаза Ф2. Область — `domain/src/questionnaire/**/*.test.ts`
(14 файлов). Базовая линия: `cd domain && bun test src/questionnaire` → **213 pass,
0 fail, 473 expect()** (объявлений `it`/`test` — 164, часть — `it.each`).

Закономерности — `conductor/roadmap/test-bloat.md` §2 (Б-1…Б-13), правила —
`node_modules/dmg-core/docs/reference/testing.md` §3, §5, §5.1 (TST-08, TST-09).
Оценки: **полезен** / **сомнителен** (защита есть, но дублируется или слабее, чем
кажется) / **пуст** (падение не связано с ошибкой в проде: тавтология, паспорт Def,
поведение платформы). Новых закономерностей (Н-ID) не встретилось — все случаи
ложатся в Б-1…Б-11.

Пути в таблице кандидатов — от `domain/src/questionnaire/questionnaire/`
(`module.test.ts` — от `domain/src/questionnaire/`); «где покрыто» — от корня репо,
строка начала конкретного `it(`/`test(`, который сам кандидатом не является.

## 1. Сводка

| файл | тестов (исполнений) | кандидатов (объявлений / исполнений) | полезен | сомнителен | пуст |
|---|---|---|---|---|---|
| `questionnaire/questionnaire.ar.test.ts` | 40 | 15 / 15 | 25 | 11 | 4 |
| `questionnaire/questionnaire.ar.answers.test.ts` | 26 | 2 / 2 | 24 | 2 | 0 |
| `questionnaire/questionnaire.ar.idle.test.ts` | 23 | 5 / 5 | 18 | 4 | 1 |
| `questionnaire/questionnaire.ar.likert.test.ts` | 6 | 3 / 3 | 3 | 3 | 0 |
| `questionnaire/questionnaire-engine.test.ts` | 23 | 7 / 7 | 16 | 5 | 2 |
| `questionnaire/questionnaire.errors.test.ts` | 8 | 3 / 8 | 0 | 1 | 7 |
| `questionnaire/questionnaire.events.test.ts` | 28 | 10 / 26 | 2 | 13 | 13 |
| `questionnaire/questionnaire.policy.test.ts` | 20 | 7 / 8 | 12 | 4 | 4 |
| `questionnaire/questionnaire-screen.test.ts` | 1 | 0 / 0 | 1 | 0 | 0 |
| `questionnaire/questionnaire.state.test.ts` | 8 | 6 / 7 | 1 | 5 | 2 |
| `questionnaire/question.test.ts` | 5 | 4 / 4 | 1 | 4 | 0 |
| `questionnaire/uc/questionnaire.uc-defs.test.ts` | 14 | 14 / 14 | 0 | 13 | 1 |
| `questionnaire/job/sweep-abandoned-questionnaires.job.test.ts` | 4 | 3 / 3 | 1 | 1 | 2 |
| `questionnaire.module.test.ts` | 7 | 6 / 6 | 1 | 0 | 6 |
| **итого** | **213** | **85 / 108** | **105** | **66** | **42** |

Кандидатов — **85 объявлений (108 исполнений, 51 % тестов)**. Предполагаемый итог
после чистки: ~105 исполнений в домене + 3 перенесённых кейса в тесты модуля
`modules/questionnaire`; файлов удаляется целиком — **1** (`uc/questionnaire.uc-defs.test.ts`).

Распределение кандидатов по закономерностям: Б-1 — 2, Б-2 — 4, Б-3 — 1, Б-6 — 23,
Б-7 — 19, Б-8 — 23, Б-9 — 5, Б-11 — 8. Б-4, Б-5, Б-10, Б-12, Б-13 в домене анкет
не встретились (`stream`-специфичные «файл-двойник» и «тест фейка» здесь отсутствуют;
мёртвые экспорты `QuestionnaireEngine` — см. §5, п. 1).

## 2. Закономерности

### Б-1 — правило проверено уровнем ниже и повторено выше (2 случая)

Legacy-разбор записи (`ISO → числа`, `updatedAt = createdAt`, `version = 0`) проверен
на схеме `QuestionnaireArDef.state` и повторён в тесте настоящего чтения репозиторием.

- `questionnaire/questionnaire.state.test.ts:42` — `it.each` standard/likert: ISO → числа.
- `questionnaire/questionnaire.state.test.ts:60` — даты ответов, `warnedAt`,
  `continueInvitedAt`, `completedAt` — числа.

### Б-2 — вопрос Ar проверен своим `it` и через единственного потребителя (4 случая)

- `questionnaire/questionnaire.ar.test.ts:390` — `isOf` (единственный потребитель —
  правило `isRespondent`: `questionnaire.policy.ts:27`).
- `questionnaire/questionnaire.ar.test.ts:403` — `idleFor` (одна строка,
  `questionnaire.ar.ts:233`; потребители — `needsSweep`/`sweepIdle`, покрыты своим тестом).
- `questionnaire/questionnaire.policy.test.ts:37` — `hasRespondent` (check — `() => true`,
  `questionnaire.policy.ts:20`; смысл правила — отказ системному вызову, а это делает
  платформа).
- `questionnaire/questionnaire-engine.test.ts:24` — `getByCode` (map-lookup; потребитель —
  `buildValidationSchema`, покрыт `:40`).

### Б-3 — общий хелпер проверен в каждом вызывающем (1 случай)

Проверка «в payload нет `telegramId`/`response`, есть `ownerInfo`» сделана циклом по всем
шести событиям в `questionnaire.events.test.ts:55` и повторена для `started` на уровне Ar.

- `questionnaire/questionnaire.ar.test.ts:96` — «событие без telegramId и ответа экрана».

### Б-6 — копия соседнего теста без нового класса входа; строка таблицы отдельным `it` (23 случая)

Самый частый случай модуля: тот же класс входа и та же ветка кода, что у соседнего теста
(другое значение, другая точка входа, другая фикстура).

- `questionnaire/questionnaire.ar.idle.test.ts:38` («5 ч — приглашение продолжить») и
  `:56` («8.5 ч без warnedAt») — те же ветки `sweepIdle`, что у `:25`/`:44`; пороги уже
  закреплены лестницей `needsSweep` (`:143`).
- `questionnaire/questionnaire.ar.answers.test.ts:140` (screen завершённой анкеты) —
  та же ветка `QuestionnaireScreen.finished()`, что у `ar.test.ts:189`.
- `questionnaire/questionnaire-engine.test.ts:433` (intensive-ветка) и `:465`
  (позиция/размер на простом пуле) — тот же расчёт `getProgress`, что у `:421`.

### Б-7 — ручной паспорт Def: дубль `arch:check` (19 случаев)

Состав `errors`/`emits`/`calls`/`scans`, реэкспорт ключами, `ArchChecker` в тестах модуля.
9 из 14 тестов `uc/questionnaire.uc-defs.test.ts` — этот случай (ещё 5 — схемы входа,
Б-8); паспорт модуля — 6 тестов `questionnaire.module.test.ts`.

- `questionnaire/uc/questionnaire.uc-defs.test.ts:35` — Def UC: `callers`, `policy`, `errors`,
  `emits` (правила MAN-05/08/11/12 держит `arch:check`; реальное поведение — тесты
  `modules/questionnaire/src/questionnaire/uc/*.uc.test.ts`).
- `questionnaire.module.test.ts:60` — `ArchChecker.defsOf([...]).report()` — это и есть
  шаг `arch:check` из `bun run check`.
- `questionnaire/questionnaire.events.test.ts:29` — «ровно шесть событий» (состав группы).

### Б-8 — схема платформы: приём/отказ полей `F.uuid`, `picklist`, `variant` (23 случая)

- `questionnaire/questionnaire.events.test.ts:79` — `it.each` по четырём событиям:
  «без `ownerInfo`, `kind` или с чужим `kind`/uuid — недопустим».
- `questionnaire/questionnaire.state.test.ts:108` — «неизвестный `kind` и статус отклоняются»
  (`v.variant` + `F.picklist`).
- `questionnaire/uc/questionnaire.uc-defs.test.ts:165` — схема входа `handleAction`:
  `type: 'callback' | 'text'` — отказ варианта вне перечня.

### Б-9 — поведение платформы (5 случаев)

«Без субъекта — отказ» (`NamedRule.evaluate` не вызывает `check`, `dmg-core`), «событий нет»
у операции, `version` растёт от `change`.

- `questionnaire/questionnaire.policy.test.ts:43`, `:67`, `:83` — «без субъекта — denied»
  для трёх правил.
- `questionnaire/questionnaire.ar.test.ts:219` — «событий не публикует» у `start`.
- `questionnaire/questionnaire.ar.idle.test.ts:116` — «флаг растит `version`».

### Б-11 — тавтология: константа ↔ та же константа, ожидание тем же продовым кодом (8 случаев)

- `questionnaire/job/sweep-abandoned-questionnaires.job.test.ts:34` — `INVITE_AFTER_HOURS === 3`
  и `INVITE_AFTER_IDLE_MS === 3 * HOUR`, где второе посчитано из первого.
- `questionnaire/questionnaire.ar.test.ts:396` — `expect(ar.view()).toEqual(ar.snapshot())`.
- `questionnaire/questionnaire.errors.test.ts:28` — шесть текстов `label` (TST-09: тексты
  `label` проверяют тесты UI).

### Новые закономерности (Н-ID)

Нет. Все 85 кандидатов сводятся к Б-1…Б-11. Отдельно отмечу два смежных места (не выделял
в новую закономерность, т.к. это разновидности Б-6/Б-11), которые стоит держать в уме при
разборе других модулей:

- **тест-обещание** — имя заявляет правило, тело проверяет литерал фикстуры:
  `questionnaire.ar.idle.test.ts:204` называется «отбор likert исключает Job (kinds: standard)»,
  а проверяет только `snapshot().kind === 'likert'`. Потеря при удалении нулевая, но такой
  тест создаёт ложное чувство покрытия (настоящее правило проверяет
  `modules/questionnaire/.../job/...test.ts:74`);
- **тест-ссылка** — тело только нормализует Def и сверяет имя, комментарий говорит
  «сверка в другом файле»: `job/sweep-abandoned-questionnaires.job.test.ts:59`.

## 3. Кандидаты

Оценка «сомнителен» — защита есть, но её держит другой тест или уровень; «пуст» —
падение не означает ошибку в проде.

| путь:строка | тест | Б | оценка | где покрыто | что делать |
|---|---|---|---|---|---|
| `ar.test.ts:38` | четыре статуса и четыре перехода (MAN-12) | Б-11 | пуст | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:179` (Def несёт статусы/переходы) + `:215` (отказ для каждого статуса вне `from`) | удалить |
| `ar.test.ts:47` | события агрегата: шесть имён | Б-11 | пуст | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06: опубликованное событие объявлено) | удалить |
| `ar.test.ts:96` | событие без telegramId и ответа экрана | Б-3 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.events.test.ts:55` (то же для всех шести событий) | удалить |
| `ar.test.ts:102` | ownerInfo сохраняется как есть; пустой — `{}` | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.ar.test.ts:62` (ownerInfo в снимке создания) | удалить |
| `ar.test.ts:119` | экран — первый вопрос пула | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.ar.test.ts:178` (экран `in_progress`) | удалить |
| `ar.test.ts:151` | ownerInfo без triggerEvent (likert) | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.ar.test.ts:129` (ownerInfo в снимке likert) | удалить |
| `ar.test.ts:219` | событий не публикует — started только при создании | Б-9 | сомнителен | `modules/questionnaire/src/questionnaire/uc/start-by-invite.uc.test.ts:64` (то же на реальном UC) | удалить |
| `ar.test.ts:225` | likert: invited → in_progress, первый вопрос по шкале | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.ar.likert.test.ts:50` (start + ответы likert целиком) | удалить |
| `ar.test.ts:252` | после decline — QUESTIONNAIRE_NOT_INVITED | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.ar.test.ts:238` (строка `abandoned` той же таблицы отказов) | удалить |
| `ar.test.ts:357` | снапшот восстановленной анкеты совпадает с исходным | Б-11 | пуст | `modules/questionnaire/src/infra/questionnaire.json-repo.test.ts:103` (round-trip записи репозиторием) | удалить |
| `ar.test.ts:367` | восстановленная анкета продолжает заполнение | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.ar.answers.test.ts:332` (restore + `handleAction` через движок) | удалить |
| `ar.test.ts:383` | текущий вопрос вне пула — исключение | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.ar.answers.test.ts:355` (то же с проверкой текста исключения) | удалить |
| `ar.test.ts:390` | `isOf`: респондент — да, другой — нет | Б-2 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.policy.test.ts:54` (правило `isRespondent` на тех же входах) | удалить |
| `ar.test.ts:396` | `view`: копия состояния, даты числами | Б-11 | пуст | `modules/questionnaire/src/questionnaire/uc/get-questionnaire.uc.test.ts:40` (даты числами в реальном ответе) + `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:272` (view = копия) | удалить |
| `ar.test.ts:403` | `idleFor`: простой от updatedAt в мс | Б-2 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.ar.idle.test.ts:162` (то же значение через простой) | удалить |
| `ar.answers.test.ts:140` | screen завершённой анкеты — completed | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.ar.test.ts:189` (оба итоговых статуса) | удалить |
| `ar.answers.test.ts:292` | «Далее» после снятия всех вариантов — empty_selection | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.ar.answers.test.ts:279` (та же ветка `empty_selection`) | удалить |
| `ar.idle.test.ts:38` | 5 ч — приглашение, ещё не предупреждение | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.ar.idle.test.ts:25` (та же ветка `continueInvitedAt`, порог 3 ч) + `:143` (пороги `needsSweep`) | удалить |
| `ar.idle.test.ts:56` | 8.5 ч без warnedAt — предупреждение, не закрытие | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.ar.idle.test.ts:44` (та же ветка `warnedAt`; `:69` — закрытие на 9 ч) | удалить |
| `ar.idle.test.ts:63` | 7 ч с continueInvitedAt, без warnedAt — предупреждение | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.ar.idle.test.ts:106` (предупреждение при уже выставленном флаге приглашения) | удалить |
| `ar.idle.test.ts:116` | флаг растит version, но не updatedAt | Б-9 | сомнителен | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:395` (каждая мутация растит версию) + `questionnaire.ar.idle.test.ts:25` (updatedAt не сдвинут) | удалить |
| `ar.idle.test.ts:204` | отбор likert исключает Job; Ar likert хранит kind | Б-11 | пуст | `modules/questionnaire/src/questionnaire/job/sweep-abandoned-questionnaires.job.test.ts:74` (likert при простое 10 ч не затрагивается) | удалить |
| `ar.likert.test.ts:77` | ownerInfo без triggerEvent (payload completed) | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.ar.likert.test.ts:50` (ownerInfo в payload события) | удалить |
| `ar.likert.test.ts:103` | несколько вопросов одной подкатегории при weight = 1 | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.ar.likert.test.ts:90` (то же среднее с весами, которое проверяет и группировку) | удалить |
| `ar.likert.test.ts:117` | статус completed и completedAt = at последнего ответа | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.ar.answers.test.ts:110` (та же строка `draft.completedAt = at`) | удалить |
| `engine.test.ts:8` | загружает и валидирует корректный пул | Б-6 | пуст | `domain/src/questionnaire/questionnaire/questionnaire-engine.test.ts:192` (движок строится и вопросы достаются) | удалить |
| `engine.test.ts:24` | `getByCode` возвращает вопрос по коду | Б-2 | пуст | `domain/src/questionnaire/questionnaire/questionnaire-engine.test.ts:40` (единственный потребитель — `buildValidationSchema`) | удалить |
| `engine.test.ts:49` | `buildValidationSchema` для single choice — picklist | Б-8 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.ar.answers.test.ts:243` (чужой код ответа отсекается до схемы) | удалить |
| `engine.test.ts:159` | condition на более ранний вопрос — пул валиден | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire-engine.test.ts:216` (ветвление по условию назад работает) | удалить |
| `engine.test.ts:304` | одиночный ответ — тот же путь (split) | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire-engine.test.ts:286` (та же ветка `split`+`some`) | удалить |
| `engine.test.ts:433` | intensive-ветка: total = 9 | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire-engine.test.ts:421` (тот же расчёт маршрута; ветка — данные) | слить в `:421` (`it.each` по ветке) |
| `engine.test.ts:465` | 1-based позиция и размер пула | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire-engine.test.ts:421` (тот же `getProgress` на реальном пуле) | удалить |
| `errors.test.ts:9` | шесть ошибок группы QUESTIONNAIRE | Б-7 | пуст | `node_modules/dmg-core/src/arch/def-checker.test.ts:426` (ERR-04: коды уникальны и с префиксом) | удалить |
| `errors.test.ts:28` | `it.each` — шесть текстов `label` | Б-11 | пуст | «нигде»: TST-09 — тексты `label` проверяют тесты UI, в домене не тестируются | удалить |
| `errors.test.ts:44` | NOT_FOUND несёт questionnaireId | Б-8 | сомнителен | `modules/questionnaire/src/questionnaire/uc/start-by-invite.uc.test.ts:89` (payload из реального отказа) | удалить |
| `events.test.ts:29` | ровно шесть событий | Б-7 | пуст | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06; про количество — «нигде», состав группы не проверяется правилом) | удалить |
| `events.test.ts:42` | `it.each` — FQN `questionnaire.questionnaire.<key>` | Б-11 | пуст | `node_modules/dmg-core/src/domain/events/event-def.test.ts:16` (имя = префикс + ключ) + `def-checker.test.ts:325` (MAN-08) | удалить |
| `events.test.ts:74` | payload четырёх событий допустим для обоих kind | Б-8 | сомнителен | `modules/questionnaire/src/questionnaire/job/sweep-abandoned-questionnaires.job.test.ts:95` (реальная публикация `continueInvite` с payload) | удалить |
| `events.test.ts:79` | без ownerInfo/kind, чужой kind/uuid — недопустим | Б-8 | сомнителен | «нигде»: отказ полей платформы (`F.uuid`, `F.picklist`, обязательность `v.object`) держат платформа и вызывающие | удалить |
| `events.test.ts:88` | прежнее поле `owner` вместо `ownerInfo` не принимается | Б-8 | пуст | «нигде»: отдельного правила «прежняя форма» у события нет — это та же обязательность `ownerInfo` (строка `:79`), у события нет данных для миграции | удалить |
| `events.test.ts:97` | completed standard: ref; likertScores отбрасываются | Б-8 | сомнителен | `modules/questionnaire/src/questionnaire/uc/handle-action.uc.test.ts:57` (реальное событие `completed` без ответов) | удалить |
| `events.test.ts:101` | completed likert: ref + likertScores | Б-8 | сомнителен | `modules/questionnaire/src/questionnaire/uc/handle-action.uc.test.ts:88` (реальные баллы в событии) | удалить |
| `events.test.ts:106` | likert без likertScores — недопустим | Б-8 | пуст | «нигде»: обязательность поля в `v.variant` — свойство платформы | удалить |
| `events.test.ts:128` | `it.each` — reason timeout/by_user/declined допустим | Б-8 | сомнителен | `modules/questionnaire/src/questionnaire/uc/abandon.uc.test.ts:41` (реальное событие с `reason: by_user`) | удалить |
| `events.test.ts:135` | reason обязателен и из перечня | Б-8 | пуст | «нигде»: `F.picklist` + обязательность поля — платформа | удалить |
| `state.test.ts:42` | `it.each` — ISO → числа, updatedAt = createdAt, version = 0 | Б-1 | сомнителен | `modules/questionnaire/src/infra/questionnaire.json-repo.test.ts:159` (то же при чтении legacy-файла) | удалить |
| `state.test.ts:60` | даты ответов, warnedAt, continueInvitedAt, completedAt — числа | Б-1 | сомнителен | `modules/questionnaire/src/infra/questionnaire.json-repo.test.ts:173` (те же поля читаются из ISO) | удалить |
| `state.test.ts:81` | abandonReason и ownerInfo сохраняются | Б-8 | сомнителен | «нигде»: `F.picklist` + `v.record` — платформа | удалить |
| `state.test.ts:94` | числовые даты и version сохраняются как есть | Б-8 | пуст | «нигде»: `BaseEntityFields` платформы; `aggregate.test.ts:378` держит разбор записи через JSON | удалить |
| `state.test.ts:108` | неизвестный kind и статус отклоняются | Б-8 | пуст | «нигде»: `v.variant` + `F.picklist` — платформа | удалить |
| `state.test.ts:122` | пул без вопросов, битая дата и не-uuid респондента отклоняются | Б-8 | сомнителен | `modules/questionnaire/src/questionnaire/uc/start-questionnaire.uc.test.ts:76` (пул без вопросов отклоняется); дата и uuid — платформа, «нигде» | удалить |
| `question.test.ts:22` | валидный пул со всеми полями | Б-8 | сомнителен | `domain/src/questionnaire/questionnaire/question.test.ts:7` (та же схема, валидная строка) | слить в `:7` |
| `question.test.ts:41` | questions — обязательное поле | Б-8 | сомнителен | `domain/src/questionnaire/questionnaire/question.test.ts:7` (та же схема, строка «невалидно») | слить в `:7` |
| `question.test.ts:46` | пустой массив questions — ошибка | Б-8 | сомнителен | `domain/src/questionnaire/questionnaire/question.test.ts:7` (та же схема, строка «невалидно») | слить в `:7` |
| `question.test.ts:51` | невалидный вопрос в пуле — ошибка | Б-8 | сомнителен | `domain/src/questionnaire/questionnaire/question.test.ts:7` (та же схема, строка «невалидно») | слить в `:7` |
| `module.test.ts:45` | модуль не внешний | Б-7 | пуст | `node_modules/dmg-core/src/arch/def-checker.test.ts:624` (у внешнего модуля нет ER и Job) | удалить |
| `module.test.ts:60` | `ArchChecker` по модулю — без нарушений | Б-7 | пуст | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (то же выполняет `arch:check` в `bun run check`) | удалить |
| `module.test.ts:64` | контракт экспортирует 9 Def UC, Job, события, ошибки, пулы | Б-7 | пуст | `platform/app/tests/u7-app.test.ts:422` (UC и события берутся из контракта реально) | удалить |
| `module.test.ts:88` | completed — FQN и payload (ownerInfo) | Б-7 | пуст | `modules/questionnaire/src/questionnaire/uc/handle-action.uc.test.ts:57` (реальное событие) | удалить |
| `module.test.ts:96` | abandoned — FQN, reason обязателен и из перечня | Б-7 | пуст | `modules/questionnaire/src/questionnaire/uc/abandon.uc.test.ts:41` (реальное событие с reason) | удалить |
| `module.test.ts:111` | UC вызывается другим модулем по calls (D-42) | Б-7 | пуст | `node_modules/dmg-core/src/arch/def-checker.test.ts:348` (ARC-04: `calls` ⊆ `dependsOn`) | удалить |
| `job/sweep-abandoned-questionnaires.job.test.ts:34` | константы ступеней 3/6/9 ч и мс | Б-11 | пуст | `domain/src/questionnaire/questionnaire/questionnaire.ar.idle.test.ts:25` (3 ч — приглашение; `:44` — 6 ч; `:69` — 9 ч) | удалить |
| `job/sweep-abandoned-questionnaires.job.test.ts:44` | сканирует questionnaire, публикует три события | Б-7 | сомнителен | `modules/questionnaire/src/questionnaire/job/sweep-abandoned-questionnaires.job.test.ts:95` (реальная публикация `continueInvite`) | удалить |
| `job/sweep-abandoned-questionnaires.job.test.ts:59` | входит в паспорт модуля | Б-6 | пуст | `domain/src/questionnaire/questionnaire.module.test.ts:49` (список `jobs` в составе модуля) | удалить |
| `uc/questionnaire.uc-defs.test.ts:35` | StartQuestionnaire: system, hasRespondent, emits started | Б-7 | пуст | `modules/questionnaire/src/questionnaire/uc/start-questionnaire.uc.test.ts:53` (реальная публикация started) | удалить |
| `uc/questionnaire.uc-defs.test.ts:50` | вход — пул и ownerInfo; `owner` не принимается | Б-8 | сомнителен | `modules/questionnaire/src/questionnaire/uc/start-questionnaire.uc.test.ts:76` (пул без вопросов) | перенести в тест модуля с реальным вызовом (отказ `owner`) |
| `uc/questionnaire.uc-defs.test.ts:64` | выход пустой | Б-8 | пуст | `modules/questionnaire/src/questionnaire/uc/start-questionnaire.uc.test.ts:37` (реальный ответ UC) | удалить |
| `uc/questionnaire.uc-defs.test.ts:70` | SendLikertInvite: system, hasRespondent, emits invited | Б-7 | пуст | `modules/questionnaire/src/questionnaire/uc/send-likert-invite.uc.test.ts:48` (реальная публикация invited) | удалить |
| `uc/questionnaire.uc-defs.test.ts:82` | вход — likert-пул и ownerInfo | Б-8 | сомнителен | `modules/questionnaire/src/questionnaire/uc/send-likert-invite.uc.test.ts:37` (реальный вызов с likert-пулом) | удалить |
| `uc/questionnaire.uc-defs.test.ts:96` | StartByInvite: canAccess, NOT_FOUND и NOT_INVITED, без emits | Б-7 | пуст | `modules/questionnaire/src/questionnaire/uc/start-by-invite.uc.test.ts:89` (+ `:79` — NOT_INVITED) | удалить |
| `uc/questionnaire.uc-defs.test.ts:113` | вход `{ questionnaireId }`, выход — экран | Б-8 | сомнителен | `modules/questionnaire/src/questionnaire/uc/start-by-invite.uc.test.ts:40` (реальный вход и ответ) | удалить |
| `uc/questionnaire.uc-defs.test.ts:126` | DeclineInvite: canAccess, событие abandoned | Б-7 | пуст | `modules/questionnaire/src/questionnaire/uc/decline-invite.uc.test.ts:48` (реальное событие `declined`) | удалить |
| `uc/questionnaire.uc-defs.test.ts:146` | HandleAction: canAccess, четыре ошибки, completed | Б-7 | пуст | `modules/questionnaire/src/questionnaire/uc/handle-action.uc.test.ts:126` (+ `:135`, `:144`, `:160` — остальные три ошибки) | удалить |
| `uc/questionnaire.uc-defs.test.ts:165` | вход `{ questionnaireId, type: callback\|text, value }` | Б-8 | сомнителен | `modules/questionnaire/src/questionnaire/uc/handle-action.uc.test.ts:47` (реальный вход) | перенести в тест модуля: отказ `type: 'photo'` |
| `uc/questionnaire.uc-defs.test.ts:177` | Abandon: canAccess, NOT_FOUND и NOT_ACTIVE | Б-7 | пуст | `modules/questionnaire/src/questionnaire/uc/abandon.uc.test.ts:80` (+ `:87` — NOT_FOUND) | удалить |
| `uc/questionnaire.uc-defs.test.ts:197` | GetQuestionnaire: query, вход, выход — вид анкеты | Б-7 | пуст | `modules/questionnaire/src/questionnaire/uc/get-questionnaire.uc.test.ts:40` (реальный вид с датами-числами) | удалить |
| `uc/questionnaire.uc-defs.test.ts:214` | GetCurrent: query, NOT_FOUND, выход — экран | Б-7 | пуст | `modules/questionnaire/src/questionnaire/uc/get-current.uc.test.ts:48` (+ `:101` — NOT_FOUND) | удалить |
| `uc/questionnaire.uc-defs.test.ts:235` | GetQuestionnairesByUser: canListFor, `{ userId }`, массив видов | Б-7 | пуст | `modules/questionnaire/src/questionnaire/uc/get-questionnaires-by-user.uc.test.ts:51` (реальный список респондента) | удалить |
| `policy.test.ts:23` | правила: hasRespondent, isRespondent, isAdmin, canAccess, canListFor | Б-7 | пуст | `domain/src/questionnaire/questionnaire/questionnaire.policy.test.ts:89` (наличие `canAccess` доказано поведением; остальные — своими тестами в файле) | удалить |
| `policy.test.ts:37` | hasRespondent: человек — allowed | Б-2 | сомнителен | `modules/questionnaire/src/questionnaire/uc/start-questionnaire.uc.test.ts:37` (реальный запуск за субъекта) | удалить |
| `policy.test.ts:43` | hasRespondent: системный вызов — denied | Б-9 | пуст | `modules/questionnaire/src/questionnaire/uc/start-questionnaire.uc.test.ts:70` (то же на реальном UC) + `node_modules/dmg-core/src/domain/policy/rule.test.ts:69` | удалить |
| `policy.test.ts:67` | isRespondent: без субъекта — denied | Б-9 | пуст | `node_modules/dmg-core/src/domain/policy/rule.test.ts:69` (без субъекта `check` не вызывается) | удалить |
| `policy.test.ts:73` | isAdmin: роль admin — allowed | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.policy.test.ts:95` (тот же `isAdmin` через `canAccess`) | удалить |
| `policy.test.ts:79` | `it.each` — роли student/mentor — denied | Б-6 | сомнителен | `domain/src/questionnaire/questionnaire/questionnaire.policy.test.ts:101` (та же таблица отказов `canAccess`) | удалить |
| `policy.test.ts:83` | isAdmin: без субъекта — denied | Б-9 | пуст | `node_modules/dmg-core/src/domain/policy/rule.test.ts:69` | удалить |

### Остающиеся проверки `label`/`denyMessage` (TST-09)

Полезные тесты, в которых строку с текстом нужно снять в том же срезе; смысл теста
(код ошибки, форма ответа) сохраняется:

- `questionnaire/questionnaire.ar.test.ts:350` — `error.label` «Анкета не активна».
- `questionnaire/questionnaire.ar.answers.test.ts:83` — `error.label` CHOICE_EXPECTED.
- `questionnaire/questionnaire.ar.answers.test.ts:94` — `error.label` EMPTY_ANSWER_CODE.
- `questionnaire/questionnaire.ar.answers.test.ts:157` — `error.label` NOT_IN_PROGRESS.
- `questionnaire/questionnaire.policy.test.ts:109` — `denyMessage` «Нет доступа к анкете».
- `questionnaire/questionnaire.policy.test.ts:135` — `denyMessage` «Нет доступа к списку анкет пользователя».

После удаления кандидатов `errors.test.ts` и `events.test.ts` проверок `label` в домене
анкет не остаётся.

## 4. Полезные тесты

- `questionnaire/questionnaire.ar.test.ts` — 25 тестов: создание обычной и likert-анкеты
  (состав снимка, единственное событие), приглашение и итоговые экраны, `start`/`decline`/
  `abandon` со всеми ветками `Err` (в т.ч. идемпотентный повтор на `abandoned`), отказ
  `NOT_ACTIVE` на `completed`, инварианты записи (`abandoned ⇒ abandonReason`,
  `in_progress ⇒ currentQuestionCode`).
- `questionnaire/questionnaire.ar.answers.test.ts` — 24 теста: фиксация ответа (`answeredAt`,
  `answerCode: 'text'`, `answerText`), завершение с `completionText`/`completedAt`,
  `NOT_IN_PROGRESS` для трёх статусов, тоггл черновика multiple (включая удаление ключа),
  ответ из черновика по «Далее», прогресс `wait_next`/`new_question`, все ветки
  `stale_answer` (чужой код, чужой «Далее», пустой выбор, callback на text-вопросе),
  сброс флагов простоя stale-ответом без сдвига `updatedAt`.
- `questionnaire/questionnaire.ar.idle.test.ts` — 18 тестов: все ступени `sweepIdle`
  (3 ч, 6 ч с пропуском 3 ч, 9 ч `timeout`, `invited` 9 ч), идемпотентность повтора,
  независимость флагов, `updatedAt` не сдвигается, лестница `needsSweep`, `idleFor` от
  `updatedAt`, сброс флагов активностью и `start`, перезапуск цепочки после возобновления.
- `questionnaire/questionnaire.ar.likert.test.ts` — 3 теста: расчёт `likertScores`
  (взвешенное среднее и группировка), состав события `completed` для likert,
  `LikertQuestion → choice` (пять вариантов шкалы, `multiple: false`).
- `questionnaire/questionnaire-engine.test.ts` — 16 тестов: схемы валидации ответа text и
  multiple (свой `check` допустимых кодов), отказы целостности пула (дубль `questionCode`,
  `condition` на несуществующий/поздний/сам себя вопрос, `answers` у text-вопроса),
  `getNextQuestion` (границы начала/конца, ветвление по условию, any-of на multiple),
  `getProgress` по активному маршруту (base/intensive, до ответа на условие, вопрос чужой
  ветки, неизвестный код).
- `questionnaire/questionnaire.events.test.ts` — 2 теста: «в payload всех событий есть
  `ownerInfo`, нет `telegramId`/`response`/`owner`» (дизайн-инвариант D-63/Q3) и границы
  `LikertScoreSchema` (`score` 1…5, пустая категория — отказ).
- `questionnaire/questionnaire.policy.test.ts` — 12 тестов: `allowed`/`denied` для
  `isRespondent` (роли не важны, чужой и admin-не-респондент), `canAccess` (респондент,
  admin на чужой, таблица отказов), `canListFor` (свой список, admin на чужой, таблица
  отказов).
- `questionnaire/questionnaire-screen.test.ts` — 1 тест: префикс callback-кнопки
  «Далее» `next:<код>` — совместимость с уже отправленными legacy-сообщениями Telegram
  (единственное место, где формат закреплён).
- `questionnaire/questionnaire.state.test.ts` — 1 тест: пул не своей ветки `kind`
  отклоняется (likert-вопросы у `standard` и наоборот) — своя логика `v.variant`.
- `questionnaire/question.test.ts` — 1 тест (`:7`), переписывается в единственную таблицу
  «валидно/невалидно» схемы пула (принимает строки удалённых `:22`, `:41`, `:46`, `:51`).
- `questionnaire.module.test.ts` — 1 тест (`:49`): состав модуля — `dependsOn: [user]`,
  агрегат `questionnaire`, девять UC, один Job, реакций нет (единственный тест состава).
- `questionnaire/job/sweep-abandoned-questionnaires.job.test.ts` — 1 тест (`:21`):
  расписание Job — интервал, равный ступени приглашения (переписать: снять проверку
  `label` — TST-09).
- `questionnaire/questionnaire.errors.test.ts` — полезных нет: все 8 исполнений — кандидаты
  (паспорт группы `ErrorDef`, шесть текстов `label`, payload отказа — покрыто правилом
  ERR-04 и реальным UC `start-by-invite.uc.test.ts:89`).
- `questionnaire/uc/questionnaire.uc-defs.test.ts` — полезных нет: все 14 исполнений —
  кандидаты (Б-7/Б-8); два кейса предлагаю перенести в тесты модуля (§5, п. 2), остальное
  удаляется вместе с файлом — реальное поведение держат `modules/questionnaire/.../uc/*.uc.test.ts`.

## 5. Открытые вопросы

1. **Мёртвые экспорты `QuestionnaireEngine`** (Б-13): `getQuestionText`
   (`questionnaire-engine.ts:106`), `getAnswerText` (`:111`), `getChoices` (`:121`) не
   вызываются ни в проде, ни в тестах. Удалять код — правка вне области чистки тестов;
   решение за orchestrator'ом (кандидат в отдельный срез).
2. **Файл `uc/questionnaire.uc-defs.test.ts` удаляется целиком** (14 тестов). Два кейса
   предлагаю не удалять, а перенести в тесты модуля с реальным вызовом UC: отказ входа с
   полем `owner` (строка `:50`) и отказ `type: 'photo'` в `handleAction` (строка `:165`) —
   сейчас их не покрывает ни один тест `modules/questionnaire`. Подтвердить выбор.
3. **Пирамида против Б-2/Б-9 в `policy.test.ts`.** `testing.md` §3 требует «Policy — каждое
   правило: allowed и denied», а я пометил кандидатами `hasRespondent` (check `() => true`,
   смысл правила — отказ системному вызову, это делает `NamedRule` платформы), `isAdmin`
   (дубль `canAccess`) и три «без субъекта — denied» (поведение платформы). Если приоритет
   у пирамиды — эти 6 строк нужно вернуть в «полезные».
4. **`questionnaire-screen.test.ts` (1 тест) оставлен полезным** как единственное место,
   закрепляющее формат `next:<код>` для уже отправленных сообщений бота. Если совместимость
   со старыми кнопками не считается требованием — тест тавтологичен (Б-11) и удаляется.
5. **Тексты `label`/`denyMessage` в полезных тестах** (6 строк, §3): снимать их в том же
   срезе чистки или отдельным шагом по всем модулям сразу — влияет на порядок таблиц
   удаления остальных модулей.
