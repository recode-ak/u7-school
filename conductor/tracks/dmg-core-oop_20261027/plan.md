# Plan: dmg-core-oop_20261027

Каждая задача — TDD (red → запуск → green, по шагам), `bun run check` и `arch:check` зелёные после каждой. Платформенный эталон — модель Opus. Поведение не меняется: существующие тесты не удаляются, а переносятся (workflow, п. 7). Данные `data/` не трогаем.

**Фаза = слой платформы:** код → гайд → отчёт reviewer → контрольная точка.

## Фаза 0: Базовая линия и типы [checkpoint: f473032b]

- [x] Task: Зафиксировать базовую линию (`bun test` pass/fail по репо и по `dmg-core`) в черновике `summary.md` `eacb6b0b`
- [x] Task: Тесты типов (`@ts-expect-error`) на требования спеки п.2: вывод `const S` (`D['calls'][number]`, `D['policy']`, `M['useCases'][number]`, `InputOf<D>`), структурная совместимость с `Any*Def` (нет `private`/`#`), сравнение по ссылке; прототип `XxxDef.define` с полиморфным `this` на одном виде — проверка, что вывод не теряется `ae249ce9`
    - Итог прототипа: `static define` базы с `this: new (spec: S) => D` теряет литералы (у TS нет higher-kinded типов: дженерик-конструктор инстанцируется ограничением) и несовместим со статикой вида (TS2417). Работает `static define<const S>` в каждом виде (одна строка `new XxxDef(spec)`), база `Def` без `define`. Необязательные списки (`calls`, `rules`, `emits`) дают условный тип поля → вариантность `S` неизмерима → `Any*Def` — структурный тип публичных членов, а не `XxxDef<Spec>`. Не сработали: аннотация `out S`, нормализация типа через `Omit`.
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md)

## Фаза 1: База `Def` и простые виды [checkpoint: 3058131d]

- [x] Task: Абстрактный `Def` (`name`, `label`, `description`, `describe()`, `normalize()`; `static define` — в каждом виде, не в базе) — тесты контракта базы `73303e7f`
- [x] Task: `ErrorDef` (`defineErrors` → статика), перевод `normalize`/`describe` для вида `148cb4dd`
- [x] Task: `EventDef` (`defineEvents` → статика), то же `6808cdbd`
- [x] Task: `AggregateDef` (`defineAggregate` → статика), то же; `Aggregate.readonly`/`newState` не трогаем `93088b2c`
- [x] Task: `DomainRuleDef` и `RulesDef` (`defineRules` → статика), то же `497d4939`
- [x] Task: Гайды `dmg-core/docs/guides` (errors, events, aggregate) — DSL `XxxDef.define` `311e8f8c`
- [x] Task: Ревью reviewer `19a2cd82`
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: Иерархия `Rule` и `PolicyDef` [checkpoint: 3a6f9349]

- [x] Task: Абстрактный `Rule` → `NamedRule`, `AllOfRule`, `AnyOfRule`, `AllowAll`; фабрики `Rule.of/allOf/anyOf/hasRole`; `evaluate`, `normalize()`, `describe()` полиморфно; уходит `switch` по `rule.op` в `normalize.ts` `339e248`
    - `describe()` у `Rule` не вводится (решено с Нурболатом 2026-10-27): у правила нет `description`, MAN-01 его не покрывает; PO и аналитику в графе хватает `label`/`denyMessage` из `normalize()`. Добавим, когда появится потребитель. `allowAll` — константа-экземпляр `AllowAll` (статическое поле базы на наследника — TDZ).
- [x] Task: `PolicyDef` (`definePolicy` → статика) `8292da9`
- [x] Task: Гайд policy `9855bd6`
- [x] Task: Ревью reviewer `0bf34ee`
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Операции и модуль [checkpoint: ed150e7]

- [x] Task: `OperationDef` (`calls` обязательное, нормализуется в конструкторе; `aggregates()`, `errors()`, `title(module)`, `fileKind`, `mainAggregate()`) `ab67d73`
    - `errors()` → `referencedErrors()` (решено с Нурболатом 2026-10-27): поле `errors` у UC занято, на нём держатся `D['errors'][number]` и `UseCaseErrorOf`. Сокращение для `title` — поле `abbr` (`UC`/`ER`/`Job`).
- [x] Task: `UseCaseDef`, перевод потребителей (`check-defs` ветка UC, `OPERATION_DIR`, `OPERATION_KIND`) `5982b55`
    - `OPERATION_DIR`/`OPERATION_KIND` — таблицы по всем трём видам: уходят в задаче `JobDef`, когда все операции — классы. `calls` вид сужает через `declare readonly calls` (параметр базы `OperationDef<N, C>` давал цикл типов с `AnyUseCaseDef`). Прототип Фазы 0 удалён, сценарии — в `use-case-def.test.ts`.
- [x] Task: `EventReactionDef` (проверка `on` внутри вида), то же `79200fa`
    - Подписки — метод базы `subscribedEvents()` (у ER — `on`, у остальных `[]`): проверки `check-defs` по ним общие для всех операций; `switch` уходит в задаче `JobDef`.
- [x] Task: `JobDef`, то же; `OPERATION_DIR`/`OPERATION_KIND` → `op.fileKind`/`op.title(m)`, главный агрегат → `op.mainAggregate()` `b1c170b`
- [x] Task: `ModuleDef` (`defineModule` → статика) `8b8e8af`
- [x] Task: `normalize.ts`/`described-defs.ts` без `switch` — только делегирование `def.normalize()`/`def.describe()`; контрактный тест «нет `switch` по `dmg`» в `check` `d920619`
    - Тест — `src/arch/kind-switch.test.ts` (graph, arch); `gen` добавить в задаче шаблонов Фазы 5.
- [x] Task: Гайды (module, event-reaction, job, `manifests.md`) `a46bc41`
- [x] Task: Ревью reviewer `8040f70`
    - Блокеров нет. Исправлено: `kind-switch.test` ловит `TABLE[x.dmg]` и обратное сравнение. Отложено в Фазу 7: один тип вместо `Declared`/`DeclaredCalls` (общий `Declared` — в `operation-def.types.ts`), `decisions.md` D-09/D-37 на `ModuleDef.define`.
- [x] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: `DefIndex` и `ArchChecker` [checkpoint: 514d5fb]

- [x] Task: `DefIndex.from(roots)` с методами вместо `indexDefs`, `operationsOf`, `callsOf`, `localId`, `ruleId` `0e09372`
    - Методы индекса: `moduleOf` (агрегат/операция), `aggregateOf` (событие/ошибка), `operations()`, `id(def)` (`?.name` вне индекса), `ruleId(rule)`; карты владельцев скрыты. Не зависящее от индекса — у владельца: `ModuleDef.operations()`, `ModuleDef.localId(def)`; `callsOf` убран (`op.calls`). `AnyOperationDef` — в `operation-def.types.ts`.
- [x] Task: `Violation` — класс с `format()` `8773f36`
- [x] Task: `ArchChecker(index, layout).check()` вместо `archCheck`/`checkDefs`/`checkFiles`/`describedDefs`; `arch-report` на новом API `4db14eb`
    - `layout` необязателен: без него — только проверки Def (тесты модулей домена, `scripts/arch-check.ts`); `ArchChecker.of(app)` — для `ArchApp`. Внутри — `DefChecker` и `FileChecker` (не экспортируются), проверки — их приватные методы. Документация пакета переведена на новые имена сразу (не ждёт Фазы 7).
- [x] Task: Ревью reviewer `1d11a97`
    - Блокеров нет. Исправлено: `GraphBuilder` — id через `DefIndex.id`; `FileChecker.isEntry` читает `this.entry`; lint-фикстура ARC-02. Решено с Нурболатом 2026-10-27: `ArchChecker.defsOf(roots).report()` для тестов модулей `e877889`; имена в `decisions.md` — актуальные (журнал — справка по текущему API); `conductor/architecture` — Фаза 7.
- [x] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

## Фаза 5: Генератор

- [ ] Task: Исследование `gen/kinds`: можно ли брать шаблон из вида. Вывод — в план; если раздувает трек — стоп и обсуждение с Нурболатом
- [ ] Task: Шаблоны операций из вида, без `switch (c.kind)` в `gen/kinds/operation.ts`; результат генерации не меняется (тесты)
- [ ] Task: Ревью reviewer
- [ ] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md)

## Фаза 6: Репозиторий и тестовые двойники

- [ ] Task: Класс `Lock` (`run(task)`) вместо `createLock()`
- [ ] Task: Базовый репозиторий с оптимистичной блокировкой (D-36) вместо `assertVersion`; перевод `task.json-repo`, `user.memory-repo`, `modules/wish/src/infra/wish.json-repo.ts`
- [ ] Task: `MemoryLogger`, `MemoryBus` вместо `memoryLogger`, `memoryBus`, `recordingBus`; `testAppContext` на них
- [ ] Task: Гайд repo, `docs/testing.md`
- [ ] Task: Ревью reviewer
- [ ] Task: Conductor - User Manual Verification 'Фаза 6' (Protocol in workflow.md)

## Фаза 7: Перевод потребителей и документация

- [ ] Task: `domain/` и `modules/<m>` на `XxxDef.define`; `define*` удаляются из публичного API; один тип вместо `Declared`/`DeclaredCalls` (общий — в `operation-def.types.ts`)
- [ ] Task: `llms.txt`, `dmg-core/docs`, `conductor/architecture/` (naming; запись D-xx «Def — классы» в decisions); D-09/D-37 — `ModuleDef.define`; `TRACK-DMG-CORE-OOP.md` удалён
- [ ] Task: Финал: гейт качества (workflow) — полный `CI=true bun test`, `tsc`, `biome`, `arch:check`, триаж в `summary.md`
- [ ] Task: Conductor - User Manual Verification 'Фаза 7' (Protocol in workflow.md)
