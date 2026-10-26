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

—
