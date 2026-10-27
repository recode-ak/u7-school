# Facade — гайд

**Назначение:** рантайм-граница модуля для других модулей без манифеста (D-42, D-43). Своих типов и файлов фасадов модули не заводят:
- тип — `Facade<typeof <M>ModuleDef>` (корень `dmg-core`);
- реализация — `new ModuleFacade(create<M>Module(deps))` (`dmg-core/app`);
- в тестах потребителя — `StubFacade<typeof <M>ModuleDef>` (`dmg-core/testing`).

---

## 1. Когда применять

- Другой модуль (UC/ER/Job, у которого этот модуль в `dependsOn`) вызывает UC этого модуля. Связь объявляет вызывающий: Def вызываемого UC — в его `calls`; граф строит ребро «UC → UC», фасада в графе нет.
- Фасад — только `handle(def, input, caller, trace)`: типизированный сахар, который собирает команду (`UseCaseDef.commandOf`) и отдаёт её `ModuleFromDef.dispatch` владельца (D-49). Методов-обёрток и преобразований нет, доменные решения — в UC и домене владельца (API-04).
- Модуль для фасада — `FacadeModule<M>` = `{ def, dispatch }`: `ModuleFromDef` in-proc или сетевой клиент с тем же `dispatch`. Выбор фасада в `ModuleFacades` — `serves(def)`: UC из Def модуля.
- Вызывающий не трогает фасад напрямую: `this.call(Def, input, caller, trace)` базы `OperationFromDef` выбирает фасад из `deps.facades` (`ModuleFacades`) и подставляет `SystemCaller(this.ref, caller.person())`.
- UI и внешние адаптеры фасад не используют: они вызывают UC через модуль (ARC-08).
- Вызов, меняющий чужой модуль (command), — место выбирает владелец проекта по каждому случаю ([use-case.md](./use-case.md) §1).
- Фасад отвязывает модули: команда — простые данные, поэтому при выходе модуля в сервис меняется только транспорт `dispatch`, вызывающий код остаётся прежним (D-28, D-46, D-49).

## 2. Команда

Генератора фасада нет и не нужен. Вызываемый UC — `dmg-core gen uc`, в его `callers` — `'system'` (только такие UC принимает `Facade<M>.handle`). Фасад кладётся в `ModuleFacades` при сборке модуля-потребителя.

## 3. Образец

- [facade.ts](../../src/domain/contracts/facade.ts): `Facade<M>` и `SystemCallable<M>` — UC модуля с `'system'` в `callers`.
- [module-facade.ts](../../src/app/facade/module-facade.ts) и [module-facades.ts](../../src/app/facade/module-facades.ts): реализация над `dispatch` модуля и набор фасадов в `ModuleDeps.facades`.
- [get-user.uc.ts (Def)](../../src/testing/example/users/user/uc/get-user.uc.ts): UC, открытый другим модулям, — `callers: ['system']`, ответ `{ userId, active }`, а не state.
- [todo.facade.test.ts](../../src/testing/example/app/todo/todo.facade.test.ts): учебный потребитель — `this.call(GetTaskUcDef, …)`, `TaskAr.readonly(res.value)`. Две стороны: вместе с владельцем через `ModuleFacade`; потребитель отдельно через `StubFacade` (ответ по Def, проверка `received`: вход, `caller.from`, `caller.person()`).
- Потребитель в UC: [assign-task.uc.ts](../../src/testing/example/app/todo/task/uc/assign-task.uc.ts) — `this.call(GetUserUcDef, …)`; тест — [assign-task.uc.test.ts](../../src/testing/example/app/todo/task/uc/assign-task.uc.test.ts) на `StubFacade(UsersModuleDef)`.

## 4. Чеклист правил

- API-04 — фасад только передаёт вызов UC своего модуля; выход — как у UC, `ReadonlyAr` строит вызывающий (`<A>Ar.readonly`).
- MAN-05 — у вызывающего Def вызываемого UC в `calls` (тип `call` и `ArchChecker`), у вызываемого — `'system'` в `callers`.
- ARC-04 — вызывающий импортирует Def модуля и UC через контракт владельца и только по `dependsOn`.
- ARC-06 — прикладной пакет не импортирует пакеты других модулей: фасад приходит через `deps.facades`.

## 5. Типичные ловушки

- Логика в фасаде или своя обёртка-класс с методами → в домен владельца или в его UC; фасад — `ModuleFacade` как есть.
- Команда, собранная руками (`{ uc: 'getTask', … }`), → только `UseCaseDef.commandOf` / `ucDef.command`: имя и тип входа берутся из Def.
- Def UC не в `calls` → ошибка типа в `this.call`; объявляй Def UC, а не фасад.
- Вызываемый UC без `'system'` в `callers` → не попадает в `SystemCallable<M>`, и `calls` его не примет по типу.
- Ручная сборка `SystemCaller` в коде потребителя → только `this.call`; руками — лишь в тесте вызываемого UC (системный вызов без человека).
- Нет фасада модуля в `ModuleFacades` → ошибка сборки: `call` бросает, база операции ловит и отвечает `SERVER_INTERNAL` с `logger.error`.
- UC для других модулей отдаёт state агрегата целиком, хотя потребителю нужен ответ на вопрос → выход UC — ответ (`UserActivity`), state остаётся внутри модуля (D-45).

## 6. Как тестировать

У владельца: вызов через фасад проходит; ошибка UC приходит как есть; UC не из `calls` — ошибка типа (`@ts-expect-error`) ([todo.facade.test.ts](../../src/testing/example/app/todo/todo.facade.test.ts)). У потребителя — `StubFacade<M>`: ответ и сбой по Def (`answer`), вызовы — `received`.
