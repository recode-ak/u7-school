# Что удаляем: тесты домена `peer-review`

Трек `tst-cleanup_20261105`, фаза Ф2, срез «домен `peer-review`». Только чтение кода + прогоны
`bun test`; удалено и изменено ничего не было, кроме этого файла.

**Область.** `domain/src/peer-review/**/*.test.ts` — 26 файлов, **184 pass / 513 expect()**
(`cd domain && bun test src/peer-review`, worktree `tst-cleanup`). База — `peer-review-domain.md`
(§1 сводка, §3 кандидаты), закономерности — `conductor/roadmap/test-bloat.md` §2.

**Решения, которые применены ко всей таблице.**

- **Схемы (Б-8).** Тесты приёма/отказа полей платформы удаляются: их владелец — `dmg-core`
  (`fields.test.ts:19/31/41`, `use-case-from-def.test.ts:130/264`). Остаётся своя логика схемы
  (`refine`/`transform`), отказ прежних форм записи, схема `state`, разбираемая при чтении файла, —
  по возможности одной таблицей «валидно/невалидно» на схему.
- **Паспорта Def (Б-7).** Удаляются все; состав модуля держит один тест —
  `peer-review.module.test.ts:8` (UC, Job, `dependsOn`, агрегаты, `reactions`). Остальные паспорта
  (MAN-02/MAN-06/MAN-08/ERR-02/ERR-04) — `bun run arch:check`, `def-checker.test.ts`.
- **`label`/`denyMessage` (TST-09).** Тексты не проверяются; одиночные `expect` на них — раздел
  «Остающиеся проверки `label`» ниже, снимаются в этом срезе вместе с тестами.
- **Одно правило на двух уровнях (Б-1).** Правило держит владелец (Ar/DCS/DQS/Policy в домене).
  UC-тест модуля держит один сквозной сценарий на UC и только-UC поведение. Копию **выше**
  владельца удаляем; доменные тесты правил ссылкой на UC модуля не удаляются, наоборот — их
  копия в UC удаляется. Исключение: доменные тесты UC/ER — паспорта и схемы (Б-7/Б-8), поведение
  держит модуль.
- **Чтение legacy-записи.** Владелец — репозиторий модуля (как в `stream`): доменные копии разбора
  legacy-форм в `*.state.test.ts` удаляются со ссылкой на чтение фикстуры/round-trip репозитория.
- **Пул вопросов** (код — резерв метрик, остаётся): остаётся **один** тест — валидность/невалидность
  схемы пула; остальные удаляются (Б-11).

Пути в колонке «где покрыто» — от корня репо. Ссылки на тесты модуля `peer-review` ведут только на
`test`/`it`, которые `peer-review-app.md` §4 считает полезными (не на кандидатов §3 этого уровня).
Порядок строк — порядок объявлений в файле.

---

## 1. Таблица

| файл | строка | имя теста | Б | действие | где покрыто |
|---|---|---|---|---|---|
| `peer-review/peer-review.module.test.ts` | 31 | ArchChecker (checkDefs) — без нарушений | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06), `:325` (MAN-08), `:426` (ERR-04) — это `bun run arch:check` |
| | 35 | контракт отдаёт события, ошибки и 5 Def рецензий | Б-11 | удалить | нигде: перечень ключей реэкспорта против своего же литерала; форму `contract` держат `tsc` у потребителя и `:8` |
| `peer-review/peer-review-question-pool.test.ts` | 10 | пулы соответствуют источникам по количеству вопросов | Б-11 | удалить | нигде: 29/13/9 — данные пула (`metrics-conception.md` §10), читающего пул кода нет (`PEER_REVIEW_POOLS` никем не импортируется) |
| | 16 | questionCode уникальны внутри каждого пула и между пулами | Б-13 | переписать | — (остаётся единственной проверкой пула: таблица «валидно/невалидно» схемы + уникальность кодов) |
| | 27 | каждый вопрос содержит корректный вес | Б-11 | удалить | нигде: вес ограничен схемой `v.union([0.75, 1, 1.25])` (`peer-review-question-pool.ts:14`), `definePool` парсит пул при загрузке модуля (`:54`) |
| | 35 | каждый контекст из PEER_REVIEW_POOLS имеет непустой пул | Б-11 | удалить | нигде: `Object.keys` против своего литерала; непустота — `v.minLength(1)` (`peer-review-question-pool.ts:42`) на загрузке модуля |
| `peer-review/review-campaign/er/create-student-campaign.er.test.ts` | 12 | на student.completed и student.abandoned; трогает кампанию; зовёт состав; публикует created | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06), `:348` (calls ⊆ `dependsOn`) |
| | 22 | on/touches/calls/emits — те же Def, что в контрактах | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230`; поведение реакции — `modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts:197` |
| `peer-review/review-campaign/review-campaign.ar.test.ts` | 51 | нет statuses/transitions; событие created; ошибки группы | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230`, `:325` |
| | 81 | `it.each` — исход %s проходит в payload | Б-6 | слить в `review-campaign/review-campaign.ar.test.ts:60` | — (`create` копирует `subjectOutcome` в payload, ветки по значению нет) |
| | 105 | окно сразу согласовано: жива, daysLeft = 7 | Б-1 | удалить | `review-campaign/review-campaign.ar.test.ts:73` (expiresAt = at + 7 сут) + `:180` (daysLeft от at) |
| | 144 | восстанавливает по snapshot; события не накоплены | Б-9 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:251` |
| | 150 | updatedAt и version сохраняются при restore | Б-9 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:251` |
| | 156 | повреждённый контекст — исключение | Б-1 | удалить | `review-campaign/review-campaign.state.test.ts:87` (схема отклоняет прочие контексты; тест остаётся таблицей) |
| | 190 | геттеры каркаса и payload | Б-11 | удалить | `review-campaign/review-campaign.ar.test.ts:60` (те же геттеры в ожиданиях `create`) + `:73` |
| | 199 | isSubject / isMentor / hasParticipant | Б-13 | отложить: удалить с кодом | `review-campaign/review-campaign.ar.test.ts:216` (живые `isSubject`/`isMentor` — через `authorRoleOf`), `:247`; `hasParticipant` мёртв (`review-campaign.ar.ts:192`) |
| | 209 | view() — состояние наружу без мутации агрегата | Б-9 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:272` |
| | 232 | targetIdsFor субъекта при пустом participants — только ментор | Б-6 | слить в `review-campaign/review-campaign.ar.test.ts:224` | — (тот же код `[...participants, mentorId]`, ветки нет; пустой список уже в `:93`) |
| | 242 | никогда не о себе: автора нет в его списке адресатов | Б-6 | удалить | `review-campaign/review-campaign.ar.test.ts:224` (список субъекта без субъекта) + `:238` (список ментора — субъект) |
| `peer-review/review-campaign/review-campaign.errors.test.ts` | 10 | ровно три ошибки: коды и kind | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:426` (ERR-04) |
| | 20 | WINDOW_CLOSED, NOT_PARTICIPANT, RECIPIENT_NOT_ALLOWED переехали в Review (Ф2) | Б-11 | удалить | нигде: перечень отсутствующих кодов; вернувшийся код поймает ERR-04 (`node_modules/dmg-core/src/arch/def-checker.test.ts:426`) |
| | 31 | NOT_FOUND: текст legacy и payload { campaignId } | Б-8 | удалить | payload — `modules/peer-review/src/review-campaign/uc/get-campaign-recipients.uc.test.ts:137`; текст — «Остающиеся проверки `label`» |
| | 46 | ALREADY_EXISTS: payload { scopeId, subjectId } | Б-8 | удалить | `review-campaign/review-campaign.rules.test.ts:40` (payload из реального отказа правила) |
| `peer-review/review-campaign/review-campaign.events.test.ts` | 17 | FQN peer-review.review-campaign.created (было student-campaign.created) | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:325` (MAN-08 — префикс модуля/агрегата) |
| | 23 | payload: campaignId, context, scopeId, subjectId, mentorId, subjectOutcome | Б-8 | удалить | `review-campaign/review-campaign.ar.test.ts:111` (событие из `create` с полным payload) + `node_modules/dmg-core/src/domain/events/event-def.test.ts:25` |
| | 39 | make собирает событие с этим payload | Б-11 | удалить | нигде: `make(payload).payload === payload` — тождество; реальная сборка — `review-campaign/review-campaign.ar.test.ts:111` |
| `peer-review/review-campaign/review-campaign.rules.test.ts` | 29 | описание ссылается на REVIEW_CAMPAIGN_ALREADY_EXISTS | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` (ERR-02 — ошибка правила объявлена в `errors` UC) |
| `peer-review/review-campaign/review-campaign.state.test.ts` | 33 | ISO без зоны читается как UTC-число; updatedAt = createdAt; version = 0 | Б-1 | удалить | `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:200` (тот же legacy-вход, точные значения, у репо-владельца) + `:338` (все записи фикстуры) |
| | 43 | legacy-запись с updatedAt (ISO) — число, createdAt не затронут | Б-1 | удалить | `node_modules/dmg-core/src/kernel/fields/fields.test.ts:19` (ISO → UTC) + `:126` (updatedAt из записи не меняется) |
| | 51 | новый формат (числа, version) читается без изменений | Б-1 | удалить | `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:71` (round-trip нового формата) |
| | 63 | пустой participants — валиден (адресат только ментор) | Б-8 | слить в `review-campaign.state.test.ts:87` | — (строка «валидно» общей таблицы схемы) |
| | 69 | `it.each` — исход %s проходит в payload | Б-8 | удалить | `review/review.state.test.ts:113` (та же общая `StudentOutcomeSchema`, четыре проекции) |
| | 79 | `it.each` — исход %s отклоняется | Б-8 | удалить | `review/review.state.test.ts:113` (отказ сырых статусов там же) |
| | 87 | контекст: stream_fate; прочее (в т.ч. старый stream_ended) отклоняется | Б-8 | переписать | — (становится единственной таблицей «валидно/невалидно» схемы `state`) |
| | 92 | mentorId обязателен и UUID | Б-8 | удалить | `node_modules/dmg-core/src/kernel/fields/fields.test.ts:41` (F.uuid) + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` (обязательное поле → `INPUT_VALIDATION`) |
| | 103 | participants — только uuid[] (списочная модель со статусами удалена) | Б-8 | слить в `review-campaign.state.test.ts:87` | — (строка «невалидно»: отказ прежней формы записи) |
| | 112 | uuid/scopeId/subjectId обязательны и UUID | Б-8 | удалить | `node_modules/dmg-core/src/kernel/fields/fields.test.ts:41` + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` |
| | 119 | payload обязателен; дата не ISO отклоняется | Б-8 | удалить | `node_modules/dmg-core/src/kernel/fields/fields.test.ts:31` (F.timestamp отклоняет мусор) + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` |
| | 125 | у каждого поля (и payload) есть описание (MAN-02) | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:193` |
| | 138 | ISO без зоны читается как UTC | Б-6 | удалить | дубль `:33`; покрытие — `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:338` + `node_modules/dmg-core/src/kernel/fields/fields.test.ts:19` |
| `peer-review/review-campaign/student-fate.dqs.test.ts` | 60 | ментор не попадает в участников | Б-6 | удалить | `review-campaign/student-fate.dqs.test.ts:51` (точный список участников — без ментора и субъекта) |
| `peer-review/review-campaign/uc/get-campaign-recipients.uc.test.ts` | 19 | query пользователя; Policy isWindowAuthor; ошибка CAMPAIGN_NOT_FOUND | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06) + `:426` (ERR-04) |
| | 32 | вход — { campaignId } uuid, без authorId | Б-8 | удалить | `modules/peer-review/src/review-campaign/uc/get-campaign-recipients.uc.test.ts:47` (реальный вызов с этим входом) + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` |
| | 42 | выход: роль, ментор, исход, daysLeft, адресаты с hasMyReview | Б-8 | удалить | `modules/peer-review/src/review-campaign/uc/get-campaign-recipients.uc.test.ts:47` (форма выхода) + `:102` (`daysLeft` = 0) + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` |
| `peer-review/review-campaign/uc/get-my-campaigns.uc.test.ts` | 20 | query пользователя над кампанией, allowAll, без ошибок и событий | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` |
| | 32 | вход без userId: onlyLives?, filter? { context?, scopeId? } | Б-8 | удалить | `modules/peer-review/src/review-campaign/uc/get-my-campaigns.uc.test.ts:121` (фильтр реального вызова) + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` |
| | 52 | выход — список карточек; expiresAt — число (F.timestamp) | Б-8 | удалить | `modules/peer-review/src/review-campaign/uc/get-my-campaigns.uc.test.ts:49` (карточка живого окна) + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` |
| `peer-review/review/review.ar.test.ts` | 49 | имя review; нет statuses/transitions; событие created | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230`, `:325` |
| | 85 | uuid — со входа; createdAt = updatedAt = at без минутного усечения | Б-9 | удалить | `review/review.ar.test.ts:58` (снимок равен сохранённому при `createdAt = AT`) + `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:346` |
| | 109 | восстанавливает по snapshot; события не накоплены | Б-9 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:251` |
| | 115 | version сохраняется | Б-9 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:251` |
| | 119 | текст вне 10–3500 — исключение (схема state страхует restore) | Б-8 | удалить | `review/review.state.test.ts:163` + `:182` (схема отклоняет обе границы) + `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:257` |
| | 126 | повреждённое направление — исключение | Б-8 | удалить | `review/review.state.test.ts:40` (та же схема направления) + `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:257` |
| | 132 | view() — состояние наружу | Б-9 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:272` |
| | 155 | граница минимума по длине — Ok | Б-11 | удалить | `review/review.rules.test.ts:112` (границы 10 и 3500 — Ok) |
| `peer-review/review/review-draft.dqs.test.ts` | 52 | `it.each` — authorOutcome = снимок исхода субъекта | Б-6 | удалить | `review/review-draft.dqs.test.ts:38` (draft копирует `campaign.subjectOutcome`, ветки по значению нет) |
| `peer-review/review/review.errors.test.ts` | 11 | ровно три ошибки: коды и kind | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:426` (ERR-04) |
| | 19 | NOT_PARTICIPANT, DUPLICATE и CAMPAIGN_NOT_FOUND не объявлены | Б-11 | удалить | нигде: перечень отсутствующих кодов; вернувшийся — ERR-04 (`node_modules/dmg-core/src/arch/def-checker.test.ts:426`) |
| | 26 | REVIEW_CAMPAIGN_NOT_FOUND — ссылкой из ошибок кампании (ERR-03) | Б-7 | удалить | `modules/peer-review/src/review/uc/create-review.uc.test.ts:314` (отказ загрузки — `REVIEW_CAMPAIGN_NOT_FOUND`, `not_found`) |
| | 32 | тексты legacy сохранены | TST-09 | удалить | «Остающиеся проверки `label`» |
| | 44 | WINDOW_CLOSED: payload { campaignId, expiresAt } — число | Б-8 | удалить | `review/review.rules.test.ts:42` (payload из реального отказа правила) |
| | 59 | RECIPIENT_NOT_ALLOWED: payload { campaignId, authorId, recipientId } | Б-8 | удалить | `review/review.rules.test.ts:73` (payload из реального отказа) |
| | 68 | TEXT_INVALID: payload { min, max, length } | Б-8 | удалить | `review/review.rules.test.ts:117` (payload из реального отказа) |
| `peer-review/review/review.events.test.ts` | 17 | FQN peer-review.review.created (было review.created) | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:325` (MAN-08) |
| | 21 | payload: reviewId, campaignId, scopeId, authorId, recipientId, direction | Б-8 | удалить | `review/review.ar.test.ts:92` (событие из `create` с полным payload) + `node_modules/dmg-core/src/domain/events/event-def.test.ts:25` |
| | 30 | направление — одно из трёх, прочее отклоняется | Б-8 | удалить | `review/review.state.test.ts:40` (та же `ReviewDirectionSchema`) |
| | 44 | идентификаторы — UUID | Б-8 | удалить | `node_modules/dmg-core/src/kernel/fields/fields.test.ts:41` |
| | 59 | make собирает событие с этим payload | Б-11 | удалить | нигде: тождество `make(payload).payload`; реальная сборка — `review/review.ar.test.ts:92` |
| `peer-review/review/review.rules.test.ts` | 32 | описание ссылается на REVIEW_WINDOW_CLOSED | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` (ERR-02) |
| | 51 | после границы — закрыто | Б-6 | слить в `review/review.rules.test.ts:42` | — (ветка `at > expiresAt` того же `check`) |
| | 60 | описание ссылается на REVIEW_RECIPIENT_NOT_ALLOWED | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` (ERR-02) |
| | 107 | описание ссылается на REVIEW_TEXT_INVALID | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` (ERR-02) |
| `peer-review/review/review.state.test.ts` | 40 | принимает три направления «кто о ком» | Б-8 | переписать | — (становится таблицей `ReviewDirectionSchema`: три значения «валидно» + `mentor_mentor` «невалидно») |
| | 50 | невозможная пара mentor_mentor исключена типом | Б-6 | слить в `review.state.test.ts:40` | — (строка «невалидно» той же таблицы) |
| | 58 | ISO без зоны читается как UTC-число; updatedAt = createdAt; version = 0 | Б-1 | удалить | `modules/peer-review/src/infra/review.json-repo.test.ts:241` (тот же legacy-вход, точные значения, у репо-владельца) + `:383` |
| | 67 | updatedAt из записи (ISO) — число, createdAt не затронут | Б-1 | удалить | `node_modules/dmg-core/src/kernel/fields/fields.test.ts:19` (ISO → UTC) + `:126` (updatedAt из записи не меняется) |
| | 75 | запись ментора без authorOutcome читается, исхода нет | Б-8 | удалить | `review/scope-reviews.dqs.test.ts:34` (отзыв ментора без `authorOutcome` в реальном снимке) |
| | 83 | новый формат (числа, version) читается без изменений | Б-1 | удалить | `modules/peer-review/src/infra/review.json-repo.test.ts:61` (round-trip нового формата) |
| | 96 | валидный отзыв студента | Б-11 | удалить | `review/review.state.test.ts:113` (четыре валидных разбора той же схемы) |
| | 100 | снапшоты кампании обязательны: campaignId, direction | Б-8 | удалить | `review/review.state.test.ts:40` (`direction` — та же схема) + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` |
| | 106 | uuid, scopeId, authorId, recipientId — UUID | Б-8 | удалить | `node_modules/dmg-core/src/kernel/fields/fields.test.ts:41` |
| | 127 | дата не ISO и не число отклоняется | Б-8 | удалить | `node_modules/dmg-core/src/kernel/fields/fields.test.ts:31` |
| | 132 | у каждого поля есть описание (MAN-02) | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:193` |
| | 138 | поля state: база entity + поля отзыва | Б-11 | удалить | нигде: список ключей против своего литерала; база — `BaseEntityFields` (`entries` в `node_modules/dmg-core/src/kernel/fields/fields.test.ts:141`), поля отзыва — в `:113` и `:163` |
| | 158 | константы: 10 и 3500 | Б-11 | удалить | `review/review.rules.test.ts:112` (границы 10/3500 закреплены поведением правила) |
| `peer-review/review/scope-reviews.dqs.test.ts` | 83 | пустой скоуп — пустой список групп | Б-12 | удалить | нигде: `groupByRecipient([])` → `[]` — `for` по пустому массиву, ветки нет |
| `peer-review/review/uc/create-review.uc.test.ts` | 11 | command пользователя над review; ошибки и событие | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` + `:426` |
| | 30 | Policy — автор окна (право раньше правил) | Б-7 | удалить | `domain/src/peer-review/review/review.policy.test.ts:37`, `:48` (отказ правила) + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:621` (Policy до `execute`) |
| | 42 | вход — { campaignId, recipientId, text }, без authorId | Б-8 | удалить | `modules/peer-review/src/review/uc/create-review.uc.test.ts:75` (реальный вызов с этим входом) + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` |
| | 62 | выход — { reviewId, campaignId, recipientId } | Б-8 | удалить | `modules/peer-review/src/review/uc/create-review.uc.test.ts:75` + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` |
| `peer-review/review/uc/get-my-review.uc.test.ts` | 10 | query пользователя, allowAll, без ошибок | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` |
| | 21 | вход — { campaignId, recipientId }, без authorId | Б-8 | удалить | `modules/peer-review/src/review/uc/get-my-review.uc.test.ts:47` (реальный вызов) + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` |
| | 33 | выход — { found, text? } | Б-8 | удалить | `modules/peer-review/src/review/uc/get-my-review.uc.test.ts:47` (`found: true` + текст) + `:52` (`found: false`) |
| `peer-review/review/uc/list-my-reviews.uc.test.ts` | 18 | query пользователя, allowAll, без ошибок | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` |
| | 29 | вход — только необязательный filter, без userId | Б-8 | удалить | `modules/peer-review/src/review/uc/list-my-reviews.uc.test.ts:66` (реальный вызов) + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` |
| | 37 | ReviewFilter: direction, recipientId, campaignId — все необязательные | Б-8 | удалить | `modules/peer-review/src/infra/review.json-repo.test.ts:196` (все поля фильтра на реальной выборке) |
| | 57 | выход — { reviews }, createdAt — число | Б-8 | удалить | `modules/peer-review/src/review/uc/list-my-reviews.uc.test.ts:77` (числовой createdAt в сортировке) + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` |
| `peer-review/review/uc/list-scope-facts.uc.test.ts` | 10 | query пользователя, allowAll, без ошибок | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` |
| | 21 | вход — { scopeId } uuid | Б-8 | удалить | `modules/peer-review/src/review/uc/list-scope-facts.uc.test.ts:41` (реальный вызов) + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` |
| | 27 | выход — { hasReviews, reviewsCount >= 0 целое } | Б-8 | удалить | `modules/peer-review/src/review/uc/list-scope-facts.uc.test.ts:41` (нет отзывов: `false`/0) + `:48` (есть: `true`/N) |
| `peer-review/review/uc/list-scope-reviews.uc.test.ts` | 18 | query пользователя, allowAll, без ошибок | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` |
| | 29 | вход — { scopeIds, filter? }; пустой scopeIds допустим; direction вне фильтра нет | Б-8 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` (обязательные поля и пути) + `node_modules/dmg-core/src/kernel/fields/fields.test.ts:41` (F.uuid) |
| | 41 | ReviewFilter: direction, recipientId, campaignId | Б-8 | удалить | `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:221` (фильтр доходит до репозитория) + `modules/peer-review/src/infra/review.json-repo.test.ts:196` |
| | 59 | выход — { scopeIds, recipients[{ recipientId, reviews }] }, createdAt — число | Б-8 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` (`OUTPUT_VALIDATION`) + `review/scope-reviews.dqs.test.ts:34` (форма групп) |

---

## 2. Переписать

- `peer-review-question-pool.test.ts:16` — единственная проверка пула: таблица «валидно/невалидно»
  `PeerReviewQuestionPoolSchema` (пустой `questions`, вес вне `{0.75, 1, 1.25}`, пустой
  `questionCode` — отказ) плюс уникальность `questionCode` внутри и между пулами.
- `review-campaign/review-campaign.state.test.ts:87` — становится единственной таблицей
  «валидно/невалидно» схемы `ReviewCampaignState`: «валидно» — пустой `participants` (из `:63`),
  «невалидно» — прочий `context` (`stream_ended`, `exit`) и прежняя списочная форма `participants`
  со статусами (из `:103`).
- `review/review.state.test.ts:40` — становится таблицей `ReviewDirectionSchema`: три значения
  «валидно», `mentor_mentor` (из `:50`) — «невалидно».

## 3. Слить

- `review-campaign/review-campaign.ar.test.ts:81` → `:60`: четыре исхода одним `it` — `create`
  только копирует `subjectOutcome`, отдельного кейса на значение не нужно.
- `review-campaign/review-campaign.ar.test.ts:232` → `:224`: пустой `participants` — строка той же
  проверки `targetIdsFor` (ветки нет).
- `review-campaign/review-campaign.state.test.ts:63` → `:87`: пустой `participants` — строка
  «валидно» общей таблицы схемы.
- `review-campaign/review-campaign.state.test.ts:103` → `:87`: прежняя списочная форма
  `participants` — строка «невалидно» той же таблицы.
- `review/review.state.test.ts:50` → `:40`: `mentor_mentor` — строка «невалидно» таблицы направлений.
- `review/review.rules.test.ts:51` → `:42`: `at > expiresAt` — та же ветка отказа, что на границе.

## 4. Перенести

Ничего: срез — чистка. Сценарии, которые стоит удержать, держит владелец на своём уровне (домен или
модуль), переносить между уровнями нечего.

## 5. Остающиеся проверки `label`

Снимаются в этом срезе (TST-09: текст не ошибка поведения).

| файл:строка | что проверяется | судьба |
|---|---|---|
| `peer-review/review/review.errors.test.ts:32` | `label` трёх ошибок Review — «тексты legacy сохранены» | тест удаляется целиком (файл уходит) |
| `peer-review/review-campaign/review-campaign.errors.test.ts:31` | `label` `REVIEW_CAMPAIGN_NOT_FOUND` внутри теста про payload | тест удаляется целиком (файл уходит) |
| `peer-review/review/review.policy.test.ts:43` | `denyMessage` — внутри `expect(decision).toEqual(denied(...))`, где `denyMessage` берётся из того же `decision` | тест остаётся; снять `expect(decision).toEqual(denied(...))`, оставить `allowed`/`rule` |
| `peer-review/review-campaign/review-campaign.policy.test.ts:47` | то же для `isWindowAuthor` | тест остаётся; снять `expect(decision).toEqual(denied(...))`, оставить `allowed`/`rule` |

## Приёмка (orchestrator)

- Владелец чтения legacy — репозиторий модуля; ссылки `:33`/`:58` переведены на оставленные `review-campaign.json-repo.test.ts:200`, `review.json-repo.test.ts:241`.
- `create-review.uc.test.ts:30` — ссылка переведена на доменную Policy (модульный `:260` удаляется таблицей модуля).

## 6. Итог

| действие | объявлений | кейсов `bun test` |
|---|---|---|
| удалить | 94 | 103 |
| слить (в приёмник) | 6 | 9 |
| переписать (остаются) | 3 | 3 |
| перенести | 0 | 0 |
| отложить до `course-dmg` | 0 | 0 |
| отложить: удалить с кодом | 1 | 1 |
| **строк в таблице** | **104** | |

**Ожидаемо после среза:** **72 pass, 0 fail** в 15 файлах (было 184 в 26). Уходят 11 файлов
целиком: `review-campaign/er/create-student-campaign.er.test.ts`,
`review-campaign/review-campaign.errors.test.ts`, `review-campaign/review-campaign.events.test.ts`,
`review-campaign/uc/get-campaign-recipients.uc.test.ts`,
`review-campaign/uc/get-my-campaigns.uc.test.ts`, `review/review.errors.test.ts`,
`review/review.events.test.ts`, `review/uc/get-my-review.uc.test.ts`,
`review/uc/list-my-reviews.uc.test.ts`, `review/uc/list-scope-facts.uc.test.ts`,
`review/uc/list-scope-reviews.uc.test.ts`.

**Отложенного до `course-dmg` нет:** в области домена нет тестов бота, красных из-за `course-dmg`
(TR-57). Единственный `отложить` — мёртвый экспорт `hasParticipant` (`review-campaign.ar.ts:192`):
тест `review-campaign.ar.test.ts:199` остаётся, пока оркестратор не удалит метод вместе с ним.

**Не вошло из 101 кандидата инвентаризации: 96 в таблице, 5 — нет** (таблица ниже). Остальные
8 строк таблицы — не кандидаты §3: §4 считала их полезными. Четыре остаются
приёмниками или таблицами (`review-campaign/review-campaign.state.test.ts:63`, `:87`,
`review/review.state.test.ts:40`, `:75`), четыре удаляются решением среза — чтение legacy
у репозитория (`review-campaign/review-campaign.state.test.ts:33`, `:43`,
`review/review.state.test.ts:58`, `:67`).

| кандидат | почему не трогаем |
|---|---|
| `review-campaign/review-campaign.ar.test.ts:247` | решение по срезу: `Ar.targetIdsFor` не-автора — полезное поведение Ar (`:247`), не копия: в `:216` только роли, в `:224`/`:238` только авторы |
| `review-campaign/student-fate.dqs.test.ts:70` | DQS — владелец: `participants` пуст для abandoned (`forAbandoned`), на это ссылается модуль (`modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts:173` удаляется) |
| `review/review.ar.test.ts:148` | Ar — владелец «перезапись не создаёт событие»; модуль ссылается на него (`modules/peer-review/src/review/uc/create-review.uc.test.ts:168` удаляется) |
| `review/review.rules.test.ts:94` | Б-6 в инвентаризации неточен: это отдельный класс входа (автор — не автор окна, `targetIdsFor` → `[]`), в `:73` его нет; остаётся у владельца правила |
| `review/uc/create-review.uc.test.ts:34` | домен — владелец «правила в порядке окно → адресат → текст»; на него ссылается модуль (`modules/peer-review/src/review/uc/create-review.uc.test.ts:217`, `:241` удаляются) |

**Расхождения с `peer-review-domain.md`** (обе в пользу решений среза):

1. `review.state.test.ts:40`, `:58`, `:67`, `:75` и `review-campaign.state.test.ts:33`, `:43`, `:87`,
   `:63` инвентаризация считала полезными (§4). Решение среза: чтение legacy — у репозитория
   модуля (как в `stream`), поэтому `:58/:67`, `:33/:43` удаляются со ссылкой на чтение фикстуры
   репозитория; схема `state` остаётся **одной** таблицей на схему (`:40`+`:50` для направления,
   `:87` для кампании) — это меньше тестов, чем в §4, но каждая ветка схемы остаётся под проверкой.
2. `peer-review-question-pool.test.ts:16` инвентаризация помечала Б-13 (тест мёртвого экспорта).
   Код пула остаётся (резерв метрик), поэтому тест не удаляется, а переписывается в единственную
   проверку пула; `:10/:27/:35` — удаляются (Б-11).

**Спорные строки (5).**

1. `peer-review/review.state.test.ts:58/67` — удаление legacy-разбора со ссылкой на репозиторий и
   `fields.test.ts`: если решат, что трансформация схемы должна проверяться в домене, строки
   возвращаются, а ссылка переезжает на них.
2. `peer-review/review-campaign/review-campaign.ar.test.ts:199` — оставлен по решению (мёртвый метод):
   альтернатива — `переписать` сейчас, сняв проверки `hasParticipant`.
3. `peer-review/review/review.rules.test.ts:94` — оставлен вопреки Б-6 инвентаризации: класс входа
   другой (автор не из окна).
4. `peer-review/review-campaign/review-campaign.ar.test.ts:81` и `:232` — `слить`, а не `удалить`:
   при желании убрать шум их можно удалить, покрытие (`:60`, `:224`) от этого не меняется.
5. `peer-review/peer-review-question-pool.test.ts:16` — оставлен несмотря на Б-13: код пула остаётся,
   иначе проверять нечего.
