# Удаление тестов домена `questionnaire` — таблица

Трек `tst-cleanup_20261105`, фаза Ф2. Источник кандидатов — `inventory/questionnaire-domain.md`
(164 объявления `it`/`test`, из них 85 кандидатов). Базовая линия:
`cd domain && bun test src/questionnaire` → **213 pass, 0 fail, 473 expect()** в 14 файлах
(проверено в worktree `tst-cleanup`).

Пути в колонке «файл» — относительно `domain/src/questionnaire/`. Колонка «где покрыто» —
путь от корня репо и **строка начала** конкретного `it(`/`test(`/`it.each(`, который после
этой таблицы остаётся: файл существует, на строке начинается объявление теста, тест
проверяет то же и сам этой таблицей не удаляется (все ссылки прогнаны скриптом по
текущему коду). Ссылки в `modules/questionnaire` ведут только на тесты, которые
`inventory/questionnaire-app.md` §4 считает полезными (или на приёмники слияний и на
тесты, которые §3 оставляет через «переписать»).
«нигде» — только для Б-9/Б-11/Б-12/Б-13, с фразой, что именно тест мог бы поймать.

Применённые решения (Б-ID — `conductor/roadmap/test-bloat.md` §2, TST —
`node_modules/dmg-core/docs/reference/testing.md` §3, §5, §5.1; решения трека — `spec.md`
«Решения»):

1. **Б-8.** Удаляются приём/отказ полей платформы (`F.uuid`, `F.picklist`, `v.variant`,
   обязательность поля). Остаётся одна таблица «валидно/невалидно» на схему: пул
   (`questionnaire/question.test.ts:7`) и state (`questionnaire/questionnaire.state.test.ts:113`).
   Приём прежней формы записи (legacy ISO) — своя трансформация схемы, поэтому остаётся
   у неё (`questionnaire.state.test.ts:42`, `:60`) и дублируется только реальным чтением
   файла — `modules/questionnaire/src/infra/questionnaire.json-repo.test.ts:159`.
2. **Б-7.** Паспорта Def удаляются все. Тест состава модуля — **один**:
   `questionnaire.module.test.ts:49` (UC, Job, `dependsOn`, агрегат, `reactions`); он уже
   содержит всё нужное, переписывать не требуется.
3. **TST-09.** Тексты `label`/`denyMessage` ошибок не тестируются: отдельные `it` с ними
   удаляются, одиночные `expect` внутри полезных тестов — раздел «Остающиеся проверки
   `label`».
4. **Б-1.** Правило проверяет владелец: у UC модуля остаётся сквозной сценарий и только-UC
   действия. Поэтому из пары «Ar ↔ повторы Job/UC» удаляется дубликат уровня модуля
   (его убирает `questionnaire-app-delete.md`), а Ar-тест остаётся владельцем правила.
   Policy-отказ: по решению трека «каждое правило — allowed и denied» шесть
   тестов `policy.test.ts` (см. «Итог», пункт 1) **сохраняются** — «без субъекта —
   denied» и пара для `isAdmin` есть и в образцах `stream`/`wish`.
5. **Б-13.** Мёртвые экспорты `QuestionnaireEngine` (`getQuestionText`, `getAnswerText`,
   `getChoices`) тестов не имеют — в таблицу не входят, решение по коду — за orchestrator'ом.
6. `questionnaire-screen.test.ts:8` (формат `next:<код>`) — полезен (совместимость с уже
   отправленными кнопками), не трогается.
7. `uc/questionnaire.uc-defs.test.ts` удаляется целиком: два кейса переносятся в тесты
   модуля с реальным вызовом UC (см. «Перенести»), остальные 12 — покрыты тестами
   `modules/questionnaire/src/questionnaire/uc/*.uc.test.ts`.

## Таблица

| файл | строка | тест | Б | действие | где покрыто |
|---|---|---|---|---|---|
| `questionnaire/questionnaire.ar.test.ts` | 38 | четыре статуса и четыре перехода (MAN-12) | Б-11 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:179` (Def несёт статусы и переходы) + `:215` (переход объявляет отказ для каждого статуса вне `from`) |
| `questionnaire/questionnaire.ar.test.ts` | 47 | события агрегата: шесть имён | Б-11 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06: неопубликованное событие и висячий подписчик) |
| `questionnaire/questionnaire.ar.test.ts` | 96 | событие без telegramId и ответа экрана (D-63, Q3) | Б-3 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.events.test.ts:55` (то же для всех шести событий) |
| `questionnaire/questionnaire.ar.test.ts` | 102 | ownerInfo сохраняется как есть; пустой — `{}` | Б-6 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.ar.test.ts:62` (ownerInfo в снимке создания) + `modules/questionnaire/src/questionnaire/uc/start-questionnaire.uc.test.ts:37` (ownerInfo доходит до записи реального UC) |
| `questionnaire/questionnaire.ar.test.ts` | 119 | экран — первый вопрос пула | Б-6 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.ar.test.ts:178` (`in_progress`: `new_question` с текущим вопросом) + `:204` (`start` выдаёт `q1`) |
| `questionnaire/questionnaire.ar.test.ts` | 151 | ownerInfo без triggerEvent сохраняется как есть (likert) | Б-6 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.ar.test.ts:129` (ownerInfo likert в снимке) + `:144` (ownerInfo в payload `invited`) |
| `questionnaire/questionnaire.ar.test.ts` | 252 | после decline — QUESTIONNAIRE_NOT_INVITED | Б-6 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.ar.test.ts:238` (`start` из трёх статусов — `NOT_INVITED`) |
| `questionnaire/questionnaire.ar.test.ts` | 357 | снапшот восстановленной анкеты совпадает с исходным | Б-11 | удалить | `modules/questionnaire/src/infra/questionnaire.json-repo.test.ts:103` (round-trip через файл) + `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:251` (restore без событий) |
| `questionnaire/questionnaire.ar.test.ts` | 367 | восстановленная анкета продолжает заполнение с того же места | Б-6 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.ar.answers.test.ts:332` (restore + `handleAction`) |
| `questionnaire/questionnaire.ar.test.ts` | 383 | текущий вопрос вне пула — исключение (Т13) | Б-6 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.ar.answers.test.ts:355` (то же с проверкой текста исключения) |
| `questionnaire/questionnaire.ar.test.ts` | 390 | `isOf`: респондент — да, другой — нет | Б-2 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.policy.test.ts:54` (правило `isRespondent` на тех же входах) + `:60` (таблица отказов) |
| `questionnaire/questionnaire.ar.test.ts` | 396 | `view`: копия состояния, даты числами (DOM-17, Т11) | Б-11 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:272` (view по умолчанию — копия) + `modules/questionnaire/src/questionnaire/uc/get-questionnaire.uc.test.ts:40` (даты числами в реальном ответе) |
| `questionnaire/questionnaire.ar.test.ts` | 403 | `idleFor`: простой от updatedAt в мс | Б-2 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.ar.idle.test.ts:162` (`idleFor` считается от `updatedAt`) |
| `questionnaire/questionnaire.ar.answers.test.ts` | 140 | screen завершённой анкеты — completed | Б-6 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.ar.test.ts:189` (`it.each` оба итоговых статуса — тот же экран) |
| `questionnaire/questionnaire.ar.answers.test.ts` | 292 | multiple: «Далее» после снятия всех вариантов — empty_selection | Б-6 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.ar.answers.test.ts:279` (та же ветка `empty_selection`) |
| `questionnaire/questionnaire.ar.idle.test.ts` | 116 | флаг растит version, но не updatedAt (Т1) | Б-9 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:395` (каждая мутация растит версию) + `domain/src/questionnaire/questionnaire/questionnaire.ar.idle.test.ts:25` (`updatedAt` прежний) |
| `questionnaire/questionnaire.ar.idle.test.ts` | 204 | отбор likert исключает Job; Ar likert хранит kind | Б-11 | удалить | `modules/questionnaire/src/questionnaire/job/sweep-abandoned-questionnaires.job.test.ts:55` (реальные параметры выборки: `kinds: ['standard']`) + `domain/src/questionnaire/questionnaire/questionnaire.ar.test.ts:129` (`kind: likert` в снимке) |
| `questionnaire/questionnaire.ar.likert.test.ts` | 77 | ownerInfo без triggerEvent (payload completed) | Б-6 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.ar.likert.test.ts:50` (ownerInfo в payload `completed`) |
| `questionnaire/questionnaire.ar.likert.test.ts` | 103 | несколько вопросов одной подкатегории при weight = 1 | Б-6 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.ar.likert.test.ts:90` (средневзвешенное — тот же расчёт и группировка) |
| `questionnaire/questionnaire.ar.likert.test.ts` | 117 | статус completed и completedAt = at последнего ответа | Б-6 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.ar.answers.test.ts:110` (`status: completed`, `completedAt = at`) |
| `questionnaire/questionnaire-engine.test.ts` | 8 | загружает и валидирует корректный пул | Б-6 | удалить | `domain/src/questionnaire/questionnaire/questionnaire-engine.test.ts:192` (движок строится, вопросы достаются) |
| `questionnaire/questionnaire-engine.test.ts` | 24 | `getByCode` возвращает вопрос по коду | Б-2 | удалить | `domain/src/questionnaire/questionnaire/questionnaire-engine.test.ts:40` (единственный потребитель — `buildValidationSchema`) |
| `questionnaire/questionnaire-engine.test.ts` | 49 | `buildValidationSchema` для single choice — picklist | Б-8 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.ar.answers.test.ts:243` (чужой код ответа отсекается той же схемой) |
| `questionnaire/questionnaire-engine.test.ts` | 159 | condition на более ранний вопрос — пул валиден | Б-6 | удалить | `domain/src/questionnaire/questionnaire/questionnaire-engine.test.ts:216` (ветвление по условию назад работает) + `:97`, `:120` (отказы несуществующий/поздний) |
| `questionnaire/questionnaire-engine.test.ts` | 304 | одиночный ответ — тот же путь (split) | Б-6 | удалить | `domain/src/questionnaire/questionnaire/questionnaire-engine.test.ts:286` (та же ветка `split`+`some`: `'mon,wed'`) |
| `questionnaire/questionnaire-engine.test.ts` | 433 | intensive-ветка: total = 9 | Б-6 | слить в `questionnaire/questionnaire-engine.test.ts:421` | — (второй кейс `it.each` по ветке: base/intensive) |
| `questionnaire/questionnaire-engine.test.ts` | 465 | 1-based позиция и размер пула | Б-6 | удалить | `domain/src/questionnaire/questionnaire/questionnaire-engine.test.ts:421` (тот же `getProgress` на реальном пуле) + `:450` (позиция до ответа на условие) |
| `questionnaire/questionnaire.errors.test.ts` | 9 | шесть ошибок группы QUESTIONNAIRE | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:426` (ERR-04: один код у разных Def) + `:654` (ERR-02: ошибка правила не объявлена в `errors` UC) |
| `questionnaire/questionnaire.errors.test.ts` | 28 | `it.each` — шесть текстов `label` | Б-11 | удалить | «нигде»: TST-09 — тексты `label` в домене не тестируются, их видят тесты UI |
| `questionnaire/questionnaire.errors.test.ts` | 44 | NOT_FOUND несёт questionnaireId | Б-8 | удалить | `modules/questionnaire/src/questionnaire/uc/get-questionnaire.uc.test.ts:62` (payload `{ questionnaireId }` из реального отказа своего `load`) |
| `questionnaire/questionnaire.events.test.ts` | 29 | ровно шесть событий | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06: событие без публикации и публикация без объявления) |
| `questionnaire/questionnaire.events.test.ts` | 42 | `it.each` — FQN `questionnaire.questionnaire.<key>` | Б-11 | удалить | `node_modules/dmg-core/src/domain/events/event-def.test.ts:16` (имя = префикс + ключ) + `node_modules/dmg-core/src/arch/def-checker.test.ts:325` (MAN-08: префикс = модуль + агрегат) |
| `questionnaire/questionnaire.events.test.ts` | 74 | payload четырёх событий допустим для обоих kind | Б-8 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.ar.idle.test.ts:25` (`continueInvite` через `make`), `:44` (`abandonWarning`), `modules/questionnaire/src/questionnaire/uc/start-questionnaire.uc.test.ts:37` (`started`), `modules/questionnaire/src/questionnaire/uc/send-likert-invite.uc.test.ts:37` (`invited`) |
| `questionnaire/questionnaire.events.test.ts` | 79 | без ownerInfo/kind, чужой kind/uuid — недопустим | Б-8 | удалить | `node_modules/dmg-core/src/domain/events/event-def.test.ts:25` (payload задан схемой, `make` типизирован) + `node_modules/dmg-core/src/kernel/fields/fields.test.ts:41` (`F.uuid` отклоняет не-uuid) |
| `questionnaire/questionnaire.events.test.ts` | 88 | прежнее поле owner вместо ownerInfo не принимается | Б-8 | удалить | `node_modules/dmg-core/src/domain/events/event-def.test.ts:25` (обязательность `ownerInfo` — схема payload; отдельного правила «прежняя форма» у события нет) |
| `questionnaire/questionnaire.events.test.ts` | 97 | completed standard: ref; likertScores отбрасываются | Б-8 | удалить | `modules/questionnaire/src/questionnaire/uc/handle-action.uc.test.ts:47` (после слияния `:57` — реальное событие `completed`) + `domain/src/questionnaire/questionnaire/questionnaire.ar.answers.test.ts:126` (состав события без `answers`) |
| `questionnaire/questionnaire.events.test.ts` | 101 | completed likert: ref + likertScores | Б-8 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.ar.likert.test.ts:50` (реальные баллы и `ownerInfo` в событии) |
| `questionnaire/questionnaire.events.test.ts` | 106 | likert без likertScores — недопустим | Б-8 | удалить | `node_modules/dmg-core/src/domain/events/event-def.test.ts:25` (у ветки likert `likertScores` обязателен по типу payload) |
| `questionnaire/questionnaire.events.test.ts` | 128 | `it.each` — reason timeout/by_user/declined допустим | Б-8 | удалить | `modules/questionnaire/src/questionnaire/uc/abandon.uc.test.ts:41` (реальная публикация `reason: by_user`) + `domain/src/questionnaire/questionnaire/questionnaire.ar.test.ts:270` (`declined`), `domain/src/questionnaire/questionnaire/questionnaire.ar.idle.test.ts:69` (`timeout`) |
| `questionnaire/questionnaire.events.test.ts` | 135 | reason обязателен и из перечня | Б-8 | удалить | `node_modules/dmg-core/src/domain/events/event-def.test.ts:25` (обязательность и `F.picklist` — схема payload) + `modules/questionnaire/src/questionnaire/uc/abandon.uc.test.ts:41` |
| `questionnaire/questionnaire.policy.test.ts` | 23 | правила: hasRespondent, isRespondent, isAdmin, canAccess, canListFor | Б-7 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.policy.test.ts:89` + `:114` (все правила проверены поведением); удаление правила ломает ссылки в Def UC (`arch:check`, MAN-11) |
| `questionnaire/questionnaire.policy.test.ts` | 37 | hasRespondent: есть человек-респондент — allowed | Б-2 | удалить | `modules/questionnaire/src/questionnaire/uc/start-questionnaire.uc.test.ts:37` (реальный запуск за человека) + `modules/questionnaire/src/questionnaire/uc/send-likert-invite.uc.test.ts:37` |
| `questionnaire/questionnaire.state.test.ts` | 81 | abandonReason (timeout, by_user) и ownerInfo сохраняются | Б-8 | удалить | `modules/questionnaire/src/infra/questionnaire.json-repo.test.ts:103` (`ownerInfo` в round-trip) + `domain/src/questionnaire/questionnaire/questionnaire.ar.test.ts:260` (`by_user` в state), `domain/src/questionnaire/questionnaire/questionnaire.ar.idle.test.ts:69` (`timeout`) |
| `questionnaire/questionnaire.state.test.ts` | 94 | числовые даты и version сохраняются как есть | Б-8 | слить в `questionnaire/questionnaire.state.test.ts:113` | — (валидная строка таблицы схемы `state`) |
| `questionnaire/questionnaire.state.test.ts` | 108 | неизвестный kind и статус отклоняются | Б-8 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:215` (отказ объявлен для каждого статуса вне `from`; список статусов — Def) + `domain/src/questionnaire/questionnaire/questionnaire.state.test.ts:113` (ветка `kind` — своя логика) |
| `questionnaire/questionnaire.state.test.ts` | 122 | пул без вопросов, битая дата и не-uuid респондента отклоняются | Б-8 | удалить | `domain/src/questionnaire/questionnaire/question.test.ts:7` (после переписывания: строка «пустой `questions`») + `node_modules/dmg-core/src/kernel/fields/fields.test.ts:31` (мусор в timestamp), `:41` (не-uuid) |
| `questionnaire/questionnaire.state.test.ts` | 113 | пул не своей ветки отклоняется: likert-вопросы у standard и наоборот | Б-8 | переписать | — (становится единственной таблицей схемы `state`: валидная строка — из строки 94 этого файла, невалидные — оба несовпадения ветки) |
| `questionnaire/question.test.ts` | 7 | валидный пул с минимальными полями | Б-8 | переписать | — (становится таблицей «валидно/невалидно» `QuestionnairePoolSchema`; строки 22, 41, 46, 51 этого же файла переезжают внутрь) |
| `questionnaire/question.test.ts` | 22 | валидный пул со всеми полями | Б-8 | слить в `questionnaire/question.test.ts:7` | — (валидная строка «все необязательные тексты заполнены») |
| `questionnaire/question.test.ts` | 41 | questions — обязательное поле | Б-8 | слить в `questionnaire/question.test.ts:7` | — (строка «невалидно: нет `questions`») |
| `questionnaire/question.test.ts` | 46 | пустой массив questions — ошибка | Б-8 | слить в `questionnaire/question.test.ts:7` | — (строка «невалидно: `questions: []`» — своя логика `minLength`) |
| `questionnaire/question.test.ts` | 51 | невалидный вопрос в пуле — ошибка | Б-8 | слить в `questionnaire/question.test.ts:7` | — (строка «невалидно: пустые поля вопроса») |
| `questionnaire.module.test.ts` | 45 | модуль не внешний | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:624` (у внешнего модуля нет ER и Job) |
| `questionnaire.module.test.ts` | 60 | ArchChecker по модулю и зависимостям — без нарушений | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (то же выполняет `arch:check` в `bun run check`) |
| `questionnaire.module.test.ts` | 64 | контракт экспортирует 9 Def UC, Job, события, ошибки и пулы | Б-7 | удалить | `platform/app/tests/u7-app.test.ts:422` (UC и события берутся из контракта реально) |
| `questionnaire.module.test.ts` | 88 | completed — FQN и payload: ownerInfo модуль анкет не толкует | Б-7 | удалить | `modules/questionnaire/src/questionnaire/uc/handle-action.uc.test.ts:47` (реальное событие `completed`) + `node_modules/dmg-core/src/arch/def-checker.test.ts:325` (MAN-08) |
| `questionnaire.module.test.ts` | 96 | abandoned — FQN, reason обязателен и из перечня | Б-7 | удалить | `modules/questionnaire/src/questionnaire/uc/abandon.uc.test.ts:41` (реальное событие с `reason`) + `node_modules/dmg-core/src/arch/def-checker.test.ts:325` |
| `questionnaire.module.test.ts` | 111 | UC вызывается другим модулем по calls (D-42) — без нарушений | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:348` (ARC-04: `calls` UC и Job ⊆ `dependsOn`) |
| `questionnaire/job/sweep-abandoned-questionnaires.job.test.ts` | 21 | имя, метка, расписание — интервал раз в 3 часа | Б-11 | переписать | — (оставить `name` и `schedule`; проверку `label` снять — TST-09, точный текст — данные Def) |
| `questionnaire/job/sweep-abandoned-questionnaires.job.test.ts` | 34 | константы ступеней 3/6/9 ч и мс (API-06) | Б-11 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.ar.idle.test.ts:25` (3 ч), `:44` (6 ч), `:69` (9 ч) — константы Job это реэкспорт из `questionnaire.ar.ts` |
| `questionnaire/job/sweep-abandoned-questionnaires.job.test.ts` | 44 | сканирует questionnaire, публикует continueInvite, abandonWarning, abandoned | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06) + `modules/questionnaire/src/questionnaire/job/sweep-abandoned-questionnaires.job.test.ts:136` (реальная публикация `abandoned`) |
| `questionnaire/job/sweep-abandoned-questionnaires.job.test.ts` | 59 | входит в паспорт модуля | Б-6 | удалить | `domain/src/questionnaire/questionnaire.module.test.ts:49` (`jobs` в тесте состава) |
| `questionnaire/uc/questionnaire.uc-defs.test.ts` | 35 | StartQuestionnaire: command, system, hasRespondent, событие started | Б-7 | удалить | `modules/questionnaire/src/questionnaire/uc/start-questionnaire.uc.test.ts:37` (реальный запуск; после слияния `:53` — и событие `started`) |
| `questionnaire/uc/questionnaire.uc-defs.test.ts` | 50 | вход — пул и ownerInfo; owner не принимается | Б-8 | перенести в `modules/questionnaire/src/questionnaire/uc/start-questionnaire.uc.test.ts` | приём входа — `modules/questionnaire/src/questionnaire/uc/start-questionnaire.uc.test.ts:37`; переносятся отказы `owner` и пустого пула (см. «Перенести») |
| `questionnaire/uc/questionnaire.uc-defs.test.ts` | 64 | выход пустой | Б-8 | удалить | `modules/questionnaire/src/questionnaire/uc/start-questionnaire.uc.test.ts:37` (`expectOk(...)` → `{}`) |
| `questionnaire/uc/questionnaire.uc-defs.test.ts` | 70 | SendLikertInvite: command, system, hasRespondent, событие invited | Б-7 | удалить | `modules/questionnaire/src/questionnaire/uc/send-likert-invite.uc.test.ts:37` (реальный вызов; после слияния `:48` — событие `invited`) |
| `questionnaire/uc/questionnaire.uc-defs.test.ts` | 82 | вход — likert-пул и ownerInfo | Б-8 | удалить | `modules/questionnaire/src/questionnaire/uc/send-likert-invite.uc.test.ts:37` (реальный вызов с likert-пулом) |
| `questionnaire/uc/questionnaire.uc-defs.test.ts` | 96 | StartByInvite: canAccess, NOT_FOUND и NOT_INVITED, без emits | Б-7 | удалить | `modules/questionnaire/src/questionnaire/uc/start-by-invite.uc.test.ts:89` (свой `load` → `NOT_FOUND`) + `domain/src/questionnaire/questionnaire/questionnaire.ar.test.ts:238` (`NOT_INVITED` — правило перехода Ar) |
| `questionnaire/uc/questionnaire.uc-defs.test.ts` | 113 | вход `{ questionnaireId }`, выход — экран | Б-8 | удалить | `modules/questionnaire/src/questionnaire/uc/start-by-invite.uc.test.ts:40` (реальный вход и ответ-экран) |
| `questionnaire/uc/questionnaire.uc-defs.test.ts` | 126 | DeclineInvite: canAccess, событие abandoned | Б-7 | удалить | `modules/questionnaire/src/questionnaire/uc/decline-invite.uc.test.ts:40` (после слияния `:48` — публикация `abandoned`) + `domain/src/questionnaire/questionnaire/questionnaire.ar.test.ts:270` (`reason: declined`) |
| `questionnaire/uc/questionnaire.uc-defs.test.ts` | 146 | HandleAction: canAccess, четыре ошибки, событие completed | Б-7 | удалить | `modules/questionnaire/src/questionnaire/uc/handle-action.uc.test.ts:47` (успех; после слияния `:57` — `completed`) + `:160` (`NOT_FOUND`) + `domain/src/questionnaire/questionnaire/questionnaire.ar.answers.test.ts:75`, `:87`, `:144` (три отказа Ar) |
| `questionnaire/uc/questionnaire.uc-defs.test.ts` | 165 | вход `{ questionnaireId, type: callback \| text, value }` | Б-8 | перенести в `modules/questionnaire/src/questionnaire/uc/handle-action.uc.test.ts` | приём валидных веток — `modules/questionnaire/src/questionnaire/uc/handle-action.uc.test.ts:47`; переносится только отказ `type: 'photo'` (см. «Перенести») |
| `questionnaire/uc/questionnaire.uc-defs.test.ts` | 177 | Abandon: canAccess, NOT_FOUND и NOT_ACTIVE, событие abandoned | Б-7 | удалить | `modules/questionnaire/src/questionnaire/uc/abandon.uc.test.ts:41` (успех) + `:87` (`NOT_FOUND`) + `domain/src/questionnaire/questionnaire/questionnaire.ar.test.ts:343` (`NOT_ACTIVE`) |
| `questionnaire/uc/questionnaire.uc-defs.test.ts` | 197 | GetQuestionnaire: query, вход, выход — вид анкеты | Б-7 | удалить | `modules/questionnaire/src/questionnaire/uc/get-questionnaire.uc.test.ts:40` (реальный вид, даты числами) + `:62` (`NOT_FOUND`) |
| `questionnaire/uc/questionnaire.uc-defs.test.ts` | 214 | GetCurrent: query, NOT_FOUND, выход — экран | Б-7 | удалить | `modules/questionnaire/src/questionnaire/uc/get-current.uc.test.ts:48` (реальный экран) + `:101` (`NOT_FOUND`) |
| `questionnaire/uc/questionnaire.uc-defs.test.ts` | 235 | GetQuestionnairesByUser: canListFor, `{ userId }`, массив видов | Б-7 | удалить | `modules/questionnaire/src/questionnaire/uc/get-questionnaires-by-user.uc.test.ts:51` (реальный список респондента) |

Итого строк таблицы — **76**: 73 кандидата инвентаризации + 3 строки, добавленные при
пересмотре (`questionnaire/question.test.ts:7`, `questionnaire/questionnaire.state.test.ts:113`,
`questionnaire/job/sweep-abandoned-questionnaires.job.test.ts:21` — приёмники/переписывание
полезных тестов).

## Переписать

1. `questionnaire/questionnaire.state.test.ts:113` — единственная таблица схемы
   `QuestionnaireArDef.state`: валидна числовая запись (строка из `:94`: `createdAt`,
   `updatedAt`, `version` — числа как есть); невалидны likert-пул у `standard` и
   standard-пул у `likert` (текущие два кейса). Приём прежней формы записи (legacy ISO)
   в этой таблице не дублируется: он остаётся у схемы в `:42` и `:60` (трансформация —
   своя логика) и проверяется реальным чтением файла
   (`modules/questionnaire/src/infra/questionnaire.json-repo.test.ts:159`).
2. `questionnaire/question.test.ts:7` — таблица «валидно/невалидно»
   `QuestionnairePoolSchema`: валидны минимальный пул (`:7`) и пул со всеми
   необязательными текстами (`:22`); невалидны нет `questions` (`:41`), `questions: []`
   (`:46`, своя логика `minLength`), вопрос с пустыми полями (`:51`).
3. `questionnaire/job/sweep-abandoned-questionnaires.job.test.ts:21` — оставить `name` и
   `schedule` (единственное место, где закреплено «интервал = ступень приглашения 3 ч»);
   проверку точного текста `label` снять (TST-09, данные Def).

## Слить

1. `questionnaire/questionnaire-engine.test.ts:433` → `:421` — `:421` становится
   `it.each(['base', 'intensive'])`: `total` 10/9 и позиция по маршруту.
2. `questionnaire/questionnaire.state.test.ts:94` → `:113` — валидная строка «числовая
   запись сохраняется как есть».
3. `questionnaire/question.test.ts:22` → `:7` — валидная строка «все необязательные тексты».
4. `questionnaire/question.test.ts:41` → `:7` — невалидная строка «нет `questions`».
5. `questionnaire/question.test.ts:46` → `:7` — невалидная строка «`questions: []`».
6. `questionnaire/question.test.ts:51` → `:7` — невалидная строка «битый вопрос в пуле».

## Перенести

1. `questionnaire/uc/questionnaire.uc-defs.test.ts:50` →
   `modules/questionnaire/src/questionnaire/uc/start-questionnaire.uc.test.ts`: кейс отказов
   входа реальным вызовом `StartQuestionnaireUc.handle`, как остальные отказы файла:
   - поле `owner` вместо `ownerInfo` → `INPUT_VALIDATION`, анкета не создана;
   - пустой пул (`questions: []`) → `INPUT_VALIDATION`, анкета не создана (на эту же
     проверку ссылается строка `start-questionnaire.uc.test.ts:76` таблицы
     `questionnaire-app-delete.md`).
2. `questionnaire/uc/questionnaire.uc-defs.test.ts:165` →
   `modules/questionnaire/src/questionnaire/uc/handle-action.uc.test.ts`: кейс «`type: 'photo'`
   → `INPUT_VALIDATION`, ответ не записан» — реальным вызовом `HandleActionUc.handle`.

После переноса `questionnaire/uc/questionnaire.uc-defs.test.ts` (14 объявлений) удаляется
целиком; `questionnaire/questionnaire.errors.test.ts` (3 объявления) — тоже, все его тесты
удаляются.

## Остающиеся проверки `label`

TST-09: тексты `label`/`denyMessage` ошибок не тестируются. Ниже — все одиночные `expect`
на текст в полезных тестах домена `questionnaire`, которые таблица **не** удаляет: смысл
теста (код ошибки, форма ответа, ветка права) сохраняется, строку с текстом нужно снять в
том же срезе.

- `domain/src/questionnaire/questionnaire/questionnaire.ar.test.ts:350` — `error.label` «Анкета не активна».
- `domain/src/questionnaire/questionnaire/questionnaire.ar.answers.test.ts:83` — `error.label` CHOICE_EXPECTED.
- `domain/src/questionnaire/questionnaire/questionnaire.ar.answers.test.ts:94` — `error.label` EMPTY_ANSWER_CODE.
- `domain/src/questionnaire/questionnaire/questionnaire.ar.answers.test.ts:157` — `error.label` «Анкета уже завершена».
- `domain/src/questionnaire/questionnaire/questionnaire.policy.test.ts:109` — `denyMessage` «Нет доступа к анкете» (таблица `:101`).
- `domain/src/questionnaire/questionnaire/questionnaire.policy.test.ts:135` — `denyMessage` «Нет доступа к списку анкет пользователя» (таблица `:128`).
- `domain/src/questionnaire/questionnaire/job/sweep-abandoned-questionnaires.job.test.ts:25` — `JobDef.label` (снимается строкой «Переписать» `:21`).

После удаления `questionnaire.errors.test.ts` (единственный `label`-цикл `:39`) проверок
текстов ошибок в домене анкет не остаётся.

## Итог

| действие | строк | исполнений |
|---|---:|---:|
| удалить | 65 | 91 |
| слить | 6 | 6 |
| переписать | 3 | 3 (становятся таблицами) |
| перенести | 2 | 2 (уходят в `modules/questionnaire`) |
| отложить до course-dmg (TR-57) | 0 | 0 |
| отложить: удалить с кодом (Б-13) | 0 | 0 |

- **Всего строк таблицы: 76** — 73 кандидата инвентаризации (из 85) + 3 приёмника.
- **Ожидаемое число тестов: 213 → 126** в 12 файлах (два файла удаляются целиком:
  `questionnaire/questionnaire.errors.test.ts` 8 → 0, `questionnaire/uc/questionnaire.uc-defs.test.ts`
  14 → 0). Расчёт: 213 − 91 (удалённые исполнения) − 2 (перенесённые в модуль) = 120;
  слияния расширяют приёмники: `state.test.ts:113` 1 → 3 (+2), `question.test.ts:7` 1 → 5
  (+4), `questionnaire-engine.test.ts:421` 1 → 2 (+1, кейс переехал из `:433`) → **126**.
  По файлам: `ar` 40 → 27, `answers` 26 → 24, `idle` 23 → 21, `likert` 6 → 3,
  `questionnaire-engine` 23 → 17, `events` 28 → 2, `policy` 20 → 18, `state` 8 → 6,
  `question` 5 → 5, `module` 7 → 1, `job` 4 → 1, `screen` 1 → 1.
  Базовая линия `modules/questionnaire` вырастет на 2 перенесённых кейса.
- **Кандидатов инвентаризации не вошло в таблицу: 12 из 85.**
  1. `questionnaire.policy.test.ts:43`, `:67`, `:73`, `:79`, `:83` (5 строк) — решение
     трека «каждое правило — allowed и denied» + «"без субъекта — denied" как в образце»:
     в `stream-domain-delete.md` и `wish-delete.md` такие строки не удаляются. `isAdmin` —
     отдельное правило (`check` читает роли, `questionnaire.policy.ts:31`), а не копия
     `canAccess`, поэтому пара сохраняется.
  2. `questionnaire/questionnaire.ar.test.ts:219`, `:225` и
     `questionnaire/questionnaire.ar.idle.test.ts:38`, `:56`, `:63`,
     `questionnaire/questionnaire.state.test.ts:42`, `:60` (7 строк) — на них ссылается как
     на покрытие таблица `questionnaire-app-delete.md` (модульные дубликаты
     `start-by-invite.uc.test.ts:64`, `:69`, `job.test.ts:107`, `:124`, `:130`,
     `json-repo.test.ts:173`, `:189`). Правило Б-1 проверяется у владельца (Ar/схема), а
     удаляются дубликаты уровня модуля — иначе обе таблицы удалили бы одну проверку
     дважды. Приём legacy ISO — своя трансформация схемы (`state.test.ts:42`, `:60`), а не
     поле платформы, поэтому Б-8 на них не распространяется.
- **Сверка с параллельной таблицей `questionnaire-app-delete.md`** (ссылки инвентаризации
  вели на тесты, которые та таблица удаляет; заменены на полезные по §4):
  `ar.idle.test.ts:204` (было `job.test.ts:74`), `events.test.ts:74` (было
  `job.test.ts:95`), `events.test.ts:97` (было `handle-action.uc.test.ts:57` — теперь
  приёмник слияния `:47`), `errors.test.ts:44` (было `start-by-invite.uc.test.ts:89` —
  payload проверяет `get-questionnaire.uc.test.ts:62`), `uc-defs.test.ts:96` (было
  `start-by-invite.uc.test.ts:79`), `module.test.ts:88` (было `handle-action.uc.test.ts:57`).
  Две обратные стрелки — не дыры, а переезд внутри среза: строки
  `start-questionnaire.uc.test.ts:76` той таблицы ссылаются на `question.test.ts:46`
  (проверка пустого пула остаётся строкой таблицы `question.test.ts:7`) и на
  `uc-defs.test.ts:50` (кейс переезжает в модульный тест — см. «Перенести»).
  `errors.test.ts:9` удаляется; на него та таблица ссылается лишь как на источник `kind`
  ошибки (ERR-04 держит `def-checker.test.ts:426`), основное покрытие — тесты Ar.
