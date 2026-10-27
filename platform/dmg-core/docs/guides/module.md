# Module — гайд

**Назначение:** паспорт модуля — контракт `<M>ModuleDef = ModuleDef.define(...)` (`<domain>/<m>/<m>.module.ts`), вход для остального кода `<domain>/<m>/contract.ts` и реализация — карта «Def → класс» с `create<M>Module(deps)` (`<app>/<m>/<m>.module.ts`); сборка модулей — в приложении ([app.md](./app.md)).

---

## 1. Когда применять

- Модуль есть всегда: в паспорте — `dependsOn`, агрегаты, UC, ER, Job; всё, что не перечислено, в граф и приложение не попадает (MAN-06).
- Вход для остального кода — `contract.ts` (D-45): `<M>ModuleDef`, Def UC, которые зовут снаружи, события, ошибки, VO их схем; каждый экспорт — с JSDoc «кто и зачем». Ar, Policy, DCS, ArDef и схем entity в нём нет. `index.ts` — для своего прикладного пакета.
- Зависимость реализована вне приложения (ещё не переведённый код, другой сервис) — внешний модуль `ModuleDef.define({ external: true, … })` в её `contract.ts` (D-37): агрегаты с событиями, Def UC без реализации, без ER/Job; события публикует внешняя сторона.
- Фасад — только по потребителю ([facade.md](./facade.md)): модулю без вызывающих фасад не нужен.
- Вход в UC модуля — команда (D-49): `module.dispatch(ucDef.command(input), caller, trace)`. UC модуль находит по имени из команды; неизвестное имя (команда клиента другой версии) — `Err` `OPERATION_NOT_FOUND` с `{ module, uc }`. Модуль адресует транспорт (приложение — по имени модуля), а не команда. Job — `runJob`, реакции — `subscribe`. Снаружи модуля в процессе команду отдаёт приложение (`apiApp.dispatch(moduleDef, …)`), вне процесса — `ModuleApi` (`transport.md` §4).

## 2. Команда

`dmg-core gen module <m> --write` — паспорт, контракт (только паспорт, D-45) и тест в домене, карта и тест в прикладном пакете. Строки в `useCases`/`reactions`/`jobs` и в карте дописывают `dmg-core gen uc|er|job` по маркерам `// gen:defs:*`; руками — только `dependsOn`, `label`, `description`.

## 3. Образец

- [todo.module.ts (Def)](../../src/testing/example/todo/todo.module.ts): `dependsOn: [UsersModuleDef]` из контракта `users`, пять UC, одна ER, один Job.
- [todo/contract.ts](../../src/testing/example/todo/contract.ts) и [users/contract.ts](../../src/testing/example/users/contract.ts): входы модулей с JSDoc на каждом экспорте; `users` отдаёт `GetUserUcDef` и тип ответа `UserActivity`, но не state.
- [todo.module.ts (реализация)](../../src/testing/example/app/todo/todo.module.ts): `TodoDeps = ModuleDeps & { tasks }`, `todoMap … satisfies ModuleMap<…>`, `createTodoModule(deps)` → `ModuleFromDef`.
- [example.arch.ts](../../src/testing/example/example.arch.ts): `ArchApp` учебного приложения — раскладка и `entry: 'contract'` для ARC-04.
- Минимальный модуль-владелец: [users.module.ts](../../src/testing/example/users/users.module.ts) и [реализация](../../src/testing/example/app/users/users.module.ts).

## 4. Чеклист правил

- ARC-04, ARC-05 — `dependsOn` объектами Def из контрактов, граф без циклов; импорт другого модуля — только через `contract` и только из `dependsOn`.
- ARC-06 — прикладной пакет модуля не импортирует другие прикладные пакеты: чужие модули — только `ModuleFacades` в `deps`.
- API-05 — карта типизирована `satisfies ModuleMap<typeof <M>ModuleDef, <M>Deps, …>`; класс без Def в карте — ошибка типа.
- MAN-01, MAN-06 — у паспорта `label`/`description`; каждый Def модуля в паспорте.
- MAN-05 — `calls` операций только из модулей `dependsOn` (`ArchChecker`).
- MAN-13 — один UoW — один модуль.

## 5. Типичные ловушки

- Старый обработчик и модуль на Def подписаны на одно событие одновременно — двойная обработка; при переключении старый убирается тем же изменением.
- Резолвер приложения с лишними полями вместо `ModuleDeps` платформы и своих репозиториев — модуль начинает зависеть от приложения.
- Лог операций тестов в рабочих данных → временный каталог или `MemoryOperationLog`.
- Строковое имя UC или команда, собранная руками, вместо `ucDef.command(input)` при вызове из UI; `Caller` и `Trace` строятся в одном месте входа, а не в каждой story.
- `external` у модуля с реализацией — его ER и Job не попадут в граф; `external` снимается при переводе модуля на Def, контракт остаётся.

## 6. Как тестировать

Домен — `normalize(<M>ModuleDef)` (состав паспорта) и `ArchChecker.defsOf([…]).report()` без нарушений ([todo.module.test.ts](../../src/testing/example/todo/todo.module.test.ts), [users.module.test.ts](../../src/testing/example/users/users.module.test.ts)). Прикладной пакет — модуль на настоящем репозитории во временном каталоге, фасады — `StubFacade` по Def, вызовы через `dispatch` команды, `runJob`, доставка события через `subscribe` ([todo.module.test.ts](../../src/testing/example/app/todo/todo.module.test.ts)).
