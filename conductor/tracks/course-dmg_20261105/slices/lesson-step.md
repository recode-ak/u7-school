# Бриф среза: `course` / `lesson` + `step` + снимок (Ф2)

Черновик — `dmg-tech-lead`, Ф0; проверка — orchestrator. Читать вместе с брифом Ф1 (`module.md`: решения Р1–Р9, Т1–Т13 считаются принятыми), `../spec.md`, `../plan.md` (Ф2), D-64, D-65, TR-52, TR-40, эталоном `wish`, ближайшим `stream`.

Код `lesson`, `step`, снимка в `v0.2.6` (`../u7-school-v0.2.6/packages/course/src`) совпадает с HEAD с точностью до импортов, `biome-ignore` и правки комментария `content-snapshot.ts` (проверено `diff`: `domain/{lesson,step}/{a-root,policy,entity}.ts`, `course-ds.ts`, `api/{lesson/get-lesson,step/get-step,step/get-steps-by-lessons,module/get-module-snapshot}-uc.ts`). Характеризация — на текущих тестах и на чтении кода (у `get-steps-by-lessons` и legacy `get-module-snapshot` тестов нет).

## Расхождения spec/plan с кодом

1. **У `GetModuleSnapshotUcDef` уже есть адаптер и Def.** Def — `domain/src/course/course/uc/get-module-snapshot.uc.ts` (`aggregate: CourseArDef`, `callers: ['system']`, `errors: [CourseErrors.MODULE_NOT_FOUND]`), адаптер — `modules/course/src/course/uc/get-module-snapshot.uc.ts` (с `legacy.getModuleSnapshot`). Задача плана «заменить адаптер настоящим UC» = перенести Def в агрегат `module` (снимок — вопрос про модуль) и заменить класс. Пары путей меняются (`module/uc/get-module-snapshot.uc.ts` в домене и в прикладном слое), старые файлы и тесты удаляются; запись DEBT-44 для этого пути снимается (`debt.md`, «Место»).
2. **Вызывающие снимка шире `system`.** `callers: ['system']` (stream через `calls: [GetModuleSnapshotUcDef]`, `domain/src/stream/stream/uc/create-stream.uc.ts:44`), но в боте `get-module-snapshot` зовёт `course-catalog.story.ts:275,351,416,444,469,657,739` (гость/пользователь), скрипты — `list-lessons.ts:173`, `distribute-lesson.ts:363`, `update-stream-snapshot.ts:122`. У настоящего UC `callers: ['user','guest','system']` (Т1); для `system` субъект — `person` вызвавшего (ментор `createStream`).
3. **Legacy-снимок не «только из опубликованного» для проверки доступа.** `GetModuleSnapshotUc` (`modules/course/src/api/module/get-module-snapshot-uc.ts`) сначала проверяет видимость модуля и **каждого** урока всех проектов (в том числе черновых) через `getOutLesson`, который бросает `LESSON_ACCESS_DENIED` на любом неопубликованном уроке для не-автора. Фильтр `Status.PUBLISHED` в `CourseDs.buildSnapshot` (`course-ds.ts`, «Только опубликованные проекты/уроки») для не-автора недостижим: снимок модуля с черновым уроком падает целиком. На текущих данных не проявляется (все 24 проекта и 248 уроков `published`). Предложение перепроектирования — С2.
4. **Вызов фасадом идёт без актора** (`course-in-proc-facade.ts:22`): для черновика модуля legacy-снимок бросает `MODULE_ACCESS_DENIED`, адаптер превращает это в `SERVER_INTERNAL` (его тест `get-module-snapshot.uc.test.ts` фиксирует «иной сбой legacy — SERVER_INTERNAL»). В DMG-варианте — `ACCESS_DENIED` ядра (модуль не опубликован, вызывающий не автор и не администратор) или снимок опубликованной части для автора/администратора.
5. **`CourseDs` содержит больше, чем `buildSnapshot`.** Остальные методы (`includesModule`, `createLesson`, `createStep`, `findStepPosition`, `findLessonTitle`, `findProjectTitle`, `countTotalSteps`) вызывают только тесты и legacy authoring (`create-step-uc.ts:5,56`); у `stream` своя копия (`student-progress.dqs.ts:219`). В Ф2 заменяется только `buildSnapshot`; `CourseDs` и его тест остаются до Ф5 (legacy-UC снимка и `create-step`), `includesModule` перейдёт в Ф3 (`course`).
6. **Plan: «перенос `content-snapshot*.test.ts`».** `content-snapshot.ts` — общий VO (`ContentSnapshotVo`, на нём state `stream`, `domain/src/stream/stream/stream.state.ts`); он остаётся как есть, тесты `content-snapshot.test.ts` (9) и `content-snapshot-index.test.ts` (4) остаются и переносить нечего. Переносятся только сценарии `buildSnapshot` из `course-ds.test.ts` (2) в тест DQS.
7. **Plan Ф2 «в `get-module-snapshot.uc.ts` нет `legacy.`»** — файл переезжает (расхождение 1): критерий читать по новому пути `modules/course/src/module/uc/get-module-snapshot.uc.ts` и по каталогу `modules/course/src/course/uc/` (оставшиеся адаптеры Ф3 `legacy.` содержат, снимок — нет).
8. **Данные.** В `steps.json` 32 черновых шага (`status: "draft"`), и каждый входит в `stepIds` опубликованного урока (по одному на 32 урока, все в проектах модулей). Снимок несёт их `stepIds`, а `get-step` их студенту не отдаст. Это поведение v0.2.6, но потенциально ошибка данных или продукта — вопрос С1.

## Границы

**Домен `domain/src/course`:**
- Новое:
  - `lesson/lesson.{state,errors,ar,fixture}.ts`, `lesson/uc/get-lesson.uc.ts`;
  - `step/step.{state,errors,ar,fixture}.ts`, `step/uc/{get-step,get-steps-by-lessons}.uc.ts`;
  - `module/uc/get-module-snapshot.uc.ts` (перенос Def), `module-snapshot.dqs.ts` (на уровне модуля, `naming.md` §2);
  - тесты рядом.
- Изменяется: `course.module.ts`, `contract.ts`, `index.ts`, `module/module.ar.ts` (метод контура снимка), `course.module.test.ts`.
- Переименование legacy (шаг S0 этого среза): `lesson/a-root.ts` (`LessonAr` → `LegacyLessonAr`), `lesson/policy.ts` (`LessonPolicy` → `LegacyLessonPolicy`), `lesson/repo.ts` (`LessonRepo` → `LegacyLessonRepo`); то же для `step` (`LegacyStepAr`, `LegacyStepPolicy`, `LegacyStepRepo`); ссылки в `index.ts`, `module.ts`, `course-ds.ts`, тестах `lesson/{a-root,policy}.test.ts`, `step/{a-root,policy}.test.ts`.
- Удаляется: `course/course/uc/get-module-snapshot.uc.ts` и его тест (переезд).

**Прикладной слой `modules/course/src`:**
- Новое: `lesson/{lesson.repo,lesson.repo.fake}.ts`, `lesson/uc/get-lesson.uc.ts`; `step/{step.repo,step.repo.fake}.ts`, `step/uc/{get-step,get-steps-by-lessons}.uc.ts`; `module/uc/get-module-snapshot.uc.ts` (замена адаптера); `infra/{lesson,step}.json-repo.ts`; тесты рядом.
- Изменяется: `course.module.ts` (`lessons`, `steps` в `CourseModuleDeps`, 4 записи карты, снятие адаптера снимка), `module/module.repo.ts` (если нужен `findByIds`, Т6), `infra/index.ts`, тесты сборки.
- Удаляется: `course/uc/get-module-snapshot.uc.ts` + `.test.ts`.
- Переименование legacy (S0): `infra/db/{lesson,step}-json-repo.ts` (+ тесты) → `LegacyLessonJsonRepo`, `LegacyStepJsonRepo`; ссылки в `api/**` (`course-uc.ts`, `lesson/*`, `step/*`), `infra/index.ts`.

**Вне пакета (Ф2):**
- `platform/app/src/u7-app.ts:121-122` и фабрика `CourseModuleDef`: переименованные импорты; `courseLessons`, `courseSteps` в `repos`.
- `scripts/_app-factory.ts:44,109-110`.
- `platform/app/tests/u7-app.test.ts:317-331` не правится, но теперь проходит через настоящий UC (`createStream` читает `modules.json` и `lessons.json` новым репозиторием).
- `conductor/architecture/debt.md` — orchestrator.

**Не трогать:** `data/`; `CourseArDef`, `CourseErrors` (Ф3); `content-snapshot.ts`; `CourseDs` (кроме ссылок на переименованные классы); контракты `stream`, `wish`; stories и тесты бота; `biome.json`.

## Решения брифа

**Р1. Состояние `lesson.state.ts`.** `LessonState = v.object({ ...BaseEntityFields, moduleId: F.uuid('модуля'), title, additional?, status, estimatedMinutes?: int ≥ 1, stepIds: uuid[], mentorStepIds: uuid[] })`. Правила Ф1 Р1 (заголовок обрезается через `transform`, описания до него). Данные: 248 уроков, `updatedAt` нет у 2 (читаются как `createdAt`), `mentorStepIds` везде пуст.

**Р2. Состояние `step.state.ts`.** `StepState = v.variant('kind', [text, code, file])`, в каждой ветке `...BaseEntityFields`, `moduleId`, `description` (trim, `nonEmpty`), `content?`, `status`; `code`: `code` (`nonEmpty`), `language?`; `file`: `file: FileVo`. `FileVo` — локальный VO домена (`uuid`, `name`, `mimeType`, `size ≥ 0`, `description?`), копия `FileMetadataSchema` без импорта `@u7-scl/core` (DEBT-1). Variant-state `AggregateDef` поддерживается (бриф `questionnaire`, «Проверка variant-state»), правка `dmg-core` не нужна. Данные: 1161 шаг, `text` 1117, `code` 44, `file` 0; `content` отсутствует у 44 шагов `code`; `updatedAt` нет у 457.

**Р3. Агрегаты.** `LessonArDef`, `StepArDef` — как `ModuleArDef` (Ф1 Р2): `statuses` draft/published/archived, `transitions: {}`, `events: {}`, `errors` своей группы. Ar: `private constructor`, `restore`, без `create`.
- `LessonAr`: `moduleId` (связь — геттер, DOM-04), `isPublished()`, `viewFor(canSeeUnpublished): LessonView | undefined` (привилегированному — любой статус, иначе только `published`), `outline(): { lessonId, lessonTitle, stepIds }` — вклад в снимок.
- `StepAr`: `moduleId`, `isPublished()`, `viewFor(canSeeUnpublished): StepView | undefined`, `summaryFor(canSeeUnpublished): { uuid, description } | undefined` — для `getStepsByLessons`.
- `ModuleAr` (Ф1) получает вопрос `publishedOutline(): { projectId, projectTitle, lessonIds }[]` — проекты `published`, порядок сохранён.
- Собственных Policy у `lesson`/`step` нет: право «видит черновик урока/шага» — то же `ModulePolicy.rules.canSeeUnpublished` с контекстом `{ module }` модуля-владельца (в legacy — `ModulePolicy.isAdminOrAuthor(actor, module)`, `lesson/policy.ts:20`, `step/policy.ts:20`). Спекулятивные `LessonPolicy`/`StepPolicy` не заводятся (Т2).

**Р4. Ошибки.** `LessonErrors = ErrorDef.define('LESSON', { NOT_FOUND })`, `StepErrors = ErrorDef.define('STEP', { NOT_FOUND })` (`not_found`, payload `{ lessonId }` / `{ stepId }`). Отказ — `ACCESS_DENIED` ядра с `rule: 'canSeeUnpublished'`; тексты `denyMessage` «Нет доступа к модулю» (общее правило). `ModuleErrors.NOT_FOUND` — по ссылке (ERR-03) в `errors` `getLesson`/`getStep`: у legacy урок/шаг с несуществующим модулем даёт `MODULE_NOT_FOUND` (`course-uc.ts:21-33`, `LessonModuleError`).

**Р5. UC** (все `type: 'query'`, `policy: allowAll`):

| UC | Вход | Выход | `callers` | `errors` |
|---|---|---|---|---|
| `getLesson` (`lesson`) | `{ lessonId }` | `LessonView` | `user`, `guest` | `LessonErrors.NOT_FOUND`, `ModuleErrors.NOT_FOUND` |
| `getStep` (`step`) | `{ stepId }` | `StepView` | `user`, `guest` | `StepErrors.NOT_FOUND`, `ModuleErrors.NOT_FOUND` |
| `getStepsByLessons` (`step`) | `{ lessonIds: uuid[] }` | `v.record(uuid, v.array({ uuid, description }))` | `user`, `guest` | — (модуль шага не найден → шаг пропускается, Т5) |
| `getModuleSnapshot` (`module`) | `{ moduleId }` | `ContentSnapshotVo` | `user`, `guest`, `system` | `CourseErrors.MODULE_NOT_FOUND` (прежний контракт `stream`, Ф1 Т3) |

- `getLesson`/`getStep`: `load` — урок/шаг или `NOT_FOUND`; модуль-владелец — `modules.findById(lesson.moduleId)` или `ModuleErrors.NOT_FOUND`; в `execute` — `canSeeUnpublished.evaluate(caller.subject(), { module })` + `viewFor` (как `getModule` в Ф1).
- `getStepsByLessons`: уроки `lessons.findByIds`, шаги одним запросом `steps.findByIds`, модули — по различным `step.moduleId` один раз каждый (в legacy `getModule` на каждый шаг, `get-steps-by-lessons-uc.ts`); право считается один раз на модуль. Результат: `lessonId → [{ uuid, description }]`, только уроки с ≥1 видимым шагом, порядок шагов — по `lesson.stepIds`. Видимость самого урока **не проверяется** (как в v0.2.6; Т5).
- `getModuleSnapshot`: `load` — модуль или `COURSE_MODULE_NOT_FOUND`; `execute` — модуль виден только автору/администратору **или опубликован** (иначе `ACCESS_DENIED`, расхождение 4); уроки опубликованных проектов — `lessons.findByIds`; сборка — `ModuleSnapshotDqs`. Неопубликованный урок опубликованного проекта молча пропускается, а не обрушивает вызов (С2). `steps` не читаются. Aggregate Def — `ModuleArDef`; файл Def — `module/uc/get-module-snapshot.uc.ts`.

**Р6. DQS `module-snapshot.dqs.ts`.** `ModuleSnapshotDqs` — класс над `ReadonlyAr<ModuleAr>` и `readonly ReadonlyAr<LessonAr>[]`, метод `build(): ContentSnapshot`: проекты — `module.publishedOutline()`; в проекте уроки в порядке `lessonIds`, найденные по `uuid`, только `isPublished()`; формат `{ projectId, projectTitle, lessons: [{ lessonId, lessonTitle, stepIds }] }`. Заменяет `CourseDs.buildSnapshot`. Второй потребитель DQS — нет (`repo.md` §5 против «DQS на вырост»); оставлен по решению плана («сборка — DQS вместо `CourseDs`»). Вариант: метод Ar `ModuleAr.snapshotWith(lessons)` — не рекомендуется (Ar принимает чужие Ar).
- Урок из `project.lessonIds`, которого нет в репозитории, пропускается (как `.filter(l !== undefined)` в `buildSnapshot`). Это маскирует рассогласование данных (DOM-13), но сохраняет поведение; на данных 0 висячих (184 из 184). Решение Т4: сохранить и записать в `debt.md`.
- `stepIds` урока включаются целиком, без фильтра по `status` шагов (расхождение 8, С1).

**Р7. Порты.** `LessonRepo`: `Repository<LessonAr> & { findById; findByIds(ids) }`; `StepRepo` аналогично. `findByIds` возвращает в порядке файла (как `getByIds`, `lesson-json-repo.ts:23-26`) — порядок результата UC определяют `stepIds`/`lessonIds`, не порядок выборки. Если `getStepsByLessons` потребует `ModuleRepo.findByIds` — добавить в порт Ф1. `getByCourseId` не переносится (Ф1, расхождение 7).

**Р8. JSON-репозитории.** `lesson.json-repo.ts`, `step.json-repo.ts` — как `module.json-repo.ts` (Ф1 Р7). `steps.json` весит 1,8 МБ: разбор целого файла на каждый запрос — как у legacy; кеш не вводится (Т7).

**Р9. Модуль.** `CourseModuleDef`: `aggregates: [CourseArDef, ModuleArDef, LessonArDef, StepArDef]`, UC: 6 внешних контрактных адаптеров (без `getModuleSnapshot`) + `getModule`, `listModules` (Ф1) + `getLesson`, `getStep`, `getStepsByLessons`, `getModuleSnapshot` = 12. `external: true` остаётся до Ф5. Карта `courseModuleMap`: `getModuleSnapshot` → новый `GetModuleSnapshotUc`, адаптер удалён; `CourseLegacy` теряет `'getModuleSnapshot'` из `Pick` и поле остаётся прочим адаптерам (Ф3 снимет).

**Р10. Контракт.** `contract.ts`: добавить `LessonErrors`, `StepErrors`, `GetLessonUcDef`, `GetStepUcDef`, `GetStepsByLessonsUcDef`, типы `LessonView`, `StepView`, `StepsByLesson`; `GetModuleSnapshotUcDef` реэкспортируется с нового пути (импорты `stream` идут через `contract` и не меняются).

## Шаги (по ролям)

0. **migrator (flash), S0.** Переименование legacy `Lesson*`/`Step*` в `Legacy*` (раздел «Границы»); гейт — как S0 Ф1.
1. **dmg-test-designer (Sonnet).** Характеризация и red.
   - Новые файлы: state (legacy-записи, три `kind`, `file` без `description`), Ar (`viewFor` по статусам и флагу, `outline`, `summaryFor`), DQS, UC на фейках, репозитории (`mkdtemp`), Def-контракты.
   - Перенос Def и теста снимка: `domain/src/course/course/uc/get-module-snapshot.uc.test.ts` (6) → `module/uc/`, обновить `aggregate`, `callers`, паспорт.
   - Реализации: `modules/course/src/course/uc/get-module-snapshot.uc.test.ts` (5) заменяется тестом настоящего UC.
2. **migrator (flash), домен.** `gen aggregate course.lesson --adopt`, `gen aggregate course.step --adopt`, `gen dqs course module-snapshot`; перенос Def снимка; `contract.ts`, `index.ts`, `course.module.ts`.
3. **migrator (flash), прикладной слой и сборка.** Порты, фейки, UC, JSON-репозитории, карта, удаление адаптера снимка, `u7-app.ts`, `_app-factory.ts`.
4. **Гейт** и grep-критерии; `git diff --numstat`.
5. **dmg-data-keeper (flash).** См. «Данные».
6. **orchestrator.** TR на Т1–Т9, решения по С1–С2, `debt.md` (DEBT-44: путь `course/uc/get-module-snapshot.uc.ts` снят).
7. **dmg-reviewer (Opus).**

## Было → станет

### Домен

| Было | Станет |
|---|---|
| `lesson/entity.ts` `LessonSchema` (`isoDateTime`, DEBT-5), `lesson/a-root.ts` `LessonAr` (`create`, `addStep`, `getVisibleFor`), `lesson/policy.ts` `LessonPolicy` | legacy → `LegacyLessonAr`/`LegacyLessonPolicy` до Ф5; новое `lesson.state.ts`, `lesson.ar.ts` (`restore`, `isPublished`, `viewFor`, `outline`), `lesson.errors.ts` |
| `step/entity.ts` `StepSchema` (variant `text`/`code`/`file`, `FileMetadataSchema` из `@u7-scl/core`), `step/a-root.ts` `StepAr` (`create`, `getVisibleFor`), `step/policy.ts` | legacy до Ф5; новое `step.state.ts` (`FileVo`), `step.ar.ts` (`restore`, `isPublished`, `viewFor`, `summaryFor`), `step.errors.ts` |
| `lesson/commands/{get-lesson,create-lesson}-cmd.ts`, `step/commands/{get-step,get-steps-by-lessons,create-step}-cmd.ts` (метатипы) | остаются до Ф5; контракт — 3 новых Def UC |
| `module/commands/get-module-snapshot-cmd.ts` (метатип), `course-ds.ts` `buildSnapshot` | остаются для legacy-UC; новое — `module/uc/get-module-snapshot.uc.ts`, `module-snapshot.dqs.ts` |
| `course/uc/get-module-snapshot.uc.ts` (`aggregate: CourseArDef`, `callers: ['system']`) | удалён; новый Def в `module/uc/`, `aggregate: ModuleArDef`, `callers: ['user','guest','system']` |

### Прикладной слой

| Было | Станет |
|---|---|
| `api/lesson/get-lesson-uc.ts`, `api/step/get-step-uc.ts`, `api/step/get-steps-by-lessons-uc.ts`, `api/module/get-module-snapshot-uc.ts` (legacy `CourseUseCase`) | остаются до Ф5; новые `lesson/uc/get-lesson.uc.ts`, `step/uc/{get-step,get-steps-by-lessons}.uc.ts`, `module/uc/get-module-snapshot.uc.ts` |
| `course/uc/get-module-snapshot.uc.ts` (адаптер над `legacy.getModuleSnapshot`) | удалён |
| `infra/db/{lesson,step}-json-repo.ts` (`JsonFileRepo`) | `LegacyLessonJsonRepo`, `LegacyStepJsonRepo`; новые `infra/{lesson,step}.json-repo.ts` (`VersionedRepository`) |
| `CourseModuleDeps` `{ legacy, modules }` | `+ lessons: LessonRepo`, `steps: StepRepo`; `CourseLegacy` без `getModuleSnapshot` |

### Вне пакета

| Что | Изменение |
|---|---|
| `platform/app/src/u7-app.ts:121-122,256-258` | `LegacyLessonJsonRepo`/`LegacyStepJsonRepo` для `CourseApiModule`; новые репозитории в `dmgApp(…, repos)` |
| `scripts/_app-factory.ts:44,109-110` | переименованные импорты |

## Сохраняемое поведение (v0.2.6 = текущие тесты)

**Ветки и отказы:**
- `getLesson`/`getStep`: опубликованный — виден всем (в том числе гостю); черновик/`archived` — только автору модуля-владельца и администратору, остальным `ACCESS_DENIED` (`LESSON_ACCESS_DENIED`/`STEP_ACCESS_DENIED` в legacy); не найден — `NOT_FOUND`; модуль-владелец не найден — `MODULE_NOT_FOUND`.
- `getStepsByLessons`: пустой список/нет уроков → `{}`; шаги по порядку `stepIds`; невидимые и отсутствующие шаги пропускаются; урок без видимых шагов не попадает в ответ; видимость самого урока не проверяется.
- `getModuleSnapshot`: проекты и уроки только `published`; порядок проектов, уроков и `stepIds` из данных; пустой модуль → `[]`; модуль не найден → `COURSE_MODULE_NOT_FOUND`; `stepIds` без фильтра по статусам шагов.
- Тексты: «Нет доступа к модулю» (`denyMessage`), «Урок/Шаг не найден» (`label`).

**Тесты, закрепляющие состав модуля — обновляются в Ф2:**
- `domain/src/course/course.module.test.ts:17-32` — списки aggregates и UC (12 UC, 4 агрегата);
- `domain/src/course/course/uc/get-module-snapshot.uc.test.ts` — переезд (`aggregate`, `callers`);
- `modules/course/src/course.module.test.ts`, `course/uc/get-module-prerequisite.uc.test.ts` — сборка `createCourseModule({…, lessons, steps})`;
- вне границ, не меняются: `domain/src/stream/stream/uc/stream.uc-defs.test.ts:42`, `modules/stream/src/stream/uc/create-stream.uc.test.ts:137-156`, `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:723` (пин `COURSE_MODULE_NOT_FOUND`);
- `platform/app/tests/u7-app.test.ts:317-331` — зелёный через настоящий UC.

**Legacy-тесты и их судьба:**

| Файл (тестов) | Что в Ф2 |
|---|---|
| `domain/src/course/lesson/a-root.test.ts` (9) | перенос `getVisibleFor` (6) → `lesson.ar.test.ts` (`viewFor`); `create` (3) — authoring, не переносятся |
| `lesson/entity.test.ts` (6) | → `lesson.state.test.ts` (все; плюс legacy ISO без секунд, нет `updatedAt`) |
| `lesson/policy.test.ts` (12) | `canRead` (4) покрыты тестами `canSeeUnpublished` (Ф1) и `viewFor`; `canCreate`/`canEdit` (8) не переносятся |
| `step/a-root.test.ts` (11) | `getVisibleFor` (6) → `step.ar.test.ts`; `create` text/code/file (5) — authoring; ветки `kind` покрывает `step.state.test.ts` |
| `step/entity.test.ts` (10) | → `step.state.test.ts` (все) |
| `step/policy.test.ts` (12) | как `lesson/policy.test.ts` |
| `domain/src/course/course-ds.test.ts` (13) | `buildSnapshot` (2: «исключает archived-проект», «исключает archived-урок опубликованного проекта») → `module-snapshot.dqs.test.ts`; остальные 11 (`findStepPosition`, `findLessonTitle`, `findProjectTitle`, `countTotalSteps`) остаются с `CourseDs` до Ф5, не переносятся |
| `content-snapshot.test.ts` (9), `content-snapshot-index.test.ts` (4), `status.test.ts` (3) | остаются без изменений |
| `domain/src/course/course/uc/get-module-snapshot.uc.test.ts` (6) | переезд в `module/uc/` с правкой |
| `modules/course/src/api/lesson/get-lesson-uc.test.ts` (4), `api/step/get-step-uc.test.ts` (4) | переносятся все → `get-lesson.uc.test.ts`, `get-step.uc.test.ts` |
| `api/step/get-steps-by-lessons-uc.ts`, `api/module/get-module-snapshot-uc.ts` | тестов нет → сценарии пишет `dmg-test-designer` по коду (список выше) |
| `course/uc/get-module-snapshot.uc.test.ts` (5) | заменяется: «снимок как есть», «пустой модуль», «модуль не найден → `COURSE_MODULE_NOT_FOUND`» — сохраняются; «иной сбой → `SERVER_INTERNAL`» → ошибка репозитория; «модуль обслуживает `getModuleSnapshot`» → `facade.serves` |
| `infra/db/lesson-json-repo.test.ts` (2), `step-json-repo.test.ts` (2) | → `lesson.json-repo.test.ts`, `step.json-repo.test.ts` (save/findById, findByIds; плюс legacy ISO, `kind: file`, битая запись) |
| `api/lesson/create-lesson-uc.test.ts` (4), `api/step/create-step-uc.test.ts` (4) | authoring, не переносятся; удаляются в Ф5 |
| `infra/course-in-proc-facade.test.ts` (17; снимок — 2) | остаётся: фасад живёт до Ф5 |
| бот: `courses/stories/course-catalog.story.test.ts`, `learning/stories/{hub,nav-tree,step-view}.test.ts`, `mentor/stories/create-stream.test.ts`, `streams/stories/view-stream.story.test.ts`, `tests/mentor/mentor.integration.test.ts` | не меняются (legacy-UC живы); на Def-имена — Ф4 |

**Новое red:** TST-02 (`canSeeUnpublished` для урока/шага уже покрыт в Ф1 — здесь тесты UC по ролям/авторству модуля-владельца), TST-03 (каждая ошибка UC по `code`), `callers`, `INPUT_VALIDATION`; снимок — модуль черновой + гость → `ACCESS_DENIED`; черновой урок в опубликованном проекте не падает, а пропускается; `system`-вызов с `person` ментора-не-автора на черновом модуле → `ACCESS_DENIED`; порядок уроков по `lessonIds`; висячий `lessonId` пропускается (характеризация, помечена как долг).

## Внешние зависимости

- `stream` (клиент): `calls: [GetModuleSnapshotUcDef]` в `createStream`; Def реэкспортируется через `contract.ts`, импорты `stream` не меняются; ошибка `COURSE_MODULE_NOT_FOUND` и тип выхода — прежние; `callers` расширяются (совместимо).
- `user` (контракт): `Role`, `User` (TR-40); новых вызовов нет.
- Входящих событий и ER нет.

## Данные

Только чтение; формат на диске не меняется (ленивая миграция до трека 7; запись новыми репозиториями вне `mkdtemp` запрещена до Ф5, Ф1 Т11).
- `data/courses/lessons.json`: 248 уроков, поля `uuid, moduleId, title, additional, status, createdAt, updatedAt (у 246), estimatedMinutes, stepIds, mentorStepIds`; все `published`; даты `dddd-dd-ddTdd:dd`; 64 урока не входят ни в один проект (не попадают в снимок).
- `data/courses/steps.json`: 1161 шаг; `published` 1129, `draft` 32; `kind`: `text` 1117, `code` 44, `file` 0; поля `uuid, moduleId, description, content (у 1117), status, createdAt, kind, code/language (у 44), updatedAt (у 704)`; один шаг не входит ни в один урок; `moduleId` существует для всех шагов и уроков; `moduleId` шага = `moduleId` урока для всех пар.
- `dmg-data-keeper` (фикстуры в `mkdtemp`, плюс чтение копий): все 248 уроков и 1161 шаг читаются новыми репозиториями строго; round-trip (в копии); `getStepsByLessons` на реальных данных (копия) — число видимых шагов = 1129 минус шаги вне уроков; снимок каждого из 4 модулей совпадает с эталоном legacy-UC (`app.execute('get-module-snapshot')` на `DB_DIR=./data/fixtures` до и после — сравнение JSON); черновые шаги (32) в `stepIds` снимка — зафиксировать число; `sha256sum` трёх файлов до/после; `git status --short data/` пуст.
- `data/fixtures/courses`: 69 уроков, 71 шаг, все `published` — для сценариев с черновиками фикстуры создаются в тесте.

## Решения Нурболата и orchestrator (TR-53)

- **С1** — как v0.2.6, наблюдение — в TR-53 (не DEBT: долг в данных, не в коде).
- **С2** — **в срезе**: DQS снимка пропускает невидимый урок, вызов не падает.
- **С3** — см. С1 брифа `module` (принято).
- **Т1–Т11** — приняты по рекомендациям.

## Открытые вопросы

### Стратегические — Нурболату

**С1. 32 черновых шага входят в снимок.** В боевых данных у 32 опубликованных уроков по одному черновому шагу; `getModuleSnapshot` (v0.2.6 и далее) включает их `stepIds`, а `getStep` студенту их не отдаёт (в навигации бот подставит id). Для новых потоков это завышает число шагов и прогресс. Варианты:
- (а) оставить поведение v0.2.6, записать наблюдение в `debt.md`;
- (б) фильтровать `stepIds` по `published` в снимке (нужен `StepRepo` в UC, меняется содержимое новых потоков).
- Рекомендация: (а) — смена состава снимка затрагивает пользователей и выходит за перенос; решение по данным (опубликовать шаги или считать их частью дизайна) — за автором контента.

**С2. Перепроектирование снимка: неопубликованный урок не роняет вызов.** v0.2.6 падает на первом неопубликованном уроке для не-автора (расхождение 3), хотя намерение кода — пропуск. Вариант: пропускать (DQS) — на текущих данных поведение не меняется, поведение для пользователя меняется только при появлении черновых уроков.
- Сейчас в срезе / в `debt.md`.
- Рекомендация: **в срезе** — иначе тест на DQS пришлось бы писать против заведомо недостижимого фильтра.

**С3. Видимость и бот (С1 брифа Ф1)** — решение нужно к Ф4; в Ф2 затрагивает только то, что `getStep`/`getLesson` для автора станут отдавать черновики.

### Тактические — orchestrator → TR (рекомендации tech-lead)

| № | Вопрос | Рекомендация |
|---|---|---|
| Т1 | `callers` снимка `['user','guest','system']`; субъект `system`-вызова — `person` ментора; автор/администратор получают тот же снимок (только `published`) | да; для `stream` совместимо |
| Т2 | У `lesson`/`step` нет своих Policy; право — `ModulePolicy.rules.canSeeUnpublished` с `{ module }` | да |
| Т3 | Aggregate Def снимка — `ModuleArDef` (переезд файлов в `module/uc/`); ошибка остаётся `CourseErrors.MODULE_NOT_FOUND` до Ф3 | да; единую `MODULE_NOT_FOUND` вводит Ф3 вместе с правкой `stream` |
| Т4 | Висячий `lessonId` в проекте и отсутствующий шаг в `stepIds` пропускаются молча (DOM-13) | сохранить поведение, записать в `debt.md` (данные чистые: 0 висячих — проверит `dmg-data-keeper`) |
| Т5 | `getStepsByLessons`: модуль шага не найден (legacy — шаг молча пропускается) и видимость урока не проверяется | модуль не найден — оставить пропуск шага (поведение v0.2.6; не объявлять `ModuleErrors.NOT_FOUND` в `errors`); видимость урока не проверять; оба пункта — в `debt.md` |
| Т6 | Нужен ли `ModuleRepo.findByIds` для `getStepsByLessons` | нет, достаточно `findById` по различным `moduleId` (в данных 4 модуля) |
| Т7 | Кеширование чтения `steps.json` (1,8 МБ) | не вводить; сравнить время вызова с legacy при необходимости (`dmg-data-keeper`) |
| Т8 | Вход `getLesson` `{ lessonId }`, `getStep` `{ stepId }` вместо `uuid` | да; legacy-имена живут до Ф4 |
| Т9 | Выход `LessonView`/`StepView`: даты числами, `version`; `mentorStepIds`, `estimatedMinutes` без изменений | да |
| Т10 | `FileVo` в домене вместо `FileMetadataSchema` из `core` (DEBT-1); `kind: file` в данных нет | да |
| Т11 | `CourseDs`, `content-snapshot.ts`, `getModuleSnapshot` фасада остаются до Ф5 | да |

## Правила (ID rules.md)

`node_modules/dmg-core/docs/reference/rules.md`: ARC-02, ARC-04, ARC-06, DOM-01, DOM-02, DOM-03 (`restore`, DQS не создаёт Ar), DOM-04, DOM-05, DOM-07 (DQS только читает), DOM-11, DOM-12, DOM-13, DOM-14, DOM-15, DOM-17, MAN-01, MAN-02, MAN-03 (JSON Schema `variant`/`record`), MAN-07, MAN-10, MAN-11, MAN-13 (один UoW — один модуль; `aggregate` — свой), ERR-01, ERR-02, ERR-03 (`ModuleErrors.NOT_FOUND` по ссылке), ERR-04, API-01, API-03, API-05, CODE-01, CODE-02, CODE-04, TST-02, TST-03, TST-04, TST-05, TST-06, TST-07.
Проект (`conductor/architecture/rules.md`): ARC-02, ARC-04, ARC-06, ARC-07, TST-06.

## Документы

- `dmg-core` не правится: документы пакета — «не затронуто».
- Проект (orchestrator): `debt.md` — TR на Т1–Т11; DEBT-44 «Место»: убрать `get-module-snapshot.uc.ts`; новые записи долга по Т4/Т5 (маскирование рассогласования данных в снимке и `getStepsByLessons`); наблюдение С1 (32 черновых шага). `modules/course/about.md` — Ф5/Ф6. `migration.md` §6 — Ф6.

## Критерии приёмки

1. `bun run check` зелёный; `bun run arch:check` синхронен; `CI=true bun test` ≥ базовой линии (≥ 4216 pass плюс тесты Ф1), `bun run test:bot` ≥ 1107.
2. Новые файлы среза (`NEW_D`: `domain/src/course/{lesson/lesson.*.ts,lesson/uc,step/step.*.ts,step/uc,module/uc,module-snapshot.dqs.ts}`; `NEW_A`: `modules/course/src/{lesson,step,module/uc}`, `modules/course/src/infra/{lesson,step}.json-repo.ts`; без `*.test.ts`):
   - `grep -rnE "\bthrow\b|new [A-Za-z]*Ar\(|^\s*(static\s+)?(async\s+)?(get\s+)?#\w+|this\.#" $NEW_D $NEW_A` — пусто;
   - `grep -rnE "@u7-scl/(core|app-legacy)|isoDateTime|isoNow|Date\.now|new Date|biome-ignore" $NEW_D $NEW_A` — пусто;
   - `grep -rnE "\.snapshot\(" $NEW_D $NEW_A | grep -v json-repo` — пусто;
   - `grep -rnE "@u7-scl/domain/(user|stream|wish|questionnaire|peer-review)'" $NEW_D $NEW_A` — пусто;
   - `grep -rnE "(lesson|step)\.state'" modules/course/src --include=*.ts | grep -v "/infra/"` — пусто (DOM-01).
3. `grep -rn "legacy\." modules/course/src/module modules/course/src/lesson modules/course/src/step` — пусто; `ls modules/course/src/course/uc/get-module-snapshot*` — нет файла; `grep -rn "getModuleSnapshot" modules/course/src/course.module.ts` — запись карты указывает на `./module/uc/get-module-snapshot.uc`.
4. `grep -rnE "\b(LessonAr|LessonPolicy|LessonRepo|LessonJsonRepo|StepAr|StepPolicy|StepRepo|StepJsonRepo)\b" domain modules/course platform scripts --include=*.ts` — только новые файлы Ф2, `index.ts`, `course.module.ts`, `u7-app.ts` и их тесты; в legacy — только `Legacy*`.
5. `getLesson`, `getStep`, `getStepsByLessons`, `getModuleSnapshot` — `UseCaseFromDef`; `grep -rn "CourseUseCase\|getOutLesson\|getOutStep\|CourseDs" modules/course/src/lesson modules/course/src/step modules/course/src/module` — пусто.
6. Сценарии таблицы «Legacy-тесты и их судьба» перенесены (список сверяет reviewer); `git diff --numstat` — старые тесты не потеряны, кроме перечисленных «не переносятся» и переехавших; тест снимка проверяет: гость + опубликованный модуль, гость + черновой модуль (`ACCESS_DENIED`), черновой урок пропущен, пустой модуль, не найден.
7. `CourseModuleDef`: `external: true`, 4 агрегата, 12 UC; `ArchChecker.defsOf([CourseModuleDef]).report()` пуст; `stream` `createStream` продолжает проходить свои тесты без правок.
8. `git status --short data/` пуст; `sha256sum data/courses/{lessons,steps,modules}.json` до и после одинаков; в `platform/app/tests/u7-app.test.ts` создание потока читает снимок через настоящий UC.
