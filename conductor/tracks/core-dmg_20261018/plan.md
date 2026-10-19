# Plan: core-dmg_20261018

Новый код — `packages/core/src/dmg/`, экспорт `@u7-scl/core/dmg`. Каждая задача — TDD: тесты (Red) → реализация (Green) → рефакторинг, покрытие >80%. `bun run check` зелёный после каждой задачи.

План утверждён предварительно: Нурболат комментирует по ходу реализации.

## Фаза 1: Каркас и примитивы

- [x] Task: Каркас `dmg/` 40f2be1
    - [x] Подпуть `./dmg` в `exports` и `#dmg/*` в `imports` `packages/core/package.json`, `dmg/index.ts`
    - [x] Smoke-тест импорта `@u7-scl/core/dmg` из другого пакета
- [x] Task: `Result<T, E>` 5dc380c
    - [x] Тесты: `ok`/`err`, сужение по `res.ok`, `map`/`andThen` (только если нужны дальше), `expectErr(res, code)` — проходит на нужном коде, падает на чужом и на `Ok`
    - [x] Реализация
    - Заметка: `map`/`andThen` не добавлены (пока не нужны); `expectErr` — в подпути `@u7-scl/core/dmg/testing`, не зависит от раннера
- [x] Task: Модель ошибки и `defineErrors` bed6603
    - [x] Тесты: группа ошибок с `code`/`kind`/`label`/`description`/схемой payload; фабрика ошибки с типизированным payload; базовые ошибки ядра (`UNAUTHORIZED`, `INPUT_VALIDATION`, `ACCESS_DENIED`, `OUTPUT_VALIDATION`, `SERVER_INTERNAL`); `kind` — закрытый набор
    - [x] Реализация
    - Заметка: `defineErrors('TODO', { NOT_FOUND: … })` → код `TODO_NOT_FOUND`; Def даёт `make(payload)` и `err(payload)`
- [~] Task: `Timestamp`, `now()`, `F.*`
    - [ ] Тесты: управляемый `now()`; `F.timestamp` читает ISO и число, выдаёт число; `F.uuid`/`F.string`/… ставят `description` из метки; `BaseEntityFields`; поля конвертируются в JSON Schema
    - [ ] Реализация (переиспользовать `shared/now`, если подходит)
- [ ] Task: `Caller`
    - [ ] Тесты: четыре подтипа с дженериком пользователя; `subjectOf` (user → он сам, delegate → замещаемый, guest/system → нет); `system.onBehalfOf`
    - [ ] Реализация
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: Манифесты домена и агрегат v2

- [ ] Task: `defineEvents`
    - [ ] Тесты: FQN `module.aggregate.event` из префикса группы; схема payload; ссылка на событие — объект
    - [ ] Реализация
- [ ] Task: Агрегат v2 и `defineAggregate`
    - [ ] Тесты: `create(): Result<Ar>` с событием; `restore()` без событий; `snapshot()`; мутация «черновик → валидация → фиксация» (при `Err` и при невалидном черновике состояние не меняется); накопление и выдача событий; статусы и переходы в Def
    - [ ] Реализация
- [ ] Task: `ReadonlyAr<T>`
    - [ ] Тесты типов (`@ts-expect-error`): методы с `Result` недоступны, вопросы и идентификаторы доступны
    - [ ] Реализация
- [ ] Task: `definePolicy` / `rule` / `anyOf` / `allOf` / `hasRole`
    - [ ] Тесты: `allowed`/`denied(rule, denyMessage)`; композиция; `delegable: false` отказывает `delegate`; правило работает с субъектом
    - [ ] Реализация
- [ ] Task: Контракты `defineUseCase`, `defineEventReaction`, `defineJob`, `defineFacade`, `defineModule`
    - [ ] Тесты: обязательные `label`/`description` (тип); ссылки объектами; вывод типов input/output/errors из Def
    - [ ] Реализация
- [ ] Task: `normalize(def)`
    - [ ] Тесты: сериализуемое представление каждого вида Def; ссылки → FQN/коды; стабильность (одинаковый Def → одинаковый результат)
    - [ ] Реализация
- [ ] Task: Учебный модуль `todo` — доменная часть
    - [ ] Агрегат, state, события, ошибки, политика, контракты 2–3 UC (command + query), ER, Job, фасад, модуль
    - [ ] Unit-тесты агрегата и политики по TST-01/02
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Прикладной слой

- [ ] Task: UoW
    - [ ] Тесты: `register` + `commit` сохраняют последовательно через репозитории; события публикуются только после успешного `commit`; при сбое сохранения публикации нет
    - [ ] Реализация (на существующей шине событий)
- [ ] Task: `UseCaseFromDef`
    - [ ] Тесты: недопустимый `callers` → `UNAUTHORIZED`; невалидный вход → `INPUT_VALIDATION`; отказ Policy → `ACCESS_DENIED` с правилом; `Ok` → commit → publish; незаявленное событие → ассерт в test/dev; невалидный выход → `OUTPUT_VALIDATION`; исключение → `SERVER_INTERNAL` с логом; `this.err()` типом принимает только заявленные коды
    - [ ] Реализация
- [ ] Task: `ReactionFromDef` и `JobFromDef`
    - [ ] Тесты: `Result`; сбой логируется, не гасится молча; вызов UC как `system` с `onBehalfOf`; ассерты `touches`/`calls` через прокси резолвера; Job — на существующем планировщике
    - [ ] Реализация
- [ ] Task: Модуль — карта `Def → класс`
    - [ ] Тесты: пропуск реализации — ошибка компиляции (`@ts-expect-error`); сборка модуля в приложение рядом с legacy-модулями
    - [ ] Реализация
- [ ] Task: `appApi.run` и `execute` для новых UC
    - [ ] Тесты: `run` возвращает `Result`; `execute` разворачивает `Err` в исключение для нового UC; legacy-тесты `ApiApp` не тронуты и зелёные
    - [ ] Реализация (минимальная правка `api/app/api-app.ts`)
- [ ] Task: Учебный модуль `todo` — прикладная часть
    - [ ] Реализации UC/ER/Job, JSON-репозиторий, in-proc фасад, wiring
    - [ ] Интеграционные тесты: сквозной сценарий через `appApi.run`, событие → ER, smoke модуля на JSON-репозитории (временный каталог)
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: Граф и `arch:check`

- [ ] Task: Граф-движок
    - [ ] Тесты: L0 (модули, `dependsOn`, вызовы фасадов, межмодульные события), L1 (UC/ER/Job → агрегат/события), L2 (статусы, переходы, ошибки операций); обратные связи (кто управляет агрегатом, кто слушает событие)
    - [ ] Реализация на `normalize`
- [ ] Task: Контрактные проверки
    - [ ] Тесты на каждую проверку с негативной фикстурой: MAN-01/02 (описания), MAN-03 (JSON Schema), MAN-06 (висячий подписчик, неопубликованное событие, Def вне модуля), MAN-08 (FQN), MAN-10 (пары путей), ARC-04 (импорт мимо `index.ts` или `dependsOn`), ARC-05 (цикл), ARC-06 (1:1 пакетов), ERR-04 (дубль кода)
    - [ ] Реализация; сообщения начинаются с ID правила
- [ ] Task: Команда `bun run arch:check`
    - [ ] Скрипт собирает граф по зарегистрированным модулям (сейчас — учебный) и запускает проверки; на пустом домене не падает
    - [ ] Подключение в `check` (TST-06)
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

## Фаза 5: Линт-правила

- [ ] Task: `noRestrictedImports` для ARC-01, 02, 06, 07, 08, 09
    - [ ] Фикстуры-нарушители (вне `check`) и скрипт-тест: biome выдаёт ошибку с нужным ID
    - [ ] Конфиг: `error` для `packages/domain/**`, `packages/core/src/dmg/**`; на legacy — `warn` или исключения
- [ ] Task: GritQL-плагины для DOM-01, DOM-11, DOM-12, ERR-01, API-02, CODE-02
    - [ ] Фикстуры и тест по каждому правилу
    - [ ] Плагины и подключение с той же областью действия
- [ ] Task: Проверка: `bun run check` зелёный на всём репозитории; количество предупреждений на legacy — в summary
- [ ] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md)

## Фаза 6: Документация

- [ ] Task: Зафиксировать API по факту: `manifests.md`, `errors-result.md`, `caller.md`, `testing.md` (`expectErr`, `now()`), `layers.md` (подпуть `dmg`)
- [ ] Task: `rules.md` — проверки переведены из `review` в фактические `lint`/`test`; убрать «до трека core всё фактически review»
- [ ] Task: `decisions.md` — новые решения (подпуть `@u7-scl/core/dmg` и его переименование после legacy, прочие по ходу); `tech-stack.md` — GritQL-плагины biome
- [ ] Task: `migration.md` — трек 1 отмечен; что разблокировано (generators, golden-wish)
- [ ] Task: Conductor - User Manual Verification 'Фаза 6' (Protocol in workflow.md)
