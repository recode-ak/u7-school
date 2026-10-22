# Facade — гайд

**Назначение:** рантайм-граница модуля для других модулей без манифеста (D-42, D-43). Своих типов и файлов фасадов модули не заводят:
- тип — `Facade<typeof <M>ModuleDef>` (`dmg-core/domain`);
- реализация — `new ModuleFacade(create<M>Module(deps))` (`dmg-core/app`);
- в тестах потребителя — `StubFacade<typeof <M>ModuleDef>` (`dmg-core/testing`).

---

## 1. Когда применять

- Другой модуль (UC/ER/Job, у которого этот модуль в `dependsOn`) вызывает UC этого модуля. Связь объявляет вызывающий: Def вызываемого UC — в его `calls`; граф строит ребро «UC → UC», фасада в графе нет.
- Фасад — только `handle(def, input, caller, trace)` поверх `ModuleFromDef.handle` владельца: методов-обёрток и преобразований нет, доменные решения — в UC и домене владельца (API-04).
- Вызывающий не трогает фасад напрямую: `this.call(Def, input, caller, trace)` базы `OperationFromDef` выбирает фасад из `deps.facades` (`ModuleFacades`, по `serves`) и подставляет `SystemCaller(this.ref, caller.person())`.
- UI и внешние адаптеры фасад не используют: они вызывают UC через `appApi` (ARC-08).
- Вызов, меняющий чужой модуль (command), — место выбирает Нурболат по каждому случаю (D-41): в `execute` до фиксации или событием и ER.
- Фасад отвязывает модули: in-proc сейчас, сетевой клиент при выходе в сервис — вызывающий код не меняется.

## 2. Команда

Генератора фасада нет и не нужен. Вызываемый UC — `gen uc`, в его `callers` — `'system'` (только такие UC принимает `Facade<M>.handle`). Фасад кладётся в `ModuleFacades` при сборке модуля-потребителя.

## 3. Эталон

- [facade.ts](../../../packages/dmg-core/src/domain/contracts/facade.ts): `Facade<M>` и `SystemCallable<M>` — UC модуля с `'system'` в `callers`.
- [module-facade.ts](../../../packages/dmg-core/src/app/facade/module-facade.ts) и [module-facades.ts](../../../packages/dmg-core/src/app/facade/module-facades.ts): реализация над модулем и набор фасадов в `ModuleDeps.facades`.
- [todo.facade.test.ts](../../../packages/dmg-core/src/testing/example/app/todo/todo.facade.test.ts): учебный потребитель `showTask` — `this.call(GetTaskUcDef, …)`, `TaskAr.readonly(res.value)`. Две стороны: вместе с владельцем через `ModuleFacade`; потребитель отдельно через `StubFacade` (ответ по Def, проверка `received`: вход, `caller.from`, `caller.person()`).
- [course.module.ts](../../../packages/course/src/course.module.ts) и [questionnaire.module.ts](../../../packages/questionnaire/src/questionnaire.module.ts): модули внешних `course`/`questionnaire` над временными UC-адаптерами (TR-11); фасад — `new ModuleFacade(module)`.
- Потребитель: [create-course-wish.uc.ts](../../../packages/wish/src/wish/uc/create-course-wish.uc.ts) — `this.call(GetCourseEnrollmentUcDef, { courseId }, caller, trace)`, Def UC — в `calls` своего Def; тест — [create-course-wish.uc.test.ts](../../../packages/wish/src/wish/uc/create-course-wish.uc.test.ts) на `StubFacade`.

## 4. Чеклист правил

- API-04 — фасад только передаёт вызов UC своего модуля; выход — как у UC (данные state), `ReadonlyAr` строит вызывающий (`<A>Ar.readonly`).
- MAN-05 — у вызывающего Def вызываемого UC в `calls` (проверяется типом `call` и `checkDefs`), у вызываемого — `'system'` в `callers`.
- ARC-04 — вызывающий импортирует Def модуля и UC через контракт владельца и только по `dependsOn`.
- ARC-06 — пакет модуля не импортирует пакеты других модулей: фасад приходит через `deps.facades`.

## 5. Типичные ловушки

- Логика в фасаде или своя обёртка-класс с методами → в домен владельца или в его UC; фасад — `ModuleFacade` как есть.
- Def UC не в `calls` → ошибка типа в `this.call`; объявляй Def UC, а не фасад.
- Вызываемый UC без `'system'` в `callers` → не попадает в `SystemCallable<M>`, и `calls` его не примет по типу.
- Ручная сборка `SystemCaller` в коде потребителя → только `this.call`; руками — лишь в тесте вызываемого UC (системный вызов без человека).
- Нет фасада модуля в `ModuleFacades` → ошибка сборки: `call` бросает, база операции ловит и отвечает `SERVER_INTERNAL` с `logger.error` — штатного отказа нет, до транспорта исключение не доходит.

## 6. Как тестировать

У владельца: вызов через фасад проходит; ошибка UC приходит как есть; UC не из `calls` — ошибка типа (`@ts-expect-error`) ([todo.facade.test.ts](../../../packages/dmg-core/src/testing/example/app/todo/todo.facade.test.ts), [course.module.test.ts](../../../packages/course/src/course.module.test.ts)). У потребителя — `StubFacade<M>`: ответ и сбой по Def (`answer`), вызовы — `received`.
