# Бриф среза: Фаза 2 — `init --profile` и `gen module` в монорепо

Читай до старта: `../spec.md` (п. 3–4, нефункциональные), `../plan.md` (Фаза 2), решения **D-50, D-52, D-53** в `platform/dmg-core/docs/decisions.md`, `platform/dmg-core/docs/naming.md` §5, гайд `platform/dmg-core/docs/guides/app.md`. Образец приложения и раннера — `platform/dmg-core/src/testing/example/{app,runner,shared}` и `example.arch.ts`; образец плана файлов — `src/gen/plan.ts`, `src/gen/apply.ts`; карта плагинов — `platform/dmg-core/biome.json`.

Срез идёт шагами; агент получает путь к брифу и номер шага, делает только его. TDD: тест → запуск (red) → реализация → запуск (green), по шагам.

## Шаг 1 — каркас `single` как план файлов (api-author, платформа)

Решения Нурболата 2026-10-27 (п. 1–5 ниже).

**Границы:** новый каталог `platform/dmg-core/src/cli/scaffold/` (раскладку файлов выбери по `naming.md`, обоснуй), `src/cli/package-source.ts` (+ тест) — версии зависимостей. CLI (`main.ts`, `dmg-core-cli.ts`) не трогать — это шаг 3. Документацию пакета не править. `conductor/`, `data/` — нельзя.

**Что сделать.** Класс `ProjectScaffold` (имя можно уточнить с обоснованием): по профилю `single`, имени проекта и `PackageSource` строит `GenPlan` (пути относительно корня проекта или от переданного `root` — как `GenLayout`). Запись — существующий `applyPlan` (без перезаписи; коллизия — ошибка, ничего не записано); сам план ничего не пишет.

1. **Раскладка `single`** (как учебный пример):
   - домен: `src/domain/{m}`; тип пользователя (D-53): `src/domain/shared/app-user.ts`;
   - прикладной слой модулей: `src/app/{m}`;
   - корень сборки: `src/app/` — `app.ts` (класс `App`), `app.types.ts` (`AppEnv`, `AppPorts`), резолвер `Caller` (класс);
   - раннер: `src/runner/` — `main.ts` (единственное чтение `process.env`, ARC-09), класс CLI, разбор окружения → `AppEnv`.
2. **Пустое приложение без модулей.** `App` по `AppEnv` строит `AppContext` (`InProcEventBus`, `InProcOutbox`/`InProcInbox`, `systemClock`, `ConsoleLogger`, `JsonlOperationLog` в `dataDir`) и `ApiApp` с пустым списком фабрик; `start()` → остановка. Резолвер — всегда `GuestCaller`, `TODO`: «после модуля пользователей — `UserCaller` через `api.dispatch`, вызов от `SystemCaller` `kind: 'app'` (D-51)». CLI раннера: без команды/`--help` — usage и код 0, неизвестная команда — код 1. Тесты каркаса (в плане): `App` собирается и стартует/останавливается (`AwaitingBus`/двойники из `dmg-core/testing`, временный каталог ОС), резолвер отдаёт гостя, коды выхода CLI. Импорты — из `dmg-core`, `dmg-core/app`, `dmg-core/testing` (публичные входы пакета, не `#core/*`).
3. **Список модулей.** Фабрики — в `src/app/app.ts`; корни Def для `arch:check` — в `scripts/arch-check.ts`: `modules: []`, `layout` из `GenLayout.read(root)`, `root: src/app`, `runners: [src/runner]`, выход 1 при нарушениях. Пустой список модулей должен проходить `ArchChecker` — проверь; если нет — эскалация.
4. **Карта «плагин → каталоги»** — одна таблица в коде (класс или константа рядом с `ProjectScaffold`), по ней строится `biome.json` проекта; позже по ней же пишется раздел `rules.md`. Плагины — `./node_modules/dmg-core/biome-plugins/<файл>.grit`. Ориентир для `single` (сверь с `biome.json` пакета и `rules.md`, расхождения обоснуй):
   - `dom-14-no-clock`, ARC-11 (`noRestrictedImports`: домен не импортирует `dmg-core/*`, только `dmg-core`) — `src/domain/**`;
   - `dom-11-base-fields` — `src/domain/**/*.state.ts`;
   - DOM-01 (`noRestrictedImports` `**/*.state`, `**/state`) — `src/app/**`, кроме `**/infra/**`;
   - `arc-09-no-env` — `src/**`, кроме `src/runner/main.ts`;
   - `code-02-class-members`, `dom-12-no-iso-dates` — `src/**`;
   - `dom-17-snapshot-repo-only` — `src/**`, кроме `*.repo.ts`, `*.json-repo.ts`, `*.memory-repo.ts`;
   - `err-01-no-throw` — `*.ar.ts`, `*.dcs.ts`, `*.facade.ts`, `*.uc.ts`, `*.er.ts`; `api-02-no-manual-publish` — то же + `*.job.ts`;
   - везде — кроме `**/*.test.ts`. Остальное `biome.json` — как у пакета (форматтер, `organizeImports`, послабления для тестов).
5. **Прочие файлы:**
   - `package.json`: `name` — имя проекта, `private`, `type: module`; скрипты `arch:check` (`bun scripts/arch-check.ts`), `check` (`dmg-core sync --check` → `biome check .` → `tsc --noEmit` → `arch:check` → `bun test`), `lint`, `format`; зависимости: `dmg-core` `^<версия пакета>`, `valibot`, `@valibot/to-json-schema` — из `peerDependencies` пакета; dev: `@biomejs/biome` (точная), `typescript`, `@types/bun` — из `devDependencies` пакета. `PackageSource` отдаёт эти версии (тест).
   - `tsconfig.json` — как у пакета, `include: ["src", "scripts"]`.
   - `dmg-core.json` — `CliConfig.defaults()` (с секцией `gen` по умолчанию).

**Тесты** (`src/cli/scaffold/*.test.ts`): состав плана `single` (все пути выше); `package.json` — скрипты и версии из `PackageSource`; `biome.json` — плагины на нужных `includes` (по таблице); `dmg-core.json` разбирается `CliConfig.parse`; `arch-check.ts` использует `GenLayout`; применение плана во временный каталог; повторное применение — ошибка коллизии, ничего не записано. Сквозная проверка «каркас проходит `check` на установленном пакете» — не здесь, а в `consumer-e2e.sh` (шаг 5); но tsc-корректность шаблонов кода проверь хотя бы одним тестом: план во временный каталог внутри пакета с подменой `dmg-core` → импорт… — если это сложно без установки пакета, опиши в отчёте, как проверял шаблоны (например, разовый ручной прогон `bun pm pack` → установка → `check`), и приложи вывод.

**Правила:** CODE-* (ООП: класс с ответственностью, шаблоны — не россыпь функций), ERR-01, TST-*, простые типы. Новых зависимостей нет.

**Приёмка:** `bun run scripts/agent-gate.ts` зелёный; `cd platform/dmg-core && bun run check` зелёный.

## Отчёты

### Шаг 1 — отчёт автора (api-author, Opus)

`ProjectScaffold` (`src/cli/scaffold/`): план `single` — конфиги корня (`ProjectFiles`), исходники (`SingleSources`), карта линтера (`LintMap`, union `{id, includes, plugin | imports}`); `PackageSource` отдаёт `peerDependencies`/`devDependencies`. E2e-тест каркаса: план во временный каталог, symlink-и `node_modules`, `biome check`/`tsc`/`arch-check`/`bun test` зелёные. Отклонения: DOM-17 + `!**/*-repo.ts`; ERR-01/API-02 на весь `src`; tsconfig `types: ["bun"]`; `resolve()` без параметров; `RunnerCli` без `App`; окружение `APP_MODE`/`APP_DATA_DIR`. Пакет `check` — 987 pass.

### Шаг 1 — отчёт ревьюера (Opus)

- **error** ARC-02/ARC-03: домену запрещён только `dmg-core/*`; `node:fs` и импорт кода приложения проходят.
- warn: запрет домена подписан ARC-11 (это правило внутренностей пакета) — должен быть ARC-02; DOM-01 домена (policy/rules/dcs, чужой state) нет; тест карты тавтологичен — нет негативной проверки срабатывания.
- question: `resolve()` без идентичности (D-50); имя проекта — `Error`, а не `GenError`; нет `.gitignore`.
- info: `app.test.ts` проверяет текст исключения платформы; `EXIT_CONFIG = 3` без пояснения; нет типа возврата `sources()`.

## Шаг 1a — правки по ревью шага 1 (api-author, платформа)

Решения Нурболата 2026-10-27. Границы — как у шага 1.

1. **ARC-02/03 (error):** домен (`src/domain/**`, кроме тестов) — белый список импортов по образцу корневого `biome.json` u7-school: `dmg-core` (только корень), `valibot`, `.`, `./**`, `../**`; всё прочее (`node:*`, `bun:*`, `dmg-core/*`, пакеты) — ошибка ARC-02. Относительный выход домена в `src/app`/`src/runner` (`../../app/…`): проверь, ловит ли его `arch:check` (`ArchChecker` на каркасе); не ловит — добавь запрет в карту (шаблон по `app`/`runner`), обоснуй.
2. ID запрета домена — **ARC-02**, не ARC-11; сообщение — по тексту ARC-02 в `rules.md` пакета.
3. **DOM-01 в домене:** `src/domain/**/*.policy.ts`, `*.rules.ts`, `*.dcs.ts` — полный запрет `**/*.state`, `**/state` (вместе с белым списком ARC-02 в той же секции — biome не сливает `noRestrictedImports` разных overrides, проверь). Чужой state через относительный путь: ловит ли `arch:check`; если нет и глобом надёжно не выразить — запиши в отчёт как известный пробел.
4. **Негативный e2e карты:** во временном проекте каркаса — по файлу-нарушителю на каждое правило таблицы (включая ARC-02 `node:fs`, DOM-01 в policy и в app, исключение `infra`); `biome lint` выдаёт ожидаемый ID на ожидаемом файле, и нарушителей вне `includes` (тест, `infra`, `runner/main.ts` для ARC-09) — нет. Тест-тавтологию `lint-map.test.ts` сократи до того, что не покрыто e2e.
5. **Резолвер:** тип-интерфейс резолвера в `app.types.ts` с `resolve(uuid: string | undefined)` (форма возврата — как у учебного примера); класс-заглушка реализует его без параметров; `main.ts`/CLI передают идентичность (пока `undefined` или `--user`, на твой выбор, простое).
6. Неверное имя проекта — `GenError`.
7. Шаблон `app.test.ts` не проверяет текст исключения платформы; комментарий к кодам выхода (почему 3 — `EXIT_CONFIG`, 2 зарезервирован под бизнес-отказ); тип возврата `sources()`.
8. `.gitignore` в каркасе: `node_modules/`, `data/`; в usage раннера — `APP_DATA_DIR=data`.

**Приёмка:** гейт зелёный; `cd platform/dmg-core && bun run check` зелёный.

### Шаг 1a — отчёт автора (api-author, Opus)

Все 8 пунктов: ARC-02 — белый список домена (+ `..`) и запрет `**/../app(/**)`, `**/../runner(/**)` (`arch:check` выход домена в app/runner не ловит); DOM-01 policy/rules/dcs через `repeats: ['ARC-02']` (biome не сливает `noRestrictedImports` overrides); негативный e2e на 16 нарушителях, `lint-map.test.ts` — только «каждый `.grit` подключён» и битый `repeats`; `CallerResolver` в `app.types.ts`, команда `whoami [--user]`; `GenError`; `.gitignore`. Пакет `check` — 995 pass.

### Шаг 1a — повторное ревью (Opus)

Прежние замечания закрыты, error нет. question: `trace` в `CallerResolver.resolve`; warn: ложное ARC-02 на модули домена `app`/`runner` не записано; warn: пробел DOM-01 сформулирован неточно; info: в e2e нет DOM-01 для rules/dcs и положительного `dmg-core` в домене.

**Известный пробел (для раздела карты в `rules.md`, задача «Документация»):** импорт чужого state по относительному пути (`../../users/user/user.state`) lint ловит только в `*.policy.ts`/`*.rules.ts`/`*.dcs.ts`; в остальных файлах домена (Ar, DQS, `shared` и т. д.) — только `arch:check` (ARC-04, `FileChecker`) и только для модулей, внесённых в `modules` `arch-check.ts`; из `src/domain/shared` — не ловит ничто, остаётся review.

## Шаг 1b — доводка по повторному ревью (api-author, платформа)

Решения Нурболата 2026-10-27. Границы — как у шага 1.

1. `CallerResolver.resolve(uuid: string | undefined, trace: Trace)` — как в учебном примере (D-51: `trace` нужен для `api.dispatch` в модуль пользователей); заглушка по-прежнему без параметров; `whoami` в CLI каркаса строит `Trace` и передаёт.
2. Рядом с картой (`lint-map.ts`, строка запрета выхода в app/runner) — комментарий: имена модулей домена `app` и `runner` зарезервированы (ложное ARC-02).
3. E2e: нарушители DOM-01 для `*.rules.ts` и `*.dcs.ts`; положительный случай — файл домена с импортом `dmg-core` (корень) и `valibot` без нарушений.

**Приёмка:** гейт зелёный; `cd platform/dmg-core && bun run check` зелёный.

### Шаг 1b — отчёт автора (api-author, Opus)

`CallerResolver.resolve(uuid, trace)`, `whoami` строит `Trace` (канал `cli`); комментарий о зарезервированных именах `app`/`runner` в `lint-map.ts`; e2e — DOM-01 для rules/dcs и положительный случай `dmg-core`/`valibot` в домене. Пакет `check` — 998 pass. Ревью — оркестратор по diff (правка точечная). Полный `bun run check` проекта — 4275 pass, 0 fail.

## Шаг 2 — профиль `monorepo` как план файлов (api-author, платформа)

Решения Нурболата 2026-10-27 (раскладка, scope, tsconfig, каталоги). Границы — как у шага 1 (`src/cli/scaffold/`, CLI не трогать, документацию пакета не править; `conductor/`, `data/` — нельзя).

**Раскладка `monorepo`** (`ScaffoldProfile = 'single' | 'monorepo'`):

```
<root>/        package.json (name — имя проекта, private, workspaces: domain, app, modules/*, runners/*),
               tsconfig.json, biome.json, dmg-core.json, .gitignore, scripts/arch-check.ts
domain/        @<scope>/domain — exports ".": "./src/index.ts", "./*/contract": "./src/*/contract.ts", "./*": "./src/*/index.ts";
               src/shared/app-user.ts (D-53) + src/shared/index.ts; src/index.ts
app/           @<scope>/app — корень сборки: App, AppEnv/AppPorts, CallerResolver (как src/app в single); вход — src/index.ts
runners/cli/   @<scope>/cli — main.ts (ARC-09), RunnerCli, RunnerEnv (как src/runner в single)
modules/       пусто (пакеты модулей создаёт `gen module`, задача 4) — каталог в плане не нужен, если `applyPlan` не умеет пустые каталоги; workspace-глоб без совпадений bun допускает — проверь
```

1. **Scope** — из имени проекта: `acme` → `@acme/*`; `@acme/school` → `@acme/*` (корневой `package.json` — имя проекта как есть).
2. **`dmg-core.json`** — `CliConfig.defaults()` с секцией `gen`: `domain: "domain/src/{m}"`, `app: "modules/{m}/src"`, `domainImport: "@<scope>/domain/{m}"`.
3. **Зависимости:** каждый пакет — `dependencies` на то, что импортирует (`dmg-core`, `valibot` у домена; `@<scope>/domain: "workspace:*"` у `app` и `cli`; `@<scope>/app: "workspace:*"` у `cli`); корень — `dmg-core` (бинарь `dmg-core sync --check` и путь плагинов `./node_modules/dmg-core/…`) и инструменты `check` в `devDependencies`. Версии — `PackageSource`.
4. **tsconfig:** корневой — `compilerOptions` как у `single`, `include` — `src` всех пакетов (`domain/src`, `app/src`, `modules/*/src`, `runners/*/src`) и `scripts`; корневой `tsc --noEmit` проверяет всё. У пакетов — `tsconfig.json` `{ "extends": "../tsconfig.json", "include": ["src"] }` (для `runners/cli` — `../../tsconfig.json`).
5. **Скрипты:** `check` только в корне (тот же состав, что у `single`); у пакетов — `test` (`bun test`), не больше.
6. **Карта линтера `LintMap.monorepo`** — те же правила, что у `single`, на каталоги пакетов: домен `domain/src/**`; прикладной слой `modules/*/src/**` (DOM-01 кроме `**/infra/**`); корень сборки `app/src/**`; раннеры `runners/*/src/**`; ARC-09 — везде, кроме `runners/*/src/main.ts`; OPERATIONS — по всем пакетам. ARC-02 в домене: белый список прежний; выход из домена относительным путём в `app`/`runners`/`modules` — запрет, если `arch:check` его не ловит (проверь; глоб спецификатора — как в шаге 1, обоснуй). Пакеты `@<scope>/app`, `@<scope>/cli`, `@<scope>/<m>` белый список уже запрещает.
7. **`scripts/arch-check.ts`** — `modules: []`, `layout` из `GenLayout.read(root)`, `root: app/src`, `runners: [runners/cli/src]`. Проверь, что `ArchChecker` разрешает спецификаторы `@<scope>/domain/<m>/contract` и `@<scope>/app` (ARC-04/07/08); нет — эскалация.
8. **Исходники без дублирования:** шаблоны `single` и `monorepo` отличаются путями и спецификаторами импорта (тип пользователя: `../domain/shared/app-user` ↔ `@<scope>/domain/shared`; корень сборки из раннера: относительный ↔ `@<scope>/app`). Параметризуй один класс шаблонов раскладкой профиля (пути + спецификаторы), а не копируй 570 строк. `SingleSources` можно переименовать/обобщить — обоснуй имя. Поведение и тесты `single` не меняются (план `single` — тот же состав и содержимое, кроме неизбежного).

**Тесты:** состав плана `monorepo` (все пути выше); `package.json` корня и пакетов — workspaces, имена со scope, `exports` домена, зависимости `workspace:*`; scope для обоих видов имени; `dmg-core.json` — `CliConfig.parse`, секция `gen` с `domainImport`; `biome.json` — плагины на каталогах пакетов; tsconfig пакетов — `extends`. E2e (как у `single`): план во временный каталог, `node_modules` подменой (включая `@<scope>/*` → каталоги пакетов), `biome check`, `tsc`, `arch-check`, `bun test` — зелёные; негативный e2e карты — по нарушителю на правило в раскладке monorepo (минимум: ARC-02 `node:fs` в домене, DOM-01 в `modules/x/src` и исключение `infra`, ARC-09 в `app/src` и разрешённый `runners/cli/src/main.ts`, ERR-01).

**Правила:** CODE-*, ERR-01, TST-*, простые типы. Новых зависимостей нет.

**Приёмка:** `bun run scripts/agent-gate.ts` зелёный; `cd platform/dmg-core && bun run check` зелёный.

### Шаг 2 — отчёт автора (api-author, Opus)

`ScaffoldLayout.of(profile, name)` — все различия профилей (каталоги, спецификаторы, tsconfig, `gen`, workspaces, пакеты, карта); `SingleSources` → `AppSources` (параметр — раскладка, импорты через `sortImports`); `LintMap.of(LintDirs)` → `single`/`monorepo`; в monorepo ARC-02 запрещает домену относительный выход в `app`/`runners`/`modules` (`arch:check` его не ловит; имена модулей зарезервированы). `ArchChecker` разрешает `@<scope>/…` через `Bun.resolveSync` — эскалации нет. Отклонения: `bun test --pass-with-no-tests` у пакетов; `valibot`, `@valibot/to-json-schema` в dev корня (peer `dmg-core/arch`); DOM-01 на `app/src` и `modules/*/src`; отдельный рендер `package.json`. План `single` — байт в байт. Пакет `check` — 1039 pass.

### Шаг 2 — отчёт ревьюера (Opus)

error нет; план `single` идентичен HEAD (832 строки). warn: `--pass-with-no-tests` — с bun 1.3.1, а `engines` `>=1.2`. info: e2e выходов из домена — три в одном файле (тест слабее, чем выглядит); выход домена в `scripts/` не запрещён (вне брифа); `LINE_WIDTH` в двух файлах; мини-форматтер импортов в `AppSources` — оправдан.

## Шаг 2a — правки по ревью шага 2 (api-author, платформа)

Решения Нурболата 2026-10-27. Границы — шаг 2 плюс поле `engines` в `platform/dmg-core/package.json`.

1. `engines.bun` пакета — `>=1.3.1` (флаг `--pass-with-no-tests` остаётся). Если версия bun упомянута в README/доках пакета — не правь, перечисли в отчёте.
2. `LINE_WIDTH` — одно объявление в каркасе.
3. E2e: по файлу-нарушителю на каждый относительный выход домена (`app`, `runners`, `modules`), каждый — ожидаемый ID на своём файле.

**Приёмка:** гейт зелёный; `cd platform/dmg-core && bun run check` зелёный.

### Шаг 2a — отчёт автора (api-author, Opus)

`engines.bun` — `>=1.3.1` (README пакета — оркестратор); `LINE_WIDTH` — одно объявление в `project-files.ts`; e2e — `escape-app.ts`, `escape-runners.ts`, `escape-modules.ts`, ARC-02 на каждом. Пакет `check` — 1041 pass. Ревью — оркестратор по diff (правка точечная). Полный `bun run check` проекта — 4318 pass, 0 fail.
