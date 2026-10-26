# Бриф: обогащение учебного модуля `dmg-core` (Фаза 5)

**Зачем.** Гайды (`conductor/architecture/guides/*`) переезжают в `packages/dmg-core/docs/guides/` и должны ссылаться на учебный модуль пакета (`src/testing/example`), а не на `wish` (D-30: свежий проект на `dmg-core` работает без u7-school). Пример покрывает почти все виды, но для ряда разделов гайдов образца нет.

**Режим.** Правка платформы → роль `domain-author` / `api-author` на **Opus** (agents.md §10), гейт и ревью — оркестратор. Поведение `wish` не меняется.

## Границы

- Только `packages/dmg-core/src/testing/example/**` и тесты `dmg-core`, которые используют пример (снапшоты графа и т. п.: `graph/domain-graph.test.ts`, `app/module/module-from-def.test.ts`, `app/facade/module-facade.test.ts`, `app/app.fixture.ts` — обновить ожидания, сценарии не удалять).
- Публичная поверхность `dmg-core` (корень, `app`, `arch`, `testing`) не меняется. Если без этого нельзя — эскалация.
- Раскладка прежняя: домен `example/<m>`, прикладной слой `example/app/<m>`, `example.arch.ts`.

## Чего не хватает (гайд → что добавить)

| Гайд | Образец в `wish` | Добавить в пример |
|---|---|---|
| state | VO агрегата в `*.state.ts`, `wish.state.test.ts`, модульный `state.ts` (реэкспорт схем для прикладного пакета) | VO у `task` (например, `TaskPriorityVo` или срок), `task.state.test.ts` (принимает/отклоняет, разбор ISO-даты), `todo/state.ts` |
| aggregate | `rejects` для статусов вне перехода, round trip `snapshot` | проверить `task.ar.ts`/тест: `rejects`, round trip; дополнить недостающее |
| events | `*.events.test.ts`; событие без смены статуса, которое строит ER | `task.events.test.ts` (FQN, payload допустим/недопустим); событие без перехода — если естественно ложится (см. DCS ниже) |
| errors | `*.errors.test.ts`; ошибка зависимости берётся по ссылке через её контракт | `task.errors.test.ts` (код с префиксом, `kind`, payload); в UC — ошибка `users` по ссылке |
| policy | методы-вопросы Ar (`isOwnedBy`…), `domainRule` над чужим ответом | проверить `task.policy`/`task.rules`; добавить правило над ответом `users` (см. UC) |
| repo / dcs / dqs | DCS «вопрос → ответ» (`wish-fulfillment.dcs.ts` + `.types.ts` + тест) | DCS в `todo`: например, `task-assignment.dcs.ts` — решение над несколькими задачами/ответом `users` (передать задачи удалённого пользователя или архивировать), с тестом; DQS — только если появится второй потребитель, иначе в гайде «в примере нет» |
| use case | command с `this.call` к UC чужого модуля и правилом над ответом; второй command; query | `users`: query `GetUserUcDef` (callers `system`); `createTask` (или новый `assignTask`) проверяет пользователя через `this.call(GetUserUcDef, …)` и правило над ответом; тесты UC `complete`/`list`/`get` |
| event reaction | ER на событие внешнего модуля через DCS; хелпер идемпотентности (D-47) | `archive-removed-user-tasks` переводит на DCS (п. выше); тест ER с хелпером идемпотентности из `dmg-core/testing` (`reaction-idempotency.ts`) |
| module | `contract.ts` (D-45), внешний модуль `defineModule({ external: true })`, `normalize` + `checkDefs` в тесте модуля | `todo/contract.ts`, `users/contract.ts`; `dependsOn` todo — `UsersModuleDef` из `users/contract`; вариант `users` как `external: true` — отдельным тестом или в гайде текстом (решает автор, если `external` ломает `ExampleArch`); тест модуля приложения (`app/todo/todo.module.test.ts`) |
| facade | есть (`todo.facade.test.ts`) | — |
| job | есть Def и реализация | тест Job (`archive-done-tasks.job.test.ts`) |

Порядок: домен (state → ar → events/errors → rules/policy → dcs → uc/er Def → contract) → прикладной слой (UC `users`, UC/ER `todo`, тесты) → снапшоты core.

## Критерии приёмки

- Для каждой строки таблицы есть файл-образец с тестом; `bun run check` зелёный (в т. ч. `extract-check`, `arch:check` по `ExampleArch`).
- `checkDefs` по `TodoModuleDef` и `UsersModuleDef` без нарушений.
- Пример по-прежнему без импортов `@u7-scl/*` и `*-legacy` (ARC-10).
- Код примера — по гайдам (он станет их образцом): правила `rules.md` DOM-*, API-*, ERR-*, MAN-*, ARC-04 (вход — `contract.ts`).
- Отчёт автора: список новых файлов с одной строкой «что показывает» — эта строка пойдёт в раздел «Эталон» гайда.

## Открытые вопросы

—

## Отчёты агентов

### domain-author (Opus, 2026-10-26) — готово, гейт зелёный

Модель: задачу можно назначить исполнителю; при удалении пользователя его задачи архивируются, назначенные ему чужие — возвращаются владельцам.

Новые файлы (от `src/testing/example/`):
- `todo/task/task.state.test.ts` — VO и статус принимают/отклоняют; разбор ISO-дат (в т. ч. без зоны); описание у каждого поля, включая `v.optional`.
- `todo/state.ts` — реэкспорт схем state для своего прикладного слоя; наружу модуля не выходит.
- `todo/task/task.events.test.ts` — FQN; payload допустим/недопустим; события `assigned`/`unassigned` без смены статуса.
- `todo/task/task.errors.test.ts` — коды с префиксом `TASK_`, `kind`, разбор payload, `make`.
- `todo/task-release.dcs.ts` (+ `.types.ts`, `.dcs.test.ts`) — DCS над несколькими задачами: свои в архив, назначенные — владельцам; решает каждый Ar, выборке вызывающего не верит.
- `todo/task/uc/assign-task.uc.ts` (+ тест Def) — command с вызовом чужого UC (`calls: [GetUserUcDef]`), правило над ответом `users`, `USER_NOT_FOUND` по ссылке (ERR-03), `emits: [assigned]`.
- `todo/task/er/archive-removed-user-tasks.er.test.ts` — Def ER на событие внешнего модуля.
- `todo/contract.ts`, `users/contract.ts` — контракты модулей (D-45), JSDoc «кто и зачем».
- `users/user/uc/get-user.uc.ts` (+ тест) — query только для `system`, отдаёт ответ `{ userId, active }`, а не state.
- `users/user/user.ar.test.ts` — переход `remove`, метод-вопрос `isActive`.
- `users/users.module.test.ts` — `normalize` + `checkDefs`.

Изменены: `task.state.ts` (`TaskAssignmentVo`, `TaskStatus`, `assignment?`), `task.ar.ts` (`assign`, `unassign`, `isAssignedTo`), `task.ar.test.ts` (round trip, ветки), `task.events.ts`, `task.errors.ts` (`NOT_ASSIGNABLE`, `ASSIGNEE_INACTIVE`), `task.rules.ts` (`assigneeActive`), ER Def (`emits` + `unassigned`), `todo.module.ts` (`dependsOn` из `users/contract`), `index.ts` модулей, `users.module.ts`, `user.ar.ts`, `example.arch.ts` (`entry: 'contract'`); core-тесты `graph/domain-graph.test.ts`, `arch/arch-check.test.ts` (тест `entry` переписан под `contract`, ARC-04 при `index`).

Отклонения:
1. Минимальные реализации `app/users/user/uc/get-user.uc.ts`, `app/todo/task/uc/assign-task.uc.ts` — без тестов (иначе `ModuleMap` не компилируется); тесты — api-author.
2. Импорт `UserEvents` в тесте ER app-слоя — из `users/contract` (ARC-04).
3. `bun run gen` не знает раскладку примера — файлы вручную по шаблонам.
4. DCS без раунда «вопрос → ответ» — решения хватает по событию; правило над ответом `users` — в `assignTask`.
5. Имя ER `archiveRemovedUserTasks` сохранено (смысл расширен в label).
6. `users` как `external: true` — только текстом в гайде.
7. DQS нет — в гайде «в примере нет».

### api-author (Opus, 2026-10-26) — готово, гейт зелёный

Изменены (от `src/testing/example/app/`): `todo/task/task.repo.ts` (+`findActiveByAssignee`), `todo/infra/task.json-repo.ts` (+реализация; `TaskState` из `todo/state`), `todo/infra/task.json-repo.test.ts` (выборки), `todo/task/er/archive-removed-user-tasks.er.ts` (на `TaskReleaseDcs`; склейка двух выборок по uuid), его тест (обе группы, «своя и назначена себе», пусто, `expectIdempotentReaction`), `todo/task/uc/assign-task.uc.ts` (JSDoc).

Новые:
- `todo/task/uc/assign-task.uc.test.ts` — command с вызовом чужого модуля через `StubFacade(UsersModuleDef)`: каждый отказ с кодом и «ничего не записано», правило раньше перехода, успех с `assigned`, `received` (`SystemCaller` от UC, человек исходного вызова).
- `users/user/uc/get-user.uc.test.ts` — query только для `system`: `active`, `USER_NOT_FOUND`, `UNAUTHORIZED` для пользователя, ничего не пишет.
- `todo/task/uc/complete-task.uc.test.ts` — command над Ar с Policy: успех, админ, `TASK_NOT_FOUND`, `ACCESS_DENIED`, недопустимые статусы, `UNAUTHORIZED`.
- `todo/task/uc/list-tasks.uc.test.ts` — query субъекта: свои неархивные, только поля output, пусто, `UNAUTHORIZED`.
- `todo/task/uc/get-task.uc.test.ts` — query для других модулей: выход — state → `TaskAr.readonly`; Policy по человеку исходного вызова.
- `todo/task/job/archive-done-tasks.job.test.ts` — Job: архив выполненных, повторный прогон пуст, сбой одной записи → `failed: 1` и лог.
- `todo/todo.module.test.ts` — smoke модуля: `handle`-цепочка, `runJob`, доставка `users.user.removed` в ER через шину.

Отклонения: снапшоты core менять не пришлось; `MemoryTasks` фикстуры (публичный `dmg-core/testing`) не реализует `TaskRepo` — не расширялся; тесты `assignTask`/`getUser` зелёные сразу (реализации были) — чувствительность проверена временной поломкой; `gen` не знает раскладку примера.

### reviewer (Opus, 2026-10-26) — error нет

| ID | файл:строка | суть | severity | решение оркестратора |
|---|---|---|---|---|
| — | `todo/task/uc/assign-task.uc.ts`, `app/…/assign-task.uc.ts` | вызов `users` в `load` — до Policy: не-владелец узнаёт о существовании пользователя, лишний вызов | warn | оставить (порядок жизненного цикла UC платформы), ловушка в гайде use-case — TR-27 |
| — | `todo/task/task.ar.ts` `assign` | повторное назначение молча перезаписывает исполнителя | question | исправить: тот же исполнитель — без изменений; другой — по событиям восстановим текущего исполнителя |
| DOM-10 | ER `archiveRemovedUserTasks` | имя не отражает «освобождение» | warn | переименовать в `releaseRemovedUserTasks` |
| API-03 | `app/…/archive-removed-user-tasks.er.ts` | склейка двух выборок по uuid в ER | warn | одна выборка репозитория «задачи с участием пользователя» |
| DOM-06 | `todo/task-release.dcs.ts` | DCS без «вопрос → ответ» корректен | info | гайд repo/dcs показывает оба варианта (todo + wish) — при сборке документации |
| — | `task.events.ts` `unassigned` | описание привязано к причине, а не к факту | info | исправить |
| TST-04 | `app/todo/todo.module.test.ts` | ожидание доставки через `setTimeout(0)` | info | заменить на явное ожидание, если есть средство в `testing` |
| TST-05 | `arch/arch-check.test.ts` | ослаблена проверка нарушений ARC-04 | info | вернуть точный `toEqual` |

### Правки по ревью (2026-10-26)

- domain-author: `assign` — тот же исполнитель → без изменений; другой → одна мутация, события `unassigned` прежнего + `assigned` (отказ сделал бы переназначение невозможным: UC «снять» нет). Тот же исполнитель в UC всё равно регистрируется (API-01), UoW перезаписывает файл той же версией — строгое «не трогать» — вопрос платформы (UoW). ER переименован в `releaseRemovedUserTasks`; описание `unassigned` — про факт.
- api-author: тест модуля ждёт доставку детерминированно (локальная `awaitingBus` — в `dmg-core/testing` средства нет; кандидат в пакет при сборке документации); порт `findActiveByParticipant` вместо склейки в ER; `arch-check.test.ts` — точный `toEqual`.
