# Спецификация: dmg-core-oop

## Обзор

Рефакторинг платформы `dmg-core` в ООП: Def становятся классами с поведением вместо литералов `{ ...spec, dmg: '<вид>' }` и `switch` по `dmg` в чужих местах. Поведение не меняется. Это платформенный эталон: модель Opus, TDD red → green по шагам.

Основание — бриф `TRACK-DMG-CORE-OOP.md` (перенесён в эту спеку и удалён в Фазе 7; решено с Нурболатом 2026-10-21 при разборе вопросов после Ф8 `golden-wish`, Р8 → D-43). Ф8а (вызовы и граница модуля) в трек не входит. Команды и dispatch вынесены в трек [command-dispatch](../command-dispatch_20261027/).

## Принципы (не переспрашивать)

1. **ООП, а не россыпь функций.** У объекта явная зона ответственности, своё состояние спрятано внутри, клиенты работают через его API. Набор свободных функций вокруг типа-данных считается антипаттерном.
2. **Хелпер-функция допустима только в двух случаях:**
   - универсальная утилита, нужная в самых разных местах (даты, `ok`/`err`, `serializeError`, `toJsonSchema`, `expectOk`/`expectErr`);
   - специализированную логику используют две несвязанные иерархии, а общий предок для них неуместен.

   Даже тогда хелпера по возможности избегаем — часто подходит композиция с объектом-классом.
3. **Полиморфизм вместо `switch` по виду.** Если код ветвится по `def.dmg` или `rule.op`, поведение живёт в классе этого вида.
4. **Статические методы базы с полиморфным `this`, а не код в каждом наследнике.** Образец — `Aggregate.readonly(state)`: `static readonly<S, A>(this: { restore(s: S): A }, state: S): ReadonlyAr<A>`. Исключение — `define` (решено 2026-10-27 по итогам прототипа Фазы 0): объявляется в каждом виде, см. п.1.

## Функциональные требования

### 1. Def — классы

Все 11 видов: `error`, `event`, `aggregate`, `rule`, `policy`, `domainRule`, `rules`, `useCase`, `eventReaction`, `job`, `module`.

Иерархия: базовый `Def` (`name`, `label`, `description`, `describe()`, `normalize()`) → `OperationDef` (общая база UC/ER/Job: `calls`, `aggregates()`, `errors()`, `title(module)`, `fileKind`, `mainAggregate()`) → конкретные виды.

- **DSL:** `UseCaseDef.define(spec)` — `static define<const S extends XxxSpec>(spec): XxxDef<S>` в каждом виде (одна строка `new XxxDef(spec)`); у базы `Def` метода `define` нет. Причина: `define` базы с полиморфным `this` теряет литеральные типы (у TS нет higher-kinded типов) и несовместим со статикой вида (TS2417) — показал прототип Фазы 0 (решено с Нурболатом 2026-10-27). Функции `define*` удаляются; перевод `domain/` и `modules/<m>` входит в трек.
- **`Any*Def`** — структурный тип публичных членов класса (`{ readonly [K in keyof XxxDef]: XxxDef[K] }`), а не `XxxDef<Spec>`: необязательные списки спеки дают условный тип поля, и вариантность параметра `S` неизмерима.
- **`calls`** — одно обязательное поле у всех операций, нормализуется в конструкторе.

| Место | Сейчас | Станет |
|---|---|---|
| `graph/normalize.ts` | `switch` по 11 видам и по `rule.op` | `def.normalize()` |
| `arch/described-defs.ts` | описание и схемы каждого вида (MAN-01/02/03) | `def.describe()` |
| `arch/check-defs.ts` | 3 `switch` по виду операции (ошибки UC, `on` у ER, `aggregatesOf`) | `op.aggregates()`, `op.errors()`, проверки вида внутри класса |
| `arch/check-files.ts` | `OPERATION_DIR[op.dmg]`, главный агрегат тернарником | `op.fileKind`, `op.mainAggregate()` |
| `graph/def-index.ts` `callsOf` | `calls` у UC необязательный, у ER/Job обязательный | одно поле `calls` |
| `OPERATION_KIND` и заголовки сообщений | таблица по виду | `op.title(module)` |
| `gen/kinds/*` | `switch (c.kind)` в `operation.ts` | шаблон вида — класс в `gen` (`UseCaseTemplate`, …) |

Задел на будущее (каждая возможность — метод вида, а не новый `switch`): генерация документации, хеш контракта (D-27), JSON Schema/OpenAPI для транспортов, MCP-инструменты из Def UC, формы UI по `input`, сравнение контрактов при выносе модуля в сервис.

### 2. Требования к типам

Проверяются тестами типов (`@ts-expect-error`) **до** переноса:

- вывод литеральных типов (`const S`) сохраняется: `D['calls'][number]`, `D['policy']`, `M['useCases'][number]`, `InputOf<D>` работают как сейчас;
- у Def нет `private`/`#` полей (иначе типизация номинальная и ломает `Any*Def`);
- поля объявлены явно, не через `Object.assign`;
- сравнение по ссылке (`includes`, ключи `Map`) не меняется.

### 3. Иерархия `Rule`

`rule`, `allOf`, `anyOf`, `hasRole`, `allowAll`, `denied` → абстрактный `Rule` с наследниками `NamedRule`, `AllOfRule`, `AnyOfRule`, `AllowAll` и статическими фабриками (`Rule.of(…)`, `Rule.allOf(…)`, `Rule.anyOf(…)`, `Rule.hasRole(…)`). Сигнатура `evaluate(subject, ctx)` — как после Ф8а (Р2).

### 4. `DefIndex`

`indexDefs`, `operationsOf`, `callsOf`, `localId`, `ruleId` → класс `DefIndex.from(roots)` с методами.

### 5. `ArchChecker` и `Violation`

`archCheck`, `checkDefs`, `checkFiles`, `describedDefs`, `formatViolation` → `new ArchChecker(index, layout).check()` и `Violation.format()`.

### 6. База репозитория

`createLock()` (замыкание) и `assertVersion(def, ar, stored)` повторяются в `task.json-repo`, `user.memory-repo` и `modules/wish/src/infra/wish.json-repo.ts`. Вместо них — класс `Lock` с `run(task)` и базовый репозиторий с оптимистичной блокировкой (D-36).

### 7. Тестовые двойники

`memoryLogger`, `memoryBus`, `recordingBus` → классы `MemoryLogger` и `MemoryBus` (у них есть состояние). `testAppContext` остаётся фабрикой.

### 8. Генератор

Шаблон генерации — класс вида в `gen` (`OperationTemplate` → `UseCaseTemplate`/`ReactionTemplate`/`JobTemplate`), выбор — таблицей; `switch (c.kind)` в `gen/kinds/operation.ts` и `switch (args.kind)` в `gen/main.ts` уходят. Шаблон не в классе Def: Def — доменный контракт в рантайме домена, а шаблоны знают прикладной слой и тесты (решено с Нурболатом 2026-10-27, исследование Фазы 5).

## Нефункциональные требования

- Без новых зависимостей.
- Публичное API `dmg-core` меняется только в DSL (`define*` → `XxxDef.define`) и в перечисленных выше заменах функций на классы.
- Существующие тесты не удаляются, сценарии переносятся (workflow, п. 7).

## Критерии приёмки

- В `graph`, `arch`, `gen` нет `switch` по `dmg`/`op`/`kind` (кроме `Caller.fromJson`).
- Во всём репо зелёные `bun test`, `tsc --noEmit`, `biome check`, `arch:check`.
- Тесты типов на требования п.2 есть и проходят.
- Гайды `dmg-core/docs`, `llms.txt`, `conductor/architecture/` обновлены; `TRACK-DMG-CORE-OOP.md` удалён.

## За рамками

- Команды и dispatch — трек `command-dispatch`.
- Сделанное в Ф8а `golden-wish` (Р1–Р9): `Caller`, `OperationFromDef`, `ModuleFacade`, `Trace`, `Aggregate.newState`/`readonly`, oplog.
- Универсальные утилиты: `ok`/`err`, `serializeError`, `toJsonSchema`, `withEntityDefaults`, `expectOk`/`expectErr`.
