# Манифесты

**Назначение:** семейство `define*`, обязательные поля, граф и механизм проверки соответствия кода декларациям. Реализация — `packages/dmg-core/src` (импорт `dmg-core`, внутри — `#core/*`); экспорты перечислены в `index.ts`.

---

## 1. Семейство

| Функция | Где | Что декларирует |
|---|---|---|
| `defineModule` | domain | `name`, `label`, `description`, `dependsOn`, состав (агрегаты, UC, ER, Job, фасад) |
| `defineFacade` | domain | runtime-API модуля: методы с `label`/`description`, вход, возврат (`Result`, `ReadonlyAr`), ошибки |
| `defineAggregate` | domain | схема entity, статусы и переходы (`from`, `to`, `rejects` — отказ для каждого статуса вне `from`), группы событий и ошибок; класс `Aggregate` — база для Ar |
| `defineEvents` | domain | группа событий агрегата: FQN-префикс `module.aggregate`, на событие — `label`, `description`, схема payload |
| `defineErrors` | domain | группа ошибок агрегата: `code`, `kind`, `label`, `description`, схема payload |
| `definePolicy` / `rule` | domain | именованные правила с `label` и `denyMessage`, композиция |
| `defineUseCase` | domain (контракт) | `type` (command/query), агрегат, `policy`, `callers` ([caller.md](./caller.md)), `input`, `output`, `errors`, `emits` |
| `defineEventReaction` | domain (контракт) | `on` (события), `touches` (агрегаты), `calls` (фасады), `emits` |
| `defineJob` | domain (контракт) | `schedule`, `scans`, `emits` |
| `defineUiApp` / `defineUiModule` / `defineStory` / `defineScreen` | ui (позже) | матрёшка UI — [ui-manifests.md](./ui-manifests.md) |

Реализации подключают Def через базовые классы (`UseCaseFromDef`, `ReactionFromDef`, `JobFromDef`, `ModuleFromDef` — карта `Def → класс`, типизированная Def: пропуск реализации — ошибка компиляции; фасад — `implementFacade`). Свойства Def в классах **не дублируются**.

**Ссылки, не строки:** `on: StudentEvents.completed`, `errors: [StudentErrors.NOT_ACTIVE]`. Строковые имена (FQN) вычисляются для шины, логов и документации.

**Обратные связи** (какие UC управляют агрегатом, кто слушает событие) не пишутся — их вычисляет граф.

**Жизненный цикл — только в Def.** Метод Ar меняет статус через `this.transition('<op>', at, apply)`: база проверяет `from`, возвращает отказ из `rejects` и ставит `to`; `apply` пишет только суть операции. `this.change(at, apply)` статус не меняет. Проверки статуса в методах Ar не дублируются (D-35, MAN-12).

## 2. Обязательные описания

- `label` — короткое имя (кнопка, заголовок, строка таблицы);
- `description` — для PO и LLM: что делает, когда применять. Обязательно для всех Def;
- `v.description()` на **каждом поле** схем input/output/entity/payload (базовые `F.*` ставят его сами из метки).

## 3. Схемы

- Базовые поля — только через `F.*` (core) и `shared/` (domain): `F.uuid('студента')`, `F.timestamp('зачисления')`, `BaseEntityFields`. Новые валидаторы для тех же полей не создаются.
- Схемы input/output/payload **конвертируются в JSON Schema** (`@valibot/to-json-schema`): без непереводимых `transform`/`custom` либо с явным fallback. Основа OPTIONS и MCP.
- DTO-схемы выводятся из схемы entity (`v.pick`, `Schema.entries.x`), а не пишутся заново.

## 4. Граф

| Уровень | Узлы | Связи |
|---|---|---|
| **L0** — карта модулей | модули | `dependsOn`, вызовы фасадов, потоки событий между модулями |
| **L1** — модуль | агрегаты, UC, ER, Job, события, ошибки | UC → агрегат, UC/ER/Job → событие → ER |
| **L2** — агрегат | статусы, операции | переходы, ошибки операций |

Каскад «потянуть за верёвочку» (UI → UC → агрегат → событие → ER → …) проходит сквозь уровни и модули.

## 5. Декларация + верификация (D-12)

Контрактные проверки — `bun run arch:check` (`archCheck`: `checkDefs`, `checkFiles`, граф `dependsOn`); каждое сообщение начинается с ID правила ([rules.md](./rules.md)).

| Декларация | Проверка |
|---|---|
| `errors` UC/фасада | тип: `this.err()` принимает только заявленные коды |
| `input` / `output` | тип + рантайм-валидация в `handle()` |
| `emits` UC/ER/Job | рантайм-ассерт в test/dev: незаявленное событие — ошибка |
| `touches` / `calls` ER | рантайм-ассерт через прокси резолвера в тестах |
| `dependsOn` | контрактный тест: фактические импорты и ссылки Def ⊆ `dependsOn`; граф — DAG |
| FQN событий | контрактный тест: префикс совпадает с модулем и агрегатом |
| связность | контрактный тест: нет висячих подписчиков, неопубликованных событий, Def вне модуля |
| описания | контрактный тест: непустые `label`/`description`, описания полей |
| JSON Schema | контрактный тест: все input/output/payload конвертируются |
| пары контракт ↔ реализация | контрактный тест: одинаковые пути (см. [naming.md](./naming.md)) |
