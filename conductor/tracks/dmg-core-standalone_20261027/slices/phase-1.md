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

## Шаг 4 — `OperationRef.kind: 'app'` (api-author, платформа)

Решение **D-51** в `platform/dmg-core/docs/decisions.md` (Нурболат, 2026-10-27).

**Границы:** `platform/dmg-core/src/kernel/caller/` (тип `OperationRef`, схема JSON вызывающего в `caller.ts`), места, где разбирается `kind` (`grep` по `'eventReaction'`/`OperationRef`: лог операций, сериализация), `src/testing/example/app/example-caller-resolver.ts` (+ тест). Тип `OperationDmg` домена не трогать: `'app'` — не вид операции Def. Документацию не править (D-51 уже записан).

**Что сделать:** `OperationRef.kind` += `'app'`; JSON-схема вызывающего принимает и восстанавливает его; запись в oplog сохраняет; резолвер `ExampleApp` вызывает `users` от `SystemCaller({ kind: 'app', module: 'example-app', name: 'resolveCaller' })`.

**Тесты:** круг JSON `SystemCaller` с `from.kind: 'app'` (туда и обратно); неизвестный `kind` по-прежнему отвергается; запись резолвера в oplog — `from.kind: 'app'`. Red → green.

**Правила:** API-*, ERR-01, CODE-*, TST-*, простые типы.

**Приёмка:** гейт зелёный; `cd platform/dmg-core && bun run check` зелёный.

## Шаг 5 — минимальный in-proc раннер учебного примера (api-author, платформа)

Раннер по D-50: точка входа, `process.env` → `ExampleAppEnv`, транспорт (CLI), `Trace`; модули не собирает, `Caller` — через резолвер приложения.

**Границы:** новый каталог `platform/dmg-core/src/testing/example/runner/` (раскладку файлов выбери по `naming.md`, обоснуй). `ExampleApp` не менять (если нужно — эскалация). Документацию не править.

**Что сделать:**
- Класс CLI-раннера: `run(argv, io)` → код выхода. `io` — порт вывода (stdout/stderr строками), чтобы тест не трогал глобальный `console`/`process`. Команды — минимум две по UC `todo`: создать задачу и список задач; пользователь — опция (`--user <uuid>`, без неё — гость).
- Поток: разбор argv → `ExampleCallerResolver.resolve(uuid, trace)` → `api.dispatch(TodoModuleDef, <UcDef>.command(input), caller, trace)` → `Result` в stdout (JSON) — `Ok` код 0, `Err` код 2 (бизнес-отказ); ошибка ввода (неизвестная команда, нет обязательного аргумента) — сообщение в stderr, код 1, UC не вызывается. `Trace` — канал CLI, новый `requestId` на запуск.
- Точка входа (`main.ts` или аналог): `process.env` (например `EXAMPLE_DATA_DIR`, `EXAMPLE_USERS` через запятую, `EXAMPLE_MODE`) → `ExampleAppEnv`, `process.argv`, `process.exitCode`. Только здесь читается `process.env` (ARC-09). Без лишних зависимостей — разбор argv свой, простой.

**Тесты** (временный каталог ОС): команда создаёт задачу от пользователя — код 0, JSON с `taskId`, список её показывает; гость получает `Err` — код 2; неизвестная команда и нет `--title` — код 1, stderr, UC не вызван (oplog пуст); разбор окружения → `ExampleAppEnv` (если вынесен в класс — его тест).

**Правила:** D-50, ARC-09, API-*, ERR-01, CODE-*, TST-*. Новых зависимостей нет.

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

### Шаг 3 — отчёт автора (api-author, Opus)

- `example-app.types.ts` — `ExampleAppEnv = { mode, dataDir, users: readonly string[] }` (uuid активных пользователей; строки состояния строит приложение — `UserState` не утекает в окружение); `ExampleAppPorts = { bus?, logger?, clock? }` — подмена портов вторым аргументом, окружение остаётся данными.
- `example-app.ts` — `ExampleApp(env, ports)`: `AppContext` (`InProcEventBus`, `InProcOutbox` поверх шины, `InProcInbox`, `systemClock`, `ConsoleLogger`, JSONL oplog в `dataDir/oplog`), `UserMemoryRepo`/`TaskJsonRepo`, фабрики модулей, `api` (`ApiApp`), `callers`, `start()` → остановка. `process.env` нет.
- `example-caller-resolver.ts` — `ExampleCallerResolver.resolve(uuid?, trace)`: `getUser` через `api.dispatch`; нет идентичности, `USER_NOT_FOUND`, `active: false` → `GuestCaller`; прочие `Err` — исключение (ошибка конфигурации, ERR-01). Ролей в домене `users` нет → `hasRole: () => false`.
- Обход: `getUser` только для `system`, а у `OperationRef.kind` нет вида «вход приложения» → `SystemCaller({ kind: 'useCase', module: 'example-app', name: 'resolveCaller' })` — закрывается подзадачей `kind: 'app'`.
- Тесты: 10, `AwaitingBus` и временный каталог.

### Шаг 3 — отчёт ревьюера

| ID | файл:строка | суть | severity |
|---|---|---|---|
| ARC-04 | `example-app.ts:10`, `example-app.test.ts:17` | Def `todo` из `todo/index` вместо `todo/contract` (D-45) | major → исправлено; машинная проверка — в задаче `ExampleArch` |
| ERR-06/07 | `example-caller-resolver.ts:50` | любой `Err` → гость, `OPERATION_NOT_FOUND` прячется | major → исправлено (исключение) |
| — | `example-caller-resolver.ts:21-25` | выдуманный `OperationRef` | question → подзадача `kind: 'app'` (решение Нурболата) |
| CODE-03 | `example-app.ts:36-37` | `clock()` дважды на запись | minor → исправлено |
| CODE-01 | `example-app.ts:31-32` | `app`/`users` путают | minor → исправлено (`context`, `userRepo`, `taskRepo`) |
| TST-04 | `example-app.test.ts:144-160` | oplog через побочный `getUser` | minor → исправлено (явный `createTask`) |

### Шаг 4 — отчёт автора (api-author, Opus)

- `OperationRef.kind` += `'app'` (D-51), JSON-схема вызывающего принимает его; конструктор `OperationFromDef` теперь берёт `OperationDmg` домена — операция модуля не может получить вид `'app'`. `OperationRecord.kind` не менялся: вид вызова от приложения в логе — в `caller.from`.
- Резолвер `ExampleApp` — `SystemCaller({ kind: 'app', module: 'example-app', name: 'resolveCaller' })`.
- Тесты: круг JSON `SystemCaller` с `from.kind: 'app'`, неизвестный `kind` отвергается, запись резолвера в oplog.

### Шаг 4 — ревью

Diff ~20 строк прод-кода — проверил оркестратор по diff (без субагента): замечаний нет.

### Шаг 5 — отчёт автора (api-author, Opus)

- `runner/example-cli.ts` — `ExampleCli(app).run(argv, io)` → код выхода (`EXIT_OK` 0, `EXIT_USAGE` 1, `EXIT_REJECTED` 2). Команды `create-task --title <текст> [--user <uuid>]`, `list-tasks [--user <uuid>]`. Разбор argv → `Result<CliRequest, string>`: неизвестная команда/опция, нет значения, повтор опции, не-uuid в `--user` — код 1, stderr с «Использование:», резолвер и UC не вызываются. Затем `Trace` (канал `cli`, новый `requestId`) → `app.callers.resolve` → одна точка `api.dispatch` с сопоставлением «запрос → команда UC» (`switch`) → `Result` JSON в stdout.
- `example-cli.types.ts` — `CliIo = { out, err }`; `example-env.ts` (+ `.types.ts`) — `ExampleEnv(vars).toAppEnv()`: `EXAMPLE_MODE` (по умолчанию `development`, неверный — исключение), `EXAMPLE_DATA_DIR` (обязателен — иначе исключение), `EXAMPLE_USERS` через запятую.
- `main.ts` — единственное место `process.env`/`argv`/`exitCode`; `start()` и остановка — здесь.
- ARC-09: плагин в `biome.json` пакета подключён на весь `src/**` — `main.ts` исключён точечно (решение Нурболата, временно; пересмотр области — задача `ExampleArch`). Вместе с ним для `main.ts` отключён и CODE-02 (классов там нет).
- Тесты: 17 (CLI, окружение, запуск `main.ts` отдельным процессом).

### Шаг 5 — отчёт ревьюера

| ID | файл:строка | суть | severity |
|---|---|---|---|
| ERR-01 | `example-cli.ts:55` | не-uuid в `--user` → стектрейс резолвера, UC вызван | major → исправлено (ошибка ввода, код 1) |
| — | `example-cli.ts:109` | повтор опции молча перезаписывался | minor → исправлено (код 1) |
| CODE-01 | `example-env.ts:7` | `EnvVars` в файле класса | minor → исправлено |
| — | `example-cli.ts:56-69` | две ветки `dispatch` тернарником | minor → исправлено (одна точка) |
| — | `example-cli.ts:75, 93-96` | `CliRequest \| string`, нетипизированные опции | minor → исправлено (`Result`, `OptionOf<C>`) |
| TST-04 | `example-cli.test.ts:58-82` | тест 25 строк, значение до проверки формы | minor → исправлено |
| — | `example-env.ts:23` | дефолт `./example-data` в рабочем дереве | question → убран, каталог обязателен |
| — | `biome.json:182-186` | исключение отключает и CODE-02 | question → записано, пересмотр в задаче `ExampleArch` |
