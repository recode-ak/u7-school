# App и раннер — гайд

**Назначение:** корень сборки — класс приложения, который по окружению `AppEnv` строит `AppContext`, репозитории и модули через `ApiApp` и отдаёт резолвер `Caller` (`<app>/<app>-app.ts`, D-50); раннер — точка входа: `process.env` → `AppEnv`, транспорт, `Trace`, запуск и остановка (`runners/<r>/`).

---

## 1. Когда применять

- Приложение одно на проект: все модули собираются в нём, раннеры (бот, HTTP, CLI) получают готовое приложение. Модули раннер не собирает и фасады руками не раскладывает — это делает `ApiApp` по `dependsOn` (цикл, отсутствующая зависимость, повтор — исключение сборки).
- Окружение — простые данные (режим, каталоги, параметры хранилищ); порты (шина, логгер, часы) подменяются отдельным аргументом для тестов, а не через окружение.
- Вызов UC снаружи модуля в процессе — `api.dispatch(moduleDef, ucDef.command(input), caller, trace)` (D-49); вне процесса — `ModuleApi` ([transport.md](../transport.md) §4). Межмодульный вызов изнутри модуля — фасад ([facade.md](./facade.md)).
- `Caller` строит резолвер приложения (по uuid из транспорта или его отсутствию), канал и `Trace` — раннер. Свой вызов UC приложение делает от `SystemCaller` с `from.kind: 'app'` (D-51).

## 2. Команда

`dmg-core init --profile single|monorepo` создаёт корень сборки (`app.ts`, `app.types.ts`, резолвер `Caller`, тест) и раннер CLI (окружение, `runner-cli.ts`, `main.ts`, тесты) — [project.md](./project.md). Модули к приложению подключает генератор по маркерам (`gen module`, `gen aggregate`). Раннер CLI вызывает любой UC командой `call <module>.<operation>` (`api.dispatchByName`); в каркасе остаётся `TODO` — резолвер с пользователями вместо заглушки (`--user <uuid>` → `UserCaller` без ролей, только канал `cli`; [project.md](./project.md) §3).

## 3. Образец

- [example-app.types.ts](../../src/testing/example/app/example-app.types.ts): `ExampleAppEnv` — только данные; `ExampleAppPorts` — подмена шины, логгера и часов.
- [example-app.ts](../../src/testing/example/app/example-app.ts): `AppContext` на `InProcEventBus`, `InProcOutbox`/`InProcInbox`, `ConsoleLogger`, `JsonlOperationLog`; фабрики модулей из входов пакетов (`app/<m>/index.ts`) с замыканием на репозитории; `start()` → `api.subscribe()`, возвращает остановку.
- [example-caller-resolver.ts](../../src/testing/example/app/example-caller-resolver.ts): `getUser` через `api.dispatch`; нет пользователя → `GuestCaller`, прочие `Err` — исключение (ошибка конфигурации).
- [example-cli.ts](../../src/testing/example/runner/example-cli.ts): argv → `Result` разбора → `Trace` (канал `cli`) → резолвер → одна точка `dispatch`; коды выхода 0 / 1 (ввод) / 2 (отказ UC).
- [example-env.ts](../../src/testing/example/runner/example-env.ts) и [main.ts](../../src/testing/example/runner/main.ts): `process.env` → `ExampleAppEnv` — единственное место чтения окружения.
- [example.arch.ts](../../src/testing/example/example.arch.ts): `root` и `runners` в `ArchApp` — их импорты проверяет `arch:check`.

## 4. Чеклист правил

- ARC-07 — приложение импортирует платформу, контракты домена и входы (`index`) прикладных пакетов; внутрь пакета модуля — нет (D-52).
- ARC-08 — раннер импортирует корень сборки, контракты и платформу; прикладные пакеты модулей — нет; операции — только через `api.dispatch`.
- ARC-09 — `process.env` читает только точка входа раннера; приложение получает `AppEnv`.
- ARC-05 — граф `dependsOn` без циклов: `ApiApp` проверяет его при сборке.
- ERR-01 — ошибка сборки и конфигурации (нет зависимости, неверное окружение, модуль не подключён в резолвере) — исключение, а не `Result`.

## 5. Типичные ловушки

- Резолвер превращает любую ошибку в гостя — дефект конфигурации прячется за отказом в правах; гость — только «нет пользователя».
- Раннер собирает модули или импортирует `app/<m>/…` — сборка дублируется по раннерам; раннер берёт только приложение.
- Дефолтный каталог данных от текущего каталога — данные появляются в рабочем дереве; каталог — обязательная переменная окружения.
- Порты в окружении (`AppEnv` с объектами) — окружение перестаёт быть данными; подмена — вторым аргументом.
- Реакции не подписаны: `start()` не вызван в точке входа — события публикуются, но никто не реагирует.

## 6. Как тестировать

Приложение — во временном каталоге ОС, шина `AwaitingBus` из `dmg-core/testing` (доставка без таймеров): сборка и фасад по `dependsOn`, запись в oplog, резолвер (известный, неизвестный, удалённый, модуль не подключён), реакция после `start()` и её отсутствие после остановки ([example-app.test.ts](../../src/testing/example/app/example-app.test.ts)). Раннер — `run(argv, io)` с буфером вместо `console`: коды выхода, ошибки ввода без вызова UC ([example-cli.test.ts](../../src/testing/example/runner/example-cli.test.ts)); точка входа — отдельным процессом ([main.test.ts](../../src/testing/example/runner/main.test.ts)). См. [testing.md](../testing.md).
