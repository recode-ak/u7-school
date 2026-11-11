# Инвентаризация тестов: прикладной слой `course`

Трек `course-dmg_20261105`, фаза 8. Область — `modules/course/src/**/*.test.ts` (22 файла, **330 тестов**, база `cd modules/course && bun test` → 330 pass). Доменные тесты `domain/src/course/**` прочитаны **только как источник ссылок** «где покрыто», не оцениваются.

Вопрос к каждому `it`/`test`: *какая реальная ошибка в коде модуля уронит этот тест и только его?* Нет такой — кандидат.

Обозначения: пути без префикса — от `modules/course/src/`; `домен:` = `domain/src/course/`; `платформа:` = `node_modules/dmg-core/src/`. Закономерности — [`test-bloat.md` §2](../../../roadmap/test-bloat.md); правила — `docs/reference/testing.md` §3, §5, §5.1 (TST-08, TST-09) пакета.

## 1. Сводка

| файл | всего | полезен | сомнителен | пуст |
|---|---|---|---|---|
| `course.module.serves.test.ts` | 3 | 1 | 2 | — |
| `course.module.test.ts` | 3 | 0 | 3 | **да** (файл пустеет) |
| `course/uc/get-course.uc.test.ts` | 11 | 4 | 7 | — |
| `course/uc/get-course-by-module.uc.test.ts` | 10 | 2 | 8 | — |
| `course/uc/get-course-enrollment.uc.test.ts` | 9 | 2 | 7 | — |
| `course/uc/get-courses-including-module.uc.test.ts` | 11 | 4 | 7 | — |
| `course/uc/get-courses-starting-with-module.uc.test.ts` | 14 | 4 | 10 | — |
| `course/uc/get-module-enrollment.uc.test.ts` | 9 | 2 | 7 | — |
| `course/uc/get-module-place.uc.test.ts` | 12 | 4 | 8 | — |
| `course/uc/get-module-prerequisite.uc.test.ts` | 8 | 3 | 5 | — |
| `course/uc/get-same-modules.uc.test.ts` | 7 | 3 | 4 | — |
| `course/uc/list-courses.uc.test.ts` | 13 | 3 | 10 | — |
| `infra/course.json-repo.test.ts` | 42 | 37 | 5 | — |
| `infra/lesson.json-repo.test.ts` | 19 | 16 | 3 | — |
| `infra/module.json-repo.test.ts` | 26 | 22 | 4 | — |
| `infra/step.json-repo.test.ts` | 22 | 18 | 4 | — |
| `lesson/uc/get-lesson.uc.test.ts` | 21 | 5 | 16 | — |
| `module/uc/get-module-snapshot.uc.test.ts` | 23 | 8 | 15 | — |
| `module/uc/get-module.uc.test.ts` | 15 | 3 | 12 | — |
| `module/uc/list-modules.uc.test.ts` | 16 | 6 | 10 | — |
| `step/uc/get-steps-by-lessons.uc.test.ts` | 15 | 6 | 9 | — |
| `step/uc/get-step.uc.test.ts` | 21 | 4 | 17 | — |
| **Итого** | **330** | **157** | **173 (52%)** | 1 файл |

Профиль: `infra/**` почти весь полезен (109 тестов, 16 кандидатов — чтение файлов и формы записи), а UC-файлы наоборот (16 файлов, 215 тестов, 152 кандидата — 71%): UC тонкие, а тесты проверяют правила Ar/DQS/Policy и поведение ядра. Оставшиеся 6 тестов — `course.module*.test.ts` (5 кандидатов). Доля кандидатов 52% — в верхней половине диапазона 31–62% §2.

## 2. Закономерности

Всего 173 кандидата; новых признаков не нашлось — все случаи укладываются в `Б-1`, `Б-6`, `Б-8`, `Б-9`, `Б-11`, `Б-12`. `Б-7` после Ф3–Ф7 в модуле пуст: ручных паспортов Def больше нет, остался один тест состава (`course.module.serves.test.ts:17`).

**Б-1 — правило проверено уровнем ниже и повторено выше. 79 случаев (46% кандидатов).**
Ядро проблемы модуля: UC тонкие (`load()` + один DQS/`view()`), а тесты по привычке проверяют правила `CourseAr`, `ModuleCoursesDqs`, `LessonStepsDqs`, `ModuleSnapshotDqs`, `ModulePolicy`.
- `domain:` `course/course.ar.test.ts:305` (видимость не зависит от статуса) ↔ `course/uc/get-course.uc.test.ts:49`, `:55` ×2;
- `domain:` `module-courses.dqs.test.ts:88` (draft/archived пропускаются) ↔ `course/uc/get-module-enrollment.uc.test.ts:51` ×2, `course/uc/get-module-place.uc.test.ts:102` ×2;
- `domain:` `module/module.policy.test.ts:18` (админ — allowed) ↔ `module/uc/get-module.uc.test.ts:50`, `step/uc/get-step.uc.test.ts:57`, `lesson/uc/get-lesson.uc.test.ts:60`;
- `domain:` `module/module.ar.test.ts:58` (published: только опубликованные проекты) ↔ `module/uc/get-module.uc.test.ts:65`.

**Б-9 — проверяется поведение платформы. 42 случая (24%).**
Три массовых семейства, одни и те же имена в 8–11 файлах:
- `'только читает: ничего не записывается'` — 11 тестов (`course/uc/get-course.uc.test.ts:88`, `course/uc/get-courses-including-module.uc.test.ts:116`, `step/uc/get-steps-by-lessons.uc.test.ts:198`, `lesson/uc/get-lesson.uc.test.ts:99` …): в `execute` нет ни `save`, ни `event`; падает только при добавлении чужого вызова;
- `'… — UNAUTHORIZED'` — 11 тестов (`course/uc/get-course.uc.test.ts:108`, `module/uc/get-module.uc.test.ts:127`, …) ↔ `платформа: app/use-case/use-case-from-def.test.ts:123`;
- `'гость допущен'` / `'гость и пользователь получают один и тот же список'` — 5 тестов ↔ `платформа: …/use-case-from-def.test.ts:179` (`allowAll`) + `домен:` `course/course.ar.test.ts:305`;
- `VersionConflict` в репозиториях (4 теста: `infra/*.json-repo.test.ts:134/173/123/231`) ↔ `платформа: app/uow/repository.test.ts:64`;
- `'фасад обслуживает …'`, `'facade.serves'` (`course.module.serves.test.ts:25`, `module/uc/get-module-snapshot.uc.test.ts:246`) ↔ `платформа: app/facade/module-facade.test.ts:69`.

**Б-8 — схема платформы/Def: приём и отказ полей. 27 случаев (16%).**
`'вход не uuid — INPUT_VALIDATION'` (`course/uc/get-course.uc.test.ts:104`, `step/uc/get-step.uc.test.ts:191`), `'неверный uuid'`, `'прежнее имя поля uuid — INPUT_VALIDATION (Т8)'` (`lesson/uc/get-lesson.uc.test.ts:183`, `step/uc/get-step.uc.test.ts:195`), `list-courses.uc.test.ts:125` (`it.each`: `limit 0`, статус вне перечня, `authorId` не uuid) ↔ доменные тесты входа (`домен:` `course/uc/get-course.uc.test.ts:37`, `…/list-courses.uc.test.ts:24`+`:43`) и платформа `…/use-case-from-def.test.ts:130`.
Плюс «схема записи» в репозиториях: `'запись без обязательного поля'` (`infra/lesson.json-repo.test.ts:285`, `infra/module.json-repo.test.ts:425`, `infra/course.json-repo.test.ts:595`) ↔ `домен:` `lesson/lesson.state.test.ts:125`, `module/module.state.test.ts:70`, `course/course.state.test.ts:78`.

**Б-6 — копия соседнего теста без нового класса входа. 18 случаев (10%).**
- `it.each` по вызывающим, где исход одинаков: `module/uc/get-module-snapshot.uc.test.ts:88` ×5 (все — published, ветвление не меняется), `:174` ×5, `get-lesson:132` ×5, `get-step:151` ×5, `get-module:106` ×5, `get-steps-by-lessons:88` ×3, `:97` ×2;
- парные копии внутри файла: `course/uc/get-courses-including-module.uc.test.ts:79` (порядок при обратном ответе) ↔ `:68`; `course/uc/list-courses.uc.test.ts:61` ↔ `:73`; `module/uc/list-modules.uc.test.ts:142` ↔ `:126`, `:162` ↔ `:150`; `infra/module.json-repo.test.ts:397` ↔ `:386`;
- `'корень файла не массив'` (`infra/*.json-repo.test.ts:614/306/444/370`) ↔ `'невалидная запись — ValiError'` тех же файлов: та же ветка `v.parse`, тот же ассерт «файл не изменён».

**Б-11 — тест не может упасть. 2 случая.**
`course.module.test.ts:147` (`expect(ref.name).toBe('sneaky')` — проверяет литерал самого теста; настоящая проверка — `@ts-expect-error`), `course.module.serves.test.ts:32` (`facade().def` — геттер возвращает аргумент конструктора).

**Б-12 — пустой вход → пустой результат на `filter`/`map`. 5 случаев.**
`course/uc/get-courses-starting-with-module.uc.test.ts:83`, `course/uc/get-module-enrollment.uc.test.ts:47`, `course/uc/get-same-modules.uc.test.ts:43`, `course/uc/list-courses.uc.test.ts:45`, `module/uc/list-modules.uc.test.ts:91` — то же поведение, что у ветки «не найдено» в соседнем тесте того же файла.

**Не трогаем (§6).** Строгое чтение `courses.json` (`infra/course.json-repo.test.ts:245`, `:262`, `:314` ×7 `it.each` инвариантов, `:328`) — защита данных, хотя и дублирует `домен:` `course/course.state.test.ts:209`, `:221`; legacy ISO и даты без секунд (`infra/*.json-repo.test.ts` — 4 теста на файл); тесты этапов-меток (`course/uc/get-course.uc.test.ts:82`, `course/uc/get-module-place.uc.test.ts:46`, `:56`, `:74`) — см. «Открытые вопросы» п. 2.

## 3. Кандидаты

«Где покрыто» — конкретный `it`, который сам кандидатом не является; «нигде» — с объяснением.

| путь:строка | имя теста | Б-ID | где покрыто | что делать |
|---|---|---|---|---|
| `course.module.serves.test.ts:25` | фасад обслуживает все Def UC модуля | Б-9 | `платформа: app/facade/module-facade.test.ts:69`; полнота карты — компилятор (`…/app/module/module-from-def.test.ts:270`) | удалить |
| `course.module.serves.test.ts:32` | фасад принадлежит CourseModuleDef | Б-11 | `платформа: …/facade/module-facade.test.ts:71` | удалить |
| `course.module.test.ts:133` | UC потребителя вызывает getCourseEnrollment и получает стартовый модуль | Б-1 | `course/uc/get-course-enrollment.uc.test.ts:35` | удалить |
| `course.module.test.ts:147` | UC нет в calls потребителя — ошибка типа | Б-11 | `@ts-expect-error` в теле теста (проверяет `tsc`), `платформа: …/module-from-def.test.ts:270` | удалить |
| `course.module.test.ts:154` | модуль курсов обслуживает свой UC и только его | Б-9 | `платформа: …/facade/module-facade.test.ts:72–74` | удалить (файл пустеет) |
| `course/uc/get-course.uc.test.ts:49` | опубликованный курс виден гостю без авторизации | Б-9 | `платформа: …/use-case-from-def.test.ts:179`; `домен: course/course.ar.test.ts:305` | удалить |
| `course/uc/get-course.uc.test.ts:55` | it.each draft/archived ×2: курс в статусе %s виден гостю, студенту и автору | Б-1 | `домен: course/course.ar.test.ts:305` | удалить (2 кейса) |
| `course/uc/get-course.uc.test.ts:66` | в представлении этапы stages, а не метки phases | Б-1 | `домен: course/course.ar.test.ts:295` | удалить |
| `course/uc/get-course.uc.test.ts:88` | только читает: ничего не записывается | Б-9 | нигде — в `execute` нет `save`/`event`, проверять нечего | удалить |
| `course/uc/get-course.uc.test.ts:104` | вход не uuid — INPUT_VALIDATION | Б-8 | `домен: course/uc/get-course.uc.test.ts:37`; `платформа: …/use-case-from-def.test.ts:130` | удалить |
| `course/uc/get-course.uc.test.ts:108` | system не допущен (callers: user, guest) — UNAUTHORIZED | Б-9 | `домен: course/uc/get-course.uc.test.ts:13` (callers); `платформа: …/use-case-from-def.test.ts:123` | удалить |
| `course/uc/get-course-by-module.uc.test.ts:55` | модуль вне курсов — пусто, не ошибка | Б-1 | `домен: module-courses.dqs.test.ts:59` | удалить |
| `course/uc/get-course-by-module.uc.test.ts:61` | курсов нет — пусто | Б-1 | `домен: module-courses.dqs.test.ts:64` | удалить |
| `course/uc/get-course-by-module.uc.test.ts:65` | курс отдаётся представлением со stages | Б-1 | `домен: course/course.ar.test.ts:295` | удалить |
| `course/uc/get-course-by-module.uc.test.ts:80` | гость и пользователь допущены | Б-9 | `платформа: …/use-case-from-def.test.ts:179` | удалить |
| `course/uc/get-course-by-module.uc.test.ts:87` | только читает: ничего не записывается | Б-9 | нигде — в `execute` нет записи | удалить |
| `course/uc/get-course-by-module.uc.test.ts:95` | moduleId не uuid — INPUT_VALIDATION | Б-8 | `домен: course/uc/get-course-by-module.uc.test.ts:24` | удалить |
| `course/uc/get-course-by-module.uc.test.ts:99` | system не допущен — UNAUTHORIZED | Б-9 | `домен: course/uc/get-course-by-module.uc.test.ts:24` (callers в Def); `платформа: …/use-case-from-def.test.ts:123` | удалить |
| `course/uc/get-course-by-module.uc.test.ts:107` | сбой репозитория — SERVER_INTERNAL | Б-9 | `платформа: …/use-case-from-def.test.ts:255` (исключение → SERVER_INTERNAL) | удалить |
| `course/uc/get-course-enrollment.uc.test.ts:44` | стартовый — первый модуль программы, а не метка этапа | Б-1 | `домен: course/course.ar.test.ts:102` | удалить |
| `course/uc/get-course-enrollment.uc.test.ts:57` | it.each draft/archived ×2: курс в статусе %s — записи нет | Б-1 | `домен: course/course.ar.test.ts:106` | удалить (2 кейса) |
| `course/uc/get-course-enrollment.uc.test.ts:66` | опубликован, но программа пуста — enrollable: false | Б-1 | `домен: course/course.ar.test.ts:110` | удалить |
| `course/uc/get-course-enrollment.uc.test.ts:76` | user не допущен (callers: system) — UNAUTHORIZED | Б-9 | `платформа: …/use-case-from-def.test.ts:123` + Def-тест входа | удалить |
| `course/uc/get-course-enrollment.uc.test.ts:84` | courseId не uuid — INPUT_VALIDATION | Б-8 | `домен: course/uc/get-course-enrollment.uc.test.ts:21` | удалить |
| `course/uc/get-course-enrollment.uc.test.ts:88` | только читает: ничего не записывается | Б-9 | нигде — в `execute` нет записи | удалить |
| `course/uc/get-courses-including-module.uc.test.ts:41` | архивный курс тоже учитывается | Б-1 | `домен: course/course.ar.test.ts:85` | удалить |
| `course/uc/get-courses-including-module.uc.test.ts:49` | черновой курс учитывается | Б-1 | `домен: course/course.ar.test.ts:85` | удалить |
| `course/uc/get-courses-including-module.uc.test.ts:79` | порядок courseIds сохраняется при обратном порядке ответа репозитория | Б-6 | `:68` того же файла (другой вход репозитория, то же правило) | удалить |
| `course/uc/get-courses-including-module.uc.test.ts:88` | курсы без модуля отбрасываются, остальные в порядке courseIds | Б-6 | `:35` (фильтр) + `:68` (порядок) того же файла | удалить |
| `course/uc/get-courses-including-module.uc.test.ts:100` | user не допущен (callers: system) — UNAUTHORIZED | Б-9 | `платформа: …/use-case-from-def.test.ts:123` | удалить |
| `course/uc/get-courses-including-module.uc.test.ts:112` | courseIds с не-uuid — INPUT_VALIDATION | Б-8 | `домен: course/uc/get-courses-including-module.uc.test.ts:21` | удалить |
| `course/uc/get-courses-including-module.uc.test.ts:116` | только читает: ничего не записывается | Б-9 | нигде — в `execute` нет записи | удалить |
| `course/uc/get-courses-starting-with-module.uc.test.ts:72` | архивный кандидат учитывается; неизвестный пропускается | Б-1 | `домен: course/course.ar.test.ts:85` + `course/uc/get-courses-including-module.uc.test.ts:55` (пропуск неизвестного) | удалить |
| `course/uc/get-courses-starting-with-module.uc.test.ts:83` | пустой список кандидатов — пусто | Б-12 | `:52` того же файла (та же ветка `filter`), репозиторий на пустом списке — `infra/course.json-repo.test.ts:391` | удалить |
| `course/uc/get-courses-starting-with-module.uc.test.ts:99` | модуль вне опубликованных программ — пусто | Б-1 | `домен: module-courses.dqs.test.ts:161` | удалить |
| `course/uc/get-courses-starting-with-module.uc.test.ts:109` | архивный курс первым в файле не участвует | Б-1 | `домен: module-courses.dqs.test.ts:166` | удалить |
| `course/uc/get-courses-starting-with-module.uc.test.ts:122` | fafa… перед cccc…: место берётся по fafa… — пусто | Б-1 | `домен: module-courses.dqs.test.ts:174` | удалить |
| `course/uc/get-courses-starting-with-module.uc.test.ts:131` | cccc… перед fafa…: a1a1… первый — кандидаты | Б-1 | `домен: module-courses.dqs.test.ts:181` | удалить |
| `course/uc/get-courses-starting-with-module.uc.test.ts:139` | a0a0… первый в fafa… — fafa… возвращается | Б-1 | `домен: module-courses.dqs.test.ts:144`, `:151` | удалить |
| `course/uc/get-courses-starting-with-module.uc.test.ts:149` | user не допущен — UNAUTHORIZED | Б-9 | `платформа: …/use-case-from-def.test.ts:123` | удалить |
| `course/uc/get-courses-starting-with-module.uc.test.ts:161` | courseIds с не-uuid — INPUT_VALIDATION | Б-8 | `домен: course/uc/get-courses-starting-with-module.uc.test.ts:21` | удалить |
| `course/uc/get-courses-starting-with-module.uc.test.ts:165` | только читает: ничего не записывается | Б-9 | нигде — в `execute` нет записи | удалить |
| `course/uc/get-module-enrollment.uc.test.ts:47` | курсов нет — enrollable: false | Б-12 | `:41` того же файла (ветка «не найдено») | удалить |
| `course/uc/get-module-enrollment.uc.test.ts:51` | it.each draft/archived ×2: модуль в статусе %s — false | Б-1 | `домен: module-courses.dqs.test.ts:88`, `:97` | удалить (2 кейса) |
| `course/uc/get-module-enrollment.uc.test.ts:60` | модуль в архивном и в опубликованном курсе — true | Б-1 | `домен: module-courses.dqs.test.ts:110` | удалить |
| `course/uc/get-module-enrollment.uc.test.ts:69` | фикстурный случай С2: a1a1… в двух опубликованных — true | Б-1 | `домен: module-courses.dqs.test.ts:118` | удалить |
| `course/uc/get-module-enrollment.uc.test.ts:78` | user не допущен — UNAUTHORIZED | Б-9 | `платформа: …/use-case-from-def.test.ts:123` | удалить |
| `course/uc/get-module-enrollment.uc.test.ts:86` | moduleId не uuid — INPUT_VALIDATION | Б-8 | `домен: course/uc/get-module-enrollment.uc.test.ts:20` | удалить |
| `course/uc/get-module-place.uc.test.ts:50` | модуль вне курсов — пусто, не ошибка | Б-1 | `домен: module-courses.dqs.test.ts:105` | удалить |
| `course/uc/get-module-place.uc.test.ts:102` | it.each archived/draft ×2: курс в статусе %s не участвует | Б-1 | `домен: module-courses.dqs.test.ts:88` | удалить (2 кейса) |
| `course/uc/get-module-place.uc.test.ts:111` | только неопубликованный курс — пусто | Б-1 | `домен: module-courses.dqs.test.ts:97` | удалить |
| `course/uc/get-module-place.uc.test.ts:119` | гость допущен (реакция на событие) | Б-9 | `платформа: …/use-case-from-def.test.ts:179` | удалить |
| `course/uc/get-module-place.uc.test.ts:125` | moduleId не uuid — INPUT_VALIDATION | Б-8 | `домен: course/uc/get-module-place.uc.test.ts:24` | удалить |
| `course/uc/get-module-place.uc.test.ts:129` | system не допущен — UNAUTHORIZED | Б-9 | `платформа: …/use-case-from-def.test.ts:123` | удалить |
| `course/uc/get-module-place.uc.test.ts:137` | только читает: ничего не записывается | Б-9 | нигде — в `execute` нет записи | удалить |
| `course/uc/get-module-prerequisite.uc.test.ts:55` | только читает: ничего не записывается | Б-9 | нигде — в `execute` нет записи | удалить |
| `course/uc/get-module-prerequisite.uc.test.ts:77` | user не допущен — UNAUTHORIZED | Б-9 | `платформа: …/use-case-from-def.test.ts:123` | удалить |
| `course/uc/get-module-prerequisite.uc.test.ts:89` | без passedModuleIds — INPUT_VALIDATION | Б-8 | `домен: course/uc/get-module-prerequisite.uc.test.ts:27` | удалить |
| `course/uc/get-module-prerequisite.uc.test.ts:95` | moduleId не uuid — INPUT_VALIDATION | Б-8 | `домен: course/uc/get-module-prerequisite.uc.test.ts:27` | удалить |
| `course/uc/get-module-prerequisite.uc.test.ts:99` | сбой репозитория курсов — SERVER_INTERNAL | Б-9 | `платформа: …/use-case-from-def.test.ts:255` | удалить |
| `course/uc/get-same-modules.uc.test.ts:39` | среди кандидатов нет модуля — пусто | Б-6 | `:29` того же файла (инверсия `filter` ловится там) | удалить |
| `course/uc/get-same-modules.uc.test.ts:43` | пустой список кандидатов — пустой ответ | Б-12 | `:29` того же файла | удалить |
| `course/uc/get-same-modules.uc.test.ts:54` | user не допущен — UNAUTHORIZED | Б-9 | `платформа: …/use-case-from-def.test.ts:123` | удалить |
| `course/uc/get-same-modules.uc.test.ts:66` | moduleIds с не-uuid — INPUT_VALIDATION | Б-8 | `домен: course/uc/get-same-modules.uc.test.ts:21` | удалить |
| `course/uc/list-courses.uc.test.ts:45` | пустой список, если курсов нет | Б-12 | `:39` того же файла (порядок/пустой ответ) + `infra/course.json-repo.test.ts:462` | удалить |
| `course/uc/list-courses.uc.test.ts:61` | явный статус передаётся репозиторию | Б-6 | `:73` того же файла (фильтр «как есть» для всех полей) | слить в `:73` |
| `course/uc/list-courses.uc.test.ts:90` | выход содержит stages | Б-1 | `домен: course/course.ar.test.ts:295` | удалить |
| `course/uc/list-courses.uc.test.ts:109` | гость и пользователь получают один и тот же список | Б-9 | `платформа: …/use-case-from-def.test.ts:179`; `домен: course/course.ar.test.ts:305` | удалить |
| `course/uc/list-courses.uc.test.ts:117` | только читает: ничего не записывается | Б-9 | нигде — в `execute` нет записи | удалить |
| `course/uc/list-courses.uc.test.ts:125` | it.each ×3: `limit 0` / статус вне перечня / `authorId` не uuid — INPUT_VALIDATION | Б-8 | `домен: course/uc/list-courses.uc.test.ts:24` + `:43` | удалить (3 кейса) |
| `course/uc/list-courses.uc.test.ts:133` | system не допущен — UNAUTHORIZED | Б-9 | `платформа: …/use-case-from-def.test.ts:123` | удалить |
| `course/uc/list-courses.uc.test.ts:141` | сбой репозитория — SERVER_INTERNAL | Б-9 | `платформа: …/use-case-from-def.test.ts:255` | удалить |
| `infra/course.json-repo.test.ts:122` | курс без этапов и с пустой программой сохраняется и читается | Б-1 | `домен: course/course.state.test.ts:209` + `:55` (round-trip) | удалить |
| `infra/course.json-repo.test.ts:134` | запись по устаревшей версии — VersionConflict | Б-9 | `платформа: app/uow/repository.test.ts:64` | удалить |
| `infra/course.json-repo.test.ts:402` | любой статус: архивный курс находится | Б-6 | `:352` того же файла (`findByIds` без фильтра статуса) | удалить |
| `infra/course.json-repo.test.ts:595` | запись без обязательного поля (нет moduleIds) — ValiError | Б-8 | `домен: course/course.state.test.ts:78` (`it.each` обязательных полей) + `:578` | удалить |
| `infra/course.json-repo.test.ts:614` | корень файла не массив — ValiError | Б-6 | `:578` того же файла (та же ветка `v.parse`, тот же ассерт «файл не изменён») | удалить |
| `infra/lesson.json-repo.test.ts:173` | запись по устаревшей версии — VersionConflict | Б-9 | `платформа: app/uow/repository.test.ts:64` | удалить |
| `infra/lesson.json-repo.test.ts:285` | запись без обязательного поля (нет stepIds) — ValiError | Б-8 | `домен: lesson/lesson.state.test.ts:125` + `:266` | удалить |
| `infra/lesson.json-repo.test.ts:306` | корень файла не массив — ValiError | Б-6 | `:266` того же файла | удалить |
| `infra/module.json-repo.test.ts:123` | запись по устаревшей версии — VersionConflict | Б-9 | `платформа: app/uow/repository.test.ts:64` | удалить |
| `infra/module.json-repo.test.ts:397` | limit — срез после фильтра | Б-6 | `:386` того же файла (limit после сортировки) | слить в `:386` |
| `infra/module.json-repo.test.ts:425` | запись без обязательного поля (нет projects) — ValiError | Б-8 | `домен: module/module.state.test.ts:70` + `:408` | удалить |
| `infra/module.json-repo.test.ts:444` | корень файла не массив — ValiError | Б-6 | `:408` того же файла | удалить |
| `infra/step.json-repo.test.ts:231` | запись по устаревшей версии — VersionConflict | Б-9 | `платформа: app/uow/repository.test.ts:64` | удалить |
| `infra/step.json-repo.test.ts:338` | неизвестный kind — ValiError | Б-8 | `домен: step/step.state.test.ts:157` | удалить |
| `infra/step.json-repo.test.ts:348` | code без code — ValiError | Б-8 | `домен: step/step.state.test.ts:128` | удалить |
| `infra/step.json-repo.test.ts:370` | корень файла не массив — ValiError | Б-6 | `:319` того же файла | удалить |
| `lesson/uc/get-lesson.uc.test.ts:50` | опубликованный урок виден студенту | Б-1 | `:40` того же файла (та же ветка `viewFor`) | удалить |
| `lesson/uc/get-lesson.uc.test.ts:60` | администратор видит чужой DRAFT урок | Б-1 | `домен: module/module.policy.test.ts:18` + `:55` (проводка права) | удалить |
| `lesson/uc/get-lesson.uc.test.ts:65` | автор видит archived урок | Б-1 | `домен: module/module.policy.test.ts:24` + `:55` | удалить |
| `lesson/uc/get-lesson.uc.test.ts:70` | published виден гостю, даже если модуль в черновике | Б-1 | `домен: lesson/lesson.ar.test.ts:36` (`PUBLISHED → урок` без права) | удалить |
| `lesson/uc/get-lesson.uc.test.ts:77` | представление: шаги, время, даты числами, version | Б-1 | `домен: lesson/lesson.ar.test.ts:46` | удалить |
| `lesson/uc/get-lesson.uc.test.ts:99` | урок только читается | Б-9 | нигде — в `execute` нет записи | удалить |
| `lesson/uc/get-lesson.uc.test.ts:132` | it.each ×5 (гость/студент/чужой ментор на draft, гость/студент на archived) — ACCESS_DENIED | Б-1 | `домен: module/module.policy.test.ts:46`, `:52`, `:58`; `denyMessage` — `:68` | переписать: оставить 1 кейс проводки отказа |
| `lesson/uc/get-lesson.uc.test.ts:153` | автор другого модуля не видит DRAFT | Б-1 | `домен: module/module.policy.test.ts:52` + оставленный кейс `:132` | удалить |
| `lesson/uc/get-lesson.uc.test.ts:162` | автор модуля видит DRAFT, даже если модуль в черновике | Б-1 | `:55` того же файла (автор видит свой DRAFT) | удалить |
| `lesson/uc/get-lesson.uc.test.ts:169` | system не допущен — UNAUTHORIZED | Б-9 | `платформа: …/use-case-from-def.test.ts:123` | удалить |
| `lesson/uc/get-lesson.uc.test.ts:179` | неверный uuid во входе — INPUT_VALIDATION | Б-8 | `домен: lesson/uc/get-lesson.uc.test.ts:50` | удалить |
| `lesson/uc/get-lesson.uc.test.ts:183` | прежнее имя поля uuid во входе (Т8) | Б-8 | `домен: lesson/uc/get-lesson.uc.test.ts:54` (`{ uuid }` — отказ) | удалить |
| `module/uc/get-module-snapshot.uc.test.ts:88` | it.each ×5 (гость/студент/автор/админ/система) — снимок опубликованного модуля | Б-6 | `:70` того же файла (все 5 строк — одна ветка: published не зависит от субъекта) | удалить (5 кейсов) |
| `module/uc/get-module-snapshot.uc.test.ts:102` | автор и админ черновика получают снимок опубликованной части | Б-1 | `домен: module-snapshot.dqs.test.ts:84`, `:93` + `:116` (доступ автора к черновику) | удалить |
| `module/uc/get-module-snapshot.uc.test.ts:155` | только читает: ничего не записывается | Б-9 | нигде — в `execute` нет записи | удалить |
| `module/uc/get-module-snapshot.uc.test.ts:174` | it.each ×5 — ACCESS_DENIED «Нет доступа к модулю» | Б-1 | `домен: module/module.policy.test.ts:46`, `:58`, `:68` | удалить (5 кейсов; отказ держат `:198` и Policy) |
| `module/uc/get-module-snapshot.uc.test.ts:231` | сбой репозитория уроков — SERVER_INTERNAL | Б-6 | `:223` того же файла (сбой не маскируется своей ошибкой — то же правило) | удалить |
| `module/uc/get-module-snapshot.uc.test.ts:240` | неверный uuid во входе — INPUT_VALIDATION | Б-8 | `домен: module/uc/get-module-snapshot.uc.test.ts:49` | удалить |
| `module/uc/get-module-snapshot.uc.test.ts:246` | facade.serves — true; вызов через фасад от system отдаёт снимок | Б-9 | `платформа: app/facade/module-facade.test.ts:69`; сценарий — `:70` | удалить |
| `module/uc/get-module.uc.test.ts:50` | админ видит чужой черновик | Б-1 | `домен: module/module.policy.test.ts:18` + `:45` (проводка права) | удалить |
| `module/uc/get-module.uc.test.ts:55` | автор видит archived | Б-1 | `домен: module/module.policy.test.ts:24` + `:45` | удалить |
| `module/uc/get-module.uc.test.ts:60` | студент видит опубликованный модуль | Б-1 | `:35` того же файла | удалить |
| `module/uc/get-module.uc.test.ts:65` | у опубликованного модуля только опубликованные проекты | Б-1 | `домен: module/module.ar.test.ts:58` | удалить |
| `module/uc/get-module.uc.test.ts:78` | у опубликованного модуля все проекты, включая черновые | Б-1 | `домен: module/module.ar.test.ts:93` | удалить |
| `module/uc/get-module.uc.test.ts:106` | it.each ×5 (гость/студент/чужой ментор на черновике, гость/студент на archived) — ACCESS_DENIED | Б-1 | `домен: module/module.policy.test.ts:46`, `:58`, `:68` | переписать: оставить 1 кейс проводки отказа |
| `module/uc/get-module.uc.test.ts:127` | system не допущен — UNAUTHORIZED | Б-9 | `платформа: …/use-case-from-def.test.ts:123` | удалить |
| `module/uc/get-module.uc.test.ts:137` | неверный uuid во входе — INPUT_VALIDATION | Б-8 | нигде: Def-теста `getModule` в домене нет (`домен: module/uc/get-module.uc.test.ts` отсутствует) | перенести в домен |
| `module/uc/list-modules.uc.test.ts:59` | студент: чужие черновики отбрасываются | Б-1 | `домен: module/module.policy.test.ts:58` + `:46` (тот же цикл отбора) | удалить |
| `module/uc/list-modules.uc.test.ts:81` | админ видит всё | Б-1 | `домен: module/module.policy.test.ts:18` + `:68` | удалить |
| `module/uc/list-modules.uc.test.ts:91` | пустой список | Б-12 | `:37` того же файла (пустой ответ репозитория) | удалить |
| `module/uc/list-modules.uc.test.ts:107` | элемент — ModuleSummary: uuid, title, description, status, tags; без проектов | Б-1 | `домен: module/module.ar.test.ts:116` | удалить |
| `module/uc/list-modules.uc.test.ts:142` | только status — фильтр `{ status }` | Б-6 | `:126` того же файла (все условия «как есть») | удалить |
| `module/uc/list-modules.uc.test.ts:162` | limit не добирает видимые: все выбранные невидимы — `[]` | Б-6 | `:150` того же файла (limit до отбора видимых — та же ветка) | удалить |
| `module/uc/list-modules.uc.test.ts:170` | гость допущен | Б-9 | `платформа: …/use-case-from-def.test.ts:179` | удалить |
| `module/uc/list-modules.uc.test.ts:176` | system не допущен — UNAUTHORIZED | Б-9 | `платформа: …/use-case-from-def.test.ts:123` | удалить |
| `module/uc/list-modules.uc.test.ts:186` | authorId не uuid — INPUT_VALIDATION | Б-8 | нигде: Def-теста `listModules` в домене нет | перенести в домен |
| `module/uc/list-modules.uc.test.ts:192` | limit не число — INPUT_VALIDATION | Б-8 | нигде: Def-теста `listModules` в домене нет | перенести в домен |
| `step/uc/get-steps-by-lessons.uc.test.ts:65` | гость получает опубликованные шаги | Б-1 | `домен: lesson-steps.dqs.test.ts:99` | удалить |
| `step/uc/get-steps-by-lessons.uc.test.ts:88` | it.each ×3 (гость/студент/чужой ментор): draft и archived пропускаются | Б-1 | `домен: lesson-steps.dqs.test.ts:99`; проводка права — `:117` того же файла | удалить (3 кейса) |
| `step/uc/get-steps-by-lessons.uc.test.ts:97` | it.each ×2 (автор/админ): шаги всех статусов по порядку | Б-1 | `домен: lesson-steps.dqs.test.ts:108`; порядок — `:51` того же файла | удалить (2 кейса) |
| `step/uc/get-steps-by-lessons.uc.test.ts:186` | неверный uuid в списке — INPUT_VALIDATION | Б-8 | `домен: step/uc/get-steps-by-lessons.uc.test.ts:26`, `:43` | удалить |
| `step/uc/get-steps-by-lessons.uc.test.ts:190` | system не допущен — UNAUTHORIZED | Б-9 | `платформа: …/use-case-from-def.test.ts:123` | удалить |
| `step/uc/get-steps-by-lessons.uc.test.ts:198` | только читает: ничего не записывается | Б-9 | нигде — в `execute` нет записи | удалить |
| `step/uc/get-step.uc.test.ts:47` | опубликованный шаг виден студенту | Б-1 | `:37` того же файла | удалить |
| `step/uc/get-step.uc.test.ts:57` | администратор видит чужой DRAFT шаг | Б-1 | `домен: module/module.policy.test.ts:18` + `:52` | удалить |
| `step/uc/get-step.uc.test.ts:62` | автор видит archived шаг | Б-1 | `домен: module/module.policy.test.ts:24` + `:52` | удалить |
| `step/uc/get-step.uc.test.ts:67` | published виден гостю, даже если модуль в черновике | Б-1 | `домен: step/step.ar.test.ts:90` | удалить |
| `step/uc/get-step.uc.test.ts:74` | text: content и kind; даты числами, version | Б-1 | `домен: step/step.ar.test.ts:60` | удалить |
| `step/uc/get-step.uc.test.ts:83` | code: код и язык | Б-1 | `домен: step/step.ar.test.ts:75` | удалить |
| `step/uc/get-step.uc.test.ts:104` | file: метаданные файла | Б-1 | `домен: step/step.ar.test.ts:81` | удалить |
| `step/uc/get-step.uc.test.ts:126` | шаг только читается | Б-9 | нигде — в `execute` нет записи | удалить |
| `step/uc/get-step.uc.test.ts:151` | it.each ×5 — ACCESS_DENIED | Б-1 | `домен: module/module.policy.test.ts:46`, `:58`, `:68` | переписать: оставить 1 кейс проводки отказа |
| `step/uc/get-step.uc.test.ts:172` | автор другого модуля не видит DRAFT | Б-1 | `домен: module/module.policy.test.ts:52` + оставленный кейс `:151` | удалить |
| `step/uc/get-step.uc.test.ts:181` | system не допущен — UNAUTHORIZED | Б-9 | `платформа: …/use-case-from-def.test.ts:123` | удалить |
| `step/uc/get-step.uc.test.ts:191` | неверный uuid во входе — INPUT_VALIDATION | Б-8 | `домен: step/uc/get-step.uc.test.ts:47` | удалить |
| `step/uc/get-step.uc.test.ts:195` | прежнее имя поля uuid во входе (Т8) | Б-8 | `домен: step/uc/get-step.uc.test.ts:51` | удалить |

Итог таблицы (144 строки = 173 теста, часть строк — `it.each` с несколькими кейсами):

| действие | строк | тестов |
|---|---|---|
| удалить | 136 | 153 |
| слить | 2 (`course/uc/list-courses.uc.test.ts:61` → `:73`; `infra/module.json-repo.test.ts:397` → `:386`) | 2 |
| переписать | 3 (`it.each` ACCESS_DENIED: `lesson/uc/get-lesson.uc.test.ts:132`, `module/uc/get-module.uc.test.ts:106`, `step/uc/get-step.uc.test.ts:151` — оставить по одному кейсу на UC) | 15, останется 3 |
| перенести в домен | 3 (`module/uc/get-module.uc.test.ts:137`, `module/uc/list-modules.uc.test.ts:186`, `:192`) | 3 |

Если принять таблицу целиком: в модуле останется **160 тестов** (330 − 153 − 2 − 12 − 3), файл `course.module.test.ts` удаляется, новых файлов в модуле не появляется; в домене — 2 новых файла Def-тестов (`getModule`, `listModules`), если п. 4 открытых вопросов решён положительно.

## 4. Полезные тесты

По одной строке на файл (157 тестов):
- `course.module.serves.test.ts` — `:17` единственный тест состава: карта = 16 Def UC (единственное, что не проверит компилятор, — литерал 16).
- `course.module.test.ts` — полезных нет: все три — платформа и сценарий UC-потребителя, покрытый `course/uc/get-course-enrollment.uc.test.ts:35`.
- `course/uc/get-course.uc.test.ts` — `:41` сквозной сценарий (load → `view()`), `:82` курс без этапов (§6), `:96` своя ошибка `COURSE_NOT_FOUND`, `:118` сбой не маскируется под «не найден».
- `course/uc/get-course-by-module.uc.test.ts` — `:40` сквозной, `:46` выборка без фильтра статуса (нигде больше не проверено: если UC начнёт фильтровать по `published`, упадёт только он).
- `course/uc/get-course-enrollment.uc.test.ts` — `:35` сквозной, `:72` «курс не найден — enrollable: false, не ошибка».
- `course/uc/get-courses-including-module.uc.test.ts` — `:35` сквозной, `:55` неизвестный курс пропускается, `:59` пустой вход без обращения к репозиторию, `:68` порядок из входа.
- `course/uc/get-courses-starting-with-module.uc.test.ts` — `:52` сквозной, `:58` отбрасывание кандидатов без модуля, `:64` порядок, `:91` «не первый → пусто и кандидаты не читаются» (ранний выход).
- `course/uc/get-module-enrollment.uc.test.ts` — `:35` `true`-ветка, `:41` `false`-ветка (`undefined` → `enrollable: false`).
- `course/uc/get-module-place.uc.test.ts` — `:94` загрузка только опубликованных курсов (фильтр), этапы-метки `:46`/`:56`/`:74` — §6.
- `course/uc/get-module-prerequisite.uc.test.ts` — `:33` фильтр загрузки, `:41` модули отдельным запросом, `:64` вердикт `previous-not-passed` с названием / `admitted`.
- `course/uc/get-same-modules.uc.test.ts` — `:29` равенство, `:33` повторы сохраняются (D-65: фильтр, а не `uniq`), `:47` репозитории не читаются (ответ — свойство входа).
- `course/uc/list-courses.uc.test.ts` — `:39` сквозной, `:49` умолчание `status ?? 'published'` (своя логика UC), `:73` фильтры «как есть».
- `infra/course.json-repo.test.ts` — `:55`/`:89`/`:105` round-trip и форма записи, `:73` чтение не создаёт файл, `:83` фильтр по uuid, `:352`–`:391` `findByIds` (порядок файла, пропуск, дедуп, нет файла), `:451`–`:562` `findAll` (фильтры, sort, направление, limit), `:578`/`:602` битая запись и битый JSON (файл не изменён); `:245`/`:262`/`:314`×7/`:328` — строгое чтение, §6 не трогать.
- `infra/lesson.json-repo.test.ts` — `:50`/`:82`/`:96` round-trip и форма записи, `:68` чтение не создаёт файл, `:119`–`:160` `findByIds`, `:266`/`:294` битая запись и битый JSON; `:204`/`:218`/`:230`/`:243` — legacy, §6.
- `infra/module.json-repo.test.ts` — `:60`/`:93`/`:107` round-trip, `:77` нет файла при чтении, `:265`–`:386` `findAll` (порядок файла, фильтры, tags-пересечение, sort, направление, limit), `:408`/`:432` битая запись и битый JSON; `:163`–`:201` — legacy, §6.
- `infra/step.json-repo.test.ts` — `:49`/`:81`/`:99` round-trip, `:115` `code` без `content` (44 шага в данных), `:138` `file` с описанием и без, `:177`–`:218` `findByIds`, `:319`/`:358` битая запись и битый JSON; `:258`–`:296` — legacy, §6.
- `lesson/uc/get-lesson.uc.test.ts` — `:40` сквозной, `:55` проводка права (автор видит DRAFT), `:105` модуль спрашивается по `moduleId` урока, `:113` `LESSON_NOT_FOUND`, `:121` `MODULE_NOT_FOUND` владельца.
- `module/uc/get-module-snapshot.uc.test.ts` — `:70` сквозной, `:116` субъект system→`person` на черновике, `:126` уроки одним запросом без повторов, `:146` шаги не читаются (С1), `:164` `MODULE_NOT_FOUND`, `:198` отказ system-ментору, `:212` при отказе уроки не читаются, `:223` сбой не маскируется под «не найден».
- `module/uc/get-module.uc.test.ts` — `:35` сквозной, `:45` проводка права (автор видит свой DRAFT), `:96` `MODULE_NOT_FOUND`.
- `module/uc/list-modules.uc.test.ts` — `:37` сквозной, `:46` отбор видимых молча, `:68` право по автору (отличает Policy от проверки статуса), `:97` порядок репозитория, `:126` фильтры «как есть», `:150` limit применяется до отбора видимых (Т6).
- `step/uc/get-steps-by-lessons.uc.test.ts` — `:51` сквозной (`uuid`+`description`), `:117` право по модулю каждого шага, `:131` модуль шага не найден — шаг пропускается, `:146` два запроса без N+1, `:161` модуль спрашивается один раз, `:178` нет уроков — модули не читаются.
- `step/uc/get-step.uc.test.ts` — `:37` сквозной, `:52` проводка права, `:134` `STEP_NOT_FOUND`, `:142` `MODULE_NOT_FOUND` владельца.

## 5. Открытые вопросы

1. **`course.module.test.ts` целиком (3 теста).** Все — платформа (`facade.serves`/`calls`) и один сценарий чужого UC; прецедент — `modules/questionnaire/src/questionnaire.module.test.ts:169` и его `probe`-блок удалены в Ф7 ([`deferred-delete.md`](./deferred-delete.md), раздел «Удаляемое вместе с тестами»). Рекомендация: удалить файл целиком (вместе с `probe`-модулём внутри него); состав модуля держит `course.module.serves.test.ts:17` + `домен: course.module.test.ts:31`.
2. **§6 «тесты этапов-меток не трогать».** Читаю двояко: (а) это защита доменных тестов `course.ar.test.ts`, тогда 4 UC-теста (`course/uc/get-course.uc.test.ts:82`, `course/uc/get-module-place.uc.test.ts:46`, `:56`, `:74`) — дубли `домен: course/course.ar.test.ts:301`/`:219`/`:223`/`:237` и кандидаты; (б) защита любого теста про этапы — тогда они остаются. В таблице взял (б) (помечены полезными). Рекомендация: подтвердить (б) — правило «этапы вместо меток» свежее (D-64), дубль дешёвый.
3. **Тексты `label` ошибок (TST-09) в 4 полезных тестах:** `course/uc/get-course.uc.test.ts:96`, `lesson/uc/get-lesson.uc.test.ts:113`, `step/uc/get-step.uc.test.ts:134`, `module/uc/get-module.uc.test.ts:96` проверяют и `kind`/`payload`, и `label`. Рекомендация: оставить тесты, снять assert `label` (текст держат доменные тесты ошибок, напр. `домен: step/step.ar.test.ts:127`).
4. **Схемы `getModule` и `listModules` в домене не проверены** (`домен: module/uc/get-module.uc.test.ts`, `…/list-modules.uc.test.ts` отсутствуют) — поэтому 3 теста схемы в модуле (`module/uc/get-module.uc.test.ts:137`, `module/uc/list-modules.uc.test.ts:186`, `:192`) помечены «перенести», а не «удалить». Решение (новый файл в домене) — за orchestrator: удаление без переноса оставит `input` этих Def без единой проверки.
5. **`it.each` ACCESS_DENIED (20 тестов в 4 файлах).** После чистки предлагаю оставить по одному кейсу на UC как проводку отказа Policy → `ACCESS_DENIED`, без `denyMessage` (текст держит `домен: module/module.policy.test.ts:68`). Альтернатива — не оставлять ничего: тогда «отказ доходит до вызывающего» не проверяется нигде, кроме `module/uc/get-module-snapshot.uc.test.ts:198`.
6. **`module/uc/get-module-snapshot.uc.test.ts:88` — 5 вызывающих на published.** Все 5 строк проходят одну ветку (`published` виден всем, решение Policy на результат не влияет). Предлагаю удалить блок целиком; если нужен один — оставить `гость` (самый узкий случай).
7. **Инварианты `infra/course.json-repo.test.ts` (`:245`, `:262`, `:314`×7, `:328` — 10 тестов) дублируют `домен: course/course.state.test.ts:209`/`:221`, но §6 запрещает трогать.** Подтвердить, что они остаются как защита данных, и внести строку «осознанно оставлено» в журнал `test-bloat.md` §3 (перенос — orchestrator, TST-08/§4).

## Проверка

`cd modules/course && bun test` → **330 pass, 0 fail, 500 expect(), 22 files** (база совпадает; файлы и код не менялись, прогон сделан до и после инвентаризации).
