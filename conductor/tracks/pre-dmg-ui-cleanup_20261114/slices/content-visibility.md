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
