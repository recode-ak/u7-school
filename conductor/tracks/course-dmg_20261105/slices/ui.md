# Бриф среза: `u7-bot` / `ui` — UI курса на `dispatchUc` и `stages` (Ф4)

Черновик — `dmg-tech-lead` (Sonnet), Ф4; приёмка — orchestrator (Opus). Читать вместе с `../spec.md` (решения про этапы и «Клиент спрашивает — курс разруливает»), `../plan.md` (Ф4), `course.md` (контракты UC, красная зона), TR-52…TR-58, `debt.md` TR-57. Эталон поведения — релиз v0.2.6 в worktree `../u7-school-v0.2.6` (бот — в старой раскладке каталогов). Вход по тестам — `git show tst-cleanup:conductor/roadmap/test-bloat.md` §2 (Б-1…Б-17) и §6.

## Расхождения spec/plan с кодом

1. **Ветка `tst-cleanup` не слита** (`merge-base` = `816908b1`). Ф4 правит файлы, которые `tst-cleanup` уже ужимает: `view-stream.story.test.ts`, `student-dmg.e2e`, `wish-questionnaire.e2e`, `mentor.integration`, `streams/{catalog,view-stream}.integration`. Правь в них только строки с legacy-именами UC; не чисти и не переписывай сверх задачи (иначе конфликты в Ф7). Красные e2e (`student-dmg`, `wish-questionnaire`, `curious-showcase`, `pagination`, `questionnaire-ux`, `user-notify`) правки тестов не требуют: позеленеют после перевода stories.
2. **Критерий плана «`test:bot` не ниже базовой линии» противоречит удалению тестов.** Три integration-файла тестируют удалённые UC или дубли (см. «Тесты»). Решение — в «Решениях orchestrator».
3. **Легенда плана «`phase.moduleIds`» неточна.** Бот читает `course.phases[i].moduleIds` у legacy-типа `Course` (`runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:107-108,156-161,177-181,213-218,241-245,279-286,317-318,354-366,399-400`; `stories/course-catalog.story.ts:174,220,225,323,346,413,432,441,464`). Всего 45 совпадений `\.phases\b|phase\.moduleIds|phases: *\[` в `runners/u7-bot/src` (15 строк — фикстуры тестов).
4. **Входные ключи Def отличаются от legacy** (иначе тихо пустой результат): `get-course {uuid}` → `getCourse {courseId}`; `get-module {uuid}` → `getModule {moduleId}`; `get-step {uuid}` → `getStep {stepId}`. Остальные ключи совпадают (`moduleId`, `lessonIds`).
5. **Legacy `execute` бросал, Def возвращает `Result`.** Все `try/catch` с fallback превращаются в ветки `!res.ok`. `step-view.ts:216,296` — `get-step` без `try`; ветка отказа там новая (Т3).
6. **`ModulePlace`, `ContentSnapshot`, `Course`, `Step`, `Status` в stories импортируются из `@u7-scl/course/domain`** (barrel DEBT-3). ARC-08 — только контракты домена; убрать импорты из `runners/u7-bot/src` в Ф4. `worlds/*`, `test-app.ts` (`tests/`) и `scripts/*` — Ф5.
7. **Фикстуры миров: «курс без этапов» сейчас недостижим.** `runners/u7-bot/tests/worlds/builder.ts:62-66,206`: `phases: c.phases ?? defaultPhases(...)` даёт курсу без `phases` один этап «Основная программа». Без этапов — только явным `phases: []`. Два этапа — `course-js-basics` (`worlds/core-education.ts:190-215`), один — `course-test-escaping`, `course-test-wish`, `course-long-pagination`.
8. **`u7-cli` вызывает UC по имени динамически** (`runners/u7-cli/src/cli-controller.ts:321,373`). Вне Ф4 — в бриф `assembly.md` (Ф5).

## Границы

**Меняем (`runners/u7-bot`):**
- `src/controllers/courses/`: `course-nav-resolver.ts`, `stories/{course-catalog,wish-invite,wish-confirmed}.story.ts`, `ui-spec.md`; тесты рядом: `course-nav-resolver.test.ts`, `stories/{course-catalog,wish-invite,wish-confirmed}.story.test.ts`; новый `stories/course-dmg.test-kit.ts`.
- `src/controllers/learning/`: `shared.ts`, `stories/{hub,step-view,nav-tree}.ts`; тесты `hub.test.ts`, `hub.student-events.test.ts`, `step-view.test.ts`, `nav-tree.test.ts`.
- `src/controllers/streams/stories/view-stream.story.ts` (+ `view-stream.story.test.ts`), `src/controllers/mentor/stories/{create-stream.ts,create-stream.test.ts,view-stream-mentor.test.ts}`.
- `tests/courses/{course-catalog,wish-flow}.integration.test.ts` (переписать на миры), `tests/mentor/mentor.integration.test.ts:115` (одна строка).
- Удаляются: `tests/courses/{content-path,course-program,course-access}.integration.test.ts`.
- Мир стадий (если нужен): `tests/worlds/*` — только добавление определения мира; существующие не менять (хеш кэша `.cache/worlds`, TR-57 (4)).
- Типовые импорты `Course/Step/ContentSnapshot/ModulePlace/Status` → контракт `@u7-scl/domain/course/contract` (`CourseView`, `StepView`, `ContentSnapshot`, `ModulePlace`; `Status.PUBLISHED` → литерал `'published'`).

**Не трогаем:** `domain/**`, `modules/**`, `platform/**`, `tests/helpers/test-app.ts`, `tests/worlds/*` (кроме добавления мира), `scripts/*`, `runners/u7-cli`, `data/`, `biome.json`, `conductor/`, вызовы модуля `user` (`get-user`, `get-users-by-ids`, `list-users`), форматы callback-кодов.

## Решения брифа

**Р1. Вызов.** `this.dispatchUc(CourseModuleDef, XUcDef.command({...}), actor)`; `if (!res.ok)` — ветка прежнего fallback; неожиданное — `ucErrorNotify(res.error)` (ERR-06, образец — `view-stream.story.ts:126-133`). `Def` и `*UcDef` — из `@u7-scl/domain/course/contract`.

**Р2. Свободные функции `learning/shared.ts`** (`buildStepList`, `loadStepDescriptions`) не видят защищённый `dispatchUc`. По прецеденту `StreamDispatch` (`shared.ts:29-33`) — тип `CourseDispatch` рядом; stories передают `(cmd) => this.dispatchUc(CourseModuleDef, cmd, actor)`. Вызовы: `nav-tree.ts:72,80`, `view-stream.story.ts:321,332`, `step-view.ts:231`. Параметр `appApi` у этих функций исчезает.

**Р3. Подписки на события.** `hub.ts` `#handleCompletedEvent`: `getModulePlace` через `dispatchUc` с загруженным `user`. `wish-invite`/`wish-confirmed`: `getCourse`, `getCourseByModule`, `getModule` — актора нет → `dispatchUcAsGuest`. Неопубликованный модуль гость не видит → заголовок по fallback (Т2).

**Р4. Навигация по этапам.** Резолвер получает `CourseView[]`; `phase` → `stage` (`course.stages[idx]`, `stage.title`, `stage.moduleIds`). Если `stages.length > 0` — поведение 1:1 с v0.2.6. Если `stages = []` — область = вся программа `course.moduleIds`, уровня этапа нет (сценарии С).

**Р5. `phaseIdx` в адресе** (`course-catalog:module:<course>:<phaseIdx>:<moduleId>`) — формат не меняется. Для курса без этапов `phaseIdx` = `0`, обработчик его игнорирует.

**Р6. Поиск этапа модуля** в `#handleProject`/`#handleLesson`: `stages.findIndex(s => s.moduleIds.includes(moduleId))`, прежний `Math.max(0, …)` при `stages.length > 0`; при `stages = []` индекс не вычисляется.

**Р7. Тестовый набор.** Новый `stories/course-dmg.test-kit.ts` — по образцу `streams/stories/stream-dmg.test-kit.ts` (`dmgDispatch(answers, [CourseModuleDef, WishModuleDef])`, `refuse`, билдеры `courseView({ stages })`, `stage(title, moduleIds)`).

**Р8. Что не переносить (test-bloat).** Б-4: integration/e2e каталога — один сквозной сценарий на файл, не повторять e2e `curious-showcase`. Б-9: умолчания платформы в stories не проверять. Б-11/Б-12: не писать ожидание тем же кодом и «пустой вход → пустой результат». Legacy-тесты authoring — удалять с кодом.

## Шаги (по ролям)

Порядок: 1 ‖ 3 → 2 → 4 → 5. После каждого шага flash — `bun run scripts/agent-gate.ts`, `git diff --numstat`, grep-критерии шага.

**Шаг 1 — `dmg-test-designer` (Sonnet): характеризация и red.**
- Файлы: `courses/course-nav-resolver.test.ts`, `courses/stories/course-catalog.story.test.ts`, `courses/stories/course-dmg.test-kit.ts` (новый), `tests/courses/course-catalog.integration.test.ts`, `tests/courses/wish-flow.integration.test.ts`, мир без этапов (если нужен).
- Что: (1) фикстуры `phases: [...]` резолвера и catalog-теста → `stages` с теми же ожиданиями; (2) red-тесты «курс без этапов» (С1…С4); (3) `course-catalog.story.test.ts` — мок `appApi.execute` → `dmgDispatch` kit; (4) integration: `wish-flow` — курс из мира (`course-test-wish`/`course-test-escaping`), `course-catalog.integration` — один дрилл-даун на `course-js-basics` + один тест курса без этапов на отдельном мире (`phases: []`, 2 модуля, `registerWorld`); (5) удалить `content-path.integration`, `course-program.integration`, `course-access.integration`; в отчёт — таблица «тест → где покрыт».
- Проверки: `CI=true bun test runners/u7-bot/src/controllers/courses` — красные только новые/переведённые; красный tsc в этих файлах до шага 4 допустим — фиксировать в отчёте.

**Шаг 2 — тесты остальных stories на Def-имена (flash, `--label cd-F4-tests`).**
- Файлы: `learning/stories/{hub.test.ts,hub.student-events.test.ts,step-view.test.ts,nav-tree.test.ts}`, `streams/stories/view-stream.story.test.ts`, `mentor/stories/{view-stream-mentor.test.ts,create-stream.test.ts}`, `courses/stories/{wish-invite.story.test.ts,wish-confirmed.story.test.ts}`; `tests/mentor/mentor.integration.test.ts:115`.
- Что: мок `execute(name)` по legacy-именам → `dmgDispatch` kit; входы `{uuid}`→`{stepId|moduleId|courseId}`; `throw` «не найден» → `refuse(NOT_FOUND)`; `get-user` остаётся на `execute`. Логику и ожидания не менять; `expect` не удалять.
- Grep «готово»: `grep -rnE "name === '(get-course|get-module|get-step|get-steps-by-lessons|get-module-place|get-module-snapshot|list-modules|list-courses|get-course-by-module)'" runners/u7-bot/src --include=*.test.ts` — пусто.

**Шаг 3 — механическая замена вызовов в stories без `stages` (flash, `--label cd-F4-calls`).**
- Файлы: `learning/shared.ts:158,178` + тип `CourseDispatch`; `learning/stories/hub.ts:67`, `step-view.ts:216,296`, `nav-tree.ts:72,80,90`; `streams/stories/view-stream.story.ts:321,332,342`; `mentor/stories/create-stream.ts:269,307`; `courses/stories/wish-invite.story.ts:179,189`, `wish-confirmed.story.ts:127,139`.
- Что: Р1–Р3; fallback-ветки сохранить буквально; `step-view` без `try` → `ucErrorNotify` (Т3). Тексты, коды кнопок, порядок — не менять.
- Проверки: `bun run tslint`; тесты этих stories до шага 2 красные из-за моков — допустимо.

**Шаг 4 — stories с логикой этапов (Sonnet).**
- Файлы: `courses/course-nav-resolver.ts`, `courses/stories/course-catalog.story.ts`, `courses/ui-spec.md`.
- Что: Р1, Р4–Р6; `#loadCourses` — `listCourses` + при отсутствии id `getCourse`; `#loadModulesInfo` — прежняя пара `getModule`+`getModuleSnapshot` (Т4); `ui-spec.md` — раздел «Курс без этапов».
- Проверки: `CI=true bun test runners/u7-bot/src/controllers/courses`; красная зона: `CI=true bun test runners/u7-bot/tests/courses runners/u7-bot/tests/e2e/{curious-showcase,pagination,questionnaire-ux,wish-questionnaire,student-dmg,user-notify,main-menu}.e2e.test.ts runners/u7-bot/tests/{learning,streams}`.

**Шаг 5 — приёмка (Opus).** `bun run check`; `bun run test:bot`; пересчёт базовой линии; снять красную зону `debt.md` (TR-57 (1)–(2)); `dmg-reviewer`.

## Было → станет

### Legacy UC → Def (все `callers` включают `user` и `guest`)

| Legacy-имя | Def (`CourseModuleDef`) | Вход | Выход / отказ |
|---|---|---|---|
| `list-courses` `{}` | `ListCoursesUcDef` | `{}` | `CourseView[]` с `stages` |
| `get-course` `{uuid}` | `GetCourseUcDef` | `{courseId}` | `CourseView`; `CourseErrors.NOT_FOUND` |
| `get-course-by-module` | `GetCourseByModuleUcDef` | `{moduleId}` | `CourseView \| undefined` |
| `get-module-place` | `GetModulePlaceUcDef` | `{moduleId}` | `ModulePlace \| undefined` |
| `get-module` `{uuid}` | `GetModuleUcDef` | `{moduleId}` | `ModuleView`; `ModuleErrors.NOT_FOUND` |
| `list-modules` `{status}` | `ListModulesUcDef` | `{status:'published'}` | `ModuleSummary[]` |
| `get-module-snapshot` | `GetModuleSnapshotUcDef` | `{moduleId}` | `ContentSnapshot`; `ModuleErrors.NOT_FOUND` |
| `get-step` `{uuid}` | `GetStepUcDef` | `{stepId}` | `StepView`; `StepErrors.NOT_FOUND`, `ModuleErrors.NOT_FOUND` |
| `get-steps-by-lessons` | `GetStepsByLessonsUcDef` | `{lessonIds}` | `Record<lessonId, {uuid,description}[]>` |

### Вызовы в исходниках (29; многострочных вызовов UC курса нет)

| Файл:строка | Legacy → Def |
|---|---|
| `courses/stories/course-catalog.story.ts:258,328` | `get-course-by-module` |
| `…:275,351,416,444,469,657,739` | `get-module-snapshot` (7) |
| `…:284,365,489,721` | `get-module` (4) |
| `…:678` / `:682` / `:773` | `list-courses` / `get-course` / `get-steps-by-lessons` |
| `courses/stories/wish-invite.story.ts:179` / `:189` | `get-course` / `get-module` |
| `courses/stories/wish-confirmed.story.ts:127` / `:139` | `get-course` / `get-course-by-module` |
| `learning/stories/hub.ts:67` | `get-module-place` |
| `learning/stories/step-view.ts:216,296`, `nav-tree.ts:90` | `get-step` |
| `learning/shared.ts:158` / `:178` | `get-step` / `get-steps-by-lessons` |
| `streams/stories/view-stream.story.ts:342` | `get-step` |
| `mentor/stories/create-stream.ts:269` / `:307` | `list-modules` / `get-module` |

### Чтение этапов

| Место | Станет |
|---|---|
| `course-nav-resolver.ts` (уровни 0–4) | `course.stages[idx]`, `stage.title`, `stage.moduleIds`; без этапов — `course.moduleIds` |
| `course-catalog.story.ts:174,413,441` (`phases.flatMap`) | `course.moduleIds` |
| `:220,225` | `course.stages[phaseIdx]`, `stage.moduleIds` |
| `:323,432` (`c.phases.some(...)`) | `c.moduleIds.includes(id)` |
| `:346,464` | Р6 |

### Тесты

| Файл | Судьба |
|---|---|
| `courses/course-nav-resolver.test.ts` | фикстуры → `stages`, ожидания не менять; + «без этапов» |
| `courses/stories/course-catalog.story.test.ts` | мок → `dmgDispatch`; фикстуры → `stages`; не множить (Б-6) |
| `wish-*`, `hub*`, `step-view`, `nav-tree`, `view-stream*`, `create-stream` (тесты) | мок → kit, состав не менять |
| `tests/courses/course-catalog.integration.test.ts` | один дрилл-даун на мире + один без этапов |
| `tests/courses/wish-flow.integration.test.ts` | курс из мира, `createDraftCourseWithModule` удалить |
| `tests/courses/{content-path,course-program,course-access}.integration.test.ts` | удаляются (UC удалены / дубль, TST-08) |
| `tests/e2e/*` (красная зона) | не правятся; остался красным — эскалация |

## Сохраняемое поведение (характеризация на `v0.2.6`)

`course-nav-resolver.ts` в `v0.2.6` побайтно совпадает с текущим (diff — импорты). Курс из одного этапа (`Fullstack JS`) — эталон: тексты и коды неизменны. Для курсов с ≥1 этапом — байт-в-байт:
- Главное меню: «📖 Курсы».
- Пусто/отказы: `📖 *Курсы*\n\nПока нет доступных курсов.`; `⚠️ Курс не найден или недоступен`; `⚠️ Этап не найден или недоступен` / `⚠️ Курс не указан`; `⚠️ Модуль не найден или недоступен`, `⚠️ Проект не найден`, `⚠️ Урок не найден`.
- Уровень 0: крошки `📖 Курсы` › `Курс i/M: {название}`; `Этапы курса:`; `{n}. {заголовок} ({K} модуль/модуля/модулей)`, адрес `course-catalog:phase:<course>:<idx>`; кнопки желания; `◀️ Пред. курс` / `След. курс ▶️`; `↩️ Главное меню`.
- Уровень 1: `Этап i/N: {заголовок}`, `Модули этапа:`, `◀️ Пред. этап`/`След. этап ▶️`, `⬅️ Назад к курсу`.
- Уровень 2: `Модуль i/K` (K — модули этапа), `Проекты модуля:`, пред./след. модуль — внутри этапа, `⬅️ Назад к этапу`.
- Уровни 3–4, заголовки шагов (`Шаг n`, если описания нет), порядок, нумерация.
- Совместимость старых колбэков и форматы адресов с `Number(ids[1])`.
- Fallback: `Модуль <первые 8 символов uuid>`; заголовки шагов `{}` при отказе загрузки.
- События: «🏁 Модуль завершён! Хочешь записаться на следующий?» (7a), «🔁 Модуль не пройден до конца…» (7b), «🎉 Курс завершён! …» при `place.isLast` (7c), «🏁 Модуль завершён!» (7d).
- Мастер создания потока: `📦 *Выберите модуль курса\:*`, `🔄 Обновить список`.
- Шаги: маркеры `✅`/`▶️`/`🔒`; при отказе `getStep` в `buildStepList` — `sid` как описание.

## Сценарии для red-тестов

| № | Вход | Ожидание |
|---|---|---|
| С1 | `stages: []`, `moduleIds: [m1,m2]` | уровень 0: `Модули курса:` (Т1), строки модулей `{n}. {название} ({P} проект…)`, адрес `course-catalog:module:<course>:0:<mid>`, кнопки желания и пред./след. курс, строк-этапов нет |
| С2 | то же, уровень `module` (m1) | крошки `Курс i/M`, `Модуль 1/2: …` без `Этап`; `След. модуль ▶️` → m2; `Назад к курсу` → `course-catalog:course:<course>` |
| С3 | то же, `project`, `lesson` | крошки без `Этап`; `Назад к модулю` → адрес с `:0:<mid>` |
| С4 | то же, `phase:<course>:0` | `⚠️ Этап не найден или недоступен` |
| С5 | один этап | все ожидания v0.2.6 без изменений |
| С6 | два этапа (`[m1]`, `[m2,m3]`) | 2 строки `(1 модуль)`, `(2 модуля)`; `phase:…:1` — `Этап 2/2`, `◀️ Пред. этап`, без `След.`; m3: `Модуль 2/2`, `Пред. модуль` → m2, `След.` нет |
| С7 | `#loadCourses`, курс вне `listCourses` | `getCourse` подгружает; NOT_FOUND → `⚠️ Курс не найден или недоступен` |
| С8 | `getModuleSnapshot` → `Err` / `getModule` → `Err` / `getStepsByLessons` → `Err` | `⚠️ Модуль не найден…` / `Модуль <8 символов>` / `Шаг n` |
| С9 | `student.completed`: `getModulePlace` → `undefined`/`Err` | `🏁 Модуль завершён!` |
| С10 | integration/e2e на мирах | `course-js-basics` — drill-down; мир `phases: []` — модули кликабельны до урока; `course-long-pagination` — пагинация без изменений |

## Тактические решения (по умолчанию)

- **Т1.** Подзаголовок курса без этапов — `Модули курса:`, `Модуль i/K` — по всей программе.
- **Т2.** `wish-invite`/`wish-confirmed` — `dispatchUcAsGuest`; неопубликованный модуль → fallback-заголовок.
- **Т3.** Отказ `getStep` в `step-view.ts:216,296` → `ucErrorNotify(res.error)`.
- **Т4.** `#loadModulesInfo` — два вызова на модуль (как было); в `debt.md` — «оптимизация загрузки карточек модулей».
- **Т5.** `Status.PUBLISHED` → `'published'`, `ModuleRow` — из `ModuleView`.
- **Т6.** `CourseDispatch` — в `learning/shared.ts` рядом со `StreamDispatch`.
- **Т7.** `hub.ts`: `getModulePlace` через `dispatchUc` с `user`; при `!user?.telegramId` — прежний ранний возврат.
- **Т8.** `u7-cli` и `scripts/*` — Ф5.
- **Т9.** `CourseDef.status` в мирах не добавлять.

## Правила (ID `rules.md`) для reviewer

ARC-08, ARC-09, ERR-01, ERR-06, ERR-07, CODE-02, CODE-04, TST-04, TST-05, TST-06, TST-08 (Б-4, Б-9, Б-11, Б-12), TST-09.

## Документы

- `runners/u7-bot/src/controllers/courses/ui-spec.md` — раздел «Курс без этапов».
- `debt.md` — снять красную зону TR-57 (1)–(2) (шаг 5); Т4 — новая строка.

## Критерии приёмки

- **G1.** `grep -rnE "['\"](list-courses|get-course|get-course-by-module|get-module-place|get-module-snapshot|get-module|list-modules|get-lesson|get-step|get-steps-by-lessons)['\"]" runners --include=*.ts` — пусто (до Ф4: 56).
- **G1b.** `grep -rnE "['\"](create-course|add-phase-to-course|add-module-to-course|create-module|publish-module|resolve-content-path|get-course-program|enrich-module|add-project|create-lesson|create-step)['\"]" runners --include=*.ts` — пусто (до Ф4: 48).
- **G2.** `grep -rPzo "execute\(\s*'[a-z-]+'" runners --include=*.ts | tr '\0' '\n' | grep -oP "'[a-z-]+'" | sort -u` — только `'get-user'`, `'get-users-by-ids'`, `'list-users'`.
- **G3.** `grep -rnE "\.phases\b|\bphase\.moduleIds|\bphases: *\[" runners/u7-bot/src --include=*.ts` — пусто (до Ф4: 45).
- **G4.** `grep -rn "@u7-scl/course" runners/u7-bot/src` — пусто.
- **G5.** `grep -rnE "as (Course|Step|ModulePlace|ContentSnapshot)\b" runners/u7-bot/src --include=*.ts | grep -v test` — пусто.
- **G6.** `git diff --numstat` по `*.test.ts`: удалённых `expect(`/`test(` нет, кроме трёх удаляемых файлов и дублей по таблице шага 1; С1–С10 есть.
- **Гейт.** `CI=true bun test runners/u7-bot/src/controllers/{courses,learning,streams,mentor}` зелёный; красная зона TR-57 зелёная; `bun run test:bot` без новых красных; `bun run check` зелёный; `git status data/` чист.

## Решения orchestrator

Бриф принят (Opus) с поправками — TR-59 (`debt.md`):

- **О1. Курс с одним этапом (Нурболат) — меняет Р4, С5 и «Сохраняемое поведение».** Карточка курса (уровень 0) сразу показывает модули этапа: крошки `📖 Курсы` › `Курс i/M: {название}` › `Этап 1/1: {заголовок этапа}`, подзаголовок `Модули этапа:`, строки модулей как на уровне 1 (`{n}. {название} ({P} проект…)`, адрес `course-catalog:module:<course>:0:<mid>`), кнопки желания и пред./след. курс — как на уровне 0. Уровень модуля: крошки с `Этап 1/1: …` (как раньше), `⬅️ Назад к курсу` вместо `⬅️ Назад к этапу`. Колбэк `phase:<course>:0` (старые сообщения) — прежний экран этапа без изменений. Остальные тексты курса из одного этапа — байт-в-байт v0.2.6.
- **О2. Курс без этапов** — по С1–С4 и Т1 (Нурболат: «сразу список модулей»).
- **О3. Два этапа и больше** — 1:1 с v0.2.6 (С6).
- **О4. Тесты (Нурболат):** тесты удалённых UC удаляются вместе с ними; integration бота — «UC подключён» + один самый длинный путь без моков внутри модуля. Базовая линия `test:bot` пересчитывается в `summary.md`, критерий «не ниже» — после пересчёта.
- **О5. Порядок:** шаг 3 (flash) выполнен раньше шага 1 — от решений С1/С2 не зависит.

## Отчёты

- **Шаг 3 (flash `cd-F4-calls`, первым):** 8 stories на `dispatchUc`; отклонения — `actor` проброшен во внутренние методы, `?? sid`/`kind ?? 'text'` убраны (поля Def обязательны).
- **Шаг 1 (Sonnet):** kit `course-dmg.test-kit.ts`, тесты резолвера и story каталога на `stages`, integration на мирах; удалены `content-path`, `course-program`, `course-access` (таблица «где покрыт» — в отчёте шага, тесты UC в `modules/course`); `wish-flow` урезан по О4. Эскалации: `createTestApp` без параметра мира (решено в шаге 4), С9 — в шаг 2.
- **Шаг 2 (flash `cd-F4-tests`):** 10 тестовых файлов на kit, + тест С9; `expect` не удалены.
- **Шаг 4 (Sonnet):** резолвер и story каталога на `stages` (О1–О3), `ui-spec.md`, `createTestApp(tag, world)`. Отклонения от границ: `tests/helpers/{test-app,fixture-loader}.ts` (по поручению), `tests/e2e/pagination.e2e.test.ts` (следствие О1, шаг `cd-F4-fix`).
- **`cd-F4-fix` (flash):** тесты под О1 (`pagination`, `wish-flow`), ошибка ожидания шага 1 (префикс «Шаг N:»), мок `controller.test.ts`, `phase` → `stage` в резолвере.
- **Ревью (Opus):** 0 `error`, 6 `warn` (ERR-06 `listCourses`/`listModules`, ветка `getStep` без теста, 3 × TST-08), CODE-04 — метки брифа в коде; всё исправлено (`cd-F4-review`). Вопрос «автор видит заголовки неопубликованных модулей» — принято, TR-59.
- **Гейт:** `CI=true bun run check` зелёный (4910 / 0), `test:bot` 1097 / 0, G1–G5 пусто, `git status data/` чист.
