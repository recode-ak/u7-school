# Удаление тестов домена `stream` — таблица

Трек `tst-cleanup_20261105`, фаза Ф2. Источник кандидатов — `inventory/stream-domain.md`
(301 объявление `it`/`test` в 28 файлах, из них 139 кандидатов на удаление/слияние).
Базовая линия: `cd domain && bun test src/stream` → **416 pass, 0 fail, 760 expect()**
(301 объявление, часть — `it.each`).

Пути в колонке «файл» — относительно `domain/src/stream/`. Колонка «где покрыто» —
путь от корня репо и **строка начала** конкретного `it(`/`test(`/`it.each(`, который
после этой таблицы остаётся (сам он этой таблицей не удаляется). «нигде» — только
для Б-9/Б-11/Б-12/Б-13, с объяснением, что именно тест мог бы поймать и почему
это не стоит отдельного теста.

Применённые решения (Б-ID — `conductor/roadmap/test-bloat.md` §2, TST —
`node_modules/dmg-core/docs/reference/testing.md`):

1. Б-8: приём/отказ полей платформы (`v.uuid`, `v.picklist`, `v.object`, «поле
   обязательно») не тестируются. Своя логика схемы (`transform`, `refine`, разбор
   файла) остаётся **одной** таблицей «валидно/невалидно» на схему — у `stream`/`student`
   это `stream.state.test.ts:98` и `student.state.test.ts:111` (получают строки из
   слитых тестов).
2. Б-7: паспорта Def (`command`/`query`, `calls`, `policy`, `errors`, `emits`,
   `rules`, состав модуля) удаляются. Состав модуля — **один** тест
   `stream.module.student.test.ts:47` (UC + ER/Job + `dependsOn`), он переписывается;
   остальные проверки состава/паспорта сливаются в него или удаляются.
3. TST-09: тексты `label` и `denyMessage` не тестируются — удаляются все, включая
   одиночные `expect` внутри полезных тестов (см. раздел «Остающиеся проверки `label`»).
4. Б-1: правило принадлежит владельцу (`Ar`/`DCS`/`DQS`/`Policy`); у UC остаётся один
   сквозной сценарий и только-UC-действия (`snapshot`, `saved`, `published`, ошибка UC).
5. `*.uc-defs.test.ts`: уцелевшие «чего вход не принимает» переносятся в тест модуля с
   реальным вызовом UC, после чего оба файла удаляются целиком.
6. Б-13: неиспользуемые экспорты `status.ts` — «отложить: удалить с кодом» (тесты и код
   удаляются одним срезом позже, сейчас не трогаем).
7. Бот: integration/e2e по `conductor/architecture/ui/bot-test.md` §2 п.5; красные из-за
   `course-dmg` (TR-57) — «отложить до course-dmg». Среди кандидатов домена `stream`
   таких строк нет (проверено по `stream-domain.md`).

## Таблица

| файл | строка | тест | Б | действие | где покрыто |
|---|---|---|---|---|---|
| content-snapshot-import.test.ts | 10 | схема доступна и валидирует пустой массив | Б-7 | удалить | `domain/src/course/content-snapshot.test.ts:77` (чужой контракт: пустой массив проходит) |
| content-snapshot-import.test.ts | 14 | схема отклоняет невалидные данные | Б-7 | удалить | `domain/src/course/content-snapshot.test.ts:57` (владелец отклоняет пустой заголовок проекта) |
| passed-modules.dqs.test.ts | 48 | it.each enrolled/active/abandoned — не «прошёл» | Б-6 | слить в passed-modules.dqs.test.ts:39 | — (кейсы переезжают в `it.each` у `:39`) |
| passed-modules.dqs.test.ts | 69 | записей нет — `[]` | Б-12 | удалить | «нигде»: `filter/map` по пустому массиву — свойство языка; ни одна ветка DQS не зависит от наличия записей |
| passed-modules.dqs.test.ts | 73 | потоков нет — `[]` | Б-12 | удалить | «нигде»: вторая проекция того же пустого входа, ветки нет |
| passed-modules.dqs.test.ts | 98 | прошёл один модуль, второй не завершил — только пройденный | Б-6 | слить в passed-modules.dqs.test.ts:60 | — (кейс «фильтр по модулю» переезжает в `:60`) |
| status.test.ts | 13 | `StreamStatusSchema` пропускает валидные значения | Б-13 | отложить: удалить с кодом | — (экспорт `StreamStatusSchema` не используется в проде, кроме `status.test.ts`) |
| status.test.ts | 28 | `StreamStatusSchema` отклоняет невалидные значения | Б-13 | отложить: удалить с кодом | — (тот же неиспользуемый экспорт; `picklist` — платформа) |
| stream-launch.dcs.test.ts | 97 | студентов нет — Ok с пустым списком | Б-12 | удалить | «нигде»: цикл по пустому `students`; ветки «нет студентов» в DCS нет (изменений — ноль) |
| stream-members.dqs.test.ts | 71 | `buildStreamMembers` — студентов нет, пусто | Б-12 | удалить | «нигде»: `map` по пустому массиву — свойство языка |
| stream-members.dqs.test.ts | 82 | `buildStreamRoster` — студентов нет, пусто | Б-12 | удалить | «нигде»: второй метод того же DQS на пустом входе, код общий |
| stream.module.student.test.ts | 34 | модуль не внешний | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:624` (у внешнего модуля нет ER и Job — `arch:check` ловит) |
| stream.module.student.test.ts | 38 | паспорт: `dependsOn` user и course, агрегаты, один Job | Б-5 | слить в stream.module.student.test.ts:47 | — (переезжает в тест состава) |
| stream.module.student.test.ts | 47 | 17 UC: девять потока и восемь студента | Б-5 | переписать | приёмник: сюда же `dependsOn`, агрегаты, ER/Job из `:38`, список UC — единственный тест состава |
| stream.module.student.test.ts | 53 | `ArchChecker` по модулю и зависимостям — без нарушений | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06; в `check` — `arch:check`) |
| stream.module.student.test.ts | 57 | контракт экспортирует Def восьми UC, ошибки, события и вид | Б-7 | удалить | `platform/app/tests/u7-app.student.test.ts:144` (UC студента идёт через API платформы; снятый экспорт ломает сборку) |
| stream.module.test.ts | 15 | паспорт: не внешний, `dependsOn`, агрегаты | Б-5 | удалить | `domain/src/stream/stream.module.student.test.ts:47` (единственный тест состава модуля) |
| stream.module.test.ts | 25 | `ArchChecker` по модулю и зависимостям | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` |
| stream.module.test.ts | 29 | `StudentEvents.enrolled` — FQN и payload контракта | Б-7 | удалить | `modules/stream/src/student/uc/enroll-student.uc.test.ts:62` (реальная публикация) |
| stream.module.test.ts | 38 | `StreamEvents.created` — FQN и payload контракта | Б-7 | удалить | `modules/stream/src/stream/uc/create-stream.uc.test.ts:97` (реальная публикация) + `node_modules/dmg-core/src/arch/def-checker.test.ts:325` (MAN-08) |
| stream/stream.ar.student.test.ts | 40 | `hasModule(moduleId)` — модуль потока | Б-2 | удалить | `domain/src/stream/passed-modules.dqs.test.ts:30` (модуль потока в `passedModuleIds`) |
| stream/stream.ar.student.test.ts | 46 | ключа у потока нет — `true` для любого ввода | Б-2 | удалить | `domain/src/stream/student/student.rules.test.ts:58` (правило: нет ключа — ok) |
| stream/stream.ar.student.test.ts | 51 | ключ совпал — `true` | Б-2 | удалить | `domain/src/stream/student/student.rules.test.ts:65` |
| stream/stream.ar.student.test.ts | 57 | it.each undefined/''/'Секрет'/'секрет ' — неверный ввод | Б-2 | удалить | `domain/src/stream/student/student.rules.test.ts:75` (тот же набор значений на правиле) |
| stream/stream.ar.test.ts | 38 | четыре статуса и три перехода (MAN-12) | Б-11 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:179` (Def несёт статусы и переходы) + `:215` (отказ для каждого статуса вне `from`) |
| stream/stream.ar.test.ts | 52 | события агрегата — только `created` | Б-11 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06: опубликованное событие объявлено в модуле) |
| stream/stream.ar.test.ts | 69 | событие `created` `{ streamId, moduleId }` — единственное | Б-11 | удалить | `modules/stream/src/stream/uc/create-stream.uc.test.ts:97` (payload реальной публикации) |
| stream/stream.ar.test.ts | 94 | без `enrollmentKey` ключа в state нет | Б-11 | удалить | `modules/stream/src/stream/uc/create-stream.uc.test.ts:91` (то же на записи реального UC) |
| stream/stream.ar.test.ts | 99 | снимок контента сохраняется как есть | Б-6 | удалить | `domain/src/stream/stream/stream.ar.test.ts:58` (`state()` нового потока сверяется целиком) |
| stream/stream.ar.test.ts | 106 | legacy-запись: ISO-даты, без version и updatedAt | Б-1 | удалить | `modules/stream/src/infra/stream.json-repo.test.ts:164` (чтение legacy-файла даёт числа, `updatedAt = createdAt`, `version = 0`) |
| stream/stream.ar.test.ts | 121 | восстановленный поток событий не имеет | Б-9 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:251` (restore без событий) |
| stream/stream.ar.test.ts | 186 | enrollment → active → completed → archived | Б-6 | удалить | `domain/src/stream/stream/stream.ar.test.ts:127` (+ `:149`, `:167` — те же переходы по одному) |
| stream/stream.ar.test.ts | 197 | `isMentoredBy`: ментор потока — да, другой — нет | Б-2 | удалить | `domain/src/stream/stream/stream.policy.test.ts:50` (+ `:64` — чужой ментор) |
| stream/stream.ar.test.ts | 257 | `requiresEnrollmentKey = false`, когда ключа нет | Б-6 | слить в stream/stream.ar.test.ts:251 | — (второй кейс `it.each` у `:251`) |
| stream/stream.ar.test.ts | 263 | остальные поля state — как есть | Б-11 | удалить | «нигде»: сравнение вида с его же `state` — тавтология копирования; реальный вид проверен в `modules/stream/src/stream/uc/read-stream.uc.test.ts:43` |
| stream/stream.errors.test.ts | 12 | шесть ошибок группы STREAM | Б-11 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:426` (ERR-04: коды не пересекаются и по префиксу) + `domain/src/stream/stream/stream.ar.test.ts:137` (код используется переходом) |
| stream/stream.errors.test.ts | 31 | поток не найден — текст | Б-11 | удалить | «нигде»: текст `label` — TST-09 (`payload` проверен `modules/stream/src/stream/uc/manage-stream.uc.test.ts:88`) |
| stream/stream.errors.test.ts | 35 | архив: уже в архиве и не завершён — тексты | Б-11 | удалить | «нигде»: тексты `label` — TST-09 |
| stream/stream.errors.test.ts | 46 | студенты ещё учатся — начало и конец legacy-текста | Б-11 | удалить | «нигде»: тексты `label` — TST-09 |
| stream/stream.errors.test.ts | 54 | `NOT_FOUND`: `{ streamId }` | Б-8 | удалить | `modules/stream/src/stream/uc/manage-stream.uc.test.ts:88` (payload из реального UC) |
| stream/stream.errors.test.ts | 61 | `STUDENTS_IN_PROGRESS`: список `{ userId, status }` | Б-8 | удалить | `domain/src/stream/stream/stream.rules.test.ts:51` (payload из вердикта правила) |
| stream/stream.policy.test.ts | 21 | ментор и админ одновременно — allowed | Б-6 | слить в stream/stream.policy.test.ts:17 | — (`it.each` по наборам ролей у `:17`) |
| stream/stream.policy.test.ts | 72 | студент — denied | Б-6 | слить в stream/stream.policy.test.ts:64 | — (таблица отказов у `:64`) |
| stream/stream.policy.test.ts | 78 | гость (роль GUEST) — denied | Б-6 | слить в stream/stream.policy.test.ts:64 | — (таблица отказов у `:64`) |
| stream/stream.policy.test.ts | 88 | статус потока на право не влияет | Б-6 | слить в stream/stream.policy.test.ts:50 | — (`it.each` по статусам у `:50`: право не должно читать `status`) |
| stream/stream.rules.test.ts | 30 | описание правила ссылается на `STREAM_STUDENTS_IN_PROGRESS` | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` (ERR-02: ошибка правила объявлена в `errors` UC) |
| stream/stream.rules.test.ts | 47 | пустой список студентов — ok | Б-12 | удалить | «нигде»: `pending.length === 0` — та же ветка, что и общий путь (сравнение с пустым массивом) |
| stream/stream.state.test.ts | 27 | ISO-даты → числа, `updatedAt = createdAt`, `version = 0` | Б-1 | удалить | `modules/stream/src/infra/stream.json-repo.test.ts:164` (legacy-файл читается репозиторием с тем же результатом) |
| stream/stream.state.test.ts | 46 | запись нового формата (числа, version) проходит как есть | Б-8 | слить в stream/stream.state.test.ts:98 | — (валидная строка общей таблицы схемы) |
| stream/stream.state.test.ts | 62 | снимок контента сохраняется | Б-4 | удалить | `domain/src/course/content-snapshot.test.ts:57` (владелец контракта отклоняет битый снимок; сам снимок — данные, не логика `stream`) |
| stream/stream.state.test.ts | 69 | принимает все необязательные поля, включая `enrollmentKey` | Б-8 | слить в stream/stream.state.test.ts:98 | — (валидная строка общей таблицы схемы) |
| stream/stream.state.test.ts | 85 | без `enrollmentKey` ключа в результате нет | Б-11 | слить в stream/stream.state.test.ts:98 | — (валидная строка «полей нет — ключа нет» той же таблицы) |
| stream/stream.state.test.ts | 98 | it.each — отклоняет невалидное (9 кейсов) | Б-8 | переписать | приёмник: таблица «валидно/невалидно» схемы `stream` (вбирает `:46`, `:69`, `:85`, `:117`, `:130`) |
| stream/stream.state.test.ts | 117 | it.each — без обязательного поля — падает (7 кейсов) | Б-8 | слить в stream/stream.state.test.ts:98 | — (строки «невалидно» общей таблицы) |
| stream/stream.state.test.ts | 130 | it.each — принимает каждый статус (4 кейса) | Б-8 | слить в stream/stream.state.test.ts:98 | — (валидные строки общей таблицы) |
| stream/stream.state.test.ts | 137 | у каждого поля есть описание (MAN-02) | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:193` (MAN-02) |
| stream/uc/get-stream-members.roster.test.ts | 20 | состав с roster валиден и roster сохраняется в разборе | Б-11 | удалить | `modules/stream/src/stream/uc/stream-students.uc.test.ts:194` (roster считается на момент `now()` по всем студентам) |
| stream/uc/get-stream-members.roster.test.ts | 41 | it.each critical/lagging/on_track — допустимы | Б-8 | удалить | `domain/src/stream/stream-members.dqs.test.ts:103` (+ `:109` — тот же расчёт уровней) |
| stream/uc/get-stream-members.roster.test.ts | 59 | чужой уровень отставания отклоняется | Б-8 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` (`picklist` выхода проверяет платформа) |
| stream/uc/get-stream-members.roster.test.ts | 74 | старые поля состава остались: students, neverStarted, inProgress | Б-11 | удалить | `modules/stream/src/stream/uc/stream-students.uc.test.ts:194` (реальный ответ UC с этими полями) |
| stream/uc/get-stream-members.uc.test.ts | 22 | query для system/user/guest над агрегатом потока | Б-7 | удалить | `modules/stream/src/stream/uc/stream-students.uc.test.ts:167` (+ `:222` — чтение не пишет и не публикует) |
| stream/uc/get-stream-members.uc.test.ts | 33 | вход — uuid потока | Б-8 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` (INPUT_VALIDATION платформы) |
| stream/uc/get-stream-members.uc.test.ts | 39 | it.each — пять статусов в выходе (5 кейсов) | Б-8 | удалить | `domain/src/stream/stream-members.dqs.test.ts:45` (факты по каждому студенту: закрытые и учащиеся) |
| stream/uc/get-stream-members.uc.test.ts | 50 | выход: пустой состав валиден; чужой статус и неполные поля отклоняются | Б-8 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` (`picklist`/обязательные поля выхода) |
| stream/uc/get-stream-members.uc.test.ts | 66 | «нет потока» — штатный `undefined` | Б-6 | удалить | `modules/stream/src/stream/uc/stream-students.uc.test.ts:161` |
| stream/uc/get-stream-presence.uc.test.ts | 9 | query для других модулей над агрегатом, без ограничений | Б-7 | удалить | `modules/stream/src/stream/uc/read-stream.uc.test.ts:224` (реальный вызов, `exists: true`) |
| stream/uc/get-stream-presence.uc.test.ts | 20 | вход — uuid потока | Б-8 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` |
| stream/uc/get-stream-presence.uc.test.ts | 26 | выход — признак наличия; отсутствие потока — не ошибка | Б-8 | удалить | `modules/stream/src/stream/uc/read-stream.uc.test.ts:224` (+ `:234` — `exists: false`) |
| stream/uc/stream.uc-defs.test.ts | 35 | CreateStream: `calls` `getModuleSnapshot`, `MODULE_NOT_FOUND`, `emits` created | Б-7 | удалить | `modules/stream/src/stream/uc/create-stream.uc.test.ts:137` (реальный `MODULE_NOT_FOUND`) + `node_modules/dmg-core/src/arch/def-checker.test.ts:387` (MAN-05: `calls` ⊆ `dependsOn`) |
| stream/uc/stream.uc-defs.test.ts | 55 | вход: обязательные поля без mentorId/schoolId/status/contentSnapshot (С3) | Б-8 | удалить | `modules/stream/src/stream/uc/create-stream.uc.test.ts:48` (реальный вызов с этим входом) + `:161` (пустой заголовок — INPUT_VALIDATION) |
| stream/uc/stream.uc-defs.test.ts | 74 | вход: необязательные поля принимаются | Б-8 | удалить | `modules/stream/src/stream/uc/create-stream.uc.test.ts:75` |
| stream/uc/stream.uc-defs.test.ts | 93 | выход — `{ streamId }` | Б-8 | удалить | `modules/stream/src/stream/uc/create-stream.uc.test.ts:48` (реальный ответ) |
| stream/uc/stream.uc-defs.test.ts | 120 | ManageStream: Policy `canManage`, ошибки, без событий | Б-7 | удалить | `modules/stream/src/stream/uc/manage-stream.uc.test.ts:65` (права) + `:102` (событий нет) |
| stream/uc/stream.uc-defs.test.ts | 133 | правила | Б-7 | удалить | `modules/stream/src/stream/uc/manage-stream.uc.test.ts:128` (правило подключено: отказ по незавершённым студентам) |
| stream/uc/stream.uc-defs.test.ts | 137 | вход `{ streamId }`, выход — пусто | Б-8 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` + `modules/stream/src/stream/uc/manage-stream.uc.test.ts:110` |
| stream/uc/stream.uc-defs.test.ts | 148 | `rules: [studentsSettled]` | Б-6 | удалить | `modules/stream/src/stream/uc/manage-stream.uc.test.ts:128` (объявление списка правил — Б-7) |
| stream/uc/stream.uc-defs.test.ts | 156 | GetStream: query пользователя и гостя, `allowAll`, `NOT_FOUND` | Б-7 | удалить | `modules/stream/src/stream/uc/read-stream.uc.test.ts:43` (+ `:58` гость, `:70` NOT_FOUND) |
| stream/uc/stream.uc-defs.test.ts | 167 | вход `{ streamId }` | Б-8 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` |
| stream/uc/stream.uc-defs.test.ts | 174 | выход — представление + canManage, без enrollmentKey (С1, Т7) | Б-8 | удалить | `modules/stream/src/stream/uc/read-stream.uc.test.ts:94` (ключа нет в реальном ответе) + `:82` (canManage по ролям) |
| stream/uc/stream.uc-defs.test.ts | 192 | ListStreams: query пользователя и гостя, `allowAll` | Б-7 | удалить | `modules/stream/src/stream/uc/read-stream.uc.test.ts:145` (гость и все потоки) |
| stream/uc/stream.uc-defs.test.ts | 203 | вход: фильтры необязательны, status/mentorId/schoolId проверяются | Б-8 | удалить | `modules/stream/src/stream/uc/read-stream.uc.test.ts:117` (+ `:137` — только schoolId) |
| stream/uc/stream.uc-defs.test.ts | 214 | выход — массив представлений без enrollmentKey | Б-8 | удалить | `modules/stream/src/stream/uc/read-stream.uc.test.ts:153` (ключа нет в списке) |
| stream/uc/stream.uc-defs.test.ts | 225 | FindStream: query пользователя и гостя, `allowAll` | Б-7 | удалить | `modules/stream/src/stream/uc/read-stream.uc.test.ts:172` |
| stream/uc/stream.uc-defs.test.ts | 236 | вход — идентификатор группы строкой (Т8) | Б-8 | перенести в modules/stream/src/stream/uc/read-stream.uc.test.ts | — (кейс «числовой id → INPUT_VALIDATION»: сейчас строку никто не проверяет) |
| stream/uc/stream.uc-defs.test.ts | 245 | выход — представление или `undefined` (нет такой группы) | Б-8 | удалить | `modules/stream/src/stream/uc/read-stream.uc.test.ts:183` (`Ok(undefined)`) + `:172` |
| stream/uc/stream.uc-defs.test.ts | 257 | GetStreamMembers: query system/user/guest над агрегатом | Б-7 | удалить | `modules/stream/src/stream/uc/stream-students.uc.test.ts:167` (+ `:222`) |
| stream/uc/stream.uc-defs.test.ts | 276 | it.each — пять статусов в выходе (5 кейсов) | Б-8 | удалить | `domain/src/stream/stream-members.dqs.test.ts:45` |
| stream/uc/stream.uc-defs.test.ts | 284 | выход: без studentId или inProgress, чужой статус — отклоняется | Б-8 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` |
| stream/uc/stream.uc-defs.test.ts | 302 | GetStreamPresence: query system, `allowAll`, `{ exists }` | Б-7 | удалить | `modules/stream/src/stream/uc/read-stream.uc.test.ts:224` (+ `:234`) |
| student/job/inactivity-sweep.job.test.ts | 23 | публикует только warning и removeCandidate | Б-7 | удалить | `modules/stream/src/student/job/inactivity-sweep.job.test.ts:61` (+ `:77` — оба события в реальном прогоне) |
| student/job/inactivity-sweep.job.test.ts | 32 | JobDef входит в паспорт модуля | Б-5 | удалить | `domain/src/stream/stream.module.student.test.ts:47` (тест состава: `jobs`) |
| student-progress.dqs.test.ts | 160 | невыданный шаг — `locked` (`buildLessonSteps`) | Б-6 | слить в student-progress.dqs.test.ts:146 | — (`:146` получает второй кейс «выдан/не выдан») |
| student-progress.dqs.test.ts | 258 | `stepPosition`: шага нет — `null` | Б-6 | слить в student-progress.dqs.test.ts:249 | — (`:249` получает кейс «неизвестный шаг → null») |
| student-progress.dqs.test.ts | 312 | `computeStudentRowSummary`: студент без шагов — 0%, времени нет | Б-6 | слить в student-progress.dqs.test.ts:320 | — (`:320` получает кейс «шагов нет») |
| student/student.ar.test.ts | 41 | пять статусов и пять переходов | Б-11 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:179` (+ `:215`) |
| student/student.ar.test.ts | 52 | события агрегата: пять | Б-11 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06) |
| student/student.ar.test.ts | 80 | событие `enrolled { … }` — единственное | Б-8 | удалить | `modules/stream/src/student/uc/enroll-student.uc.test.ts:62` (имя и payload реальной публикации) |
| student/student.ar.test.ts | 308 | `isOwnedBy` / `belongsToStream` | Б-2 | удалить | `domain/src/stream/student/student.policy.test.ts:26` (владение решает право) + `domain/src/stream/stream-members.dqs.test.ts:45` (фильтр по потоку) |
| student/student.ar.test.ts | 334 | `hasNoSteps`: пока нет записей шага (статус не важен) | Б-2 | удалить | `domain/src/stream/stream-launch.dcs.test.ts:42` (+ `:51` — выдача первого шага) |
| student/student.ar.test.ts | 421 | учащийся: `inProgress`, не `passed` | Б-6 | слить в student/student.ar.test.ts:397 | — (второй кейс `view()` в том же describe) |
| student/student.ar.test.ts | 431 | копия: правка вида не меняет агрегат | Б-9 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:272` (view по умолчанию — копия) |
| student/student.ar.test.ts | 571 | `activate` сбрасывает цепочку уведомлений | Б-6 | удалить | `domain/src/stream/student/student.ar.test.ts:95` (`enrolled → active`, notices сброшены) |
| student/student.errors.test.ts | 9 | одиннадцать ошибок группы STUDENT | Б-11 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:426` (ERR-04) + `domain/src/stream/student/student.ar.test.ts:106` (код используется отказом) |
| student/student.errors.test.ts | 33 | it.each — тексты переходов (9 кейсов) | Б-11 | удалить | «нигде»: тексты `label` — TST-09 |
| student/student.errors.test.ts | 61 | `PREREQUISITE_NOT_PASSED` несёт `moduleTitle` | Б-8 | удалить | `domain/src/stream/student/student.rules.test.ts:149` (payload из вердикта правила) |
| student/student.events.fate.test.ts | 15 | FQN `stream.student.completed` и payload | Б-8 | удалить | `domain/src/stream/student/student.ar.test.ts:187` (payload из агрегата) + `modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts:133` (потребитель) |
| student/student.events.fate.test.ts | 28 | отклоняет чужой outcome и payload без поля | Б-8 | удалить | `node_modules/dmg-core/src/domain/events/event-def.test.ts:25` (`make()` типизирован схемой; приём события — платформа) |
| student/student.events.fate.test.ts | 48 | FQN `stream.student.abandoned` и payload (без moduleId) | Б-8 | удалить | `modules/stream/src/student/uc/drop-student.uc.test.ts:41` (+ `modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts:148`) |
| student/student.events.fate.test.ts | 55 | it.each — три `who` (3 кейса) | Б-8 | удалить | `modules/stream/src/student/uc/mark-abandoned.uc.test.ts:44` (реальная публикация с причиной) |
| student/student.events.fate.test.ts | 66 | отклоняет чужие `who`/`cause` | Б-8 | удалить | `node_modules/dmg-core/src/domain/events/event-def.test.ts:25` |
| student/student.events.test.ts | 14 | FQN по MAN-08: `stream.student.<ключ>` | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:325` |
| student/student.events.test.ts | 23 | `inactivityWarning { …, days }` — без `telegramId` | Б-8 | удалить | `domain/src/stream/student/student.ar.test.ts:451` (payload реальной публикации) |
| student/student.events.test.ts | 30 | `inactivityRemoveCandidate` — те же поля плюс `wasWarned` (Т5) | Б-8 | удалить | `domain/src/stream/student/student.ar.test.ts:465` |
| student/student.events.test.ts | 37 | три прежних события остались | Б-11 | удалить | `domain/src/stream/student/student.ar.test.ts:187` (completed публикуется) — состав событий держат MAN-06 (`node_modules/dmg-core/src/arch/def-checker.test.ts:230`) и типы `StudentArDef` |
| student/student.policy.test.ts | 77 | сам студент — denied | Б-6 | слить в student/student.policy.test.ts:71 | — (таблица отказов у `:71`) |
| student/student.policy.test.ts | 81 | пользователь с ролью GUEST — denied | Б-6 | слить в student/student.policy.test.ts:71 | — (таблица отказов у `:71`) |
| student/student.policy.test.ts | 89 | статус студента на право не влияет | Б-6 | слить в student/student.policy.test.ts:63 | — (`it.each` по статусам у `:63`) |
| student/student.rules.test.ts | 36 | четыре правила в порядке legacy | Б-6 | удалить | `modules/stream/src/student/uc/enroll-student.uc.test.ts:170` (порядок правил проверен поведением) |
| student/student.rules.test.ts | 45 | правила ссылаются на ошибки `STUDENT_*` | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` (ERR-02) |
| student/student.state.test.ts | 31 | ISO-даты → числа, `updatedAt = createdAt`, `version = 0` | Б-1 | удалить | `modules/stream/src/infra/student.json-repo.test.ts:133` (legacy-файл читается репозиторием) |
| student/student.state.test.ts | 42 | даты шагов: `issuedAt` и `completedAt` — числа | Б-1 | удалить | `modules/stream/src/infra/student.json-repo.test.ts:133` (даты шагов тоже) |
| student/student.state.test.ts | 54 | `sentAt` маркера до минуты → число UTC | Б-1 | удалить | `modules/stream/src/infra/student.json-repo.test.ts:152` |
| student/student.state.test.ts | 73 | запись нового формата проходит как есть | Б-8 | удалить | `modules/stream/src/infra/student.json-repo.test.ts:197` (числовые записи с version читаются целиком) |
| student/student.state.test.ts | 89 | `completionDetails` и `abandonDetails` сохраняются | Б-8 | удалить | `modules/stream/src/infra/student.json-repo.test.ts:152` (`completionDetails`) + `:197` |
| student/student.state.test.ts | 139 | it.each — каждый статус допустим (5 кейсов) | Б-8 | слить в student/student.state.test.ts:111 | — (валидные строки таблицы отказов `:111`, она становится двусторонней) |
| student/uc/student.uc-defs.test.ts | 25 | EnrollStudent: `command` пользователя, `calls`, событие enrolled | Б-7 | удалить | `modules/stream/src/student/uc/enroll-student.uc.test.ts:48` + `:62` |
| student/uc/student.uc-defs.test.ts | 37 | ошибки: поток не найден и четыре отказа зачисления | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` (ERR-02) + `modules/stream/src/student/uc/enroll-student.uc.test.ts:215` |
| student/uc/student.uc-defs.test.ts | 49 | правила зачисления в порядке legacy | Б-6 | удалить | `modules/stream/src/student/uc/enroll-student.uc.test.ts:170` |
| student/uc/student.uc-defs.test.ts | 58 | вход `{ streamId, enrollmentKey? }` без userId (С3) | Б-8 | удалить | `modules/stream/src/student/uc/enroll-student.uc.test.ts:102` (чужой userId во входе игнорируется) |
| student/uc/student.uc-defs.test.ts | 72 | выход — `{ studentId }` | Б-8 | удалить | `modules/stream/src/student/uc/enroll-student.uc.test.ts:48` |
| student/uc/student.uc-defs.test.ts | 81 | CompleteStep: Policy `isSelf` (Т8), без событий | Б-7 | удалить | `modules/stream/src/student/uc/complete-step.uc.test.ts:45` + `:94` (событий нет) |
| student/uc/student.uc-defs.test.ts | 100 | вход `{ studentId, streamId, stepId }` | Б-8 | удалить | `modules/stream/src/student/uc/complete-step.uc.test.ts:45` |
| student/uc/student.uc-defs.test.ts | 106 | it.each — четыре уровня выхода (5 кейсов) | Б-8 | удалить | `domain/src/stream/step-completion.dcs.test.ts:65` (+ `:74`, `:82`, `:90` — по уровню на тест) |
| student/uc/student.uc-defs.test.ts | 116 | выход: чужой уровень и неполный lesson отклоняются | Б-8 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` |
| student/uc/student.uc-defs.test.ts | 125 | CompleteStudent: Policy `canComplete`, событие completed | Б-7 | удалить | `modules/stream/src/student/uc/complete-student.uc.test.ts:45` |
| student/uc/student.uc-defs.test.ts | 143 | вход: исход `advanced` или `not_advanced`; `abandoned` не принимается | Б-8 | перенести в modules/stream/src/student/uc/complete-student.uc.test.ts | — (кейс `outcome: 'abandoned'` → INPUT_VALIDATION: сейчас не покрыт) |
| student/uc/student.uc-defs.test.ts | 152 | выход пуст | Б-8 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` |
| student/uc/student.uc-defs.test.ts | 158 | DropStudent: Policy `isSelf`, событие abandoned | Б-7 | удалить | `modules/stream/src/student/uc/drop-student.uc.test.ts:41` |
| student/uc/student.uc-defs.test.ts | 172 | вход `{ streamId, studentId }`, выход пуст | Б-8 | удалить | `modules/stream/src/student/uc/drop-student.uc.test.ts:41` |
| student/uc/student.uc-defs.test.ts | 180 | MarkAbandoned: Policy `canMarkAbandoned`, событие abandoned | Б-7 | удалить | `modules/stream/src/student/uc/mark-abandoned.uc.test.ts:44` |
| student/uc/student.uc-defs.test.ts | 200 | вход: причина `inactivity` или `by_mentor`; `voluntary` не принимается | Б-8 | перенести в modules/stream/src/student/uc/mark-abandoned.uc.test.ts | — (кейс `cause: 'voluntary'` → INPUT_VALIDATION: сейчас не покрыт) |
| student/uc/student.uc-defs.test.ts | 211 | getStudentByUser: query пользователя, `allowAll`, `NOT_FOUND`, выход — `StudentView` | Б-7 | удалить | `modules/stream/src/student/uc/get-student-by-user.uc.test.ts:34` (+ `:77` NOT_FOUND, `:91` без событий) |
| student/uc/student.uc-defs.test.ts | 226 | getStudentProgress: query для user и guest, `allowAll`, `NOT_FOUND` | Б-7 | удалить | `modules/stream/src/student/uc/get-student-progress.uc.test.ts:53` (+ `:102`, `:108`) |
| student/uc/student.uc-defs.test.ts | 237 | getStudentProgress: stepId и lessonId необязательны | Б-8 | удалить | `modules/stream/src/student/uc/get-student-progress.uc.test.ts:75` |
| student/uc/student.uc-defs.test.ts | 246 | getStudentProgress: выход — студент и необязательный progress | Б-8 | удалить | `modules/stream/src/student/uc/get-student-progress.uc.test.ts:53` + `:91` (потока нет — progress нет) |
| student/uc/student.uc-defs.test.ts | 252 | getActiveStudent: query для user и guest, `allowAll`, без ошибок | Б-7 | удалить | `modules/stream/src/student/uc/get-active-student.uc.test.ts:41` (+ `:87` гость) |

Итого строк таблицы — **146** (139 кандидатов `stream-domain.md` + 5 «полезных» тестов
`*.uc-defs.test.ts`, которые решение 5 переводит в перенос/удаление, + 2 приёмника:
`stream.module.student.test.ts:47`, `stream.state.test.ts:98`).

## Переписать

- `stream.module.student.test.ts:47` — сделать единственным тестом состава модуля: `useCases`
  (17: девять потока и восемь студента), `jobs` (`['inactivitySweep']`), `reactions` (`[]`)
  и `dependsOn` (`['user', 'course']`) — переезжает из `:38`; добавить `dependsOn`, если его
  сейчас нет (иначе тест состава не ловит новую связь).
- `stream.state.test.ts:98` — таблица схемы `stream` становится двусторонней: валидные строки
  (новая запись с числами и `version` из `:46`; все необязательные поля из `:69`; «полей нет —
  ключа нет» из `:85`; четыре статуса из `:130`) и невалидные (9 текущих строк + 7 «без
  обязательного поля» из `:117`); `updatedAt`/`version`/`trim` остаются отдельными тестами
  (`:38`, `:90`).

## Слить

- `stream/stream.ar.test.ts:257` → `:251` (второй кейс `it.each` по наличию ключа).
- `stream/stream.policy.test.ts:21` → `:17` (`it.each` по наборам ролей); `:72`, `:78` → `:64`
  (таблица отказов); `:88` → `:50` (`it.each` по статусам — право не читает `status`).
- `stream/stream.state.test.ts:46`, `:69`, `:85`, `:117`, `:130` → `:98` (строки таблицы схемы).
- `student/student.ar.test.ts:421` → `:397` (второй кейс `view()` в том же describe).
- `student/student.policy.test.ts:77`, `:81` → `:71` (таблица отказов); `:89` → `:63`
  (`it.each` по статусам).
- `student/student.state.test.ts:139` → `:111` (таблица схемы `student` — двусторонняя).
- `stream.module.student.test.ts:38` → `:47` (паспорт входит в тест состава).
- `passed-modules.dqs.test.ts:48` → `:39`; `:98` → `:60`.
- `student-progress.dqs.test.ts:160` → `:146`; `:258` → `:249`; `:312` → `:320`.

## Перенести

- `stream/uc/stream.uc-defs.test.ts:236` → `modules/stream/src/stream/uc/read-stream.uc.test.ts`:
  кейс «вход `telegramGroupId` числом → `INPUT_VALIDATION`» (Т8: идентификатор группы — строка).
- `student/uc/student.uc-defs.test.ts:143` → `modules/stream/src/student/uc/complete-student.uc.test.ts`:
  кейс «`outcome: 'abandoned'` → `INPUT_VALIDATION`».
- `student/uc/student.uc-defs.test.ts:200` → `modules/stream/src/student/uc/mark-abandoned.uc.test.ts`:
  кейс «`cause: 'voluntary'` → `INPUT_VALIDATION`».

После переноса `stream/uc/stream.uc-defs.test.ts` и `student/uc/student.uc-defs.test.ts`
удаляются целиком (21 и 21 объявление).

## Остающиеся проверки `label`

TST-09: тексты `label`/`denyMessage` не тестируются. Ниже — все одиночные `expect` на
текст в полезных тестах домена `stream`, которые таблица **не** удаляет: смысл теста
сохраняется, строку с текстом нужно убрать в том же срезе.

- `domain/src/stream/stream/stream.policy.test.ts:37` — `decision.denyMessage` (описание отказа).
- `domain/src/stream/stream/stream.policy.test.ts:68` — `denyMessage` через `toContain('Недостаточно прав')`.
- `domain/src/stream/student/student.policy.test.ts:46` — `denyMessage` «Вы не можете выйти из чужого потока».
- `domain/src/stream/student/student.policy.test.ts:74` — `denyMessage` из таблицы отказов (`:71`).
- `domain/src/stream/student/student.rules.test.ts:162` — `error.label` «Сначала пройдите предыдущий модуль».

## Итог

- Всего строк: **146**.
- удалить — **118** (151 кейс исполнения), в том числе 2 «отложить: удалить с кодом».
- слить — **21** (кейсы переезжают в приёмники, число тестов почти не меняется).
- переписать — **2** (`stream.module.student.test.ts:47`, `stream.state.test.ts:98`).
- перенести — **3** (в тесты модуля `modules/stream`).
- отложить: удалить с кодом — **2** (`status.test.ts:13`, `:28` — неиспользуемые
  `StreamStatusSchema`/`StudentStatusSchema` и прочие экспорты `status.ts`).
- отложить до course-dmg (TR-57) — **0**: в домене `stream` красных по `course-dmg` нет.
- Файлов удаляется целиком — **10**: `content-snapshot-import.test.ts`,
  `stream/uc/stream.uc-defs.test.ts`, `stream/uc/get-stream-members.uc.test.ts`,
  `stream/uc/get-stream-presence.uc.test.ts`, `stream/uc/get-stream-members.roster.test.ts`,
  `student/uc/student.uc-defs.test.ts`, `stream/stream.errors.test.ts`,
  `stream.module.test.ts`, `student/student.events.test.ts`,
  `student/student.events.fate.test.ts`.
- Ожидаемое число тестов после: **416 → 257**. Расчёт: 151 кейс удалённых строк + 3
  перенесённых (уходят в `modules/stream`) + 2 отложенных = 260 остаётся; слияния
  сворачивают 5 кейсов (`stream.module.student.test.ts:38→:47`,
  `passed-modules.dqs.test.ts:48→:39` и `:98→:60`,
  `student-progress.dqs.test.ts:258→:249` и `:312→:320`) и добавляют 2
  (`stream.policy.test.ts:88→:50`, `student.policy.test.ts:89→:63` — `it.each` по
  статусам) → 260 − 5 + 2 = **257**. Базовая линия `modules/stream` вырастет на 3
  перенесённых кейса.
- Кандидатов инвентаризации не вошло: **0 из 139**. Сверх них в таблицу попало 7 строк:
  5 «полезных» тестов `*.uc-defs.test.ts` (`:174`, `:58` — удаляются как покрытые тестами
  модуля с реальным вызовом; `:236`, `:143`, `:200` — переносятся) и 2 приёмника слияний.
- Оценка инвентаризации пересмотрена в двух местах: `stream.policy.test.ts:88` и
  `student.policy.test.ts:89` («статус на право не влияет») — не удаляются, а сливаются
  в `:50`/`:63`: удаление потеряло бы защиту от чтения `status` в праве.
