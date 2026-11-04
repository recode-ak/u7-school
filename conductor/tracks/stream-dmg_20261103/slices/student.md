# Бриф среза: `stream` / `student`

Черновик — `tech-lead`, Ф2. Проверка — orchestrator. Читать вместе с `../spec.md`, `../plan.md` (Ф2), `slices/stream.md` (Ф1, TR-41, TR-42), эталоном `wish` и `node_modules/dmg-core/docs/guides/{job,use-case,aggregate,policy}.md`.

Код студента в `v0.2.6` лежит в worktree `../u7-school-v0.2.6` (пакет `stream`, `src/{api,domain}/student`) и совпадает с HEAD с точностью до импортов. Поэтому характеризация строится на текущих тестах как ожиданиях для нового кода.

> **Статус:** принят. С1 — (a), С2 — (a), С3 — да, С4 — да; Т1–Т14 — по рекомендациям. Всё — TR-43 в `debt.md`.

## Расхождения spec/plan с кодом

1. **Job требует снять `external` в Ф2, а не в Ф3.**
   - У внешнего модуля ER и Job не объявляются: `dmg-core/src/arch/def-checker.ts:152-154` (MAN-06, `checkDefs`).
   - `StreamModuleDef` сейчас внешний: `domain/src/stream/stream.module.ts:23`.
   - Без `external` в проверку попадает весь `domain/src/stream`. Это значит:
     - legacy-импорты чужого `index` запрещены (`checkContractImports`): `stream-ds.ts:2-3`, `stream/entity.ts:2`, `stream/policy.ts:1-2`, `student/policy.ts:1`, `module.ts:3-4`, `index.ts:2-3`;
     - бот больше не может импортировать `@u7-scl/stream/domain` (ARC-08, D-52).
   - План (Ф3, задачи 1–3) этого не учитывает. Предлагаю Т1.
2. **Критерий Ф2 «DEBT-1, 2, 5 в части stream — маркеров нет» противоречит задачам Ф3.** Ф3 удаляет `domain/src/stream/module.ts` (DEBT-2) и переводит миры и скрипты на типы Def. До этого им нужны legacy-типы `Stream`, `Student`, `StreamStatus` из `{stream,student}/entity.ts` (DEBT-5, `v.isoDateTime`):
   - `tests/worlds/types.ts:7`, `builder.ts:11`, `invariants.ts:2`;
   - `scripts/update-stream-snapshot.ts:17`, `stream-snapshot-sync.ts:3`;
   - `tests/helpers/test-app.ts:9,19`, `platform/app/src/u7-app-meta.ts:5`.

   Предлагаю Т1: в Ф2 гасятся DEBT-1 и DEBT-10 полностью, DEBT-5 и DEBT-2 сужаются до оболочки и гасятся в Ф3.
3. **Расчёты UI через DQS в stories невозможны.** Stories видят только `contract` (D-45, ARC-08), а в контракте нет классов, DQS и Ar. Об этом прямо сказано в `domain/src/peer-review/contract.ts:2-3`. Сейчас UI создаёт `new StudentAr(...)` и вызывает `StreamDs.*` (`hub.ts:128`, `monitor.ts:116-449`, `view-stream.story.ts:468-688`, `learning/shared.ts:251-345`). Это вопрос С1.
4. **Адрес через `GetTelegramAddressesUcDef` из story недоступен.** У этого UC `callers: ['system']` (`domain/src/user/user/uc/get-telegram-addresses.uc.ts:21`), а story без актора зовёт как гость (`u7-bot-ui-story.ts:181`). Это вопрос С2.
5. **У `student.inactivity-remove-candidate` в payload есть `wasWarned`** (`domain/src/stream/student/events.ts:94`). Без него пропадёт строка «ℹ️ Уведомления были ранее отправлены студенту» (`inactivity.story.ts:110-112`). По букве spec п. 8 в событии «только id и `days`». Оставляем `wasWarned` (Т5).
6. **`complete-student` с исходом `abandoned` уведомления студенту не слал** (`complete-student-uc.ts:62-64,79-82`). `mark-abandoned` шлёт всегда (`mark-abandoned-uc.ts:70`), а UI вызывает его только с `cause: 'inactivity'` (`monitor.ts:59`, `inactivity.story.ts:235`). После п. 2 (`abandoned` убран из `complete`) monitor будет вызывать `markAbandoned({ cause: 'by_mentor' })`. Чтобы студент не получил новое уведомление, story отправляет его только при `cause = 'inactivity'` (Т6).
7. **У правил UC нет входа.** `checkRules(loaded & fetched)` в `dmg-core/src/app/use-case/use-case-from-def.ts:243-249`. Кодовое слово попадает в правило только через контекст `load` (Т7).
8. **`streams/controller.ts` уже без `new StudentAr`** (Ф1, `controller.ts:56-58` — `inProgress` из `getStreamMembers`). Пункт plan выполнен.
9. **`scripts/gen-e2e.e2e.ts` не потребитель потока.** `complete-student` там — имя пробного модуля `genprobe` (`:52`). Пункт plan ложный, задачи нет.
10. **Правки UI вне списка plan:**
    - `stream-catalog.story.ts` (`StreamStatus` из barrel'а) и все импорты `@u7-scl/stream/domain` в `runners/u7-bot/src` переходят на `@u7-scl/domain/stream/contract` (следствие п. 1);
    - `scripts/call-uc.ts:68` упоминает legacy-UC `stream`.
11. **Legacy-UC без проверок:**
    - `complete-step` не проверяет, что студент свой: `StudentPolicy.canCompleteStep` объявлен, но не используется (`complete-step-uc.ts:49-52`, `student/policy.ts:22-24`);
    - `complete-student`/`mark-abandoned` проверяют ментора потока `input.streamId`, но не сверяют его с `student.streamId` (`complete-student-uc.ts:48`, `mark-abandoned-uc.ts:50`).

    См. Т8.
12. **Смена имени Job** `inactivity-sweep` на имя Def меняет ключ в `data/jobs/last-runs.json`. Поведение первого запуска (misfire) проверяет data-keeper.

## Границы

**Домен `domain/src/stream`:**
- `student/**` — новые файлы по таблице «Было → станет»;
- `stream/stream.ar.ts` — только новые вопросы (решение 4);
- `stream-launch.dcs.ts`, `step-completion.dcs.ts`, `student-progress.dqs.ts`, `stream-members.dqs.ts` — новые;
- `stream.module.ts`, `contract.ts`, `index.ts`;
- удаление legacy по «Было → станет»;
- `module.ts`, `{stream,student}/entity.ts` — только сужение (Т1).

**Прикладной слой `modules/stream/src`:**
- `student/**` — новое;
- `infra/student.json-repo.ts`;
- `stream.module.ts`;
- `stream/uc/{activate,complete,get-stream-members}-stream*.uc.ts`;
- удаление legacy;
- `api/module.ts` — пустая оболочка (Т1).

**Вне пакета:**
- `domain/src/course/{contract.ts,course.module.ts,course/uc/get-module-prerequisite.uc.ts}`, `modules/course/src/{course.module.ts,course/uc/get-module-prerequisite.uc.ts}`;
- `platform/app/src/u7-app.ts` и `platform/app/tests/u7-app.test.ts`;
- stories из шага 5;
- тесты бота, ER `wish`/`peer-review` — только тесты (код ER не меняется);
- `runners/u7-bot/tests/worlds/invariants.ts` — снять `STUDENT_ROLE_MISMATCH`.

**Не трогать:**
- `data/`;
- `modules/user/**` и `domain/src/user/**` (кроме ответа на С2);
- `scripts/{update-stream-snapshot,stream-snapshot-sync}.ts` — Ф3;
- `tests/worlds/{builder,types,materializer}.ts` — Ф3;
- ARC-07 в `biome.json` — Ф3;
- код `dmg-core` (нужна правка — эскалация).

## Решения брифа

1. **State** `student/student.state.ts` (`...BaseEntityFields`, DOM-11/12):
   - `streamId`, `userId`, `currentStepId` — `F.uuid`;
   - `enrolledAt` — `F.timestamp`;
   - `status` — picklist `enrolled | active | abandoned | advanced | not_advanced`;
   - `abandonDetails?` — `{ who, cause }`;
   - `completionDetails?` — `{ nextPreference }` (остаётся: формат записей не меняется);
   - `steps` — `[{ stepId, status: issued|completed, issuedAt: F.timestamp, completedAt?: F.timestamp }]`;
   - `notices?` — `[{ kind, sentAt: F.timestamp }]`.

   Legacy-запись читается так: ISO, в том числе `YYYY-MM-DDTHH:mm`, становится числом в UTC (`dmg-core/src/kernel/fields/fields.ts:7-9`); нет `updatedAt` → берётся `createdAt`; нет `version` → `version = 0`.
2. **`StudentArDef`** (`student/student.ar.ts`), статусы как в state. Переходы:

   | Переход | Из | В | Отказ |
   |---|---|---|---|
   | `activate` | `enrolled` | `active` | иначе `STUDENT_NOT_ENROLLED` |
   | `drop` | `enrolled`, `active` | `abandoned` | иначе `STUDENT_NOT_STUDYING` |
   | `abandon` | `enrolled`, `active` | `abandoned` | иначе `STUDENT_NOT_STUDYING` |
   | `advance` | `active`, `advanced`, `not_advanced` | `advanced` | `enrolled`, `abandoned` — `STUDENT_NOT_COMPLETABLE` |
   | `notAdvance` | `active`, `advanced`, `not_advanced` | `not_advanced` | `enrolled`, `abandoned` — `STUDENT_NOT_COMPLETABLE` |

   Переходы «в себя» допускает `aggregate.ts:168`.
3. **`StudentAr`** (DOM-02/03/04/14/17, без `#` и геттеров):
   - **Создание и восстановление.** `static enroll({ uuid, streamId, userId, moduleId, firstStepId }, at)` → `Result` и событие `enrolled`: `steps: []`, `currentStepId = firstStepId`, `enrolledAt = at`. Плюс `restore`.
   - **Операции:**
     - `activate(at)` — сбрасывает `notices`;
     - `drop(at)` и `markAbandoned(cause, at)` — `abandonDetails`, событие `abandoned`;
     - `complete(outcome: 'advanced' | 'not_advanced', moduleId, at)` — `completionDetails: { nextPreference: 'undecided' }`, событие `completed`;
     - `issueStep(stepId, at)` — `change`; шаг уже выдан → `STUDENT_STEP_ALREADY_ISSUED`;
     - `completeStep(stepId, nextStepId | undefined, at)` → `Result<'completed' | 'already_completed' | 'finished'>`, логика `a-root.ts:406-451`; шаг не выдан → `STUDENT_STEP_NOT_ISSUED`;
     - `noticeInactivity(at)` — решение 9.
   - **Вопросы:** `isOwnedBy(userId)`, `belongsToStream(streamId)`, `isInProgress()`, `isEnrolled()`, `isTerminal()`, `isPassed()`, `neverStarted()`, `hasNoSteps()`, `outcomeCategory()`, `outcomeSigns()`, `needsInactivityNotice(at)`, `view()`.
   - **Удаляются:** `setNextPreference`, `computeLagLevel`, `isLaggingFromMedian` (переходят в DQS), `getLastNotice`, геттеры `status`/`abandonDetails`/`completionDetails`/`lastActivityAt`.
4. **`StreamAr` — новые вопросы.** Вместо legacy `LegacyStreamAr` (`stream/a-root.ts:79-147`):
   - `moduleId(): string`;
   - `acceptsEnrollmentKey(key?: string): boolean` — ключа нет → `true`;
   - `teachesModule(moduleId): boolean`;
   - `stepPlace(stepId): StepPlace | undefined`, где `StepPlace = { nextStepId?, lessonId, projectId, lastInLesson, lastLessonInProject }` (заменяет `findNextStep` и `findStepContext`).
5. **Форма наружу `StudentView`** (D-60, по образцу `StreamView`, `stream.ar.ts:72-77`):
   - основа — `v.omit(StudentState, ['notices'])`;
   - плюс `outcome: { category, signs }`, `inProgress`, `enrolled`, `neverStarted`, `passed` (ответы вопросов Ar);
   - `StudentAr` задаёт `V = StudentView`.

   Схемы `StudentOutcomeCategory`/`CompletionSign`/`AbandonSign` — VO в контракте (их читает UI).
6. **События** (`student/student.events.ts`, публикует UoW агрегата):
   - `enrolled`, `completed`, `abandoned` — без изменений;
   - `inactivityWarning { studentId, userId, streamId, days }`;
   - `inactivityRemoveCandidate { studentId, userId, streamId, days, wasWarned }`.

   FQN — `stream.student.<ключ>` (MAN-08). `streamLegacyInbound` удаляется.
7. **Ошибки** (`student/student.errors.ts`, группа `STUDENT`, ERR-04). `label` статичен (Т14 Ф1):

   | Код | Вид | `label` |
   |---|---|---|
   | `NOT_FOUND` | not_found | «Студент не найден» |
   | `WRONG_ENROLLMENT_KEY` | validation | «Неверное кодовое слово» |
   | `ALREADY_STUDYING` | conflict | «Вы уже проходите обучение в другом потоке» |
   | `PREREQUISITE_NOT_PASSED` | conflict | «Сначала пройдите предыдущий модуль» |
   | `NO_STEPS` | conflict | «В потоке нет доступных шагов» |
   | `STEP_NOT_IN_STREAM` | validation | «Шаг не найден в структуре потока» |
   | `STEP_NOT_ISSUED` | conflict | «Нельзя завершить шаг: он не был выдан студенту.» |
   | `STEP_ALREADY_ISSUED` | conflict | — |
   | `NOT_ENROLLED` | conflict | — |
   | `NOT_STUDYING` | conflict | «Нельзя снять студента с учёбы: он уже не учится.» |
   | `NOT_COMPLETABLE` | conflict | «Нельзя завершить студента: он не учится.» |

   У `PREREQUISITE_NOT_PASSED` payload `{ moduleTitle }`.
8. **Policy** (`student/student.policy.ts`). Субъект — `Pick<User, 'uuid' | 'roles'>` из контракта `user` (TR-40).
   - `isSelf` — контекст `{ student }`, проверка `student.isOwnedBy(subject.uuid)`, отказ «Вы не можете выйти из чужого потока».
   - `canComplete` и `canMarkAbandoned` — `Rule.anyOf(ментор потока, ADMIN)`, контекст `{ student, stream: ReadonlyAr<StreamAr> }`. Тексты отказа: «Недостаточно прав для завершения студента» / «…для снятия студента с учёбы».
9. **Inactivity в Ar** (переносится из `inactivity-sweep-job.ts:80-154` дословно).
   - Пороги — экспортируемые константы `WARN_AFTER_DAYS=5`, `REMOVE_AFTER_DAYS=7`, `NOTICE_EVERY_DAYS=2` в `student.types.ts` (API-06).
   - `days` считается от последней активности по шагам или, если её нет, от `enrolledAt`.
   - `sentAt` округляется вниз до минуты, как legacy `slice(0,16)` (`a-root.ts:219`). Иначе повтор «через день» при дрожании расписания даёт 1 день.
10. **Правила зачисления** (`student/student.rules.ts`, D-40). Порядок в `rules` Def — как в legacy (`a-root.ts:42-77`):
    1. `enrollmentKeyAccepted` — `stream.acceptsEnrollmentKey(key)`;
    2. `notStudyingElsewhere` — ни одна запись пользователя не `isInProgress()`; поток значения не имеет;
    3. `prerequisitePassed` — по ответу `getModulePrerequisite` (решение 13): `none` → ок; `closed` → отказ с «предыдущий»; `module` → есть запись `isPassed()`, чей поток `teachesModule(prereq)`;
    4. `streamHasSteps` — `stream.firstStepId() !== undefined`.

    Контекст: `{ stream, enrollmentKey?, userStudents: ReadonlyAr<StudentAr>[], userStreams: ReadonlyAr<StreamAr>[], prerequisite }`. Факты — из Ar и Def UC `course`, entity `Course` не используется.
11. **DCS и DQS** (уровень модуля, по образцу `domain/src/wish/wish-fulfillment.dcs.ts`):
    - **`StreamLaunchDcs`** (С2 Ф1). `launch(stream, students, at)`: сначала `stream.activate`; затем каждому `isEnrolled()` — `activate`, каждому `hasNoSteps()` (без учёта статуса, `legacy-stream-students.ts:44-56`) — `issueStep(firstStepId)`. Возвращает изменённых для `uow.register`.
    - **`StepCompletionDcs`** — `completeStep` + `tryIssueTailStep` из `stream-ds.ts:29-140` над `stream.stepPlace`. `stepPlace` вызывается до `student.completeStep`, как в legacy (`:34-35`). Выход — `CompletionResult` (`types.ts:19-24`).
    - **`StudentProgressDqs`** — переносится из `StreamDs`: `computeProgress`, `buildNavigationTree`, `buildLessonSteps`, `computeProjectLevelProgress`, `computeStreamProjectProgress`, `getStepLessonProgress`, `computeStudentCard`, `computeStepTimeStats`, `computeAvgTime`, `computeStudentRowSummary`, плюс `stepPosition` (копия `course-ds.ts:91-115`: импорт `CourseDs` из `index` запрещён). Вход — `ReadonlyAr<StudentAr>` + `stream.view().contentSnapshot`, момент `at` — аргументом (DOM-14).
    - **`StreamMembersDqs`:**
      - `facts(students)` → `StreamStudentFact[]` для `studentsSettled`;
      - `roster(stream, students, at)` → выход `getStreamMembers` — `categorizeStudents` (`stream-ds.ts:403-478`) по всем студентам; медиана — только по учащимся, поэтому совпадает с legacy и для «только активных», и для «всех»;
      - схемы проекций — в `student.types.ts`, с `v.description` (MAN-02).
12. **Def UC** (`student/uc/*.uc.ts`, MAN-11):

    | Имя | Тип | `callers` | Policy | Вход → выход | `errors` / `rules` / `calls` / `emits` |
    |---|---|---|---|---|---|
    | `enrollStudent` | command | `user` | `allowAll` | `{ streamId, enrollmentKey? }` (С3) → `{ studentId }` | `STREAM_NOT_FOUND`; правила решения 10; `calls: [GetModulePrerequisiteUcDef]`; `emits: [enrolled]` |
    | `completeStep` | command | `user` | `isSelf` (Т8) | `{ studentId, streamId, stepId }` → `CompletionResult` | `NOT_FOUND`, `STREAM_NOT_FOUND`, `STEP_NOT_IN_STREAM`, `STEP_NOT_ISSUED` |
    | `completeStudent` | command | `user` | `canComplete` | `{ streamId, studentId, outcome: advanced\|not_advanced }` → `{}` | `NOT_FOUND`, `STREAM_NOT_FOUND`, `NOT_COMPLETABLE`; `emits: [completed]` |
    | `dropStudent` | command | `user` | `isSelf` | `{ streamId, studentId }` → `{}` | `NOT_FOUND`, `NOT_STUDYING`; `emits: [abandoned]` |
    | `markAbandoned` | command | `user` | `canMarkAbandoned` | `{ streamId, studentId, cause: inactivity\|by_mentor }` → `{}` | `NOT_FOUND`, `STREAM_NOT_FOUND`, `NOT_STUDYING`; `emits: [abandoned]` |
    | `getStudentByUser` | query | `user` | `allowAll` | `{ userId }` → `StudentView` | `NOT_FOUND` |
    | `getStudentProgress` | query | `user`, `guest` | `allowAll` | `{ studentId, stepId?, lessonId? }` → `{ student: StudentView, progress?: { module, projects, card, tree, step?, lesson? } }` (С1) | `NOT_FOUND` |
    | `getActiveStudent` | query | `user`, `guest` | `allowAll` | `{ userId }` → `{ student?: StudentView, stream?: StreamView }` | — |

    - `getStudentByUser` — сначала `isInProgress`, иначе первая `isTerminal` (`get-student-by-user-uc.ts:31-36`).
    - У `getStudentProgress` поля `step` и `lesson` заполняются только при переданных `stepId`/`lessonId`; нет потока — нет `progress`.
    - `getActiveStudent` — первая `isInProgress` и её поток.
    - `allowAll` у чтения — как в legacy: проверок нет (`get-student-progress-uc.ts:35`).
    - `getStreamMembers` (Ф1, п. 3 spec): выход дополняется полями `roster` (решение 11). Совместимо для `peer-review` — новые поля добавляются, старые не меняются. `list-stream-students` удаляется.
13. **Def UC `course` `getModulePrerequisite`** (TR-11, DEBT-44). Query, `callers: ['system']`, `allowAll`. Вход `{ moduleId }`, выход — variant по `gate`:
    - `none` — курса нет или модуль входной;
    - `module` — `{ moduleId, title }`;
    - `closed` — `getPrevModuleId === null`.

    Адаптер над legacy `getCourseByModuleId` + `CourseAr.getPrevModuleId` + `getModule` (`enroll-student-uc.ts:52-70`); `getModule` упал → `title = moduleId`. Образец — `modules/course/src/course/uc/get-module-snapshot.uc.ts`.
14. **Job `inactivitySweep`:**
    - Def `domain/src/stream/student/job/inactivity-sweep.job.ts`: `schedule: { kind: 'dailyAt', hour: 19, minute: 0 }`, `scans: [StudentArDef]`, `emits: [inactivityWarning, inactivityRemoveCandidate]`.
    - Реализация `modules/stream/src/student/job/inactivity-sweep.job.ts` (`JobFromDef`): `students.findStudying()` → `job.forEach` → `needsInactivityNotice(this.now())` → `noticeInactivity` → `uow.register`.
    - Пользователя и ментора Job не читает (п. 8).
15. **Репозиторий:**
    - порт `modules/stream/src/student/student.repo.ts`: `Repository<StudentAr> & { findById; findByStream(streamId); findByUser(userId); findStudying() }`;
    - фейк `student.repo.fake.ts` (`MemoryRepo`, DEBT-40);
    - `infra/student.json-repo.ts` — `VersionedRepository`, файл `<dbDir>/streams/students.json`, строгий разбор, как `infra/stream.json-repo.ts`.
16. **Модуль:**
    - `StreamDeps.students: StudentRepo` вместо порта `StreamStudents`;
    - `streamMap` получает 8 UC и `jobs: { inactivitySweep }`;
    - `activateStream` — `StreamLaunchDcs` в одном UoW (вместо `launch` после `register`);
    - `completeStream` — `fetch` → `StreamMembersDqs.facts(await students.findByStream)`;
    - `U7App`: `students: new StudentJsonRepo(...)`; legacy `LegacyStreamJsonRepo`, `StudentJsonRepo`, `legacyStreamStudents`, `streamLegacyInbound` удаляются (`u7-app.ts:122-128,180-187,209-210,267`).
17. **Уведомления в stories** (п. 7, D-41 вариант 2). Подписки — на `StudentEvents.<x>.name`, тип события — по образцу `review-notify.story.ts:18-21`. Текст отправляется через `proactiveSender.notify(tg, { text: mdRaw(safeConvert(<текст legacy>)), kind })` — та же отрисовка, что у `notify.story.ts:73-76`.
    - **`HubStory`** на `completed`: `outcome = advanced` и `!place?.nextModuleId` → текст `complete-student-uc.ts:104-107`, `kind: 'info'`; остальное без изменений (`hub.ts:49-81`).
    - **`InactivityStory`** на `abandoned`:
      - кик — как сейчас (`:132-137`);
      - `who = self` → ментору текст `drop-student-uc.ts:88`, `kind: 'info'`;
      - `who = mentor` и `cause = inactivity` → студенту текст `mark-abandoned-uc.ts:87`, `kind: 'warn'` (Т6);
      - поток или профиль недоступен — пропуск с `warn`.
    - **`InactivityStory`** на `inactivityWarning` / `inactivityRemoveCandidate`: адрес — С2; ментор берётся из `getStream(streamId).mentorId`.

## Шаги (по ролям)

Каждый шаг заканчивается командой проверки. «Красное вне шага» перечисляется в отчёте, а не чинится.

1. **test-designer** (red, прод-код не трогает):
   - **Характеризация** по текущим тестам:
     - `domain/src/stream/student/{a-root,entity,policy}.test.ts`, `student.events.fate.test.ts`, `stream-ds.test.ts` (всё, кроме перенесённого в Ф1);
     - `stream/{a-root,policy}.test.ts` (часть студента);
     - `modules/stream/src/api/student/*.test.ts` (8), `api/stream/list-stream-students-uc.test.ts`;
     - `infra/db/student-json-repo.test.ts`, `infra/legacy-stream-students.test.ts`, `legacy-inbound*.test.ts`.
   - **Red по Def:**
     - `StudentArDef` и state (legacy-запись с ISO и `sentAt` до минуты);
     - ошибки, Policy (TST-02: свой / чужой / ментор потока / ментор чужого / админ / гость);
     - правила решения 10 и их порядок;
     - `StreamLaunchDcs`, `StepCompletionDcs` (хвост снимка), обе DQS;
     - 8 Def UC и расширенный `getStreamMembers`, `GetModulePrerequisiteUcDef` (домен и адаптер);
     - Job: пороги 5/7, повтор через 2 дня, сброс при `activate`/`completeStep`, `wasWarned` до прогона, сбой одной записи → `failed: 1`;
     - `StreamModuleDef` без `external`;
     - репозиторий на `mkdtemp`: ISO → число, `version = 0`, round-trip, битая запись → исключение, файл цел.
   - **Тесты UC** — на `StudentRepoFake`/`StreamRepoFake`.
   - **e2e на каждое событие, которое получает бот** — через настоящий UC (`dispatch`), а не публикацией legacy-имени:
     - `completed` → 7a / 7b / 7c (`user-notify.e2e.test.ts:181,240` должны позеленеть);
     - `abandoned` от self → ментору;
     - `abandoned` inactivity → студенту и кик;
     - `abandoned` by_mentor → кик без текста студенту;
     - `inactivityWarning` и `inactivityRemoveCandidate` через `runJob`.
   - **Переписать legacy-публикации** `eventName: 'student.*'` в `tests/e2e/{peer-review-*,inactivity}.e2e.test.ts`, `platform/app/tests/u7-app.test.ts:356-440`, `hub.test.ts:264-320`, `inactivity.story.test.ts:51-373`.
   - **Отчёт:** список «старый тест → новый» и допущения о контрактах.
   - **Готово:** новые тесты красные по существу (нет модуля или экспорта, не тот `Result`), старые не ослаблены.
2. **migrator, домен:**
   - `bun run gen aggregate stream.student --adopt` (при коллизиях с `student.ar.ts`/`student.events.ts` — вручную по `wish`), `gen uc stream.student <имя>` ×8, `gen job stream.student inactivity-sweep`, `gen dcs stream stream-launch|step-completion`, `gen dqs stream student-progress|stream-members`. Сначала без `--write`.
   - Решения 1–14; `GetModulePrerequisiteUcDef` в домене `course` и контракте.
   - Удалить legacy-домен по таблице, кроме оболочки Т1; из `entity.ts` убрать `ArMeta` и импорт `course` index → `ContentSnapshotVo` из контракта.
   - `index.ts` без реэкспорта `ContentSnapshotSchema` из `@u7-scl/domain/course`.
   - **Готово:** `CI=true bun test domain/src/stream domain/src/course` зелёные; `bunx biome check domain/src/stream domain/src/course` чисто.
3. **migrator, прикладной слой:**
   - решения 15–16, 8 UC (`UseCaseFromDef`), Job, адаптер `course`;
   - удалить `api/student/*`, `api/stream/*`, `api/stream-uc.ts`, `api/errors.ts`, `infra/db/*`, `infra/legacy-stream-students*`, `stream/stream-students.ts`, `legacy-inbound*`;
   - `api/module.ts` — оболочка без UC и Job (как `PeerReviewApiModule`, TR-39 п. 4);
   - `U7App`.
   - **Готово:** `CI=true bun test modules/stream modules/course modules/wish modules/peer-review platform/app` зелёные; `bun run arch:check` — нарушения только в `runners`.
4. **migrator, подписчики:**
   - ER `fulfill-wish` и `create-student-campaign` — код без изменений, тесты на событиях от UoW модуля `stream`;
   - `u7-app.ts:267` — `inbound` без `stream`.
   - **Готово:** те же команды зелёные плюс `bun test platform/app/tests`.
5. **migrator, UI → `dispatch`.** Все импорты `@u7-scl/stream/domain` в `runners/u7-bot/src` заменить на `@u7-scl/domain/stream/contract`.
   - `learning/shared.ts:20-36,251-345` — `GetStudentByUserUcDef`, расчёты — из `getStudentProgress`;
   - `learning/stories/hub.ts`:
     - `:105` — меню по `getActiveStudent`;
     - `:128` — `student.inProgress`;
     - `:36` — подписка на Def и уведомление 7c;
     - `:188` — `DropStudentUcDef`;
   - `learning/stories/step-view.ts:76,98,124,146,199,284`, `progress.ts:55-56`, `nav-tree.ts`, `student-nav-resolver.ts:42`;
   - `streams/stories/inactivity.story.ts:46-58,155,177,205,231,257` и решение 17;
   - `streams/stories/view-stream.story.ts`:
     - `:399` — `canEnroll` по `getActiveStudent`, считается до `buildKeyboard`;
     - `:454-546,648-688,767-836` — `getStreamMembers` / `getStudentProgress`;
     - `:957` — `EnrollStudentUcDef`;
     - `:52,969` — неверное слово по коду `STUDENT_WRONG_ENROLLMENT_KEY` (снимает Т17 Ф1);
     - `PREREQUISITE_NOT_PASSED` → прежний текст `Сначала пройдите модуль «${moduleTitle}»`;
   - `streams/stories/stream-catalog.story.ts` — импорт;
   - `mentor/stories/monitor.ts`:
     - `:97-280` — `getStreamMembers`;
     - `:409,565,595,668,722` — `getStudentProgress`;
     - `:581,612` — `MarkAbandonedUcDef`;
     - `:739` — `advanced|not_advanced` → `CompleteStudentUcDef`, `abandoned` → `MarkAbandonedUcDef({ cause: 'by_mentor' })`;
   - `mentor/stories/view-stream-mentor.ts:163,208,220`;
   - `tests/worlds/invariants.ts:47-50` — снять `STUDENT_ROLE_MISMATCH`.
   - Тесты stories — на моках `appApi.dispatch` (`streams/stories/stream-dmg.test-kit.ts`).
   - **Готово:** `bun run check` полностью зелёный.
6. **orchestrator:** `debt.md` — запись TR-42 удалить, DEBT-47 закрыть, глобы по разделу «Долг»; TR-43 — ответы С и Т.
7. **data-keeper:**
   - state и `infra/student.json-repo.ts` на `students.json`: смешанные ISO/числа, `sentAt` до минуты, нет `updatedAt`/`version`, `completionDetails`;
   - первая запись переписывает весь файл; откат — только восстановлением из бэкапа;
   - ключ Job в `data/jobs/last-runs.json` (п. 12 расхождений);
   - запись `update-stream-snapshot.ts` в обход версии (риск до Ф3).
8. **reviewer:** по diff среза.

## Было → станет

### Домен

| Было | Станет |
|---|---|
| `student/entity.ts` (`StudentSchema`, `v.isoDateTime`, `ArMeta`) | `student/student.state.ts`; `entity.ts` — только типы для миров и скриптов до Ф3 (Т1) |
| `student/a-root.ts` (`Aggregate` из `core`, `throwBadRequest`, `#`) | `student/student.ar.ts` (`StudentArDef`, `StudentAr`, `StudentView`) |
| `student/student.ar.ts` (пустой Def внешнего модуля) | полный Def |
| `student/events.ts` | удаляется; `student.events.ts` + 2 события |
| `student/policy.ts`, `stream/policy.ts` (`LegacyStreamPolicy`) | `student/student.policy.ts`, `student/student.rules.ts` |
| `stream/a-root.ts` (`LegacyStreamAr`) | вопросы `StreamAr` (решение 4); файл удаляется |
| `stream-ds.ts` | `step-completion.dcs.ts`, `student-progress.dqs.ts`, `stream-members.dqs.ts` |
| `types.ts` | `student/student.types.ts` (схемы проекций, константы Job) |
| `student/commands/*` (8), `stream/commands/list-stream-students-cmd.ts` | `student/uc/*.uc.ts` (8); `set-next-preference` — удалён |
| `errors.ts`, `stream/repo.ts`, `student/repo.ts`, `date-test.test.ts` | удаляются |
| `module.ts` (9 мет) | оболочка без мет; фасады — из контрактов (Т1, DEBT-2 до Ф3) |
| `stream.module.ts` (`external`, 9 UC) | без `external` (Т1), 17 UC, 1 Job |
| `stream/stream.types.ts` (`StreamStudentFact`) | без изменений; строит `StreamMembersDqs.facts` |
| — | `stream-launch.dcs.ts`, `student/job/inactivity-sweep.job.ts` |

### Прикладной слой

| Было | Станет |
|---|---|
| `api/student/*-uc.ts`, `inactivity-sweep-job.ts` | `student/uc/*.uc.ts`, `student/job/inactivity-sweep.job.ts` |
| `api/stream/list-stream-students-uc.ts`, `api/stream-uc.ts`, `api/errors.ts` | удаляются |
| `api/module.ts` (`StreamApiModule`, 9 UC, Job) | пустая оболочка до Ф3 |
| `infra/db/{stream,student}-json-repo.ts` | `infra/student.json-repo.ts` |
| `stream/stream-students.ts`, `infra/legacy-stream-students.ts` | удаляются (DEBT-47) |
| `legacy-inbound.ts` | удаляется |
| `stream/uc/activate-stream.uc.ts` (`launch` после `register`) | `StreamLaunchDcs`, один UoW |
| `stream/uc/{complete-stream,get-stream-members}.uc.ts` (порт) | `StudentRepo` + `StreamMembersDqs` |

## Сохраняемое поведение (`v0.2.6` = текущие тесты)

- **enroll:**
  - порядок отказов: ключ → активная запись (в том числе в этом же потоке) → gate → нет шагов;
  - курса нет — gate пропускается; `title` предыдущего модуля при сбое — его id;
  - статус потока не проверяется (`a-root.ts:36-79`);
  - студент `enrolled`, шагов нет, `currentStepId` — первый шаг;
  - событие `enrolled { studentId, userId, streamId, moduleId }`;
  - лимит 3 попытки кодового слова (`view-stream.story.ts:930-938`).
- **complete-step:**
  - повтор завершённого шага → `already_completed`, кроме хвоста расширенного снимка (`stream-ds.ts:41-50,100-140`);
  - уровни `step | lesson | project | stream`; `notices` сбрасываются.
- **complete:** `advanced ↔ not_advanced` разрешено; `nextPreference: 'undecided'`; событие `completed`. Уведомление 7c/7d — только при `advanced` и без следующего модуля, теперь его шлёт story.
- **drop / mark-abandoned:** `abandonDetails` `{self, voluntary}` / `{mentor, cause}`; событие `abandoned` → кик из группы; тексты и `kind` — решение 17.
- **launch:** `enrolled → active`; первый шаг — всем без шагов, без учёта статуса; первого шага нет — студенты не меняются.
- **Job:**
  - 19:00 UTC; кандидаты `active`/`enrolled`;
  - студенту — на 5, 7, 9… день; ментору — на 7, 9, 11… день;
  - `wasWarned` — по маркеру до прогона;
  - сбой одной записи не прерывает обход;
  - принятое отличие (п. 8): маркер ставится, даже если адрес неизвестен, — story пропускает с `warn`.
- **Чтение:** `getStudentByUser` — сначала живая запись; прогресс студента виден любому (allowAll); в «составе потока» статусы сырые.
- **UI:**
  - «🎓 Моя учёба» в меню — только при активной записи;
  - кнопка «Записаться» — только без активной записи;
  - метки статусов, сортировка и сводка monitor (`monitor.ts:150-300`) не меняются.
- **Роль `STUDENT`** stream не выдаёт и не снимает; в `user` ничего не меняется.

## Внешние зависимости

- **`user`** (`dependsOn` есть): `User`, `Role` из контракта (TR-40); адрес — С2.
- **`course`** (`dependsOn` есть): `GetModulePrerequisiteUcDef` + адаптер (DEBT-44). `get-module-place` в `HubStory` — legacy UC `course`, без изменений.
- **Потребители:** `wish` — ER `fulfill-wish` (`on: StudentEvents.enrolled`); `peer-review` — ER `create-student-campaign` (`on: completed, abandoned`, `calls: getStreamMembers`); бот — решение 17.
- **Шина:** события студента публикует UoW модуля `stream`; `inbound` — только `questionnaire`.

## Открытые вопросы

### Стратегические — Нурболату

- **С1. Расчёты UI для stories.** Stories видят только `contract` (D-45, ARC-08), а DQS в контракт не входит. Варианты:
  - (a) DQS в домене + проекции в выходе query UC (`getStudentProgress` с `stepId`/`lessonId`, расширенный `getStreamMembers`) — по образцу `peer-review` (`ListMyReviews` → `MyReviewsProjection`);
  - (b) экспорт DQS и `StudentAr.readonly` из контракта — пересмотр D-45 пакета;
  - (c) расчёты в presenter'ах раннера над `StudentView`.

  Рекомендация — (a): это та самая «веская причина» выбрать query UC по spec п. 5.
- **С2. Адрес в `InactivityStory`.** `GetTelegramAddressesUcDef` разрешён только `system`. Варианты:
  - (a) story берёт `telegramId` через legacy `get-user`, как сейчас (`inactivity.story.ts:278-285`) — Job всё равно чисто доменный, цель п. 8 достигнута;
  - (b) `callers + 'guest'` в контракте `user` — telegramId любого пользователя становится доступен гостю через транспорт (D-54).

  Рекомендация — (a), отклонение от буквы п. 8 записать в TR.
- **С3. Вход `enrollStudent` без `userId`:** зачисляется субъект, как С3 Ф1 для `createStream`. Сейчас любой пользователь может записать другого (`enroll-student-uc.ts:40,94`). Рекомендация — сейчас.
- **С4. Объём Ф2.** Снятие `external` и legacy-домена `stream` переносится в Ф2 (расхождения п. 1–2, Т1): без этого Job на Def невозможен. Рекомендация — да, Ф3 сжимается до ARC-07, скриптов, миров и `test-app`.

### Тактические — orchestrator → TR-43 (рекомендации tech-lead)

- **Т1.** Ф2 снимает `external`. До Ф3 остаются: `module.ts` (оболочка, фасады из контрактов, DEBT-2), `{stream,student}/entity.ts` (типы для миров и скриптов, без `ArMeta`, `ContentSnapshotVo` из контракта, DEBT-5), `status.ts`, `StreamApiModule` (оболочка). Критерий plan Ф2 «DEBT-1, 2, 5, 10» → «DEBT-1, 10 погашены; DEBT-2, 5 — только оболочка».
- **Т2.** `getActiveStudent` и `getStudentByUser` — оба, как в spec; слияние — кандидат на ревизию.
- **Т3.** `getStreamMembers` расширяется полями `roster` вместо отдельного UC — это и есть слияние п. 3.
- **Т4.** Имя Job — `inactivitySweep`; ключ в `last-runs.json` проверяет data-keeper.
- **Т5.** `wasWarned` остаётся в `inactivityRemoveCandidate`.
- **Т6.** Текст студенту при `abandoned` — только при `cause = inactivity` (сохраняет поведение п. 6 расхождений).
- **Т7.** Кодовое слово — в контексте `load` для правила `enrollmentKeyAccepted`.
- **Т8.** `completeStep` получает Policy `isSelf` (legacy не проверял). В `completeStudent`/`markAbandoned`/`dropStudent`: `!student.belongsToStream(input.streamId)` → `STUDENT_NOT_FOUND`. Для пользователей UI ничего не меняется.
- **Т9.** «Студент не найден» в `complete-step` и `get-student-progress` — `not_found` вместо `access` (`complete-step-uc.ts:60`, `get-student-progress-uc.ts:32`).
- **Т10.** Тексты отказов переходов без сырого статуса (как Т14 Ф1); story зачисления ветвится по коду `PREREQUISITE_NOT_PASSED` и показывает прежний текст с `moduleTitle`.
- **Т11.** `completionDetails` пишется как в legacy (формат записей не меняется), хотя `set-next-preference` удалён.
- **Т12.** `activateStream`: два репозитория в одном UoW. Фиксация по файлам не атомарна — риск тот же, что у Т3 Ф1, но меньше.
- **Т13.** `StreamMembersDqs.roster` получает `at` из `this.now()` UC (DOM-14).
- **Т14.** `scripts/call-uc.ts:68` — справка о модулях: проверить вызов `stream` через DMG, иначе поправить текст.

## Правила (ID rules.md)

DOM-01…06, DOM-10…12, DOM-14…17; API-01…07; MAN-01…06, MAN-08, MAN-10…13; ERR-01…06; ARC-02…08; CODE-01, CODE-02, CODE-04; TST-01…07.

## Документы (`dmg-core`)

Не затронуты: срез `dmg-core` не правит. Понадобится правка (DQS в контракте — С1 (b), Job у внешнего модуля) — эскалация, правку не делать.

## Долг

- **Гасится:**
  - DEBT-47;
  - DEBT-10 — glob `domain/src/stream/student/a-root.ts`;
  - DEBT-1 — glob `domain/src/stream/**`;
  - DEBT-5 — сужается до `domain/src/stream/{stream,student}/entity.ts`, `date-test.test.ts` удаляется;
  - DEBT-3 — glob `modules/stream/src/api/errors.ts`;
  - DEBT-34 — в части `domain/src/stream` (импорт `course` index);
  - TR-42;
  - TR-11 — `inbound` `stream`.
- **Остаётся до Ф3:** DEBT-2 (`domain/src/stream/module.ts`), DEBT-5 (`entity.ts`), DEBT-3 (barrel `modules/stream/src/domain/index.ts`).
- **Новые:** DEBT-44 + `get-module-prerequisite` в glob `course`; TR-43 (С1–С4, Т1–Т14).

## Критерии приёмки

- В `domain/src/stream/**` и `modules/stream/src/**`, кроме оболочки Т1, нет:
  - `throw*` для штатных отказов;
  - `new …Ar`;
  - `#` в Ar;
  - импортов `@u7-scl/core`, `@u7-scl/app-legacy` и чужого `index`.

  Проверка: `grep -rn "@u7-scl/core\|@u7-scl/app-legacy\|new StudentAr\|new LegacyStreamAr\|StreamDs" domain/src/stream modules/stream/src` → только `module.ts`, `api/module.ts`.
- `StreamModuleDef` без `external`; Job — через `JobFromDef`; `checkDefs` и `bun run arch:check` без нарушений, синхронны с `debt.md`.
- `grep -rn "Role.STUDENT\|isStudent\|addRoleToUser\|removeRoleFromUser" domain/src/stream modules/stream runners/u7-bot/src` → пусто; `git diff --stat modules/user domain/src/user` → пусто.
- `grep -rn "'student\.\(enrolled\|completed\|abandoned\|inactivity\)" runners platform/app/src` → пусто; `grep -rn "@u7-scl/stream" runners/u7-bot/src` → пусто.
- `grep -rn -A1 "appApi.execute($" runners/u7-bot/src | grep -E "'(enroll-student|complete-step|complete-student|drop-student|mark-abandoned|get-student-by-user|get-student-progress|list-stream-students|set-next-preference)'"` → пусто.
- `grep -rn "streamLegacyInbound\|legacyStreamStudents\|LegacyStreamJsonRepo\|STUDENT_ROLE_MISMATCH" --include=*.ts .` → пусто.
- Тесты UC и Job — на фейках, без `mkdtemp`. Репозиторий: legacy-запись (ISO → число, `version = 0`, `updatedAt = createdAt`), round-trip, устаревшая версия, битая запись → исключение, файл цел.
- e2e на каждое событие, получаемое ботом, есть и зелёные; оба теста TR-42 зелёные; сценарии старых тестов студента, Job и `stream-ds.test.ts` перенесены (список — отчёт test-designer).
- `bun run check` полностью зелёный; `test:bot` — не меньше 996; записи TR-42 в `debt.md` нет; `git status data/` чист.
