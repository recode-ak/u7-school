# Бриф среза: `course` / `course` — программа, этапы, клиент `stream`, данные (Ф3)

Черновик — `dmg-tech-lead`, Ф3; проверка — orchestrator. Читать вместе с брифами `module.md` и `lesson-step.md` (решения Р*/Т* приняты), `../spec.md`, `../plan.md` (Ф3), D-64, D-65, TR-52, TR-53, TR-54, TR-55, эталоном `wish`, ближайшим `stream` (`domain/src/stream`, `modules/stream/src`).

Код `course` в `v0.2.6` (worktree `../u7-school-v0.2.6`) с HEAD отличается импортами и `biome-ignore`; характеризация строится на текущих тестах legacy-кода как ожиданиях нового кода и на прогоне по копии данных.

## Расхождения spec/plan с кодом

1. **Инварианты этапов «в схеме state» не помещаются в `CourseArDef.state`.** `AggregateDef.normalize()` вызывает `toJsonSchema(this.state)` с `errorMode: 'throw'` (`node_modules/dmg-core/src/domain/aggregate/aggregate-def.ts:70`, `kernel/schema/json-schema.ts:13`); `v.check` и `v.rawCheck` в схеме бросают «action cannot be converted to JSON Schema» (проверено запуском). `state` с проверкой роняет `ArchChecker` и манифест. Рабочий путь — прецедент `ReviewCampaignAr`: схема инварианта отдельно от `state` (`AddressingInvariant`), разбор `v.parse` в конструкторе Ar (`domain/src/peer-review/review-campaign/review-campaign.ar.ts:78-103`). Строгое чтение сохраняется (битая запись — исключение, файл не меняется), `state` остаётся переводимым в JSON Schema. Правка `dmg-core` (`ignoreActions`) — вариант Т3-в, не рекомендуется.
2. **План: «DQS этапы, место модуля, предыдущий модуль» — это вопросы одного агрегата.** По `repo.md` §5 и DOM-04 одно-Ar вопросы — методы `CourseAr` (`stages()`, `placeOf(moduleId)`). DQS нужны для вопросов над несколькими Ar: «курс модуля среди курсов» и вердикт пререквизита (`CourseAr` + `ModuleAr` предыдущего). Решение — Т2.
3. **Меняется не только `stream`.** (а) TR-53 (Т3 `module`) и TR-53 (Т3 `lesson-step`) отложили единую ошибку «модуль не найден» на Ф3: `CourseErrors.MODULE_NOT_FOUND` (`COURSE_MODULE_NOT_FOUND`) → `ModuleErrors.NOT_FOUND`; это контракт `createStream` (`domain/src/stream/stream/uc/create-stream.uc.ts:44`) и пины в пяти тестах (раздел «Сохраняемое поведение»). В плане Ф3 этого шага нет — Т8. (б) `getModulePrerequisite` — единственный внешний UC, чей контракт меняется (вход `passedModuleIds`, выход `admitted` вместо `gate`, `domain/src/course/course/uc/get-module-prerequisite.uc.ts:30-52`); остальные пять не меняются.
4. **В плане нет шага переименования legacy (S0).** Имена `CourseAr` (`domain/src/course/course/a-root.ts`, экспорт `index.ts`), `CoursePolicy` (`course/policy.ts`), `CourseRepo` (`course/repo.ts`), `CourseJsonRepo` (`modules/course/src/infra/db/course-json-repo.ts`, экспорт `infra/index.ts`) занимает новый код (`modules/course/src/index.ts` делает `export *`). Нужен S0 → `Legacy*` (образец Ф1/Ф2; 19 файлов, счёт по `grep` ниже). Новая `ModulePlace` (Def) конфликтует с `ModulePlace` из legacy `facade.ts`, которую `contract.ts:38` реэкспортирует вместе с `CourseFacade` и `CourseProgram`: реэкспорт из контракта снимается (потребителей через `contract` нет, бот берёт тип из `@u7-scl/course/domain`).
5. **«Адаптеры сняты, `legacy.` в `modules/course/src/course` пуст» требует больше, чем замены шести классов.** Уходят `CourseLegacy` и `legacy` из `CourseModuleDeps` (`modules/course/src/course.module.ts:25-34,42-47`), `U7LegacyFacades.course` (`platform/app/src/u7-app.types.ts:2,35`), локальный `courseFacade` и `legacy: legacy.course` в `platform/app/src/u7-app.ts:149,164,278`; тесты `createCourseModule({ legacy })` (`modules/course/src/course.module.test.ts`, `course/uc/get-module-prerequisite.uc.test.ts:68`). В плане Ф5 тип `CourseLegacy` числится за сборкой — по факту он умирает в Ф3 (иначе `noUnusedVariables`/ARC-проверки). В Ф5 остаются `courseModule`, `CourseApiModule`, `CourseInProcFacade`.
6. **Красная зона уже плана.** Legacy-код курса в Ф3 не меняется (только S0), его юнит-тесты на фейках остаются зелёными. Роняют только тесты, читающие `courses.json` мира/фикстуры через legacy-репозиторий, и тесты, которые строят курс legacy-командами, а читают DMG-UC (раздел «Красная зона»). Stories бота с моками `appApi` в Ф3 зелёные, красными станут при переводе в Ф4, если их не перевести. Список — по прогону (шаг 5), не по плану.
7. **Legacy-чтение нового формата не падает, а теряет записи.** `JsonFileRepo.readAll` пропускает невалидную запись и создаёт `<каталог файла>/backups/courses.invalid.<время>.json` (`platform/core/src/infra/json-file-repo.ts:100-165`). После коммита переведённого `data/courses/courses.json` любой запуск legacy `CourseApiModule` на боевых данных (бот, `scripts/*` с курсами) создаст `data/courses/backups/` и вернёт пустой список курсов. До Ф4 бот на этих данных не запускать; проверка `git status --short data/` в критериях.
8. **`resolve-content-path` и `get-course-program` ломаются иначе, чем в плане.** `get-course-program` читает `course.phases[].moduleIds` (`modules/course/src/api/course/get-course-program-uc.ts:49-60`); `content-path.integration.test.ts` и `course-program.integration.test.ts` строят курс legacy-командами. Удаление всех трёх (с `which-courses-include-module`, о котором spec молчит: его заменяет `getCoursesIncludingModule`) — Ф5; в Ф3 они живут.
9. **`getCoursesStartingWithModule` в legacy зависит от одного курса, а не от кандидатов.** Адаптер берёт `getModulePlace` (первый **опубликованный** курс файла с модулем), требует `isFirst` и лишь затем фильтрует кандидатов `whichCoursesIncludeModule` (`modules/course/src/course/uc/get-courses-starting-with-module.uc.ts:26-35`). В фикстурах модуль `a1a1…` второй в `fafa…` и первый в `cccc…`: legacy вернёт `[]` даже если кандидат — `cccc…`. В боевых данных курс один. Вопрос С2.
10. **Три разных правила выбора «курса модуля».** `getCourseByModule` — первый в файле, любой статус (`course-in-proc-facade`/`get-course-by-module-uc.ts:34-35`); `getModulePlace`/`getModuleEnrollment` — первый опубликованный; `getModulePrerequisite` — первый в файле, любой статус (через `getCourseByModuleId`). Порядок файла — часть поведения (тест `view-stream.integration.test.ts:345-377` опирается на то, что `fafa…` стоит перед `cccc…`). Единое правило — С2.
11. **`gate: 'closed'` в legacy недостижим.** `getPrevModuleId` даёт `null`, только если модуля нет в порядке курса (`domain/src/course/course/a-root.ts:86-93`), а курс выбран по `includesModule` (`course-ds.ts:20-22`). Название предыдущего модуля при отсутствии записи в `modules.json` подменяется его id (адаптер `get-module-prerequisite.uc.ts:41-53`). В новом контракте `closed` обязан быть достижимым — Т6.
12. **Вне плана, но остаётся от Ф1:** `ModuleView.version` необязателен, в `LessonView`/`StepView` — обязателен (TR-55, «Ф3»). Выровнять в этом срезе.

## Границы

**Домен `domain/src/course`:**
- Новое: `course/course.state.ts` (`PhaseVo`, `CourseState`, схема инварианта), `course/course.errors.ts` (+ `NOT_FOUND`), `course/course.ar.ts` (класс `CourseAr`, `CourseView`, `CourseStage`, `ModulePlaceInCourse`; `CourseArDef` наполняется), `course/course.fixture.ts`, `course/uc/{get-course,list-courses,get-course-by-module,get-module-place}.uc.ts`, `module-courses.dqs.ts`, `module-prerequisite.dqs.ts`, тесты рядом.
- Изменяется: `course/uc/get-module-prerequisite.uc.ts` (контракт), `course/uc/get-module-place.uc.ts` (тип `ModulePlace` — здесь), `course.module.ts` (+ 4 UC, 16 UC), `contract.ts`, `index.ts`, `module/uc/get-module-snapshot.uc.ts` (`ModuleErrors.NOT_FOUND`, Т8), `module/module.ar.ts` (`ModuleView.version`), `course.module.test.ts`, `course/uc/*.uc.test.ts` (только prerequisite), тест Def снимка.
- S0 (переименование legacy): `course/{a-root,policy,repo}.ts` и их тесты → `LegacyCourseAr`, `LegacyCoursePolicy`, `LegacyCourseRepo`; ссылки `index.ts`, `module.ts` (`CourseApiModuleResolver`), `contract.ts:38`.

**Прикладной слой `modules/course/src`:**
- Новое: `course/{course.repo,course.repo.fake}.ts`, `course/uc/{get-course,list-courses,get-course-by-module,get-module-place}.uc.ts` + тесты, `infra/course.json-repo.ts` + тест, стенд `course/uc/course-uc.fixture.ts` (по `content-uc.fixture.ts`, `module-uc.fixture.ts`).
- Заменяются настоящими UC (тот же путь): `course/uc/{get-course-enrollment,get-module-enrollment,get-courses-including-module,get-courses-starting-with-module,get-same-modules,get-module-prerequisite}.uc.ts` и тест prerequisite; тесты шести UC — из `course.module.test.ts:280-460` в файлы рядом.
- Изменяется: `course.module.ts` (карта 16 UC; `CourseModuleDeps` без `legacy`, + `courses: CourseRepo`; тип `CourseLegacy` удалён), `infra/index.ts`, `course.module.test.ts`, `module/uc/get-module-snapshot.uc.ts` (ошибка, Т8).
- S0: `infra/db/course-json-repo.ts` (+ тест) → `LegacyCourseJsonRepo`; ссылки `infra/index.ts`, `api/course/*` (`create-course-uc.ts`, `add-*`, их тесты), `course-in-proc-facade.ts`.

**Клиент `stream`:** `domain/src/stream/stream/stream.ar.ts` (удалить `teachesModule`, `:152-155`) и `stream.ar.student.test.ts:67-72`; `student/student.rules.ts`, `student.rules.test.ts`; новый `domain/src/stream/passed-modules.dqs.ts` + тест; `student/uc/enroll-student.uc.ts` (описание), `stream/uc/create-stream.uc.ts` (Т8) и их тесты `stream.uc-defs.test.ts:42`, `student.uc-defs.test.ts`; `modules/stream/src/student/uc/{enroll-student.uc.ts,enroll-student.uc.test.ts,student-uc.fixture.ts}`, `modules/stream/src/stream/uc/create-stream.uc.test.ts:137-156`.

**Вне пакетов:** `platform/app/src/u7-app.ts` (+ `U7LegacyFacades`, `u7-app.types.ts`), `scripts/_app-factory.ts:43,108` (переименование), `runners/u7-bot/tests/worlds/{types,builder,core-education,invariants}.ts` и их тесты, `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:723` (Т8), `data/courses/courses.json` (перевод, шаг 6).

**Не трогать:** `dmg-core`; `lesson/**`, `step/**` (кроме `ModuleView`); `content-snapshot.ts`; `content-path/**`, `course-ds.ts`, `facade.ts`, `api/**`, `commands/**`, `CourseInProcFacade` (живут до Ф5); контракты `wish`, `user`; stories бота и их тесты; `biome.json`; `data/` кроме `courses.json` в шаге 6.

## Решения брифа

**Р1. Состояние (`course.state.ts`).**
- `PhaseVo = v.object({ title, track?, fromModuleId })`: `title` — `trimmed` + `nonEmpty` (как в Ф1), `track` — `v.pipe(v.optional(v.string()), v.description(...))`, `fromModuleId: F.uuid('модуля, с которого начинается этап')`. Идентичности и дат нет (DOM-13); этап идентифицируется заголовком, уникальным в курсе (прежний инвариант, `a-root.ts:21-30`).
- `CourseState = v.object({ ...BaseEntityFields, title, description, authorId: F.uuid('автора'), moduleIds: v.array(F.uuid('модуля')) + v.description, phases: v.array(PhaseVo) + v.description, status: F.picklist(['draft','published','archived'], …) })`. Даты — `F.timestamp` из `BaseEntityFields`: читает `"2026-07-08T18:35"` и `"2026-10-16T17:00"` (боевой курс), `updatedAt` нет → `createdAt`, `version` нет → 0.
- Репозиторий разбирает `CourseArDef.state`, не `CourseState` (фолбэк `updatedAt`).

**Р2. Инварианты программы и меток** — схема `CourseProgramInvariant = v.pipe(v.object({ moduleIds, phases }), v.check(...))` в `course.state.ts` отдельно от `state`; `CourseAr` разбирает её через `v.parse` в `private constructor` (прецедент — расхождение 1). Правила (Т3):
- каждый `fromModuleId` есть в `moduleIds`;
- метки идут в порядке программы (индексы строго возрастают — отсюда нет двух этапов на одном модуле);
- первая метка (если есть) — `moduleIds[0]`;
- заголовки этапов уникальны (прежний инвариант);
- `moduleIds` без повторов (новое: иначе «место» и метка неоднозначны; в данных повторов нет).
Пустые `phases` — валидный курс без этапов; пустая программа без этапов валидна (черновик), с этапами — нет (метке не на что указать). Висячие `moduleIds` (модуля нет в `modules.json`) схема не проверяет — это межагрегатная связь (DOM-13); в данных висячих нет (4 из 4 найдены).

**Р3. `CourseArDef`** (`name: 'course'`, наполняется): `state: CourseState`, `statuses` draft/published/archived с метками, `transitions: {}`, `events: {}`, `errors: CourseErrors` (Т8: `NOT_FOUND` + прежний `MODULE_NOT_FOUND` до унификации; после Т8 — только `NOT_FOUND`). Мутаций нет — authoring удалён (spec, TR-52 (3)); `static create` нет.
- `CourseAr extends Aggregate<typeof CourseArDef, CourseView>`: `private constructor`, `static restore(state)`, `view()` переопределён (state-форма + `stages`, без меток).
- Методы-вопросы (DOM-04, без `Result`, без `#`): `isPublished()`, `includesModule(moduleId)`, `startModuleId(): string | undefined`, `stages(): CourseStage[]` (`{ title, track?, moduleIds }` — срез программы от метки до следующей; без меток `[]`), `placeOf(moduleId): ModulePlaceInCourse | undefined` (`{ isFirst, isLast, prevModuleId?, nextModuleId?, stage?: { index, title, track? } }`; `stage` отсутствует у курса без этапов).
- `CourseView` = `v.object({ uuid, title, description, authorId, status, moduleIds, stages, createdAt, updatedAt, version })`. Метки `phases` наружу не выходят (D-64: «клиенты метки не разбирают»). `stages` — единственная форма этапов.

**Р4. Ошибки** (`course.errors.ts`): `CourseErrors = ErrorDef.define('COURSE', { NOT_FOUND })`; прежний `MODULE_NOT_FOUND` удаляется по Т8 (до этого — рядом). `NOT_FOUND`: `kind: 'not_found'`, `label` «Курс не найден», payload `{ courseId: F.uuid('курса') }` (код `COURSE_NOT_FOUND` совпадает с legacy). Модуль не найден — `ModuleErrors.NOT_FOUND` по ссылке (ERR-03).

**Р5. UC** (`aggregate: CourseArDef`, все `type: 'query'`; Policy видимости — вариант А С1: курс виден всем любого статуса, как в v0.2.6, поэтому `policy: allowAll` и Policy-правил нет; вариант Б С1 — раздел «Открытые вопросы»):

| UC (файл) | Вход | Выход | `callers` | `errors` | Вызывающие сегодня |
|---|---|---|---|---|---|
| `getCourse` (`course/uc/get-course`) | `{ courseId }` (было `uuid`, Т5) | `CourseView` | `user`, `guest` | `CourseErrors.NOT_FOUND` | бот: `course-catalog.story.ts:682`, `wish-confirmed.story.ts:127`, `wish-invite.story.ts:179`; фасад `#getCourse` (уходит в Ф5); тесты |
| `listCourses` (`course/uc/list-courses`) | `status?`, `authorId?`, `title?`, `sort?`, `limit?` как `ListCoursesCmdSchema`, у каждого `v.description` | `v.array(CourseView)` (нужны `stages` — навигация строится по ним) | `user`, `guest` | `[]` | бот: `course-catalog.story.ts:678`; `status` по умолчанию `published` (как `list-courses-uc.ts:34`) |
| `getCourseByModule` | `{ moduleId }` | `v.pipe(v.optional(CourseView), v.description(...))` — пусто, не ошибка (прецедент `find-stream-by-telegram-group.uc.ts:20`) | `user`, `guest` | `[]` | бот: `course-catalog.story.ts:258,328`, `wish-confirmed.story.ts:139`; фасад |
| `getModulePlace` | `{ moduleId }` | `v.optional(ModulePlace)`: `{ courseId, isFirst, isLast, prevModuleId?, nextModuleId?, stage? }` | `user`, `guest` | `[]` | бот: `learning/stories/hub.ts:67` (реакция на событие, без актора); фасад |
| `getCourseEnrollment` | без изменений | без изменений | `system` | `[]` | `wish`: `create-course-wish.uc.ts` (`calls`) |
| `getModuleEnrollment` | без изменений | без изменений | `system` | `[]` | `wish`: `create-module-wish.uc.ts` |
| `getCoursesIncludingModule` | без изменений | без изменений | `system` | `[]` | `wish`: `fulfill-wish.er.ts` |
| `getCoursesStartingWithModule` | без изменений | без изменений | `system` | `[]` | `wish`: `invite-wishers.er.ts` |
| `getSameModules` | без изменений | без изменений | `system` | `[]` | `wish`: ER `fulfill-wish`, `invite-wishers` |
| `getModulePrerequisite` | `{ moduleId, passedModuleIds: uuid[] }` | `admitted` — см. Р6 | `system` | `[]` | `stream`: `enroll-student.uc.ts` (`calls`) |

- Все `execute` — чтения через `CourseRepo`/`ModuleRepo`, `load` возвращает `ok(...)` данные. UC `course` не вызывают UC `module` (читают репозиторий), `callers` без `system` для четырёх query-UC.
- `getModulePlace`: курсы `findAll({ status: 'published' })`, первый (в порядке файла) с модулем, `placeOf` (прежнее поведение, расхождение 10). Для курса из одного этапа результат тот же, что в v0.2.6, плюс `stage`; для курса без этапов `stage` нет.
- `getCourseEnrollment`: курс найден, `published`, программа не пуста → `{ enrollable: true, startModuleId }` (= `startModuleId()`), иначе `{ enrollable: false }`.
- `getModuleEnrollment`: модуль есть в программе хотя бы одного опубликованного курса.
- `getCoursesIncludingModule`: порядок результата — порядок `courseIds`; курс в любом статусе; неизвестный курс пропускается; пустой вход → `[]` без чтения (`CourseRepo.findByIds`).
- `getSameModules`: `moduleIds.filter(id => id === moduleId)` с сохранением повторов (реализация — равенство id, D-65; история — `course-module-history.md`).
- `getCoursesStartingWithModule`: до решения С2 — поведение v0.2.6 (см. расхождение 9); в тесте закрепить оба случая (фикстурные курсы `fafa…`/`cccc…`).

**Р6. Вердикт пререквизита (D-65).**
- Выход: `v.variant('admitted', [ {admitted: literal true}, v.variant('reason', [ {admitted: false, reason: 'previous-not-passed', title}, {admitted: false, reason: 'closed'} ]) ])` с `v.description` у каждого свойства. Вложенный `v.variant` на одном дискриминаторе — проверить `toJsonSchema` red-тестом; запасной вариант — `v.union` (Т9).
- Алгоритм (`ModulePrerequisiteDqs` над `ReadonlyAr<CourseAr>`, `ReadonlyAr<ModuleAr>`, `passedModuleIds`): курс — первый в порядке файла из **всех** курсов, включающий модуль (поведение v0.2.6); курса нет → `admitted: true`; `placeOf(moduleId).prevModuleId` нет (входной модуль) → `admitted: true`; предыдущий ∈ `passedModuleIds` → `admitted: true`; иначе `previous-not-passed` с названием предыдущего модуля (из `ModuleAr`); записи предыдущего модуля нет в `modules.json` → `closed` (Т6).
- Принадлежность `prevModuleId ∈ passedModuleIds` решает `course` (за этим методом позже встанет история модулей); клиент ничего не сравнивает.

**Р7. DQS.**
- `ModuleCoursesDqs` (`module-courses.dqs.ts`): над `readonly ReadonlyAr<CourseAr>[]` — `firstIncluding(moduleId)` (любой статус), `firstPublishedIncluding(moduleId)`; единственное место правила «какой курс у модуля» (расхождение 10, С2) и точка расширения для истории.
- `ModulePrerequisiteDqs` (`module-prerequisite.dqs.ts`) — Р6.
- Вопросы одного `CourseAr` — методы Ar (расхождение 2, Т2). Вариант Т2-б: отдельный `CourseStagesDqs` по плану — не рекомендуется (один Ar, `repo.md` §5; отличие от Ф2: там DQS работал с несколькими Ar).

**Р8. Порт `CourseRepo`** (`course/course.repo.ts`): `Repository<CourseAr> & { findById(uuid); findByIds(uuids) (порядок — как в файле, дубликаты и неизвестные отбрасываются); findAll(filter?: CourseFilter) }`. `CourseFilter` — `status`, `authorId`, `title` (подстрока без регистра), `sort` (`createdAt|title:asc|desc`, направление не `asc` — по убыванию, как `course-json-repo.ts:48-62`), `limit` (после сортировки). Без `sort`/`limit` порядок — порядок файла (он важен, расхождение 10). Фейк — `MemoryRepo`.

**Р9. JSON-репозиторий** (`infra/course.json-repo.ts`) — по `module.json-repo.ts`: `VersionedRepository<CourseAr>`, `Rows = v.array(CourseArDef.state)`, строгий разбор (старый формат `phases[].moduleIds` — исключение, файл цел), нет файла — `[]`, `restore` разбирает инвариант (Р2). Конструктор — `filePath` обязателен. `save` ни один UC не вызывает (мутаций нет) — запрета записи, как Т11 для `modules.json`, для `courses.json` не нужно; опасность — только чтение legacy (расхождение 7).

**Р10. `CourseModuleDef`**: `aggregates` те же 4; `useCases` 16 (12 + `getCourse`, `listCourses`, `getCourseByModule`, `getModulePlace`); `external: true` до Ф5 (spec). `courseModuleMap` — 16 записей, `satisfies ModuleMap<typeof CourseModuleDef, CourseModuleDeps, CourseUser>`. `CourseModuleDeps = ModuleDeps & { modules, lessons, steps, courses }` (Т13).

**Р11. Клиент `stream`.**
- `student.rules.ts`: `EnrollStudentCtx` теряет `userStreams` (нужен только для сбора `passedModuleIds`, остаётся в `Loaded`); `prerequisitePassed.check`: `admitted` → `ok()`; `reason: 'closed'` → `PREREQUISITE_NOT_PASSED.err({ moduleTitle: 'предыдущий' })`; `previous-not-passed` → `err({ moduleTitle: title })`. Код ошибки и тексты не меняются.
- `PassedModulesDqs` (`domain/src/stream/passed-modules.dqs.ts`, над `ReadonlyAr<StudentAr>[]` и `ReadonlyAr<StreamAr>[]`): `moduleIds()` — уникальные `stream.moduleId()` потоков, к которым относятся записи с `isPassed()` (`advanced`; `not_advanced` не «прошёл», `student.ar.ts:216-219`). Условие «пройден» остаётся там, где оно было (запись + поток), сравнения с id курса нет.
- `EnrollStudentUc.fetch` собирает `passedModuleIds` из `Loaded` и зовёт `this.call(GetModulePrerequisiteUcDef, { moduleId, passedModuleIds }, …)`. Порядок отказов (ключ → живая запись → допуск → шаги) и место вызова (после Policy, D-58) не меняются.
- `StreamAr.teachesModule` и его тест удаляются; `StreamAr.moduleId()` (`stream.ar.ts:147-150`) остаётся.
- Стенд `student-uc.fixture.ts`: `Prerequisite` — вердикт `admitted`; заглушка `StubFacade.answer(GetModulePrerequisiteUcDef, input => …)` отвечает по входу (`passedModuleIds` содержит `PREV_MODULE` → `admitted`), а не по полю `env.prerequisite` — иначе сбор `passedModuleIds` не проверяется.

**Р12. Модуль курсов для `wish`.** Контракты `wish` не меняются (форма входов/выходов пяти UC та же); `wish` и его тесты не правятся, прогон — в гейте. `StubFacade(CourseModuleDef)` в тестах `wish` берёт Def из контракта — они остаются зелёными.

## Шаги (по ролям)

0. **migrator (flash), S0.** `CourseAr`/`CoursePolicy`/`CourseRepo`/`CourseJsonRepo` → `Legacy*` во всех местах «Границ»; из `contract.ts` убрать реэкспорт `CourseFacade, CourseProgram, ModulePlace` (`:38`). Гейт: `check` зелёный, число тестов то же, `git diff --numstat` — переименования и импорты.
1. **dmg-test-designer (Sonnet).** Характеризация на `../u7-school-v0.2.6` и red (план в «Сохраняемом поведении»). Новые файлы красные, старые (кроме перечисленных на правку) зелёные. Репозиторий — `mkdtemp`. Фикстуры: `course.fixture.ts`, стенд `course-uc.fixture.ts`; курсы с этапами строятся из переведённого формата.
2. **migrator (flash), домен `course`.** Файлы Р1–Р4, Р7, `contract.ts`, `index.ts`, `course.module.ts`, `ModuleView.version`, Т8 (`ModuleErrors.NOT_FOUND` в снимке и `createStream`). Генератор — `bun run gen aggregate course.course --adopt` при отсутствии коллизий, иначе вручную по `module`.
3. **migrator (flash), прикладной слой `course`.** Р5, Р8–Р10; шесть классов-адаптеров заменяются настоящими UC; `CourseLegacy`/`legacy` удалены; `u7-app.ts` (+ `repos.courses = new CourseJsonRepo(`${dbDir}/courses/courses.json`)`, `legacy.course` и локальный `courseFacade` убраны), `u7-app.types.ts`.
4. **migrator (flash), клиент `stream`.** Р11 и Т8 в `stream`; гейт — тесты `domain/src/stream`, `modules/stream`, `wish`.
5. **migrator (flash), тестовые миры.** `worlds/types.ts`: `CourseDef` — `moduleIds?` (программа явно; по умолчанию — модули `modules`) и `phases?: { title, track?, fromModuleId }[]`; без `phases` — один этап «Основная программа» с первым модулем (внешний вид курсов и тесты UI не меняются); `WorldState.courses` — тип `WorldCourse` (ввод state, даты ISO, образец `WorldCampaign`, `types.ts:11-23`) вместо legacy `Course`. `core-education.ts`: у `course-js-basics` — `moduleIds: [a0…, a1…]`, этапы «Синтаксис» (`a0…`) и «Алгоритмика» (`a1…`); у `course-test-escaping`, `course-test-wish`, `course-long-pagination` — программа явно (модули объявлены в других курсах, `modules` пуст). `builder.ts:108-206`; `invariants.ts` — разбор `CourseArDef.state` + инварианта (ошибка мира при нарушении). Перед запуском очистить `runners/u7-bot/.cache/worlds` (кеш по хешу определения мира, `materializer.ts:208-211`: без очистки останется старый формат, если определение не менялось, например `minimal`); `bun run seed:fixtures` пересобирает `data/fixtures` (не под git). Затем прогон `CI=true bun test` и `bun run test:bot` — сбор красного списка (раздел «Красная зона»).
6. **Гейт** (`bun run scripts/agent-gate.ts`), `git diff --numstat`, grep-критерии.
7. **dmg-data-keeper (flash).** См. «Данные». Перевод `data/courses/courses.json` — после гейта, только этот файл.
8. **orchestrator (Opus).** `backup:adhoc` до шага 7; отдельный коммит `courses.json`; запись красной зоны и TR в `debt.md`.
9. **dmg-reviewer (Opus).**

## Было → станет

### Домен

| Было | Станет |
|---|---|
| `course/entity.ts` `CourseSchema`, `PhaseSchema` (`phases[].moduleIds`, `isoDateTime`, DEBT-5) | остаются как legacy до Ф5; новое — `course/course.state.ts` (`CourseState`, `PhaseVo`, `CourseProgramInvariant`) |
| `course/a-root.ts` `CourseAr` (`create`, `addPhase`, `addModuleToPhase`, `publish`, `getPrevModuleId`, `#`/`throwBadRequest`) | `LegacyCourseAr`; новый `course/course.ar.ts` `CourseAr`: `restore`, `view`, `isPublished`, `includesModule`, `startModuleId`, `stages`, `placeOf` |
| `course/policy.ts` `CoursePolicy` (`canCreate`, `canRead`, `canEdit`, `canEnrollNextModule`…) | `LegacyCoursePolicy`; новой Policy нет (вариант А С1; вариант Б — `CoursePolicy.rules.canSeeUnpublished` по образцу `ModulePolicy`) |
| `course/repo.ts` `CourseRepo` (`save`, `getByUuid`, `getAll`) | `LegacyCourseRepo`; порт нового — в `modules/course/src/course/course.repo.ts` |
| `course/commands/*.ts` (9 метатипов) | остаются до Ф5; контракт — 4 новых Def UC; `CourseNotFoundUcError` и др. — legacy |
| `course/course.ar.ts` `CourseArDef` (пустой state, одна ошибка) | наполненный Def (Р3) |
| `course/course.errors.ts` `CourseErrors.MODULE_NOT_FOUND` | `CourseErrors.NOT_FOUND`; `MODULE_NOT_FOUND` убран по Т8 |
| `course/uc/get-module-prerequisite.uc.ts` (`gate: none|module|closed`) | `admitted` (Р6), вход `+ passedModuleIds` |
| `facade.ts` `CourseFacade`, `ModulePlace`, `course-ds.ts` `includesModule` | остаются для legacy; в `contract.ts` реэкспорта нет |
| `module.ts`, `contract.ts`, `index.ts` | + Def 4 UC, `CourseView`, `ModulePlace`, `CourseStage`, `CourseErrors.NOT_FOUND` |
| `stream/stream.ar.ts` `teachesModule` | удалён |
| `stream/student/student.rules.ts` (`gate`, сравнение через `teachesModule`) | вердикт `admitted`, без `userStreams` |

### Прикладной слой

| Было | Станет |
|---|---|
| 6 адаптеров `course/uc/*.uc.ts` над `legacy` | настоящие UC над `CourseRepo`/`ModuleRepo` (`getModulePrerequisite` — `ModulePrerequisiteDqs`) |
| `api/course/{get-course,list-courses,get-course-by-module,get-module-place}-uc.ts` (`CourseUseCase`) | остаются (legacy) до Ф5; новые `course/uc/*.uc.ts` на `UseCaseFromDef` |
| `api/course/{create-course,add-*}-uc.ts`, `get-course-program-uc.ts`, `which-courses-include-module-uc.ts`, `content-path/*` | остаются до Ф5 (удаление — Ф5) |
| `infra/db/course-json-repo.ts` `CourseJsonRepo` (`JsonFileRepo`, схема `CourseSchema`) | `LegacyCourseJsonRepo`; новый `infra/course.json-repo.ts` `CourseJsonRepo` |
| `CourseModuleDeps = ModuleDeps & { legacy, modules, lessons, steps }` | `ModuleDeps & { modules, lessons, steps, courses }` |
| `CourseLegacy` (`Pick<CourseFacade, …>`) | удалён |
| `enroll-student.uc.ts` `fetch` с `{ moduleId }` | `{ moduleId, passedModuleIds }` через `PassedModulesDqs` |

### Вне пакетов

| Что | Изменение |
|---|---|
| `platform/app/src/u7-app.ts:149,164,278`, `u7-app.types.ts:2,35` | нет `courseFacade`/`legacy.course`; в `repos` — `courses` |
| `u7-app.ts` (`CourseApiModule({ courseRepo })`) | `LegacyCourseJsonRepo` — тот же файл, старый формат (красная зона) |
| `scripts/_app-factory.ts:43,108` | `LegacyCourseJsonRepo` |
| `runners/u7-bot/tests/worlds/*` | Р-шаг 5 |
| `data/courses/courses.json` | новый формат (шаг 7) |

## Сохраняемое поведение (v0.2.6 = текущие тесты)

**Ветки и отказы:**
- `getCourse`: найден — любой статус и любому вызывающему (вариант А С1); не найден — `COURSE_NOT_FOUND` (kind `not_found`).
- `listCourses`: по умолчанию только `published`; `status`, `authorId`, `title` (подстрока без регистра), `sort`, `limit` — как `course-json-repo.ts:34-70`; пустой список — `[]`.
- `getCourseByModule`: курс в любом статусе (архивный находится); модуль вне курсов — пусто.
- `getModulePlace`: первый/средний/последний модуль, этапы в линейном порядке; только опубликованные курсы (архивный не участвует); модуль вне курсов — пусто.
- `getCourseEnrollment`: опубликован и есть модули → стартовый (`moduleIds[0]`); не найден, `draft`, `archived`, пустая программа — `enrollable: false` без причины.
- `getModuleEnrollment`: место в опубликованном курсе → `true`, иначе `false`.
- `getCoursesIncludingModule`: порядок — как `courseIds`; архивный курс учитывается; неизвестный пропускается; пустой вход — пустой выход.
- `getSameModules`: равенство id, повторы сохраняются; пустой список — пустой ответ.
- `getModulePrerequisite`: курса нет → `admitted`; первый модуль → `admitted`; предыдущий через границу этапов; предыдущий не пройден → `previous-not-passed` с названием; тексты отказа зачисления: «Сначала пройдите предыдущий модуль» (`label`), «предыдущий» при `closed`, название модуля иначе.
- Зачисление: `advanced` в потоке предыдущего модуля — допуск; `not_advanced` — нет; прошёл другой модуль — нет; записей нет — нет (сценарии `student.rules.test.ts:137-200` и `enroll-student.uc.test.ts:210-250` переезжают, Р11).
- Для курса из одного этапа: `getModulePlace` и `getCourse.stages` совпадают с прежним `phases` (тест); курс без этапов валиден и отдаёт `stages: []`.

**Тесты, закрепляющие состав модуля (grep по `*.test.ts`) — обновляются в Ф3:**
- `domain/src/course/course.module.test.ts:17-62` — 4 агрегата, список 12 UC → 16; `CourseArDef` («минимальный контракт», `errors: ['COURSE_MODULE_NOT_FOUND']`) → наполненный;
- `modules/course/src/course.module.test.ts` (15) — сборка без `legacy`, `facade.serves` для 16 UC; тесты шести адаптеров (`:280-460`) переезжают в файлы UC;
- `modules/course/src/course/uc/get-module-prerequisite.uc.test.ts` (7) — переписывается на вердикт;
- `domain/src/course/course/uc/get-module-prerequisite.uc.test.ts` (4: `:12-53`) — вход/выход; остальные пять `*.uc.test.ts` Def по 3 теста не меняются;
- `domain/src/course/module/uc/get-module-snapshot.uc.test.ts:13,38,43`, `modules/course/src/module/uc/get-module-snapshot.uc.test.ts:164,167,223` — `COURSE_MODULE_NOT_FOUND` → `MODULE_NOT_FOUND` (Т8);
- вне `course`, но в границах Ф3 (клиент `stream`, Т8): `domain/src/stream/stream/uc/stream.uc-defs.test.ts:42`, `modules/stream/src/stream/uc/create-stream.uc.test.ts:137-156`, `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:9,723`;
- `domain/src/stream/student/uc/student.uc-defs.test.ts` (правила и `calls` не меняются — проверить), `domain/src/stream/student/student.rules.test.ts`, `modules/stream/src/student/uc/enroll-student.uc.test.ts:73` (вход `getModulePrerequisite`), `student-uc.fixture.ts`;
- `platform/app/tests/u7-app.test.ts` — собирает `U7App`; правки не нужны, прогон в гейте;
- `domain/src/course/lesson/*.test.ts` — `ModuleView.version` (Т12): тесты `module.ar.test.ts` на `version`.

**Legacy-тесты `course` и их судьба** (legacy-код живёт до Ф5, зелёный после S0):

| Файл (тестов) | Что в Ф3 |
|---|---|
| `domain/src/course/course/a-root.test.ts` (14) | перенос: «конструктор: дубль названий фаз → ошибка» (2) → `course.state.test.ts`/`course.ar.test.ts` (инвариант заголовков); `create` (3), `addPhase` (4), `addModuleToPhase` (3), `publish` (2) — authoring, не переносятся |
| `course/entity.test.ts` (12) | → `course.state.test.ts`: 8 тестов `CourseSchema` с заменой; 4 `PhaseSchema` с `fromModuleId`; + legacy ISO без секунд, нет `updatedAt`/`version`, нарушения инвариантов Р2 |
| `course/policy.test.ts` (14) | `canEnrollNextModule` (6): четыре (входной; предыдущий пройден; не пройден; пройден другой) → `module-prerequisite.dqs.test.ts`; «модуль не найден в курсе» и «пустой курс» недостижимы через UC (нет курса → `admitted`) — не переносятся; `canCreate`/`canRead`/`canEdit` (8) — authoring, не переносятся |
| `api/course/get-course-uc.test.ts` (3), `get-course-by-module-uc.test.ts` (3), `get-module-place-uc.test.ts` (7), `list-courses-uc.test.ts` (3), `which-courses-include-module-uc.test.ts` (5) | переносятся все → тесты новых UC |
| `api/course/get-course-program-uc.test.ts` (2) | не переносится: программа курса с этапами покрыта тестами `getCourse` (`stages`); удаляется в Ф5 с UC |
| `api/course/{create-course,add-phase-to-course,add-module-to-course}-uc.test.ts` (6+4+4), `api/content-path/*` (18), `content-path.test.ts` (31) | authoring/`content-path`, не переносятся; удаление — Ф5 (в Ф3 живут вместе с кодом) |
| `api/module.test.ts` (9) | `get-module-place` (`:258`) → новый UC-тест; остаются до Ф5 |
| `infra/db/course-json-repo.test.ts` (12) | → `course.json-repo.test.ts`: save/findById, не найден, перезапись, findAll, фильтры status/authorId/title/combined, sort title asc, createdAt desc, limit, нет файла; + legacy ISO, старый формат — ошибка, инвариант нарушен — ошибка, битая запись (файл цел), `VERSION_CONFLICT` |
| `infra/course-in-proc-facade.test.ts` (17) | остаётся: фасад живёт до Ф5 |
| `modules/course/src/course.module.test.ts`, `course/uc/get-module-prerequisite.uc.test.ts` | см. выше |
| `domain/src/stream/stream/stream.ar.student.test.ts:67-72` (`teachesModule`, 1) | удаляется: правило уехало в `PassedModulesDqs` (TST-08) |
| `domain/src/stream/student/student.rules.test.ts:137-200` (6 тестов `prerequisitePassed`) | три сценария про `advanced`/`not_advanced`/«другой модуль» → `passed-modules.dqs.test.ts`; в правиле остаются три ветки вердикта |
| `enroll-student.uc.test.ts:210-250` | сценарии с посевом потоков → «`passedModuleIds` в вызове курса» (потоки пройденных записей; `not_advanced` и чужие — нет) |

**Новое red (TST-02/03):** инварианты Р2 — по тесту на каждое нарушение и на пустой курс; `CourseView` — `stages` для курса без этапов / с одним / с несколькими (программа из четырёх модулей с метками в 1-м и 3-м модулях); `placeOf` по этапам; каждая ошибка UC по `code`/`kind`; `callers` (`system` → `UNAUTHORIZED` у четырёх query-UC; `user` → `UNAUTHORIZED` у шести внешних); `INPUT_VALIDATION`; вердикт — все три исхода + `closed` при отсутствующей записи модуля; `PassedModulesDqs` — дубли, не `advanced`; `getModulePrerequisite` Def — JSON Schema вложенного `variant` (Т9); репозиторий — `VERSION_CONFLICT`.

## Внешние зависимости

- `@u7-scl/domain/user/contract`: `Role`, `User` (TR-40) — нужны только при варианте Б С1 (Policy). `UserModuleDef` в `dependsOn` `CourseModuleDef` уже есть; новых связей нет (DAG: `stream` → `course` → `user`, `wish` → `course`).
- Клиенты `course`: `stream` (`getModulePrerequisite`, `getModuleSnapshot`) — правится; `wish` (пять внешних UC) — не правится, форма не меняется; бот (`get-course`, `list-courses`, `get-course-by-module`, `get-module-place` через legacy `appApi.execute`) — Ф4, в Ф3 не трогается.
- Вызовов UC других модулей `course` не делает; `stream` вызывает `getModulePrerequisite` через `this.call` (фасад `course`, D-43) — как сейчас; побочных эффектов в чужих модулях нет.
- Входящих событий и ER нет. Для Ф4: DMG-вызовы `getCourse`/`getModulePlace` пишут в `data/oplog` (~9–18 КБ на вызов, TR-55) — при вызове на каждый рендер навигации учесть.

## Данные

Данные только читать до шага 7 (`AGENTS.md`, «Сервер и данные пользователей»).
- `data/courses/courses.json` (git): один курс «Fullstack JS» (`29adc3be-873e-47ec-aa30-61f5e6e25d4e`, `published`), один этап «Основы JS» (`track: "tech"`) с четырьмя модулями: `e4dea4fc…` (Синтаксис), `16b9026b…` (Алгоритмика: ядро), `fe37c988…` (Алгоритмика: прикладное), `1ee17493…` (HTML & CSS); все четыре есть в `modules.json`. Даты `"2026-07-08T18:35"`, `"2026-10-16T17:00"` (без секунд).
- `data/fixtures/courses/courses.json` (не под git): 6 курсов, у `fafa…` два этапа по одному модулю, у остальных по одному; `updatedAt` нет; модуль `a1a1…` входит в `fafa…` (вторым) и `cccc…` (первым). Порядок курсов в файле = поведение (расхождение 10).
- **Перевод** (в рамках плана, `dmg-data-keeper`, flash): `moduleIds` = конкатенация `phases[].moduleIds`; `phases[i] = { title, track?, fromModuleId: moduleIds первой записи этапа }`; поля `uuid`, `title`, `description`, `authorId`, `status`, `createdAt`, `updatedAt` без изменений (даты остаются строками ISO: `F.timestamp` читает их, запись числом — ленивая миграция трека 7); этап без модулей не переводится (стоп, сообщить); форматирование — как в файле (2 пробела), diff — только `phases`/`moduleIds`. Одноразовый скрипт перевода — во временном каталоге, в репозиторий не коммитится (Т15).
- Порядок: (1) `bun run backup:adhoc course-dmg-phases --courses` (orchestrator, Opus); (2) `dmg-data-keeper` на **копии** и на `data/fixtures`: перевод, чтение новым `CourseJsonRepo` 1/1 и 6/6, `stages` = прежним `phases` (по заголовкам, `track`, составу), `getModulePlace`/`getCourseEnrollment`/`getModulePrerequisite` совпадают с эталоном legacy (на копии до перевода), дата без секунд читается, старый формат — исключение, откат из бэкапа; (3) перевод `data/courses/courses.json` и `sha256` до/после; (4) отдельный коммит файла (orchestrator).
- Запрет `save` новым `CourseJsonRepo` над `data/` отдельно не вводится (нет мутирующего UC); legacy-чтение переведённого файла — запрещено (расхождение 7).
- Живые данные (`data/users`, `data/streams`, `data/wish` и др.) не читаются и не пишутся; ссылки на `courseId` в `wish`/`stream` не меняются (uuid курса прежний).

## Красная зона (для `debt.md`, критерий снятия — конец Ф4)

Причина: с коммита переведённого `courses.json` и миров нового формата legacy `LegacyCourseJsonRepo` (`CourseSchema` с `phases[].moduleIds`) не читает записи (`JsonFileRepo.readAll` пропускает и пишет `backups/`), а DMG-UC читают строго только новый формат. Список уточняется прогоном `CI=true bun test` и `bun run test:bot` после шага 5; ниже — вычислено по механизму.

**Красные (читают курс мира через legacy-UC или смешивают legacy-команды и DMG-чтение):**
- `runners/u7-bot/tests/courses/wish-flow.integration.test.ts` — строит курс `create-course`/`add-phase-to-course`/`add-module-to-course` (`:73-89`), затем `wish` читает его DMG-UC `getCourseEnrollment` по новому формату;
- `runners/u7-bot/tests/courses/course-catalog.integration.test.ts` (`:75-200`) — то же + каталог по legacy `list-courses`;
- кандидаты, читающие каталог мира через legacy `list-courses`/`get-course`/`get-course-by-module` или `get-module-place` из stories: `runners/u7-bot/tests/e2e/{curious-showcase,pagination,wish-questionnaire,main-menu}.e2e.test.ts`, `tests/learning/hub.integration.test.ts`, `tests/streams/{catalog,view-stream}.integration.test.ts` (допуск `view-stream.integration.test.ts:345-377` — через DMG-UC, в Ф3 должен остаться зелёным), `tests/mentor/mentor.integration.test.ts`, `tests/courses/wish-legacy-records.integration.test.ts`;
- `runners/u7-bot/tests/courses/{content-path,course-program,course-access}.integration.test.ts` строят курсы legacy-командами и читают legacy-UC — самосогласованы (legacy переписывает файл целиком) и, вероятно, зелёные; фиксировать по факту.

**Не красные в Ф3 (подтвердить прогоном):** юнит-тесты `modules/course/src/api/**` (фейки), `course-json-repo.test.ts` (legacy-формат во временном каталоге), `course-in-proc-facade.test.ts`, stories бота с моками `appApi` (`course-catalog.story.test.ts`, `hub*.test.ts`, `wish-*.story.test.ts`, `course-nav-resolver.test.ts`, `controller.test.ts`) — красными станут только при переводе на Def (Ф4).

**Тесты состава модуля** обновляются в Ф3 и красной зоной не являются (список выше).

**Что вносится в `debt.md`:** красные файлы поимённо (по прогону), мост чтения — не вводится (С3), запрет запуска legacy-приложения на боевых `courses.json` до Ф4, `LegacyCourseJsonRepo` и legacy-UC курса как временные до Ф5.

## Решения Нурболата и orchestrator (TR-56)

- **С1** — (А) в срезе: как v0.2.6, без Policy; (Б) — в разбор [course-module-history.md](../../../roadmap/course-module-history.md) §5.
- **С2** — в `debt.md`: в срезе — поведение v0.2.6 в одном `ModuleCoursesDqs`, тесты фикстурных случаев; `DEBT-<n>` с Местом этого DQS заводится вместе с кодом.
- **С3** — не делать.
- **Т1–Т18** — приняты по рекомендациям.

## Открытые вопросы

### Стратегические — Нурболату

**С1. Видимость курсов (Policy).** В v0.2.6 `get-course` и `get-course-by-module` отдают курс любого статуса любому вызывающему; `list-courses` по умолчанию `published`, но любой может запросить `status: draft` (`list-courses-uc.ts`, `course-access.integration.test.ts`). Authoring нет, черновых курсов в данных нет.
- (А) сохранить как есть (`allowAll`, без Policy) — wish-уведомления про архивные курсы продолжают показывать название;
- (Б) как у модуля/урока/шага: черновое и архивное видят администратор и автор курса (`CoursePolicy.rules.canSeeUnpublished`, `CourseAr.viewFor`), `getCourseByModule` ищет среди видимых; поведение для пользователя меняется только при появлении неопубликованных курсов; нужна правка `wish-confirmed`/`wish-invite` в Ф4 (вызов от имени гостя не увидит архивный курс).
- Сейчас в срезе / в `debt.md`. Рекомендация: **А в срезе, Б — в `debt.md`** (решается вместе с архивацией в `course-module-history.md`).

**С2. Единое правило «курс модуля».** Три разных правила (расхождение 10) и привязка `getCoursesStartingWithModule` к одному курсу (расхождение 9). Предложение: один метод `ModuleCoursesDqs` — «опубликованный курс модуля, иначе первый любой»; `getCoursesStartingWithModule` по кандидату (опубликован и `startModuleId() == moduleId`).
- Сейчас в срезе / в `debt.md`. Поведение меняется при двух и более курсах с одним модулем (фикстуры: `a1a1…`; боевые данные — курс один). 
- Рекомендация: **в `debt.md`**; в срезе сохранить v0.2.6 и закрепить тестами оба фикстурных случая, правило собрано в одном DQS (замена — правка одного места).

**С3. Мост чтения для снятия красной зоны.** `LegacyCourseJsonRepo` мог бы читать новый формат через маппер (метки → `phases[].moduleIds`, числа → ISO) и убрать красную зону целиком.
- Сейчас в срезе / в `debt.md` / не делать.
- Рекомендация: **не делать** — маппер повторяет в обратную сторону перевод данных и живёт до Ф5; красная зона узкая (5–10 интеграционных файлов) и снимается в Ф4 по плану.

### Тактические — orchestrator → TR (рекомендации tech-lead)

| № | Вопрос | Рекомендация |
|---|---|---|
| Т1 | Переименовать `CourseAr`/`CoursePolicy`/`CourseRepo`/`CourseJsonRepo` в `Legacy*` шагом S0; снять реэкспорт `CourseFacade, CourseProgram, ModulePlace` из `contract.ts` | да (расхождение 4) |
| Т2 | Вопросы одного `CourseAr` — методы Ar; DQS — только `ModuleCoursesDqs`, `ModulePrerequisiteDqs` | да; вариант — `CourseStagesDqs` по плану, не рекомендуется |
| Т3 | Инвариант программы и меток — схема вне `state` + `v.parse` в конструкторе (прецедент `ReviewCampaignAr`); добавить «заголовки этапов уникальны», «`moduleIds` без повторов»; вариант в — правка `dmg-core` (`ignoreActions` в `toJsonSchema`) | схема вне `state`; правку `dmg-core` не вносить |
| Т4 | `CourseView` без меток: `moduleIds` + `stages` | да (D-64) |
| Т5 | Входы `getCourse` — `{ courseId }` вместо `uuid` | да (`<a>Id`, как Т5 `module`); legacy-имя живёт до Ф4 |
| Т6 | `closed` — записи предыдущего модуля нет в `modules.json` (вместо подмены названия id) | да; ветка недостижима на данных (4 из 4), текст отказа общий |
| Т7 | `ModulePlace` получает необязательный `stage { index, title, track? }` | да (D-64 называет `getModulePlace`); у курса без этапов нет |
| Т8 | Единая ошибка: `getModuleSnapshot` и `createStream` → `ModuleErrors.NOT_FOUND`; `CourseErrors.MODULE_NOT_FOUND` удалить; обновить пины (список выше) | да (обещано в TR-53 Т3) |
| Т9 | Выход вердикта — вложенный `v.variant`; если `toJsonSchema` не примет — `v.union` с `v.literal` | red-тест решает |
| Т10 | `passedModuleIds` — `PassedModulesDqs` в `stream`, сбор в `fetch`; `EnrollStudentCtx` без `userStreams` | да |
| Т11 | `callers`: четыре query — `user`, `guest`; шесть внешних — `system`; Ф4 диспатчит `getModulePlace` из реакции на событие как гость | да |
| Т12 | `ModuleView.version` обязателен (TR-55) | да; `module.ar.test.ts` |
| Т13 | `CourseModuleDeps.courses` обязателен; `legacy` и `CourseLegacy` удалены; `U7LegacyFacades.course`, `courseFacade` убраны в Ф3, а не Ф5 | да (расхождение 5) |
| Т14 | Миры: `WorldCourse` (ISO, образец `WorldCampaign`), по умолчанию один этап «Основная программа»; инварианты мира — через `CourseArDef.state`; очистка `.cache/worlds` | да |
| Т15 | Перевод `courses.json` — одноразовый скрипт вне репозитория, даты не трогать | да (один файл; `scripts/` — для повторяемых операций) |
| Т16 | Authoring-UC, `get-course-program`, `resolve-content-path`, `which-courses-include-module` и их тесты в Ф3 не удалять (Ф5); из Ф3 удаляется только `StreamAr.teachesModule` с тестом. Вариант: удалить authoring в Ф3 и перевести `wish-flow`/`course-catalog` integration на миры — снимает два красных файла, но тащит из Ф4 переработку тестов | не удалять; красные файлы перевести в Ф4 |
| Т17 | `getCourseByModule`/`getModulePlace` — `v.optional` выход (пусто — не ошибка) | да (прецедент `findStreamByTelegramGroup`) |
| Т18 | Первый курс модуля для `getModulePrerequisite` — как v0.2.6 (любой статус, порядок файла) до решения С2 | да |

## Правила (ID rules.md)

`node_modules/dmg-core/docs/reference/rules.md`: ARC-02, ARC-04, ARC-06, DOM-01, DOM-02, DOM-03, DOM-04, DOM-05 (только вариант Б С1), DOM-07, DOM-11, DOM-12, DOM-13 (`PhaseVo` без дат и идентичности), DOM-14, DOM-15, DOM-16 (правило `prerequisitePassed` в `stream`), DOM-17 (копии массивов в `view()`/`stages()`), MAN-01, MAN-02, MAN-03 (`stages`, вложенный `variant`), MAN-07, MAN-10, MAN-11, MAN-13, ERR-01, ERR-02, ERR-03, ERR-04, API-01, API-03, API-05, CODE-01, CODE-02, CODE-04, TST-02, TST-03, TST-04, TST-05, TST-06, TST-07, TST-08 (тесты переезжают: `teachesModule`, `canEnrollNextModule`).
Проект (`conductor/architecture/rules.md`): ARC-02 (`@u7-scl/core` — только места DEBT-1), ARC-04 (пары legacy — DEBT-34), ARC-06, ARC-07, TST-06.

## Документы

- `dmg-core` не правится; документы пакета — «не затронуто».
- Проект (orchestrator, по итогам Ф3): `debt.md` — TR на Т1–Т18 и ответы на С1–С3; красная зона (раздел выше); `DEBT-44`/`TR-11` «Место»: убрать `modules/course/src/course/uc/*` (адаптеров нет); `DEBT-1/2/5` — новые файлы `course` в glob'ы не входят; `debt.md` — запрет запуска legacy на боевом `courses.json`. `decisions.md` — D-64/D-65 уже записаны; уточнение «инварианты вне `state`, `v.parse` в Ar» — в TR. `modules/course/about.md`, `content-management.md`, `course-module-history.md` §2 — Ф5/Ф6. `migration.md` §6 — Ф6. `modules/stream/src/analysis.md` — вердикт пререквизита не упоминает, не затронуто.

## Критерии приёмки

Команды из корня `u7-school`.

1. `bun run check` зелёный, кроме поимённой красной зоны в `debt.md`; `bun run arch:check` синхронен; `CI=true bun test` не ниже базовой линии конца Ф2 (`summary.md`), `bun run test:bot` ≥ 1107 pass кроме красной зоны.
2. Новые файлы `course` (`NEW_D`: `domain/src/course/course/course.*.ts`, `course/uc/{get-course,list-courses,get-course-by-module,get-module-place,get-module-prerequisite}*.ts`, `module-courses.dqs.ts`, `module-prerequisite.dqs.ts`, шесть `uc/get-*.uc.ts`; `NEW_A`: `modules/course/src/course`, `infra/course.json-repo.ts`; без `*.test.ts`, `*.fixture.ts`, `*.repo.fake.ts`):
   - `grep -rnE "\bthrow\b|^\s*(static\s+)?(async\s+)?(get\s+)?#\w+|this\.#" $NEW_D $NEW_A` — пусто; `new [A-Za-z]*Ar\(` — только `restore` в `course.ar.ts`;
   - `grep -rnE "@u7-scl/(core|app-legacy)|isoDateTime|isoNow|Date\.now|new Date|biome-ignore" $NEW_D $NEW_A` — пусто;
   - `grep -rnE "\.snapshot\(" $NEW_D $NEW_A | grep -v json-repo` — пусто;
   - `grep -rnE "@u7-scl/domain/(user|stream|wish|questionnaire|peer-review)'" $NEW_D $NEW_A` — пусто (только `/contract`);
   - `grep -rn "course\.state'" modules/course/src | grep -v "/infra/"` — пусто (DOM-01).
3. `grep -rn "legacy\." modules/course/src/course` — пусто; `grep -rn "CourseLegacy" --include=*.ts platform modules scripts runners` — пусто; `grep -rn "teachesModule" domain/src/stream modules/stream` — пусто; в `student.rules.ts` нет `userStreams`/`teachesModule`.
4. Переименование: `grep -rnE "\b(CourseAr|CoursePolicy|CourseRepo|CourseJsonRepo)\b" domain modules/course platform scripts --include=*.ts` даёт только новые файлы Ф3, `index.ts`, `contract.ts`, `course.module.ts`, `u7-app.ts` и их тесты; в legacy-файлах — только `Legacy*`.
5. Четыре query-UC и шесть внешних — классы на `UseCaseFromDef`; `grep -rn "CourseUseCase\|CourseDs" modules/course/src/course` — пусто.
6. `CourseModuleDef`: `external: true`, 4 агрегата, 16 UC; `ArchChecker.defsOf([CourseModuleDef]).report()` пуст; `createStream` и `enrollStudent` проходят свои тесты; `wish` — без правок.
7. Тесты: курс без этапов валиден (`stages: []`, бот-форма — Ф4); для курса из одного этапа `getModulePlace` совпадает с прежним (плюс `stage`); все нарушения инвариантов Р2 — ошибки чтения; старый формат `courses.json` — исключение, файл цел; `getModulePrerequisite` — три исхода; `passedModuleIds` собирается из `advanced`-потоков.
8. Сценарии таблицы «Legacy-тесты и их судьба» перенесены (список в отчёте `dmg-test-designer`, сверяет reviewer); `git diff --numstat` — старые тесты не потеряны, кроме перечисленных «не переносятся» и удалённых по TST-08.
9. `data/courses/courses.json` в новом формате; перед переводом снят `backup:adhoc course-dmg-phases --courses`; `sha256sum data/courses/{modules,lessons,steps}.json` до/после одинаков; `git status --short data/` — только одобренный коммит `courses.json`; `data/courses/backups/` не создан.
10. Красная зона записана в `debt.md` поимённо по факту прогона.

## Отчёты

### S0 — `migrator` (flash, `cd-F3-s0`), 82106df3
21 файл, 4 имени → `Legacy*` целым словом, `biome --write` (переносы строк); реэкспорт `CourseFacade, CourseProgram, ModulePlace` из `contract.ts` снят (потребителей через `contract.ts` не было). Тесты 4602 → 4602, `check` зелёный; подсказка гейта о формате хранения — ложная (имя файла `*-repo.ts`). $0.03.

### Шаг 1 — `dmg-test-designer` (Sonnet)
34 файла (22 новых, 12 правок). Red: `domain modules platform` — 3204 pass / 68 fail, 21 файл не загружается (нет модулей реализации). Перенесены сценарии `entity.test`, `a-root.test`, `policy.test` (`canEnrollNextModule`), `api/course/*-uc.test`, `course-json-repo.test`, адаптеров `course.module.test`, `student.rules.test` (пререквизит), `enroll-student.uc.test`. Пины Т8 переведены на `ModuleErrors.NOT_FOUND`.
- **Раскладка DQS (принята orchestrator):** `new ModuleCoursesDqs(courses).firstIncluding|firstPublishedIncluding(moduleId)`; `new ModulePrerequisiteDqs(courses, modules, passedModuleIds).verdict(moduleId)`; `new PassedModulesDqs(students, streams).moduleIds()`.
- **Для шага 3:** `module-uc.fixture.ts`, `content-uc.fixture.ts` — `legacy: {} as CourseLegacy` перевести на `courses`; `CourseRepoFake` — наследник `MemoryRepo`, как `ModuleRepoFake`.
- **Для шага 4:** `StreamAr.teachesModule` и тест `stream.ar.student.test.ts:67-72` удалить (покрытие — `passed-modules.dqs.test.ts`).
- **Кандидаты в чистку:** блоки адаптеров над `legacy` в `modules/course/src/course.module.test.ts:237-460` — переписать под сборку без `legacy` в шаге 3; legacy-тесты `api/course/*`, `policy.test`, `a-root.test` — с кодом в Ф5.
