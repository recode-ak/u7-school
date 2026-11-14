# Спецификация: core-dmg — платформа DMG в `@u7-scl/core`

## Обзор

Трек #1 из migration.md: реализовать в `@u7-scl/core` фреймворк целевой архитектуры — `Result`, семейство `define*`, `F.*`/`Timestamp`, агрегат v2 с `ReadonlyAr`, UoW, `Caller`, базовые классы `*FromDef`, `appApi.run`, граф-движок, `arch:check` и линт-правила. Legacy-код core не меняется и работает параллельно (strangler). Новый код — в `packages/core/src/dmg/`, экспорт `@u7-scl/core/dmg`. Работоспособность доказывается на учебном модуле в тестах core.

*Почему отдельный подпуть:* в legacy-индексах core заняты имена `Aggregate`, `ErrorKind`, `AppError`, у старых ошибок другой набор `kind`. Отдельный подпуть исключает конфликты имён; удаление legacy — удаление старых папок, финальное переименование подпути — механическое.

## Функциональные требования

**Ф1. Примитивы**
- `Result<T, E>`: `ok`/`err`, сужение по `res.ok`, минимум утилит (`map`, `andThen` — по необходимости). Тестовый хелпер `expectErr(res, code)`.
- Модель ошибки: `code`, `kind` (`validation | unauthorized | access | not_found | conflict | internal`), `label`, `description`, `payload`. Базовые ошибки ядра: `UNAUTHORIZED`, `INPUT_VALIDATION`, `ACCESS_DENIED`, `OUTPUT_VALIDATION`, `SERVER_INTERNAL`.
- `Timestamp` (number, мс, UTC), управляемый `now()`; `F.timestamp` читает ISO-строку и число, пишет число.
- `F.*`: базовые поля с обязательной меткой → `description` (`F.uuid`, `F.timestamp`, `F.string`, …), `BaseEntityFields`.
- `Caller` (`guest | user | delegate | system`) с дженериком пользователя, `subjectOf(caller)`.

**Ф2. Манифесты домена**
- `defineErrors`, `defineEvents` (FQN `module.aggregate.event`, схема payload), `defineAggregate`, `definePolicy` / `rule` / `anyOf` / `allOf` / `hasRole` (решение `allowed | denied(rule, denyMessage)`, `delegable`), `defineUseCase` (`type`, `callers`, `input`, `output`, `errors`, `emits`, `policy`), `defineEventReaction` (`on`, `touches`, `calls`, `emits`), `defineJob` (`schedule`, `scans`, `emits`), `defineFacade`, `defineModule` (`dependsOn`, состав).
- Обязательные `label`/`description`; ссылки между Def — объектами, не строками.
- `normalize(def)` — сериализуемое представление Def (основа графа, документации, хеша D-27).

**Ф3. Агрегат v2**
- Базовый класс: `create(): Result<Ar>` / `restore(snapshot)` раздельно, `snapshot()`, мутация «черновик → валидация → фиксация» (при `Err` или невалидном черновике состояние не меняется), накопление событий.
- `ReadonlyAr<T>` — выводится типом (исключает методы, возвращающие `Result`).

**Ф4. Прикладной слой**
- UoW: `register(ar)`, `commit()` (последовательное сохранение через репозитории, без отката — D-15), затем публикация событий зарегистрированных агрегатов.
- `UseCaseFromDef`: `handle()` = авторизация по `callers` → валидация входа → Policy → `execute` → `commit` → публикация (рантайм-ассерт `emits` в test/dev) → валидация выхода; непредвиденное исключение → `SERVER_INTERNAL`. `this.err()` типом принимает только коды из `errors` + базовые.
- `ReactionFromDef`, `JobFromDef`: `Result`, сбой логируется (без гашения); ассерты `touches`/`calls` через прокси резолвера в тестах. Job-планировщик — существующий.
- Модуль — типизированная карта `Def → класс`: пропуск реализации — ошибка компиляции.
- `appApi.run(uc, input, caller): Result`; существующий `appApi.execute` для новых UC разворачивает `Err` в исключение. Legacy-поведение `execute` не меняется.

**Ф5. Граф и `arch:check`**
- Граф-движок L0/L1/L2 из нормализованных Def; вычисление обратных связей.
- `bun run arch:check` — контрактные тесты MAN-01…03, 06, 08, 10, ARC-04…06, ERR-04, JSON Schema. Каждое сообщение начинается с ID правила.

**Ф6. Линт**
- biome `noRestrictedImports` для ARC-01, 02, 06, 07, 08, 09; GritQL-плагины для DOM-01, DOM-11, DOM-12, ERR-01, API-02, CODE-02.
- Блокирующие (`error`) — для новых путей (`packages/domain/**`, `packages/core/src/dmg/**`); на legacy — `warn` или исключения. `check` на legacy не краснеет.

**Ф7. Учебный модуль**
- Мини-модуль в тестах core (рабочее имя `todo`): агрегат, политика, 2–3 UC (command + query), событие, ER, Job, фасад, JSON-репозиторий. На нём — интеграционные тесты Ф3–Ф5 и негативные фикстуры для `arch:check` (цикл `dependsOn`, висячий подписчик, дубль кода ошибки и т. п.).

## Нефункциональные требования

- TDD, покрытие нового кода > 80%. Без новых зависимостей, кроме уже имеющихся (`valibot`, `@valibot/to-json-schema`).
- typescript.md: без `any`, `as`, `#private`.
- Регресс legacy запрещён: `bun run check` зелёный после каждой задачи.
- Документация: окончательный API `define*` фиксируется в `manifests.md`, `errors-result.md`, `caller.md`, `testing.md`; новые решения — `D-NN` в `decisions.md`; в `rules.md` проверки переводятся из `review` в фактические `lint`/`test`.

## Критерии приёмки

1. `@u7-scl/core/dmg` экспортирует все объекты Ф1–Ф4; учебный модуль собран на них целиком и проходит интеграционные тесты (в т.ч. порядок `commit → publish`, перехват исключений, ассерт `emits`, ошибка компиляции при пропуске реализации — `@ts-expect-error`).
2. `bun run arch:check` зелёный на учебном модуле и красный с правильным ID на каждой негативной фикстуре.
3. Линт-правила срабатывают на нарушениях в новых путях и не ломают `bun run check` на legacy.
4. `appApi.run` и `appApi.execute` работают с новыми UC; legacy-UC не затронуты.
5. Документы архитектуры обновлены по факту реализации.

## За рамками

- Пакет `@u7-scl/domain` и перенос модулей (трек domain-package).
- Генераторы `bun run gen` (трек generators).
- Перевод любого реального модуля на Def (golden-wish).
- Делегирование: `delegate` объявляется в типе, транспорт его не строит.
- Миграция данных `Timestamp` (трек timestamp-data), UI-манифесты, HTTP/MCP/документация из графа.
- Удаление legacy core.

**Ф7. Вынос в `dmg-core`** — отдельный трек [dmg-core-extract](../dmg-core-extract_20261020/spec.md): пакет `dmg-core` (npm), развязка от legacy, готовность к распределённому запуску.
