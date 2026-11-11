# Инвентаризация тестов домена `peer-review`

Трек `tst-cleanup_20261105`, фаза Ф2. Только чтение кода + прогоны `bun test`. Ничего не удалено
и не изменено, кроме этого файла.

**Как считал.** «Объявлений» — строки `it(`/`test(`/`it.each(` (`it.each` — одно объявление,
`bun test` разворачивает его в несколько кейсов); «выполнено» — кейсы, которые печатает
`bun test` по файлу. Оценка — по объявлению.

**Базовая линия (worktree `tst-cleanup`, ветка `tst-cleanup`).**

| Команда | Итог |
|---|---|
| `cd domain && bun test src/peer-review` | **184 pass, 0 fail, 513 expect()**, 26 файлов |
| `bun test <файл>` по каждому из 26 файлов | 184 pass суммарно (раскладка — в §1) |

Критерий тот же, что в `wish.md`/`stream-domain.md`: **«какая реальная ошибка в коде модуля
уронит этот тест и только этот?»**. Сомнение трактовалось в пользу теста («полезен»).
Пути в таблицах — относительно `domain/src/` (кроме ссылок «где покрыто», они от корня репо).

**Что важно про этот срез.** Домен `peer-review` — чистые Def: реализаций UC здесь нет
(они в `modules/peer-review/src/**`), DQS/Policy/Rules/схемы — есть. Поэтому доменные
UC-тесты проверяют **только паспорт и схемы Def**, а поведение тех же UC уже проверено
тестами `modules/peer-review`. Это главный источник кандидатов (Б-7, Б-8), как в `stream`
и `questionnaire`.

---

## 1. Сводка

| Файл | Объявлений | Выполнено | Полезен | Сомнителен / пуст |
|---|---|---|---|---|
| `peer-review/peer-review.module.test.ts` | 3 | 3 | 1 | 2 |
| `peer-review/peer-review-question-pool.test.ts` | 4 | 4 | 0 | 4 |
| `peer-review/review-campaign/campaign-facts.dqs.test.ts` | 4 | 4 | 4 | 0 |
| `peer-review/review-campaign/er/create-student-campaign.er.test.ts` | 2 | 2 | 0 | 2 |
| `peer-review/review-campaign/review-campaign.ar.test.ts` | 24 | 29 | 12 | 12 |
| `peer-review/review-campaign/review-campaign.errors.test.ts` | 4 | 4 | 0 | 4 |
| `peer-review/review-campaign/review-campaign.events.test.ts` | 3 | 3 | 0 | 3 |
| `peer-review/review-campaign/review-campaign.policy.test.ts` | 5 | 5 | 5 | 0 |
| `peer-review/review-campaign/review-campaign.rules.test.ts` | 4 | 4 | 3 | 1 |
| `peer-review/review-campaign/review-campaign.state.test.ts` | 13 | 19 | 4 | 9 |
| `peer-review/review-campaign/student-fate.dqs.test.ts` | 6 | 6 | 4 | 2 |
| `peer-review/review-campaign/uc/get-campaign-recipients.uc.test.ts` | 3 | 3 | 0 | 3 |
| `peer-review/review-campaign/uc/get-my-campaigns.uc.test.ts` | 3 | 3 | 0 | 3 |
| `peer-review/review/review.ar.test.ts` | 13 | 13 | 4 | 9 |
| `peer-review/review/review-draft.dqs.test.ts` | 4 | 7 | 3 | 1 |
| `peer-review/review/review.errors.test.ts` | 7 | 7 | 0 | 7 |
| `peer-review/review/review.events.test.ts` | 5 | 5 | 0 | 5 |
| `peer-review/review/review.policy.test.ts` | 5 | 5 | 5 | 0 |
| `peer-review/review/review.rules.test.ts` | 11 | 18 | 6 | 5 |
| `peer-review/review/review.state.test.ts` | 17 | 17 | 8 | 9 |
| `peer-review/review/scope-reviews.dqs.test.ts` | 4 | 4 | 3 | 1 |
| `peer-review/review/uc/create-review.uc.test.ts` | 5 | 5 | 0 | 5 |
| `peer-review/review/uc/get-my-review.uc.test.ts` | 3 | 3 | 0 | 3 |
| `peer-review/review/uc/list-my-reviews.uc.test.ts` | 4 | 4 | 0 | 4 |
| `peer-review/review/uc/list-scope-facts.uc.test.ts` | 3 | 3 | 0 | 3 |
| `peer-review/review/uc/list-scope-reviews.uc.test.ts` | 4 | 4 | 0 | 4 |
| **Итого** | **163** | **184** | **62** | **101 (62 %)** |

**Расклад кандидатов по закономерностям:** Б-8 — 35, Б-11 — 22, Б-7 — 19, Б-6 — 8, Б-9 — 7,
Б-1 — 5, Б-2 — 1, Б-12 — 1, Б-13 — 1, Н1 — 2 (сумма — 101).

---

## 2. Закономерности

Номера Б — `conductor/roadmap/test-bloat.md` §2 (сводка `wish`/`stream`/`questionnaire`).
Ниже — только встреченные в области, с числом случаев и примерами. Новых — один (Н1).

### Б-1. Правило проверено уровнем ниже и повторено выше — 5 случаев

**Признак поиска.** `grep -rn "isExpired\|-- исключение\|события не создаёт" --include=*.test.ts domain/src/peer-review`

**Примеры.** `peer-review/review-campaign/review-campaign.ar.test.ts:105` (окно живо и `daysLeft = 7`
после `create` — прямое следствие `:73` и `:180`), `review/review.ar.test.ts:119` (текст вне
10–3500 → исключение при `restore` — то же, что схема на `review.state.test.ts:163`),
`review/review.ar.test.ts:148` (перезапись не создаёт событие — то же на реальном UC:
`modules/peer-review/src/review/uc/create-review.uc.test.ts:168`).

**Что делать.** Удалить; владелец правила — тот уровень, где оно посчитано (схема, Ar-метод,
реализация UC в модуле).

### Б-2. Вопрос Ar проверен своим `it` и через единственного потребителя — 1 случай

**Пример.** `review-campaign/review-campaign.ar.test.ts:199` — `isSubject`/`isMentor` проверяются
отдельно, хотя оба читает только `authorRoleOf` (`review-campaign.ar.ts:215`), а его тест
(`:216`) — тот же набор входов. Плюс `hasParticipant` (`review-campaign.ar.ts:192`) не вызывается
нигде вне этого теста (мёртвый метод, Б-13 по коду).

### Б-6. Копия соседнего теста без нового класса входа — 8 случаев

**Признак поиска.** `grep -rn "it.each(\|targetIdsFor\|subjectOutcome" --include=*.test.ts domain/src/peer-review`

**Примеры.** `review-campaign/review-campaign.ar.test.ts:81` (`it.each` по четырём исходам —
`create` их только копирует, ветки нет: достаточно `:60`), `:232` (`targetIdsFor` с пустым
`participants` — тот же код, что `:224`), `review-campaign/review-campaign.state.test.ts:138`
(второй `describe` «ISO без зоны» дословно повторяет `:33` в том же файле).

### Б-7. Ручной паспорт Def — дубль `arch:check` — 19 случаев

**Признак поиска.** `grep -rn "normalize(\|ArchChecker\|Object.values(.*State.entries" --include=*.test.ts domain/src/peer-review`

**Чем покрыто.** `bun run arch:check` (`package.json:31`): MAN-02 — `node_modules/dmg-core/src/arch/def-checker.test.ts:192`,
MAN-06 — `:230`, MAN-08 — `:324`, ERR-02 — `:654`, ERR-04 — `:426`.

**Примеры.** `peer-review/peer-review.module.test.ts:31` (`ArchChecker.defsOf` в тесте модуля),
`peer-review/review/uc/create-review.uc.test.ts:11` (паспорт UC: тип, `callers`, `errors`, `emits`),
`peer-review/review-campaign/review-campaign.state.test.ts:125` (MAN-02 «у каждого поля есть
описание»).

**Что делать.** Удалить; на модуль остаётся **один** тест состава — `peer-review.module.test.ts:8`
(список UC, `dependsOn`, агрегаты, `reactions` — этого `arch:check` не видит, TST §3).

### Б-8. Схема платформы, а не модуля — 35 случаев

**Признак поиска.** `grep -rn "safeParse\|v\.parse(" --include=*.test.ts domain/src/peer-review`

**Чем покрыто.** `node_modules/dmg-core/src/kernel/fields/fields.test.ts:41` (`F.uuid`),
`:31` (`F.timestamp` отклоняет мусор), `:19` (legacy ISO без зоны);
`node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` (`INPUT_VALIDATION`),
`:264` (`OUTPUT_VALIDATION`); плюс реальные вызовы UC в `modules/peer-review` (выход проверяется
рантаймом).

**Примеры.** `peer-review/review-campaign/review-campaign.state.test.ts:112`
(`uuid/scopeId/subjectId обязательны и UUID`), `peer-review/review/uc/list-scope-reviews.uc.test.ts:59`
(схема выхода), `peer-review/review/review.errors.test.ts:44` (payload ошибки — схема).

### Б-9. Поведение платформы — 7 случаев

**Чем покрыто.** `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:251` (`restore` без
событий), `:257` (невалидный снимок — исключение), `:264` (`snapshot` — копия), `:272` (`view` по
умолчанию — копия), `:346` (`newState`: создан и изменён в `at`).

**Примеры.** `peer-review/review-campaign/review-campaign.ar.test.ts:144` («события не накоплены»),
`:209` (`view()` — состояние наружу), `review/review.ar.test.ts:85` (createdAt/updatedAt = `at`).

### Б-11. Тавтология: константа ↔ та же константа, ожидание тем же кодом — 22 случая

**Признак поиска.** `grep -rn "\.toBe('\(peer-review\|REVIEW\)\|Object.keys\|\.dmg)" --include=*.test.ts domain/src/peer-review`

**Примеры.** `peer-review/review-campaign/review-campaign.ar.test.ts:190` (пять однострочных
геттеров; те же значения уже в `:60`), `peer-review/review/review.events.test.ts:59`
(`make` собирает событие с тем же payload, что подали), `peer-review/review/review.state.test.ts:158`
(`REVIEW_TEXT_MIN_LENGTH).toBe(10)` — те же числа закреплены литералами в `review.rules.test.ts:112`).

Сюда же отнесены перечни строковых ключей реэкспорта (`peer-review.module.test.ts:35`) и
«описание ссылается на `X_*`» в `*.rules.test.ts` (связка типовая + ERR-02).

### Б-12. Пустой вход → пустой результат — 1 случай

**Пример.** `peer-review/review/scope-reviews.dqs.test.ts:83` («пустой скоуп — пустой список
групп»): `for` по пустому массиву даёт пустую `Map`; то же на реальном UC —
`modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:48`.

### Б-13. Тест мёртвого экспорта — 1 случай

**Пример.** `peer-review/peer-review-question-pool.test.ts:16` (уникальность `questionCode`).
`PEER_REVIEW_POOLS` и три пула не импортируются нигде, кроме своего теста
(`grep -rn "PEER_REVIEW_POOLS\|MODULE_COMPLETED_POOL" --include=*.ts .` — только
`peer-review-question-pool.ts`/`.test.ts` и реэкспорт `domain/src/peer-review/index.ts:3`).
Сигнал — удалять код, а не только тест (см. «Открытые вопросы», п. 2).

### Н1. Тест-некролог переезда: проверка отсутствия удалённых имён — 2 случая (новая)

**Что это.** Тест перечисляет имена/коды, которых в Def уже нет, и проверяет, что их нет
(«переехали в другой агрегат», «не объявлены»). Проверяется **история переезда**, а не поведение:
после переезда этих имён в коде нет, и упасть тест может только если кто-то вернёт их обратно.

**Признак поиска.** `grep -rn "не объявлены\|переехали\|не содержат" --include=*.test.ts domain/src/peer-review`

**Примеры.** `peer-review/review-campaign/review-campaign.errors.test.ts:20`
(`WINDOW_CLOSED`, `NOT_PARTICIPANT`, `RECIPIENT_NOT_ALLOWED` переехали в `Review`),
`peer-review/review/review.errors.test.ts:19` (`NOT_PARTICIPANT`, `DUPLICATE`,
`CAMPAIGN_NOT_FOUND` не объявлены).

**Почему бесполезен.** Ветки кода нет — только перечисление строк. Возврат имени не даёт ошибки
поведения: `ERR-04` (`def-checker.test.ts:426`) ловит только дубль кода и префикс, а «вернули
старое имя» — это не ошибка, а осознанная правка, которую тест запрещает комментарием.
Если нужно удержать историю — её место в `CHANGELOG`/`spec`, а не в тесте.

**Что делать.** Удалить оба; при желании закрепить «в группе ровно N ошибок с такими кодами»
оставить одну таблицу (`review-campaign.errors.test.ts:10` — но она сама Б-7).

---

## 3. Кандидаты

Ссылки «где покрыто» ведут на конкретный `it`/`test`, который сам в этой таблице не удаляется
(кроме платформенных `it` в `node_modules` и модульных тестов `modules/peer-review` — см.
«Открытые вопросы», п. 1). «нигде» — только для Б-9/Б-11/Б-12/Б-13/Н1, с причиной.

### `peer-review/peer-review.module.test.ts`

| путь:строка | тест | Б | что делать | где покрыто |
|---|---|---|---|---|
| `domain/src/peer-review/peer-review.module.test.ts:31` | ArchChecker (checkDefs) — без нарушений | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06), `:324` (MAN-08), `:426` (ERR-04) — это `bun run arch:check` |
| `domain/src/peer-review/peer-review.module.test.ts:35` | контракт отдаёт события, ошибки и 5 Def рецензий | Б-11 | удалить | «нигде»: перечень строковых ключей реэкспорта; если имя кто-то использует, `tsc` падает у потребителя без теста, если нет — тест защищает пустоту |

### `peer-review/peer-review-question-pool.test.ts`

| путь:строка | тест | Б | что делать | где покрыто |
|---|---|---|---|---|
| `domain/src/peer-review/peer-review-question-pool.test.ts:10` | пулы соответствуют источникам по количеству вопросов | Б-11 | удалить | «нигде»: количество — данные; кода, читающего пул, нет (`PEER_REVIEW_POOLS` никем не импортируется) |
| `domain/src/peer-review/peer-review-question-pool.test.ts:16` | questionCode уникальны внутри каждого пула и между пулами | Б-13 | удалить (с решением по коду — п. 2) | «нигде»: `questionCode` нигде не читается; сигнал удалить экспорт, а не только тест |
| `domain/src/peer-review/peer-review-question-pool.test.ts:27` | каждый вопрос содержит корректный вес | Б-11 | удалить | «нигде»: вес ограничен схемой `peer-review-question-pool.ts:14`, `definePool` парсит пул при загрузке (`peer-review-question-pool.ts:55`) — на рабочем коде тест упасть не может |
| `domain/src/peer-review/peer-review-question-pool.test.ts:35` | каждый контекст из PEER_REVIEW_POOLS имеет непустой пул | Б-11 | удалить | «нигде»: `Object.keys` против своего же литерала; непустота гарантирована `v.minLength(1)` (`peer-review-question-pool.ts:42`) при загрузке модуля |

### `peer-review/review-campaign/er/create-student-campaign.er.test.ts`

| путь:строка | тест | Б | что делать | где покрыто |
|---|---|---|---|---|
| `domain/src/peer-review/review-campaign/er/create-student-campaign.er.test.ts:12` | на student.completed и student.abandoned; трогает кампанию; зовёт состав; публикует created | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06 — `touches`/`calls`), `:324` (MAN-08 — FQN) |
| `domain/src/peer-review/review-campaign/er/create-student-campaign.er.test.ts:22` | on/touches/calls/emits — те же Def, что в контрактах | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230`; поведение реакции — `modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts:279` (подписка на оба события) |

### `peer-review/review-campaign/review-campaign.ar.test.ts`

| путь:строка | тест | Б | что делать | где покрыто |
|---|---|---|---|---|
| `domain/src/peer-review/review-campaign/review-campaign.ar.test.ts:51` | нет statuses/transitions; событие created; ошибки группы | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` |
| `…:81` | `it.each` — исход %s проходит в payload | Б-6 | слить в `:60` | `domain/src/peer-review/review-campaign/review-campaign.ar.test.ts:60` (тот же путь копирования; `create` не имеет ветки по исходу) |
| `…:105` | окно сразу согласовано: жива, daysLeft = 7 | Б-1 | удалить | `domain/src/peer-review/review-campaign/review-campaign.ar.test.ts:73` (expiresAt = at + 7 сут) + `:180` (daysLeft) |
| `…:144` | восстанавливает по snapshot; события не накоплены | Б-9 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:251` |
| `…:150` | updatedAt и version сохраняются при restore | Б-9 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:251` (restore копирует state как есть) |
| `…:156` | повреждённый контекст — исключение | Б-1 | удалить | `domain/src/peer-review/review-campaign/review-campaign.state.test.ts:87` (схема отклоняет `stream_ended`/`exit`) |
| `…:190` | геттеры каркаса и payload | Б-11 | удалить | `domain/src/peer-review/review-campaign/review-campaign.ar.test.ts:60` (те же значения через те же геттеры) + `:73` |
| `…:199` | isSubject / isMentor / hasParticipant | Б-2 | удалить | `domain/src/peer-review/review-campaign/review-campaign.ar.test.ts:216` (те же входы через `authorRoleOf`) |
| `…:209` | view() — состояние наружу без мутации агрегата | Б-9 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:272` |
| `…:232` | targetIdsFor субъекта при пустом participants — только ментор | Б-6 | слить в `:224` | `domain/src/peer-review/review-campaign/review-campaign.ar.test.ts:224` (тот же код; пустой список уже проверен `:93`) |
| `…:242` | никогда не о себе: автора нет в его списке адресатов | Б-6 | удалить | `domain/src/peer-review/review-campaign/review-campaign.ar.test.ts:224` + `:238` (полные списки адресатов) |
| `…:247` | соученик и посторонний не авторы окна — адресатов нет | Б-11 | удалить | `domain/src/peer-review/review-campaign/review-campaign.ar.test.ts:216` + `domain/src/peer-review/review-campaign/review-campaign.policy.test.ts:40` (не-автор отсекается Policy, ветка `return []` в проде недостижима) |

### `peer-review/review-campaign/review-campaign.errors.test.ts`

| путь:строка | тест | Б | что делать | где покрыто |
|---|---|---|---|---|
| `domain/src/peer-review/review-campaign/review-campaign.errors.test.ts:10` | ровно три ошибки: коды и kind | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:426` (ERR-04) |
| `…:20` | WINDOW_CLOSED, NOT_PARTICIPANT, RECIPIENT_NOT_ALLOWED переехали в Review | Н1 | удалить | «нигде»: перечисление отсутствующих имён; ошибки поведения нет |
| `…:31` | NOT_FOUND: текст legacy и payload { campaignId } | Б-8 | удалить | `modules/peer-review/src/review-campaign/uc/get-campaign-recipients.uc.test.ts:137` (реальный отказ UC с payload и текстом) |
| `…:46` | ALREADY_EXISTS: payload { scopeId, subjectId } | Б-8 | удалить | `domain/src/peer-review/review-campaign/review-campaign.rules.test.ts:40` (payload из реального правила) |

### `peer-review/review-campaign/review-campaign.events.test.ts`

| путь:строка | тест | Б | что делать | где покрыто |
|---|---|---|---|---|
| `domain/src/peer-review/review-campaign/review-campaign.events.test.ts:17` | FQN peer-review.review-campaign.created | Б-11 | удалить | `modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts:197` (публикация с этим именем на реальной реакции) |
| `…:23` | payload: campaignId, context, scopeId, subjectId, mentorId, subjectOutcome | Б-8 | удалить | `domain/src/peer-review/review-campaign/review-campaign.ar.test.ts:111` (событие, собранное `create`, со всеми полями) |
| `…:39` | make собирает событие с этим payload | Б-11 | удалить | `domain/src/peer-review/review-campaign/review-campaign.ar.test.ts:111` |

### `peer-review/review-campaign/review-campaign.rules.test.ts`

| путь:строка | тест | Б | что делать | где покрыто |
|---|---|---|---|---|
| `domain/src/peer-review/review-campaign/review-campaign.rules.test.ts:29` | описание ссылается на REVIEW_CAMPAIGN_ALREADY_EXISTS | Б-11 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` (ERR-02: ошибка правила против `errors` UC) + связка `error:` типовая |

### `peer-review/review-campaign/review-campaign.state.test.ts`

| путь:строка | тест | Б | что делать | где покрыто |
|---|---|---|---|---|
| `domain/src/peer-review/review-campaign/review-campaign.state.test.ts:51` | новый формат (числа, version) читается без изменений | Б-11 | удалить | `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:71` (round-trip нового формата через файл) |
| `…:69` | `it.each` — исход %s принимается | Б-8 | удалить | `domain/src/peer-review/review/review.state.test.ts:113` (та же общая `StudentOutcomeSchema`: приём 4 и отказ сырых статусов) |
| `…:79` | `it.each` — исход %s отклоняется | Б-8 | удалить | `domain/src/peer-review/review/review.state.test.ts:113` |
| `…:92` | mentorId обязателен и UUID | Б-8 | удалить | `node_modules/dmg-core/src/kernel/fields/fields.test.ts:41` (`F.uuid`) |
| `…:103` | participants — только uuid[] (списочная модель удалена) | Б-8 | удалить | `node_modules/dmg-core/src/kernel/fields/fields.test.ts:41` (`v.array(F.uuid)`) |
| `…:112` | uuid/scopeId/subjectId обязательны и UUID | Б-8 | удалить | `node_modules/dmg-core/src/kernel/fields/fields.test.ts:41` |
| `…:119` | payload обязателен; дата не ISO отклоняется | Б-8 | удалить | `node_modules/dmg-core/src/kernel/fields/fields.test.ts:31` (`F.timestamp` отклоняет мусор) |
| `…:125` | у каждого поля (и payload) есть описание (MAN-02) | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:192` |
| `…:138` | ISO без зоны читается как UTC (второй `describe`) | Б-6 | удалить | `domain/src/peer-review/review-campaign/review-campaign.state.test.ts:33` (тот же вход и те же ожидания в этом же файле) |

### `peer-review/review-campaign/student-fate.dqs.test.ts`

| путь:строка | тест | Б | что делать | где покрыто |
|---|---|---|---|---|
| `domain/src/peer-review/review-campaign/student-fate.dqs.test.ts:60` | ментор не попадает в участников | Б-6 | удалить | `domain/src/peer-review/review-campaign/student-fate.dqs.test.ts:51` (точный список `[LIVE, DONE]` — ментора в нём нет) |
| `…:70` | participants всегда пуст (адресат только ментор) | Б-11 | удалить | `modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts:173` (пустой `participants` у «забросил» на реальной реакции) |

### `peer-review/review-campaign/uc/*.test.ts`

| путь:строка | тест | Б | что делать | где покрыто |
|---|---|---|---|---|
| `domain/src/peer-review/review-campaign/uc/get-campaign-recipients.uc.test.ts:19` | query пользователя; Policy isWindowAuthor; ошибка CAMPAIGN_NOT_FOUND | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230`; поведение — `modules/peer-review/src/review-campaign/uc/get-campaign-recipients.uc.test.ts:47` |
| `…:32` | вход — { campaignId } uuid, без authorId | Б-8 | удалить | `modules/peer-review/src/review-campaign/uc/get-campaign-recipients.uc.test.ts:47` (реальный вызов: вход из субъекта, выход по схеме) |
| `…:42` | выход: роль, ментор, исход, daysLeft, адресаты с hasMyReview | Б-8 | удалить | `modules/peer-review/src/review-campaign/uc/get-campaign-recipients.uc.test.ts:102` (истёкшая кампания, `daysLeft = 0` в реальном выходе) |
| `domain/src/peer-review/review-campaign/uc/get-my-campaigns.uc.test.ts:20` | query пользователя над кампанией, allowAll, без ошибок и событий | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` |
| `…:32` | вход без userId: onlyLives?, filter? { context?, scopeId? } | Б-8 | удалить | `modules/peer-review/src/review-campaign/uc/get-my-campaigns.uc.test.ts:121` (реальные фильтры) |
| `…:52` | выход — список карточек; expiresAt — число | Б-8 | удалить | `modules/peer-review/src/review-campaign/uc/get-my-campaigns.uc.test.ts:49` (карточки реального UC) |

### `peer-review/review/review.ar.test.ts`

| путь:строка | тест | Б | что делать | где покрыто |
|---|---|---|---|---|
| `domain/src/peer-review/review/review.ar.test.ts:49` | имя review; нет statuses/transitions; событие created | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` |
| `…:85` | uuid — со входа; createdAt = updatedAt = at без минутного усечения | Б-9 | удалить | `domain/src/peer-review/review/review.ar.test.ts:58` (`snapshot()` равен `stored()`, где `createdAt = AT`) + `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:346` |
| `…:109` | восстанавливает по snapshot; события не накоплены | Б-9 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:251` |
| `…:115` | version сохраняется | Б-9 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:251` |
| `…:119` | текст вне 10–3500 — исключение | Б-1 | удалить | `domain/src/peer-review/review/review.state.test.ts:163` (схема отклоняет текст короче минимума) + `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:257` |
| `…:126` | повреждённое направление — исключение | Б-1 | удалить | `domain/src/peer-review/review/review.state.test.ts:40` (три направления, `mentor_mentor` отклоняется) |
| `…:132` | view() — состояние наружу | Б-9 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:272` |
| `…:148` | перезапись события не создаёт | Б-1 | удалить | `modules/peer-review/src/review/uc/create-review.uc.test.ts:168` (перезапись на реальном UC без события) |
| `…:155` | граница минимума по длине — Ok | Б-11 | удалить | `domain/src/peer-review/review/review.rules.test.ts:112` (границы 10/3500 в правиле) + `domain/src/peer-review/review/review.ar.test.ts:137` (текст просто присваивается, отказа быть не может) |

### `peer-review/review/review-draft.dqs.test.ts`

| путь:строка | тест | Б | что делать | где покрыто |
|---|---|---|---|---|
| `domain/src/peer-review/review/review-draft.dqs.test.ts:52` | `it.each` — исход субъекта %s переносится в снимок автора | Б-6 | слить в `:38` | `domain/src/peer-review/review/review-draft.dqs.test.ts:38` (тот же путь `authorOutcome: campaign.subjectOutcome`, ветки по исходу нет) |

### `peer-review/review/review.errors.test.ts`

| путь:строка | тест | Б | что делать | где покрыто |
|---|---|---|---|---|
| `domain/src/peer-review/review/review.errors.test.ts:11` | ровно три ошибки: коды и kind | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:426` (ERR-04) |
| `…:19` | NOT_PARTICIPANT, DUPLICATE и CAMPAIGN_NOT_FOUND не объявлены | Н1 | удалить | «нигде»: перечисление отсутствующих имён, проверяется история переезда |
| `…:26` | REVIEW_CAMPAIGN_NOT_FOUND — ссылкой из ошибок кампании | Б-11 | удалить | `modules/peer-review/src/review/uc/create-review.uc.test.ts:314` (реальный отказ `REVIEW_CAMPAIGN_NOT_FOUND` в UC) |
| `…:32` | тексты legacy сохранены | Б-11 | удалить | «нигде»: TST-09 — тексты `label` не тестируются, их видят тесты UI |
| `…:44` | WINDOW_CLOSED: payload { campaignId, expiresAt } — число | Б-8 | удалить | `domain/src/peer-review/review/review.rules.test.ts:42` (payload из реального отказа правила) |
| `…:59` | RECIPIENT_NOT_ALLOWED: payload { campaignId, authorId, recipientId } | Б-8 | удалить | `domain/src/peer-review/review/review.rules.test.ts:73` (payload из реального отказа) |
| `…:68` | TEXT_INVALID: payload { min, max, length } | Б-8 | удалить | `domain/src/peer-review/review/review.rules.test.ts:117` (payload из реального отказа) |

### `peer-review/review/review.events.test.ts`

| путь:строка | тест | Б | что делать | где покрыто |
|---|---|---|---|---|
| `domain/src/peer-review/review/review.events.test.ts:17` | FQN peer-review.review.created | Б-11 | удалить | `modules/peer-review/src/review/uc/create-review.uc.test.ts:124` (событие публикуется с этим именем на реальном UC) |
| `…:21` | payload: reviewId, campaignId, scopeId, authorId, recipientId, direction | Б-8 | удалить | `domain/src/peer-review/review/review.ar.test.ts:92` (payload, собранный `create`) |
| `…:30` | направление — одно из трёх, прочее отклоняется | Б-8 | удалить | `domain/src/peer-review/review/review.state.test.ts:40` (та же `ReviewDirectionSchema`) |
| `…:44` | идентификаторы — UUID | Б-8 | удалить | `domain/src/peer-review/review/review.ar.test.ts:92` + `node_modules/dmg-core/src/kernel/fields/fields.test.ts:41` |
| `…:59` | make собирает событие с этим payload | Б-11 | удалить | `domain/src/peer-review/review/review.ar.test.ts:92` |

### `peer-review/review/review.rules.test.ts`

| путь:строка | тест | Б | что делать | где покрыто |
|---|---|---|---|---|
| `domain/src/peer-review/review/review.rules.test.ts:32` | описание ссылается на REVIEW_WINDOW_CLOSED | Б-11 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` (ERR-02) |
| `…:51` | после границы — закрыто | Б-6 | слить в `:42` | `domain/src/peer-review/review/review.rules.test.ts:42` (та же ветка `isExpired` = true с payload) |
| `…:60` | описание ссылается на REVIEW_RECIPIENT_NOT_ALLOWED | Б-11 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` |
| `…:94` | автор не автор окна — адресатов нет, любой отказ | Б-6 | удалить | `domain/src/peer-review/review/review.rules.test.ts:73` (тот же отказ `RECIPIENT_NOT_ALLOWED`; не-автор в проде до правила не доходит — Policy раньше) |
| `…:107` | описание ссылается на REVIEW_TEXT_INVALID | Б-11 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` |

### `peer-review/review/review.state.test.ts`

| путь:строка | тест | Б | что делать | где покрыто |
|---|---|---|---|---|
| `domain/src/peer-review/review/review.state.test.ts:50` | невозможная пара mentor_mentor исключена типом | Б-8 | слить в `:40` (одна таблица «приём/отказ» на схему) | `domain/src/peer-review/review/review.state.test.ts:40` |
| `…:83` | новый формат (числа, version) читается без изменений | Б-11 | удалить | `modules/peer-review/src/infra/review.json-repo.test.ts:61` (round-trip нового формата через файл) |
| `…:96` | валидный отзыв студента | Б-11 | удалить | `domain/src/peer-review/review/review.state.test.ts:113` (четыре валидных разбора той же записи) |
| `…:100` | снапшоты кампании обязательны: campaignId, direction | Б-8 | удалить | `domain/src/peer-review/review/review.state.test.ts:40` (direction) + `node_modules/dmg-core/src/kernel/fields/fields.test.ts:41` (uuid) |
| `…:106` | uuid, scopeId, authorId, recipientId — UUID | Б-8 | удалить | `node_modules/dmg-core/src/kernel/fields/fields.test.ts:41` |
| `…:127` | дата не ISO и не число отклоняется | Б-8 | удалить | `node_modules/dmg-core/src/kernel/fields/fields.test.ts:31` |
| `…:132` | у каждого поля есть описание (MAN-02) | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:192` |
| `…:138` | поля state: база entity + поля отзыва | Б-11 | удалить | «нигде»: список ключей против литерала; новое поле требует правки схемы (иначе `tsc`/OUTPUT_VALIDATION), лишний ключ отсекает `v.object` |
| `…:158` | константы: 10 и 3500 | Б-11 | удалить | `domain/src/peer-review/review/review.rules.test.ts:112` (те же числа литералами в правиле) |

### `peer-review/review/scope-reviews.dqs.test.ts` и `peer-review/review/uc/*.test.ts`

| путь:строка | тест | Б | что делать | где покрыто |
|---|---|---|---|---|
| `domain/src/peer-review/review/scope-reviews.dqs.test.ts:83` | пустой скоуп — пустой список групп | Б-12 | удалить | `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:48` (то же на реальном UC) |
| `domain/src/peer-review/review/uc/create-review.uc.test.ts:11` | command пользователя над review; ошибки и событие | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06) + `:426` (ERR-04) |
| `…:30` | Policy — автор окна (право раньше правил) | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230`; поведение — `modules/peer-review/src/review/uc/create-review.uc.test.ts:273` (посторонний при истёкшем окне — `ACCESS_DENIED`) |
| `…:34` | правила по порядку: окно → адресат → текст | Б-7 | удалить | `modules/peer-review/src/review/uc/create-review.uc.test.ts:291` (порядок правил на реальных отказах) |
| `…:42` | вход — { campaignId, recipientId, text }, без authorId | Б-8 | удалить | `modules/peer-review/src/review/uc/create-review.uc.test.ts:75` (реальный вызов: автор из субъекта) |
| `…:62` | выход — { reviewId, campaignId, recipientId } | Б-8 | удалить | `modules/peer-review/src/review/uc/create-review.uc.test.ts:75` (выход реального UC) |
| `domain/src/peer-review/review/uc/get-my-review.uc.test.ts:10` | query пользователя, allowAll, без ошибок | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` |
| `…:21` | вход — { campaignId, recipientId }, без authorId | Б-8 | удалить | `modules/peer-review/src/review/uc/get-my-review.uc.test.ts:47` (реальный вызов) |
| `…:33` | выход — { found, text? } | Б-8 | удалить | `modules/peer-review/src/review/uc/get-my-review.uc.test.ts:52` (`found: false` в реальном выходе) |
| `domain/src/peer-review/review/uc/list-my-reviews.uc.test.ts:18` | query пользователя, allowAll, без ошибок | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` |
| `…:29` | вход — только необязательный filter, без userId | Б-8 | удалить | `modules/peer-review/src/review/uc/list-my-reviews.uc.test.ts:62` (реальный вызов) |
| `…:37` | ReviewFilter: direction, recipientId, campaignId | Б-8 | удалить | `modules/peer-review/src/review/uc/list-my-reviews.uc.test.ts:123` (реальный фильтр `direction`) |
| `…:57` | выход — { reviews }, createdAt — число | Б-8 | удалить | `modules/peer-review/src/review/uc/list-my-reviews.uc.test.ts:77` (`createdAt` числом в реальном ответе) |
| `domain/src/peer-review/review/uc/list-scope-facts.uc.test.ts:10` | query пользователя, allowAll, без ошибок | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` |
| `…:21` | вход — { scopeId } uuid | Б-8 | удалить | `modules/peer-review/src/review/uc/list-scope-facts.uc.test.ts:48` (реальный вызов) |
| `…:27` | выход — { hasReviews, reviewsCount ≥ 0 целое } | Б-8 | удалить | `modules/peer-review/src/review/uc/list-scope-facts.uc.test.ts:48` |
| `domain/src/peer-review/review/uc/list-scope-reviews.uc.test.ts:18` | query пользователя, allowAll, без ошибок | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` |
| `…:29` | вход — { scopeIds, filter? }; пустой scopeIds допустим | Б-8 | удалить | `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:55` (пустой `scopeIds` на реальном UC) |
| `…:41` | ReviewFilter: direction, recipientId, campaignId | Б-8 | удалить | `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:63` (реальный `filter.direction`) |
| `…:59` | выход — { scopeIds, recipients[{ recipientId, reviews }] } | Б-8 | удалить | `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:93` (группы со снимками реального UC) |

---

## 4. Полезные тесты

- `peer-review/peer-review.module.test.ts` — 1 тест (`:8`), полезен: единственная проверка состава модуля (7 UC, 2 агрегата, ER, `dependsOn`, `external`) — этого `arch:check` не видит.
- `peer-review/review-campaign/campaign-facts.dqs.test.ts` — 4 теста, полезны: прогресс M/K (фильтр «только мои»), роль и `daysLeft` из Ar для субъекта и ментора, признак `hasMyReview` по адресатам.
- `peer-review/review-campaign/review-campaign.ar.test.ts` — 12 тестов, полезны: сборка state в `create`, окно `at + 7 сут`, порядок и пустота `participants`, событие `created` с данными для UI, инвариант адресации (`INVALID_PARTICIPANTS` по трём причинам), тот же инвариант при `restore`, граница `isExpired` (до/в момент/после), округление `daysLeft`, `authorRoleOf`, `targetIdsFor` для субъекта и ментора.
- `peer-review/review-campaign/review-campaign.policy.test.ts` — 5 тестов, полезны: `isWindowAuthor` — allowed (субъект, ментор) и denied (соученик, посторонний, без субъекта): решение трека «каждое правило — allowed и denied».
- `peer-review/review-campaign/review-campaign.rules.test.ts` — 3 теста, полезны: `unique` — пустой список ок, конфликт пары, «другой скоуп/субъект» не мешает (семантика И в `isFor`).
- `peer-review/review-campaign/review-campaign.state.test.ts` — 4 теста, полезны: чтение legacy-записи релиза (ISO без зоны, без `updatedAt`/`version`), `updatedAt` из записи, пустой `participants`, единственный контекст `stream_fate` (отказ `stream_ended`/`exit`).
- `peer-review/review-campaign/student-fate.dqs.test.ts` — 4 теста, полезны: проекция `advanced`/`not_advanced`, фильтр адресатов (без субъекта и `abandoned`, порядок состава), `neverStarted` → `never_started`, иначе и при отсутствии субъекта → `dropped`.
- `peer-review/review/review.ar.test.ts` — 4 теста, полезны: сборка state в `create` (включая направление и снимок исхода), ветка «ментор без исхода», событие `created` с полным payload, `overwrite` (текст, `updatedAt`, версия 1, прочие поля целы).
- `peer-review/review/review-draft.dqs.test.ts` — 3 теста, полезны: три ветки `ReviewDraftDqs.of` — ментор→субъект, субъект→ментор, субъект→соученик (направление и наличие снимка исхода).
- `peer-review/review/review.policy.test.ts` — 5 тестов, полезны: `isCampaignAuthor` — allowed (субъект, ментор) и denied (соученик, посторонний, без субъекта).
- `peer-review/review/review.rules.test.ts` — 6 тестов, полезны: `windowOpen` (ok до границы, закрыто в момент `expiresAt` с payload), `recipientAllowed` (три разрешённых пары, четыре отказа с payload), границы текста 10/3500 и три отказа с payload.
- `peer-review/review/review.state.test.ts` — 8 тестов, полезны: три направления «кто о ком» и отказ `mentor_mentor`, legacy-запись релиза (ISO без зоны, `updatedAt`, ментор без `authorOutcome`), общая `StudentOutcomeSchema` (4 проекции, отказ сырых статусов), минимум/максимум текста (валидны, ниже и выше — отказ).
- `peer-review/review/scope-reviews.dqs.test.ts` — 3 теста, полезны: группировка по адресатам в порядке первого появления, порядок отзывов по `createdAt`, тай-брейк по `uuid`, наличие `authorOutcome` у снимка студента.

Все объявления — кандидаты (нет строки в §4): `peer-review-question-pool.test.ts`,
`review-campaign/er/create-student-campaign.er.test.ts`, `review-campaign/review-campaign.errors.test.ts`,
`review-campaign/review-campaign.events.test.ts`, `review/review.errors.test.ts`,
`review/review.events.test.ts`, все `review-campaign/uc/*.test.ts` и `review/uc/*.test.ts`.

---

## 5. Открытые вопросы

1. **Кросс-уровневая сверка ссылок.** 9 кандидатов покрыты тестами `modules/peer-review`
   (`review/review.ar.test.ts:148`; `review/scope-reviews.dqs.test.ts:83`;
   `review/review-campaign/student-fate.dqs.test.ts:70`; `review-campaign/review-campaign.errors.test.ts:31`;
   `review/review.errors.test.ts:26`; `review/review.events.test.ts:17`; все 22 объявления
   `*/uc/*.test.ts`). Инвентаризация модуля идёт параллельно: если её таблица удалит эти
   модульные тесты как дубли — удалять доменные нельзя, иначе правило останется без владельца.
   Предлагаю: сначала принять таблицу `modules/peer-review`, затем эту.
2. **Пул вопросов (`peer-review-question-pool.ts`).** Три пула метрик-анкеты (29/13/9 вопросов,
   `metrics-conception.md` §10) не читаются нигде, кроме своего теста. Варианты: (а) удалить
   файл вместе с 4 тестами (Б-13) — сейчас это мёртвый код; (б) оставить как задел и свести
   тесты к одной таблице «приём/отказ схемы пула»; рекомендация — (а), вернуть при появлении
   потребителя.
3. **Policy-тесты делегирующих правил.** 10 объявлений (`review-campaign.policy.test.ts`,
   `review.policy.test.ts`) проверяют правило, которое целиком делегирует вопрос Ar
   `authorRoleOf` (его тест — `review-campaign.ar.test.ts:216`), то есть формально это Б-2.
   По решению трека «каждое правило — allowed и denied» они оставлены полезными, как в `wish`/
   `stream`. Подтвердить, что решение распространяется и на правила-делегаты.
4. **Кто владелец чтения legacy-записи.** Разбор «ISO без зоны → число, `updatedAt = createdAt`»
   проверен дважды: в схеме (`*.state.test.ts`, оставлены полезными — TST §3 называет «отказ
   прежних форм записи» логикой схемы) и в репозиториях
   (`modules/peer-review/src/infra/*.json-repo.test.ts:200`, `:241`, `:258`). В `stream`
   доменные копии убрали (З5). Решить, какой уровень остаётся владельцем.
5. **Мёртвый метод `hasParticipant`.** `review-campaign.ar.ts:192` не вызывается нигде, кроме
   удаляемого `review-campaign.ar.test.ts:199` (Б-13 по коду); вместе с ним уходит ветка
   «не автор окна — адресатов нет» (`:247`), недостижимая в проде (Policy отсекает раньше).
   Удалить метод или оставить как часть публичного API агрегата?
