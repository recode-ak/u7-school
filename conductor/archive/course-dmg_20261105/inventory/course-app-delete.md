# Таблица удаления тестов: прикладной слой `course`

Трек `course-dmg_20261105`, фаза 8. Основание — инвентаризация [`course-app.md`](./course-app.md) (кандидаты, §3), сводные закономерности [`test-bloat.md` §2](../../../roadmap/test-bloat.md) (Б-1…Б-13) и §6 («не трогать»), правила `node_modules/dmg-core/docs/reference/testing.md` §3, §5, §5.1 (TST-08, TST-09), решения фазы Ф8.

Область — `modules/course/src/**/*.test.ts` (22 файла). База: `cd modules/course && bun test` → **330 pass, 0 fail, 500 expect(), 22 files**.

Номера строк — по текущему коду. Каждая ссылка «где покрыто» проверена: файл существует, на указанной строке начинается `it(`/`test(`/`it.each(`/`test.each(`, тест проверяет то же и **сам не удаляется этой таблицей** (цепочек «A покрыт B, B удалён» нет).

Действия: `удалить` / `слить в <файл>:<строка>` / `переписать` / `перенести в <файл>` / `удалить с кодом`. В таблицу вошли только строки, по которым есть действие: полезные тесты (инвентаризация §4) не перечислены — их не трогают.

Решения фазы, применённые к таблице:

- **Б-8 (схемы).** Приём и отказ полей платформы (`F.uuid`, `v.picklist`, `v.number`+`v.minValue`, `required`) — `удалить`; своя логика схемы (`refine`/`superRefine`/`transform`) в схемах входа Def модуля отсутствует (`domain/src/course/*/uc/*.uc.ts` — только поля платформы), поэтому «слияний в таблицу валидно/невалидно» нет.
- **Б-7 (паспорта Def).** Тестов паспортов в модуле не осталось; состав держат `domain/src/course/course.module.test.ts:31` (список 16 UC и `dependsOn`) и `modules/course/src/course.module.serves.test.ts:17`.
- **Тексты `label` (TST-09).** Тесты не удаляются из-за них, одиночные `expect(...label...)` снимаются — раздел «Остающиеся проверки `label`».
- **Этапы-метки.** Дубли доменных `domain/src/course/course/course.ar.test.ts` удаляются, кроме единственного сквозного сценария своего UC: у `getModulePlace` остаётся `modules/course/src/course/uc/get-module-place.uc.test.ts:56`.
- **`ACCESS_DENIED` (`it.each`).** Каждый UC модуля сам вызывает `ModulePolicy.canSeeUnpublished` в `execute` — остаётся один кейс на UC (остальные `слить`), без `denyMessage`; текст держит `domain/src/course/module/module.policy.test.ts:58`.

## Таблица

| файл | строка | имя теста | Б-ID | действие | где покрыто |
|---|---|---|---|---|---|
| `modules/course/src/course.module.serves.test.ts` | 25 | фасад обслуживает все Def UC модуля | Б-9 | удалить | `node_modules/dmg-core/src/app/facade/module-facade.test.ts:69` (`serves` — UC из Def модуля); полнота карты — компилятор: `node_modules/dmg-core/src/app/module/module-from-def.test.ts:270` |
| `modules/course/src/course.module.serves.test.ts` | 32 | фасад принадлежит `CourseModuleDef` | Б-11 | удалить | `node_modules/dmg-core/src/app/facade/module-facade.test.ts:69` (`def` — геттер возвращает Def модуля) |
| `modules/course/src/course.module.test.ts` | 133 | UC потребителя вызывает `getCourseEnrollment` и получает стартовый модуль | Б-1 | удалить | `modules/course/src/course/uc/get-course-enrollment.uc.test.ts:35` (тот же UC, ветка `enrollable`) |
| `modules/course/src/course.module.test.ts` | 147 | UC нет в `calls` потребителя — ошибка типа | Б-11 | удалить | `@ts-expect-error` в теле теста (проверяет `tsc`), `node_modules/dmg-core/src/app/module/module-from-def.test.ts:270` (пропуск реализации UC — ошибка компиляции) |
| `modules/course/src/course.module.test.ts` | 154 | модуль курсов обслуживает свой UC и только его | Б-9 | удалить | `node_modules/dmg-core/src/app/facade/module-facade.test.ts:69`; состав модуля — `domain/src/course/course.module.test.ts:31` |
| `modules/course/src/course/uc/get-course.uc.test.ts` | 49 | опубликованный курс виден гостю без авторизации | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:179` (`allowAll` без субъекта), `domain/src/course/course/course.ar.test.ts:305` (статус не влияет на видимость) |
| `modules/course/src/course/uc/get-course.uc.test.ts` | 55 | `%s` — курс виден гостю, студенту и автору (×2: draft, archived) | Б-1 | удалить | `domain/src/course/course/course.ar.test.ts:305` |
| `modules/course/src/course/uc/get-course.uc.test.ts` | 66 | в представлении этапы `stages`, а не метки `phases` | Б-1 | удалить | `domain/src/course/course/course.ar.test.ts:295` |
| `modules/course/src/course/uc/get-course.uc.test.ts` | 82 | курс без этапов: `stages = []` | Б-1 | удалить | `domain/src/course/course/course.ar.test.ts:301` |
| `modules/course/src/course/uc/get-course.uc.test.ts` | 88 | только читает: ничего не записывается | Б-9 | удалить | нигде — в `execute` нет `save` и `event`, тест падает только при добавлении чужого вызова (Б-9) |
| `modules/course/src/course/uc/get-course.uc.test.ts` | 104 | вход не uuid — `INPUT_VALIDATION` | Б-8 | удалить | `domain/src/course/course/uc/get-course.uc.test.ts:37` (`вход — { courseId } uuid`) |
| `modules/course/src/course/uc/get-course.uc.test.ts` | 108 | `system` не допущен (`callers: user, guest`) — `UNAUTHORIZED` | Б-9 | удалить | `domain/src/course/course/uc/get-course.uc.test.ts:13` (`callers` в Def), `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/course/src/course/uc/get-course-by-module.uc.test.ts` | 55 | модуль вне курсов — пусто, не ошибка | Б-1 | удалить | `domain/src/course/module-courses.dqs.test.ts:59` |
| `modules/course/src/course/uc/get-course-by-module.uc.test.ts` | 61 | курсов нет — пусто | Б-1 | удалить | `domain/src/course/module-courses.dqs.test.ts:64` |
| `modules/course/src/course/uc/get-course-by-module.uc.test.ts` | 65 | курс отдаётся представлением со `stages` | Б-1 | удалить | `domain/src/course/course/course.ar.test.ts:295` |
| `modules/course/src/course/uc/get-course-by-module.uc.test.ts` | 80 | гость и пользователь допущены | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:179` |
| `modules/course/src/course/uc/get-course-by-module.uc.test.ts` | 87 | только читает: ничего не записывается | Б-9 | удалить | нигде — в `execute` нет `save` и `event` (Б-9) |
| `modules/course/src/course/uc/get-course-by-module.uc.test.ts` | 95 | `moduleId` не uuid — `INPUT_VALIDATION` | Б-8 | удалить | `domain/src/course/course/uc/get-course-by-module.uc.test.ts:24` (`вход — { moduleId } uuid`) |
| `modules/course/src/course/uc/get-course-by-module.uc.test.ts` | 99 | `system` не допущен — `UNAUTHORIZED` | Б-9 | удалить | `domain/src/course/course/uc/get-course-by-module.uc.test.ts:24` (`callers` в Def), `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/course/src/course/uc/get-course-by-module.uc.test.ts` | 107 | сбой репозитория — `SERVER_INTERNAL` | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:255` (исключение → `SERVER_INTERNAL`) |
| `modules/course/src/course/uc/get-course-enrollment.uc.test.ts` | 44 | стартовый — первый модуль программы, а не метка этапа | Б-1 | удалить | `domain/src/course/course/course.ar.test.ts:102` |
| `modules/course/src/course/uc/get-course-enrollment.uc.test.ts` | 57 | `%s` — записи нет (×2: draft, archived) | Б-1 | удалить | `domain/src/course/course/course.ar.test.ts:106` |
| `modules/course/src/course/uc/get-course-enrollment.uc.test.ts` | 66 | опубликован, но программа пуста — `enrollable: false` | Б-1 | удалить | `domain/src/course/course/course.ar.test.ts:110` |
| `modules/course/src/course/uc/get-course-enrollment.uc.test.ts` | 76 | `user` не допущен (`callers: system`) — `UNAUTHORIZED` | Б-9 | удалить | `domain/src/course/course/uc/get-course-enrollment.uc.test.ts:10` (`callers` в Def), `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/course/src/course/uc/get-course-enrollment.uc.test.ts` | 84 | `courseId` не uuid — `INPUT_VALIDATION` | Б-8 | удалить | `domain/src/course/course/uc/get-course-enrollment.uc.test.ts:21` (`вход — uuid курса`) |
| `modules/course/src/course/uc/get-course-enrollment.uc.test.ts` | 88 | только читает: ничего не записывается | Б-9 | удалить | нигде — в `execute` нет `save` и `event` (Б-9) |
| `modules/course/src/course/uc/get-courses-including-module.uc.test.ts` | 41 | архивный курс тоже учитывается | Б-1 | удалить | `domain/src/course/course/course.ar.test.ts:85` |
| `modules/course/src/course/uc/get-courses-including-module.uc.test.ts` | 49 | черновой курс учитывается | Б-1 | удалить | `domain/src/course/course/course.ar.test.ts:85` |
| `modules/course/src/course/uc/get-courses-including-module.uc.test.ts` | 79 | порядок `courseIds` при обратном порядке ответа репозитория | Б-6 | удалить | `modules/course/src/course/uc/get-courses-including-module.uc.test.ts:68` (то же правило, другой вход репозитория) |
| `modules/course/src/course/uc/get-courses-including-module.uc.test.ts` | 88 | курсы без модуля отбрасываются, остальные — в порядке `courseIds` | Б-6 | удалить | `:35` (фильтр) + `:68` (порядок) того же файла |
| `modules/course/src/course/uc/get-courses-including-module.uc.test.ts` | 100 | `user` не допущен — `UNAUTHORIZED` | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/course/src/course/uc/get-courses-including-module.uc.test.ts` | 112 | `courseIds` с не-uuid — `INPUT_VALIDATION` | Б-8 | удалить | `domain/src/course/course/uc/get-courses-including-module.uc.test.ts:21` |
| `modules/course/src/course/uc/get-courses-including-module.uc.test.ts` | 116 | только читает: ничего не записывается | Б-9 | удалить | нигде — в `execute` нет `save` и `event` (Б-9) |
| `modules/course/src/course/uc/get-courses-starting-with-module.uc.test.ts` | 72 | архивный кандидат учитывается; неизвестный пропускается | Б-1 | удалить | `domain/src/course/course/course.ar.test.ts:85`, `modules/course/src/course/uc/get-courses-including-module.uc.test.ts:55` (пропуск неизвестного) |
| `modules/course/src/course/uc/get-courses-starting-with-module.uc.test.ts` | 83 | пустой список кандидатов — пусто | Б-12 | удалить | `modules/course/src/course/uc/get-courses-starting-with-module.uc.test.ts:52` (та же ветка `filter`), `modules/course/src/infra/course.json-repo.test.ts:391` (пустой список → `[]`) |
| `modules/course/src/course/uc/get-courses-starting-with-module.uc.test.ts` | 99 | модуль вне опубликованных программ — пусто | Б-1 | удалить | `domain/src/course/module-courses.dqs.test.ts:161` |
| `modules/course/src/course/uc/get-courses-starting-with-module.uc.test.ts` | 109 | архивный курс первым в файле не участвует | Б-1 | удалить | `domain/src/course/module-courses.dqs.test.ts:166` |
| `modules/course/src/course/uc/get-courses-starting-with-module.uc.test.ts` | 122 | `fafa…` перед `cccc…`: место по `fafa…` — пусто | Б-1 | удалить | `domain/src/course/module-courses.dqs.test.ts:174` |
| `modules/course/src/course/uc/get-courses-starting-with-module.uc.test.ts` | 131 | `cccc…` перед `fafa…`: `a1a1…` первый — кандидаты | Б-1 | удалить | `domain/src/course/module-courses.dqs.test.ts:181` |
| `modules/course/src/course/uc/get-courses-starting-with-module.uc.test.ts` | 139 | `a0a0…` первый в `fafa…` — `fafa…` возвращается | Б-1 | удалить | `domain/src/course/module-courses.dqs.test.ts:144`, `:151` |
| `modules/course/src/course/uc/get-courses-starting-with-module.uc.test.ts` | 149 | `user` не допущен — `UNAUTHORIZED` | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/course/src/course/uc/get-courses-starting-with-module.uc.test.ts` | 161 | `courseIds` с не-uuid — `INPUT_VALIDATION` | Б-8 | удалить | `domain/src/course/course/uc/get-courses-starting-with-module.uc.test.ts:21` |
| `modules/course/src/course/uc/get-courses-starting-with-module.uc.test.ts` | 165 | только читает: ничего не записывается | Б-9 | удалить | нигде — в `execute` нет `save` и `event` (Б-9) |
| `modules/course/src/course/uc/get-module-enrollment.uc.test.ts` | 47 | курсов нет — `enrollable: false` | Б-12 | удалить | `modules/course/src/course/uc/get-module-enrollment.uc.test.ts:41` (ветка «не найдено») |
| `modules/course/src/course/uc/get-module-enrollment.uc.test.ts` | 51 | модуль в статусе `%s` — false (×2) | Б-1 | удалить | `domain/src/course/module-courses.dqs.test.ts:88`, `:97` |
| `modules/course/src/course/uc/get-module-enrollment.uc.test.ts` | 60 | модуль в архивном и в опубликованном курсе — true | Б-1 | удалить | `domain/src/course/module-courses.dqs.test.ts:110` |
| `modules/course/src/course/uc/get-module-enrollment.uc.test.ts` | 69 | фикстурный случай С2: `a1a1…` в двух опубликованных — true | Б-1 | удалить | `domain/src/course/module-courses.dqs.test.ts:118` |
| `modules/course/src/course/uc/get-module-enrollment.uc.test.ts` | 78 | `user` не допущен — `UNAUTHORIZED` | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/course/src/course/uc/get-module-enrollment.uc.test.ts` | 86 | `moduleId` не uuid — `INPUT_VALIDATION` | Б-8 | удалить | `domain/src/course/course/uc/get-module-enrollment.uc.test.ts:20` (`вход — uuid модуля`) |
| `modules/course/src/course/uc/get-module-place.uc.test.ts` | 46 | `stage` у курса без этапов нет | Б-1 | удалить | `domain/src/course/course/course.ar.test.ts:219` |
| `modules/course/src/course/uc/get-module-place.uc.test.ts` | 50 | модуль вне курсов — пусто, не ошибка | Б-1 | удалить | `domain/src/course/module-courses.dqs.test.ts:105` |
| `modules/course/src/course/uc/get-module-place.uc.test.ts` | 74 | несколько этапов — линейный порядок через границу этапов (`flatMap`) | Б-1 | удалить | `domain/src/course/course/course.ar.test.ts:223`, `:237` |
| `modules/course/src/course/uc/get-module-place.uc.test.ts` | 102 | курс в статусе `%s` не участвует (×2: archived, draft) | Б-1 | удалить | `domain/src/course/module-courses.dqs.test.ts:88` |
| `modules/course/src/course/uc/get-module-place.uc.test.ts` | 111 | только неопубликованный курс — пусто | Б-1 | удалить | `domain/src/course/module-courses.dqs.test.ts:97` |
| `modules/course/src/course/uc/get-module-place.uc.test.ts` | 119 | гость допущен (реакция на событие, без актора) | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:179` |
| `modules/course/src/course/uc/get-module-place.uc.test.ts` | 125 | `moduleId` не uuid — `INPUT_VALIDATION` | Б-8 | удалить | `domain/src/course/course/uc/get-module-place.uc.test.ts:24` |
| `modules/course/src/course/uc/get-module-place.uc.test.ts` | 129 | `system` не допущен — `UNAUTHORIZED` | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/course/src/course/uc/get-module-place.uc.test.ts` | 137 | только читает: ничего не записывается | Б-9 | удалить | нигде — в `execute` нет `save` и `event` (Б-9) |
| `modules/course/src/course/uc/get-module-prerequisite.uc.test.ts` | 55 | только читает: ничего не записывается | Б-9 | удалить | нигде — в `execute` нет `save` и `event` (Б-9) |
| `modules/course/src/course/uc/get-module-prerequisite.uc.test.ts` | 77 | `user` не допущен — `UNAUTHORIZED` | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/course/src/course/uc/get-module-prerequisite.uc.test.ts` | 89 | без `passedModuleIds` — `INPUT_VALIDATION` | Б-8 | удалить | `domain/src/course/course/uc/get-module-prerequisite.uc.test.ts:27` (обязательность поля — там же) |
| `modules/course/src/course/uc/get-module-prerequisite.uc.test.ts` | 95 | `moduleId` не uuid — `INPUT_VALIDATION` | Б-8 | удалить | `domain/src/course/course/uc/get-module-prerequisite.uc.test.ts:27` |
| `modules/course/src/course/uc/get-module-prerequisite.uc.test.ts` | 99 | сбой репозитория курсов — `SERVER_INTERNAL` | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:255` |
| `modules/course/src/course/uc/get-same-modules.uc.test.ts` | 39 | среди кандидатов нет модуля — пусто | Б-6 | удалить | `modules/course/src/course/uc/get-same-modules.uc.test.ts:29` (инверсия `filter` ловится там) |
| `modules/course/src/course/uc/get-same-modules.uc.test.ts` | 43 | пустой список кандидатов — пустой ответ | Б-12 | удалить | `modules/course/src/course/uc/get-same-modules.uc.test.ts:29` |
| `modules/course/src/course/uc/get-same-modules.uc.test.ts` | 54 | `user` не допущен — `UNAUTHORIZED` | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/course/src/course/uc/get-same-modules.uc.test.ts` | 66 | `moduleIds` с не-uuid — `INPUT_VALIDATION` | Б-8 | удалить | `domain/src/course/course/uc/get-same-modules.uc.test.ts:21` |
| `modules/course/src/course/uc/list-courses.uc.test.ts` | 45 | пустой список, если курсов нет | Б-12 | удалить | `modules/course/src/course/uc/list-courses.uc.test.ts:39` (порядок и пустой ответ репозитория), `modules/course/src/infra/course.json-repo.test.ts:462` |
| `modules/course/src/course/uc/list-courses.uc.test.ts` | 61 | явный статус передаётся репозиторию | Б-6 | слить в `modules/course/src/course/uc/list-courses.uc.test.ts:73` | — (в `:73` добавить кейс «явный `status` уходит в фильтр» — тот же прогон «как есть») |
| `modules/course/src/course/uc/list-courses.uc.test.ts` | 90 | выход содержит `stages` | Б-1 | удалить | `domain/src/course/course/course.ar.test.ts:295` |
| `modules/course/src/course/uc/list-courses.uc.test.ts` | 109 | гость и пользователь получают один и тот же список | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:179`, `domain/src/course/course/course.ar.test.ts:305` |
| `modules/course/src/course/uc/list-courses.uc.test.ts` | 117 | только читает: ничего не записывается | Б-9 | удалить | нигде — в `execute` нет `save` и `event` (Б-9) |
| `modules/course/src/course/uc/list-courses.uc.test.ts` | 125 | `%s` — `INPUT_VALIDATION` (×3: `limit 0`, статус вне перечня, `authorId` не uuid) | Б-8 | удалить | `domain/src/course/course/uc/list-courses.uc.test.ts:37` (`it.each` отказов входа: те же три поля) |
| `modules/course/src/course/uc/list-courses.uc.test.ts` | 133 | `system` не допущен — `UNAUTHORIZED` | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/course/src/course/uc/list-courses.uc.test.ts` | 141 | сбой репозитория — `SERVER_INTERNAL` | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:255` |
| `modules/course/src/infra/course.json-repo.test.ts` | 122 | курс без этапов и с пустой программой сохраняется и читается | Б-1 | удалить | `domain/src/course/course/course.state.test.ts:209` (валидный черновик), `modules/course/src/infra/course.json-repo.test.ts:55` (round-trip состояния) |
| `modules/course/src/infra/course.json-repo.test.ts` | 134 | запись по устаревшей версии — `VersionConflict`, файл не изменён | Б-9 | удалить | `node_modules/dmg-core/src/app/uow/repository.test.ts:64` (сверка версии — платформа) |
| `modules/course/src/infra/course.json-repo.test.ts` | 402 | любой статус: архивный курс находится | Б-6 | удалить | `modules/course/src/infra/course.json-repo.test.ts:352` (`findByIds` без ветки по статусу) |
| `modules/course/src/infra/course.json-repo.test.ts` | 595 | запись без обязательного поля (нет `moduleIds`) — `ValiError` | Б-8 | удалить | `modules/course/src/infra/course.json-repo.test.ts:578` (та же ветка `v.parse` на чтении и записи, файл не изменён); обязательность поля — платформа (`required`) |
| `modules/course/src/infra/course.json-repo.test.ts` | 614 | корень файла не массив — `ValiError`, файл не изменён | Б-6 | удалить | `modules/course/src/infra/course.json-repo.test.ts:578` (та же ветка `v.parse`, тот же ассерт «файл не изменён») |
| `modules/course/src/infra/lesson.json-repo.test.ts` | 173 | запись по устаревшей версии — `VersionConflict` | Б-9 | удалить | `node_modules/dmg-core/src/app/uow/repository.test.ts:64` |
| `modules/course/src/infra/lesson.json-repo.test.ts` | 285 | запись без обязательного поля (нет `stepIds`) — `ValiError` | Б-8 | удалить | `domain/src/course/lesson/lesson.state.test.ts:125` (отклоняет запись без `stepIds`), `modules/course/src/infra/lesson.json-repo.test.ts:266` (та же ветка `v.parse`, файл не изменён) |
| `modules/course/src/infra/lesson.json-repo.test.ts` | 306 | корень файла не массив — `ValiError`, файл не изменён | Б-6 | удалить | `modules/course/src/infra/lesson.json-repo.test.ts:266` (та же ветка `v.parse`, тот же ассерт «файл не изменён») |
| `modules/course/src/infra/module.json-repo.test.ts` | 123 | запись по устаревшей версии — `VersionConflict` | Б-9 | удалить | `node_modules/dmg-core/src/app/uow/repository.test.ts:64` |
| `modules/course/src/infra/module.json-repo.test.ts` | 397 | `limit` — срез после фильтра | Б-6 | слить в `modules/course/src/infra/module.json-repo.test.ts:386` | — (в `:386` добавить кейс «`status` + `limit`»: тот же срез, но после фильтра) |
| `modules/course/src/infra/module.json-repo.test.ts` | 425 | запись без обязательного поля (нет `projects`) — `ValiError` | Б-8 | удалить | `domain/src/course/module/module.state.test.ts:70` (отклоняет объект без `projects`), `modules/course/src/infra/module.json-repo.test.ts:408` (та же ветка `v.parse`, файл не изменён) |
| `modules/course/src/infra/module.json-repo.test.ts` | 444 | корень файла не массив — `ValiError`, файл не изменён | Б-6 | удалить | `modules/course/src/infra/module.json-repo.test.ts:408` (та же ветка `v.parse`, тот же ассерт «файл не изменён») |
| `modules/course/src/infra/step.json-repo.test.ts` | 231 | запись по устаревшей версии — `VersionConflict` | Б-9 | удалить | `node_modules/dmg-core/src/app/uow/repository.test.ts:64` |
| `modules/course/src/infra/step.json-repo.test.ts` | 338 | неизвестный `kind` — `ValiError` | Б-8 | удалить | `domain/src/course/step/step.state.test.ts:157` |
| `modules/course/src/infra/step.json-repo.test.ts` | 348 | `code` без `code` — `ValiError` | Б-8 | удалить | `domain/src/course/step/step.state.test.ts:128` |
| `modules/course/src/infra/step.json-repo.test.ts` | 370 | корень файла не массив — `ValiError`, файл не изменён | Б-6 | удалить | `modules/course/src/infra/step.json-repo.test.ts:319` (та же ветка `v.parse`, тот же ассерт «файл не изменён») |
| `modules/course/src/lesson/uc/get-lesson.uc.test.ts` | 50 | опубликованный урок виден студенту | Б-1 | удалить | `modules/course/src/lesson/uc/get-lesson.uc.test.ts:40` (та же ветка `viewFor`) |
| `modules/course/src/lesson/uc/get-lesson.uc.test.ts` | 60 | администратор видит чужой DRAFT урок | Б-1 | удалить | `domain/src/course/module/module.policy.test.ts:18`, проводимость права — `modules/course/src/lesson/uc/get-lesson.uc.test.ts:55` |
| `modules/course/src/lesson/uc/get-lesson.uc.test.ts` | 65 | автор видит archived урок | Б-1 | удалить | `domain/src/course/module/module.policy.test.ts:24`, `modules/course/src/lesson/uc/get-lesson.uc.test.ts:55` |
| `modules/course/src/lesson/uc/get-lesson.uc.test.ts` | 70 | published виден гостю, даже если модуль в черновике | Б-1 | удалить | `domain/src/course/lesson/lesson.ar.test.ts:36` |
| `modules/course/src/lesson/uc/get-lesson.uc.test.ts` | 77 | представление: шаги, время, даты числами, `version` | Б-1 | удалить | `domain/src/course/lesson/lesson.ar.test.ts:46` |
| `modules/course/src/lesson/uc/get-lesson.uc.test.ts` | 99 | урок только читается | Б-9 | удалить | нигде — в `execute` нет `save` и `event` (Б-9) |
| `modules/course/src/lesson/uc/get-lesson.uc.test.ts` | 132 | `%s` — `ACCESS_DENIED` «Нет доступа к модулю» (×5) | Б-1 | слить в `modules/course/src/lesson/uc/get-lesson.uc.test.ts:132` | — (оставить один кейс «гость, draft» — проводка отказа `ModulePolicy` → `ACCESS_DENIED`; `denyMessage` снять; сами отказы — `domain/src/course/module/module.policy.test.ts:46`, `:52`, `:58`) |
| `modules/course/src/lesson/uc/get-lesson.uc.test.ts` | 153 | автор другого модуля не видит DRAFT этого модуля | Б-1 | удалить | `domain/src/course/module/module.policy.test.ts:52`, оставленный кейс `modules/course/src/lesson/uc/get-lesson.uc.test.ts:132` |
| `modules/course/src/lesson/uc/get-lesson.uc.test.ts` | 162 | автор модуля видит DRAFT, даже если модуль в черновике | Б-1 | удалить | `modules/course/src/lesson/uc/get-lesson.uc.test.ts:55` (автор видит свой DRAFT) |
| `modules/course/src/lesson/uc/get-lesson.uc.test.ts` | 169 | `system` не допущен — `UNAUTHORIZED` | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/course/src/lesson/uc/get-lesson.uc.test.ts` | 179 | неверный uuid во входе — `INPUT_VALIDATION` | Б-8 | удалить | `domain/src/course/lesson/uc/get-lesson.uc.test.ts:50` (`вход — uuid урока`) |
| `modules/course/src/lesson/uc/get-lesson.uc.test.ts` | 183 | прежнее имя поля `uuid` во входе — `INPUT_VALIDATION` (Т8) | Б-8 | удалить | `domain/src/course/lesson/uc/get-lesson.uc.test.ts:50` (там же отказ `{ uuid }`) |
| `modules/course/src/module/uc/get-module-snapshot.uc.test.ts` | 88 | `%s` получает снимок опубликованного модуля (×5) | Б-6 | удалить | `modules/course/src/module/uc/get-module-snapshot.uc.test.ts:70` (published не зависит от субъекта — та же ветка `ProjectPolicy`); остаётся один кейс «гость» |
| `modules/course/src/module/uc/get-module-snapshot.uc.test.ts` | 102 | автор и администратор черновика получают снимок опубликованной части | Б-1 | удалить | `domain/src/course/module-snapshot.dqs.test.ts:84` (draft-проект не попадает), `modules/course/src/module/uc/get-module-snapshot.uc.test.ts:116` (доступ автора к черновику) |
| `modules/course/src/module/uc/get-module-snapshot.uc.test.ts` | 155 | только читает: ничего не записывается | Б-9 | удалить | нигде — в `execute` нет `save` и `event` (Б-9) |
| `modules/course/src/module/uc/get-module-snapshot.uc.test.ts` | 174 | `%s` — `ACCESS_DENIED` «Нет доступа к модулю» (×5) | Б-1 | слить в `modules/course/src/module/uc/get-module-snapshot.uc.test.ts:174` | — (оставить один кейс «гость, черновой модуль» — проводка отказа; `denyMessage` снять; отказы — `domain/src/course/module/module.policy.test.ts:46`, `:58`) |
| `modules/course/src/module/uc/get-module-snapshot.uc.test.ts` | 231 | сбой репозитория уроков — `SERVER_INTERNAL` | Б-6 | удалить | `modules/course/src/module/uc/get-module-snapshot.uc.test.ts:223` (сбой не маскируется своей ошибкой — то же правило) |
| `modules/course/src/module/uc/get-module-snapshot.uc.test.ts` | 240 | неверный uuid во входе — `INPUT_VALIDATION` | Б-8 | удалить | `domain/src/course/module/uc/get-module-snapshot.uc.test.ts:49` (`вход — uuid модуля`) |
| `modules/course/src/module/uc/get-module-snapshot.uc.test.ts` | 246 | `facade.serves` — true; вызов через фасад от system отдаёт снимок | Б-9 | удалить | `node_modules/dmg-core/src/app/facade/module-facade.test.ts:69` (`serves` и вызов через фасад — тот же тест) |
| `modules/course/src/module/uc/get-module.uc.test.ts` | 50 | админ видит чужой черновик | Б-1 | удалить | `domain/src/course/module/module.policy.test.ts:18`, проводимость права — `modules/course/src/module/uc/get-module.uc.test.ts:45` |
| `modules/course/src/module/uc/get-module.uc.test.ts` | 55 | автор видит archived | Б-1 | удалить | `domain/src/course/module/module.policy.test.ts:24`, `modules/course/src/module/uc/get-module.uc.test.ts:45` |
| `modules/course/src/module/uc/get-module.uc.test.ts` | 60 | студент видит опубликованный модуль | Б-1 | удалить | `modules/course/src/module/uc/get-module.uc.test.ts:35` |
| `modules/course/src/module/uc/get-module.uc.test.ts` | 65 | у опубликованного модуля только опубликованные проекты | Б-1 | удалить | `domain/src/course/module/module.ar.test.ts:58` |
| `modules/course/src/module/uc/get-module.uc.test.ts` | 78 | у опубликованного модуля все проекты, включая черновые | Б-1 | удалить | `domain/src/course/module/module.ar.test.ts:93` |
| `modules/course/src/module/uc/get-module.uc.test.ts` | 106 | `%s` — `ACCESS_DENIED` «Нет доступа к модулю» (×5) | Б-1 | слить в `modules/course/src/module/uc/get-module.uc.test.ts:106` | — (оставить один кейс «гость, черновик» — проводка отказа; `denyMessage` снять; отказы — `domain/src/course/module/module.policy.test.ts:46`, `:58`) |
| `modules/course/src/module/uc/get-module.uc.test.ts` | 127 | `system` не допущен — `UNAUTHORIZED` | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/course/src/module/uc/get-module.uc.test.ts` | 137 | неверный uuid во входе — `INPUT_VALIDATION` | Б-8 | удалить | поле платформы `F.uuid`; `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` (невалидный вход → `INPUT_VALIDATION`); Def-теста `getModule` в домене нет |
| `modules/course/src/module/uc/list-modules.uc.test.ts` | 59 | студент: чужие черновики отбрасываются | Б-1 | удалить | `domain/src/course/module/module.policy.test.ts:58` (студент — denied в том же цикле отбора), `modules/course/src/module/uc/list-modules.uc.test.ts:46` |
| `modules/course/src/module/uc/list-modules.uc.test.ts` | 81 | админ видит всё | Б-1 | удалить | `domain/src/course/module/module.policy.test.ts:18`, `modules/course/src/module/uc/list-modules.uc.test.ts:68` (отбор по видимости) |
| `modules/course/src/module/uc/list-modules.uc.test.ts` | 91 | пустой список | Б-12 | удалить | `modules/course/src/module/uc/list-modules.uc.test.ts:37` (пустой ответ репозитория — тот же `map`) |
| `modules/course/src/module/uc/list-modules.uc.test.ts` | 107 | элемент — `ModuleSummary`: uuid, title, description, status, tags; без проектов | Б-1 | удалить | `domain/src/course/module/module.ar.test.ts:116` |
| `modules/course/src/module/uc/list-modules.uc.test.ts` | 142 | только `status` — фильтр `{ status }` | Б-6 | удалить | `modules/course/src/module/uc/list-modules.uc.test.ts:126` (все условия «как есть») |
| `modules/course/src/module/uc/list-modules.uc.test.ts` | 162 | `limit` не добирает видимые: все выбранные невидимы — `[]` | Б-6 | удалить | `modules/course/src/module/uc/list-modules.uc.test.ts:150` (limit до отбора видимых — та же ветка) |
| `modules/course/src/module/uc/list-modules.uc.test.ts` | 170 | гость допущен | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:179` |
| `modules/course/src/module/uc/list-modules.uc.test.ts` | 176 | `system` не допущен — `UNAUTHORIZED` | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/course/src/module/uc/list-modules.uc.test.ts` | 186 | `authorId` не uuid — `INPUT_VALIDATION` | Б-8 | удалить | поле платформы `F.uuid`; `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130`; Def-теста `listModules` в домене нет |
| `modules/course/src/module/uc/list-modules.uc.test.ts` | 192 | `limit` не число — `INPUT_VALIDATION` | Б-8 | удалить | поля платформы `v.number`/`v.integer`/`v.minValue`; `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130`; Def-теста `listModules` в домене нет |
| `modules/course/src/step/uc/get-steps-by-lessons.uc.test.ts` | 65 | гость получает опубликованные шаги | Б-1 | удалить | `domain/src/course/lesson-steps.dqs.test.ts:99` |
| `modules/course/src/step/uc/get-steps-by-lessons.uc.test.ts` | 88 | `%s`: draft и archived шаги пропускаются (×3) | Б-1 | удалить | `domain/src/course/lesson-steps.dqs.test.ts:99`, `:108` |
| `modules/course/src/step/uc/get-steps-by-lessons.uc.test.ts` | 97 | `%s`: видит все шаги по порядку (×2) | Б-1 | удалить | `domain/src/course/lesson-steps.dqs.test.ts:108`, порядок — `modules/course/src/step/uc/get-steps-by-lessons.uc.test.ts:51` |
| `modules/course/src/step/uc/get-steps-by-lessons.uc.test.ts` | 186 | неверный uuid в списке — `INPUT_VALIDATION` | Б-8 | удалить | `domain/src/course/step/uc/get-steps-by-lessons.uc.test.ts:26`, `:43` |
| `modules/course/src/step/uc/get-steps-by-lessons.uc.test.ts` | 190 | `system` не допущен — `UNAUTHORIZED` | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/course/src/step/uc/get-steps-by-lessons.uc.test.ts` | 198 | только читает: ничего не записывается | Б-9 | удалить | нигде — в `execute` нет `save` и `event` (Б-9) |
| `modules/course/src/step/uc/get-step.uc.test.ts` | 47 | опубликованный шаг виден студенту | Б-1 | удалить | `modules/course/src/step/uc/get-step.uc.test.ts:37` (та же ветка `viewFor`) |
| `modules/course/src/step/uc/get-step.uc.test.ts` | 57 | администратор видит чужой DRAFT шаг | Б-1 | удалить | `domain/src/course/module/module.policy.test.ts:18`, проводимость права — `modules/course/src/step/uc/get-step.uc.test.ts:52` |
| `modules/course/src/step/uc/get-step.uc.test.ts` | 62 | автор видит archived шаг | Б-1 | удалить | `domain/src/course/module/module.policy.test.ts:24`, `modules/course/src/step/uc/get-step.uc.test.ts:52` |
| `modules/course/src/step/uc/get-step.uc.test.ts` | 67 | published виден гостю, даже если модуль в черновике | Б-1 | удалить | `domain/src/course/step/step.ar.test.ts:90` |
| `modules/course/src/step/uc/get-step.uc.test.ts` | 74 | text: content и kind; даты числами, `version` | Б-1 | удалить | `domain/src/course/step/step.ar.test.ts:60` |
| `modules/course/src/step/uc/get-step.uc.test.ts` | 83 | code: код и язык | Б-1 | удалить | `domain/src/course/step/step.ar.test.ts:75` |
| `modules/course/src/step/uc/get-step.uc.test.ts` | 104 | file: метаданные файла | Б-1 | удалить | `domain/src/course/step/step.ar.test.ts:81` |
| `modules/course/src/step/uc/get-step.uc.test.ts` | 126 | шаг только читается | Б-9 | удалить | нигде — в `execute` нет `save` и `event` (Б-9) |
| `modules/course/src/step/uc/get-step.uc.test.ts` | 151 | `%s` — `ACCESS_DENIED` «Нет доступа к модулю» (×5) | Б-1 | слить в `modules/course/src/step/uc/get-step.uc.test.ts:151` | — (оставить один кейс «гость, draft» — проводка отказа; `denyMessage` снять; отказы — `domain/src/course/module/module.policy.test.ts:46`, `:58`) |
| `modules/course/src/step/uc/get-step.uc.test.ts` | 172 | автор другого модуля не видит DRAFT этого модуля | Б-1 | удалить | `domain/src/course/module/module.policy.test.ts:52`, `modules/course/src/step/uc/get-step.uc.test.ts:52` (проводка права) |
| `modules/course/src/step/uc/get-step.uc.test.ts` | 181 | `system` не допущен — `UNAUTHORIZED` | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/course/src/step/uc/get-step.uc.test.ts` | 191 | неверный uuid во входе — `INPUT_VALIDATION` | Б-8 | удалить | `domain/src/course/step/uc/get-step.uc.test.ts:47` |
| `modules/course/src/step/uc/get-step.uc.test.ts` | 195 | прежнее имя поля `uuid` во входе — `INPUT_VALIDATION` (Т8) | Б-8 | удалить | `domain/src/course/step/uc/get-step.uc.test.ts:47` (там же отказ `{ uuid }`) |

Счёт тестов в `it.each`-строках: `get-course:55` — 2, `get-course-enrollment:57` — 2, `get-module-enrollment:51` — 2, `get-module-place:102` — 2, `list-courses:125` — 3, `get-steps-by-lessons:88` — 3, `:97` — 2; `get-module-snapshot:88` — удаляются 4 из 5 (кейс «гость» остаётся); в строках «слить» — `get-lesson:132`, `get-module-snapshot:174`, `get-module:106`, `get-step:151` — удаляются по 4 из 5.

Файл `modules/course/src/course.module.test.ts` пустеет целиком (все три его теста в таблице) — удаляется вместе с `probe`-модулём внутри него; продуктового кода рядом нет (`grep probe src` — только этот файл). После этого в модуле 21 тестовый файл.

## «Слить» — что сделать

- `modules/course/src/course/uc/list-courses.uc.test.ts:61` → `:73`: в прогон «фильтры как есть» добавить кейс с явным `status` (сейчас `:73` проверяет `authorId`, `title`, `sort`, `limit`).
- `modules/course/src/infra/module.json-repo.test.ts:397` → `:386`: в тест «limit — срез после сортировки» добавить кейс `{ status: 'published', limit: 1 }` (срез после фильтра).
- `modules/course/src/lesson/uc/get-lesson.uc.test.ts:132`: из пяти кейсов оставить «гость, draft», `denyMessage` из `payload` убрать (текст — `domain/src/course/module/module.policy.test.ts:58`).
- `modules/course/src/module/uc/get-module-snapshot.uc.test.ts:174`: оставить «гость, черновой модуль», `denyMessage` убрать.
- `modules/course/src/module/uc/get-module.uc.test.ts:106`: оставить «гость, черновик», `denyMessage` убрать.
- `modules/course/src/step/uc/get-step.uc.test.ts:151`: оставить «гость, draft», `denyMessage` убрать.

«Переписать» и «перенести» — строк нет: схемы `getModule`/`listModules` состоят только из полей платформы, своей логики для переноса в домен у них нет (решение Ф8 п. 4).

## Остающиеся проверки `label`

Одиночные `expect` на текст ошибки (TST-09) — снять, сами тесты остаются:

- `modules/course/src/course/uc/get-course.uc.test.ts:100` — `expect(error.label).toBe('Курс не найден')` (тест `:96`).
- `modules/course/src/lesson/uc/get-lesson.uc.test.ts:117` — `expect(error.label).toBe('Урок не найден')` (тест `:113`).
- `modules/course/src/step/uc/get-step.uc.test.ts:138` — `expect(error.label).toBe('Шаг не найден')` (тест `:134`).
- `modules/course/src/module/uc/get-module.uc.test.ts:102` — `expect(error.label).toBe('Модуль не найден')` (тест `:96`).

Тексты при этом остаются проверенными в домене (напр. `domain/src/course/step/step.ar.test.ts:127`). Вместе с ними снимаются `denyMessage` в четырёх сливаемых `it.each` (раздел «Слить») — текст держит `domain/src/course/module/module.policy.test.ts:58`.

## Итог

| действие | строк | тестов |
|---|---|---|
| удалить | 141 | 153 (по строкам таблицы) |
| слить | 6 | 18 (остаётся 6) |
| переписать | — | — |
| перенести | — | — |
| удалить с кодом | — | — |

Удаляется 171 тест; остаётся **159** (330 − 171), файлов — 21. Кандидаты Б-13 (мёртвый код) в модуле отсутствуют: удаляемый тест `course.module.test.ts` — единственное место своего `probe`-модуля, продуктового кода за ним нет.

Кандидаты инвентаризации, которых нет в таблице:

- три строки «перенести в домен» (`modules/course/src/module/uc/get-module.uc.test.ts:137`, `modules/course/src/module/uc/list-modules.uc.test.ts:186`, `:192`) — по решению Ф8 п. 4 стали `удалить`: в схемах только поля платформы;
- один кейс из `modules/course/src/module/uc/get-module-snapshot.uc.test.ts:174` остаётся (решение Ф8 п. 5);
- три теста, которые инвентаризация держала по §6, теперь в таблице как дубли домена (решение Ф8 п. 2а): `modules/course/src/course/uc/get-course.uc.test.ts:82`, `modules/course/src/course/uc/get-module-place.uc.test.ts:46`, `:74`; единственный сквозной `getModulePlace` остаётся — `get-module-place.uc.test.ts:56`.

Оставлено (§6):

- строгое чтение `courses.json` и отказ прежних форм записи: `modules/course/src/infra/course.json-repo.test.ts:245`, `:262`, `:314` (`it.each`-цикл из 7 инвариантов программы), `:328`;
- legacy ISO и даты без секунд: по 4 теста в `modules/course/src/infra/{course,lesson,module,step}.json-repo.test.ts`;
- схема состояния и инварианты программы (`domain/src/course/course/course.state.test.ts` — вне области таблицы).
