# Facade — гайд

**Назначение:** рантайм-граница модуля для других модулей без манифеста (D-42) — тип `<M>Facade` (у внешних модулей на время перехода — `<M>ModuleFacade`, TR-11) в домене владельца (`packages/domain/src/<m>/<m>.facade.ts`) и реализация над UC модуля (`packages/<m>/src/<m>.facade.ts`).

---

## 1. Когда применять

- Другой модуль (UC/ER/Job, у которого этот модуль в `dependsOn`) вызывает UC этого модуля. Связь объявляет вызывающий: Def вызываемого UC — в его `calls`; граф строит ребро «UC → UC», фасада в графе нет.
- Метод фасада — обёртка над одним UC своего модуля: несложные преобразования входа и выхода допустимы, доменные решения — нет (их делают UC и домен владельца, API-04).
- UI и внешние адаптеры фасад не используют: они вызывают UC через `appApi` (ARC-08).
- Вызов, меняющий чужой модуль (command), — место выбирает Нурболат по каждому случаю (D-41): в `execute` до фиксации или событием и ER.
- Фасад отвязывает модули: in-proc сейчас, сетевой клиент при выходе в сервис — вызывающий код не меняется.

## 2. Команда

Генератора фасада нет: тип и реализация пишутся по эталону. Вызываемый UC — `gen uc`, в его `callers` — `module`.

## 3. Эталон

- [facade.ts](../../../packages/dmg-core/src/domain/contracts/facade.ts): `Facade<M>` — тип фасада модуля в домене, `handle` только UC с `'system'` в `callers` (D-43). Свои типы фасадов модули не заводят.
- [module-facade.ts](../../../packages/dmg-core/src/app/facade/module-facade.ts): `ModuleFacade<M>` — обёртка над `ModuleFromDef.handle`; потребитель вызывает чужой UC `this.call(Def, input, caller, trace)` (`OperationFromDef`). Переписывается на шаге 10 Ф8а.
- [course.module.ts](../../../packages/course/src/course.module.ts) и [questionnaire.module.ts](../../../packages/questionnaire/src/questionnaire.module.ts): модули внешних `course`/`questionnaire` над временными UC-адаптерами (TR-11); фасад — `new ModuleFacade(module)`.
- Потребитель: [create-course-wish.uc.ts](../../../packages/wish/src/wish/uc/create-course-wish.uc.ts) — `this.callContext(caller, trace)`, Def UC — в `calls` своего Def.

## 4. Чеклист правил

- API-04 — метод вызывает UC своего модуля, без доменных решений; `Result`, state — как `ReadonlyAr`.
- MAN-05 — у вызывающего Def вызываемого UC в `calls`, у вызываемого — `module` в `callers`.
- ARC-04 — вызывающий импортирует тип фасада через контракт модуля и только по `dependsOn`.
- ARC-06 — пакет модуля не импортирует пакеты других модулей: фасад приходит через резолвер.

## 5. Типичные ловушки

- Логика в фасаде (ветвление по ответу UC) → в домен владельца или в его UC.
- Вызов без `calls` → `UNAUTHORIZED` в рантайме (`checkDefs` проверяет только объявленное в `calls`); объявляй Def UC, а не фасад. Тест потребителя ловит пропуск только через фейк фасада, сверяющий `calls`.
- Ручная сборка `Caller` в фасаде → только через `callUseCase`.

## 6. Как тестировать

У владельца: вызов через фасад проходит; ошибка UC приходит как есть; вызов не из `calls` — `UNAUTHORIZED` ([todo.facade.test.ts](../../../packages/dmg-core/src/testing/example/app/todo/todo.facade.test.ts), [course.module.test.ts](../../../packages/course/src/course.module.test.ts)); UC не из `calls` — ошибка типа (`@ts-expect-error`). У потребителя — `StubFacade<M>` из `dmg-core/testing`.
