# Plan: core-dmg_20261018

Новый код — `packages/core/src/dmg/`, экспорт `@u7-scl/core/dmg`. Каждая задача — TDD: тесты (Red) → реализация (Green) → рефакторинг, покрытие >80%. `bun run check` зелёный после каждой задачи.

План утверждён предварительно: Нурболат комментирует по ходу реализации.

## Фаза 1: Каркас и примитивы [checkpoint: 24fe914]

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
- [x] Task: `Timestamp`, `now()`, `F.*` 2aaee2a
    - [x] Тесты: управляемый `now()`; `F.timestamp` читает ISO и число, выдаёт число; `F.uuid`/`F.string`/… ставят `description` из метки; `BaseEntityFields`; поля конвертируются в JSON Schema
    - [x] Реализация (переиспользовать `shared/now`, если подходит)
    - Заметка: `now()` поверх legacy `shared/now`; заморозка — `setNow`/`resetNow` из `@u7-scl/core/dmg/testing`; `toJsonSchema` в режиме `input`
- [x] Task: `Caller` 35c7604
    - [x] Тесты: четыре подтипа с дженериком пользователя; `subjectOf` (user → он сам, delegate → замещаемый, guest/system → нет); `system.onBehalfOf`
    - [x] Реализация
    - Заметка: `delegate` — `{ subject, actor, delegationId }`, `system` — `{ source, onBehalfOf? }`, `guest` — `{ channelId }`
- Замечания по фазе (b56fba5): примитивы перенесены в `dmg/kernel/`; `expectOk`; тип `ErrorDef.payload` выводится из объявления; `GuestCaller` — необязательные `channel`/`channelId` (0f5116e). Полный `check` на батарее (CPU 400 МГц) красный по таймаутам двух тестов бота — повторить до контрольной точки
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: Манифесты домена и агрегат v2 [checkpoint: a3909e1]

- [x] Task: `defineEvents` 0cf130e
    - [x] Тесты: FQN `module.aggregate.event` из префикса группы; схема payload; ссылка на событие — объект
    - [x] Реализация
    - Событие в домене — `{ name, payload }`; конверт (eventId, occurredAt, aggregateId, caller) добавит UoW в Фазе 3
- [x] Task: Агрегат v2 и `defineAggregate` 0ef6e76
    - [x] Тесты: `create(): Result<Ar>` с событием; `restore()` без событий; `snapshot()`; мутация «черновик → валидация → фиксация» (при `Err` и при невалидном черновике состояние не меняется); накопление и выдача событий; статусы и переходы в Def
    - [x] Реализация
    - Невалидное состояние и необъявленный переход — `throw` (нарушение инварианта); `updatedAt` ставит ядро
- [x] Task: `ReadonlyAr<T>` a3576e7
    - [x] Тесты типов (`@ts-expect-error`): методы с `Result` недоступны, вопросы и идентификаторы доступны
    - [x] Реализация
    - Также скрыты `snapshot` (entity, DOM-01) и `pullEvents` (только UoW)
- [x] Task: `definePolicy` / `rule` / `anyOf` / `allOf` / `hasRole` e8d9eb7
    - [x] Тесты: `allowed`/`denied(rule, denyMessage)`; композиция; `delegable: false` отказывает `delegate`; правило работает с субъектом
    - [x] Реализация
    - Без субъекта (guest, system) правило отказывает; `anyOf` — со своим `name`/`denyMessage`, `allOf` — отказ первого правила. Политика для `system` в `handle()` — решить в Фазе 3
- [x] Task: Контракты `defineUseCase`, `defineEventReaction`, `defineJob`, `defineFacade`, `defineModule` 831c1b8
    - [x] Тесты: обязательные `label`/`description` (тип); ссылки объектами; вывод типов input/output/errors из Def
    - [x] Реализация
    - Сигнатура метода фасада — `method<Args, T>()({ … })` (фантомные поля типа); `schedule` — legacy `JobSchedule`; `check` полностью зелёный
- [x] Task: `normalize(def)` 83b0ea4
    - [x] Тесты: сериализуемое представление каждого вида Def; ссылки → FQN/коды; стабильность (одинаковый Def → одинаковый результат)
    - [x] Реализация
    - Размещено в `dmg/graph/`. Попутно 54f7d2e: субъект и контекст `allOf`/`anyOf` — пересечение по правилам
- [x] Task: Учебный модуль `todo` — доменная часть 3f3e306
    - [x] Агрегат, state, события, ошибки, политика, контракты 2–3 UC (command + query), ER, Job, фасад, модуль
    - [x] Unit-тесты агрегата и политики по TST-01/02
    - Размещён в `dmg/testing/example/todo/` + заглушка `users` (ER на чужое событие, `dependsOn`). Попутно e2049b7: `Aggregate.change` — тип по всему `Result`
- Замечания по фазе (11cbafa): `description` UC не описывает права доступа (это `policy`); `policy` обязательна для всех UC, без ограничений — явный `allowAll`; `EntityBase` выводится из `BaseEntityFields`; `JobSchedule` — своя копия в dmg (структурно совместима с legacy). `now()` остаётся на legacy-часах, третий параметр конструктора Ar — начальные события `create`. В Фазе 6 зафиксировать в `manifests.md`
- Разделение полей «бизнесовые / технические» (для `details` в документации) — таблица по виду Def в генераторе документации (вне трека, D-27), не в `normalize`: не раздувает хеш
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Прикладной слой

- [x] Task: UoW a3061cd
    - [x] Тесты: `register` + `commit` сохраняют последовательно через репозитории; события публикуются только после успешного `commit`; при сбое сохранения публикации нет
    - [x] Реализация (на существующей шине событий)
    - Решения: `emits` сверяется до записи (незаявленное событие — не пишется ничего); без `emits` проверки нет (прод). Шина DMG — адаптер `legacyEventBus`: legacy-подписчики видят события DMG в старой форме, подписчики DMG — только конверты DMG.
- [x] Task: `UseCaseFromDef` cc7701c
    - [x] Тесты: недопустимый `callers` → `UNAUTHORIZED`; невалидный вход → `INPUT_VALIDATION`; отказ Policy → `ACCESS_DENIED` с правилом; `Ok` → commit → publish; незаявленное событие → ассерт в test/dev; невалидный выход → `OUTPUT_VALIDATION`; исключение → `SERVER_INTERNAL` с логом; `this.err()` типом принимает только заявленные коды
    - [x] Реализация
    - Решения: наследник пишет `load` (контекст Policy) и `execute`; Policy вычисляет база — пропустить её нельзя. `system` допускается через `callers`, Policy для него не вычисляется (в `decisions.md` в Фазе 6). Отдельного `this.err()` нет: тип возврата `load`/`execute` пропускает только ошибки из `errors` Def (`@ts-expect-error` в тесте).
- [x] Task: `ReactionFromDef` и `JobFromDef` a1a6ba9
    - [x] Тесты: `Result`; сбой логируется, не гасится молча; вызов UC как `system` с `onBehalfOf`; ассерты `touches`/`calls` через прокси резолвера; Job — на существующем планировщике
    - [x] Реализация
    - Решения: `calls` — прокси резолвера (фасад распознаётся по `implementFacade`); `touches` (ER) и `scans` (Job) проверяет `UoW.register` по `Repository.aggregate` — так точнее прокси (репозиторий читают и без изменения). Job обходит записи через `forEach`: своя UoW на запись (API-06). Журнал сбоев пока = `logger.error`.
- [x] Task: Модуль — карта `Def → класс` e138684
    - [x] Тесты: пропуск реализации — ошибка компиляции (`@ts-expect-error`); сборка модуля в приложение рядом с legacy-модулями
    - [x] Реализация
    - Рядом с legacy: реакции — на общей legacy-шине с legacy-подписчиками, задания — в форме legacy `Job` для существующего планировщика. Подключение к `ApiApp` — в задаче `appApi.run`.
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
