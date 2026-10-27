# Use case — гайд

**Назначение:** операция модуля для вызывающего — контракт `<N>UcDef = UseCaseDef.define(...)` (`<domain>/<m>/<a>/uc/<n>.uc.ts`) и реализация `<N>Uc extends UseCaseFromDef` (`<app>/<m>/<a>/uc/<n>.uc.ts`).

---

## 1. Когда применять

- Действие пользователя, транспорта или другого модуля над агрегатом модуля: command меняет состояние, query только читает (отличия — §4).
- UC техничен (API-01, D-08): загрузить → отдать домену → `uow.register`. Решение по состоянию, входу или ответу чужого модуля — в домене: право субъекта — Policy ([policy.md](./policy.md)), допустимость без субъекта — доменное правило в `rules`, выбор статуса и данных — метод Ar ([aggregate.md](./aggregate.md)).
- Реакция на событие — не UC, а ER ([event-reaction.md](./event-reaction.md)).
- Вызов другого модуля — `this.call(Def, input, caller, trace)` базы `OperationFromDef`, Def вызываемого UC — в `calls` (D-43, [facade.md](./facade.md)).
- **Побочный эффект в чужом модуле** (command через фасад) — место выбирает владелец проекта по каждому случаю: (1) вызов в `execute` после `uow.register`, до фиксации — эффект, без которого команда не выполнена; риск — эффект без записи при сбое фиксации; (2) событие своего модуля → ER, вызывающая фасад после фиксации — реакция на факт; риск — запись без эффекта, если ER упала. Выбор и принятый риск записываются рядом с кодом.
- Вход снаружи — только команда `ModuleFromDef.dispatch(ucDef.command(input), caller, trace)` (D-49): транспорт адресует модуль и строит `Caller` и `Trace` ([caller.md](../caller.md)).

## 2. Команда

`dmg-core gen uc <m>.<a> <имя> --write` — пара Def + реализация с тестами, строка в `<M>ModuleDef.useCases` и в карте модуля. Требует `<m>.module.ts`. Заполнить: `label`/`description`, `callers`, `policy`, `rules`, `calls`, схемы, `errors`, `emits`.

## 3. Устройство реализации

- Конструктор `(deps, module: typeof <M>ModuleDef)` → `super(<N>UcDef, deps, module)`: модуль передаёт себя, из него — `this.ref` для `SystemCaller` и лога операций.
- Шаги базы — `protected`, порядок фиксирован: `checkCaller` → `parseInput` → `load` → `checkPolicy` → `checkRules` → `execute` → `parseOutput` → фиксация (`uow.commit()`, публикация через outbox, запись в `OperationLog` — инвариант базы). Наследник пишет `load` и `execute` методами; переопределение `checkPolicy` — только для системного вызова без субъекта.
- `load(input, caller, trace)` собирает контекст Policy и правил; `execute(input, loaded, uow, caller, trace)` — домен и `uow.register`. `caller` и `trace` передаются в `this.call` как пришли.
- Субъект — `this.subject(caller)`, время — `this.now()`; UoW создаёт база.

## 4. Command и query

| | command | query |
|---|---|---|
| `type` | `'command'` | `'query'` |
| `load` | агрегат(ы) и ответы зависимостей — контекст Policy и `rules` | контекст Policy, если он нужен; иначе `ok(undefined)` |
| `execute` | метод Ar → `uow.register`; ошибка Ar — `return` как есть | чтение репозитория → выход; `uow` не трогается |
| `rules`, `emits` | по смыслу | нет |
| выход | ответ методом Ar или `{}` | форма из state (`v.pick`, без копии схемы), значение — `view()` (D-44; `snapshot()` — только репозиторий, DOM-17) |

- Нет агрегата при загрузке → `NOT_FOUND` из `load` (отказ загрузки, не решение по состоянию): Policy требует агрегат в контексте.
- Отказ, который правило отсекает раньше, но который возвращает операция Ar, всё равно стоит в `errors` (ERR-02); подменять его в UC другой ошибкой нельзя.
- Субъект query — только свои данные: `ownerId` из `this.subject(caller)`, не из входа; `policy: allowAll`.

## 5. Образец

- Command с вызовом чужого модуля: [assign-task.uc.ts (Def)](../../src/testing/example/todo/task/uc/assign-task.uc.ts) — `policy: canManage`, `rules: [assigneeActive]`, `calls: [GetUserUcDef]`, `UserErrors.NOT_FOUND` по ссылке, `emits` — оба события назначения; [реализация](../../src/testing/example/app/todo/task/uc/assign-task.uc.ts) — `load` кладёт задачу и ответ `users` в контекст, `execute` — `TaskAr.assign` → `uow.register`.
- Command с доменным правилом при создании: [create-task.uc.ts (Def)](../../src/testing/example/todo/task/uc/create-task.uc.ts) — `allowAll`, `rules: [withinOpenLimit]`; [реализация](../../src/testing/example/app/todo/task/uc/create-task.uc.ts) — владелец из `this.subject(caller)`.
- Command над агрегатом с Policy: [complete-task.uc.ts](../../src/testing/example/app/todo/task/uc/complete-task.uc.ts).
- Query субъекта: [list-tasks.uc.ts (Def)](../../src/testing/example/todo/task/uc/list-tasks.uc.ts) (`v.array(v.pick(TaskState, …))`) и [реализация](../../src/testing/example/app/todo/task/uc/list-tasks.uc.ts) (`task.view()`); query для других модулей — [get-task.uc.ts](../../src/testing/example/app/todo/task/uc/get-task.uc.ts), [get-user.uc.ts](../../src/testing/example/app/users/user/uc/get-user.uc.ts).
- [todo.module.ts (карта)](../../src/testing/example/app/todo/todo.module.ts): `TodoDeps = ModuleDeps & { tasks }` — фасады зависимостей уже в `ModuleDeps.facades`.

## 6. Чеклист правил

- API-01 — в UC нет `if` по состоянию, статусу, входу; ветвление только по `Result` и ответу метода-вопроса Ar.
- API-02 — сохранение через `uow.register`, ручного `save`/`publish` нет.
- API-05 — реализация наследует `UseCaseFromDef`, свойства Def не повторяются (MAN-09).
- MAN-04 — публикуются только события из `emits`.
- MAN-05 — каждый `this.call` покрыт `calls` (иначе ошибка типа); вызываемый UC объявляет `'system'` в `callers`.
- MAN-11 — `callers` объявлены; субъект — через `this.subject(caller)`, не через `kind`; Policy вызывается всегда.
- DOM-17 — состояние агрегата наружу — `view()`, не `snapshot()`.
- ERR-02 — ошибки каждого правила и проброшенные ошибки зависимостей — в `errors`.
- DOM-16 — правило возвращает ошибку своей группы.

## 7. Типичные ловушки

- Решение «исполнитель неактивен → ошибка» в `load` через `if` → доменное правило в `rules`, `load` только кладёт ответ в контекст.
- Вызов чужого модуля в `load` идёт до Policy: не-владелец узнаёт, есть ли пользователь, и тратит вызов. Это порядок жизненного цикла платформы; если ответ зависимости сам секретен, проверку права без контекста вынеси в отдельный UC или правило до вызова.
- UC знает, что передать в чужой контракт или какой ответ вернуть → это отвечает Ar методом из state.
- Ручной `new SystemCaller(...)` в UC → только `this.call`.
- `load`/`execute` полем-стрелкой (`protected load = async () => …`) → методом: это шаги базы.
- Тест собирает реальные адаптеры чужих пакетов → ARC-06; в тесте UC — `StubFacade` по Def модуля из контракта, связку проверяют тесты фасада владельца.
- Существующие записи в тесте сохраняются через `restore` + `save` → `VersionConflict`; создавай через `create` + UoW или пиши файл фикстуры.

## 8. Как тестировать

Каждая ошибка UC — с `code` и «ничего не записано»; порядок отказов (первый при нарушении нескольких); каждый исход выхода; сбой вызова чужого модуля (`StubFacade.answer` с ошибкой) — ответ UC и отсутствие записи; вызовы чужих UC — `received` (`SystemCaller` от UC, человек исходного вызова); недопустимый вызывающий — `UNAUTHORIZED`; у query — «ничего не записано» и только данные субъекта; у command над агрегатом — отказ Policy (`ACCESS_DENIED`) и каждый недопустимый статус. Репозиторий — настоящий во временном каталоге ([assign-task.uc.test.ts](../../src/testing/example/app/todo/task/uc/assign-task.uc.test.ts)); вход через модуль — smoke [todo.module.test.ts](../../src/testing/example/app/todo/todo.module.test.ts); лог операций — `MemoryOperationLog` из `testAppContext()`. Общее — [testing.md](../testing.md).
