# Удаление тестов домена `course` — таблица

Трек `course-dmg_20261105`, фаза Ф8. Источник кандидатов — `inventory/course-domain.md`
(442 теста в 31 файле, 220 кандидатов). Только чтение: код и тесты не менялись.
Базовая линия: `cd domain && bun test src/course` → **442 pass, 0 fail**.

Колонка «файл» — путь от корня репо; «строка» — строка объявления `it(`/`test(`/`it.each(` в текущем коде (для `it.each` кейсы перечислены отдельными строками с той же строкой объявления). «где покрыто» — путь от корня репо и **строка начала** теста, который после этой таблицы остаётся (сам он этой таблицей не удаляется); «нигде» — только для Б-9/Б-11/Б-12/Б-13/Б-15/Б-17.

## Применённые решения

1. **Б-8**: приём/отказ полей платформы (`F.uuid`, `picklist`, `variant`, `required`, `v.array`) удаляются — их держат платформенные тесты (`node_modules/dmg-core/src/kernel/fields/fields.test.ts:31`, `:41`, `:57`, `:137`, `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` — `INPUT_VALIDATION`, `:264` — `OUTPUT_VALIDATION`). Своя логика схем остаётся: `trim()`-требования, отказ прежней формы записи (`course/course.state.test.ts:95`), чтение боевых дат (§6).
2. **Б-7**: паспорта Def (`normalize()`, `ArchChecker`, `errors`/`emits`/`calls`, MAN-02) удаляются — их держат `arch:check` (`node_modules/dmg-core/src/arch/def-checker.test.ts:193`, `:219`, `:230`, `:340`, `:426`) и единственный тест состава модуля `domain/src/course/course.module.test.ts:31` (`dependsOn`, 4 агрегата, 16 Def UC).
3. **TST-09**: `label`/`denyMessage` не тестируются — три теста «переписать» без текста; остальных проверок `label` в домене нет (см. раздел ниже).
4. **Б-1/Б-2**: правило проверяет владелец (Ar / DQS / Policy / инвариант `superRefine`); у UC домена не остаётся ничего — `domain/src/course/*/uc/*.uc.test.ts` (14 файлов) удаляются целиком, собственная логика схем переносится в тесты модуля.
5. **Б-13**: `status.ts` — `StatusSchema` не имеет потребителей (только `domain/src/course/index.ts:49` и сам тест) → «удалить с кодом»; `Status` остаётся — см. «Вне границ среза».
6. **Слияния** — не отдельный шаг: строки таблиц «валидно/невалидно» той же схемы (перечень — раздел «Слить»). 7 из 9 сливаемых кейсов переезжают отдельной строкой `it.each` (+1 тест), 2 поглощаются существующим `it` новым `expect` (счёт не меняется).

## Таблица

| файл | строка | тест | Б | действие | где покрыто |
|---|---:|---|---|---|---|
| `domain/src/course/status.test.ts` | 6 | определены статусы draft, published, archived | Б-11 | удалить | «нигде»: перечисление `enum` против литералов — набор держит `tsc`, статусы проверяются тестами Ar |
| `domain/src/course/status.test.ts` | 12 | `StatusSchema` пропускает валидные значения | Б-13/Б-8 | удалить с кодом | «нигде»: у `StatusSchema` нет потребителей (только `domain/src/course/index.ts:49` и сам тест) — схема удаляется вместе с тестом |
| `domain/src/course/status.test.ts` | 18 | `StatusSchema` отклоняет невалидные значения | Б-13/Б-8 | удалить с кодом | то же: `domain/src/course/index.ts:49` — реэкспорт `StatusSchema` снимается, `Status` остаётся (см. «Вне границ среза») |
| `domain/src/course/content-snapshot.test.ts` | 10 | валидный урок — проходит | Б-8 | удалить | domain/src/course/module-snapshot.dqs.test.ts:117 |
| `domain/src/course/content-snapshot.test.ts` | 22 | пустой заголовок — падает | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:57 |
| `domain/src/course/content-snapshot.test.ts` | 31 | невалидный UUID урока — падает | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:41 |
| `domain/src/course/content-snapshot.test.ts` | 42 | валидный элемент снимка — проходит | Б-8 | удалить | domain/src/course/module-snapshot.dqs.test.ts:117 |
| `domain/src/course/content-snapshot.test.ts` | 57 | пустой заголовок проекта — падает | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:57 |
| `domain/src/course/content-snapshot.test.ts` | 66 | невалидный UUID проекта — падает | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:41 |
| `domain/src/course/content-snapshot.test.ts` | 77 | пустой массив — проходит (нет проектов) | Б-12 | удалить | domain/src/course/module-snapshot.dqs.test.ts:117 |
| `domain/src/course/content-snapshot.test.ts` | 81 | массив с одним валидным элементом — проходит | Б-8 | удалить | domain/src/course/module-snapshot.dqs.test.ts:117 |
| `domain/src/course/content-snapshot.test.ts` | 92 | массив с невалидным элементом — падает | Б-8 | удалить | node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264 |
| `domain/src/course/content-snapshot-index.test.ts` | 10 | `ContentSnapshotItemSchema` доступна через index | Б-11 | удалить | «нигде»: `toBeDefined` на реэкспорте — доступность держит `tsc` в строке импорта |
| `domain/src/course/content-snapshot-index.test.ts` | 14 | `LessonSnapshotSchema` доступна через index | Б-11 | удалить | то же: `toBeDefined` на реэкспорте — держит `tsc` |
| `domain/src/course/content-snapshot-index.test.ts` | 18 | `ContentSnapshotSchema` доступна через index | Б-11 | удалить | то же: `toBeDefined` на реэкспорте — держит `tsc` |
| `domain/src/course/content-snapshot-index.test.ts` | 22 | `ContentSnapshot` и `ContentSnapshotItem` типы доступны | Б-17 | удалить | «нигде»: позитивный тест типа — проверяется `tsc` |
| `domain/src/course/course.module.test.ts` | 27 | модуль не внешний | Б-11 | слить в domain/src/course/course.module.test.ts:31 | — (`external: false` переезжает первым `expect` в `:31`) |
| `domain/src/course/course.module.test.ts` | 65 | агрегат курса: без событий, одна ошибка — `COURSE_NOT_FOUND` | Б-7 | удалить | node_modules/dmg-core/src/arch/def-checker.test.ts:426 + modules/course/src/course/uc/get-course.uc.test.ts:96 |
| `domain/src/course/course.module.test.ts` | 76 | агрегат модуля: без событий, одна ошибка — `MODULE_NOT_FOUND` | Б-7 | удалить | node_modules/dmg-core/src/arch/def-checker.test.ts:426 + modules/course/src/module/uc/get-module-snapshot.uc.test.ts:164 |
| `domain/src/course/course.module.test.ts` | 87 | агрегат урока: без событий, одна ошибка — `LESSON_NOT_FOUND` | Б-7 | удалить | node_modules/dmg-core/src/arch/def-checker.test.ts:426 + modules/course/src/lesson/uc/get-lesson.uc.test.ts:113 |
| `domain/src/course/course.module.test.ts` | 98 | агрегат шага: без событий, одна ошибка — `STEP_NOT_FOUND` | Б-7 | удалить | node_modules/dmg-core/src/arch/def-checker.test.ts:426 + modules/course/src/step/uc/get-step.uc.test.ts:134 |
| `domain/src/course/course.module.test.ts` | 109 | `ArchChecker` — без нарушений | Б-7 | удалить | node_modules/dmg-core/src/arch/def-checker.test.ts:230 |
| `domain/src/course/course.module.test.ts` | 113 | UC вызывается другим модулем по `calls` (D-42) — без нарушений | Б-7 | удалить | node_modules/dmg-core/src/arch/def-checker.test.ts:340 |
| `domain/src/course/course/course.ar.test.ts` | 38 | `it.each` 7 кейсов — инварианты программы в конструкторе (`ValiError`) | Б-1 | удалить | domain/src/course/course/course.state.test.ts:231, :235, :239, :251, :258, :270 (те же отказы у владельца `superRefine`); положительный — domain/src/course/course/course.ar.test.ts:59 |
| `domain/src/course/course/course.ar.test.ts` | 85 | `includesModule` не зависит от статуса | Б-2 | удалить | domain/src/course/course/course.ar.test.ts:78 |
| `domain/src/course/course/course.ar.test.ts` | 89 | `startModuleId` — первый модуль программы | Б-2 | удалить | modules/course/src/course/uc/get-course-enrollment.uc.test.ts:35 |
| `domain/src/course/course/course.ar.test.ts` | 94 | `startModuleId` пустой программы — `undefined` | Б-12 | удалить | modules/course/src/course/uc/get-course-enrollment.uc.test.ts:66 |
| `domain/src/course/course/course.ar.test.ts` | 122 | пустой курс — `[]` | Б-12 | удалить | domain/src/course/course/course.ar.test.ts:118 |
| `domain/src/course/course/course.ar.test.ts` | 156 | этапы вместе покрывают программу по порядку без пропусков | Б-1 | удалить | domain/src/course/course/course.ar.test.ts:138 |
| `domain/src/course/course/course.ar.test.ts` | 219 | у курса без этапов `stage` нет | Б-1 | удалить | domain/src/course/course/course.ar.test.ts:180 |
| `domain/src/course/course/course.ar.test.ts` | 246 | модуль первого этапа — `index 0` и `track` этапа | Б-1 | слить в domain/src/course/course/course.ar.test.ts:223 | — (второй кейс `it.each` у `:223`: метка на первом модуле при двух этапах) |
| `domain/src/course/course/course.ar.test.ts` | 266 | этапы по одному модулю: место по линейному порядку | Б-1 | удалить | domain/src/course/course/course.ar.test.ts:188 (+ `:197`) |
| `domain/src/course/course/course.ar.test.ts` | 295 | метки `phases` наружу не выходят (D-64) | Б-15 | удалить | modules/course/src/course/uc/get-course.uc.test.ts:66 |
| `domain/src/course/course/course.ar.test.ts` | 301 | курс без этапов: `stages = []` | Б-12 | удалить | domain/src/course/course/course.ar.test.ts:118 |
| `domain/src/course/course/course.ar.test.ts` | 305 | одно и то же для любого статуса (вариант А С1) | Б-11 | удалить | modules/course/src/course/uc/get-course.uc.test.ts:55 |
| `domain/src/course/course/course.ar.test.ts` | 311 | `view()` валиден по `CourseView` и не содержит лишних полей | Б-11 | удалить | domain/src/course/course/course.ar.test.ts:330 + node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264 |
| `domain/src/course/course/course.ar.test.ts` | 346 | агрегат `course` с тремя статусами, без переходов и событий | Б-7 | удалить | node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:179 |
| `domain/src/course/course/course.state.test.ts` | 43 | принимает курс с этапом (метка с `track`) | Б-1 | удалить | domain/src/course/course/course.state.test.ts:156 (обе ветки метки после слияния `:160`) + `:221` |
| `domain/src/course/course/course.state.test.ts` | 64 | `it.each` «отклоняет: %s» — кейс «некорректный uuid» | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:41 |
| `domain/src/course/course/course.state.test.ts` | 64 | `it.each` «отклоняет: %s» — кейс «некорректный `authorId`» | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:41 |
| `domain/src/course/course/course.state.test.ts` | 64 | `it.each` «отклоняет: %s» — кейс «невалидный статус» | Б-8 | удалить | статус — `enum Status` (`domain/src/course/status.ts:7`): литерал вне набора не собирается `tsc`; все три статуса проходят state — domain/src/course/course/course.ar.test.ts:74 |
| `domain/src/course/course/course.state.test.ts` | 64 | `it.each` «отклоняет: %s» — кейс «uuid модуля в программе не uuid» | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:41 |
| `domain/src/course/course/course.state.test.ts` | 64 | `it.each` «отклоняет: %s» — кейс «программа не массив» | Б-8 | удалить | форму программы держит JSON Schema — node_modules/dmg-core/src/arch/def-checker.test.ts:219 (MAN-03) |
| `domain/src/course/course/course.state.test.ts` | 78 | `it.each` — запись без обязательного поля (`moduleIds`, `phases`, `status`, `authorId`) — кейсов: 4 | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:137 |
| `domain/src/course/course/course.state.test.ts` | 86 | `it.each` — `статус %s допустим` — кейсов: 3 | Б-8 | удалить | domain/src/course/course/course.ar.test.ts:74 |
| `domain/src/course/course/course.state.test.ts` | 160 | принимает метку с `track` | Б-1 | слить в domain/src/course/course/course.state.test.ts:156 | — (таблица «без `track` / с `track`» у `:156`) |
| `domain/src/course/course/course.state.test.ts` | 172 | `it.each` «отклоняет: %s» — кейс «`fromModuleId` не uuid» | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:41 |
| `domain/src/course/course/course.state.test.ts` | 172 | `it.each` «отклоняет: %s» — кейс «нет `fromModuleId`» | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:137 |
| `domain/src/course/course/course.state.test.ts` | 172 | `it.each` «отклоняет: %s» — кейс «модули этапа вместо метки» | Б-8 | удалить | domain/src/course/course/course.state.test.ts:95 (отказ прежней формы записи) |
| `domain/src/course/course/course.state.test.ts` | 182 | у метки нет идентичности и дат (DOM-13) | Б-7 | удалить | node_modules/dmg-core/src/arch/def-checker.test.ts:219 (MAN-03) — та же причина: `state` переводится в JSON Schema |
| `domain/src/course/course/course.state.test.ts` | 192 | `normalize(CourseArDef)` не бросает (Т3) | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/course/course.state.test.ts` | 196 | инварианты программы не в `state`: дубль заголовков state пропускает | Б-7 | удалить | domain/src/course/course.module.test.ts:31 + domain/src/course/course/course.state.test.ts:258 |
| `domain/src/course/course/course.state.test.ts` | 245 | два этапа на одном модуле — отказ | Б-1 | слить в domain/src/course/course/course.state.test.ts:239 | — (монотонность меток у `:239`: тот же `superRefine`) |
| `domain/src/course/course/course.state.test.ts` | 264 | разные заголовки этапов принимаются | Б-12 | удалить | domain/src/course/course/course.state.test.ts:221 |
| `domain/src/course/course/course.state.test.ts` | 277 | state и инвариант принимают состояние по умолчанию | Б-10 | удалить | domain/src/course/course/course.ar.test.ts:59 (restore из `stored()` не бросает) |
| `domain/src/course/course/uc/get-course.uc.test.ts` | 13 | query над агрегатом курса для user и guest, allowAll, ошибка — курс не найден | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/course/uc/get-course.uc.test.ts` | 24 | ошибка `COURSE_NOT_FOUND` — `not_found` с `courseId` в payload | Б-7 | удалить | modules/course/src/course/uc/get-course.uc.test.ts:96 |
| `domain/src/course/course/uc/get-course.uc.test.ts` | 37 | вход — `{ courseId }` uuid | Б-8 | удалить | modules/course/src/course/uc/get-course.uc.test.ts:104 + node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130 |
| `domain/src/course/course/uc/get-course.uc.test.ts` | 45 | выход — `CourseView`, в том числе курс без этапов | Б-8 | удалить | modules/course/src/course/uc/get-course.uc.test.ts:41 (+ `:82`) |
| `domain/src/course/course/uc/get-course.uc.test.ts` | 54 | входит в паспорт `CourseModuleDef` | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/course/uc/get-course-by-module.uc.test.ts` | 13 | query над агрегатом курса для user и guest, allowAll, без ошибок | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/course/uc/get-course-by-module.uc.test.ts` | 24 | вход — `{ moduleId }` uuid | Б-8 | удалить | modules/course/src/course/uc/get-course-by-module.uc.test.ts:95 |
| `domain/src/course/course/uc/get-course-by-module.uc.test.ts` | 31 | выход: `CourseView` или пусто | Б-8 | удалить | modules/course/src/course/uc/get-course-by-module.uc.test.ts:55 |
| `domain/src/course/course/uc/get-course-by-module.uc.test.ts` | 39 | входит в паспорт `CourseModuleDef` | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/course/uc/get-course-enrollment.uc.test.ts` | 10 | query для других модулей над агрегатом курса, без ограничений и ошибок | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/course/uc/get-course-enrollment.uc.test.ts` | 21 | вход — uuid курса | Б-8 | удалить | modules/course/src/course/uc/get-course-enrollment.uc.test.ts:84 |
| `domain/src/course/course/uc/get-course-enrollment.uc.test.ts` | 27 | выход: доступен — со стартовым модулем; недоступен — без него | Б-8 | перенести в modules/course/src/course/uc/get-course-enrollment.uc.test.ts | — (кейс «`enrollable: true` без `startModuleId` → отказ схемы выхода»: сейчас в модуле не проверяется) |
| `domain/src/course/course/uc/get-courses-including-module.uc.test.ts` | 10 | query для других модулей над агрегатом курса, без ограничений и ошибок | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/course/uc/get-courses-including-module.uc.test.ts` | 21 | вход — uuid модуля и uuid курсов-кандидатов | Б-8 | удалить | modules/course/src/course/uc/get-courses-including-module.uc.test.ts:112 |
| `domain/src/course/course/uc/get-courses-including-module.uc.test.ts` | 35 | выход — uuid курсов, включающих модуль | Б-8 | удалить | modules/course/src/course/uc/get-courses-including-module.uc.test.ts:35 |
| `domain/src/course/course/uc/get-courses-starting-with-module.uc.test.ts` | 10 | query для других модулей над агрегатом курса, без ограничений и ошибок | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/course/uc/get-courses-starting-with-module.uc.test.ts` | 21 | вход — uuid модуля и uuid курсов-кандидатов | Б-8 | удалить | modules/course/src/course/uc/get-courses-starting-with-module.uc.test.ts:161 |
| `domain/src/course/course/uc/get-courses-starting-with-module.uc.test.ts` | 31 | выход — uuid курсов, начинающихся с модуля | Б-8 | удалить | modules/course/src/course/uc/get-courses-starting-with-module.uc.test.ts:52 |
| `domain/src/course/course/uc/get-module-enrollment.uc.test.ts` | 9 | query для других модулей над агрегатом курса, без ограничений и ошибок | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/course/uc/get-module-enrollment.uc.test.ts` | 20 | вход — uuid модуля | Б-8 | удалить | modules/course/src/course/uc/get-module-enrollment.uc.test.ts:86 |
| `domain/src/course/course/uc/get-module-enrollment.uc.test.ts` | 26 | `it.each([true, false])` — выход `enrollable %s` — кейсов: 2 | Б-8 | удалить | modules/course/src/course/uc/get-module-enrollment.uc.test.ts:35 (+ `:41`) |
| `domain/src/course/course/uc/get-module-place.uc.test.ts` | 13 | query над агрегатом курса для user и guest, allowAll, без ошибок | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/course/uc/get-module-place.uc.test.ts` | 24 | вход — `{ moduleId }` uuid | Б-8 | удалить | modules/course/src/course/uc/get-module-place.uc.test.ts:125 |
| `domain/src/course/course/uc/get-module-place.uc.test.ts` | 31 | выход: место без соседей и этапа | Б-8 | удалить | modules/course/src/course/uc/get-module-place.uc.test.ts:56 (+ `:46`) |
| `domain/src/course/course/uc/get-module-place.uc.test.ts` | 36 | выход: место со всеми необязательными полями | Б-8 | удалить | modules/course/src/course/uc/get-module-place.uc.test.ts:74 |
| `domain/src/course/course/uc/get-module-place.uc.test.ts` | 48 | выход: `stage` без `track` допустим | Б-8 | удалить | domain/src/course/course/course.ar.test.ts:237 |
| `domain/src/course/course/uc/get-module-place.uc.test.ts` | 59 | выход: пусто (модуль вне опубликованных курсов) | Б-8 | удалить | modules/course/src/course/uc/get-module-place.uc.test.ts:50 |
| `domain/src/course/course/uc/get-module-place.uc.test.ts` | 63 | `it.each` 6 кейсов — отказ формы выхода (`ModulePlace`) | Б-8 | удалить | modules/course/src/course/uc/get-module-place.uc.test.ts:125 + node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130 |
| `domain/src/course/course/uc/get-module-place.uc.test.ts` | 80 | входит в паспорт `CourseModuleDef` | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/course/uc/get-module-prerequisite.uc.test.ts` | 16 | query для других модулей (system) над агрегатом курса, allowAll, без ошибок | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/course/uc/get-module-prerequisite.uc.test.ts` | 27 | вход — uuid модуля и пройденные модули | Б-8 | удалить | modules/course/src/course/uc/get-module-prerequisite.uc.test.ts:89 (+ `:95`) |
| `domain/src/course/course/uc/get-module-prerequisite.uc.test.ts` | 37 | `it.each` 5 кейсов — отказ входа | Б-8 | удалить | modules/course/src/course/uc/get-module-prerequisite.uc.test.ts:89 + node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130 |
| `domain/src/course/course/uc/get-module-prerequisite.uc.test.ts` | 49 | у каждого поля входа есть описание (MAN-02) | Б-7 | удалить | node_modules/dmg-core/src/arch/def-checker.test.ts:193 |
| `domain/src/course/course/uc/get-module-prerequisite.uc.test.ts` | 57 | `it.each` 3 кейса — выход валиден | Б-8 | удалить | modules/course/src/course/uc/get-module-prerequisite.uc.test.ts:64 |
| `domain/src/course/course/uc/get-module-prerequisite.uc.test.ts` | 65 | `it.each` 6 кейсов — отказ формы выхода (`variant` по `admitted`) | Б-8 | перенести в modules/course/src/course/uc/get-module-prerequisite.uc.test.ts | — (переносится кейс «`reason: previous-not-passed` без `title` → отказ»; остальные 5 строк — поля платформы, покрыты `modules/course/src/course/uc/get-module-prerequisite.uc.test.ts:64` и node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130) |
| `domain/src/course/course/uc/get-module-prerequisite.uc.test.ts` | 81 | JSON Schema выхода строится (вложенный `variant`, Т9) | Б-7 | удалить | node_modules/dmg-core/src/arch/def-checker.test.ts:219 |
| `domain/src/course/course/uc/get-module-prerequisite.uc.test.ts` | 86 | входит в паспорт `CourseModuleDef` | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/course/uc/get-same-modules.uc.test.ts` | 10 | query для других модулей над агрегатом курса, без ограничений и ошибок | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/course/uc/get-same-modules.uc.test.ts` | 21 | вход — uuid модуля и uuid модулей-кандидатов | Б-8 | удалить | modules/course/src/course/uc/get-same-modules.uc.test.ts:66 |
| `domain/src/course/course/uc/get-same-modules.uc.test.ts` | 31 | выход — uuid модулей, исторически тех же | Б-8 | удалить | modules/course/src/course/uc/get-same-modules.uc.test.ts:29 |
| `domain/src/course/course/uc/list-courses.uc.test.ts` | 13 | query над агрегатом курса для user и guest, allowAll, без ошибок | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/course/uc/list-courses.uc.test.ts` | 24 | вход: все поля необязательны, пустой вход валиден | Б-8 | удалить | modules/course/src/course/uc/list-courses.uc.test.ts:73 |
| `domain/src/course/course/uc/list-courses.uc.test.ts` | 37 | `it.each` 5 кейсов — отказ входа | Б-8 | удалить | modules/course/src/course/uc/list-courses.uc.test.ts:125 + node_modules/dmg-core/src/kernel/fields/fields.test.ts:57 |
| `domain/src/course/course/uc/list-courses.uc.test.ts` | 47 | у каждого поля входа есть описание (MAN-02) | Б-7 | удалить | node_modules/dmg-core/src/arch/def-checker.test.ts:193 |
| `domain/src/course/course/uc/list-courses.uc.test.ts` | 53 | выход — массив `CourseView` (пустой допустим) | Б-8 | удалить | modules/course/src/course/uc/list-courses.uc.test.ts:39 (+ `:90`) |
| `domain/src/course/course/uc/list-courses.uc.test.ts` | 62 | входит в паспорт `CourseModuleDef` | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/step/uc/get-step.uc.test.ts` | 30 | query над агрегатом step для user и guest, allowAll, две ошибки | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/step/uc/get-step.uc.test.ts` | 41 | ошибки: `STEP_NOT_FOUND` своя, `MODULE_NOT_FOUND` по ссылке (ERR-03) | Б-7 | удалить | modules/course/src/step/uc/get-step.uc.test.ts:142 |
| `domain/src/course/step/uc/get-step.uc.test.ts` | 47 | вход — uuid шага | Б-8 | удалить | modules/course/src/step/uc/get-step.uc.test.ts:191 |
| `domain/src/course/step/uc/get-step.uc.test.ts` | 55 | `it.each` — выход по виду шага (`text`/`code`/`file`) принимается, в т. ч. без `content` — кейсов: 5 | Б-8 | удалить | modules/course/src/step/uc/get-step.uc.test.ts:74 (+ `:83`, `:104`) |
| `domain/src/course/step/uc/get-step.uc.test.ts` | 77 | `it.each` — выход: чужой `kind`, `code` без `code`, `file` без `file`, пустое описание, без `version` — отказ — кейсов: 5 | Б-8 | удалить | node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264 |
| `domain/src/course/step/uc/get-step.uc.test.ts` | 87 | входит в паспорт `CourseModuleDef` | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/step/uc/get-steps-by-lessons.uc.test.ts` | 15 | query над агрегатом step для user и guest, allowAll, без ошибок | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/step/uc/get-steps-by-lessons.uc.test.ts` | 26 | вход — список uuid уроков, в т. ч. пустой | Б-8 | удалить | modules/course/src/step/uc/get-steps-by-lessons.uc.test.ts:186 |
| `domain/src/course/step/uc/get-steps-by-lessons.uc.test.ts` | 36 | выход — запись «урок → шаги {uuid, description}», в т. ч. пустая | Б-8 | удалить | modules/course/src/step/uc/get-steps-by-lessons.uc.test.ts:51 |
| `domain/src/course/step/uc/get-steps-by-lessons.uc.test.ts` | 43 | `it.each` — выход: ключ не uuid, uuid шага не uuid, нет `description`, значение не массив — отказ — кейсов: 4 | Б-8 | удалить | node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264 |
| `domain/src/course/step/uc/get-steps-by-lessons.uc.test.ts` | 52 | входит в паспорт `CourseModuleDef` | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/module/uc/get-module-snapshot.uc.test.ts` | 32 | query над агрегатом module для user, guest и system, allowAll, ошибка — модуль не найден | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/module/uc/get-module-snapshot.uc.test.ts` | 43 | ошибка `MODULE_NOT_FOUND` — `not_found` (контракт Т8) | Б-7 | удалить | modules/course/src/module/uc/get-module-snapshot.uc.test.ts:164 |
| `domain/src/course/module/uc/get-module-snapshot.uc.test.ts` | 49 | вход — uuid модуля | Б-8 | удалить | modules/course/src/module/uc/get-module-snapshot.uc.test.ts:240 |
| `domain/src/course/module/uc/get-module-snapshot.uc.test.ts` | 56 | выход — снимок контента (`ContentSnapshotVo`), в т. ч. пустой | Б-8 | удалить | modules/course/src/module/uc/get-module-snapshot.uc.test.ts:70 |
| `domain/src/course/module/uc/get-module-snapshot.uc.test.ts` | 65 | `ContentSnapshotVo`: у поля и вложенных полей есть описание (MAN-02) | Б-7 | удалить | node_modules/dmg-core/src/arch/def-checker.test.ts:193 |
| `domain/src/course/module/uc/get-module-snapshot.uc.test.ts` | 73 | входит в паспорт `CourseModuleDef` | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/lesson/uc/get-lesson.uc.test.ts` | 33 | query над агрегатом lesson для user и guest, allowAll, две ошибки | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/lesson/uc/get-lesson.uc.test.ts` | 44 | ошибки: `LESSON_NOT_FOUND` своя, `MODULE_NOT_FOUND` по ссылке (ERR-03) | Б-7 | удалить | modules/course/src/lesson/uc/get-lesson.uc.test.ts:113 |
| `domain/src/course/lesson/uc/get-lesson.uc.test.ts` | 50 | вход — uuid урока | Б-8 | удалить | modules/course/src/lesson/uc/get-lesson.uc.test.ts:179 |
| `domain/src/course/lesson/uc/get-lesson.uc.test.ts` | 58 | выход — `LessonView`: состояние урока с датами-числами и `version` | Б-8 | удалить | modules/course/src/lesson/uc/get-lesson.uc.test.ts:77 |
| `domain/src/course/lesson/uc/get-lesson.uc.test.ts` | 73 | поля выхода описаны (MAN-02) | Б-7 | удалить | node_modules/dmg-core/src/arch/def-checker.test.ts:193 |
| `domain/src/course/lesson/uc/get-lesson.uc.test.ts` | 79 | входит в паспорт `CourseModuleDef` | Б-7 | удалить | domain/src/course/course.module.test.ts:31 |
| `domain/src/course/lesson/lesson.ar.test.ts` | 66 | те же поля у published и без права | Б-11 | удалить | domain/src/course/lesson/lesson.ar.test.ts:46 (+ `:42`) |
| `domain/src/course/lesson/lesson.ar.test.ts` | 102 | `stepIds` в порядке урока; пустой — `[]` | Б-1 | удалить | domain/src/course/lesson/lesson.ar.test.ts:73 |
| `domain/src/course/lesson/lesson.ar.test.ts` | 111 | `LESSON_NOT_FOUND` — `not_found`, «Урок не найден» | TST-09 | переписать | — (оставить `kind` и `payload`; `label` снять) |
| `domain/src/course/lesson/lesson.state.test.ts` | 75 | принимает минимальный урок без опциональных полей | Н-2 | удалить | domain/src/course/lesson/lesson.state.test.ts:60 |
| `domain/src/course/lesson/lesson.state.test.ts` | 97 | отклоняет заголовок из пробелов (обрезка краёв) | Б-6 | слить в domain/src/course/lesson/lesson.state.test.ts:93 | — (таблица «пустой / из пробелов» у `:93`) |
| `domain/src/course/lesson/lesson.state.test.ts` | 101 | отклоняет отрицательный `estimatedMinutes` | Б-8 | удалить | domain/src/course/lesson/lesson.state.test.ts:105 |
| `domain/src/course/lesson/lesson.state.test.ts` | 109 | отклоняет дробный `estimatedMinutes` | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:57 |
| `domain/src/course/lesson/lesson.state.test.ts` | 113 | принимает `estimatedMinutes = 1` | Б-12 | удалить | domain/src/course/lesson/lesson.state.test.ts:105 |
| `domain/src/course/lesson/lesson.state.test.ts` | 117 | отклоняет невалидный UUID в `stepIds` | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:41 |
| `domain/src/course/lesson/lesson.state.test.ts` | 121 | отклоняет невалидный UUID в `mentorStepIds` | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:41 |
| `domain/src/course/lesson/lesson.state.test.ts` | 125 | отклоняет запись без `stepIds` | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:137 |
| `domain/src/course/lesson/lesson.state.test.ts` | 130 | отклоняет запись без `mentorStepIds` | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:137 |
| `domain/src/course/lesson/lesson.state.test.ts` | 135 | отклоняет некорректный uuid урока | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:41 |
| `domain/src/course/lesson/lesson.state.test.ts` | 139 | отклоняет некорректный `moduleId` | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:41 |
| `domain/src/course/lesson/lesson.state.test.ts` | 143 | отклоняет запись без `moduleId` | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:137 |
| `domain/src/course/lesson/lesson.state.test.ts` | 148 | `it.each` — `статус %s допустим` — кейсов: 3 | Б-8 | удалить | domain/src/course/lesson/lesson.ar.test.ts:42 |
| `domain/src/course/lesson/lesson.state.test.ts` | 155 | отклоняет неизвестный статус | Б-8 | удалить | статус — `enum Status` (`domain/src/course/status.ts:7`): литерал вне набора не собирается `tsc`; три статуса проходят state — domain/src/course/lesson/lesson.ar.test.ts:42 |
| `domain/src/course/lesson-steps.dqs.test.ts` | 68 | пустые входы — пустой объект | Б-12 | удалить | domain/src/course/lesson-steps.dqs.test.ts:133 |
| `domain/src/course/lesson-steps.dqs.test.ts` | 142 | урок с пустым `stepIds` не попадает в ответ | Б-1 | удалить | domain/src/course/lesson-steps.dqs.test.ts:133 |
| `domain/src/course/lesson-steps.dqs.test.ts` | 160 | не меняет вход: `stepIds` уроков прежние | Б-2 | удалить | domain/src/course/lesson/lesson.ar.test.ts:80 |
| `domain/src/course/module-courses.dqs.test.ts` | 54 | черновой курс находится | Б-6 | удалить | domain/src/course/module-courses.dqs.test.ts:49 (+ `:68`) |
| `domain/src/course/module-courses.dqs.test.ts` | 64 | курсов нет — `undefined` | Б-12 | удалить | domain/src/course/module-courses.dqs.test.ts:59 |
| `domain/src/course/module-courses.dqs.test.ts` | 144 | первый модуль первого опубликованного курса — место `isFirst` | Б-2 | удалить | domain/src/course/course/course.ar.test.ts:180 |
| `domain/src/course/module-prerequisite.dqs.test.ts` | 99 | название берётся у записи именно предыдущего модуля | Б-1 | слить в domain/src/course/module-prerequisite.dqs.test.ts:83 | — (второй кейс у `:83`: название предыдущего, а не соседнего) |
| `domain/src/course/module-prerequisite.dqs.test.ts` | 124 | модулей нет вовсе — `closed` | Б-12 | удалить | domain/src/course/module-prerequisite.dqs.test.ts:119 |
| `domain/src/course/module-snapshot.dqs.test.ts` | 123 | модуль без проектов — `[]` | Б-12 | удалить | domain/src/course/module-snapshot.dqs.test.ts:203 |
| `domain/src/course/module-snapshot.dqs.test.ts` | 229 | урок вне проектов модуля в снимок не попадает | Б-11 | удалить | domain/src/course/module-snapshot.dqs.test.ts:165 |
| `domain/src/course/module-snapshot.dqs.test.ts` | 283 | урок без шагов — `stepIds` пустой, урок остаётся | Б-12 | удалить | domain/src/course/module-snapshot.dqs.test.ts:127 |
| `domain/src/course/module/module.ar.test.ts` | 66 | published: «студент не видит DRAFT проект» — остаётся 0 проектов | Б-1 | удалить | domain/src/course/module/module.ar.test.ts:58 |
| `domain/src/course/module/module.ar.test.ts` | 71 | фильтрует только корневые проекты: опубликованный остаётся, черновик нет | Б-1 | удалить | domain/src/course/module/module.ar.test.ts:58 |
| `domain/src/course/module/module.ar.test.ts` | 197 | модуль без проектов — `[]` | Б-12 | удалить | domain/src/course/module/module.ar.test.ts:201 |
| `domain/src/course/module/module.ar.test.ts` | 206 | статус самого модуля не фильтрует | Б-1 | удалить | domain/src/course/module-snapshot.dqs.test.ts:135 |
| `domain/src/course/module/module.ar.test.ts` | 213 | представление без `version` не проходит схему выхода | Б-8 | слить в domain/src/course/module/module.ar.test.ts:225 | — (то же требование `version` в JSON Schema у `:225`) |
| `domain/src/course/module/module.ar.test.ts` | 220 | представление с `version` проходит | Б-8 | удалить | modules/course/src/module/uc/get-module.uc.test.ts:35 |
| `domain/src/course/module/module.policy.test.ts` | 30 | автор-студент — allowed (авторство по uuid) | Б-6 | удалить | domain/src/course/module/module.policy.test.ts:24 |
| `domain/src/course/module/module.policy.test.ts` | 36 | автор без ролей — allowed | Б-6 | удалить | domain/src/course/module/module.policy.test.ts:24 |
| `domain/src/course/module/module.policy.test.ts` | 40 | админ-автор — allowed | Б-6 | удалить | domain/src/course/module/module.policy.test.ts:18 (+ `:24`) |
| `domain/src/course/module/module.policy.test.ts` | 58 | студент — denied с текстом «Нет доступа к модулю» | TST-09 | переписать | — (оставить `allowed === false`; `denyMessage` снять) |
| `domain/src/course/module/module.state.test.ts` | 70 | отклоняет объект без `projects` | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:137 |
| `domain/src/course/module/module.state.test.ts` | 83 | отклоняет заголовок из пробелов (обрезка краёв) | Б-6 | слить в domain/src/course/module/module.state.test.ts:79 | — (таблица «пустой / из пробелов» у `:79`) |
| `domain/src/course/module/module.state.test.ts` | 108 | отклоняет некорректный uuid | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:41 |
| `domain/src/course/module/module.state.test.ts` | 112 | отклоняет некорректный `authorId` | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:41 |
| `domain/src/course/module/module.state.test.ts` | 116 | `it.each` — `статус %s допустим` — кейсов: 3 | Б-8 | удалить | domain/src/course/module/module.ar.test.ts:30 |
| `domain/src/course/module/module.state.test.ts` | 123 | отклоняет неизвестный статус | Б-8 | удалить | статус — `enum Status` (`domain/src/course/status.ts:7`): литерал вне набора не собирается `tsc`; три статуса проходят state — domain/src/course/module/module.ar.test.ts:30 |
| `domain/src/course/module/module.state.test.ts` | 156 | отклоняет некорректный uuid урока в `lessonIds` | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:41 |
| `domain/src/course/step/step.ar.test.ts` | 90 | виды шага видны и без права, если опубликованы | Б-1 | удалить | domain/src/course/step/step.ar.test.ts:46 (+ `:75`, `:81`) |
| `domain/src/course/step/step.ar.test.ts` | 118 | `it.each` — `%s с правом — виден` (`summaryFor`) — кейсов: 3 | Б-1 | удалить | domain/src/course/step/step.ar.test.ts:54 (+ `:103`) |
| `domain/src/course/step/step.ar.test.ts` | 127 | `STEP_NOT_FOUND` — `not_found`, «Шаг не найден» | TST-09 | переписать | — (оставить `kind` и `payload`; `label` снять) |
| `domain/src/course/step/step.state.test.ts` | 81 | принимает text-шаг | Б-1 | удалить | domain/src/course/step/step.state.test.ts:85 |
| `domain/src/course/step/step.state.test.ts` | 173 | отклоняет описание из пробелов (обрезка краёв) | Б-6 | слить в domain/src/course/step/step.state.test.ts:167 | — (таблица «пустое / из пробелов» у `:167`) |
| `domain/src/course/step/step.state.test.ts` | 184 | отклоняет некорректный uuid шага | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:41 |
| `domain/src/course/step/step.state.test.ts` | 188 | отклоняет некорректный `moduleId` | Б-8 | удалить | node_modules/dmg-core/src/kernel/fields/fields.test.ts:41 |
| `domain/src/course/step/step.state.test.ts` | 194 | `it.each` — `статус %s допустим` — кейсов: 3 | Б-8 | удалить | domain/src/course/step/step.ar.test.ts:54 |
| `domain/src/course/step/step.state.test.ts` | 201 | отклоняет неизвестный статус | Б-8 | удалить | статус — `enum Status` (`domain/src/course/status.ts:7`): литерал вне набора не собирается `tsc`; три статуса проходят state — domain/src/course/step/step.ar.test.ts:54 |

Строк таблицы — **178**, кейсов исполнения — **229** (`it.each` развёрнут: часть его строк удаляется, часть остаётся).

## Переписать

- `domain/src/course/lesson/lesson.ar.test.ts:111` — оставить `kind === 'not_found'` и проверку `payload` (`{ lessonId }`), строку `expect(LessonErrors.NOT_FOUND.label)` снять: `label` — TST-09, `payload` держит `modules/course/src/lesson/uc/get-lesson.uc.test.ts:113`.
- `domain/src/course/step/step.ar.test.ts:127` — то же: `kind` и `payload` остаются, текст «Шаг не найден» снимается.
- `domain/src/course/module/module.policy.test.ts:58` — оставить `decision.allowed === false`, `denyMessage` снять (отказ уже проверен `module/module.policy.test.ts:46`).

## Слить

- `domain/src/course/course.module.test.ts:27` → `:31`: `expect(CourseModuleDef.external).toBeFalsy()` первым `expect` в тесте состава.
- `domain/src/course/course/course.ar.test.ts:246` → `:223`: второй кейс `it.each` — метка на первом модуле при двух этапах.
- `domain/src/course/course/course.state.test.ts:160` → `:156`: таблица «метка без `track` / с `track`».
- `domain/src/course/course/course.state.test.ts:245` → `:239`: второй кейс таблицы отказов меток (два этапа на одном модуле).
- `domain/src/course/lesson/lesson.state.test.ts:97` → `:93`: таблица «пустой заголовок / из пробелов».
- `domain/src/course/module/module.state.test.ts:83` → `:79`: та же таблица заголовка.
- `domain/src/course/step/step.state.test.ts:173` → `:167`: таблица «пустое описание / из пробелов».
- `domain/src/course/module-prerequisite.dqs.test.ts:99` → `:83`: второй кейс — название берётся у предыдущего модуля, а не у соседнего.
- `domain/src/course/module/module.ar.test.ts:213` → `:225`: «без `version` — отказ» входит в требование `version` из JSON Schema; отдельного кейса не добавляется.

## Перенести

- `domain/src/course/course/uc/get-course-enrollment.uc.test.ts:27` → `modules/course/src/course/uc/get-course-enrollment.uc.test.ts`: кейс «`enrollable: true` без `startModuleId` → отказ схемы выхода» (единственная межпольная связка выхода, которую модульные тесты не ловят).
- `domain/src/course/course/uc/get-module-prerequisite.uc.test.ts:65` → `modules/course/src/course/uc/get-module-prerequisite.uc.test.ts`: кейс «`reason: 'previous-not-passed'` без `title` → отказ»; остальные 5 строк `it.each` — поля платформы, удаляются. Связка `reason` ⇒ `title` на реальном ответе проверена `modules/course/src/course/uc/get-module-prerequisite.uc.test.ts:64`, но отказ схемы — нет.

После переноса удаляются целиком 14 файлов `domain/src/course/*/uc/*.uc.test.ts` (`course/uc` — 10, `lesson/uc` — 1, `module/uc` — 1, `step/uc` — 2).

## Остающиеся проверки `label`

TST-09: тексты `label`/`denyMessage` не тестируются. В домене `course` их три, все — внутри переписываемых тестов, то есть снимаются этой же таблицей; в остающихся полезных тестах проверок текста нет (`grep -rn "\.label\|denyMessage" domain/src/course --include=*.test.ts` даёт только эти три строки):

- `domain/src/course/lesson/lesson.ar.test.ts:113` — `expect(LessonErrors.NOT_FOUND.label).toBe('Урок не найден')`.
- `domain/src/course/step/step.ar.test.ts:129` — `expect(StepErrors.NOT_FOUND.label).toBe('Шаг не найден')`.
- `domain/src/course/module/module.policy.test.ts:62` — `expect(decision.denyMessage).toBe('Нет доступа к модулю')`.

## Итог

- Строк таблицы — **178**; затронуто кейсов исполнения — **229** из 442.
- **удалить** — 208 кейсов; **удалить с кодом** — 2 (`StatusSchema` + реэкспорт `domain/src/course/index.ts:49`); **слить** — 9 кейсов в 9 приёмников (все — внутри своих файлов); **перенести** — 7 кейсов в 2 файла `modules/course`; **переписать** — 3.
- Файлов удаляется целиком — **17**: `status.test.ts`, `content-snapshot.test.ts`, `content-snapshot-index.test.ts` и 14 файлов `*/uc/*.uc.test.ts`.
- Ожидаемое число тестов после среза: `cd domain && bun test src/course` → **442 → 223**. Расчёт: 442 − 208 (удалённые) − 2 (удалённые с кодом) − 7 (перенесённые в модуль) − 9 (сливаемые кейсы) + 7 (они же строками `it.each` приёмников) = 223; 3 переписанных кейса остаются. Сверено по файлам: прогон `bun test <файл>` для каждого из 31 файла даёт 442, после среза сумма «остаётся» — 223. Базовая линия `modules/course` вырастет на 2 кейса.
- Кандидатов инвентаризации не вошло — **1**: `domain/src/course/module/module.ar.test.ts:116` (`summary`: «uuid, title, description, status, tags — и только они»). Решение 5 назвало его сторожем состава ключей, но тест строит `summary()` из состояния с `goal` и `projects` и ловит **утечку** этих полей в ответ наружу (`listModules` → UI) — срабатывает исключение решения 5, тест оставлен полезным. Парные `lesson/lesson.ar.test.ts:88` (`outline`) и `step/step.ar.test.ts:103` (`summaryFor`) инвентарь тоже считал полезными — оставлены.
- Пересмотрены оценки инвентаря (три «полезных», ставших кандидатами): `course/uc/get-course.uc.test.ts:45` и `course/uc/list-courses.uc.test.ts:53` — выход UC отдаёт общий `CourseView`, это ловят тесты модуля с реальным вызовом (`modules/course/src/course/uc/get-course.uc.test.ts:41`, `:82`; `list-courses.uc.test.ts:39`, `:90`); `course/uc/get-course-enrollment.uc.test.ts:27` — переносится в тест модуля, потому что отказ схемы реальным ответом не воспроизводится.

## Вне границ среза

- **`Status` (enum) не удаляется.** Решение 1 предполагало удалить `Status` вместе с `StatusSchema`, но `Status` импортирует `runners/u7-bot/tests/worlds/builder.ts:3` (`import { Status } from '@u7-scl/course/domain'`, дальше `Status.PUBLISHED` в 4 местах) — это другой слой и вне области среза. В срезе снимается только `StatusSchema` и её реэкспорт (`domain/src/course/index.ts:49` → `export { Status }`). Судьба `Status` (оставить как контракт домена или перевести бота на литералы) — решение вызывающего.
- **`get-course.uc.test.ts:45` — `expect(output).toBe(CourseView)`** (тождество выхода UC общему `CourseView`, D-64): удаляется как покрытое тестами модуля; если тождество нужно удержать явно — это отдельный тест модуля, а не доменный паспорт.

