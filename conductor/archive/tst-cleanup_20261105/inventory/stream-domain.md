# Инвентаризация тестов: домен `stream`

Трек `tst-cleanup_20261105`, фаза 1. Только чтение + прогоны `bun test`. Ничего не удалено и не изменено, кроме этого файла.

**Как считал.** «Объявлений» — строки `it(`/`test(`/`it.each(` (тела `describe.each` считаются один раз, как в `wish.md`); «выполнено» — кейсы, которые печатает `bun test` по файлу отдельно. Оценка — по объявлению; один `it.each` с таблицей — один кандидат, даже если он делает 3–11 кейсов.

Критерий оценки того же вида, что в `wish.md`: **«какая реальная ошибка в коде модуля уронит этот тест и только этот»**. Сомнение трактовалось в пользу теста («полезен»).

**Прогон (на этом worktree, ветка `tst-cleanup`).**

| Команда | Итог |
|---|---|
| `bun test <файл>` по каждому из 28 файлов `domain/src/stream/**/*.test.ts` | 416 pass, **0 fail** |
| `bun test domain/src/stream` (суммарно) | 416 pass, 0 fail |

Базовая линия области: **301 объявление / 416 кейсов / 139 кандидатов (46 %)**.

Область — только `domain/src/stream`. Тесты модуля (`modules/stream/src/**`) и бота (`runners/u7-bot/**`) не инвентаризировались, но использовались как «где покрыто»: у перевода `stream` на Def почти каждый доменный тест имеет двойника на прикладном уровне. Это отдельная находка для инвентаризации `modules/stream` (см. «Открытые вопросы»).

---

## Сводка

| Файл | Объявлений | Выполнено | Полезен | Сомнителен / пуст |
|---|---|---|---|---|
| `stream/uc/stream.uc-defs.test.ts` | 21 | 31 | 2 | 19 |
| `student/uc/student.uc-defs.test.ts` | 21 | 25 | 3 | 18 |
| `stream/stream.ar.test.ts` | 24 | 29 | 13 | 11 |
| `stream/stream.state.test.ts` | 11 | 28 | 3 | 8 |
| `student/student.ar.test.ts` | 43 | 68 | 35 | 8 |
| `student/student.state.test.ts` | 8 | 22 | 2 | 6 |
| `stream/stream.policy.test.ts` | 13 | 16 | 9 | 4 |
| `student/student.policy.test.ts` | 11 | 20 | 8 | 3 |
| `stream/stream.errors.test.ts` | 6 | 6 | 0 | 6 |
| `stream/stream.rules.test.ts` | 7 | 7 | 5 | 2 |
| `student/student.rules.test.ts` | 14 | 21 | 12 | 2 |
| `student/student.errors.test.ts` | 4 | 12 | 1 | 3 |
| `student/student.events.test.ts` | 4 | 4 | 0 | 4 |
| `student/student.events.fate.test.ts` | 5 | 7 | 0 | 5 |
| `stream/stream.ar.student.test.ts` | 10 | 13 | 6 | 4 |
| `stream/uc/get-stream-members.uc.test.ts` | 5 | 9 | 0 | 5 |
| `stream/uc/get-stream-members.roster.test.ts` | 4 | 6 | 0 | 4 |
| `stream/uc/get-stream-presence.uc.test.ts` | 3 | 3 | 0 | 3 |
| `stream.module.test.ts` | 4 | 4 | 0 | 4 |
| `stream.module.student.test.ts` | 6 | 6 | 2 | 4 |
| `student/job/inactivity-sweep.job.test.ts` | 4 | 4 | 2 | 2 |
| `student-progress.dqs.test.ts` | 29 | 29 | 26 | 3 |
| `step-completion.dcs.test.ts` | 11 | 11 | 11 | 0 |
| `stream-launch.dcs.test.ts` | 9 | 9 | 8 | 1 |
| `stream-members.dqs.test.ts` | 10 | 10 | 8 | 2 |
| `passed-modules.dqs.test.ts` | 9 | 11 | 5 | 4 |
| `status.test.ts` | 3 | 3 | 1 | 2 |
| `content-snapshot-import.test.ts` | 2 | 2 | 0 | 2 |
| **Итого** | **301** | **416** | **162** | **139** |

**Расклад кандидатов по закономерностям:** З1 — 18, З2 — 34, З3 — 13, З4 — 7, З5 — 6, З6 — 22, З7 — 7, З8 — 2, З9 — 5, З10 — 9, З11 — 1, З12 — 7, З13 — 6, З14 — 2 (сумма — 139).

Половина кандидатов (З1, З2, З10, З11 — 62 из 139) — ручные паспорта Def и схемы, дописанные вместе с переводом `stream` на Def: срез дописывал тест к каждому новому `UcDef`, вместо того чтобы сверить состав один раз. В учебном модуле платформы (`node_modules/dmg-core/src/testing/example`) ни `normalize`, ни `ArchChecker` в тестах нет: состав контракта целиком отдан `bun run check`.

---

## Закономерности

З1–З8 — те же, что в `wish.md`; здесь коротко: сколько случаев, какие примеры. Новые для `stream` — З9–З14, описаны полно.

### З1. Ручной паспорт Def вместо автопроверки ArchChecker — 18 случаев

Файлов с `normalize(`/`ArchChecker` в `domain/src/stream` — 7, вхождений — 32. Повторение `wish`, поэтому действует тот же вывод: состав Def (`calls`, `emits`, `errors`, `rules`, `callers`, `aggregate`, `dependsOn`, `useCases`) проверяет `bun run arch:check` (`package.json:45`): MAN-02 (`def-checker.test.ts:192`), MAN-06 (`:229`), MAN-13 (`:291`), MAN-08 (`:324`), ERR-04 (`:425`). Переходы с отказами (MAN-12) закрыты типом `RejectsComplete` (`node_modules/dmg-core/src/domain/aggregate/aggregate-def.types.ts:37`): Def, где `rejects` не покрывает статус вне `from`, не компилируется (пример — `aggregate.test.ts:223` с `@ts-expect-error`).

**Признак поиска.** `grep -rln "normalize(\|ArchChecker" --include=*.test.ts domain/src/stream`

**Примеры.** `stream/uc/stream.uc-defs.test.ts:35`, `:120` (×3 UC), `student/uc/student.uc-defs.test.ts:25`, `:81`, `:180`, `stream.module.student.test.ts:53`.

**Что делать.** Удалить паспортные `it` в обоих `*.uc-defs.test.ts` (37 из 42 объявлений — паспорта и схемы). Оставить на модуль **один** тест состава (`stream.module.student.test.ts:47`, «17 UC»), он ловит «UC не добавлен в модуль», чего `arch:check` не видит.

### З2. Проверка схемы платформы, а не модуля — 34 случая

`safeParse`/`v.parse(` в тестах области — 72 вхождения. Возражение то же, что в `wish.md`: приём/отказ `F.uuid`/`F.picklist` — поведение валибола, оно покрыто `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` (`INPUT_VALIDATION`) и `:264` (`OUTPUT_VALIDATION`). Чужой контракт (снимок контента) — у владельца: `domain/src/course/content-snapshot.test.ts:63,74,90`.

**Признак поиска.** `grep -rn "safeParse\|v\.parse(" --include=*.test.ts domain/src/stream`

**Примеры.** `stream/uc/stream.uc-defs.test.ts:93` («выход — `{ streamId }`»), `student/uc/student.uc-defs.test.ts:152` («выход пуст»), `stream/stream.state.test.ts:117` (7 отказов «без обязательного поля»), `stream/uc/get-stream-members.roster.test.ts:41`.

**Что делать.** В `*.state.test.ts` — свести к одной таблице «валидное/невалидное» на схему состояния (единственная схема, которая парсит файл на каждом чтении, D-36). В `*.uc-defs.test.ts` — удалить.

### З3. Тест константы и состава контракта — 13 случаев

Перечни статусов/переходов/событий, FQN, списки кодов ошибок, тексты `label`. FQN при этом **обеспечен потребителями**: литералы `'stream.student.enrolled'`, `'stream.stream.created'` стоят в подписках чужих ER (`domain/src/wish/wish/er/fulfill-wish.er.test.ts:9`, `domain/src/peer-review/review-campaign/er/create-student-campaign.er.test.ts:15`), их тесты падают при смене FQN. Состав ошибок — ERR-04 (`def-checker.test.ts:425`), `kind` — тестами переходов (`stream/stream.ar.test.ts:142`).

**Примеры.** `stream/stream.ar.test.ts:38`, `:52`, `student/student.ar.test.ts:41`, `:52`, `student/student.events.test.ts:37`, `stream.module.test.ts:29` (есть в З9), `inactivity-sweep.job.test.ts:23` (публикуемые события — MAN-06, «событие никто не публикует»).

**Что делать.** Удалить; тексты `label` (`stream.errors.test.ts:31,35,46`, `student.errors.test.ts:33`) — свести в один тест «тексты группы» на модуль, если решим, что тексты вообще надо закреплять.

### З4. Проверка того, что уже проверено ArchChecker или владельцем контракта — 7 случаев

Три вида, как в `wish.md`: (1) чужой контракт (`ContentSnapshotVo` — собственность `course`); (2) `MAN-02` описания; (3) правило → ошибка (ERR-02).

**Примеры.** `content-snapshot-import.test.ts:10`, `:14`, `stream/stream.state.test.ts:137` (MAN-02 — `def-checker.test.ts:192`), `stream/stream.rules.test.ts:30` (ERR-02 — `def-checker.test.ts:425`), `student/student.events.test.ts:14` (MAN-08 — `def-checker.test.ts:324`). Списки кодов и тексты ошибок (`stream/stream.errors.test.ts:12`, `student/student.errors.test.ts:9`) отнесены к З3: их ловит ERR-04 (`def-checker.test.ts:425,456`), но проверка там про префикс и уникальность, а не про текст — поэтому это не дубль, а константа.

**Как появляется.** Комментарий шапки `content-snapshot-import.test.ts:5-6` говорит прямо: «Index потока больше не реэкспортирует схему снимка курса — те же два сценария проверяются на поле `contentSnapshot` состояния потока». Тест переехал, а потребность в нём отпала: снимок контента в состоянии потока уже покрыт `stream/stream.state.test.ts:98` (мусор в снимке → отказ).

### З5. Правило/разбор проверены уровнем ниже — 6 случаев

Тот же разбор legacy-записей в трёх местах: схема состояния (`*.state.test.ts`), `Ar.restore` (`*.ar.test.ts:106`) и репозиторий модуля (`modules/stream/src/infra/*.json-repo.test.ts`). Файл читается репозиторием, репозиторий зовёт `restore`, `restore` применяет ту же схему — ветка одна.

**Признак поиска.** `grep -rn "ISO-даты\|legacy updatedAt\|sentAt" --include=*.test.ts domain/src/stream modules/stream/src/infra`

**Примеры и где покрыто.** `stream/stream.state.test.ts:27` ≙ `modules/stream/src/infra/stream.json-repo.test.ts:164`; `student/student.state.test.ts:31,42` ≙ `student.json-repo.test.ts:133`; `:54` и `:89` (completionDetails) ≙ `student.json-repo.test.ts:152`; `stream.ar.test.ts:106` (тот же ISO в `restore`) ≙ `stream.json-repo.test.ts:164`.

**Что делать.** Удалить доменные копии, оставить репозиторные: они читают настоящий файл и проверяют запись после перехода (`stream.json-repo.test.ts:180`). Исключение — `student/student.state.test.ts:66` (legacy `updatedAt` с зоной): этого класса входа в репозиторных фикстурах нет.

### З6. Копия соседнего теста без нового класса входа — 22 случая

Здесь же — `it.each`, навешенный на параметр, который проверяемый код не читает (в `wish.md` это одна из форм З6): статус в строке права (`stream/stream.policy.test.ts:88`), комбинации `who`/`cause`, которых Ar не производит (`student/student.events.fate.test.ts:55` — Ar даёт `self/voluntary` и `mentor/inactivity|by_mentor`, а `self+inactivity` в схеме валиден, но кодом не создаётся).

**Признак поиска.** `grep -rn "на право не влияет\|принимается\|не меняется" --include=*.test.ts domain/src/stream`

**Примеры.** `stream/stream.ar.test.ts:186` (полный цикл из трёх уже покрытых переходов), `:257` (вторая ветка того же тернарника, что `:251`), `student/student.ar.test.ts:571` (сброс `notices` уже проверен `:95`), `:421` (категории уже проверены таблицей `:316`), `student/student.uc-defs.test.ts:49` (порядок правил — дубль `student.rules.test.ts:36`), `stream/uc/stream.uc-defs.test.ts:148` (дубль `:133`).

### З7. Тавтология, однострочный геттер, недостижимое состояние — 7 случаев

**Примеры.** `stream/stream.state.test.ts:46` (числа → числа, `version: 3` → `version: 3`), `:85` («без `enrollmentKey` ключа нет» — про `undefined` в объекте), `stream/stream.ar.test.ts:263` (view = state «как есть», кроме одного поля), `stream.ar.test.ts:94` (то же, что `:263`, другим способом), `stream/uc/get-stream-members.roster.test.ts:20` (parse вернул то, что вложили), `:74` («старые поля остались» — `toEqual` того же объекта), `student/student.state.test.ts:73` (запись нового формата = она же).

**Почему бесполезен.** Преобразования нет — значение проходит насквозь; ошибка в коде не исказит его.

### З8. Поведение платформы — 2 случая

`stream/stream.ar.test.ts:121` («восстановленный поток событий не имеет») ≙ `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:248`; `student/student.ar.test.ts:431` («view — копия») ≙ `:272` (`describe('view (D-44)')`).

Отличие от `wish.md`: тесты Policy «без субъекта» (`stream/stream.policy.test.ts:44,84`, `student/student.policy.test.ts:50,85`) **не** отнесены к З8 — в `wish.md` такой тест признан полезным (3/3 в `wish.policy.test.ts`), и я не меняю уже принятую оценку без решения по конвенции. Платформенный `policy.test.ts:36` его, тем не менее, покрывает полностью.

---

### З9. Устаревший файл-двойник после замены — 5 случаев

**Что это.** Файл тестов модуля заменили новым (комментарий в новом прямо говорит «Заменяет ожидания `stream.module.def.test.ts`»), но старый файл не удалили — и в нём остались те же четыре проверки, что в новом.

**Признак поиска.**
```bash
grep -rn "Заменяет ожидания\|проверяется в stream.module.student" --include=*.test.ts domain/src/stream
```

**Почему бесполезен.** `stream.module.test.ts` целиком ⊆ `stream.module.student.test.ts`:
`:15` ≙ `:34`+`:38` (тот же `toMatchObject`, плюс в `:15` лишний `external`), `:25` ≙ `:53` (тот же `ArchChecker.defsOf([StreamModuleDef])`), `:29` и `:38` — FQN/payload событий (З3, покрыто потребителями FQN + `student.ar.test.ts:80`, `stream.ar.test.ts:69`). Пятый случай той же природы — `inactivity-sweep.job.test.ts:32`: тест сам пишет «проверяется в `stream.module.student.test.ts`» и повторяет `jobs: ['inactivitySweep']` оттуда.

**Примеры.** `stream.module.test.ts:15`, `:25`, `:29`, `:38`, `student/job/inactivity-sweep.job.test.ts:32`.

**Как появляется.** Срез `student` дописал `stream.module.student.test.ts` и удалил `stream.module.def.test.ts` (git: `51e64473`), но `stream.module.test.ts` от среза `stream` остался. Тот же механизм дал и `content-snapshot-import.test.ts` — файл-«переезд», который больше ничего не проверяет.

**Что делать.** Удалить `stream.module.test.ts` целиком; `inactivity-sweep.job.test.ts:32` удалить (состав модуля остаётся в `stream.module.student.test.ts:38`).

### З10. Один UC тестируется в двух-трёх файлах — 9 случаев

**Что это.** `getStreamMembers` покрыт тремя файлами: `stream/uc/get-stream-members.uc.test.ts`, `stream/uc/get-stream-members.roster.test.ts` и блок в `stream/uc/stream.uc-defs.test.ts`; `getStreamPresence` — двумя (`get-stream-presence.uc.test.ts` + блок в `stream.uc-defs.test.ts`). Проверки не дополняют друг друга, а повторяют:

| Пара | Что повторяет |
|---|---|
| `get-stream-members.uc.test.ts:22` | паспорт ≙ `stream.uc-defs.test.ts:257` |
| `get-stream-members.uc.test.ts:39` (×5 статусов) | `stream.uc-defs.test.ts:276` (тот же `it.each` по той же схеме) |
| `get-stream-members.uc.test.ts:50`, `:66` | `stream.uc-defs.test.ts:284` (то же «мусор отклоняется / `undefined` — валиден») |
| `get-stream-presence.uc.test.ts:9`, `:26` | `stream.uc-defs.test.ts:302` |
| `stream.uc-defs.test.ts:214` | `stream.uc-defs.test.ts:174` (та же схема `listStreams.output`, та же утечка `enrollmentKey`) |
| `stream.uc-defs.test.ts:257`, `:276`, `:302` | первая половина пар выше |

**Признак поиска.** `grep -rn "GetStreamMembersUcDef\|GetStreamPresenceUcDef" --include=*.test.ts domain/src/stream`

**Почему бесполезен.** Правило одно, файлов два-три: правка схемы требует правки в двух местах, защиты не прибавляется. Отдельный `roster.test.ts` появился под расширение выхода (п. 3 spec, решение 11), но и он весь — схемный: `:20`,`:41`,`:59` проверяют `RosterEntryVo` (З2), `:74` — тавтология (З7).

**Как появляется.** Расширение контракта срезом: к готовому `*.uc-defs.test.ts` дописывают отдельный файл «на новое поле», вместо правки существующего.

**Что делать.** Оставить в `domain` **ни одного**: выход `getStreamMembers` и `getStreamPresence` — схемы платформы (З2), а поведение (`roster`, `neverStarted`, `inProgress`) проверяется там, где считается — `stream-members.dqs.test.ts:45,86` и `modules/stream/src/stream/uc/stream-students.uc.test.ts:167`. Файлы `get-stream-members*.test.ts` и `get-stream-presence.uc.test.ts` удалить целиком (12 объявлений, 18 кейсов), блоки `:257`–`:284`, `:302` в `stream.uc-defs.test.ts` — тоже.

### З11. Проверка состава реэкспорта строковыми ключами — 1 случай

**Что это.** `stream.module.student.test.ts:57` перебирает 10 имён и проверяет `name in contract === true`.

**Почему бесполезен.** Если имя кто-то использует — его удаление ломает `tsc` у потребителя (`platform/app/src/u7-app.ts:35`, `domain/src/peer-review/review-campaign/er/create-student-campaign.er.ts:4`, `domain/src/wish/wish/er/invite-wishers.er.ts:8`): сборка красная без теста. Если имя никто не использует — его удаление ничего не ломает, и тест защищает пустоту. Третьего варианта нет.

**Как появляется.** Паспорт модуля дописали «до кучи» рядом с проверкой D-45 (`:74`), которая как раз нужна: она охраняет обратное — что `contract` **не** светит внутренности (Ar, DQS, DCS).

**Что делать.** Удалить `:57`; `:47` и `:74` оставить — они в файле единственные полезные.

### З12. Метод агрегата проверен дважды: своим тестом и покрытым потребителем — 7 случаев

**Что это.** Вопрос Ar (`isOwnedBy`, `belongsToStream`, `hasNoSteps`, `moduleId`, `acceptsEnrollmentKey`, `isMentoredBy`) тестируется отдельным `it`, хотя его единственный потребитель покрыт своим тестом, и на этом потребителе инверсия ответа сразу видна. Зеркало З5 (там копия наверху, здесь — внизу).

**Признак поиска.**
```bash
grep -rn "isOwnedBy\|belongsToStream\|hasNoSteps\|moduleId()\|acceptsEnrollmentKey\|isMentoredBy" --include=*.test.ts domain/src/stream
```

**Почему бесполезен.** Для каждой пары «метод → потребитель» тест потребителя падает при ошибке в методе:

| Тест метода | Кто им пользуется | Где покрыто |
|---|---|---|
| `stream/stream.ar.student.test.ts:40` | `passed-modules.dqs.ts:28` | `passed-modules.dqs.test.ts:30` (вернул бы не тот модуль) |
| `:46`, `:51`, `:57` (`acceptsEnrollmentKey`) | `student.rules.ts:26` | `student.rules.test.ts:58,65,75` |
| `stream/stream.ar.test.ts:197` (`isMentoredBy`) | `stream.policy.ts:23`, `student.policy.ts:31` | `stream.policy.test.ts:50,54`, `student.policy.test.ts:63,71` |
| `student/student.ar.test.ts:308` (`isOwnedBy`) | `student.policy.ts:22` | `student.policy.test.ts:26,38` |
| `student/student.ar.test.ts:308` (`belongsToStream`) | `stream-members.dqs.ts:70`, `passed-modules.dqs.ts:26` | `stream-members.dqs.test.ts:45,86`, `passed-modules.dqs.test.ts:30` |
| `student/student.ar.test.ts:334` (`hasNoSteps`) | `stream-launch.dcs.ts:46` | `stream-launch.dcs.test.ts:42,51,66` |

Отдельно замечу `belongsToStream(OTHER_USER)` в `student.ar.test.ts:313` — в `belongsToStream` передаётся `userId`, тест проходит случайно («не равно» на любом чужом uuid).

**Как появляется.** Перенос `a-root.test.ts`: там вопросы Ar были самостоятельным слоем, тесты переехали 1:1, хотя потребители уже покрыты.

**Что делать.** Удалить все 7. `student.ar.test.ts:316` (таблица `outcomeCategory`/`isInProgress`/`isEnrolled`/`isTerminal`/`isPassed`) оставить — это единственное место, где закреплена таблица исходов, её потребители проверяют лишь по одному значению.

### З13. Пустой вход → пустой результат — 6 случаев

**Что это.** «Студентов нет — пусто», «записей нет — `[]`», «потоков нет — `[]`», «студентов нет — `Ok` с пустым списком», «пустой список студентов — ok».

**Признак поиска.** `grep -rn "студентов нет\|записей нет\|потоков нет\|пустой список" --include=*.test.ts domain/src/stream`

**Почему бесполезен.** `students.filter(...).map(...)` на пустом массиве даёт `[]` при любой реализации, кроме той, что бросает исключение на пустом входе; такой код падал бы на каждом первом зачислении и был бы пойман на верхнем уровне (`modules/stream/src/stream/uc/stream-students.uc.test.ts:125` — «студентов нет — завершён»). Для правил (`stream/stream.rules.test.ts:47`) то же: `pending.length === 0` — свойство языка.

**Примеры.** `stream-members.dqs.test.ts:71`, `:82`, `passed-modules.dqs.test.ts:69`, `:73`, `stream-launch.dcs.test.ts:97`, `stream/stream.rules.test.ts:47`.

**Как появляется.** TDD по таблице случаев из legacy: переносится и «граница пустого», хотя она не про домен.

**Что делать.** Удалить 6; «пустой вход» оставить только там, где он реально ломает расчёт — `student-progress.dqs.test.ts:94` (`0/0` → `percent: 0` вместо `NaN`), он оставлен полезным.

### З14. Тест неиспользуемого экспорта под мёртвым кодом — 2 случая

**Что это.** `status.test.ts:13`, `:28` проверяют `StreamStatusSchema` — схему, которую **никто** не импортирует.

**Признак поиска.**
```bash
grep -rn "StreamStatusSchema\|StudentStatusSchema\|StudentOutcomeCategorySchema\|CompletionSignSchema\|AbandonSignSchema" --include=*.ts . | grep -v node_modules
```

**Почему бесполезен.** Схема не вызывается ни в проде, ни в тестах, кроме своего. Это не «тест плохой» — это мёртвый код под тестом: `status.ts` объявляет 6 экспортов, из которых используется один (`StreamStatus` — сравнения статусов в стори бота, `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.ts:57`). `StudentStatus`, `StudentOutcomeCategory`, `CompletionSign`, `AbandonSign` и все пять схем не используются нигде: перечисления вытеснены literal-union'ами схем состояния и `OutcomeCategoryVo` в `student.types.ts`.

**Как появляется.** Legacy-фасад `index` отдавал эти типы наружу; при переходе на Def их оставили «на всякий случай» вместе с тестами на схемы.

**Что делать.** Тесты удалить. Мёртвые экспорты — отдельная задача (не в этом треке): живой из них только `StreamStatus`, и тест `status.test.ts:6` («значения enum совпадают со строками в файлах») полезен — при расхождении `s.status === StreamStatus.ACTIVE` в стори молча перестанет совпадать с данными, где лежит `'active'`.

---

## Кандидаты

Только «сомнителен» и «пуст», 139 строк. Пути — от корня репозитория; `…:` — продолжение предыдущего файла. Оценка «полезен» — в разделе «Полезные тесты».

Легенда: **[П ×N]** — одно объявление `it.each`/`describe.each`, кейсов в `bun test` больше, чем строк в таблице.

### `stream/uc/` — паспорт и схемы (З1, З2, З10)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `domain/src/stream/stream/uc/stream.uc-defs.test.ts:35` | CreateStream: command, calls, ошибки, событие, policy | З1 | `arch:check` (MAN-05/06, ERR-02) + `modules/stream/src/stream/uc/create-stream.uc.test.ts` | удалить |
| `…:55` | вход: обязательные поля без mentorId/schoolId/status | З2 | там же (реальный вызов шлёт ровно эти поля) | удалить |
| `…:74` | вход: необязательные поля принимаются | З2 | `stream/stream.state.test.ts:69` (та же схема, другое поле) | удалить |
| `…:93` | выход — `{ streamId }` | З2 | `use-case-from-def.test.ts:264` (OUTPUT_VALIDATION) | удалить |
| `…:120` `[П ×3]` | 3 command: policy canManage, ошибки, без событий | З1 | `arch:check` + `modules/stream/src/stream/uc/manage-stream.uc.test.ts` | удалить |
| `…:133` `[П ×3]` | правила трёх command | З1 | ERR-02 (`def-checker.test.ts:425`) | удалить |
| `…:137` `[П ×3]` | вход `{ streamId }`, выход пуст | З2 | `use-case-from-def.test.ts:264` | удалить |
| `…:148` | rules: `[studentsSettled]` | З6 | `:133` (тот же массив) | удалить (дубль) |
| `…:156` | GetStream: query, allowAll, NOT_FOUND | З1 | `arch:check` + `modules/stream/src/stream/uc/read-stream.uc.test.ts` | удалить |
| `…:167` | вход `{ streamId }` | З2 | `use-case-from-def.test.ts:130` | удалить |
| `…:192` | ListStreams: query, allowAll, без ошибок | З1 | `arch:check` | удалить |
| `…:203` | вход: фильтры необязательны | З2 | `modules/stream/src/stream/uc/read-stream.uc.test.ts` (реальные фильтры) | удалить |
| `…:214` | выход — массив без enrollmentKey | З10 | `:174` (та же схема) | удалить |
| `…:225` | FindStream: query, allowAll | З1 | `arch:check` | удалить |
| `…:245` | выход — вид или `undefined` | З2 | `:236` (тот же вид) | удалить |
| `…:257` | members: query system/user/guest, allowAll | З10 | `get-stream-members.uc.test.ts:22` (тот же `normalize`) | удалить |
| `…:276` `[П ×5]` | members: 5 статусов студента | З10 | `get-stream-members.uc.test.ts:39` (тот же `it.each`) | удалить |
| `…:284` | members: без studentId/inProgress — отказ | З2 | `use-case-from-def.test.ts:264` | удалить |
| `…:302` | presence: query system, `{ exists }` | З10 | `get-stream-presence.uc.test.ts:9` | удалить |
| `domain/src/stream/stream/uc/get-stream-members.uc.test.ts:22` | паспорт UC | З10 | `stream/uc/stream.uc-defs.test.ts:257` | удалить файл целиком (5 объявлений / 9 кейсов) |
| `…:33` | вход — uuid потока | З2 | `use-case-from-def.test.ts:130` | туда же |
| `…:39` `[П ×5]` | выход: 5 статусов | З10 | `stream/uc/stream.uc-defs.test.ts:276` | туда же |
| `…:50` | выход: пустой состав валиден, чужой статус отклонён | З10 | `stream/uc/stream.uc-defs.test.ts:284` | туда же |
| `…:66` | «нет потока» — `undefined`, не ошибка | З10 | `stream/uc/stream.uc-defs.test.ts:284` | туда же |
| `domain/src/stream/stream/uc/get-stream-presence.uc.test.ts:9` | паспорт UC | З10 | `stream/uc/stream.uc-defs.test.ts:302` | удалить файл целиком (3 объявления / 3 кейса) |
| `…:20` | вход — uuid потока | З2 | `use-case-from-def.test.ts:130` | туда же |
| `…:26` | выход — `{ exists }` | З2 | `stream/uc/stream.uc-defs.test.ts:302` | туда же |
| `domain/src/stream/stream/uc/get-stream-members.roster.test.ts:20` | roster сохраняется в разборе | З7 | — (тавтология: parse вернул вложенное) | удалить файл целиком (4 объявления / 6 кейсов); `roster` покрыт `stream-members.dqs.test.ts:86` |
| `…:41` `[П ×3]` | 3 уровня отставания допустимы | З2 | `use-case-from-def.test.ts:130` | туда же |
| `…:59` | чужой уровень отставания отклонён | З2 | `use-case-from-def.test.ts:264` | туда же |
| `…:74` | старые поля состава остались | З7 | `stream/uc/stream.uc-defs.test.ts:276` | туда же |

### `student/uc/` — паспорт и схемы (З1, З2, З6)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `domain/src/stream/student/uc/student.uc-defs.test.ts:25` | EnrollStudent: command, calls, событие, allowAll | З1 | `arch:check` + `modules/stream/src/student/uc/enroll-student.uc.test.ts:48` | удалить |
| `…:37` | ошибки: 5 кодов | З1 | ERR-02 (`def-checker.test.ts:425`) + `enroll-student.uc.test.ts:123,131,145,164` | удалить |
| `…:49` | правила зачисления в порядке legacy | З6 | `student/student.rules.test.ts:36` + `enroll-student.uc.test.ts:170` (тот же порядок поведением) | удалить (дубль) |
| `…:72` | выход — `{ studentId }` | З2 | `use-case-from-def.test.ts:264` | удалить |
| `…:81` | CompleteStep: command, policy isSelf, ошибки | З1 | `arch:check` + `modules/stream/src/student/uc/complete-step.uc.test.ts` | удалить |
| `…:100` | вход `{ studentId, streamId, stepId }` | З2 | `complete-step.uc.test.ts:113` (реальный вызов) | удалить |
| `…:106` `[П ×5]` | 5 уровней выхода допустимы | З2 | `step-completion.dcs.test.ts:65–95` (все пять уровней поведением) | удалить |
| `…:116` | чужой уровень и неполный lesson — отказ | З2 | `use-case-from-def.test.ts:264` | удалить |
| `…:125` | CompleteStudent: command, policy, событие, ошибки | З1 | `arch:check` + `modules/stream/src/student/uc/complete-student.uc.test.ts` | удалить |
| `…:152` | выход пуст | З2 | `use-case-from-def.test.ts:264` | удалить |
| `…:158` | DropStudent: command, policy isSelf, событие | З1 | `arch:check` + `modules/stream/src/student/uc/drop-student.uc.test.ts` | удалить |
| `…:172` | вход/выход | З2 | `drop-student.uc.test.ts` (реальный вызов) | удалить |
| `…:180` | MarkAbandoned: command, policy, событие | З1 | `arch:check` + `modules/stream/src/student/uc/mark-abandoned.uc.test.ts` | удалить |
| `…:211` | getStudentByUser: паспорт + вход + выход | З1 | `arch:check` + `get-student-by-user.uc.test.ts` | удалить |
| `…:226` | getStudentProgress: паспорт | З1 | `arch:check` + `get-student-progress.uc.test.ts:53` | удалить |
| `…:237` | вход: stepId/lessonId необязательны | З2 | `get-student-progress.uc.test.ts:75` | удалить |
| `…:246` | выход — студент и необязательный progress | З2 | `get-student-progress.uc.test.ts:53,91` | удалить |
| `…:252` | getActiveStudent: паспорт + вход/выход | З1 | `arch:check` + `get-active-student.uc.test.ts` | удалить |

### `stream/` — агрегат, состояние, права, правила (З3–З8, З12)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `domain/src/stream/stream/stream.ar.test.ts:38` | четыре статуса и три перехода | З3 | `aggregate.test.ts:179,200,215`; полнота `rejects` — тип `RejectsComplete` (`aggregate-def.types.ts:37`) | удалить |
| `…:52` | события агрегата — только `created` | З3 | `aggregate.test.ts:179` + MAN-06 | удалить |
| `…:69` | событие created `{ streamId, moduleId }` | З3 | `domain/src/wish/wish/er/invite-wishers.er.test.ts:9` (FQN-литерал потребителя) + `modules/wish/src/wish/er/invite-wishers.er.test.ts:415` | удалить |
| `…:94` | без `enrollmentKey` ключа в state нет | З7 | `stream/stream.state.test.ts:85` (там же, где решается) | удалить |
| `…:99` | снимок контента сохраняется как есть | З6 | `:58` (`toEqual` включает `contentSnapshot`) | удалить |
| `…:106` | legacy-запись: ISO, без version/updatedAt | З5 | `modules/stream/src/infra/stream.json-repo.test.ts:164` | удалить |
| `…:121` | восстановленный поток событий не имеет | З8 | `aggregate.test.ts:248` | удалить |
| `…:186` | полный цикл enrollment → … → archived | З6 | `:127`, `:149`, `:167` (каждый переход) | удалить |
| `…:197` | `isMentoredBy` | З12 | `stream.policy.test.ts:50,54` | удалить |
| `…:257` | `requiresEnrollmentKey = false` | З6 | `:251` (вторая ветка того же тернарника) | объединить с `:251` |
| `…:263` | остальные поля state — как есть | З7 | — (тавтология копирования) | удалить |
| `domain/src/stream/stream/stream.state.test.ts:27` | ISO-даты → числа, updatedAt = createdAt, version 0 | З5 | `modules/stream/src/infra/stream.json-repo.test.ts:164` | удалить |
| `…:46` | запись нового формата проходит как есть | З7 | — (числа → числа) | удалить |
| `…:62` | снимок контента сохраняется | З4 | `domain/src/course/content-snapshot.test.ts:74` + `stream.ar.test.ts:58` | удалить |
| `…:69` | принимает все необязательные поля | З6 | `stream.ar.test.ts:77` (то же через `create`) | удалить (оставить `:69`) |
| `…:85` | без `enrollmentKey` ключа в результате нет | З7 | `stream.ar.test.ts:94` (дубль) | удалить (оставить `:85`) |
| `…:117` `[П ×7]` | отказ без обязательного поля | З2 | `use-case-from-def.test.ts:130` + `aggregate.test.ts:257` | удалить |
| `…:130` `[П ×4]` | принимает статус %s | З2 | `:27` (тот же разбор с `enrollment`) | удалить |
| `…:137` | у каждого поля есть описание (MAN-02) | З4 | `def-checker.test.ts:192` | удалить |
| `domain/src/stream/stream/stream.errors.test.ts:12` | шесть ошибок группы STREAM | З3 | ERR-04 (`def-checker.test.ts:425,456`) + `kind` в `stream.ar.test.ts:142,161` | удалить |
| `…:31` | текст «Поток не найден» | З3 | — (текст-константа) | объединить `:31`,`:35`,`:46` в один тест «тексты группы» |
| `…:35` | тексты архива | З3 | — | туда же |
| `…:46` | студенты ещё учатся: начало и конец текста | З3 | — | туда же |
| `…:54` | NOT_FOUND: payload `{ streamId }` | З2 | `use-case-from-def.test.ts:264` | удалить |
| `…:61` | STUDENTS_IN_PROGRESS: список `{ userId, status }` | З2 | `stream.rules.test.ts:51,64,74` (payload из кода) | удалить |
| `domain/src/stream/stream/stream.rules.test.ts:30` | описание правила ссылается на ошибку | З4 | ERR-02 (`def-checker.test.ts:425`) | удалить |
| `…:47` | пустой список студентов — ok | З13 | — (свойство `length === 0`) | удалить |
| `domain/src/stream/stream/stream.policy.test.ts:21` | ментор и админ одновременно — allowed | З6 | `:17` (тот же исход, роль админа не читается) | удалить |
| `…:72` | студент — denied | З6 | `:64` (чужой ментор → denied, та же ветка) | объединить с `:64` |
| `…:78` | гость (роль GUEST) — denied | З6 | `:64` | туда же |
| `…:88` | статус потока на право не влияет | З6 | `:50` (право от статуса не зависит по построению — `isMentoredBy`) | удалить |
| `domain/src/stream/stream/stream.ar.student.test.ts:40` | `moduleId` | З12 | `passed-modules.dqs.test.ts:30` | удалить |
| `…:46` | ключа у потока нет — true | З12 | `student.rules.test.ts:58` | удалить |
| `…:51` | ключ совпал — true | З12 | `student.rules.test.ts:65` | удалить |
| `…:57` `[П ×4]` | ключ задан, ввод неверный — false | З12 | `student.rules.test.ts:75` | удалить |

### `student/` — агрегат, состояние, права, правила, ошибки, события (З2–З7, З12)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `domain/src/stream/student/student.ar.test.ts:41` | пять статусов и пять переходов | З3 | `aggregate.test.ts:179,200,215`; полнота `rejects` — тип `RejectsComplete` | удалить |
| `…:52` | события агрегата — пять | З3 | `aggregate.test.ts:179` + MAN-06 | удалить |
| `…:80` | событие enrolled `{…}` — единственное | З2 | `modules/stream/src/student/uc/enroll-student.uc.test.ts:62` | удалить |
| `…:308` | `isOwnedBy` / `belongsToStream` | З12 | `student.policy.test.ts:26`; `stream-members.dqs.test.ts:45`; `passed-modules.dqs.test.ts:30` | удалить |
| `…:334` | `hasNoSteps` | З12 | `stream-launch.dcs.test.ts:42,51,66` | удалить |
| `…:421` | учащийся: inProgress, не passed | З6 | `:316` (та же таблица) + `:397` | объединить с `:397` |
| `…:431` | копия: правка вида не меняет агрегат | З8 | `aggregate.test.ts:272` | удалить |
| `…:571` | activate сбрасывает цепочку | З6 | `:95` (`activate` → `notices` пусты) | удалить |
| `domain/src/stream/student/student.state.test.ts:31` | ISO-даты → числа | З5 | `modules/stream/src/infra/student.json-repo.test.ts:133` | удалить |
| `…:42` | даты шагов — числа | З5 | `student.json-repo.test.ts:133` | удалить |
| `…:54` | sentAt до минуты → число | З5 | `student.json-repo.test.ts:152` | удалить |
| `…:73` | запись нового формата как есть | З7 | — (числа → числа) | удалить |
| `…:89` | completionDetails и abandonDetails сохраняются | З5 | `student.json-repo.test.ts:152`; `student.ar.test.ts:125` | удалить |
| `…:139` `[П ×5]` | статус %s допустим | З2 | `:31` (тот же разбор с `active`) | удалить |
| `domain/src/stream/student/student.policy.test.ts:77` | сам студент — denied | З6 | `:71` (чужой ментор → denied, та же ветка) | удалить |
| `…:81` | роль GUEST — denied | З6 | `:71` | туда же |
| `…:89` | статус студента на право не влияет | З6 | `:63` (право от статуса не зависит) | удалить |
| `domain/src/stream/student/student.rules.test.ts:36` | четыре правила в порядке legacy | З6 | `modules/stream/src/student/uc/enroll-student.uc.test.ts:170` (порядок поведением) | удалить |
| `…:45` | правила ссылаются на ошибки STUDENT_* | З4 | ERR-02 (`def-checker.test.ts:425`) | удалить |
| `domain/src/stream/student/student.errors.test.ts:9` | одиннадцать ошибок группы STUDENT | З3 | ERR-04 (`def-checker.test.ts:425,456`) | удалить |
| `…:33` `[П ×9]` | 9 текстов, видимых пользователю | З3 | частично: `modules/stream/src/student/uc/complete-step.uc.test.ts:113` | объединить в один тест «тексты группы» или удалить |
| `…:61` | PREREQUISITE_NOT_PASSED несёт moduleTitle | З2 | `student.rules.test.ts:146,161` (payload из кода) | удалить |
| `domain/src/stream/student/student.events.test.ts:14` | FQN по MAN-08 | З4 | `def-checker.test.ts:324` (MAN-08) | удалить |
| `…:23` | inactivityWarning payload без telegramId | З2 | `student.ar.test.ts:451`; `runners/u7-bot/tests/e2e/inactivity.e2e.test.ts:111` | удалить |
| `…:30` | removeCandidate + wasWarned | З2 | `student.ar.test.ts:465,492` | удалить |
| `…:37` | три прежних события остались | З3 | `aggregate.test.ts:179` + MAN-06 | удалить |
| `domain/src/stream/student/student.events.fate.test.ts:15` | completed: FQN и payload | З2 | `student.ar.test.ts:187`; `modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts:133` | удалить файл целиком (5 объявлений / 7 кейсов) |
| `…:28` | отклоняет чужой outcome и payload без поля | З2 | `use-case-from-def.test.ts:264` | туда же |
| `…:48` | abandoned: FQN и payload без moduleId | З2 | `student.ar.test.ts:125`; `create-student-campaign.er.test.ts:148` | туда же |
| `…:55` `[П ×3]` | who/cause принимаются | З6 | `:59` — код производит только `self/voluntary` и `mentor/inactivity|by_mentor` (`student.ar.test.ts:125,163`) | туда же |
| `…:66` | отклоняет чужие who/cause | З2 | `use-case-from-def.test.ts:264` | туда же |

### Декомпозиция и модуль (З9, З10, З13, З14, З3)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `domain/src/stream/student-progress.dqs.test.ts:160` | невыданный шаг — locked | З6 | `:104` (все узлы locked) | удалить |
| `…:258` | шага нет — null | З6 | `:239` (неизвестный шаг — нулевой прогресс) | удалить |
| `…:312` | rowSummary без шагов — 0 %, времени нет | З6 | `:71` (progress) + `:291` (время) | объединить с `:320` |
| `domain/src/stream/stream-launch.dcs.test.ts:97` | студентов нет — Ok с пустым списком | З13 | `modules/stream/src/stream/uc/stream-students.uc.test.ts:46` | удалить |
| `domain/src/stream/stream-members.dqs.test.ts:71` | факты: студентов нет — пусто | З13 | — (свойство `filter/map`) | удалить |
| `…:82` | roster: студентов нет — пусто | З13 | — | удалить |
| `domain/src/stream/passed-modules.dqs.test.ts:48` `[П ×3]` | не пройден: 3 статуса | З6 | `:39` (not_advanced, та же ветка) | объединить с `:39` |
| `…:69` | записей нет — `[]` | З13 | — | удалить |
| `…:73` | потоков нет — `[]` | З13 | — | удалить |
| `…:98` | прошёл один модуль, второй не завершил | З6 | `:60` (тот же «только пройденный») | объединить с `:60` |
| `domain/src/stream/stream.module.test.ts:15` | паспорт: не внешний, dependsOn, агрегаты, jobs | З9 | `stream.module.student.test.ts:34,38` | удалить файл целиком (4 объявления / 4 кейса) |
| `…:25` | ArchChecker — без нарушений | З9 | `stream.module.student.test.ts:53` | туда же |
| `…:29` | StudentEvents.enrolled — FQN и payload | З9 | `modules/stream/src/student/uc/enroll-student.uc.test.ts:62` | туда же |
| `…:38` | StreamEvents.created — FQN и payload | З9 | `stream/stream.ar.test.ts:69` | туда же |
| `domain/src/stream/stream.module.student.test.ts:34` | модуль не внешний | З1 | MAN-06: у внешнего модуля не бывает Job (`def-checker.test.ts:229`) | удалить |
| `…:38` | паспорт: dependsOn, агрегаты, reactions, jobs | З1 | `platform/app/tests/u7-app.test.ts:338` (модуль в сборке) + `arch:check` | удалить |
| `…:53` | ArchChecker — без нарушений | З1 | `arch:check` (`package.json:45`) | удалить |
| `…:57` | контракт экспортирует 8 UC, ошибки, события | З11 | `tsc` у потребителей: `platform/app/src/u7-app.ts:35`, `domain/src/peer-review/review-campaign/er/create-student-campaign.er.ts:4` | удалить |
| `domain/src/stream/student/job/inactivity-sweep.job.test.ts:23` | публикует только 2 события бездействия | З3 | MAN-06 «событие никто не публикует» (`def-checker.test.ts:236`) | удалить |
| `…:32` | JobDef входит в паспорт модуля | З9 | `stream.module.student.test.ts:38` (сам тест на это и ссылается) | удалить |
| `domain/src/stream/status.test.ts:13` | StreamStatusSchema пропускает валидные | З14 | — (схема нигде не используется) | удалить |
| `…:28` | StreamStatusSchema отклоняет невалидные | З14 | — | удалить |
| `domain/src/stream/content-snapshot-import.test.ts:10` | схема доступна и валидирует пустой массив | З4 | `domain/src/course/content-snapshot.test.ts:74` | удалить файл целиком (2 объявления / 2 кейса) |
| `…:14` | схема отклоняет невалидные данные | З4 | `content-snapshot.test.ts:63` + `stream/stream.state.test.ts:98` | туда же |

---

## Полезные тесты

| Файл | Оценка |
|---|---|
| `step-completion.dcs.test.ts` | 11 из 11: все пять уровней, приоритет проверок («не в потоке» раньше «не выдан»), хвост расширенного снимка — ядро расчёта, аналогов в модуле нет. |
| `student-progress.dqs.test.ts` | 26 из 29: прогресс по снимку (в т.ч. частичному), `0/0` без `NaN`, навигация, границы времени (1/5/15 мин), медиана, «урок ищется по шагу, а не по заголовку» (`:219`) — единственное место этих расчётов. |
| `stream-members.dqs.test.ts` | 8 из 10: факты для правила, пороги отставания 4/7 суток, медиана только по учащимся (`:131`), терминальные всегда `on_track`. |
| `student/student.ar.test.ts` | 35 из 43: таблица исходов (`:316`), все пять переходов с отказами по статусам, `issueStep`/`completeStep` (включая «дубль не создаётся», `:287`), цепочки бездействия 5/7/2 дня и `sentAt` до минуты (`:532`), `outcomeSigns`, `view`. |
| `stream/stream.ar.test.ts` | 13 из 24: создание (поля, `createdAt`, version), переходы с отказами по статусам, `firstStepId` с пустыми уроками, `view` без утечки ключа. |
| `stream/stream.policy.test.ts` | 9 из 13: `canCreate` (роль MENTOR, админ без роли — отказ как в legacy), `canManage` (ментор потока по uuid, админ, чужой — отказ с текстом), без субъекта. |
| `student/student.policy.test.ts` | 8 из 11: `isSelf` (владелец с любой ролью, чужой с любой ролью), `canComplete`/`canMarkAbandoned` через `describe.each`, без субъекта. |
| `student/student.rules.test.ts` | 12 из 14: порядок «ключ → активная запись → допуск → нет шагов», «поток значения не имеет» (`:122`), вердикт курса `closed`/`previous-not-passed` с payload, пустой снимок. |
| `stream/stream.rules.test.ts` | 5 из 7: `pending` со всеми незавершёнными в порядке фактов, `enrolled` блокирует (дыра ФР-2), `settled` вместо названия статуса (`:93`). |
| `student/student.state.test.ts` | 2 из 8: таблица 11 отказов разбора (`:111`) и legacy `updatedAt` с зоной (`:66`) — остальное перекрыто репозиторием. |
| `stream/stream.state.test.ts` | 3 из 11: `trim` заголовка и описания, таблица отказов (`:98`), legacy `updatedAt` с зоной. |
| `student/student.errors.test.ts` | 1 из 4: «тексты переходов не содержат сырого статуса» (`:47`, Т10) — требование, а не константа. |
| `student/job/inactivity-sweep.job.test.ts` | 2 из 4: `name` + расписание 19:00 UTC (это и есть «00:00 Казахстана», ошибка в часе — реальная) и `scans: [student]`. |
| `stream.module.student.test.ts` | 2 из 6: `:47` — из модуля не выпал ни один из 17 UC (`arch:check` этого не видит), `:74` — `contract` не экспортирует Ar/DQS/DCS (D-45). |
| `status.test.ts` | 1 из 3: значения `StreamStatus` совпадают со строками данных — при расхождении стори бота (`stream-catalog.story.ts:57`) молча перестанут находить потоки. |
| `stream/stream.ar.student.test.ts` | 6 из 10: `stepPlace` — следующая ступень на всех границах (в т.ч. последний шаг потока и пустой снимок). |
| `stream-launch.dcs.test.ts` | 8 из 9: `enrolled → active` + первый шаг, «статус не учитывается» для ушедшего, «первого шага нет — поток всё равно активен». |
| `passed-modules.dqs.test.ts` | 5 из 9: `advanced` = пройден, чужой модуль, запись без своего потока, два прохождения одного модуля → один раз. |
| `stream/uc/stream.uc-defs.test.ts` | 2 из 21: `:174` — в выходе `getStream` нет `enrollmentKey` (утечка ключа набора в контракт — реальный сценарий), `:236` — `telegramGroupId` строкой (Т8). |
| `student/uc/student.uc-defs.test.ts` | 3 из 21: `:58` — вход не принимает `userId` (С3: иначе клиент зачислит кого угодно), `:143` — `outcome: 'abandoned'` не принимается, `:200` — `cause: 'voluntary'` не принимается в `markAbandoned`. |
| `stream/stream.errors.test.ts` | Полезных нет: состав ошибок — ERR-04 и тесты переходов, `label` — константы. |
| `student/student.events.test.ts` | Полезных нет: FQN — MAN-08, payload — `student.ar.test.ts`, состав — MAN-06. |
| `student/student.events.fate.test.ts` | Полезных нет: тот же шаблон «FQN + payload» для событий, которые уже покрыты Ar и ER `peer-review`. |
| `stream.module.test.ts` | Полезных нет: устаревший двойник `stream.module.student.test.ts` (З9). |
| `stream/uc/get-stream-members.uc.test.ts` | Полезных нет: паспорт и схемы, перекрытые `stream.uc-defs.test.ts` и `stream-members.dqs.test.ts`. |
| `stream/uc/get-stream-members.roster.test.ts` | Полезных нет: схемы `RosterEntryVo` и одна тавтология. |
| `stream/uc/get-stream-presence.uc.test.ts` | Полезных нет: паспорт и схема `{ exists }`, перекрытые `stream.uc-defs.test.ts:302`. |
| `content-snapshot-import.test.ts` | Полезных нет: чужой контракт `course`, покрыт у владельца и `stream.state.test.ts:98`. |

---

## Открытые вопросы (решает orchestrator, не этот отчёт)

1. **Двойники на прикладном уровне.** Почти каждый полезный доменный тест дублируется тестом модуля: `stream-launch.dcs.test.ts:42` ≙ `modules/stream/src/stream/uc/stream-students.uc.test.ts:46`, `stream-members.dqs.test.ts:45` ≙ `stream-students.uc.test.ts:167`, `student.rules.test.ts:58` ≙ `enroll-student.uc.test.ts:131`. По З5 половину этих пар надо снимать, но какая сторона «нижняя» — решает инвентаризация `modules/stream`, а не эта. Пока обе стороны считаются полезными (ошибку ловят обе).
2. **Мёртвый `status.ts`.** 5 из 6 экспортов (`StudentStatus`, `StudentOutcomeCategory`, `CompletionSign`, `AbandonSign` и все схемы) не используются нигде вне своих тестов. Удаление тестов (З14) оставит мёртвый код без покрытия — это отдельная задача трека, не чистка тестов.
3. **Тексты `label`.** Решить, закрепляем ли тексты тестами (`wish` — нет, там `wish.errors.test.ts` признан пустым). Если да — один тест на группу, а не по `it` на ошибку.
4. **`stream.module.student.test.ts:47` («17 UC»).** Формально попадает под З1 (тот же `normalize`, что и паспорт), но это единственная проверка «UC не выпал из модуля» (`arch:check` такого не видит: `ModuleFromDef` падает только на «Def без класса», не на «класса нет в модуле»). В таблице кандидатов его нет — оставлен полезным; если решим чистить по З1 буквально, это единственная строка в Сводке, которая поменяется (2 → 1).
5. **Граница полезного в `*.uc-defs.test.ts`.** После чистки от 42 объявлений останется 5 (`:174`, `:236`, С3/outcome/cause в student) — это уже не «паспорт», а «чего вход не принимает». Предлагаю перенести их в файл модуля (там реальный вызов) и удалить оба `*.uc-defs.test.ts` целиком.
6. **Совместимость с решениями `wish`.** Оценки «без субъекта» (З8) и «правило → ошибка» (З4) специально оставлены как в `wish.md`, чтобы конвенция не разъехалась; если решим иначе — правка одна и симметричная.
