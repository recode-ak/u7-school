# Бриф среза: `course` / `module` (Ф1)

Черновик — `dmg-tech-lead`, Ф0; проверка — orchestrator. Читать вместе с `../spec.md`, `../plan.md` (Ф1), D-64, D-65, TR-52, TR-40, эталоном `wish`, ближайшими `stream` (`domain/src/stream/stream`, `modules/stream/src`) и брифом `conductor/archive/questionnaire-dmg_20261104/slices/questionnaire.md`.

Код `module` в `v0.2.6` (worktree `../u7-school-v0.2.6`, пакет `course`) совпадает с HEAD с точностью до импортов и `biome-ignore` (проверено `diff` для `domain/module/{a-root,entity,policy}.ts`, `api/module/{get-module,list-modules}-uc.ts`, `api/course-uc.ts`). Характеризация строится на текущих тестах как ожиданиях нового кода.

## Расхождения spec/plan с кодом

1. **Критерий плана «маркера DEBT-10 в `module` нет» невыполним в Ф1.** `#filterPublished` живёт в legacy `domain/src/course/module/a-root.ts:129-130`; его вызывает `getVisibleFor` (`a-root.ts:117-126`), а тот — legacy `CourseUseCase.getOutModule` (`modules/course/src/api/course-uc.ts:53`), которым пользуются legacy UC до Ф5. Файл удаляется в Ф5. Критерий Ф1 — «в новых файлах `module` нет `#`», DEBT-10 снимается в Ф6 (как и записано в плане).
2. **Имена новых классов занимают имена legacy.** `domain/src/course/index.ts` экспортирует legacy `ModuleAr` (`:119`), `ModulePolicy` (`:175`), `ModuleRepo` (`:176`), `ModuleSchema` (`:172`); `modules/course/src/infra/index.ts:6` — legacy `ModuleJsonRepo`; `modules/course/src/index.ts` делает `export *` из `./domain` и `./infra`. Новые `ModuleAr`/`ModulePolicy`/`ModuleRepo`/`ModuleJsonRepo` дали бы конфликт имён. Нужен шаг переименования legacy (по образцу TR-41 Т1/Т16: `Legacy*`). В plan его нет.
3. **Ошибки.** План: «`MODULE_NOT_FOUND`, `MODULE_ACCESS_DENIED`». Отказ видимости в DMG — базовая `ACCESS_DENIED` (`kind: 'access'`, `{ rule, denyMessage }`): групповой код `MODULE_ACCESS_DENIED` заводить не нужно. Код `MODULE_NOT_FOUND` (новая группа `MODULE`) не совпадает с контрактной `CourseErrors.MODULE_NOT_FOUND` = `COURSE_MODULE_NOT_FOUND` (`domain/src/course/course/course.errors.ts:8`), которую пинят тесты `stream` и бота (раздел «Сохраняемое поведение»). Две ошибки об одном факте до Ф3 — вопрос Т3.
4. **Policy не выражает «гость читает опубликованное».** `Rule.of` без субъекта — всегда отказ (`node_modules/dmg-core/docs/guides/policy.md` §2), а у гостя `caller.subject()` нет. Видимость опубликованного не помещается в `policy` Def UC целиком: UC — `allowAll`, право «видит черновики» считает правило, решение — метод Ar (образец: `GetStreamUc` считает `canManage` внутри `execute`, `modules/stream/src/stream/uc/get-stream.uc.ts`; отказ внутри `execute` через `CoreErrors.ACCESS_DENIED` — `modules/peer-review/src/review-campaign/uc/get-campaign-recipients.uc.ts:49-54`).
5. **Бот зовёт эти UC без актора.** Все вызовы `get-module`, `list-modules`, `get-module-snapshot`, `get-step` в `runners/u7-bot/src/**` — `appApi.execute(name, input)` без третьего параметра (например, `courses/stories/course-catalog.story.ts:275-286`, `mentor/stories/create-stream.ts:269,307`), то есть в v0.2.6 бот видит только опубликованное даже для автора. С актором зовут только скрипты (`scripts/list-lessons.ts:152`, `distribute-lesson.ts:348`, `update-stream-snapshot.ts:122` — последний без актора). После Ф4 (`dispatch` с реальным вызывающим) автор и администратор в боте начнут видеть черновики — стратегический вопрос С1.
6. **Плановая строка Ф1 «репозиторий: legacy ISO → число, round-trip, невалидная запись».** Новый `ModuleJsonRepo` при `save` пишет даты числами, а legacy `ModuleJsonRepo` читает `v.isoDateTime` (`domain/src/course/module/entity.ts:55-59`) и числа не примет. Пока живут legacy-UC (до Ф5), запись новым репозиторием в `data/courses/modules.json` ломает чтение legacy. В продакшене сейчас никто не пишет в `modules.json` (все authoring-UC без вызывающих, скрипты только читают), поэтому в Ф1 это ограничение тестов (запись — только во временный каталог), а не код. Фиксируется в TR Ф1 (Т11).
7. **`getByCourseId`** в `ModuleRepo`/`LessonRepo`/`StepRepo` (`domain/src/course/module/repo.ts` аналогов нет; `lesson/repo.ts:8`, `step/repo.ts:8`) — без вызывающих (только реализации); в новый порт не переносится.

## Границы

**Домен `domain/src/course`:**
- Новое:
  - `module/module.state.ts` (`ProjectVo`, `ModuleState`), `module/module.errors.ts`, `module/module.ar.ts` (`ModuleArDef`, `ModuleView`, `ModuleAr`), `module/module.policy.ts`, `module/module.fixture.ts`;
  - `module/uc/{get-module,list-modules}.uc.ts`;
  - тесты рядом.
- Изменяется: `course.module.ts` (+ `ModuleArDef`, 2 UC), `contract.ts`, `index.ts`, `course.module.test.ts`.
- Переименование legacy (шаг S0): `module/a-root.ts` (`ModuleAr` → `LegacyModuleAr`), `module/policy.ts` (`ModulePolicy` → `LegacyModulePolicy`), `module/repo.ts` (`ModuleRepo` → `LegacyModuleRepo`) и все ссылки в `domain/src/course` (`index.ts`, `module.ts:29,73`, `course-ds.ts`, `lesson/{a-root,policy}.ts`, `step/{a-root,policy}.ts`, тесты `module/{a-root,get-visible-for,policy}.test.ts`).

**Прикладной слой `modules/course/src`:**
- Новое: `module/module.repo.ts` (порт + `ModuleFilter`), `module/module.repo.fake.ts`, `module/uc/{get-module,list-modules}.uc.ts` и тесты, `infra/module.json-repo.ts` и тест.
- Изменяется: `course.module.ts` (`CourseUser`, `modules: ModuleRepo` в `CourseModuleDeps`, 2 записи карты), `infra/index.ts`, тесты `course.module.test.ts`, `course/uc/get-module-prerequisite.uc.test.ts`, `course/uc/get-module-snapshot.uc.test.ts` (только сборка `createCourseModule({…, modules})`).
- Переименование legacy (S0): `infra/db/module-json-repo.ts` (+ тест) — класс `LegacyModuleJsonRepo`; ссылки в `api/**` (`course-uc.ts`, `module/*`, тесты `*-uc.test.ts`), `infra/index.ts`.

**Вне пакета (Ф1):**
- `platform/app/src/u7-app.ts`: импорт `LegacyModuleJsonRepo` (`:20,120`), новый `courseModules: new ModuleJsonRepo(`${dbDir}/courses/modules.json`)` в `repos` и в фабрику `CourseModuleDef` (`:256-258`).
- `scripts/_app-factory.ts:45,107` — переименованный импорт legacy-репозитория.
- `conductor/architecture/debt.md` — orchestrator (раздел «Документы»).

**Не трогать:** `data/`; контракты `stream`, `wish`, `user`; `CourseArDef` и `CourseErrors` (Ф3); `lesson/**`, `step/**` (Ф2, кроме переименования ссылок на `ModulePolicy`); `content-snapshot.ts`; stories и тесты бота; `biome.json`; `dmg-core`.

## Решения брифа

**Р1. Состояние (`module.state.ts`)** — по образцу `stream.state.ts`.
- `ModuleState = v.object({ ...BaseEntityFields, … })`: `title`, `description` (обрезка краёв и `nonEmpty` через `v.transform`, `v.description` стоит до `transform`), `authorId: F.uuid('автора')`, `targetAudience?`, `goal?`, `result?`, `rules?`, `additional?`, `tags?: string[]`, `status: F.picklist(['draft','published','archived'], …)`, `projects: ProjectVo[]`.
- `ProjectVo` (без `createdAt`/`updatedAt`, DOM-13): `uuid`, `title`, `goal?`, `result?`, `additional?`, `status`, `lessonIds: uuid[]`. Опциональные тексты — `v.pipe(v.optional(v.string()), v.description(…))` (MAN-02).
- Даты — только из `BaseEntityFields` (`F.timestamp`: читает `"2026-07-08T18:35"` как UTC, `fields.ts:7-9`); `updatedAt` нет → `createdAt`, `version` нет → 0 (D-36). Все 4 записи `data/courses/modules.json` содержат `createdAt`/`updatedAt` формата `dddd-dd-ddTdd:dd`.
- Репозиторий разбирает записи `ModuleArDef.state`, а не `ModuleState`: только Def оборачивает схему в `withEntityDefaults` (`aggregate-def.ts:44`).

**Р2. `ModuleArDef`** (`name: 'module'`).
- Поле `status` в state обязывает объявить `statuses` и `transitions` (`aggregate-def.types.ts:66`, `AggregateSpec`; `RejectsComplete`, `:37`): `statuses: draft/published/archived` с метками, `transitions: {}`; `events: {}`; `errors: ModuleErrors`. Операций нет — authoring удалён (spec, TR-52 (3)); операции автора проектируются в треке-кандидате `course-module-history.md`. `transitions: {}` — подтвердить `tsc`/`ArchChecker` red-тестом.
- `ModuleAr extends Aggregate<typeof ModuleArDef, ModuleView>`: `private constructor`, `static restore(state)`, без `create`.
- `ModuleView` = state-форма наружу (даты числами, `version` включена).
- Методы-вопросы (DOM-02/04, без `Result`):
  - `isPublished()`, `isAuthoredBy(userId)`;
  - `viewFor(canSeeUnpublished: boolean): ModuleView | undefined` — привилегированному (`true`) любой статус целиком; иначе опубликованный модуль с проектами только `published`, остальные статусы — `undefined`. Заменяет `getVisibleFor` + `#filterPublished` (DEBT-10); методов с `#` и `biome-ignore` нет.

**Р3. Policy (`module.policy.ts`)** — вариант А (рекомендуется).
- Субъект: `ModuleSubject = Pick<User, 'uuid' | 'roles'>` (`User`, `Role` — из `@u7-scl/domain/user/contract`; ровно как `StreamPolicy`, `domain/src/stream/stream/stream.policy.ts:1-8`). **Вызова `user` нет**: роли и uuid приходят в субъекте вызывающего (`caller.subject()`), авторство — вопрос Ar (`isAuthoredBy`). D-41 не затронут.
- Контекст: `ModuleCtx = { module: ReadonlyAr<ModuleAr> }`.
- Правила (DOM-05, `Rule.of` с `label`/`denyMessage`): `isAdmin` (`roles.includes(Role.ADMIN)`), `isModuleAuthor` (`ctx.module.isAuthoredBy(subject.uuid)`; роль `AUTHOR` не требуется — как `ModulePolicy.isAuthor`, `module/policy.ts:47`), `canSeeUnpublished = Rule.anyOf(isAdmin, isModuleAuthor)`, `denyMessage` — «Нет доступа к модулю» (прежний текст, `course-uc.ts:60`).
- Правила `canCreate`/`canEdit`/`canAddProject`/`canReadProject` не переносятся: у них нет вызывающих после удаления authoring (spec); сценарии — в «Сохраняемом поведении».
- Варианты: В — кастомный `Rule`, пропускающий гостя по контексту (правка `dmg-core`, не нужна); С — решение в DQS (один агрегат, слой лишний — `repo.md` §5).

**Р4. UC** (оба `type: 'query'`, `aggregate: ModuleArDef`, `callers: ['user','guest']`, `policy: allowAll`).
- `getModule`: вход `{ moduleId }` (в legacy `uuid` — переименование, Т5); выход `ModuleView`; `errors: [ModuleErrors.NOT_FOUND]`. `load` — `modules.findById` или `NOT_FOUND`. `execute`: `ModulePolicy.rules.canSeeUnpublished.evaluate(caller.subject(), { module })`, затем `module.viewFor(allowed)`; `undefined` → `CoreErrors.ACCESS_DENIED.err({ rule, denyMessage })`.
- `listModules`: вход как `ListModulesCmdSchema` (`status?`, `authorId?`, `title?`, `tags?`, `sort?`, `limit?`, у каждого `v.description`); выход `v.array(ModuleSummary)` (С2, TR-53); `errors: []`. Выборка и сортировка — `ModuleRepo.findAll(filter)`; каждый модуль проходит `viewFor`, невидимые отбрасываются (как `try/catch` legacy).
- `callers` без `system`: внутренним UC `course` (Ф3) читать модули репозиторием, а не звать `getModule`.

**Р5. Ошибки** (`module.errors.ts`): `ModuleErrors = ErrorDef.define('MODULE', { NOT_FOUND })` — `kind: 'not_found'`, `label` «Модуль не найден», payload `{ moduleId: F.uuid('модуля') }`. Отказ видимости — `ACCESS_DENIED` ядра.

**Р6. Порт `ModuleRepo`** (`module/module.repo.ts`): `Repository<ModuleAr> & { findById(uuid); findAll(filter?: ModuleFilter) }`. Фильтры и сортировка — как в legacy `module-json-repo.ts:31-70`: `status`, `authorId`, `title` (подстрока без регистра), `tags` (пересечение), `sort` `createdAt|title : asc|desc` (направление не `asc` — по убыванию), `limit` (срез после сортировки). Фейк — `MemoryRepo` с `findById` через `restored`, `findAll` — `unanswered`.

**Р7. JSON-репозиторий** (`infra/module.json-repo.ts`) — по `stream.json-repo.ts`: `VersionedRepository<ModuleAr>`, `aggregate = ModuleArDef`, `Rows = v.array(ModuleArDef.state)`, строгий разбор (битая запись — исключение, файл цел), отсутствие файла — `[]`, `restore` из строки. Конструктор — `filePath` обязательный (в legacy значение по умолчанию `data/courses/modules.json` относительное — не переносим).

**Р8. Субъект модуля.** `CourseUser = Pick<User, 'uuid' | 'roles'>` экспортируется из `course.module.ts`; карта `satisfies ModuleMap<typeof CourseModuleDef, CourseModuleDeps, CourseUser>`, `ModuleFromDef<…, CourseUser>`. Адаптеры TR-11 остаются на `Identified`; если `tsc` не примет — четвёртый generic `CourseUser` в них (механика). TR-40 расширяется на `course` (Т2).

**Р9. Контракт.** В `contract.ts` добавить `ModuleErrors`, `GetModuleUcDef`, `ListModulesUcDef`, тип `ModuleView`. Схемы state наружу не выходят (D-45). `CourseModuleDef` остаётся `external: true` до Ф5 (spec); следовательно, ARC-04/MAN-10 по `domain/src/course` не работают на этом срезе — проверки заменяют grep-критерии ниже.

## Шаги (по ролям)

0. **migrator (flash), S0 — переименование legacy.** `ModuleAr`/`ModulePolicy`/`ModuleRepo`/`ModuleJsonRepo` → `Legacy*` во всех местах раздела «Границы». Одна механическая правка, без смены логики. Гейт: `bun run check` зелёный, число тестов то же, `git diff --numstat` — только переименования и импорты.
1. **dmg-test-designer (Sonnet).** Характеризация на `../u7-school-v0.2.6` и red (план — в «Сохраняемом поведении»). Новые файлы красные (нет реализации), старые — зелёные. Тесты UC — на `ModuleRepoFake`; репозиторий — `mkdtemp` (в `data/fixtures/courses` черновиков нет). Фикстура `module.fixture.ts` — по `stream.fixture.ts`.
2. **migrator (flash), домен.** `bun run gen aggregate course.module --adopt` (при коллизиях — вручную по `stream`), файлы Р1–Р5, `contract.ts`, `index.ts`, `course.module.ts`. Без `@u7-scl/core`, `@u7-scl/app-legacy`, чужого `index`.
3. **migrator (flash), прикладной слой и сборка.** Р6–Р8, `u7-app.ts`, `_app-factory.ts`, правка тестов сборки `createCourseModule`.
4. **Гейт** (`bun run scripts/agent-gate.ts`), `git diff --numstat`, grep-критерии.
5. **dmg-data-keeper (flash).** См. «Данные».
6. **orchestrator.** TR на Т1–Т13 и ответы на вопросы; `debt.md` (раздел «Документы»).
7. **dmg-reviewer (Opus).**

## Было → станет

### Домен

| Было | Станет |
|---|---|
| `module/entity.ts` `ModuleSchema`, `ProjectSchema` (`v.isoDateTime`, `biome-ignore` DEBT-5), тип `Module` | остаются как legacy до Ф5; новое — `module/module.state.ts` `ModuleState`, `ProjectVo` (`F.timestamp`) |
| `module/a-root.ts` `ModuleAr` (`create`, `enrich`, `addProject`, `publish`, `publishProject`, `addLessonToProject`, `getLessons`, `getProject`, `getVisibleFor`, `#filterPublished`) | `LegacyModuleAr` (до Ф5); новый `module/module.ar.ts` `ModuleAr`: `restore`, `isPublished`, `isAuthoredBy`, `viewFor` |
| `module/policy.ts` `ModulePolicy` (`canCreate`, `canRead`, `canReadProject`, `canEdit`, `canAddProject`, `isAdminOrAuthor`, `isAuthor` на `UserPolicy`) | `LegacyModulePolicy` (до Ф5); новый `module/module.policy.ts` `ModulePolicy.rules.canSeeUnpublished` |
| `module/commands/errors.ts` `ModuleNotFoundUcError`, `ModuleAccessDeniedUcError` (типы) | остаются (legacy); новое — `ModuleErrors.NOT_FOUND` + `ACCESS_DENIED` ядра |
| `module/commands/{get-module,list-modules}-cmd.ts` (метатипы `GetModuleCmdMeta`…) | остаются до Ф5; контракт — `GetModuleUcDef`, `ListModulesUcDef` |
| `module/repo.ts` интерфейс `ModuleRepo` (`save`, `getByUuid`, `getAll`) | `LegacyModuleRepo` |
| `course.module.ts`: `aggregates: [CourseArDef]`, 7 UC | `aggregates: [CourseArDef, ModuleArDef]`, + `GetModuleUcDef`, `ListModulesUcDef` (9 UC), `external: true` |

### Прикладной слой

| Было | Станет |
|---|---|
| `api/module/get-module-uc.ts` `GetModuleUc` (`CourseUseCase`, `getOutModule`) | остаётся (legacy, имя `get-module`); новый `module/uc/get-module.uc.ts` (`UseCaseFromDef`) |
| `api/module/list-modules-uc.ts` `ListModulesUc` | остаётся; новый `module/uc/list-modules.uc.ts` |
| `infra/db/module-json-repo.ts` `ModuleJsonRepo` (`JsonFileRepo`, схема `ModuleSchema`) | `LegacyModuleJsonRepo`; новый `infra/module.json-repo.ts` `ModuleJsonRepo` (`VersionedRepository`) |
| `CourseModuleDeps = ModuleDeps & { legacy }` | `+ modules: ModuleRepo`; субъект `CourseUser` |

### Вне пакета

| Что | Изменение |
|---|---|
| `platform/app/src/u7-app.ts:120,256-258` | `LegacyModuleJsonRepo` для `CourseApiModule`; новый `ModuleJsonRepo` в `dmgApp(…, repos)` → `createCourseModule({ …, modules })` |
| `scripts/_app-factory.ts:45,107` | переименованный импорт |

## Сохраняемое поведение (v0.2.6 = текущие тесты)

**Ветки и отказы (`get-module`, `list-modules`):**
- опубликованный модуль без вызывающего (гость) — виден, проекты только `published`;
- черновик и `archived`: автор модуля (без роли `AUTHOR`) и администратор видят целиком, остальным — отказ (`MODULE_ACCESS_DENIED` → `ACCESS_DENIED`); студент и ментор-не-автор — отказ;
- опубликованный модуль автору/администратору — все проекты, включая черновые;
- модуль не найден — `MODULE_NOT_FOUND`;
- `list-modules`: невидимые молча отбрасываются; `limit` применяется **до** отбора видимых (особенность legacy `list-modules-uc.ts:32-49`: `getAll` с `limit`, затем отбор по `getOutModule`; сохраняется, Т6); пустой список — `[]`.
- Тексты: «Нет доступа к модулю» (`denyMessage`), «Модуль не найден» (`label`).

**Тесты, закрепляющие состав модуля (grep по `*.test.ts`) — упадут при добавлении агрегата и UC, обновляются в Ф1:**
- `domain/src/course/course.module.test.ts:17-32` — точные `aggregates: ['course']` и список 7 UC;
- `domain/src/course/course.module.test.ts:35-41` — `CourseArDef` остаётся без изменений;
- `modules/course/src/course.module.test.ts:202-224` — `facade.serves(...)`, сборка `createCourseModule` без `modules` (тип);
- `modules/course/src/course/uc/{get-module-prerequisite,get-module-snapshot}.uc.test.ts` — сборка `createCourseModule`;
- `platform/app/tests/u7-app.test.ts` — не меняется, но проходит через новую фабрику (`createStream` читает snapshot из файлов legacy-формата, `:317-331`);
- вне границ: `domain/src/stream/stream/uc/stream.uc-defs.test.ts:42`, `modules/stream/src/stream/uc/create-stream.uc.test.ts:137-156`, `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:723` пинят `COURSE_MODULE_NOT_FOUND` — в Ф1 не меняются (`CourseErrors` остаётся).

**Legacy-тесты `module` и их судьба** (legacy-код живёт до Ф5, тесты зелёные после переименования S0):

| Файл (тестов) | Что в Ф1 |
|---|---|
| `domain/src/course/module/get-visible-for.test.ts` (6) | **переносятся все** → `module.ar.test.ts` (`viewFor`) |
| `module/a-root.test.ts` (18) | перенос: `getVisibleFor` «фильтрует только корневые проекты»; остальные 17 — authoring (`create`, `enrich`, `addProject`, `publish*`, `addLessonToProject`, `getLessons`, `getProject`, цикл) не переносятся |
| `module/policy.test.ts` (27) | перенос: `canRead` (4), `isAuthor` (2), `isAdminOrAuthor` (3), `canReadProject` (3, через `viewFor`) → `module.policy.test.ts` (`canSeeUnpublished`: admin, автор без роли `AUTHOR`, ментор-автор чужого модуля — отказ, студент, гость); `canCreate`, `canEdit`, `canAddProject` (15) — authoring, не переносятся |
| `module/entity.test.ts` (10) | → `module.state.test.ts` (обязательные поля, пустые title/description, `projects` обязателен/пуст, опциональные, невалидный uuid, `ProjectSchema` 2); «НЕ содержит `kind`» — не переносится |
| `domain/src/course/status.test.ts` (3) | остаётся (legacy `status.ts`) |
| `modules/course/src/api/module/get-module-uc.test.ts` (7) | **переносятся все** → `get-module.uc.test.ts` |
| `api/module/list-modules-uc.test.ts` (3) | переносятся → `list-modules.uc.test.ts` + новые: фильтры, сортировка, `limit`-до-видимости |
| `api/module.test.ts` (9) | `get-module`, `list-courses` (по факту список модулей) → covered `list-modules.uc.test.ts`; остальные 7 — authoring/`get-module-place`/lesson/step, не относятся |
| `infra/db/module-json-repo.test.ts` (5) | → `module.json-repo.test.ts`: save/findById, не найден → `undefined`, findAll, фильтр `status`, перезапись |
| `api/module/{create-module,enrich-module,add-project,publish-module}-uc.test.ts` (7+4+2+4) | authoring, не переносятся; удаляются в Ф5 с UC |
| бот: `courses/stories/{course-catalog.story,wish-invite.story}.test.ts`, `learning/stories/{hub,hub.student-events,nav-tree,step-view}.test.ts`, `mentor/stories/{create-stream,view-stream-mentor}.test.ts`, `streams/stories/view-stream.story.test.ts`, `tests/courses/course-program.integration.test.ts`, `tests/mentor/mentor.integration.test.ts:115` | в Ф1 не меняются (legacy-UC живы); на Def-имена переводятся в Ф4 |

**Новое red (TST-02/03):** Policy — allowed/denied по ролям и авторству; каждая ошибка UC по `code`/`kind`; `callers` (`system` → `UNAUTHORIZED`); `INPUT_VALIDATION` на неверном uuid; state — legacy-запись (`createdAt: "2026-07-08T18:35"`, нет `updatedAt`/`version`) → числа UTC, `updatedAt = createdAt`, `version = 0`; репозиторий — round-trip, битая запись (исключение, файл не изменён), отсутствие файла, `VERSION_CONFLICT`.

## Внешние зависимости

- `@u7-scl/domain/user/contract`: `Role`, `User` (TR-40). `UserModuleDef` уже в `dependsOn` `CourseModuleDef`.
- Чужие UC не вызываются. Входящих событий и ER нет.
- Потребители новых UC в Ф1 — только тесты; UI и скрипты переходят в Ф4–Ф5.

## Данные

Данные только читать (`AGENTS.md`, «Сервер и данные пользователей»).
- `data/courses/modules.json`: 4 модуля, поля `uuid, title, description, authorId, targetAudience, goal, result, tags, status, projects, createdAt, updatedAt`; все `published`; `createdAt`/`updatedAt` — `"2026-..T..:.."` без секунд; проектов 24, все `published`, поля `uuid, title, goal, result, status, lessonIds` и `additional` у 11. `lessonIds` без висячих ссылок (184 из 184 есть в `lessons.json`).
- `data/fixtures/courses/modules.json` (не под git): 4 модуля, тот же формат, без черновиков.
- Формат на диске в Ф1 **не меняется**; первый `save` через новый репозиторий перепишет файл в формате `F.timestamp` (числа) — ленивая миграция до трека 7. До Ф5 запись новым репозиторием вне временных каталогов запрещена (Т11).

## Решения Нурболата и orchestrator (TR-53)

- **С1** — принято: после Ф4 автор и админ видят черновое.
- **С2** — **в срезе**: `listModules` отдаёт `ModuleSummary` (`uuid`, `title`, `description`, `status`, `tags`) вместо `ModuleView`. Потребители — `create-stream.ts:269` (`uuid`, `title`), `scripts/list-lessons.ts:149` (`uuid`, `title`, `status`), `scripts/distribute-lesson.ts:346` (`uuid`, `title`); legacy `list-modules` живёт до Ф4–Ф5. Схема `ModuleSummary` — в `module.ar.ts` рядом с `ModuleView`, проекция — метод Ar `summary()` поверх `viewFor`.
- **Т1–Т13** — приняты по рекомендациям.
- **Критерий DEBT-10** — маркер `#filterPublished` в legacy `module/a-root.ts` остаётся до Ф5; в Def-файлах `module` его нет.

## Открытые вопросы

### Стратегические — Нурболату

**С1. Бот начнёт различать автора и администратора (после Ф4).** В v0.2.6 все чтения контента в боте анонимные: даже автор не видит черновых проектов/уроков/шагов (расхождение 5). После перевода на `dispatch` с реальным вызывающим автор и администратор увидят черновое (по spec и Policy «автор/админ видит всё»). Для студента ничего не меняется.
- (а) принять как есть;
- (б) stories каталога/навигации диспатчат как гость (`dispatchUcAsGuest`) — поведение v0.2.6.
- Рекомендация: (а). Решение нужно к брифу Ф4; в Ф1 влияет только тестами Policy.

**С2. Облегчить `listModules` (предложение перепроектирования).** Единственный потребитель списка в боте (`create-stream.ts:269`) берёт `uuid` и `title`, но legacy отдаёт модуль целиком с проектами и `lessonIds`. Вариант: `ModuleSummary` (`uuid, title, description, status, tags`) вместо `ModuleView`.
- Сейчас в срезе / в `debt.md`.
- Рекомендация: **в `debt.md`** — форма ответа не меняется, срез остаётся переносом.

### Тактические — orchestrator → TR (рекомендации tech-lead)

| № | Вопрос | Рекомендация |
|---|---|---|
| Т1 | Переименовать legacy `ModuleAr`/`ModulePolicy`/`ModuleRepo`/`ModuleJsonRepo` в `Legacy*` (расхождение 2) | да, шаг S0 перед red; образец TR-41 Т1/Т16; альтернатива (префиксы новых имён) расходится с `naming.md` |
| Т2 | Субъект `CourseUser = Pick<User,'uuid'|'roles'>`, `Role.ADMIN` из контракта `user`; внести `course` в «Пересмотреть» TR-40 | да; вызова `user` нет, D-41 не затронут |
| Т3 | `ModuleErrors.NOT_FOUND` (`MODULE_NOT_FOUND`) рядом с `CourseErrors.MODULE_NOT_FOUND` (`COURSE_MODULE_NOT_FOUND`) до Ф3 | да; в Ф2 снимок остаётся на `COURSE_…` (меняет контракт `stream`, пины в 4 тестах), единая ошибка — в Ф3, когда `stream` правится ради пререквизита |
| Т4 | Видимость: UC `allowAll` + правило `canSeeUnpublished` + `ModuleAr.viewFor` (вариант А Р3) | вариант А |
| Т5 | Вход `getModule`: `{ moduleId }` вместо `uuid` | да (`<a>Id`); legacy `get-module` живёт до Ф4 |
| Т6 | `limit` применять до отбора видимых (как v0.2.6), `sort` — `string` как в legacy | сохранить порядок; `sort` оставить строкой (picklist сузит вход без вызывающих — не нужен); особенность — в тест и комментарий |
| Т7 | `callers` `getModule`/`listModules` = `['user','guest']` | да |
| Т8 | `statuses` + `transitions: {}` в `ModuleArDef` | да; legacy-`Status` остаётся до Ф5 |
| Т9 | Выход: даты числами, `version` в `ModuleView`; бот полей дат модуля не читает (`grep` по `runners` пуст) | да |
| Т10 | `getByCourseId` не переносится | да |
| Т11 | До Ф5 новый `ModuleJsonRepo.save` не вызывается над `data/` (legacy-чтение ISO); тесты — `mkdtemp` | да, записать в TR; проверка `dmg-data-keeper` (хеш `modules.json` до/после) |
| Т12 | `CourseModuleDef` остаётся `external` в Ф1 (spec); арх-проверки пар не работают — grep вместо них | да |
| Т13 | `CourseModuleDeps.modules` обязателен (не `?`) | да; затронуты только тесты пакета и `u7-app.ts` (в `stream`/`wish` `createCourseModule` не вызывается) |

## Правила (ID rules.md)

`node_modules/dmg-core/docs/reference/rules.md`: ARC-02 (домен: только `dmg-core`/`valibot`), ARC-04 (`contract` чужих модулей), ARC-06, DOM-01 (без `…/state` вне Ar/репозитория), DOM-02, DOM-04, DOM-05, DOM-11, DOM-12, DOM-13, DOM-14, DOM-15, DOM-17 (`.snapshot()` только в `*.json-repo.ts`), MAN-01, MAN-02, MAN-03, MAN-07, MAN-10, MAN-11, ERR-01, ERR-02, ERR-04, API-01, API-03, API-05, CODE-01, CODE-02, CODE-04, TST-02, TST-03, TST-04, TST-05, TST-06, TST-07.
Проект (`conductor/architecture/rules.md`): ARC-02 (импорт `@u7-scl/core` — только в местах DEBT-1), ARC-04 (пары legacy — по DEBT-34), ARC-06, ARC-07, TST-06.

## Документы

- `dmg-core` не правится. Документы пакета — «не затронуто».
- Проект (orchestrator, по итогам Ф1): `debt.md` — TR на Т1–Т13; TR-40 «Пересмотреть» + `course`; сужение globs DEBT-1/2/5/10 не нужно (legacy-файлы живы), записать, что новые файлы `module` в них не входят; запись Т11.
- `modules/course/about.md` — описывает legacy; правится в Ф5/Ф6. Не затронуто в Ф1.
- `conductor/architecture/migration.md` §6 — в Ф6.

## Критерии приёмки

Команды выполняются из корня `u7-school`.

1. `bun run check` зелёный; `bun run arch:check` синхронен; тесты не ниже базовой линии (`CI=true bun test` ≥ 4216 pass, `bun run test:bot` ≥ 1107 pass).
2. Новые файлы среза (`NEW_D`: `domain/src/course/module/module.*.ts`, `domain/src/course/module/uc`; `NEW_A`: `modules/course/src/module`, `modules/course/src/infra/module.json-repo.ts`; исключая `*.test.ts`):
   - `grep -rnE "\bthrow\b|new [A-Za-z]*Ar\(|^\s*(static\s+)?(async\s+)?(get\s+)?#\w+|this\.#" $NEW_D $NEW_A` — пусто;
   - `grep -rnE "@u7-scl/(core|app-legacy)|isoDateTime|isoNow|Date\.now|new Date|biome-ignore" $NEW_D $NEW_A` — пусто;
   - `grep -rnE "\.snapshot\(" $NEW_D $NEW_A | grep -v json-repo` — пусто;
   - `grep -rnE "@u7-scl/domain/(user|stream|wish|questionnaire|peer-review)'" $NEW_D $NEW_A` — пусто (только `/contract`);
   - `grep -rnE "module\.state'" modules/course/src/module` — пусто вне `infra/` (DOM-01).
3. Переименование: `grep -rnE "\b(ModuleAr|ModulePolicy|ModuleRepo|ModuleJsonRepo)\b" domain modules/course platform scripts --include=*.ts` даёт только новые файлы Ф1, `index.ts`, `course.module.ts`, `u7-app.ts` и их тесты; в legacy-файлах — только `Legacy*`.
4. `getModule`, `listModules` — классы на `UseCaseFromDef`; `grep -n "CourseUseCase\|getOutModule" modules/course/src/module` — пусто.
5. Тест репозитория читает: ISO без секунд (`2026-07-08T18:35`), запись без `updatedAt`/`version`, число; `VERSION_CONFLICT`; битая запись (исключение, файл цел).
6. Сценарии из таблицы «Сохраняемое поведение» перенесены (список — в отчёте `dmg-test-designer`, сверяет reviewer); `git diff --numstat` — старые тесты не потеряны (кроме перечисленных как «не переносятся» и удаляемых в Ф5).
7. `git status --short data/` пуст; `sha256sum data/courses/modules.json` до и после — одинаков.
8. `CourseModuleDef`: `external` по-прежнему `true`; в `normalize()` — `aggregates: ['course','module']`, UC 9.

## Отчёты

### S0 — `migrator` (flash, `cd-F1-s0`), 3c4faa9d
36 файлов, только переименования и импорты; `describe` тоже переименованы. Красный `check` — старый путь v0.2.6 в брифах (`repo-layout`) (исправлен orchestrator).

### Шаг 1 — `dmg-test-designer` (Sonnet)
Новые: `module.fixture.ts`, `module.state.test.ts` (20), `module.ar.test.ts` (17), `module.policy.test.ts` (9), `modules/course/src/module/uc/module-uc.fixture.ts` (стенд, вне брифа — по `stream-uc.fixture.ts`), `get-module.uc.test.ts` (15), `list-modules.uc.test.ts` (16), `infra/module.json-repo.test.ts` (24). Изменены тесты состава/сборки: `domain/src/course/course.module.test.ts`, `modules/course/src/course.module.test.ts`, `get-module-{prerequisite,snapshot}.uc.test.ts`.
Перенесены: `get-visible-for` (6) и «только корневые проекты» → `module.ar`; `canRead`/`isAuthor`/`isAdminOrAuthor` → `module.policy`, `canReadProject` → `viewFor`; `entity.test` → `module.state`; `get-module-uc` (7), `list-modules-uc` (3), `module-json-repo` (5) — в новые. Не перенесены — по таблице брифа.
Ожидания к реализации: `ACCESS_DENIED.payload.rule = 'canSeeUnpublished'`; `ModuleRepoFake.seed(state)`; классы UC `GetModuleUc`/`ListModulesUc(deps, CourseModuleDef)`; `ModuleAr` и тип `ModuleState` из `@u7-scl/domain/course`. Замечание: у репозитория нет `create`, `save` нового uuid даёт `VersionConflict` (база) — не проверяется.
Итог: 399 pass, 10 файлов red на «Cannot find module». Orchestrator проверил.

### Шаг 2 — `migrator` (flash, `cd-F1-domain`)
Файлы Р1–Р5, Р9 вручную (генератор блокировали готовые тесты). Отклонения: `ProjectVo` → `domain/src/course/shared/project-vo.ts` (GritQL DOM-11 запрещает ключ `uuid` в `*.state.ts`), реэкспорт из `module.state.ts`. Grep `new [A-Za-z]*Ar\(` даёт `restore` в `module.ar.ts` — норма (критерий брифа неточен: исключение `*.ar.ts`). Маркер DEBT-10 в комментарии `module.ar.test.ts` убран orchestrator (`arch:check`).

### Шаг 3 — `migrator` (flash, `cd-F1-app`), b035df66
Порт, фейк, `GetModuleUc`/`ListModulesUc`, `ModuleJsonRepo`, `CourseUser`, `u7-app.ts`. Отклонения: экспорт `ModuleArDef`, `ModulePolicy`, `ModuleSummary` из `domain/src/course/index.ts` (deep-import закрыт `exports`); классы UC не экспортируются из индекса пакета (имена заняты legacy `api/`); `_app-factory.ts` не менялся (там только legacy). Адаптерам TR-11 четвёртый generic не понадобился. `sha256 data/courses/modules.json` не изменился; `save` в прод-путях не вызывается (Т11). `check` — 4323 pass.

### Данные — `dmg-data-keeper` (flash, `cd-F1-data`)
Совместимо. `data/courses/modules.json` (4 записи, 24 проекта, `additional` у 11 проектов) и `data/fixtures/courses/modules.json` (4, без `updatedAt`) читаются новым репозиторием 4/4, даты → числа UTC, `version = 0`, расхождений полей 0. `sha256` до/после совпадает, `git status data/` пуст. `save` нового репозитория в прод-путях нет.
**Уточнение Т11:** legacy `LegacyModuleJsonRepo` на числовых датах не падает, а молча отбрасывает записи (`JsonFileRepo.readAll`, `safeParse` + автобэкап в `data/courses/backups/`) → следующий legacy `save` опустошит файл. Запрет `save` нового репозитория над `data/` до Ф5 обязателен; перед первым `save` в Ф5 — `backup:adhoc`. Бэкап Ф3 (`--courses`) включает `modules.json`.

### Ревью — `dmg-reviewer` (Opus)
Без `error`; критерии 2–6, 8 выполнены, сохранённое поведение перенесено полностью, Т6 и Т11 соблюдены.

| ID | файл | суть | severity | решение |
|---|---|---|---|---|
| DOM-11 / CODE-01 | `shared/project-vo.ts` | вынос `ProjectVo` — обход ложного срабатывания grit (`uuid: F.uuid` во вложенной схеме) | info | TR-54; правка DOM-11 в `dmg-core` — вопрос Нурболату |
| domain-modeling §4 | `shared/project-vo.ts` | у проекта есть идентичность — не VO | warn | TR-54, переименование вместе с возвратом в state |
| — | `project-vo.ts`, `module.state.ts` | дублирование `trimmed`/`text` | warn | исправлено (`shared/text-fields.ts`) |
| DOM-17 / D-44 | `module.ar.ts` | объявлен `V` без `view()` | warn | исправлено |
| ARC-04 | `contract.ts` | нет `ModuleSummary` | warn | исправлено |
| — | `get-module.uc.ts` | `rule` строкой | warn | исправлено (`rule.name`/`denyMessage`) |
| — | `list-modules.uc.ts` | view ради флага видимости | warn | оставлено, TR-54 |
| CODE-04 | UC, `module.json-repo.ts`, `module.ar.ts`, `module.repo.ts` | ссылки на Т/Ф, пересказ имени | warn | исправлено |
| TST-04 | `module.state.test.ts` | `expect` внутри `if` | warn | исправлено |
| TST-04 | `u7-app.test.ts` | нет smoke через `U7App` | info | к Ф4, TR-54 |
| CODE-01 / D-52 | `modules/course/src/index.ts` | порт не экспортирован | warn | исправлено |

### Правки по ревью — `migrator` (flash, `cd-F1-fix`), 6e4363ae
Все исправляемые `warn`; payload отказа — из `rule.name`/`rule.denyMessage` (значения те же). `check` — 4323 pass.
