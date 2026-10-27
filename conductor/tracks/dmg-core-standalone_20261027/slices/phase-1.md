# Бриф среза: Фаза 1 — корень сборки и учебное приложение

Читай до старта: `../spec.md`, `../plan.md` (Фаза 1), решение **D-50** в `platform/dmg-core/docs/decisions.md` (и D-43, D-49), `platform/dmg-core/docs/layers.md` §5–6, `docs/transport.md` §4 (`apiApp.dispatch`).

Срез идёт шагами; агент получает путь к брифу и номер шага, делает только его. TDD: тест → запуск (red) → реализация → запуск (green), по шагам.

## Шаг 1 — `ApiApp` в `dmg-core/app` (api-author, платформа)

**Границы:** `platform/dmg-core/src/app/**` (новый каталог `src/app/api-app/`), экспорт в `src/app/index.ts`. Остальное не трогать; `conductor/`, `data/` — нельзя. Документацию пакета не править (отдельная задача).

**Что сделать.** Класс `ApiApp<U extends Identified>` — сборка модулей приложения и in-proc клиент (D-50, D-49):
- Вход: `AppContext` и список фабрик модулей. Фабрика — Def модуля + функция `ModuleDeps → ModuleFromDef` (замыкание на репозитории приложения). Форму типа фабрики выбери сам (простые типы, без type-level трюков), обоснуй в отчёте.
- Сборка в конструкторе (или статическом `create` — на твоё усмотрение): упорядочить по `def.dependsOn`, каждому модулю — `ModuleFacades` из `ModuleFacade` **только его** зависимостей (у модуля без зависимостей — пустой `ModuleFacades`). Ошибки сборки — исключение (`Error`, как `assertUniqueNames` в `module-from-def.ts`): цикл в `dependsOn`, зависимость без фабрики, повтор модуля (одно имя дважды). Внешний модуль (D-37, `external`) — обычная фабрика.
- `dispatch(moduleDef, command, caller, trace)` — типизированный `Result` (как `ModuleFromDef.dispatch`; команда UC чужого модуля — ошибка компиляции). Модуль не подключён → `Err` `CoreErrors.OPERATION_NOT_FOUND` `{ module, uc }`. Образец сигнатуры — legacy-потребитель `runners/u7-bot/src/core/u7-bot-ui-story.ts` (`dispatchUc`), только читать.
- `runJob(moduleDef, jobDef, trace)` и `subscribe()` — подписка реакций всех модулей, возвращает общую отписку.

**Тесты** (`src/app/api-app/api-app.test.ts`, образец модулей — учебные `todo` (зависит от `users`) и `users` в `src/testing/example/app`, двойники — `dmg-core/testing`):
- фабрики в любом порядке → модуль с зависимостью собирается после неё; UC `todo`, вызывающий `users` через фасад, работает;
- модуль без зависимостей получает пустые фасады (вызов чужого UC — ошибка «нет фасада»);
- цикл, отсутствующая зависимость, повтор — исключение сборки с понятным текстом;
- `dispatch` в неподключённый модуль → `OPERATION_NOT_FOUND`;
- `subscribe()` — событие `users` доходит до реакции `todo`; отписка снимает все;
- `runJob` вызывает Job модуля.

**Правила:** API-01, API-05, ERR-01 (ошибка сборки — исключение, а не `Result`), CODE-* (ООП: класс с ответственностью, без россыпи функций), TST-*. Новых зависимостей нет.

**Приёмка:** `bun run scripts/agent-gate.ts` зелёный; в пакете `cd platform/dmg-core && bun run check` зелёный.

## Шаг 2 — боевые `InProcEventBus` и `ConsoleLogger`, `AwaitingBus` в `dmg-core/testing` (api-author, платформа)

Решение Нурболата 2026-10-27: пакету нужны боевые in-proc шина и логгер (сейчас — только двойники `MemoryBus`/`MemoryLogger`); `AwaitingBus` из `api-app.test.ts` — в `dmg-core/testing`.

**Границы:** `platform/dmg-core/src/app/events/` (шина), `platform/dmg-core/src/app/` (логгер — каталог на твой выбор по `naming.md`), экспорт в `src/app/index.ts`; `src/testing/` (`AwaitingBus` + экспорт в `src/testing/index.ts`), `src/app/api-app/api-app.test.ts` (перевести на вынесенный `AwaitingBus`). Документацию пакета не править.

**Что сделать:**
- `InProcEventBus implements EventBus` — конструктор принимает `Logger`; `publish` доставляет конверт подписчикам по имени события в порядке подписки, не дожидаясь обработчиков; исключение или отказ промиса обработчика → `logger.error` (источник, имя события, текст ошибки), остальные обработчики выполняются, `publish` не бросает. `subscribe` → отписка.
- `ConsoleLogger implements Logger` — запись строкой в `console` по уровню, порог уровня — опция конструктора (по умолчанию `info`); `meta` — JSON в конце строки.
- `AwaitingBus extends MemoryBus` — как в `api-app.test.ts` (`delivered()` дожидается запущенных обработчиков без таймеров); тест на `delivered()`.

**Тесты:** доставка подписчикам и порядок; отписка; синхронное исключение и отказ промиса → `logger.error`, другие обработчики получили конверт; `ConsoleLogger` — порог уровня и формат (подмена `console` в тесте); `AwaitingBus.delivered()`.

**Правила:** API-*, ERR-01, CODE-*, TST-* (без таймеров в тестах). Новых зависимостей нет.

**Приёмка:** гейт зелёный; `cd platform/dmg-core && bun run check` зелёный.

## Шаг 3 — учебное приложение `ExampleApp` (api-author, платформа)

**Границы:** `platform/dmg-core/src/testing/example/app/` (новые файлы приложения; модули `todo`/`users` не менять, кроме крайней нужды — тогда эскалация). Документацию не править.

**Что сделать (D-50):**
- `ExampleAppEnv` — простые данные: `mode: AppMode`, `dataDir: string` (задачи — `TaskJsonRepo`, лог операций — `JsonlOperationLog` в подкаталоге), начальные пользователи для `UserMemoryRepo` (форму выбери сам, простую).
- `ExampleApp` — по `ExampleAppEnv` строит `AppContext` (`InProcEventBus`, `InProcOutbox`, `InProcInbox`, `systemClock`, `ConsoleLogger`, JSONL oplog), репозитории, фабрики модулей `users`/`todo` и `ApiApp<ExampleUser>`; отдаёт `api` (`ApiApp`) и резолвер `Caller`. Для тестов — способ подменить порты контекста (шина, логгер, часы) без `process.env`; форму выбери сам, обоснуй.
- Резолвер `Caller` (класс): по идентичности из транспорта (uuid или её отсутствие) → `UserCaller<ExampleUser>` через модуль `users` (вызов UC через `api.dispatch`, не по ссылке на Def), иначе `GuestCaller`. Неизвестный uuid → `GuestCaller`. Откуда `hasRole` — реши по домену `users`, обоснуй.
- `start()` — подписка реакций (`api.subscribe()`), возвращает остановку. Чтения `process.env` в приложении нет (ARC-09).

**Тесты** (`example-app.test.ts`, временный каталог ОС, `AwaitingBus` из `dmg-core/testing` вместо таймеров): сборка `todo`+`users` с фасадами по `dependsOn` (UC `todo`, проверяющий пользователя через фасад `users`, работает); резолвер: известный uuid → `UserCaller`, неизвестный/нет → `GuestCaller`; после `start()` событие `users` (удаление пользователя) доходит до реакции `todo`; запись UC в oplog (JSONL в `dataDir`); остановка снимает подписки.

**Правила:** D-50, API-01, API-05, ARC-09, ERR-01, CODE-*, TST-*. Новых зависимостей нет.

**Приёмка:** гейт зелёный; `cd platform/dmg-core && bun run check` зелёный.

## Отчёты

### Шаг 1 — отчёт автора (api-author, Opus)

- `src/app/api-app/api-app.ts` — `ApiApp<U>`: сборка в конструкторе, порядок — обход в глубину по `dependsOn`, граф по имени Def; затем Def сверяются по ссылке (Def из `dependsOn` и Def модуля, который вернула фабрика, — тот же объект, что у фабрики), иначе `ModuleFacade.serves` не узнал бы свои UC. Ошибки сборки — `Error`: повтор, зависимость без фабрики, цикл, фабрика вернула другой Def / другой объект Def с тем же именем.
- `api-app.types.ts` — `ModuleFactory<U> = { def: AnyModuleDef; create(deps: ModuleDeps) → AnyModuleFromDef<U> }`: простой тип, держит разные модули в одном списке, замыкает репозитории приложения.
- `dispatch` → `OPERATION_NOT_FOUND` для неподключённого модуля; `runJob` неподключённого модуля — исключение (ошибка конфигурации в рантайме, ERR-01, как `ModuleFromDef.runJob`); `subscribe()` — общая отписка.
- Тесты: 14 на учебных `users`/`todo` (`TaskJsonRepo` во временном каталоге), локальная `AwaitingBus` вместо таймеров.

### Шаг 1 — отчёт ревьюера

| ID | файл:строка | суть | severity |
|---|---|---|---|
| — | `api-app.ts:102-114` | связь по имени: другой объект Def с тем же именем ловился только в рантайме | info → исправлено (сверка по ссылке) |
| ERR-01 | `api-app.ts:75-91` | JSDoc `runJob`: «исключение сборки» вместо ошибки конфигурации в рантайме | info → исправлено |
| CODE-01 | `api-app.test.ts:181` | имя `viaTodo` вводит в заблуждение | info → исправлено (`adminPurge`) |
| TST-04 | `api-app.test.ts:75-92` | `AwaitingBus` — в тесте; перенести в `dmg-core/testing`, если понадобится дальше | info → оставлено (решение Нурболата) |

### Шаг 2 — отчёт автора (api-author, Opus)

- `app/events/in-proc-event-bus.ts` — `InProcEventBus(logger)`: доставка по снимку подписчиков, не ждёт обработчиков; синхронное исключение и отказ промиса → `logger.error('event-bus', …, { event, eventId, error })`; пустой набор удаляется при отписке последнего.
- `app/logger/console-logger.ts` (+ `.types.ts`: `LogLevel`, `LogConsole`, `ConsoleLoggerOptions`) — `[уровень] источник: сообщение` + JSON `meta`; порог `level` (по умолчанию `info`); `console` — опция конструктора; несериализуемая `meta` → пометка; метку времени ставит окружение.
- `testing/awaiting-bus.ts` — `delivered()` повторяет ожидание, пока появляются новые обработчики (каскады); пачки через `allSettled`, затем первая ошибка. `api-app.test.ts` переведён на него; `memory-logger.types.ts` ссылается на `LogLevel`.

### Шаг 2 — отчёт ревьюера

| ID | файл:строка | суть | severity |
|---|---|---|---|
| CODE-03 | `in-proc-event-bus.ts:29-41` | подписка повторяет `MemoryBus.subscribe` | minor → оставлено: двойник не зависит от боевого кода |
| — | `in-proc-event-bus.ts:38-40` | пустой `Set` после отписки | minor → исправлено |
| — | `in-proc-event-bus.ts:53-57` | источник лога — шина, не реакция | question → оставлено: шина не знает подписчика |
| TST-04 | `in-proc-event-bus.test.ts:63-67` | тест «не ждёт обработчиков» ничего не доказывал | minor → исправлено |
| CODE-01 | `console-logger.types.ts:2` | `LogLevel` дублирует литерал `memory-logger` | minor → исправлено (решение Нурболата) |
| — | `awaiting-bus.ts` | отказ одного обработчика терял остальные | question → исправлено (`allSettled`) |
| CODE-01 | `in-proc-event-bus.test.ts:2-3` | двойники в обход `#core/testing/index` | minor → исправлено |
