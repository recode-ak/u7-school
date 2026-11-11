# Инвентарь тестов: `course-domain`

Трек `course-dmg_20261105`, фаза Ф8. Только чтение: ничего не удалено, код и тесты не правились.

- Область: `domain/src/course/**/*.test.ts` — 31 файл.
- Базовая линия (проверено): `cd domain && bun test src/course` → **442 pass, 0 fail**, 629 `expect()`, 31 файл.
- Список тестов с номерами строк — `conductor/tracks/course-dmg_20261105/inventory/course-domain-tests.txt`.
- Вопрос к каждому `it`/`test`: «какая реальная ошибка кода модуля его уронит, и только его?». Нет ответа — кандидат.
- Паттерны — `conductor/roadmap/test-bloat.md` §2 (Б-1…Б-17), рекомендации по курсу — §6.
- Пути в таблицах — от `domain/src/course/`; «модульный тест» — `modules/course/src/...`, для справки «где покрыто», не оценивался.

Итог: **222 полезных теста, 220 кандидатов** (12 «пуст», 208 «сомнителен»).

## 1. Сводка

| Файл | Всего | Полезен | Сомнителен | Пуст |
|---|---:|---:|---:|---:|
| `status.test.ts` | 3 | 0 | 0 | 3 |
| `content-snapshot.test.ts` | 9 | 0 | 9 | 0 |
| `content-snapshot-index.test.ts` | 4 | 0 | 0 | 4 |
| `course.module.test.ts` | 8 | 1 | 6 | 1 |
| `course/course.ar.test.ts` | 46 | 34 | 10 | 2 |
| `course/course.state.test.ts` | 49 | 24 | 24 | 1 |
| `course/uc/get-course.uc.test.ts` | 5 | 1 | 4 | 0 |
| `course/uc/get-course-by-module.uc.test.ts` | 4 | 0 | 4 | 0 |
| `course/uc/get-course-enrollment.uc.test.ts` | 3 | 1 | 2 | 0 |
| `course/uc/get-courses-including-module.uc.test.ts` | 3 | 0 | 3 | 0 |
| `course/uc/get-courses-starting-with-module.uc.test.ts` | 3 | 0 | 3 | 0 |
| `course/uc/get-module-enrollment.uc.test.ts` | 4 | 0 | 4 | 0 |
| `course/uc/get-module-place.uc.test.ts` | 13 | 0 | 13 | 0 |
| `course/uc/get-module-prerequisite.uc.test.ts` | 19 | 0 | 19 | 0 |
| `course/uc/get-same-modules.uc.test.ts` | 3 | 0 | 3 | 0 |
| `course/uc/list-courses.uc.test.ts` | 10 | 1 | 9 | 0 |
| `lesson/lesson.ar.test.ts` | 17 | 14 | 2 | 1 |
| `lesson/lesson.state.test.ts` | 23 | 7 | 16 | 0 |
| `lesson-steps.dqs.test.ts` | 13 | 10 | 3 | 0 |
| `lesson/uc/get-lesson.uc.test.ts` | 6 | 0 | 6 | 0 |
| `module-courses.dqs.test.ts` | 21 | 18 | 3 | 0 |
| `module/module.ar.test.ts` | 27 | 21 | 6 | 0 |
| `module/module.policy.test.ts` | 9 | 5 | 4 | 0 |
| `module/module.state.test.ts` | 22 | 13 | 9 | 0 |
| `module-prerequisite.dqs.test.ts` | 18 | 16 | 2 | 0 |
| `module-snapshot.dqs.test.ts` | 19 | 16 | 2 | 1 |
| `module/uc/get-module-snapshot.uc.test.ts` | 6 | 0 | 6 | 0 |
| `step/step.ar.test.ts` | 21 | 16 | 5 | 0 |
| `step/step.state.test.ts` | 32 | 24 | 8 | 0 |
| `step/uc/get-step.uc.test.ts` | 14 | 0 | 14 | 0 |
| `step/uc/get-steps-by-lessons.uc.test.ts` | 8 | 0 | 8 | 0 |
| **Итого** | **442** | **222** | **208** | **12** |

## 2. Закономерности

Счёт — в тестах (`it.each` считается построчно).

### Б-8 — приём/отказ полей платформы, 120 тестов

Самая крупная группа. Две половины: (а) схемы состояния (`*.state.test.ts`) — 54 теста на `F.uuid`, `v.picklist`, `v.object` `required`, `v.integer`/`minValue`; (б) вход/выход Def в UC — 66 тестов, где те же платформенные валидаторы проверяются второй раз, уже через `normalize()`/`valid()` паспорта.

- `step/step.state.test.ts:194` — `it.each(['draft','published','archived'])` приём `picklist`; рядом `:201` отказ «неизвестный статус» — то же правило, вторая строка.
- `lesson/lesson.state.test.ts:117`, `:121`, `:135`, `:139` — отказ `F.uuid` в `stepIds`, `mentorStepIds`, `uuid`, `moduleId`: четыре копии одной платформенной валидации.
- `course/course.state.test.ts:78` — `it.each` на `required` (`moduleIds`, `phases`, `status`, `authorId`): тест падает только при удалении поля из `v.object`.
- `course/uc/get-module-place.uc.test.ts:63` — 6 строк отказа входа `{ moduleId }`; `step/uc/get-step.uc.test.ts:77` — 5 строк отказа формы `StepView`.

Почему бесполезно: `F.uuid`/`picklist`/`required` — код платформы, в модуле нет своей логики, которая могла бы сломаться. Отказ воспроизводится на любой другой схеме, ошибка в модуле выглядит иначе.

### Б-7 — паспорт Def дублирует `arch:check`, 42 теста

32 теста — «паспортные» `it` в десяти файлах `*/uc/*.uc.test.ts` домена (по 2–5 на файл): `normalize(...)` не бросает, `errors`/`input`/`output` совпадают с ожидаемым набором, «входит в паспорт `CourseModuleDef`». Ещё 10 — в `course.module.test.ts` (ошибки агрегатов, `ArchChecker`, `calls`) и `course/course.ar.test.ts:346`, `course/course.state.test.ts:182`, `:192`, `:196`.

- `course/uc/get-course.uc.test.ts:13` — «query над агрегатом курса для user и guest, allowAll, ошибка — курс не найден»: перечисление полей `normalize(GetCourseDef)`, ничего не исполняет.
- `course/uc/get-course.uc.test.ts:54` и такие же `:86`, `:39`, `:62`, `:80`, `:87`, `:52`, `:79`, `:73` — «входит в паспорт `CourseModuleDef`»: один и тот же факт в 9 файлах.
- `course.module.test.ts:65`/`:76`/`:87`/`:98` — «без событий, одна ошибка — `*_NOT_FOUND`»: состав `errors` и `emits` агрегата проверяет `arch:check` (ERR-02/ERR-04, MAN-01/02/06).
- `course.module.test.ts:109`, `:113` — `ArchChecker` на пробе: тот же чекер запускает `arch:check` на реальном `CourseModuleDef`.

Почему бесполезно: `def-checker` (`MAN-02/03/05/06/08/12/13`, `ARC-04/05`, `ERR-02/04`, `DOM-16`) прогоняется в `check` по всем Def; падение «паспортного» теста всегда означает падение `arch:check`. Состав модуля держит `course.module.test.ts:31` — этого достаточно (правило «один тест состава на модуль»).

### Б-1 — правило проверено уровнем ниже и повторено выше, 18 тестов

- `course/course.ar.test.ts:156` — «этапы вместе покрывают программу по порядку без пропусков»: проверяет `PhaseSchema.superRefine`, то есть то же, что `course/course.state.test.ts:217`/`:221`/`:227` (уже принято) — инвариант `superRefine` держит `course/uc/get-course.uc.test.ts:45`, парсящий `view()` курса без этапов.
- `course/course.ar.test.ts:219` — «у курса без этапов `stage` нет»: следствие `moduleIds.indexOf` (Ar), отдельно от `:180`/`:188`/`:197` не даёт ничего.
- `module/module.ar.test.ts:66`, `:71` — те же фикстуры, что `:58` (фильтр `DRAFT` проектов), отличаются только числом элементов.
- `lesson/lesson.ar.test.ts:102`, `lesson-steps.dqs.test.ts:142`, `step/step.ar.test.ts:118` (3 строки) — свёртки: `outline()`, `stepIds()`, `summaryFor()` вызывают уже проверенный `viewFor()`.

### Б-2 — вопрос Ar, заданный через потребителя, 5 тестов

- `course/course.ar.test.ts:85` — «`includesModule` не зависит от статуса»: у `CourseAr` нет ветки по статусу, зависимость проверить нечем.
- `course/course.ar.test.ts:89` — «`startModuleId` — первый модуль программы»: `startModuleId` повторяет первое обращение `moduleIds()`, использованное в `get-module-prerequisite`.
- `course/course.ar.test.ts:94` — `undefined` у пустой программы (см. Б-12).
- `module-courses.dqs.test.ts:144` — `placeOf(A0).isFirst` через DQS, при том что `placeOf` проверен в `course/course.ar.test.ts:180`.
- `lesson-steps.dqs.test.ts:160` — «не меняет вход»: копию `stepIds` держит `lesson/lesson.ar.test.ts:80` (DOM-17).

### Б-12 — пустой вход → пустой выход (константа), 12 тестов

- `course/course.ar.test.ts:122` (пустой курс → `[]`), `:301` (курс без этапов → `[]`) — рядом `:118` (без этапов → `[]`) уже покрывает выход.
- `module-snapshot.dqs.test.ts:123` (модуль без проектов → `[]`), `:283` (урок без шагов → `stepIds: []`), `lesson-steps.dqs.test.ts:68` (пустые входы → `{}`), `module-courses.dqs.test.ts:64` (курсов нет → `undefined`).
- Само правило — «map по пустому массиву даёт пустой массив»; такого класса ошибок в модуле нет.

### Б-11 — тавтология и мёртвый экспорт, 8 тестов

- `content-snapshot-index.test.ts:10`, `:14`, `:18` — `expect(X).toBeDefined()` на реэкспортах `index.ts`.
- `content-snapshot-index.test.ts:22` — «типы доступны» (Б-17): проверяется компилятором в строке импорта самого теста.
- `status.test.ts:6` — «определены статусы `draft`, `published`, `archived`»: перечисление `enum` против литералов.
- `course.module.test.ts:27` — «модуль не внешний» (поле конфигурации `external: false`), `course/course.ar.test.ts:305` — «одно и то же для любого статуса» (в Ar нет ветки по статусу), `lesson/lesson.ar.test.ts:66` (`viewFor(false)` совпадает с `viewFor(true)` у `published`), `module-snapshot.dqs.test.ts:229` (следствие выборки по `lessonIds`).

### Б-6 — копия из соседнего файла / строка таблицы отдельным `it`, 8 тестов

- `module/module.policy.test.ts:30`, `:36`, `:40` — «автор с ролью `STUDENT`», «автор без ролей», «админ-автор»: правило читает роли только для `ADMIN`, ветка авторства от ролей не зависит (`:24` уже её проверяет).
- `course/course.state.test.ts:64`, `:172` — «заголовок из пробелов» рядом с «пустой заголовок»: одно правило `trim().nonEmpty`.
- `step/step.state.test.ts:173` (`описание из пробелов`) — то же, `lesson/lesson.state.test.ts:97`, `module/module.state.test.ts:83` — то же в двух других файлах.

### Б-10, Б-15, Б-13, Б-17 — по 1–3 теста

- `course/course.state.test.ts:277` — «state и инвариант принимают состояние по умолчанию»: тест построителя тестов, не модуля (Б-10).
- `course/course.ar.test.ts:295` — «метки `phases` наружу не выходят (D-64)»: некролог удалённого поля.
- `status.test.ts:12`, `:18` — приём/отказ `StatusSchema`, которую не импортирует никто, кроме `index.ts` (Б-13: мёртвый экспорт).

### TST-09 — тексты `label` не тестируются, 3 теста

- `lesson/lesson.ar.test.ts:111` («Урок не найден»), `step/step.ar.test.ts:127` («Шаг не найден»), `module/module.policy.test.ts:58` («Нет доступа к модулю»).

### Н-1 (новый) — контрактный тест домена дублирует модульный тест того же UC (объясняет 98 кандидатов, учтённых в Б-7 и Б-8, отдельно не считается)

Признак: файл `domain/src/<m>/**/uc/<uc>.uc.test.ts` и файл `modules/<m>/src/**/uc/<uc>.uc.test.ts` проверяют один и тот же Def: там паспорт и схемы, тут — контракт реализации (`INPUT_VALIDATION`, `UNAUTHORIZED`, ошибки UC, реальные данные).

- `step/uc/get-steps-by-lessons.uc.test.ts:43` (4 строки отказа) ↔ модульный `get-steps-by-lessons.uc.test.ts:190` (`INPUT_VALIDATION`).
- `course/uc/get-course-by-module.uc.test.ts:31` («выход: `CourseView` или пусто») ↔ модульный `get-course-by-module.uc.test.ts:55` (модуль вне курсов → пусто).
- `course/uc/get-module-prerequisite.uc.test.ts:57`/`:65` (3 приёма + 6 отказов формы выхода) ↔ модульный `get-module-prerequisite.uc.test.ts:64` (реальный ответ разбирается той же схемой на каждом вызове).

Почему бесполезно: пайплайн UC валидирует вход и выход по схемам Def **на каждом вызове**, поэтому сломанная схема роняет любой успешный модульный тест UC; паспорт собирает `normalize()` в `arch:check`. Ошибка вида «схема не та» не воспроизводится только доменным тестом.
Как появляется: при переносе Def-ов в домен заготовки `gen` остались как тесты; у модуля за время переноса завелись свои контрактные тесты того же UC.

### Н-2 (новый) — `принимает …` без парной строки отказа, 1 тест

Признак: `it('принимает минимальный урок без опциональных полей')` проверяет только успех разбора, тогда как отказ/дефолт того же набора полей нигде не закреплён и в модуле нет ветки по их наличию.

- `lesson/lesson.state.test.ts:75`.

Границу провёл осторожно: соседние приёмочные строки (`course/course.state.test.ts:156`, `lesson/lesson.state.test.ts:60`, `module/module.state.test.ts:66`, `:91`, `:133`, `:139`) — это защита чтения реальных записей из хранилища, они оставлены полезными (§4). Строка `:75` избыточна: базовую запись держит `:60`, а отсутствие `additional`/`estimatedMinutes` не меняет ветку модуля.

## 3. Кандидаты

Пути — от `domain/src/course/`. «Где покрыто» — конкретный `it`, либо «нигде» с причиной. Действия: **удалить** — тест ничего не держит; **слить** — правило остаётся одной строкой таблицы/одним `it` в указанном месте; **переписать** — тест нужен, но не в этой форме.

### `status.test.ts`, `content-snapshot.test.ts`, `content-snapshot-index.test.ts` (16)

| `path:line` | Тест | Б | Где покрыто | Действие |
|---|---|---|---|---|
| `status.test.ts:6` | определены статусы draft, published, archived | Б-11 | нигде: перечисление `enum` против литералов | удалить |
| `status.test.ts:12` | `StatusSchema` пропускает валидные значения | Б-8/Б-13 | нигде: схему не импортирует никто, кроме `index.ts` | удалить (вместе с `status.ts` — см. вопрос 1) |
| `status.test.ts:18` | `StatusSchema` отклоняет невалидные значения | Б-8/Б-13 | то же | удалить |
| `content-snapshot.test.ts:10` | урок: валидный — проходит | Б-8 | `module-snapshot.dqs.test.ts:117` (результат проходит `ContentSnapshotVo`) | удалить |
| `content-snapshot.test.ts:22` | урок: пустой заголовок — падает | Б-8 | нигде: `v.nonEmpty` платформы | удалить |
| `content-snapshot.test.ts:31` | урок: невалидный UUID — падает | Б-8 | нигде: `F.uuid` | удалить |
| `content-snapshot.test.ts:42` | элемент: валидный — проходит | Б-8 | `module-snapshot.dqs.test.ts:117` | удалить |
| `content-snapshot.test.ts:57` | элемент: пустой заголовок проекта — падает | Б-8 | нигде: `v.nonEmpty` | удалить |
| `content-snapshot.test.ts:66` | элемент: невалидный UUID проекта — падает | Б-8 | нигде: `F.uuid` | удалить |
| `content-snapshot.test.ts:77` | массив: пустой — проходит | Б-12 | `module-snapshot.dqs.test.ts:123` (модуль без проектов) | удалить |
| `content-snapshot.test.ts:81` | массив: один элемент — проходит | Б-8 | `module-snapshot.dqs.test.ts:117` | удалить |
| `content-snapshot.test.ts:92` | массив: невалидный элемент — падает | Б-8 | нигде: платформенная композиция `v.array` | удалить |
| `content-snapshot-index.test.ts:10` | `LessonSnapshotSchema` доступна через index | Б-11 | нигде: `toBeDefined` на реэкспорте; держит `tsc` | удалить |
| `content-snapshot-index.test.ts:14` | `ContentSnapshotItemSchema` доступна через index | Б-11 | то же | удалить |
| `content-snapshot-index.test.ts:18` | `ContentSnapshotSchema` доступна через index | Б-11 | то же | удалить |
| `content-snapshot-index.test.ts:22` | `ContentSnapshot`/`ContentSnapshotItem` доступны | Б-17 | нигде: позитивный тест типа, проверяется `tsc` | удалить |

### `course.module.test.ts` (7)

| `path:line` | Тест | Б | Где покрыто | Действие |
|---|---|---|---|---|
| `course.module.test.ts:27` | модуль не внешний | Б-11 | `course.module.test.ts:31` (паспорт того же `CourseModuleDef`) | слить в `:31` |
| `course.module.test.ts:65` | агрегат курса: без событий, одна ошибка | Б-7/Б-9 | `arch:check` (ERR-02/ERR-04, MAN-01); поведение — `modules/course/src/course/uc/get-course.uc.test.ts:96` | удалить |
| `course.module.test.ts:76` | агрегат модуля: без событий, `MODULE_NOT_FOUND` | Б-7/Б-9 | `arch:check`; `modules/course/src/module/uc/get-module-snapshot.uc.test.ts:164` | удалить |
| `course.module.test.ts:87` | агрегат урока: без событий, `LESSON_NOT_FOUND` | Б-7/Б-9 | `arch:check`; `modules/course/src/lesson/uc/get-lesson.uc.test.ts:113` | удалить |
| `course.module.test.ts:98` | агрегат шага: без событий, `STEP_NOT_FOUND` | Б-7/Б-9 | `arch:check`; `modules/course/src/step/uc/get-step.uc.test.ts:134` | удалить |
| `course.module.test.ts:109` | `ArchChecker` — без нарушений | Б-7 | нигде: `arch:check` гоняет тот же чекер на реальном `CourseModuleDef` | удалить |
| `course.module.test.ts:113` | UC вызывается другим модулем по `calls` (D-42) | Б-7 | нигде: проверка платформы (ARC-04/05) на крошечном пробе | удалить |

### `course/course.ar.test.ts` (12)

| `path:line` | Тест | Б | Где покрыто | Действие |
|---|---|---|---|---|
| `course/course.ar.test.ts:85` | `includesModule` не зависит от статуса | Б-2 | `course/course.ar.test.ts:78` (ветки по статусу у `includesModule` нет) | удалить |
| `course/course.ar.test.ts:89` | `startModuleId` — первый модуль программы | Б-2 | `course/course.ar.test.ts:180` (`placeOf` на том же порядке) | удалить |
| `course/course.ar.test.ts:94` | `startModuleId` пустой программы — `undefined` | Б-12 | нигде: `undefined` из `moduleIds()[0]` | удалить |
| `course/course.ar.test.ts:122` | пустой курс — `[]` | Б-12 | `course/course.ar.test.ts:118` («курс без этапов — `[]`») | удалить |
| `course/course.ar.test.ts:156` | этапы вместе покрывают программу без пропусков | Б-1 | `course/course.state.test.ts:217`, `:221`, `:227` (инвариант `superRefine`) + `course/uc/get-course.uc.test.ts:45` | удалить |
| `course/course.ar.test.ts:219` | у курса без этапов `stage` нет | Б-1 | `course/course.ar.test.ts:180`/`:188`/`:197` + `lesson/lesson.ar.test.ts:73` | удалить |
| `course/course.ar.test.ts:246` | модуль первого этапа — `index 0` и `track` | Б-1 | `course/course.ar.test.ts:223` (та же ветка `stages.findIndex`) | слить в `:223` |
| `course/course.ar.test.ts:266` | этапы по одному модулю: место по линейному порядку | Б-1 | `course/course.ar.test.ts:188`/`:197` (`placeOf` на `moduleIds`) | удалить |
| `course/course.ar.test.ts:295` | метки `phases` наружу не выходят (D-64) | Б-15 | нигде: поля `phases` в `CourseView` уже нет | удалить |
| `course/course.ar.test.ts:301` | курс без этапов: `stages = []` | Б-12 | `course/course.ar.test.ts:118` | удалить |
| `course/course.ar.test.ts:305` | одно и то же для любого статуса | Б-11 | нигде: в `view()` нет ветки по статусу (вариант А С1 сам это утверждает) | удалить |
| `course/course.ar.test.ts:346` | агрегат course с тремя статусами, без переходов и событий | Б-7 | `arch:check` (ERR-02/ERR-04); `course.module.test.ts:31` | удалить |

### `course/course.state.test.ts` (25)

| `path:line` | Тест | Б | Где покрыто | Действие |
|---|---|---|---|---|
| `course/course.state.test.ts:43` | принимает курс с этапом (метка с `track`) | Б-1 | `course/course.state.test.ts:160` + `:221` | удалить |
| `course/course.state.test.ts:64` | `it.each`: заголовок из пробелов | Б-6 | `course/course.state.test.ts:64` («пустой заголовок») | слить |
| `course/course.state.test.ts:64` | `it.each`: некорректный uuid | Б-8 | нигде: `F.uuid` | удалить |
| `course/course.state.test.ts:64` | `it.each`: некорректный `authorId` | Б-8 | нигде: `F.uuid` | удалить |
| `course/course.state.test.ts:64` | `it.each`: невалидный статус | Б-8 | нигде: `picklist` | удалить |
| `course/course.state.test.ts:64` | `it.each`: `moduleIds` не uuid | Б-8 | нигде: `F.uuid` в `v.array` | удалить |
| `course/course.state.test.ts:64` | `it.each`: программа не массив | Б-8 | нигде: тип `v.array` | удалить |
| `course/course.state.test.ts:78` | `it.each` 4 строки: нет `moduleIds`/`phases`/`status`/`authorId` | Б-8 | нигде: `required` платформы | удалить |
| `course/course.state.test.ts:86` | `it.each` 3 строки: статус допустим | Б-8 | нигде: `picklist` | удалить |
| `course/course.state.test.ts:160` | принимает метку с `track` | Б-1 | `course/course.state.test.ts:166` + `:43` | слить в `:156` |
| `course/course.state.test.ts:172` | `it.each`: заголовок из пробелов | Б-6 | `course/course.state.test.ts:172` («пустой заголовок») | слить |
| `course/course.state.test.ts:172` | `it.each`: `fromModuleId` не uuid | Б-8 | нигде: `F.uuid` | удалить |
| `course/course.state.test.ts:172` | `it.each`: нет `fromModuleId` | Б-8 | нигде: `required` | удалить |
| `course/course.state.test.ts:172` | `it.each`: модули вместо метки | Б-8 | нигде: тип `v.object` | удалить |
| `course/course.state.test.ts:182` | у метки нет идентичности и дат (DOM-13) | Б-7 | `arch:check` (MAN-03: `v.object` без `entityModel`-полей) | удалить |
| `course/course.state.test.ts:192` | `normalize(CourseArDef)` не бросает | Б-7 | `arch:check` (MAN-03) | удалить |
| `course/course.state.test.ts:196` | инварианты программы не в `state` | Б-7 | `arch:check` (MAN-03: `check` не переводится в JSON Schema — это и есть причина) | удалить |
| `course/course.state.test.ts:245` | два этапа на одном модуле — отказ | Б-1 | `course/course.state.test.ts:239` (монотонность меток) — тот же `superRefine` | слить в `:239` |
| `course/course.state.test.ts:264` | разные заголовки этапов принимаются | Б-12 | `course/course.state.test.ts:221`, `:227` (уже приняты) | удалить |
| `course/course.state.test.ts:277` | state и инвариант принимают состояние по умолчанию | Б-10 | нигде: тест дефолта построителя | удалить |

### `course/uc/*.uc.test.ts` — паспортные (32)

| `path:line` | Тест | Б | Где покрыто | Действие |
|---|---|---|---|---|
| `course/uc/get-course.uc.test.ts:13` | query для user и guest, allowAll, ошибка — курс не найден | Б-7 | `course.module.test.ts:31` + `arch:check` (MAN-02/06, ERR-04); поведение — `modules/course/src/course/uc/get-course.uc.test.ts:108` | удалить |
| `course/uc/get-course.uc.test.ts:24` | ошибка `COURSE_NOT_FOUND` — `not_found` с `courseId` | Б-7 | `modules/course/src/course/uc/get-course.uc.test.ts:96` | удалить |
| `course/uc/get-course.uc.test.ts:54` | входит в паспорт `CourseModuleDef` | Б-7 | `course.module.test.ts:31` | удалить |
| `course/uc/get-course-by-module.uc.test.ts:13` | паспорт query (user, guest, allowAll) | Б-7 | `course.module.test.ts:31` + `arch:check` | удалить |
| `course/uc/get-course-by-module.uc.test.ts:39` | входит в паспорт `CourseModuleDef` | Б-7 | `course.module.test.ts:31` | удалить |
| `course/uc/get-course-enrollment.uc.test.ts:10` | паспорт query без ограничений | Б-7 | `course.module.test.ts:31` + `arch:check` | удалить |
| `course/uc/get-courses-including-module.uc.test.ts:10` | паспорт query без ограничений | Б-7 | то же | удалить |
| `course/uc/get-courses-starting-with-module.uc.test.ts:10` | паспорт query без ограничений | Б-7 | то же | удалить |
| `course/uc/get-module-enrollment.uc.test.ts:9` | паспорт query без ограничений | Б-7 | то же | удалить |
| `course/uc/get-module-place.uc.test.ts:13` | паспорт query без ограничений | Б-7 | то же | удалить |
| `course/uc/get-module-place.uc.test.ts:80` | входит в паспорт `CourseModuleDef` | Б-7 | `course.module.test.ts:31` | удалить |
| `course/uc/get-module-prerequisite.uc.test.ts:16` | паспорт query (system, allowAll) | Б-7 | `course.module.test.ts:31` + `arch:check` | удалить |
| `course/uc/get-module-prerequisite.uc.test.ts:49` | у каждого поля входа есть описание (MAN-02) | Б-7 | `arch:check` (MAN-02) | удалить |
| `course/uc/get-module-prerequisite.uc.test.ts:81` | JSON Schema выхода строится (Т9) | Б-7 | `arch:check` (MAN-03) | удалить |
| `course/uc/get-module-prerequisite.uc.test.ts:86` | входит в паспорт `CourseModuleDef` | Б-7 | `course.module.test.ts:31` | удалить |
| `course/uc/get-same-modules.uc.test.ts:10` | паспорт query без ограничений | Б-7 | `course.module.test.ts:31` + `arch:check` | удалить |
| `course/uc/list-courses.uc.test.ts:13` | паспорт query (user, guest, allowAll) | Б-7 | то же | удалить |
| `course/uc/list-courses.uc.test.ts:47` | у каждого поля входа есть описание (MAN-02) | Б-7 | `arch:check` (MAN-02) | удалить |
| `course/uc/list-courses.uc.test.ts:62` | входит в паспорт `CourseModuleDef` | Б-7 | `course.module.test.ts:31` | удалить |
| `lesson/uc/get-lesson.uc.test.ts:33` | паспорт query (user, guest, allowAll, ошибка) | Б-7 | `course.module.test.ts:31` + `arch:check`; поведение — `modules/course/src/lesson/uc/get-lesson.uc.test.ts:169` | удалить |
| `lesson/uc/get-lesson.uc.test.ts:44` | ошибка `LESSON_NOT_FOUND` — своя | Б-7 | `modules/course/src/lesson/uc/get-lesson.uc.test.ts:113` | удалить |
| `lesson/uc/get-lesson.uc.test.ts:73` | `LessonView`: у полей есть описание (MAN-02) | Б-7 | `arch:check` (MAN-02) | удалить |
| `lesson/uc/get-lesson.uc.test.ts:79` | входит в паспорт `CourseModuleDef` | Б-7 | `course.module.test.ts:31` | удалить |
| `module/uc/get-module-snapshot.uc.test.ts:32` | паспорт query (user, guest, system, ошибка) | Б-7 | `course.module.test.ts:31` + `arch:check`; поведение — `modules/course/src/module/uc/get-module-snapshot.uc.test.ts:240` | удалить |
| `module/uc/get-module-snapshot.uc.test.ts:43` | ошибка `MODULE_NOT_FOUND` — `not_found` | Б-7 | `modules/course/src/module/uc/get-module-snapshot.uc.test.ts:164` | удалить |
| `module/uc/get-module-snapshot.uc.test.ts:65` | `ContentSnapshotVo`: описание полей (MAN-02) | Б-7 | `arch:check` (MAN-02) | удалить |
| `module/uc/get-module-snapshot.uc.test.ts:73` | входит в паспорт `CourseModuleDef` | Б-7 | `course.module.test.ts:31` | удалить |
| `step/uc/get-step.uc.test.ts:30` | паспорт query (user, guest, allowAll, две ошибки) | Б-7 | `course.module.test.ts:31` + `arch:check`; поведение — `modules/course/src/step/uc/get-step.uc.test.ts:181` | удалить |
| `step/uc/get-step.uc.test.ts:41` | `STEP_NOT_FOUND` своя, `MODULE_NOT_FOUND` по ссылке (ERR-03) | Б-7 | `modules/course/src/step/uc/get-step.uc.test.ts:134` | удалить |
| `step/uc/get-step.uc.test.ts:87` | входит в паспорт `CourseModuleDef` | Б-7 | `course.module.test.ts:31` | удалить |
| `step/uc/get-steps-by-lessons.uc.test.ts:15` | паспорт query (user, guest, allowAll) | Б-7 | то же | удалить |
| `step/uc/get-steps-by-lessons.uc.test.ts:52` | входит в паспорт `CourseModuleDef` | Б-7 | `course.module.test.ts:31` | удалить |

### `course/uc/*.uc.test.ts` — схемы входа/выхода (66)

| `path:line` | Тест | Б | Где покрыто | Действие |
|---|---|---|---|---|
| `course/uc/get-course.uc.test.ts:37` | вход — `{ courseId }` uuid | Б-8 | `modules/course/src/course/uc/get-course.uc.test.ts:104` (`INPUT_VALIDATION`) | удалить |
| `course/uc/get-course-by-module.uc.test.ts:24` | вход — `{ moduleId }` uuid | Б-8 | `modules/course/src/course/uc/get-course-by-module.uc.test.ts:95` | удалить |
| `course/uc/get-course-by-module.uc.test.ts:31` | выход — `CourseView` или пусто | Б-8 | `modules/course/src/course/uc/get-course-by-module.uc.test.ts:55` | удалить |
| `course/uc/get-course-enrollment.uc.test.ts:21` | вход — uuid курса | Б-8 | `modules/course/src/course/uc/get-course-enrollment.uc.test.ts:84` | удалить |
| `course/uc/get-courses-including-module.uc.test.ts:21` | вход — uuid модуля и кандидатов | Б-8 | `modules/course/src/course/uc/get-courses-including-module.uc.test.ts:112` | удалить |
| `course/uc/get-courses-including-module.uc.test.ts:35` | выход — uuid курсов | Б-8 | там же `:35` (реальный ответ) | удалить |
| `course/uc/get-courses-starting-with-module.uc.test.ts:21` | вход — uuid модуля и кандидатов | Б-8 | `modules/course/src/course/uc/get-courses-starting-with-module.uc.test.ts:161` | удалить |
| `course/uc/get-courses-starting-with-module.uc.test.ts:31` | выход — uuid курсов | Б-8 | там же `:52` | удалить |
| `course/uc/get-module-enrollment.uc.test.ts:20` | вход — uuid модуля | Б-8 | `modules/course/src/course/uc/get-module-enrollment.uc.test.ts:86` | удалить |
| `course/uc/get-module-enrollment.uc.test.ts:26` | `it.each([true,false])` выход — `enrollable %s` | Б-8 | там же `:35`/`:41` | удалить |
| `course/uc/get-module-place.uc.test.ts:24` | вход — `{ moduleId }` uuid | Б-8 | `modules/course/src/course/uc/get-module-place.uc.test.ts:125` | удалить |
| `course/uc/get-module-place.uc.test.ts:31` | выход: место без соседей и этапа | Б-8 | там же `:56` (реальный ответ) | удалить |
| `course/uc/get-module-place.uc.test.ts:36` | выход: место со всеми необязательными полями | Б-8 | там же `:56` | удалить |
| `course/uc/get-module-place.uc.test.ts:48` | выход: `stage` без `track` допустим | Б-8 | там же `:56` + `course/course.ar.test.ts:237` | удалить |
| `course/uc/get-module-place.uc.test.ts:59` | выход: пусто (модуль вне опубликованных) | Б-8 | там же `:50` | удалить |
| `course/uc/get-module-place.uc.test.ts:63` | `it.each` 6 строк: отказ входа | Б-8 | там же `:125` (`INPUT_VALIDATION`) | удалить |
| `course/uc/get-module-prerequisite.uc.test.ts:27` | вход — uuid модуля и пройденные | Б-8 | `modules/course/src/course/uc/get-module-prerequisite.uc.test.ts:89` | удалить |
| `course/uc/get-module-prerequisite.uc.test.ts:37` | `it.each` 5 строк: отказ входа | Б-8 | там же `:95` (`INPUT_VALIDATION`) | удалить |
| `course/uc/get-module-prerequisite.uc.test.ts:57` | `it.each` 3 строки: выход валиден | Б-8 | там же `:64` (реальный ответ) | удалить |
| `course/uc/get-module-prerequisite.uc.test.ts:65` | `it.each` 6 строк: отказ формы выхода | Б-8 | нигде: `v.variant` платформы (см. вопрос 4) | удалить |
| `course/uc/get-same-modules.uc.test.ts:21` | вход — uuid модуля и кандидатов | Б-8 | `modules/course/src/course/uc/get-same-modules.uc.test.ts:66` | удалить |
| `course/uc/get-same-modules.uc.test.ts:31` | выход — uuid модулей | Б-8 | там же `:29` | удалить |
| `course/uc/list-courses.uc.test.ts:24` | вход: все поля необязательны | Б-8 | `modules/course/src/course/uc/list-courses.uc.test.ts:73` | удалить |
| `course/uc/list-courses.uc.test.ts:37` | `it.each` 5 строк: отказ входа | Б-8 | там же `:125` (`INPUT_VALIDATION`) | удалить |
| `lesson/uc/get-lesson.uc.test.ts:50` | вход — uuid урока | Б-8 | `modules/course/src/lesson/uc/get-lesson.uc.test.ts:179` | удалить |
| `lesson/uc/get-lesson.uc.test.ts:58` | выход — снимок урока | Б-8 | там же `:77` | удалить |
| `module/uc/get-module-snapshot.uc.test.ts:49` | вход — uuid модуля | Б-8 | `modules/course/src/module/uc/get-module-snapshot.uc.test.ts:240` | удалить |
| `module/uc/get-module-snapshot.uc.test.ts:56` | выход — снимок `{ projectId, lessons }` | Б-8 | там же `:70` | удалить |
| `step/uc/get-step.uc.test.ts:47` | вход — uuid шага | Б-8 | `modules/course/src/step/uc/get-step.uc.test.ts:191` | удалить |
| `step/uc/get-step.uc.test.ts:55` | `it.each` 5 строк: приём формы `StepView` | Б-8 | `step/step.state.test.ts:81`/`:96`/`:112` + `step/step.ar.test.ts:60`/`:75`/`:81` | удалить |
| `step/uc/get-step.uc.test.ts:77` | `it.each` 5 строк: отказ формы `StepView` | Б-8 | `step/step.state.test.ts:128`/`:136`/`:157`/`:161` (`kind` ⇒ обязательные поля) | удалить |
| `step/uc/get-steps-by-lessons.uc.test.ts:26` | вход — список uuid уроков, в т. ч. пустой | Б-8 | `modules/course/src/step/uc/get-steps-by-lessons.uc.test.ts:186` | удалить |
| `step/uc/get-steps-by-lessons.uc.test.ts:36` | выход — запись «урок → шаги» | Б-8 | там же `:51` | удалить |
| `step/uc/get-steps-by-lessons.uc.test.ts:43` | `it.each` 4 строки: отказ входа | Б-8 | там же `:190` (`INPUT_VALIDATION`) | удалить |

### `lesson/lesson.ar.test.ts`, `lesson/lesson.state.test.ts` (19)

| `path:line` | Тест | Б | Где покрыто | Действие |
|---|---|---|---|---|
| `lesson/lesson.ar.test.ts:66` | те же поля у published и без права | Б-11 | `lesson/lesson.ar.test.ts:36` + `:46` | удалить |
| `lesson/lesson.ar.test.ts:102` | `stepIds` в порядке урока; пустой — `[]` | Б-1 | `lesson/lesson.ar.test.ts:73` (тот же `stepIds()`) | удалить |
| `lesson/lesson.ar.test.ts:111` | `LESSON_NOT_FOUND` — `not_found`, «Урок не найден» | TST-09 | `modules/course/src/lesson/uc/get-lesson.uc.test.ts:113` (текст не проверяется) | переписать: оставить `kind`, текст убрать |
| `lesson/lesson.state.test.ts:97` | отклоняет заголовок из пробелов | Б-6 | `lesson/lesson.state.test.ts:93` (одно правило `trim().nonEmpty`) | слить в `:93` |
| `lesson/lesson.state.test.ts:101` | отклоняет отрицательный `estimatedMinutes` | Б-8/Б-12 | `lesson/lesson.state.test.ts:105` (минимум 1) | удалить |
| `lesson/lesson.state.test.ts:109` | отклоняет дробный `estimatedMinutes` | Б-8 | нигде: `v.integer` платформы | удалить |
| `lesson/lesson.state.test.ts:113` | принимает `estimatedMinutes = 1` | Б-12 | `lesson/lesson.state.test.ts:105` (граница проверена отказом) | удалить |
| `lesson/lesson.state.test.ts:117` | отклоняет невалидный UUID в `stepIds` | Б-8 | нигде: `F.uuid` | удалить |
| `lesson/lesson.state.test.ts:121` | отклоняет невалидный UUID в `mentorStepIds` | Б-8 | нигде: `F.uuid` | удалить |
| `lesson/lesson.state.test.ts:125` | отклоняет запись без `stepIds` | Б-8 | нигде: `required` | удалить |
| `lesson/lesson.state.test.ts:130` | отклоняет запись без `mentorStepIds` | Б-8 | нигде: `required` | удалить |
| `lesson/lesson.state.test.ts:135` | отклоняет некорректный uuid урока | Б-8 | нигде: `F.uuid` | удалить |
| `lesson/lesson.state.test.ts:139` | отклоняет некорректный `moduleId` | Б-8 | нигде: `F.uuid` | удалить |
| `lesson/lesson.state.test.ts:143` | отклоняет запись без `moduleId` | Б-8 | нигде: `required` | удалить |
| `lesson/lesson.state.test.ts:148` | `it.each` 3 строки: статус допустим | Б-8 | нигде: `picklist` | удалить |
| `lesson/lesson.state.test.ts:155` | отклоняет неизвестный статус | Б-8 | нигде: `picklist` | удалить |
| `lesson/lesson.state.test.ts:75` | принимает минимальный урок без опциональных полей | Н-2 | `lesson/lesson.state.test.ts:60` (базовая запись) | удалить |

### DQS (11)

| `path:line` | Тест | Б | Где покрыто | Действие |
|---|---|---|---|---|
| `lesson-steps.dqs.test.ts:68` | пустые входы — пустой объект | Б-12 | `lesson-steps.dqs.test.ts:133` (тот же `items.length > 0`) | удалить |
| `lesson-steps.dqs.test.ts:142` | урок с пустым `stepIds` не попадает | Б-1 | `lesson-steps.dqs.test.ts:133` | удалить |
| `lesson-steps.dqs.test.ts:160` | не меняет вход: `stepIds` прежние | Б-2 | `lesson/lesson.ar.test.ts:80` (копия из Ar, DOM-17) | удалить |
| `module-courses.dqs.test.ts:54` | черновой курс находится | Б-6 | `module-courses.dqs.test.ts:49` + `:68` (статус не читается) | удалить |
| `module-courses.dqs.test.ts:64` | курсов нет — `undefined` | Б-12 | `module-courses.dqs.test.ts:59` (нет совпадения → `undefined`) | удалить |
| `module-courses.dqs.test.ts:144` | первый модуль первого опубликованного курса — `isFirst` | Б-2 | `course/course.ar.test.ts:180` (`placeOf`) | удалить |
| `module-prerequisite.dqs.test.ts:99` | название берётся у записи предыдущего модуля | Б-1 | `module-prerequisite.dqs.test.ts:83` (уже проверяет название предыдущего) | слить в `:83` |
| `module-prerequisite.dqs.test.ts:124` | модулей нет вовсе — `closed` | Б-12 | `module-prerequisite.dqs.test.ts:119` (`find` → `undefined`) | удалить |
| `module-snapshot.dqs.test.ts:123` | модуль без проектов — `[]` | Б-12 | `module-snapshot.dqs.test.ts:203` (пустой `lessons` у проекта) + `:127` | удалить |
| `module-snapshot.dqs.test.ts:229` | урок вне проектов модуля не попадает | Б-11 | `module-snapshot.dqs.test.ts:165` (выборка идёт по `lessonIds`) | удалить |
| `module-snapshot.dqs.test.ts:283` | урок без шагов — `stepIds` пустой | Б-12 | `module-snapshot.dqs.test.ts:93` (формат) + `:127` | удалить |

### `module/*` (19)

| `path:line` | Тест | Б | Где покрыто | Действие |
|---|---|---|---|---|
| `module/module.ar.test.ts:66` | «студент не видит DRAFT проект» — 0 проектов | Б-1 | `module/module.ar.test.ts:58` (тот же фильтр) | удалить |
| `module/module.ar.test.ts:71` | фильтрует только корневые проекты | Б-1 | `module/module.ar.test.ts:58` (те же данные, другая формулировка) | удалить |
| `module/module.ar.test.ts:197` | модуль без проектов — `[]` | Б-12 | `module/module.ar.test.ts:201` (`[]` после фильтра) | удалить |
| `module/module.ar.test.ts:206` | статус модуля не фильтрует | Б-1 | `module-snapshot.dqs.test.ts:135` (то же правило на уровне DQS) | удалить |
| `module/module.ar.test.ts:213` | представление без `version` не проходит схему | Б-8 | `module/module.ar.test.ts:225` (JSON Schema требует `version`) | слить в `:225` |
| `module/module.ar.test.ts:220` | представление с `version` проходит | Б-8 | `module/module.ar.test.ts:103` (реальное представление с `version`) | удалить |
| `module/module.policy.test.ts:30` | автор-студент — allowed | Б-6 | `module/module.policy.test.ts:24` (авторство по `uuid`, роли не читаются) | удалить |
| `module/module.policy.test.ts:36` | автор без ролей — allowed | Б-6 | `module/module.policy.test.ts:24` | удалить |
| `module/module.policy.test.ts:40` | админ-автор — allowed | Б-6 | `module/module.policy.test.ts:18` + `:24` (`anyOf` уже покрыт обеими ветками) | удалить |
| `module/module.policy.test.ts:58` | студент — denied с текстом «Нет доступа к модулю» | TST-09/Б-1 | `module/module.policy.test.ts:46` (denied), текст не тестируется | переписать: оставить `denied`, текст убрать |
| `module/module.state.test.ts:70` | отклоняет объект без `projects` | Б-8 | нигде: `required` | удалить |
| `module/module.state.test.ts:83` | отклоняет заголовок из пробелов | Б-6 | `module/module.state.test.ts:79` | слить в `:79` |
| `module/module.state.test.ts:108` | отклоняет некорректный uuid | Б-8 | нигде: `F.uuid` | удалить |
| `module/module.state.test.ts:112` | отклоняет некорректный `authorId` | Б-8 | нигде: `F.uuid` | удалить |
| `module/module.state.test.ts:116` | `it.each` 3 строки: статус допустим | Б-8 | нигде: `picklist` | удалить |
| `module/module.state.test.ts:123` | отклоняет неизвестный статус | Б-8 | нигде: `picklist` | удалить |
| `module/module.state.test.ts:156` | отклоняет некорректный uuid урока в `lessonIds` | Б-8 | нигде: `F.uuid` в `v.array` | удалить |

### `step/step.ar.test.ts`, `step/step.state.test.ts` (14)

| `path:line` | Тест | Б | Где покрыто | Действие |
|---|---|---|---|---|
| `step/step.ar.test.ts:90` | виды шага видны и без права, если опубликованы | Б-1 | `step/step.ar.test.ts:46` (ветка по `kind` отсутствует) | удалить |
| `step/step.ar.test.ts:118` | `it.each` 3 строки: `%s` с правом — виден | Б-1 | `step/step.ar.test.ts:54` (все статусы видны при праве) + `:103` | удалить |
| `step/step.ar.test.ts:127` | `STEP_NOT_FOUND` — `not_found`, «Шаг не найден» | TST-09 | `modules/course/src/step/uc/get-step.uc.test.ts:134` | переписать: оставить `kind` |
| `step/step.state.test.ts:81` | принимает text-шаг | Б-1 | `step/step.state.test.ts:64` (та же ветка `variant`) | удалить |
| `step/step.state.test.ts:173` | отклоняет описание из пробелов | Б-6 | `step/step.state.test.ts:167` | слить в `:167` |
| `step/step.state.test.ts:184` | отклоняет некорректный uuid шага | Б-8 | нигде: `F.uuid` | удалить |
| `step/step.state.test.ts:188` | отклоняет некорректный `moduleId` | Б-8 | нигде: `F.uuid` | удалить |
| `step/step.state.test.ts:194` | `it.each` 3 строки: статус допустим | Б-8 | нигде: `picklist` | удалить |
| `step/step.state.test.ts:201` | отклоняет неизвестный статус | Б-8 | нигде: `picklist` | удалить |

## 4. Полезные тесты

- `status.test.ts` — 0 тестов полезны (весь файл в кандидатах).
- `content-snapshot.test.ts` — 0 полезных (схема — платформа).
- `content-snapshot-index.test.ts` — 0 полезных (реэкспорты держит `tsc`).
- `course.module.test.ts` — 1 тест, полезен: `:31` держит состав модуля (`dependsOn: ['user']`, 4 агрегата, 16 Def UC) — падает при добавлении/удалении UC, это нужный сторож.
- `course/course.ar.test.ts` — 34 теста, полезны: защищают инварианты программы (порядок меток, покрытие без пропусков — 7 строк `:38`), `isPublished`, `viewFor` по трём статусам, `view()`/`state()` (даты числами, копии DOM-17, ключи `CourseView`, обязательный `version`), `placeOf` (первый/средний/последний/единственный/вне программы), `stages()` и `stageOf` через границу этапов, `phases` наружу не выходят.
- `course/course.state.test.ts` — 24 теста, полезны: собственная логика схемы — обрезка `trimmed`, непустые заголовок/описание, метка этапа (`fromModuleId` в программе, порядок, первая метка на первом модуле, уникальность заголовков, отказ «`moduleIds` + `fromModuleId`»), повтор модуля в программе, чтение боевых дат (`ISO` без секунд, `updatedAt` по умолчанию, числа) — §6: не трогать.
- `course/uc/get-course.uc.test.ts` — 1 тест, полезен: `:45` — единственная проверка, что выход UC отдаёт именно общий `CourseView` (D-64), в т. ч. курс без этапов.
- `course/uc/get-course-by-module.uc.test.ts` — 0 полезных.
- `course/uc/get-course-enrollment.uc.test.ts` — 1 тест, полезен: `:27` — межпольная связка выхода «`enrollable: true` ⇒ есть `startModuleId`»; нигде больше не проверяется.
- `course/uc/get-courses-including-module.uc.test.ts` — 0 полезных.
- `course/uc/get-courses-starting-with-module.uc.test.ts` — 0 полезных.
- `course/uc/get-module-enrollment.uc.test.ts` — 0 полезных.
- `course/uc/get-module-place.uc.test.ts` — 0 полезных.
- `course/uc/get-module-prerequisite.uc.test.ts` — 0 полезных.
- `course/uc/get-same-modules.uc.test.ts` — 0 полезных.
- `course/uc/list-courses.uc.test.ts` — 1 тест, полезен: `:53` — выход `listCourses` объявлен как массив `CourseView` (связка с общим контрактом).
- `lesson/lesson.ar.test.ts` — 14 тестов, полезны: `isPublished` по статусам, `moduleId` (связь DOM-04), `viewFor`/`outline` по трём статусам и праву (три ветки), представление = состояние (даты числами, `version`), копия наружу (DOM-17), ключи `outline` («и только они»).
- `lesson/lesson.state.test.ts` — 7 тестов, полезны: три теста дат (`ISO` без секунд, фолбэк `updatedAt`, числа — §6), базовая валидная запись `:60`, требовательность заголовка `:93`, обрезка заголовка `:88`, `estimatedMinutes` минимум `:105`.
- `lesson-steps.dqs.test.ts` — 10 тестов, полезны: состав ответа (`uuid`+`description`), ключ `lessonId` на каждый урок, порядок по `stepIds`, пропуск «шага нет», пропуск модуля вне `canSee`, `canSee=false` (draft/archived), `canSee=true`, шаги разных модулей, урок без видимых шагов, видимость урока не проверяется.
- `lesson/uc/get-lesson.uc.test.ts` — 0 полезных.
- `module-courses.dqs.test.ts` — 18 тестов, полезны: правило `firstIncluding` (порядок файла, перенос, фикстурный случай С2 в двух вариантах), `firstPublishedIncluding` (фильтр статуса, «правила расходятся», С2), `startsPublishedCourse` (порядок, обратный порядок, неопубликованный курс не участвует).
- `module/module.ar.test.ts` — 21 тест, полезны: `isPublished`, авторство по `uuid`, `viewFor` по трём статусам (проекты отфильтрованы), `draft`/`archived` видны целиком, представление = состояние, ключи `summary` («и только они»), проекты без тегов, `publishedOutline` (проект, фильтр по трём статусам, порядок проектов и `lessonIds`), `[]` без опубликованных, JSON Schema требует `version` (MAN-03).
- `module/module.policy.test.ts` — 5 тестов, полезны: `админ не автор`, `автор MENTOR`, `ментор не автор`, `ментор с ролью AUTHOR, но чужой`, `гость`.
- `module/module.state.test.ts` — 13 тестов, полезны: три теста дат (§6), база `:66`, пустой `projects`, заголовок/описание, опциональные поля `:91`, валидный проект, проект с пустым `lessonIds`, опциональные `goal`/`result`/`additional`, пустой заголовок проекта, вложенная сущность без дат (`:163` — сторож DOM-13, см. вопрос 6).
- `module-prerequisite.dqs.test.ts` — 16 тестов, полезны: все ветки вердикта (курса нет, входной модуль, предыдущий пройден, порядок проверок, отказ, `closed` без названия), поиск предыдущего через границу этапов (в двух направлениях), линейный порядок курса без этапов, «пройден другой модуль», первый в порядке файла, статус курса не важен, курсы без модуля пропускаются.
- `module-snapshot.dqs.test.ts` — 16 тестов, полезны: фильтр по статусу проекта и урока (draft/archived), формат снимка, `ContentSnapshotVo` (единственное, что держит схему снимка), проект без уроков, статус модуля не фильтрует, порядок проектов/уроков/`stepIds`, lesson пропавшего `lessonId`, «все уроки не опубликованы», урок в двух проектах, `stepIds` без фильтра статусов.
- `module/uc/get-module-snapshot.uc.test.ts` — 0 полезных.
- `step/step.ar.test.ts` — 16 тестов, полезны: `isPublished`, `moduleId`, `viewFor` по трём статусам и праву, представления `text`/`code`/`file` (даты числами, `version`), ключи `summary` («и только они»), `draft`/`archived` без права.
- `step/step.state.test.ts` — 24 теста, полезны: три теста дат, `variant` по `kind` (`it.each` `:64`), опциональные поля по каждому виду (`language`, `content`, `description`), нулевой размер файла, обязательные `code`/`file`, отрицательный размер, имя файла и MIME, невалидный `kind`, пустое описание, обрезка описания.
- `step/uc/get-step.uc.test.ts` — 0 полезных.
- `step/uc/get-steps-by-lessons.uc.test.ts` — 0 полезных.

## 5. Открытые вопросы

1. **`status.ts` — мёртвый код?** `Status`/`StatusSchema` не импортирует никто, кроме `domain/src/course/index.ts`; после удаления `status.test.ts` (3 теста) схема останется без единого потребителя. Варианты: (а) удалить `Status`/`StatusSchema` и реэкспорт из `index.ts` (рекомендую — модуль не публикует лишнего, Б-13); (б) оставить код, тесты удалить. Правка `index.ts` — вне области инвентаря, решать оркестратору.
2. **Судьба `content-snapshot.ts` после чистки.** Остаётся единственная проверка — `module-snapshot.dqs.test.ts:117` (`ContentSnapshotVo`). Варианты: (а) так и оставить (рекомендую: схема выходного контракта DQS, держится реальным результатом); (б) запретить удаление и оставить по одной строке приёма/отказа на схему.
3. **Удаление 32 паспортных тестов UC в домене.** После чистки состав Def-ов в домене не проверяется ничем, кроме `arch:check` и `course.module.test.ts:31`. Варианты: (а) удалить все (рекомендую — правило «один тест состава на модуль»); (б) оставить один «def-смоук» на домен (например, `course/uc/get-course.uc.test.ts:13`) и удалить остальные 31.
4. **Форма выхода UC с `variant`** (`ModulePlace`, `ModulePrerequisite`, `StepView`) держится только модульными тестами и валидацией пайплайна: отказ по ветке (например, `reason: 'previous-not-passed'` без `title`) нигде больше не проверяется. Оставить ли по одному тесту отказа формы выхода на UC? Рекомендую оставить для `get-module-prerequisite` (межпольная связка `reason` ⇒ `title`), остальные удалить.
5. **Тесты, закрепляющие состав, падают при добавлении элемента.** `course.module.test.ts:31` (16 Def UC — оставляем), `course/course.ar.test.ts:311` (ключи `CourseView`), `course/course.state.test.ts:182` (`PhaseVo` «и только они»), `module/module.ar.test.ts:116`. Оставляем как сторожа контракта или ослабляем до «нужные поля есть»?
6. **Дубль инварианта программы.** `course/course.ar.test.ts:38` (7 строк `it.each`) проверяет то же, что `course/course.state.test.ts:217`–`:270` (7 отдельных `it`) — инвариант живёт в `state`, а Ar переносит его без изменений. §6 запрещает трогать чтение `courses.json`, но `superRefine` — не чтение. Рекомендую оставить только `course.state` (со стороны Ar — один позитивный тест), решение — за оркестратором.
7. **Порядок чистки.** `course.state.test.ts` (25) и `lesson/step.state` (24) дадут максимум после «слияния в таблицы» (Б-8): при удалении построчно теряются имена сценариев отказа. Делать таблицами «валидно/невалидно» на схему (правило 3 задания) — согласовать как отдельный шаг среза, а не как часть механического удаления.
