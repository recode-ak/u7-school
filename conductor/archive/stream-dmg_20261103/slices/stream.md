# Бриф среза: `stream` / `stream`

Черновик — `tech-lead`, Ф0; проверка — orchestrator. Читай вместе с `../spec.md`, `../plan.md` (Ф1), эталоном `wish` и брифом `conductor/archive/peer-review-dmg_20261029/slices/review-campaign.md`. Код потока в `v0.2.6` (`../u7-school-v0.2.6`, пакет `stream`, каталоги `src/{domain,api}/stream`) совпадает с HEAD, отличаются только импорты: характеризация — текущие тесты как ожидания нового кода.

> **Статус:** принят. С1–С4 — по рекомендациям (Нурболат, 2026-11-03), Т1–Т12 — по рекомендациям, Т13 снят пересмотром D-60; всё — TR-41.

## Расхождения spec/plan с кодом

1. **Студент нужен уже в Ф1.** `activate` активирует `enrolled` и выдаёт первый шаг (`modules/stream/src/api/stream/activate-stream-uc.ts:42-66`). `complete` проверяет, что все студенты в конечном статусе (`complete-stream-uc.ts:41-48`, `domain/src/stream/stream-ds.ts:37-53`). «Состав потока» читает студентов. Агрегат студента переходит в Ф2 — в Ф1 нужен мост к legacy-студентам (Т2, новый DEBT-47), в spec его нет.
2. **Критерий plan Ф1 шире spec.** `grep … 'get-stream' … runners` захватывает stories, которые spec относит к Ф2: `learning/shared.ts:59`, `learning/stories/step-view.ts:82,320`, `learning/stories/progress.ts:44`, `streams/stories/inactivity.story.ts:294`, `mentor/stories/monitor.ts:103,425`, `view-stream.story.ts` (все 7 вызовов `get-stream`). Перевести их в Ф1 нужно и технически: legacy `get-stream` читает `streams.json` через `StreamSchema` с `v.isoDateTime` (`domain/src/stream/stream/entity.ts:23-50`); после первой записи новым репозиторием legacy пропустит все записи. В Ф1 меняется только вызов потока, студенческая логика этих stories — Ф2.
3. **«Слияние» в Ф1 частичное.** Legacy `list-stream-students` остаётся до Ф2 для экранов с полной записью студента: `monitor.ts:98`, `view-stream.story.ts:477`, `view-stream-mentor.ts:160` (читает только `students.json`, в Ф1 работает). На `getStreamMembers` переходят `streams/controller.ts:61,98` и счётчик `view-stream.story.ts:175`.
4. **DEBT-5 и DEBT-1 «в части потока» в Ф1 не гасятся.** Legacy `stream/entity.ts` (`StreamSchema`) и `stream/a-root.ts` (`findNextStep`, `findStepContext`, `getFirstStepId`, `enroll`) нужны legacy-студенту (`enroll-student-uc.ts`, `complete-step-uc.ts`, `stream-ds.ts` `completeStep`). В Ф1 удаляются только `stream/events.ts`, `stream/commands/*` и методы `create`/`activate`/`complete`/`archive` legacy-Ar. С `create` уходит `U7_SCHOOL_ID` — glob DEBT-2 `domain/src/stream/stream/a-root.ts` снимается в Ф1.
5. **Тест репозитория «на `DB_DIR=./data/fixtures`» невоспроизводим:** `data/fixtures` нет в git, его генерирует `seed:fixtures`. По образцу `modules/wish/src/infra/wish.json-repo.test.ts`: `mkdtemp` и legacy-записи в тесте.
6. **DEBT-35 «отсеивает правилом»:** у `EventReactionDef` нет `rules`. Отсев — вопрос Ar и фильтр в DCS (Т10).
7. **`ContentSnapshotSchema` без `v.description`** (`domain/src/course/content-snapshot.ts:28-50`) — в state и выходе UC нельзя (MAN-02).
8. **Фабрика в `U7App` уже есть** (`platform/app/src/u7-app.ts:308-312`) — меняются deps.
9. **Вне plan:** `scripts/migrate-streams-school-id.ts:105` пишет `streams.json` в обход репозитория — Ф3 или удалить (разовая миграция); `platform/app/tests/u7-app.test.ts:316-356` публикует legacy `stream.created` через legacy `StreamAr.create` — переписать в Ф1.
10. **`stream.completed`** — `stream/a-root.ts:85-110`, `stream/events.ts:21-36`, `complete-stream-uc.ts:52-54`, тест `complete-stream-uc.test.ts:88`. Подписчиков нет; удаляется в Ф1.

## Границы

**Домен `domain/src/stream`:** `stream/**` (новые файлы — «Было → станет»), `contract.ts`, `stream.module.ts`, `index.ts`; legacy `stream/a-root.ts`, `stream/policy.ts` — удалить методы, переименовать (Т1); `stream-ds.ts` — убрать только `completeStream`; `errors.ts` — только то, что больше никто не импортирует.

**Прикладной слой `modules/stream/src`:** `stream.module.ts`, `stream/{uc,stream.repo.ts,stream.repo.fake.ts,stream-students.ts}`, `infra/stream.json-repo.ts`, `infra/legacy-stream-students.ts`, `legacy-inbound.ts` (строка `stream.created`); удалить `api/stream/*`, `infra/stream-in-proc-facade*`; `api/module.ts` — без 7 UC потока; `domain/src/stream/module.ts` — без мет потока.

**Вне пакета:**
- `domain/src/user/contract.ts` — `+Role` (TR-40);
- `domain/src/course/{contract.ts,course.module.ts,content-snapshot.ts,course/uc/get-module-snapshot.uc.ts}`, `modules/course/src/{course.module.ts,course/uc/get-module-snapshot.uc.ts}` (TR-11);
- `domain/src/wish/{wish/wish.state.ts,wish/wish.ar.ts,wish-invitation.dcs.ts}`, `modules/wish/src/wish/er/invite-wishers.er.test.ts:430-444` (DEBT-35);
- `platform/app/src/{u7-app.ts,u7-app.types.ts}`, `platform/app/tests/u7-app.test.ts`;
- stories и тесты из «Шагов» п. 4; `runners/u7-bot/tests/{mentor/mentor.integration.test.ts,e2e/user-notify.e2e.test.ts}`.

**Не трогать:** `data/`; `student/**`, кроме переименований Т1; `api/student/*`; класс `StreamApiModule` (Ф3); `tests/worlds/*` (Ф3); `scripts/update-stream-snapshot.ts`, `stream-snapshot-sync.ts` (Ф3); ARC-07 в `biome.json` (Ф3).

## Решения брифа

1. **State** (`stream/stream.state.ts`, `...BaseEntityFields`, DOM-11/12): `schoolId`, `mentorId`, `moduleId` (`F.uuid`); `title`, `description` (trim, nonEmpty); `startDate: F.timestamp`; `status`; `telegramGroupId?`, `telegramGroupInvite?`, `goal?`, `result?`, `rules?`, `additional?`, `targetAudience?`, `enrollmentKey?`; `contentSnapshot` (VO из контракта `course`, Т9). Legacy-запись: ISO → число в UTC, `updatedAt = createdAt`, `version = 0` (D-36).
2. **`StreamArDef`** (`stream.ar.ts`, MAN-12): статусы `enrollment | active | completed | archived`; `activate`: `enrollment` → `active`, иначе `NOT_ENROLLING`; `complete`: `active` → `completed`, иначе `NOT_ACTIVE`; `archive`: `completed` → `archived`, `enrollment`/`active` — `NOT_COMPLETED`, `archived` — `ALREADY_ARCHIVED`.
3. **`StreamAr`** (DOM-02/03/04/14/17): `create(input, at)` → `Result` и событие `created`; `restore`; `activate(at)`, `complete(at)`, `archive(at)`; вопросы `isMentoredBy(userId)`, `firstStepId(): string | undefined`, `view(): StreamView`. `findNextStep`/`findStepContext` — Ф2.
4. **События:** `StreamEvents.created` (контракт есть, `stream.events.ts:9-19`) строит `create`; из `streamLegacyInbound` удаляется `stream.created` (`legacy-inbound.ts:14`); `stream.completed` не переносится.
5. **Ошибки** (`stream.errors.ts`, группа `STREAM`, ERR-04): `STREAM_NOT_FOUND` (not-found, `{ streamId }`); `STREAM_NOT_ENROLLING`, `STREAM_NOT_ACTIVE`, `STREAM_NOT_COMPLETED`, `STREAM_ALREADY_ARCHIVED` (conflict); `STREAM_STUDENTS_IN_PROGRESS` (conflict, `{ pending: { userId, status }[] }` — бывший `STREAM_CONFLICT`). Legacy `StreamUcErrors` — для legacy-студента до Ф2.
6. **Policy** (`stream.policy.ts`, TR-40, DOM-05/15): субъект — `Pick<User, 'uuid' | 'roles'>` из `@u7-scl/domain/user/contract`; `canCreate` — `Rule.of` «ментор» (`subject.roles.includes(Role.MENTOR)`; админ без `MENTOR` поток не создаёт, как в legacy `policy.ts:9-11`); `canManage` — `Rule.anyOf(isStreamMentor, isAdmin)`, контекст `{ stream: ReadonlyAr<StreamAr> }`; `Rule.hasRole` не подходит — у legacy `User` нет `hasRole`. Legacy `canRead` не используется — удалить.
7. **Правило** `StreamRules.studentsSettled` (`stream.rules.ts`, D-40, DOM-16): контекст `{ students: readonly StreamStudentFact[] }`; отказ `STREAM_STUDENTS_IN_PROGRESS` со списком; «завершён ли» отвечает студент (`settled` в факте). Заменяет `StreamDs.completeStream`.
8. **Форма ответа** (D-60, D-44): схема `StreamView` — рядом с `StreamArDef` (`stream.ar.ts`): `v.omit` из state без `enrollmentKey` + `requiresEnrollmentKey` (С1); `StreamAr` задаёт `V = StreamView` и переопределяет `view()`. Её отдают `getStream`, `listStreams`, `findStreamByTelegramGroup`. DQS потока в Ф1 нет: UI-расчёты `StreamDs` — студенческие (Ф2).
9. **Def UC** (`stream/uc/*.uc.ts`; `callers` — MAN-11; вызов чужого модуля — в `fetch`, API-07):

   | Имя | Тип | `callers` | Policy | Вход → выход | `errors` / `rules` / `calls` / `emits` |
   |---|---|---|---|---|---|
   | `createStream` | command | `user` | `canCreate` | поля state без `uuid`, `status`, `contentSnapshot` (С3) → `{ streamId }` | `calls: [GetModuleSnapshotUcDef]`, `errors: [COURSE_MODULE_NOT_FOUND]`, `emits: [created]` |
   | `activateStream` | command | `user` | `canManage` | `{ streamId }` → `void` | `NOT_FOUND`, `NOT_ENROLLING`; студенты — Т2/Т3 |
   | `completeStream` | command | `user` | `canManage` | `{ streamId }` → `void` | `NOT_FOUND`, `NOT_ACTIVE`, `rules: [studentsSettled]` |
   | `archiveStream` | command | `user` | `canManage` | `{ streamId }` → `void` | `NOT_FOUND`, `NOT_COMPLETED`, `ALREADY_ARCHIVED` |
   | `getStream` | query | `user`, `guest` | `allowAll` | `{ streamId }` → `StreamView & { canManage }` (Т7) | `NOT_FOUND` |
   | `listStreams` | query | `user`, `guest` | `allowAll` | `{ status?, mentorId?, schoolId? }` → `StreamView[]` | — |
   | `getStreamMembers` | query | `system`, `user`, `guest` | `allowAll` | `{ streamId }` → `{ mentorId, students[{ studentId, userId, status, neverStarted, inProgress }] } \| undefined` | — (Т6) |
   | `getStreamPresence` | query | `system` | `allowAll` | без изменений | — |
   | `findStreamByTelegramGroup` | query | `user`, `guest` | `allowAll` | `{ telegramGroupId: string }` → `StreamView \| undefined` | — (Т8) |

   `allowAll` у чтения — как в legacy (`requiresAuth: false`: `get-stream-cmd.ts:17`, `list-streams-cmd.ts:21`, `list-stream-students-cmd.ts:23`).
10. **Репозиторий:** порт `modules/stream/src/stream/stream.repo.ts` — `Repository<StreamAr> & { findById; findAll(filter); findByTelegramGroup(id) }`; фейк `stream.repo.fake.ts`, тесты UC — на фейке (DEBT-40); `infra/stream.json-repo.ts extends VersionedRepository`, файл `<dbDir>/streams/streams.json`; строгий разбор, как TR-37.
11. **Модуль** `modules/stream/src/stream.module.ts`: `StreamDeps = ModuleDeps & { streams: StreamRepo; students: StreamStudents; schoolId: string }`; субъект — `User` из контракта `user` (импорт из `contract`, DEBT-32); `streamMap` — 9 UC; `U7App`: `new StreamJsonRepo(...)`, `legacyStreamStudents(streamStudentRepo)`, `school.id`; `StreamInProcFacade` и `U7LegacyFacades.stream` (`u7-app.types.ts:39`) удаляются.
12. **Def UC `course`** (TR-11, DEBT-44): `GetModuleSnapshotUcDef` — query, `callers: ['system']`, `allowAll`, вход `{ moduleId }`, выход `ContentSnapshotVo`, `errors: [CourseErrors.MODULE_NOT_FOUND]` (`COURSE_MODULE_NOT_FOUND`); адаптер над legacy `getModuleSnapshot` (`modules/course/src/infra/course-in-proc-facade.ts:21-23`), not-found → эта ошибка, остальное — `SERVER_INTERNAL`; контракт `course` экспортирует `ContentSnapshotVo` и `ContentSnapshot` (DEBT-34).
13. **DEBT-35 (`wish`):** state `invitedStreamIds: v.optional(v.array(F.uuid(...)))`; `WishAr.invite` дописывает `streamId`; вопрос `wasInvitedTo(streamId)`; `WishInvitationDcs.matched` отсеивает приглашённых — повтор даёт пустой `reachQuestion`, без вызовов и событий; тест `invite-wishers.er.test.ts:433-444` ждёт `resolves`.
14. **Stories → `dispatchUc(StreamModuleDef, <Uc>Def.command(...), actor)`** (`runners/u7-bot/src/core/u7-bot-ui-story.ts:166`): типы — `OutputOf<Def>` вместо `as Stream`; отказ — `Result`, по умолчанию `ucErrorNotify` (UI по кодам ошибок потока не ветвится); `StreamPolicy.canEdit` в UI (`view-stream-mentor.ts:77`, `view-stream.story.ts:295,423`) → поле `canManage` из `getStream`; «мои потоки» — вход `mentorId` у `listStreams`.

## Шаги (по ролям)

1. **test-designer:** характеризация по существующим тестам — `domain/src/stream/stream/{a-root,policy,entity}.test.ts` (часть потока), `stream-ds.test.ts:787-880` (`completeStream`), `modules/stream/src/api/stream/*.test.ts` (7), `infra/stream-in-proc-facade.test.ts`, `stream/uc/get-stream-members.uc.test.ts`, `stream.module.test.ts`, `infra/db/stream-json-repo.test.ts`, `legacy-inbound.test.ts:79-95`; red по Def — `StreamArDef`, state (legacy-запись), ошибки, Policy (TST-02: ментор, не ментор, админ, гость), `studentsSettled`, 9 Def UC, `GetModuleSnapshotUcDef`, `StreamModuleDef`, `Role` в контракте `user`; тесты UC — на фейках порта и `StreamStudents`; репозиторий — `mkdtemp`; DEBT-35 — `resolves`; e2e — `createStream` → приглашение (`user-notify.e2e.test.ts:97`), `findStreamByTelegramGroup` (вступил чужой / ушёл студент); список «старый тест → новый» — в отчёт.
2. **migrator, домен:** `bun run gen aggregate stream.stream --adopt` (при коллизиях — вручную по `wish`); `stream.{state,ar,errors,policy,rules,types}.ts`, `uc/*`; legacy — Т1, удаление методов, `events.ts`/`commands/*`, `completeStream` из `StreamDs`; контракты `user` (`Role`) и `course`.
3. **migrator, прикладной слой:** `stream.module.ts`, 9 UC (`UseCaseFromDef`), порт и JSON-репозиторий, `StreamStudents` + `legacyStreamStudents`, адаптер `course`, удаление адаптеров TR-11 и `api/stream/*`, `u7-app.ts`, `u7-app.test.ts`, DEBT-35 в `wish`.
4. **migrator, stories → `dispatch`:** `mentor/{create-stream:796, activate-stream:22, view-stream-mentor:77,165,273,283, my-streams:56, monitor:103,425}`, `streams/{controller:49,61,98, stories/stream-catalog:51, stories/view-stream:169,175,274,295,380,423,482,686,898,942, stories/inactivity:294}`, `courses/{wish-invite:70, wish-confirmed:80}`, `peer-review/{invite:64, scope-reviews:81, my-reviews:291, campaign:182,417, reviews-for-me:126}`, `school/school-reviews:68`, `learning/{shared:59, stories/step-view:82,320, stories/progress:44}`; тесты stories (моки `appApi.dispatch`, образец — `course-catalog.story.test.ts:161-185`), `tests/mentor/mentor.integration.test.ts`, `tests/e2e/user-notify.e2e.test.ts`.
5. **orchestrator:** запись красной зоны в `debt.md`.
6. **data-keeper:** state и репозиторий потока, state желания (`invitedStreamIds`), legacy `StreamJsonRepo` при чтении нового формата.
7. **reviewer:** по diff среза.

## Было → станет

### Домен

| Было | Станет |
|---|---|
| `stream/entity.ts` (`StreamSchema`, `v.isoDateTime`) | `stream.state.ts` (`F.timestamp`); legacy `entity.ts` — до Ф2 |
| `stream/a-root.ts` `StreamAr` (`Aggregate` из `core`, `throwBadRequest`) | `stream.ar.ts` (`StreamArDef`, `StreamAr`); legacy без `create`/`activate`/`complete`/`archive`, переименован (Т1), до Ф2 |
| `stream/events.ts` (`StreamCreatedEvent`, `StreamCompletedEvent`) | удаляется; `stream.events.ts` — только `created` |
| `stream/policy.ts` `StreamPolicy` (`UserPolicy` из `index`) | `stream.policy.ts` (`Rule.of`, `Role` из контракта); legacy `canEnroll`/`canEnrollNextModule`/`isMentor` — до Ф2 |
| `stream-ds.ts` `completeStream` (`STREAM_CONFLICT`) | `stream.rules.ts` `studentsSettled` |
| `stream/commands/*-cmd.ts` (7) | `stream/uc/*.uc.ts` (9) |
| `stream/uc/get-stream-{members,presence}.uc.ts` | те же Def; `members` расширен (Т6) |
| `facade.ts`, `StreamFacade`/`StreamMember(s)` в `contract.ts` | удаляются |
| `stream/repo.ts` | удаляется; порт — в `modules/stream` |
| `module.ts` (метаданные 15 UC) | метаданные 8 UC студента до Ф3 |
| `stream.module.ts` (`external`, 2 UC) | `external` до Ф3 (Т4), 9 UC |
| — | `stream.errors.ts`, `stream.types.ts` (`StreamStudentFact`) |

### Прикладной слой

| Было | Станет |
|---|---|
| `api/stream/*-uc.ts` (`StreamUseCase`) | `stream/uc/*.uc.ts` (`UseCaseFromDef`) |
| `stream/uc/get-stream-{members,presence}.uc.ts` (адаптеры TR-11, DEBT-44) | настоящие UC над `StreamRepo` + `StreamStudents` |
| `infra/stream-in-proc-facade.ts` | удаляется |
| `infra/db/stream-json-repo.ts` (`JsonFileRepo`) | `infra/stream.json-repo.ts` (`VersionedRepository`); legacy — до Ф2, чтение для студента |
| `stream.module.ts` (`StreamLegacy`) | `StreamDeps`, `streamMap`, `createStreamModule` |
| — | `stream/stream-students.ts` (порт), `infra/legacy-stream-students.ts` (мост, DEBT-47) |
| `legacy-inbound.ts` (4 маршрута) | 3 маршрута `student.*` (до Ф2) |

## Сохраняемое поведение (`v0.2.6` = текущие тесты)

- **create:** статус `enrollment`; необязательные поля копируются, без `enrollmentKey` — ключа нет; `schoolId` = `school.id`; снимок модуля — в момент создания; `created { streamId, moduleId }` — после записи; гость — отказ (`create-stream-uc.test.ts:50-330`).
- **activate:** только из `enrollment`; `enrolled` → `active`; первый шаг — студентам без шагов, проверка только `steps.length === 0`, без учёта статуса (`activate-stream-uc.ts:47-66`); нет первого шага — поток активен, студенты не тронуты.
- **complete:** отказ, пока есть `active`/`enrolled`, текст «Нельзя завершить поток: N студентов ещё учатся. Сначала укажите исход для каждого.» (`stream-ds.ts:46`). Событий нет (`stream.completed` удалён).
- **archive:** только из `completed`; «Поток уже находится в архиве.» / «В архив можно отправить только завершённый поток.» (`a-root.ts:116-128`).
- **Права:** создаёт `MENTOR`; управляет ментор потока или `ADMIN`; отказ в создании — «Недостаточно прав для создания потока»; чтение открыто всем.
- **get:** нет потока — «Поток не найден». **list:** фильтры `status`, `mentorId`, `schoolId`.
- **members:** потока нет — `undefined`; статусы сырые; `neverStarted` (`stream-in-proc-facade.ts:39-55`).
- **Тексты отказов**, видимые через `ucErrorNotify`, test-designer фиксирует до перевода; изменение текста — вопрос orchestrator'у.
- **controller** (`streams/controller.ts:45-128`): чужая группа → `pass`; вступил не активный студент → ментору «⚠️ В группу «…» вступил неизвестный участник…»; ушёл активный → «🚪 Студент … покинул группу «…»»; исключение → `warn`, `stop`.
- **UI:** метки статусов в `view-stream.story.ts` не меняются; дата старта — по `getUTCHours` (DEBT-43).

## Внешние зависимости

- **`user`** (`dependsOn` есть): `Role` из контракта (TR-40); `User`-субъект — только из контракта.
- **`course`** (`dependsOn` есть): `GetModuleSnapshotUcDef` и адаптер (TR-11, DEBT-44).
- **Потребители:** `wish` — ER `invite-wishers` (`on: StreamEvents.created`, `calls: getStreamPresence`), событие по шине DMG, не через `inbound`; `peer-review` — ER `create-student-campaign` → `getStreamMembers`, выход дополняется совместимо (`student-fate.dqs.ts:5`).
- **Шина:** `stream.created` публикует UoW модуля; `student.*` — через `inbound` (`u7-app.ts:262`).
- **Legacy-студент** (`StreamApiModule`, 8 UC и Job) остаётся в `ApiApp`; резолвер `streamRepo` — legacy `StreamJsonRepo`, только чтение (красная зона).

## Красная зона Ф1–Ф2 (ожидаемая)

**Причина.** Новый репозиторий при первой записи переписывает весь `streams.json` (даты — числа, `version`). Legacy `StreamJsonRepo` (`JsonFileRepo` + `StreamSchema`) признаёт все записи невалидными: пропускает и копирует в `streams/backups/*.invalid.*` (`platform/core/src/infra/json-file-repo.ts:105-174`).

**Ломается:** legacy `enroll-student`, `complete-step`, `complete-student` → `STREAM_NOT_FOUND`; `drop-student`/`mark-abandoned` **молча** не уведомляют (`drop-student-uc.ts:81`, `mark-abandoned-uc.ts:83`); `inactivity-sweep-job.ts:163` пропускает студентов.

**Падающие тесты:** `runners/u7-bot/tests/e2e/user-notify.e2e.test.ts` — «закрытие потока на последнем модуле → «🎉 Курс завершён!» (FR-6 #7c)» и «закрытие на модуле с следующим → уведомления студенту нет (кнопка 7a)». Проверить прогоном: `tests/e2e/mentor-management.e2e.test.ts` (создание мастером, `:299`). Окончательный список orchestrator записывает в `debt.md` по гейту; снятие — конец Ф2.

## Открытые вопросы

### Стратегические — Нурболату

- **С1. Кодовое слово утекает в UI.** `get-stream`/`list-streams` отдают `enrollmentKey` любому, UI сам сравнивает ввод (`view-stream.story.ts:127`, `wish-invite.story.ts:92`). Предложение: `StreamView` без ключа, с `requiresEnrollmentKey: boolean`; ключ проверяет только `enroll` (Ф2). Рекомендация — сейчас.
- **С2. Активация студентов при запуске потока (форма в Ф2):** (a) DCS `StreamLaunchDcs` в одном UoW `activateStream`; (b) событие `stream.activated` + ER студента. Рекомендация — (a). В Ф1 — мост (Т2/Т3).
- **С3. Вход `createStream` без `mentorId` и `schoolId`:** ментор — субъект, школа — из deps (прецедент — `peer-review`, вопрос 7). Рекомендация — сейчас.
- **С4. Мост к legacy-студентам в Ф1 и перенос части Ф2 в Ф1** (Расхождения п. 1, 2; Т2). Spec «без моста» говорит об обратном направлении (legacy-студент → новый поток); здесь новый поток читает legacy-студентов. Рекомендация — мост DEBT-47 и перевод вызовов `get-stream` в `learning/*`, `inactivity`, `monitor` в Ф1.

### Тактические — orchestrator → TR (рекомендации tech-lead)

- **Т1.** Legacy `StreamAr`/`StreamPolicy` → `LegacyStreamAr`/`LegacyStreamPolicy` (затронуты `stream-ds.ts`, `student/policy.ts`, `enroll-student-uc.ts`, `complete-step-uc.ts` и тесты, `view-stream.story.ts:422`), удаляются в Ф2; новый state не экспортирует `StreamStatus`, тип — `StreamState['status']`.
- **Т2.** Мост DEBT-47: порт `StreamStudents` — `factsOf(streamId): StreamStudentFact[]` (`settled`, `inProgress`, `neverStarted`) и `launch(streamId, firstStepId)` (логика `activate-stream-uc.ts:43-66` дословно); реализация над legacy `StudentRepo`, уходит в Ф2.
- **Т3.** `launch` — в `execute` после `uow.register`, до фиксации (D-41, вариант 1); риск — студенты активированы, поток не записан; повтор безопасен; legacy тоже неатомарен.
- **Т4.** `external` у `StreamModuleDef` — до Ф3 (иначе `checkContractImports` ловит legacy-импорты студента); TR: события `stream` публикует DMG при внешнем модуле (`def-checker.ts:152-158` допускает).
- **Т5.** Legacy потока (`api/stream/*`, `commands/*`, `StreamInProcFacade`, `StreamFacade`, адаптеры) удаляется в Ф1 — после Ф1 недостижим; `list-stream-students` и legacy `StreamJsonRepo` — до Ф2.
- **Т6.** `getStreamMembers`: в выход `studentId`, `inProgress` (вместо `new StudentAr` в `controller.ts:13-23`); `callers` + `user`, `guest`; фильтр `status` убирается.
- **Т7.** `canManage` в ответе `getStream` — `StreamPolicy.rules.canManage.evaluate(subject, { stream })`.
- **Т8.** `findStreamByTelegramGroup`: сравнение строк, первое совпадение; у `U7BotController` нет `dispatchUc` — помощник с субъектом по `telegramId` или `GuestCaller`.
- **Т9.** `ContentSnapshot`: `v.description` в `content-snapshot.ts`; `v.uuid` → `F.uuid` — только после data-keeper; экспорт из контракта `course`.
- **Т10.** DEBT-35: отсев — DCS + вопрос Ar; повторный `invite` Ar отклоняет `WISH_ALREADY_INVITED`.
- **Т11.** Даты в выходе — числа; `BotUiStory.formatDate(iso)` получает `new Date(n).toISOString()`; ввод `startDate` — UTC, как сейчас.
- **Т12.** Тест репозитория — `mkdtemp`.
- **Т13.** Снят: после пересмотра D-60 (`09005e1`) остатка TR-8 нет.

## Правила (ID rules.md)

DOM-01…06, DOM-10…12, DOM-14…17; API-01…05, API-07; MAN-01…06, MAN-08, MAN-10…13; ERR-01…06; ARC-02…04, ARC-06, ARC-08; CODE-01, CODE-02, CODE-04; TST-01…07.

## Документы (`dmg-core`)

Не затронуты: D-60 пересмотрен и записан вместе с `layers.md` §4 и строкой DOM-01 `rules.md` (`09005e1`).

## Долг

- **Гасится:** DEBT-35; DEBT-44 — glob `modules/stream/src/stream/uc/{get-stream-members,get-stream-presence}.uc.ts`; DEBT-2 — glob `domain/src/stream/stream/a-root.ts`; TR-11 (stream).
- **Не гасится в Ф1:** DEBT-1 (уточнить Место), DEBT-5, DEBT-10 — Ф2; DEBT-3, DEBT-34 — Ф3.
- **Новые:** DEBT-47 (мост `infra/legacy-stream-students.ts`, снятие — Ф2); TR на Т1–Т12 и ответы С1–С4; запись красной зоны.

## Критерии приёмки

- В `domain/src/stream/stream/**` (кроме legacy `a-root.ts`, `entity.ts`, `policy.ts` — Ф2) и `modules/stream/src/stream/**` нет `throw*` для штатных отказов, `new StreamAr`, импортов `@u7-scl/core` и `@u7-scl/app-legacy`; чужие модули — только через `contract`.
- 9 UC — через `UseCaseFromDef`, `checkDefs` зелёный; адаптеров TR-11 потока нет; `grep -rn "stream.completed\|StreamCompletedEvent" domain modules platform runners` — пусто.
- `grep -rn "'create-stream'\|'activate-stream'\|'archive-stream'\|'complete-stream'\|'get-stream'\|'list-streams'" runners scripts platform` — пусто; `'list-stream-students'` — только `monitor.ts`, `view-stream.story.ts:477`, `view-stream-mentor.ts:160`.
- `streamLegacyInbound` без `stream.created`; `invite-wishers` срабатывает от `createStream` (e2e `user-notify` п. 1 зелёный).
- DEBT-35: тест повторного `stream.created` — `resolves`, зелёный.
- Репозиторий: legacy-запись (ISO → число, `version = 0`, `updatedAt = createdAt`), round-trip, устаревшая версия, битая запись — исключение, файл цел.
- Тесты UC — на фейке порта; сценарии старых тестов потока перенесены (список — отчёт test-designer).
- `bun run check` зелёный, кроме тестов из записи красной зоны; `arch:check` синхронен с `debt.md`; `git status data/` чист.

## Отчёт `test-designer` (Ф1, шаг 1)

Прод-код не тронут. Изменён один старый тест: `modules/wish/src/wish/er/invite-wishers.er.test.ts` (DEBT-35, ждёт `resolves`). Все новые тесты красные по существу (нет модуля или экспорта, не тот `Result`). e2e «ушёл студент» и «чужая группа» зелёные уже на текущем коде.

| Старый тест | Новый тест |
|---|---|
| `stream/a-root.test.ts` | `domain/src/stream/stream/stream.ar.test.ts` |
| `stream/entity.test.ts` | `stream.state.test.ts` (ISO → число, `version = 0`, `updatedAt = createdAt`) |
| `stream/policy.test.ts` | `stream.policy.test.ts` |
| `stream-ds.test.ts:787-880` | `stream.rules.test.ts` + `manage-stream.uc.test.ts` |
| тексты отказов | `stream.errors.test.ts` |
| Def 9 UC, `StreamModuleDef` | `stream/uc/stream.uc-defs.test.ts`, `stream.module.def.test.ts`, `modules/stream/src/stream.module.map.test.ts` |
| `api/stream/create-stream-uc.test.ts` | `modules/stream/src/stream/uc/create-stream.uc.test.ts` |
| `api/stream/{activate,complete,archive}-stream-uc.test.ts` | `manage-stream.uc.test.ts` |
| `api/stream/{get-stream,list-streams}-uc.test.ts`, members, presence | `read-stream.uc.test.ts` |
| `stream-in-proc-facade.test.ts` | `read-stream.uc.test.ts`; мост — `infra/legacy-stream-students.test.ts` |
| `legacy-inbound.test.ts:79-95` | `legacy-inbound.stream-created.test.ts` |
| `infra/db/stream-json-repo.test.ts` | `infra/stream.json-repo.test.ts` (`mkdtemp`) |
| `controller.test.ts` | `runners/u7-bot/src/controllers/streams/controller.stream-group.test.ts` |
| `user-notify.e2e.test.ts` п. 1 | `runners/u7-bot/tests/e2e/stream-dmg.e2e.test.ts` |
| — | `get-module-snapshot.uc.test.ts` (домен и модуль `course`), `domain/src/user/contract.role.test.ts`, `domain/src/wish/wish/wish.invited.test.ts` |

Фикстуры: `domain/src/stream/stream/stream.fixture.ts`, `modules/stream/src/stream/uc/stream-uc.fixture.ts` (с `StudentsFake`).

**Для migrator.** Удалить: `api/stream/*.test.ts` (кроме `list-stream-students-uc.test.ts`), `infra/stream-in-proc-facade.test.ts`, `commands/*`, части `a-root.test.ts`, `policy.test.ts`, `stream-ds.test.ts` (`completeStream`). Переписать: оба `stream.module.test.ts`, `get-stream-members.uc.test.ts`, `legacy-inbound.test.ts:79-95`, `domain/src/course/course.module.test.ts` (6 UC), `wish.ar.test.ts` (`invitedStreamIds`), `platform/app/tests/u7-app.test.ts:316-356`, `controller.test.ts`, `user-notify.e2e.test.ts`.

**Допущения тестов (контракты, принятые orchestrator'ом):** имена `…UcDef`/`…Uc`, `StreamErrors`, `StreamPolicy.rules.{canCreate,canManage}`, `StreamRules.rules.studentsSettled`; `StreamAr.create({ uuid, … }, at)`; `StreamAr`, `StreamState`, `StreamStudentFact { studentId, userId, status, settled, inProgress, neverStarted }` — из `@u7-scl/domain/stream`; `new StreamJsonRepo(filePath)`; `CourseLegacy.getModuleSnapshot(moduleId)`, not-found — `AppException` `MODULE_NOT_FOUND`; контроллер — `appApi.dispatch(StreamModuleDef, <Def>.command(...), caller)`; в `completeStream` `NOT_ACTIVE` проверяется после `studentsSettled`.

**Вопросы → решения orchestrator'а:** тексты отказов с числом и статусом — TR-41 (Т14).

## Отчёт `migrator` (Ф1, шаг 2 — домен)

`domain`: 1148 pass, 0 fail; `tsc`, `biome` чисты (проверено orchestrator'ом). Новые `stream.{state,ar,errors,types,rules,policy,events}.ts`, 7 новых Def UC + 2 расширены/сохранены, `stream.module.ts` (9 UC, `external`), `contract.ts`, `index.ts`; `facade.ts` удалён. Т1 — `LegacyStreamAr`/`LegacyStreamPolicy` только со студенческими методами. Удалены `stream/events.ts`, 6 из 7 `commands/*`, `StreamDs.completeStream`, `stream.completed`. `Role` — в контракте `user`; `course` — `GetModuleSnapshotUcDef`, `CourseErrors` (`COURSE_MODULE_NOT_FOUND`), `ContentSnapshotVo`/`ContentSnapshot`, 6 UC. DEBT-35 в домене `wish` готов.

**Отклонения** (TR-41 Т15): `list-stream-students-cmd.ts` и legacy `stream/repo.ts` остаются до Ф2; `v.trim()` снят с заголовков снимка; правки тестов — разбор state через `StreamArDef.state` (фолбэк `updatedAt`), типы в `stream.errors.test.ts`/`contract.role.test.ts`, упоминания TR/DEBT из комментариев доменных тестов (CODE-04); старые тесты домена — по списку «Для migrator»; фикстуры `student-fate.dqs.test.ts` + `studentId`, `inProgress`.

**Красное вне домена (шаг 3–4):** `modules/stream` (`api/stream/*`, `stream-in-proc-facade`, `stream.module.ts`, новые тесты), `modules/course` (`course.module.ts`), `modules/peer-review` (`create-student-campaign.er.test.ts` — фикстуры), `platform/app/tests/u7-app.test.ts`, stories `runners/u7-bot`; `arch:check` — упоминания TR/DEBT в комментариях новых тестов `modules`/`runners` (CODE-04), DEBT-35 вне `biome-ignore` в `invite-wishers.er.test.ts`.

## Отчёт `migrator` (Ф1, шаг 3 — прикладной слой)

Зелёные (проверено orchestrator'ом): `modules/stream` 182, `modules/course` 163, `modules/wish` 129, `modules/peer-review` 141, `platform/app` 13 pass; `tsc` 0 ошибок; `arch:check` — нарушений нет после правки `debt.md` (DEBT-35 закрыт, DEBT-44 — glob `stream` снят, `get-module-snapshot` добавлен в glob `course`; DEBT-47 — признак «Мост к legacy-студентам»).

Сделано: `stream.module.ts` (`StreamDeps`, `streamMap` 9 UC), UC через `UseCaseFromDef`, порты `StreamRepo`/`StreamStudents` + фейк, `infra/stream.json-repo.ts` (`VersionedRepository`, строгий разбор), мост `infra/legacy-stream-students.ts`; удалены `api/stream/*` (кроме `list-stream-students`), `stream-in-proc-facade*`, адаптеры TR-11; `legacy-inbound` без `stream.created`. `course` — `GetModuleSnapshotUc`. `wish` — `invite-wishers` без изменений кода, DEBT-35 зелёный. `peer-review` — фикстуры под Т6. `U7App` — новый репозиторий, мост, `school.id`; `U7LegacyFacades.stream` удалён; `u7-app.test.ts` — `stream.created` через `dispatch(CreateStreamUcDef…)`.

Отклонения — TR-41 Т16; правки тестов только в типах (`Outcome`, `system as never`, кортеж `ids()`).

**Красное (шаг 4):** `runners/u7-bot` — `tsc` в 16 stories, `streams/controller.ts`, `learning/{shared,stories/step-view,stories/progress}.ts`, `tests/e2e/user-notify.e2e.test.ts`, `tests/mentor/mentor.integration.test.ts`; тесты бота 108 fail / 903 pass.

## Отчёт `migrator` (Ф1, шаг 4 — stories)

`runners/u7-bot`: вызовы потока — `dispatchUc(StreamModuleDef, …)` в `mentor/*`, `streams/*`, `courses/wish-*`, `peer-review/*`, `school-reviews`, `learning/{shared,step-view,progress,nav-tree}`; `canManage` из `getStream`; «мои потоки» — `listStreams({ mentorId })`; `LegacyStreamPolicy.canEnroll` — до Ф2. Т14 — `complete-confirm` ветвится по `STREAM_STUDENTS_IN_PROGRESS`. Т11 — даты числа, wizard `createStream` → UTC-метка. Т8 — `#dispatchAsGuest` в `streams/controller.ts`; `dispatchUcAsGuest` в `u7-bot-ui-story.ts` для обработчиков событий без актора. Т17 — кодовое слово: лимит 3 попытки по тексту legacy-отказа (после эскалации). Тесты stories — на моках `appApi.dispatch`, хелпер `streams/stories/stream-dmg.test-kit.ts`; `peer-review-dmg.test-kit.ts` принимает `StreamModuleDef`; сценарии `handleMessengerEvent` из `controller.test.ts` — в `controller.stream-group.test.ts`; `ui-spec.md` — `canManage`.

**Отклонения (приняты):** ожидание текста в `controller.stream-group.test.ts` экранировано под MdText; «поток не найден» — `notify` через `ucErrorNotify` (4 теста перенесены на `response.notify`); `'activate-stream'`/`'create-stream'` остались только как имена stories и callback-коды.

**Проверка orchestrator'а:** полный `check` — все шаги до тестов зелёные, тесты 3780 pass / 2 fail (красная зона, TR-42); `git status data/` чист.

## Отчёт `data-keeper` (Ф1)

Живой `data/` не читался; выводы по коду и тестам.
- **error (принят, TR-42):** первая запись `StreamJsonRepo` переписывает весь `streams.json`; `LegacyStreamJsonRepo` пропускает все потоки — `enroll`/`complete-student` → `STREAM_NOT_FOUND`, `drop`/`mark-abandoned` молча не уведомляют, `inactivity-sweep` пропускает. Legacy при чтении нового формата пишет `data/streams/backups/streams.invalid.<ts>.json` один раз на процесс; `save` не вызывается.
- **warn:** строгий разбор — одна невалидная запись останавливает `findAll`/`findById`/`write` (legacy пропускал). Невалидные записи в живых данных неизвестны.
- **info:** читатель файл не портит; запись не атомарна (как legacy); совместимость полей (`F.timestamp`, фолбэки `updatedAt`/`version`, `contentSnapshot` без `v.trim()`) — старые записи читаются; `invitedStreamIds` необязательное, откат — повторные приглашения без потери данных.
- **Откат:** после первой записи — только восстановление `streams.json` из `bun run backup`. **Бэкап перед первым запуском обязателен.** Пакетная миграция не нужна (ленивая конвертация).
- **Рекомендации:** (1) с разрешения Нурболата — разбор копии `streams.json` схемой `StreamArDef.state` во временном каталоге, вывод только числа записей и ошибок → **открытый вопрос к контрольной точке**; (2) по результату — чинить или пропускать; (3) тесты «legacy читает новый формат» и «`wish` без `invitedStreamIds`» → переданы migrator.

## Отчёт `reviewer` (Ф1)

`error`/`warn` нет. Проверены ID брифа; grep-критерии выполнены; сохранность поведения подтверждена; ослабленных тестов нет.

| ID | файл:строка | суть | severity | решение |
|---|---|---|---|---|
| CODE-04 | `stream.ar.ts:69,90` | лишние `D-NN` вне шапки | minor | правка |
| CODE-04 | `list-stream-students-uc.ts:15-17`, `.test.ts:102` | комментарий об удалённом фасаде | minor | правка |
| CODE-04 | `legacy-stream-students.test.ts:6-9` | шапка — история переноса | minor | правка |
| ARC-08 | `streams/controller.ts:123-139`, `u7-bot-ui-story.ts` | дубль `dispatch` от гостя | minor | правка |
| TST-05 | тесты stories (~20) | `story.init({...} as never)` | question | принято — как в образце `course-catalog.story.test.ts` |
| DOM-17 | `activate-stream.uc.ts:50` | `launch` до фиксации | question | принято — Т3 |
| MAN-02 | `content-snapshot.ts` | `v.uuid`, снят `v.trim()` | question | принято — Т9, Т15 |

Кандидат в ratchet: CODE-04 — одна `D-NN` на файл, ссылки на удалённые сущности.

## Открытые вопросы к контрольной точке Ф1

- **Данные:** разрешить разбор копии живого `streams.json` схемой нового state (только числа записей/ошибок) до Ф2 — рекомендация `data-keeper`.
