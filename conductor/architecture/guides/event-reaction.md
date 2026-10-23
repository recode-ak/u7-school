# Event reaction — гайд

**Назначение:** реакция модуля на событие — контракт `<N>ErDef = defineEventReaction(...)` (`packages/domain/src/<m>/<a>/er/<n>.er.ts`) и реализация `<N>Er extends ReactionFromDef` (`packages/<m>/src/<a>/er/<n>.er.ts`).

---

## 1. Когда применять

- Свой агрегат меняется в ответ на событие своего или чужого модуля (`on` — Def события из `contract.ts` владельца; legacy-событие доставляет карта `inbound`, D-37). Действие вызывающего — UC ([use-case.md](./use-case.md)).
- ER техничен (API-01): загрузить → отдать домену → `uow.register`. Что менять и что спросить у чужого модуля — домен: метод Ar для одного агрегата, DCS для батча по нескольким ([repo.md](./repo.md), DOM-06).
- Вызывающего нет: база строит `SystemCaller` этой ER без человека, `Trace.fromEvent` (причина — событие). Policy нет, `callers` нет.
- Чужой модуль — только `this.call` по Def из `calls` (UC с `'system'` в `callers`, D-43).

## 2. Команда

`bun run gen er <m>.<a> <имя> --write` — пара Def + реализация с тестами, строка в `<M>ModuleDef.reactions` и в карте модуля. Заполнить: `label`/`description`, `on`, `touches`, `calls`, `emits`; тест-заготовку «привязана к Def» заменить содержательными.

## 3. Устройство реализации

- Конструктор `(deps, module: typeof <M>ModuleDef)` → `super(<N>ErDef, deps, module)`.
- Наследник пишет только `react(event, uow, caller, trace)` → `Result<void, DomainError>`. Фиксацию UoW после `Ok`, `logger.error` отказа, перехват исключения (`SERVER_INTERNAL`) и запись в лог операций делает база (`handle`, `runLogged`, `journal`) — `try/catch` и `console.*` в ER нет.
- `caller` и `trace` передаются в `this.call` как пришли — цепочка следа продолжается.
- Регистрация агрегата вне `touches` и событие вне `emits` — сверка UoW по Def (`createUow`): исключение, в production — `warn`.
- Идемпотентность — из домена: повторное событие находит агрегаты уже в конечном статусе, предикат Ar (`canFulfill`) их отсекает; ER статусы не сравнивает.
- Подписка — `ModuleFromDef.subscribe()` на шине приложения; ER в приложение не подписывают вручную.

## 4. Эталон

- [fulfill-wish.er.ts (Def)](../../../packages/domain/src/wish/wish/er/fulfill-wish.er.ts): `on: [StudentEvents.enrolled]` (событие внешнего `stream`), `touches: [WishArDef]`, `calls` — два query внешнего `course`, `emits` нет.
- [fulfill-wish.er.ts (реализация)](../../../packages/wish/src/wish/er/fulfill-wish.er.ts): `findByUser` → `WishFulfillmentDcs` → `ask(question())` (`this.call` только на вопросы, что вернул домен; course — один батч) → `fulfill(answer, this.now())` → `uow.register` каждого изменённого.
- [wish-fulfillment.dcs.ts](../../../packages/domain/src/wish/wish-fulfillment.dcs.ts): «вопрос → ответ» по образцу Р10; вопрос — готовый вход UC курса, ответ — их выходы ([wish-fulfillment.types.ts](../../../packages/domain/src/wish/wish-fulfillment.types.ts)). Что реализуемо и совпала ли цель — `WishAr.fulfillmentTargets()`, `isFulfilledBy()`.
- Внешние UC зависимостей и их адаптеры над legacy — [get-courses-including-module.uc.ts](../../../packages/domain/src/course/course/uc/get-courses-including-module.uc.ts), [адаптер](../../../packages/course/src/course/uc/get-courses-including-module.uc.ts) (TR-11).
- Учебный образец без вызовов — [archive-removed-user-tasks.er.ts](../../../packages/dmg-core/src/testing/example/app/todo/task/er/archive-removed-user-tasks.er.ts).

## 5. Чеклист правил

- API-01 — в ER нет `if` по state, статусу, виду цели; ветвление только по ответу домена (есть вопрос → вызвать).
- API-02 — запись через `uow.register`, ручного `save`/`publish` нет.
- API-05 — реализация наследует `ReactionFromDef`, свойства Def не повторяются (MAN-09).
- MAN-04 — публикуются только события из `emits`; MAN-05 — каждый `this.call` покрыт `calls`.
- DOM-06 — батч по нескольким агрегатам — DCS, не цикл с решениями в ER.
- DOM-17 — ER не читает `snapshot()`/`view()` ради решения; спрашивает Ar.
- ERR-06 — каждый `Err` домена и `this.call` возвращается явно; исключение — только сбой.

## 6. Типичные ловушки

- ER делит агрегаты по виду цели через `snapshot().target.kind` → метод Ar (`fulfillmentTargets`) и DCS.
- Вызов чужого модуля в цикле по агрегатам → один батч-UC (`getSameModules` вместо `isSameModule`, TR-18).
- `Date.now()`, `throw`, `console.error` из legacy → `this.now()`, `Result`, лог базы.
- Сохранение части агрегатов до сбоя вызова (legacy) → UoW атомарен: отказ любого вызова — ничего не записано (TR-18 п. 3).
- Вызов курса при пустом наборе кандидатов → домен не задаёт вопрос, ER не вызывает.

## 7. Как тестировать

Каждый случай legacy-реакции; повторное событие — ни записи, ни вызовов; нет кандидатов — вызовов нет (`StubFacade.received`); отказ и исключение чужого UC — `SERVER_INTERNAL`/ошибка, ничего не записано, `logger.error` с именем ER, запись в `MemoryOperationLog`; доставка через `subscribe` на `memoryBus`. Репозиторий — настоящий во временном каталоге ([fulfill-wish.er.test.ts](../../../packages/wish/src/wish/er/fulfill-wish.er.test.ts)); домен — unit-тесты DCS ([wish-fulfillment.dcs.test.ts](../../../packages/domain/src/wish/wish-fulfillment.dcs.test.ts)). Общее — [testing.md](../testing.md).
