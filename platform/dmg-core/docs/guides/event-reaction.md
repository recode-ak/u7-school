# Event reaction — гайд

**Назначение:** реакция модуля на событие — контракт `<N>ErDef = EventReactionDef.define(...)` (`<domain>/<m>/<a>/er/<n>.er.ts`) и реализация `<N>Er extends ReactionFromDef` (`<app>/<m>/<a>/er/<n>.er.ts`).

---

## 1. Когда применять

- Свой агрегат меняется в ответ на событие своего или чужого модуля (`on` — Def события из `contract.ts` владельца; события внешнего модуля, D-37). Действие вызывающего — UC ([use-case.md](./use-case.md)).
- ER техничен (API-01): загрузить → отдать домену → `uow.register`. Что менять — домен: метод Ar для одного агрегата, DCS для нескольких ([repo.md](./repo.md), DOM-06).
- Вызывающего нет: база строит `SystemCaller` этой ER без человека, `Trace.fromEvent` (причина — событие). Policy нет, `callers` нет.
- Чужой модуль — только `this.call` по Def из `calls` (UC с `'system'` в `callers`, D-43).

## 2. Команда

`dmg-core gen er <m>.<a> <имя> --write` — пара Def + реализация с тестами, строка в `<M>ModuleDef.reactions` и в карте модуля. Заполнить: `label`/`description`, `on`, `touches`, `calls`, `emits`.

## 3. Устройство реализации

- Конструктор `(deps, module: typeof <M>ModuleDef)` → `super(<N>ErDef, deps, module)`.
- Наследник пишет только `react(event, uow, caller, trace)` → `Result<void, …>` (вспомогательные `private`-методы — по месту). Фиксацию UoW после `Ok`, `logger.error` отказа, перехват исключения (`SERVER_INTERNAL`) и запись в лог операций делает база — `try/catch` и `console.*` в ER нет.
- `caller` и `trace` передаются в `this.call` как пришли — цепочка следа продолжается.
- Регистрация агрегата вне `touches` и событие вне `emits` — сверка UoW по Def: исключение в test/dev, в production — `warn` (ERR-07).
- **Идемпотентность.** Повторную доставку того же `eventId` отсекает порт `Inbox` (D-47). Повтор того же факта с новым `eventId` — забота домена: агрегаты уже в конечном состоянии, их операции возвращают `ok` без изменений или пропускаются по ответу Ar; ER статусы не сравнивает.
- «Вопрос → ответ»: если решению нужны данные чужого модуля, DCS отдаёт вопрос (вход UC), ER задаёт его через `this.call` и передаёт ответ обратно в DCS; пустой вопрос — без вызова.
- Подписка — `ModuleFromDef.subscribe()` на шине приложения; `<N>Er.subscribe(bus)` напрямую — только в тестах.

## 4. Образец

- [release-removed-user-tasks.er.ts (Def)](../../src/testing/example/todo/task/er/release-removed-user-tasks.er.ts): `on: [UserEvents.removed]` (событие модуля `users` из его контракта), `touches: [TaskArDef]`, `emits` — `archived` и `unassigned`.
- [release-removed-user-tasks.er.ts (реализация)](../../src/testing/example/app/todo/task/er/release-removed-user-tasks.er.ts): одна выборка `findActiveByParticipant` → `TaskReleaseDcs.release(this.now())` → `uow.register` каждой изменённой задачи.
- [task-release.dcs.ts](../../src/testing/example/todo/task-release.dcs.ts): решение по каждой задаче принимает её Ar; повтор ничего не меняет.
- [release-removed-user-tasks.er.test.ts](../../src/testing/example/app/todo/task/er/release-removed-user-tasks.er.test.ts): обе группы задач, «своя и назначена себе», пусто, `expectIdempotentReaction` (`dmg-core/testing`).

## 5. Чеклист правил

- API-01 — в ER нет `if` по state, статусу, виду цели; ветвление только по ответу домена.
- API-02 — запись через `uow.register`, ручного `save`/`publish` нет.
- API-05 — реализация наследует `ReactionFromDef`, свойства Def не повторяются (MAN-09).
- MAN-04 — публикуются только события из `emits`; MAN-05 — ER трогает только `touches`, каждый `this.call` покрыт `calls`.
- MAN-13 — `touches` — агрегаты своего модуля; чужой модуль меняется только его фасадом или событием.
- DOM-06 — батч по нескольким агрегатам — DCS, не цикл с решениями в ER.
- DOM-17 — ER не читает `snapshot()`/`view()` ради решения; спрашивает Ar.
- ERR-06 — каждый `Err` домена и `this.call` возвращается явно; исключение — только сбой.

## 6. Типичные ловушки

- ER делит агрегаты по полям через `snapshot()` → метод Ar и DCS.
- Две выборки и склейка по uuid в ER → одна выборка порта под потребителя.
- Вызов чужого модуля в цикле по агрегатам → один батч-UC владельца.
- `Date.now()`, `throw`, `console.error` → `this.now()`, `Result`, лог базы.
- Сохранение части агрегатов до сбоя вызова → UoW фиксирует только после `Ok`: отказ любого вызова — ничего не записано.
- `<A>Events.<e>.make` в ER при изменении своего агрегата → событие порождает Ar; ER строит событие только для факта без мутации.

## 7. Как тестировать

Каждый случай реакции; повторное событие — ни записи, ни вызовов (`expectIdempotentReaction`); нет кандидатов — вызовов нет (`StubFacade.received`); отказ и исключение чужого UC — ошибка или `SERVER_INTERNAL`, ничего не записано, `logger.error` с именем ER, запись в `MemoryOperationLog`; доставка через `subscribe` на `MemoryBus`. Репозиторий — настоящий во временном каталоге; домен — unit-тесты DCS ([task-release.dcs.test.ts](../../src/testing/example/todo/task-release.dcs.test.ts)). Общее — [testing.md](../testing.md).
