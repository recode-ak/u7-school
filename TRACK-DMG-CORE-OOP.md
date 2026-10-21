# Трек `dmg-core-oop` — исходные решения (временный файл)

Основание для трека: «новый трек согласно `TRACK-DMG-CORE-OOP.md`». Файл дают conductor-newtrack как бриф. После того как появятся `spec.md` и `plan.md`, содержимое переносится туда, а файл удаляется.

Решено с Нурболатом 2026-10-21 при разборе вопросов после Ф8 `golden-wish` (Р8 в `OPEN-QUESTIONS-F8.md`, потом — D-43 в `decisions.md`). Когда старт: после `golden-wish`. Ф8а (вызовы и граница модуля) в этот трек не входит.

## Принципы (не переспрашивать)

1. **ООП, а не россыпь функций.** У объекта явная зона ответственности, своё состояние спрятано внутри, клиенты работают через его API. Набор свободных функций вокруг типа-данных считается антипаттерном.
2. **Хелпер-функция допустима только в двух случаях:**
   - это универсальная утилита, которая пригодится в самых разных местах (даты, `ok`/`err`, `serializeError`, `toJsonSchema`, `expectOk`/`expectErr`);
   - специализированную логику используют две несвязанные иерархии, а общий предок для них неуместен.

   Даже в этих случаях хелпера по возможности избегаем. Часто вместо него подходит композиция с объектом-классом.
3. **Полиморфизм вместо `switch` по виду.** Если код ветвится по `def.dmg` или `rule.op`, поведение должно жить в классе этого вида.
4. **Статические методы базы с полиморфным `this`, а не код в каждом наследнике.** Образец — `Aggregate.readonly(state)`: `static readonly<S, A>(this: { restore(s: S): A }, state: S): ReadonlyAr<A>`.
5. Работаем по TDD (red → green по шагам), это платформенный эталон, поэтому модель — Opus. Перед реализацией — план, его согласует Нурболат.

## Объём

### 1. Def — классы
Сейчас `define*` возвращают литералы `{ ...spec, dmg: '<вид>' }`, а знание о видах разбросано по `switch` в чужих местах:

| Место | Сейчас | Должно стать |
|---|---|---|
| `graph/normalize.ts` | `switch` по 11 видам и `switch` по `rule.op` | `def.normalize()` |
| `arch/described-defs.ts` | описание и схемы каждого вида (MAN-01/02/03) | `def.describe()` |
| `arch/check-defs.ts` | 3 `switch` по виду операции (ошибки UC, `on` у ER, `aggregatesOf`) | `op.aggregates()`, `op.errors()`, проверки вида внутри класса |
| `arch/check-files.ts` | `OPERATION_DIR[op.dmg]`, главный агрегат через тернарник | `op.fileKind`, `op.mainAggregate()` |
| `graph/def-index.ts` `callsOf` | `calls` у UC необязательный, у ER/Job обязательный | одно поле `calls`, нормализуется в конструкторе |
| `OPERATION_KIND` и заголовки сообщений | таблица по виду | `op.title(module)` |
| `scripts/gen/kinds/*` | генерация по виду | проверить, нельзя ли брать шаблон из вида |

Иерархия: базовый `Def` (`name`, `label`, `description`, `describe()`, `normalize()`), от него `OperationDef` (общая база UC/ER/Job: `calls`, `aggregates()`, `title()`), дальше конкретные виды. Как оформить DSL, решаем в треке: `defineUseCase(spec)` как тонкая обёртка над `new UseCaseDef(spec)` или `UseCaseDef.define(spec)`.

Что это даёт в будущем: генерацию документации, хеш контракта (D-27), JSON Schema/OpenAPI для транспортов, MCP-инструменты из Def UC, формы UI по `input`, сравнение контрактов при выносе модуля в сервис. Каждая такая возможность станет методом вида, а не новым `switch`.

**Обязательные требования к типам:**
- вывод литеральных типов (`const S`) сохраняется: `D['calls'][number]`, `D['policy']`, `M['useCases'][number]`, `InputOf<D>` работают как сейчас;
- у Def нет `private`/`#` полей, иначе типизация станет номинальной и сломает `Any*Def`;
- поля объявлены явно, не через `Object.assign`;
- сравнение по ссылке (`includes`, ключи `Map`) не меняется.

Эти требования проверяем тестами типов (`@ts-expect-error`) до начала переноса.

### 2. Иерархия `Rule`
`rule`, `allOf`, `anyOf`, `hasRole`, `allowAll`, `denied` превращаются в абстрактный `Rule` с наследниками `NamedRule`, `AllOfRule`, `AnyOfRule`, `AllowAll` и статическими фабриками (`Rule.of(…)`, `Rule.allOf(…)`). Сигнатура `evaluate(subject, ctx)` к этому моменту уже изменена в Ф8а (Р2).

### 3. `DefIndex`
`indexDefs`, `operationsOf`, `callsOf`, `localId`, `ruleId` переносятся в класс `DefIndex.from(roots)` с методами.

### 4. `ArchChecker` и `Violation`
`archCheck`, `checkDefs`, `checkFiles`, `describedDefs`, `formatViolation` заменяются на `new ArchChecker(index, layout).check()` и `Violation.format()`.

### 5. База репозитория
`createLock()` (замыкание) и `assertVersion(def, ar, stored)` сейчас повторяются в `task.json-repo`, `user.memory-repo` и `wish.json-repo`. Вместо них — класс `Lock` с `run(task)` и базовый репозиторий с оптимистичной блокировкой (D-36).

### 6. Тестовые двойники
`memoryLogger`, `memoryBus`, `recordingBus` становятся классами `MemoryLogger` и `MemoryBus` (у них есть состояние). `testAppContext` остаётся фабрикой.

## Что не трогаем
- `ok`/`err`, `serializeError`, `toJsonSchema`, `withEntityDefaults`, `expectOk`/`expectErr` — универсальные утилиты.
- Сделанное в Ф8а `golden-wish` (Р1–Р9): `Caller`, `OperationFromDef`, `ModuleFacade`, `Trace`, `Aggregate.newState`/`readonly`, oplog.

## Порядок (предложение для плана)
1. Тесты типов, фиксирующие требования раздела 1.
2. Базовые `Def` и `OperationDef`, затем виды по одному (red → green). Потребители (`normalize`, `describe`, проверки) переводятся вместе с видом.
3. `Rule`.
4. `DefIndex` и `ArchChecker`.
5. Репозиторий и двойники.
6. Перевод `packages/domain` и `packages/<m>` (на импорты DSL это почти не влияет), гайды, `architecture/`.
