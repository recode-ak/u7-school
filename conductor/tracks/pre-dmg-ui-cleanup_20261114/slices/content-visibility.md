# Бриф: видимость контента — курс и поток (Ф4а)

> Трек `pre-dmg-ui-cleanup`, Фаза 4а; spec ФР-5а; релиз v0.3.1. Черновик — `dmg-tech-lead` (Sonnet), решения — orchestrator.

## Решения Нурболата (2026-11-14)

- Чтение через API курса — всем только опубликованное; администратору, автору модуля и **любому ментору (роль)** — всё.
- Чтение из потока (по снимку) — элемент снимка виден участнику всегда, независимо от статуса в курсе.
- Сборка и обновление снимка — неопубликованный урок/шаг **пропускается с `warn`**.
- Тем, кто видит неопубликованное, карточка урока/шага показывает отметку статуса, если он не «опубликован» (вид отметки — по UX, решает orchestrator здесь).

## Решения orchestrator по открытым вопросам черновика

1. Warn оператору скрипта — режим логгера «только warn» у `CourseClient` (`silent` → warn-only); контракт `getModuleSnapshot` не меняется.
2. Доступ к stream-UC: студент этого потока, ментор потока, администратор. `view-stream.story.ts` (ментор) остаётся на `getStep` — роль ментора видит всё по Policy; студент — только stream-UC.
3. Отметка: `🚧 Черновик` / `🗄 В архиве` в заголовке карточки, тот же значок префиксом в кнопке nav-tree и списков каталога. `status` в `StepSummary` добавляется в этой фазе (контракт внутри модуля).
4. Тесты, закрепляющие состав модулей `course`/`stream` (паспорт, перечень UC, `toHaveLength`), правятся в этой фазе.
5. Один курсовой system-UC по списку `stepIds` (рабочее имя `getSnapshotSteps`, итог — по `naming.md`): шаги без статусного фильтра, `callers: ['system']`.

Следствие правил (не вопрос): снимок теперь собирается без неопубликованного, поэтому «виден по снимку всегда» относится к элементам, снятым с публикации или архивированным после сборки снимка.

## Черновик tech-lead (Sonnet)

### Находки по коду

1. Неопубликованный урок в снимок уже не попадает (`domain/src/course/module-snapshot.dqs.ts:24-28`, `isPublished()`); неопубликованный шаг попадает — `stepIds` целиком (`:13-14`), `GetModuleSnapshotUc` (`modules/course/src/module/uc/get-module-snapshot.uc.ts:62-66`) шаги не читает. Пропуск шага с `warn` — новое поведение, UC должен читать шаги.
2. Студент потока сейчас теряет неопубликованное из снимка: бот читает шаги через `GetStepUcDef` (`step-view.ts`, `nav-tree.ts:99`, `view-stream.story.ts:351`, `shared.ts:buildStepList`) и `GetStepsByLessonsUcDef` (`shared.ts:loadStepDescriptions`, `nav-tree.ts:76,87`, `view-stream.story.ts:323,337`, `course-catalog.story.ts:819`); оба режут по `ModulePolicy.canSeeUnpublished`. Снимок бот берёт только для структуры.
3. Правило — `domain/src/course/module/module.policy.ts:7-44`: `Rule.anyOf(isAdmin, isModuleAuthor)`, субъект `Pick<ReadonlyAr<UserAr>,'uuid'|'isAdmin'>`. Потребители: `get-step`, `get-lesson`, `get-steps-by-lessons`, `get-module-snapshot`, `get-module`, `list-modules`. `UserAr.isMentor()` есть (`domain/src/user/user/user.ar.ts:83`), `course` уже `dependsOn: [UserModuleDef]`.
4. Канал warn — `this.resolve.app.logger.warn(source, message, meta?)`; прецеденты `modules/user/src/user/uc/get-users-by-ids.uc.ts:48`, `modules/wish/.../invite-wishers.er.ts:66`. Домен без логгера → warn пишет UC.
5. Скрипты строят `CourseClient.create({ silent: true })` (`scripts/update-stream-snapshot.ts:117`, `list-lessons.ts:138`) с no-op логгером (`scripts/_course-client.ts:32-39`).

### Границы

- Домен: `domain/src/course/` (`module/module.policy.ts`, `module-snapshot.dqs.ts`, `step/uc/*`, `step/step.ar.ts`, `lesson-steps.dqs.ts`, `contract.ts`, `course.module.ts`), `domain/src/stream/` (новые Def UC, `stream.module.ts`, `calls`).
- Прикладной слой: `modules/course/src/` (`step`, `module/uc/get-module-snapshot.uc.ts`, карта модуля), `modules/stream/src/` (новые UC, карта).
- Бот: `runners/u7-bot/src/controllers/learning/{shared.ts,stories/step-view.ts,stories/nav-tree.ts}`, `streams/stories/view-stream.story.ts` (только отметка), `courses/stories/course-catalog.story.ts` (только отметка).
- Скрипты: `scripts/_course-client.ts`, `scripts/update-stream-snapshot.ts`.
- Не трогать: `data/`, `dependsOn`, `get-lesson`/`get-module`/`list-modules` по существу (правка Policy распространится сама), UI-платформу, `dmg-core`.

### Было → станет

| # | Было | Станет |
|---|---|---|
| 1 | `canSeeUnpublished` = админ ∨ автор модуля | + `isMentor` (роль) в том же `Rule.anyOf`; `ModuleSubject` + `'isMentor'` (D-69); `dependsOn` без изменений, DOM-15 |
| 2 | Шаги потока бот читает через `getStep`/`getStepsByLessons` под студентом | Студенческие сценарии `learning/*` — через новые UC `stream` (`getStreamStep`, `getStreamLessonSteps`; `type:'query'`, `callers:['user']`; гейт — шаг в снимке ∧ студент этого потока / ментор потока / админ). Содержимое stream получает через курсовой system-UC по `stepIds` (`this.call`, как `create-stream.uc.ts:51-56`) |
| 3 | `GetModuleSnapshotUc` шаги не читает | UC читает шаги; `ModuleSnapshotDqs` принимает шаги и явно возвращает пропущенное (DOM-13); в снимок — только published; каждый пропуск — `logger.warn('getModuleSnapshot', …, { moduleId, lessonId \| stepId })`; output UC (`ContentSnapshot`) не меняется |
| 4 | Скрипт под `silent` — warn не виден | `CourseClient`: `silent` → warn-only |
| 5 | Карточки без статуса | Для видящих неопубликованное (по ответу UC, DOM-18): `🚧 Черновик` / `🗄 В архиве` в заголовке карточки (`formatStepMessage`, карточка ментора в `view-stream`), префикс в кнопках nav-tree и списков `course-catalog`; `StepSummary` + `status`. У студента потока отметки нет |

### Def и реализации

| Артефакт | Где |
|---|---|
| `ModulePolicy`: + `isMentor` | `domain/src/course/module/module.policy.ts` |
| `ModuleSnapshotDqs`: вход + шаги, вывод пропущенного | `domain/src/course/module-snapshot.dqs.ts` |
| `GetModuleSnapshotUc`: читает шаги, пишет warn | `modules/course/src/module/uc/get-module-snapshot.uc.ts` |
| Курсовой system-UC по `stepIds` без статусного фильтра | `domain/src/course/step/uc/`, `modules/course/src/step/uc/`, `course.module.ts` ×2, `contract.ts` |
| `StepSummary` + `status` | `step.ar.ts`, `lesson-steps.dqs.ts`, `get-steps-by-lessons.uc.ts` |
| UC `stream`: `getStreamStep`, `getStreamLessonSteps` | `domain/src/stream/stream/uc/`, `modules/stream/src/stream/uc/`, `stream.module.ts` ×2, `calls` |
| Бот: замена вызовов, отметка статуса | `learning/shared.ts`, `step-view.ts`, `nav-tree.ts`, `view-stream.story.ts`, `course-catalog.story.ts` |
| Скрипт: warn-only логгер | `scripts/_course-client.ts` |

Вариант B (контекст потока у `getStep` курса) отвергнут: course не зависит от stream (DAG), флаг во входе подделывается. Расширить `callers` у `GetStepUcDef` на `'system'` — нельзя: у system-вызова нет субъекта для Policy.

### Сценарии red-тестов (`dmg-test-designer`)

Course:
1. `ModulePolicy.canSeeUnpublished`: админ, автор, ментор (не автор) — allowed; студент, пользователь без ролей — denied.
2. `getStep`/`getLesson`/`getStepsByLessons`: draft у ментора (не автора) — виден; у студента — отказ / пропуск; published — всем. `getStepsByLessons` отдаёт `status`.
3. `ModuleSnapshotDqs`: draft-урок и draft-шаг не попадают; пропущенное перечислено; порядок сохраняется; урок в нескольких проектах.
4. `getModuleSnapshot`: draft-шаг/урок пропущен, `logger.warn` с `moduleId` и id; без пропусков — warn нет; снимок от ментора тот же.
5. Курсовой system-UC: возвращает draft-шаг; `user`/`guest` — отказ по `callers`.

Stream:
6. `getStreamStep`: шаг в снимке, draft в курсе — студент потока видит; шаг вне снимка — отказ; студент другого потока — отказ; ментор потока, админ — видят.
7. `getStreamLessonSteps`: описания всех шагов урока из снимка, включая draft.
8. `createStream`: снимок без draft-шагов.

Бот / скрипт:
9. Студент: следующий шаг и nav-tree открываются, когда шаг снят с публикации после сборки снимка.
10. Ментор (роль): карточка и кнопка draft-шага/урока с `🚧 Черновик`; published — без отметки; студент — без отметки.
11. `CourseClient` в `silent` пропускает warn на вывод.

### Тесты, которые сломаются или закрепляют поведение

- Составы модулей: `domain/src/course/course.module.test.ts:17-40` (`toHaveLength(16)`), паспорт `stream` (grep `useCases`/`toHaveLength`).
- Домен: `module.policy.test.ts`, `module-snapshot.dqs.test.ts`, `lesson-steps.dqs.test.ts`.
- Course UC: `get-step`, `get-lesson`, `get-steps-by-lessons`, `get-module-snapshot`, `get-module`, `list-modules`, `list-courses` (`*.uc.test.ts`), `content-uc.fixture.ts`.
- Stream: `create-stream.uc.test.ts`, `stream-uc.fixture.ts`, `student/uc/student-uc.fixture.ts`.
- Бот: `learning/stories/step-view.test.ts`, `nav-tree.test.ts`, `learning/step-message.test.ts`, `learning/controller.test.ts`, `student-nav-resolver.test.ts`, тесты `view-stream`, `course-catalog.story.test.ts`, `course-dmg.test-kit.ts`, e2e `runners/u7-bot/tests/{e2e,learning,streams}`.

### Критерии приёмки

- `bun run check` зелёный; тестов ≥ базы; удалённые дубли — с указанием (TST-08).
- `GetStepUcDef`/`GetStepsByLessonsUcDef` не вызываются из студенческих сценариев `learning/*`.
- Ментор (не автор) читает draft через `getStep`; студент — нет; студент потока — по снимку.
- Снимок: draft-урок/шаг пропущен, warn с `moduleId` и id; в `update-stream-snapshot` warn виден.
- Отметка статуса у видящих неопубликованное; у студента нет.
- CHANGELOG `[0.3.1]`: ментор видит черновики, чтение из потока по снимку, warn при пропуске.

### Правила (ID)

DOM-13, DOM-15, DOM-18, ERR-07, API-05, TST-08, CODE-04, ARC-06/07/08; `reference/caller.md` п.3-4, `guides/use-case.md` §1.

### Документы

`runners/u7-bot/src/controllers/learning/ui-spec.md` (отметка статуса), CHANGELOG; `conductor/architecture/` — grep `canSeeUnpublished`.

## Отчёт dmg-test-designer (Sonnet)

Тесты написаны, не закоммичены (уйдут в коммит реализации). Красных: 34 в `domain`/`modules`/`scripts` (4 файла — импорт несуществующих модулей), 27 в боте; зелёных — 772 и 726.

**Предположения о Def (обязательны для авторов — тесты на них опираются):**
- `GetSnapshotStepsUcDef` (`getSnapshotSteps`, `callers: ['system']`, `allowAll`): вход `{ stepIds }`, выход `StepView[]` в порядке `stepIds`, отсутствующие пропускаются; класс `modules/course/src/step/uc/get-snapshot-steps.uc.ts`; в `course` 17 UC.
- `ModulePolicy.canSeeUnpublished` + MENTOR (студент = GUEST, роли STUDENT нет).
- `StepSummary.status` — в `StepAr.summaryFor`, `LessonStepsDqs`, ответе `getStepsByLessons`.
- `ModuleSnapshotDqs(module, lessons, steps)`: `build()` — `ContentSnapshot` только с published-шагами (шаг, которого нет среди переданных, — тоже пропуск); `skipped()` — `{kind:'lesson', lessonId} | {kind:'step', lessonId, stepId}`; урок без опубликованных шагов остаётся с пустым `stepIds`; пропущенный урок — одна запись без его шагов; урок в двух проектах — один пропуск.
- `GetModuleSnapshotUc`: шаги одним запросом, по `logger.warn` на пропуск. `MemoryLogger` пакета хранит только `{level, source, message}` → `moduleId` и `lessonId`/`stepId` писать и в `message`, и в `meta`.
- `GetStreamStepUcDef` (`getStreamStep`, `query`, `callers: ['user']`): вход `{ streamId, stepId }`, выход `StepView`; ошибки `STREAM_NOT_FOUND`, `STEP_NOT_FOUND` (вне снимка), `ACCESS_DENIED` (не студент потока / не ментор потока / не админ; ментор-роль чужого потока — тоже отказ); при отказе курс не вызывается, при успехе — `getSnapshotSteps({ stepIds: [stepId] })`.
- `GetStreamLessonStepsUcDef` (`getStreamLessonSteps`): вход `{ streamId, lessonIds }`, выход `Record<lessonId, {uuid, description, status}[]>` в порядке снимка, урока вне снимка нет; один вызов `getSnapshotSteps`; в `stream` 19 UC; классы — `modules/stream/src/stream/uc/`.
- Бот: `learning/*` — только stream-UC; метка зависит от `status` в ответе курсовых UC, на студенческом пути метки нет. `scripts/_course-client.ts` экспортирует `warnOnlyLogger` (warn → `console.warn`), подставляется при `silent`.

**Изменённые существующие тесты:** `module.policy.test.ts` (ментор → allowed), `course.module.test.ts` и `course.module.serves.test.ts` (16 → 17), `stream.module.student.test.ts` (17 → 19), `lesson-steps.dqs.test.ts` и `step.ar.test.ts` (+`status`), `module-snapshot.dqs.test.ts` (блок «stepIds целиком» → «шаги (Ф4а)»), `get-module-snapshot.uc.test.ts` («шаги не читаются» → «одним запросом»; «system от ментора — ACCESS_DENIED» → студент denied, + «ментор получает снимок»), `get-steps-by-lessons.uc.test.ts` (+`status`), `get-{step,lesson,module}.uc.test.ts` (+ментор), `step-view.test.ts` и `nav-tree.test.ts` (моки → stream-UC). Новые: `get-snapshot-steps.uc.test.ts`, `get-stream-step.uc.test.ts`, `get-stream-lesson-steps.uc.test.ts`, `view-stream.status-mark.test.ts`, `course-catalog.status-mark.test.ts`, `scripts/course-client.test.ts`.

**Не добавлено:** сценарий 8 (`createStream`) — дубль сценариев 3–4 (TST-08), тест «снимок как есть» уже есть. Дублей и кандидатов в чистку нет.

**Проверить автору:** `view-stream.story.test.ts`, `mentor/stories/view-stream-mentor.test.ts` после `status`; `list-modules`, `list-courses`, e2e `runners/u7-bot/tests`.

**Решение orchestrator — метка урока:** только где урок приходит из API курса (каталог); если в ответе нет статуса урока, автор добавляет его так же, как `StepSummary.status`. В `view-stream` уроки из снимка, черновиков там нет — метки урока нет.

## Отчёт dmg-domain-author (Opus)

`bun test domain/` — 902 pass; гейт красный только в `modules/course`, `modules/stream`, `scripts` (ждут реализаций).

- Course: `ModulePolicy` + `isMentor`; `StepSummary.status`; схема ответа `getStepsByLessons` вынесена в `StepsByLessonVo` (переиспользует stream); `GetSnapshotStepsUcDef`; `ModuleSnapshotDqs(module, lessons, steps)` + `build()`/`skipped()`, тип `SkippedSnapshotItem` (висячий `stepId` — тоже пропуск с warn; отсутствующий урок — молча, как раньше); `StepView` экспортируется значением; 17 UC.
- Stream: `StreamAr.hasStep`, `lessonSteps(lessonIds)`; `StreamPolicy.canReadContent` = студент этого потока ∨ ментор потока ∨ админ (контекст `{ stream, student }`); `StreamLessonStepsDqs`; `GetStreamStepUcDef`, `GetStreamLessonStepsUcDef` (`calls: [GetSnapshotStepsUcDef]`); 19 UC.
- Отклонения: «шаг в снимке» — вопрос Ar, `STEP_NOT_FOUND` возвращает UC (ошибка группы course, DOM-16); статус урока в выход не добавлен — есть в `LessonView`; генератор `gen uc` отказал из-за red-теста на месте файла — Def вручную.
- Для api-author: ARC-04 в red-тесте `get-stream-step.uc.test.ts` — импорт из `@u7-scl/domain/course` мимо `contract.ts` → `@u7-scl/domain/course/contract`, `StepView['status']`.

**Открытый вопрос Нурболату (на контрольную точку):** студент потока = запись с любым статусом, включая ушедших и завершивших — им материалы снимка открыты. Так задумано?

## Отчёт dmg-api-author (Sonnet)

`bun test modules/course modules/stream scripts` — 523 pass; `tsc` вне бота чисто; `arch:check` — 0. Гейт: 3230 pass, 29 fail — только бот.

- `GetSnapshotStepsUc` (пустой список — без запроса), `GetModuleSnapshotUc` (шаги одним запросом, warn на каждый пропуск, id в message и meta), `GetStreamStepUc`, `GetStreamLessonStepsUc` (`load`: поток + запись вызывающего в потоке через `students.findByUser` + `belongsToStream`; `hasStep` до вызова курса), `warnOnlyLogger` (`[source] message` → `console.warn`). ARC-04 в red-тесте исправлен.
- Отклонение: фикстура `author` — ментор, после правила «ментор видит всё» два старых теста (`list-modules.uc.test.ts` «чужие черновики не видны», `get-steps-by-lessons.uc.test.ts` «право по модулю шага») теряли смысл. Добавлен `plainAuthor` (тот же uuid, роль GUEST) в `module-uc.fixture.ts`, тесты переведены на него, ожидания не менялись. Принято orchestrator.

## Решение Нурболата — доступ студента по прогрессу (2026-11-14)

Студент потока (любой статус записи: активен, ушёл, завершил) видит содержимое шагов, которые прошёл хоть раз; непройденные — только заголовки (🔒). Забросивший — так же; завершивший поток — так же (пройденное остаётся доступным).

Решение orchestrator по исполнению:
- Содержимое шага студенту — если шаг в его прогрессе `completed` или `issued` (выданный текущий); иначе `getStreamStep` → отказ (замок). Сейчас замок соблюдает только бот (`student-nav-resolver.ts:246`), сервер — нет: правило переносится в домен (`StudentAr`/`StudentProgressDqs` уже знают статусы шагов; `canReadContent` + проверка шага).
- Ментор потока и админ — всё содержимое снимка.
- `getStreamLessonSteps` (описания/заголовки) — без замка, как в nav-tree сейчас.
- Исполнение — доработка домена и прикладного слоя после шага бота: red-тесты (студент: completed — видит, issued — видит, locked — отказ; ушедший и завершивший — completed видит, locked — отказ) → `dmg-domain-author` → `dmg-api-author`.

## Отчёт dmg-api-author / бот (Sonnet, `general-purpose`)

Студенческий путь `learning/*` — на `getStreamStep`/`getStreamLessonSteps` (`streamId` из `student.streamId`; `buildStepList` — один `getStreamLessonSteps` вместо `getStep` на шаг; в nav-tree описания грузятся только на уровне урока). Метка — `controllers/shared/status-mark.ts` (`withStatusIcon`, `withStatusLabel`), в `view-stream.story.ts` и `course-catalog.story.ts`. `learning/ui-spec.md` дополнен. Отклонение: `platform/core/src/ui/content-nav/presenter.ts` — `cleanChildButtonTitle` срезал значки → сохраняет `🚧`/`🗄`; принято orchestrator как C-DEBT-56 (погашает dmg-ui). Метки урока в каталоге нет — уроки из снимка.

## Отчёт dmg-test-designer — замок (Sonnet)

15 red; `u7-app.test.ts` починен (в `seedCourse` досеян опубликованный шаг — висячий шаг давал пустой снимок).
- `StreamPolicy.rules.canReadStep`, контекст `{ stream, student, stepId }`: `anyOf(студент потока ∧ student.hasIssued(stepId), isStreamMentor, isAdmin)`; `StudentAr.hasIssued` уже покрывает issued и completed. Отказ — `ACCESS_DENIED` (Policy).
- `GetStreamStepUcDef.policy`: `canReadContent` → `canReadStep`; `load` кладёт `stepId` в контекст. `STEP_NOT_FOUND` (вне снимка) — раньше замка (тест закрепляет): проверка снимка до Policy.
- `getStreamLessonSteps` — на `canReadContent`, заголовки без замка (тесты green).
- Изменено: `get-stream-step.uc.test.ts` — студент в `beforeEach` с `done(STEP_1)`.

## Отчёт dmg-domain-author — замок (Sonnet)

`StreamPolicy.rules.canReadStep` = `anyOf(hasIssuedStep, isStreamMentor, isAdmin)`, контекст `StreamStepCtx`; `GetStreamStepUcDef.policy` → `canReadStep`. Отклонение: платформа идёт `load → policy → fetch`, поэтому `hasStep` → `STEP_NOT_FOUND` перенесён в `load` (решение — по-прежнему `StreamAr.hasStep`). `check` — 3286 pass.

## Данные (dmg-data-keeper + orchestrator)

- Схемы state не менялись — миграция не нужна, старые `contentSnapshot` читаются как есть, откат совместим.
- `data/courses` (git, только чтение, скрипт-счётчик в scratchpad): 1161 шаг, все `published`; висячих `stepIds` 0; неопубликованных уроков 0 → на текущем контенте сборка снимка ничего не пропустит, `update-stream-snapshot` не выбросит шагов. `data/streams/` локально нет (живые потоки — на prod).
- Перед `update-stream-snapshot` на prod — `bun run backup` (скрипт переписывает `contentSnapshot`); прогресс студента по выпавшему шагу не удаляется, но снимок на него больше не ссылается.

## Отчёт dmg-reviewer (Sonnet)

error нет. Чисто: Policy — только субъект и контекст; system-UC `getSnapshotSteps` по `calls`, право до вызова курса; содержимое draft студенту — только через `getStreamStep` с замком; DOM-13/15, CODE-04.

| ID | файл | суть | severity | решение orchestrator |
|---|---|---|---|---|
| TST-08 | `get-stream-step.uc.test.ts` | отказы Policy повторяют `stream.policy.test.ts` | warn | исправлено: 5 тестов удалены (покрыты `canReadContent`/`canReadStep`), остался один отказ + порядок «снимок раньше замка» |
| TST-08 | `get-stream-lesson-steps.uc.test.ts` | то же | warn | исправлено: 1 тест удалён, один отказ на проводку |
| TST-08 | `get-stream-lesson-steps.uc.test.ts` ↔ `stream-lesson-steps.dqs.test.ts` | сборка ответа проверена дважды | info | оставлено (исполнитель не удалил; дубль мелкий) |
| нейминг | `learning/shared.ts` | `loadStepDescriptions` vs `loadStreamStepDescriptions` | info | исправлено: `loadMentorStepDescriptions` |
| DOM-18 | `get-stream-lesson-steps.uc.ts` | студент получает `status` шагов в заголовках | info | принято: метку студенту бот не рисует, статус шага курса не секрет |

Следствие порядка «снимок до Policy»: посторонний различает `STEP_NOT_FOUND`/`ACCESS_DENIED` — узнаёт состав снимка; принято.

Итог: `check` — 3278 pass (база Ф4 — 3170 + новые тесты Ф4а, минус 6 дублей TST-08).

## Пересмотр Нурболата (2026-11-14, после `a7ccf81a`) — действует поверх разделов выше

- **Каталог «Курсы» — правила модуля курса.** `canSeeUnpublished` = админ ∨ автор модуля (ментор **убирается**); метка статуса — только у них. Новое правило тела шага (рабочее имя `canReadStepBody`) = `canSeeUnpublished` ∨ роль `MENTOR` ∨ роль `AUTHOR`; только опубликованное, кроме админа и автора модуля. `GUEST`, `SUBSCRIBER` — опубликованное до заголовков шагов: `getStep` → `ACCESS_DENIED`, `getStepsByLessons` — заголовки опубликованных.
- **«Моя учёба», «Мои потоки» — правила потока** (без изменений): студент — снимок с замком, ментор потока и админ — весь снимок. `view-stream.story.ts` (ментор) **переходит на** `getStreamStep`/`getStreamLessonSteps`; курсовые `getStep`/`getStepsByLessons` в боте остаются только в `course-catalog`.
- Отменяется: «неопубликованное видит любой ментор» и решение 2 orchestrator (ментор в `view-stream` на `getStep`). Метки статуса в `view-stream` нет (снимок — не каталог); `status-mark` в `view-stream` убирается.
- Проекты: фильтр по статусу уже в `module.ar.ts:87-102` — проверить, что он зависит от `canSeeUnpublished` (админ/автор видят неопубликованные проекты).

Шаги: red-тесты (`dmg-test-designer`) → домен → прикладной слой → бот → гейт → ревью.

## Отчёт dmg-test-designer — пересмотр (Sonnet)

23 red, прочее зелёное (3279 pass).
- `ModulePolicy.canSeeUnpublished` — ментор снова denied; новое `canReadStepBody` = `canSeeUnpublished ∨ MENTOR ∨ AUTHOR` (7 тестов). Для `AUTHOR` у `UserAr` нужен `isAuthor()`.
- `getStep`: published — тело по `canReadStepBody` (GUEST/SUBSCRIBER/гость → `ACCESS_DENIED`, `payload.rule: canReadStepBody`); draft/archived — по `canSeeUnpublished`. `getStepsByLessons` — заголовки опубликованных всем. `getLesson`/`getModule`/`listModules`/фильтр проектов — черновики только админ и автор модуля. `getModuleSnapshot` от ментора на черновике модуля → `ACCESS_DENIED` (перевёрнут; принято orchestrator — следствие пересмотра).
- Бот: `view-stream` и `mentor/view-stream` — на `getStreamStep`/`getStreamLessonSteps`, меток нет (`view-stream.status-mark.test.ts` переписан). Каталог шаги не открывает и раньше (только заголовки) — закреплено характеризацией, прод-правок нет.
- Фикстуры: `admin`, `roleAuthor`, `subscriber` в `module-uc.fixture.ts`.
- Кандидат в чистку (не решено): матрицы «роль → видит» в UC-тестах поверх `module.policy.test.ts`.

## Отчёт dmg-domain-author — пересмотр (Sonnet)

`bun test domain modules` — 1563 pass; `tsc` вне бота, `arch:check`, `biome` — чисто.
- `UserAr.isAuthor()`; `ModulePolicy`: `canSeeUnpublished` = админ ∨ автор модуля, `canReadStepBody` = админ ∨ автор модуля ∨ ментор ∨ роль AUTHOR («Нет доступа к содержимому шага»).
- `GetStepUc`: опубликованный — `canReadStepBody`, черновик/архив — `canSeeUnpublished`; при отказе — `ACCESS_DENIED` сразу (`StepAr.viewFor(false)` отдаёт опубликованный шаг любому — одной смены правила мало), при разрешении — `viewFor(true)`.
- Фильтр проектов `module.ar.ts` не менялся — зависит от `canSeeUnpublished`.

## Отчёт dmg-reviewer — пересмотр (Sonnet) и правки

Обхода `canReadStepBody` для GUEST/SUBSCRIBER нет (`getLesson`/`getModule`/`getModuleSnapshot`/`getStepsByLessons` тела не отдают; `getSnapshotSteps` — только `system`, право проверяет stream); DOM-15 чисто.

| суть | severity | решение orchestrator |
|---|---|---|
| `canReadStepBody` не смотрит статус модуля — ментор/AUTHOR получали тело опубликованного шага черновика модуля | question | исправлено: `canReadStepBody` — только при опубликованных шаге **и** модуле, иначе `canSeeUnpublished` (трактовка «только опубликованное») |
| `viewFor(true)` под разрешением размывает смысл флага | minor | исправлено: `step.view()` |
| `denyMessage` у `hasAuthorRole` | minor | исправлено: «Нужна роль «Автор»» |
| TST-08: матрицы ролей в UC-тестах поверх `module.policy.test.ts`; характеризация каталога по ролям | minor | исправлено: по одному allowed/denied на правило; каталог — один тест. Остался `test.each` по ролям «в уроке только заголовки» в `course-catalog.status-mark.test.ts` (dispatch замокан) — мелкий, оставлен |

`check` — 3293 pass.
