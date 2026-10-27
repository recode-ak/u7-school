# Манифесты

**Назначение:** семейство Def (`XxxDef.define`; виды, ещё не переведённые на классы, — `define*`), обязательные поля, граф и механизм проверки соответствия кода декларациям. Реализация — `src/` пакета; публичные экспорты — [index.ts](../src/index.ts) и подпути (`app`, `graph`, `arch`, `testing`).

---

## 1. Семейство

| DSL | Где | Что декларирует |
|---|---|---|
| `defineModule` | domain | `name`, `label`, `description`, `dependsOn`, состав (агрегаты, UC, ER, Job); `external: true` — модуль вне приложения (ещё не переведённый код, другой сервис): только контракт (события, Def UC без реализации), события публикует внешняя сторона |
| `AggregateDef.define` | domain | схема entity, статусы и переходы (`from`, `to`, `rejects` — отказ для каждого статуса вне `from`), группы событий и ошибок; класс `Aggregate` — база для Ar |
| `EventDef.define` | domain | группа событий агрегата (словарь `EventDef`): FQN-префикс `module.aggregate`, на событие — `label`, `description`, схема payload |
| `ErrorDef.define` | domain | группа ошибок агрегата (словарь `ErrorDef`): `code`, `kind`, `label`, `description`, схема payload |
| `definePolicy` / `rule` | domain | именованные правила с `label` и `denyMessage`, композиция |
| `RulesDef.define` / `DomainRuleDef.define` | domain | доменные правила без субъекта (D-40): `name`, `label`, `description`, `error` (ErrorDef своей группы), `check(ctx) → Result` |
| `defineUseCase` | domain (контракт) | `type` (command/query), агрегат, `policy`, `rules` (доменные правила; их ошибки — в `errors`), `callers` ([caller.md](./caller.md)), `calls` (Def UC других модулей с `'system'` в `callers`, D-42/D-43), `input`, `output`, `errors`, `emits` |
| `defineEventReaction` | domain (контракт) | `on` (события), `touches` (агрегаты), `calls` (Def UC других модулей, D-43), `emits` |
| `defineJob` | domain (контракт) | `schedule`, `scans`, `calls` (Def UC других модулей, D-43), `emits` |

Реализации подключают Def через базовые классы (`UseCaseFromDef`, `ReactionFromDef`, `JobFromDef` — наследники `OperationFromDef` с типизированным `call`, D-43; `ModuleFromDef` — единственная точка входа модуля, `handle`/`runJob` — карта `Def → класс`, типизированная Def: пропуск реализации — ошибка компиляции). Фасад — рантайм-граница без манифеста (`Facade<M>`/`ModuleFacade<M>`, D-42, D-43). Свойства Def в классах **не дублируются**.

**Def — классы** (`dmg-core-oop`): общая база `Def` (`name`, `label`, `description`) с поведением вида — `normalize()` (форма графа и хеша, D-27) и `describe()` (тексты и схемы для MAN-01/02/03; схемы вид отдаёт в `schemas()`), `texts()` — тексты для нормализованной формы. Новая возможность Def — метод вида, а не `switch` по `dmg`. Def сравниваются по ссылке, `private`/`#` у них нет: типизация `Any*Def` структурная.

**Ссылки, не строки:** `on: UserEvents.removed`, `errors: [TaskErrors.ALREADY_DONE]`. Строковые имена (FQN) вычисляются для шины, логов и документации.

**Обратные связи** (какие UC управляют агрегатом, кто слушает событие) не пишутся — их вычисляет граф.

**Жизненный цикл — только в Def.** Метод Ar меняет статус через `this.transition('<op>', at, apply)`: база проверяет `from`, возвращает отказ из `rejects` и ставит `to`; `apply` пишет только суть операции. `this.change(at, apply)` статус не меняет. Проверки статуса в методах Ar не дублируются (D-35, MAN-12).

## 2. Обязательные описания

- `label` — короткое имя (кнопка, заголовок, строка таблицы);
- `description` — для PO и LLM: что делает, когда применять. Обязательно для всех Def;
- `v.description()` на **каждом поле** схем input/output/entity/payload (базовые `F.*` ставят его сами из метки).

## 3. Схемы

- Базовые поля — только через `F.*` (core) и `shared/` модуля домена: `F.uuid('задачи')`, `F.timestamp('завершения')`, `BaseEntityFields`. Новые валидаторы для тех же полей не создаются.
- Схемы input/output/payload **конвертируются в JSON Schema** (`@valibot/to-json-schema`): без непереводимых `transform`/`custom` либо с явным fallback. Основа OPTIONS и MCP.
- DTO-схемы выводятся из схемы entity (`v.pick`, `Schema.entries.x`), а не пишутся заново.

## 4. Граф

| Уровень | Узлы | Связи |
|---|---|---|
| **L0** — карта модулей | модули | `dependsOn`, вызовы «UC → UC» (`calls`), потоки событий между модулями |
| **L1** — модуль | агрегаты, UC, ER, Job, события, ошибки | UC → агрегат, UC/ER/Job → событие → ER |
| **L2** — агрегат | статусы, операции | переходы, ошибки операций |

Каскад «потянуть за верёвочку» (UI → UC → агрегат → событие → ER → …) проходит сквозь уровни и модули.

## 5. Декларация + верификация (D-12)

Контрактные проверки — `archCheck` (`dmg-core/arch`: `checkDefs`, `checkFiles`, граф `dependsOn`) в `check` проекта; каждое сообщение начинается с ID правила ([rules.md](./rules.md)).

| Декларация | Проверка |
|---|---|
| `errors` UC | тип: `this.err()` принимает только заявленные коды |
| `input` / `output` | тип + рантайм-валидация в `handle()` |
| `emits` UC/ER/Job | рантайм-ассерт в test/dev: незаявленное событие — ошибка |
| `touches` / `calls` ER | рантайм-ассерт через прокси резолвера в тестах |
| `dependsOn` | контрактный тест: фактические импорты и ссылки Def ⊆ `dependsOn`; граф — DAG |
| FQN событий | контрактный тест: префикс совпадает с модулем и агрегатом |
| связность | контрактный тест: нет висячих подписчиков, неопубликованных событий, Def вне модуля |
| описания | контрактный тест: непустые `label`/`description`, описания полей |
| JSON Schema | контрактный тест: все input/output/payload конвертируются |
| пары контракт ↔ реализация | контрактный тест: одинаковые пути (см. [naming.md](./naming.md)) |
