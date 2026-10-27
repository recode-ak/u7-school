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

## Фаза 2: Иерархия `Rule` и `PolicyDef`

- [ ] Task: Абстрактный `Rule` → `NamedRule`, `AllOfRule`, `AnyOfRule`, `AllowAll`; фабрики `Rule.of/allOf/anyOf/hasRole`; `evaluate`, `normalize()`, `describe()` полиморфно; уходит `switch` по `rule.op` в `normalize.ts`
- [ ] Task: `PolicyDef` (`definePolicy` → статика)
- [ ] Task: Гайд policy
- [ ] Task: Ревью reviewer
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Операции и модуль

- [ ] Task: `OperationDef` (`calls` обязательное, нормализуется в конструкторе; `aggregates()`, `errors()`, `title(module)`, `fileKind`, `mainAggregate()`)
- [ ] Task: `UseCaseDef`, перевод потребителей (`check-defs` ветка UC, `OPERATION_DIR`, `OPERATION_KIND`)
- [ ] Task: `EventReactionDef` (проверка `on` внутри вида), то же
- [ ] Task: `JobDef`, то же
- [ ] Task: `ModuleDef` (`defineModule` → статика)
- [ ] Task: `normalize.ts`/`described-defs.ts` без `switch` — только делегирование `def.normalize()`/`def.describe()`; контрактный тест «нет `switch` по `dmg`» в `check`
- [ ] Task: Гайды (module, event-reaction, job, `manifests.md`)
- [ ] Task: Ревью reviewer
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: `DefIndex` и `ArchChecker`

- [ ] Task: `DefIndex.from(roots)` с методами вместо `indexDefs`, `operationsOf`, `callsOf`, `localId`, `ruleId`
- [ ] Task: `Violation` — класс с `format()`
- [ ] Task: `ArchChecker(index, layout).check()` вместо `archCheck`/`checkDefs`/`checkFiles`/`describedDefs`; `arch-report` на новом API
- [ ] Task: Ревью reviewer
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

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

- [ ] Task: `domain/` и `modules/<m>` на `XxxDef.define`; `define*` удаляются из публичного API
- [ ] Task: `llms.txt`, `dmg-core/docs`, `conductor/architecture/` (naming; запись D-xx «Def — классы» в decisions); `TRACK-DMG-CORE-OOP.md` удалён
- [ ] Task: Финал: гейт качества (workflow) — полный `CI=true bun test`, `tsc`, `biome`, `arch:check`, триаж в `summary.md`
- [ ] Task: Conductor - User Manual Verification 'Фаза 7' (Protocol in workflow.md)
