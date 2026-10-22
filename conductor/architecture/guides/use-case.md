# Use case — гайд

**Назначение:** операция модуля для вызывающего — контракт `<N>UcDef = defineUseCase(...)` (`packages/domain/src/<m>/<a>/uc/<n>.uc.ts`) и реализация `<N>Uc extends UseCaseFromDef` (`packages/<m>/src/<a>/uc/<n>.uc.ts`).

---

## 1. Когда применять

- Действие пользователя, транспорта или другого модуля над агрегатом модуля: command меняет состояние, query только читает (отличия — §4).
- UC техничен (API-01, D-08): загрузить → отдать домену → `uow.register`. Решение по состоянию, входу или ответу чужого модуля — в домене: право субъекта — Policy ([policy.md](./policy.md)), допустимость без субъекта — доменное правило в `rules`, выбор статуса и данных — метод Ar ([aggregate.md](./aggregate.md)).
- Реакция на событие — не UC, а ER (Ф10).
- Вызов другого модуля — `this.call(Def, input, caller, trace)` базы `OperationFromDef`, Def вызываемого UC — в `calls` (D-43, [facade.md](./facade.md)). Побочный эффект в чужом модуле — место выбирает Нурболат по каждому случаю (D-41).
- Вход снаружи — только `ModuleFromDef.handle(def, input, caller, trace)`: транспорт строит `Caller` и `Trace` ([caller.md](../caller.md)).

## 2. Команда

`bun run gen uc <m>.<a> <имя> --write` — пара Def + реализация с тестами, строка в `<M>ModuleDef.useCases` и в карте модуля. Требует `<m>.module.ts` (`gen module <m> [--adopt]`). Заполнить: `label`/`description`, `callers`, `policy`, `rules`, `calls`, схемы, `errors`, `emits` (заготовка ссылается на несуществующее событие — замени или убери).

## 3. Устройство реализации

- Конструктор `(deps, module: typeof <M>ModuleDef)` → `super(<N>UcDef, deps, module)`: модуль передаёт себя (`ModuleMap` создаёт `new (deps, module)`), из него — `this.ref` для `SystemCaller` и лога операций.
- Шаги базы — `protected`, порядок фиксирован: `checkCaller` → `parseInput` → `load` → `checkPolicy` → `checkRules` → `execute` → `parseOutput` → фиксация (приватная: `uow.commit()`, публикация, запись в `OperationLog` через `journal` базы — инвариант, наследник UC его не вызывает). Наследник пишет `load` и `execute` методами; переопределение `checkPolicy` — только для системного вызова без субъекта, ответственность наследника.
- `load(input, caller, trace)` собирает контекст Policy и правил; `execute(input, loaded, uow, caller, trace)` — домен и `uow.register`. `caller` и `trace` передаются в `this.call` как пришли.
- Субъект — `this.subject(caller)`, время — `this.now()`; UoW создаёт база (`createUow(trace)`).

## 4. Command и query

| | command | query |
|---|---|---|
| `type` | `'command'` | `'query'` |
| `load` | агрегат(ы) и ответы зависимостей — контекст Policy и `rules` | контекст Policy, если он нужен; иначе `ok(undefined)` |
| `execute` | метод Ar → `uow.register`; ошибка перехода — `return` как есть | чтение репозитория → выход; `uow` не трогается |
| `rules`, `emits` | по смыслу | нет |
| выход | ответ из state методом Ar (`outcome()`) или `{}` | state агрегата (`v.array(<A>ArDef.state)`, без копии схемы), `snapshot()` → схема `output` отбрасывает лишнее |

- Нет агрегата при загрузке → `NOT_FOUND` из `load` (отказ загрузки, не решение по состоянию): Policy требует агрегат в контексте. Агрегат есть, но действие недопустимо по статусу → доменное правило в `rules` (`cancellable`), а не `if` в UC.
- Отказ, который правило отсекает раньше, но который возвращает переход Ar, всё равно стоит в `errors` (ERR-02) с пометкой «через UC недостижим»; подменять его в UC другой ошибкой нельзя.
- Субъект query — только свои данные: `userId` из `this.subject(caller)`, не из входа; `policy: allowAll`.

## 5. Эталон

- [create-course-wish.uc.ts (Def)](../../../packages/domain/src/wish/wish/uc/create-course-wish.uc.ts): `rules: [courseEnrollable, unique]` — порядок правил = порядок отказов; `calls` на UC внешних `course`/`questionnaire`; вход — из state (`WishCourseTargetVo`, D-39); `emits` нет — события создания нет.
- [create-course-wish.uc.ts (реализация)](../../../packages/wish/src/wish/uc/create-course-wish.uc.ts): `load` — `enrollment` через `this.call(GetCourseEnrollmentUcDef, …)`, желания из репозитория; `execute` — `WishAr.createForCourse` (`Result<WishAr, never>`) → `uow.register(wish)` → `wish.questionnaire()` и запуск анкеты через `this.call` до фиксации (D-41, вариант 1) → `ok({ outcome: wish.outcome() })`.
- [wish.rules.ts](../../../packages/domain/src/wish/wish/wish.rules.ts): правило над ответом чужого модуля (`courseEnrollable`) и над агрегатами (`unique`).
- Второй command — [create-module-wish.uc.ts](../../../packages/wish/src/wish/uc/create-module-wish.uc.ts) (правило над ответом курса без анкеты); command над существующим агрегатом с Policy — [cancel-wish.uc.ts (Def)](../../../packages/domain/src/wish/wish/uc/cancel-wish.uc.ts) и [реализация](../../../packages/wish/src/wish/uc/cancel-wish.uc.ts); query — [list-user-wishes.uc.ts](../../../packages/wish/src/wish/uc/list-user-wishes.uc.ts).
- [wish.module.ts (карта)](../../../packages/wish/src/wish.module.ts): `WishDeps = ModuleDeps & { wishes }` — фасады зависимостей уже в `ModuleDeps.facades`; субъект модуля.

## 6. Чеклист правил

- API-01 — в UC нет `if` по состоянию, статусу, входу; ветвление только по ответу метода-вопроса Ar.
- API-02 — сохранение через `uow.register`, ручного `save`/`publish` нет.
- API-05 — реализация наследует `UseCaseFromDef`, свойства Def не повторяются (MAN-09).
- MAN-04 — публикуются только события из `emits`.
- MAN-05 — каждый `this.call` покрыт `calls` (иначе ошибка типа); вызываемый UC объявляет `'system'` в `callers`; в тесте — `StubFacade<M>` с проверкой `received`.
- MAN-11 — `callers` объявлены; субъект — через `this.subject(caller)`, не через `kind`; Policy вызывается всегда.
- ERR-02 — ошибки каждого правила и проброшенные ошибки зависимостей — в `errors`.
- DOM-16 — правило возвращает ошибку своей группы.

## 7. Типичные ловушки

- Решение «курс недоступен → ошибка» в `load` через `if` → доменное правило в `rules`, `load` только кладёт ответ в контекст.
- Выбор статуса по пулу в UC → фабрика Ar (`createForCourse`) решает сама.
- UC знает, что передать в чужой контракт (`{ courseId }`) или какой `outcome` вернуть → это отвечает Ar методом-вопросом из state (`wish.questionnaire()`, `wish.outcome()`).
- Данные «что сделать после создания» в поле Ar вне state или в отдельном результате фабрики → скрытое состояние; фабрика возвращает `Result<Ar, …>`, ответ выводится из state (D-43, Р10).
- Ручной `new SystemCaller(...)` в UC → только `this.call`.
- `load`/`execute` полем-стрелкой (`protected load = async () => …`) → методом: это шаги базы.
- Тест собирает реальные адаптеры чужих пакетов → ARC-06; в тесте UC — `StubFacade` по Def модуля из контракта, связку проверяют тесты фасада владельца.
- Существующие записи в тесте сохраняются через `restore` + `save` → `VersionConflict`; пиши файл фикстуры или создавай через `create` + UoW.

## 8. Как тестировать

Каждая ошибка UC — с `code` и «ничего не записано»; порядок правил (отказ первого при нарушении обоих); каждый исход выхода; сбой вызова чужого модуля (`StubFacade.answer` с ошибкой) — ответ UC и отсутствие записи; вызовы чужих UC — `received`; недопустимый вызывающий — `UNAUTHORIZED`; у query — «ничего не записано» и только данные субъекта; у command над агрегатом — отказ Policy (`ACCESS_DENIED`) и каждый недопустимый статус. Репозиторий — настоящий во временном каталоге ([create-course-wish.uc.test.ts](../../../packages/wish/src/wish/uc/create-course-wish.uc.test.ts)); вход через модуль (`create<M>Module(deps).handle`) — smoke [wish.module.test.ts](../../../packages/wish/src/wish.module.test.ts); лог операций в тестах — `MemoryOperationLog` из `testAppContext()`. Общее — [testing.md](../testing.md).
