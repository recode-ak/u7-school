# Бриф: Фаза 3 — агентная приёмка

## Прогон 1 (2026-10-28, monorepo, Sonnet)

**Условия:** пустой каталог вне репо, только tarball `dmg-core-0.1.0.tgz` (`bun pm pack`), доступ к `/home/nur/dev` запрещён. Задача: monorepo, модуль `todo`, агрегат `Task`, UC `create`, вызов через CLI-раннер, `check` зелёный.

**Итог:** `check` зелёный (33 теста, 0 нарушений `arch:check`), раннер вызвал `todo.create` и записал задачу в `data/task.json`. Каркас `init --profile monorepo` зелёный сразу после `bun install`.

**Читал:** `llms.txt` → `guides/project.md` → `guides/app.md` → `naming.md` §5 → `guides/aggregate.md`, `guides/use-case.md` → образцы `src/testing/example/` (todo/task, app/todo, runner/example-cli.ts, expect-result.ts). Не открывал: `rules.md`, `layers.md`, `testing.md`, `errors-result.md`, скил, агенты.

### Где застрял

1. `tsc`: `Property 'deps' does not exist on type 'CreateUc'`. Правильно — `this.resolve.<repo>`; в `use-case.md` §3 этого нет, нашёл только в образце.
2. `arch:check`: `MAN-06: событие todo.task.completed никто не публикует`. Правила нет ни в `aggregate.md`, ни в чек-листе `project.md`. Решил вторым UC `complete`.

### Угадал или додумал

| # | Пробел | Где не хватило | Вид |
|---|---|---|---|
| G1 | `this.resolve.<имя>` в UC | `guides/use-case.md` §3 | док |
| G2 | сигнатура `execute(input, loaded, uow, caller)`; в заготовке `execute()` без параметров | заготовка `gen uc`, `use-case.md` | каркас/док |
| G3 | `callers: ['user']` в заготовке, а CLI каркаса даёт гостя (знал из ловушек `project.md` §7) | заготовка `gen uc` | каркас/док |
| G4 | код ошибки `<префикс ErrorDef>_<ключ>` для `expectErr` | `errors-result.md`/`testing.md` не открывал — проверить | док |
| G5 | MAN-06: каждое событие эмитит какой-то UC | `aggregate.md`, чек-лист `project.md` | док |
| G6 | `gen uc` всегда пишет `emits: [<A>Events.created]` (`src/gen/kinds/operation.ts:134`) — для `complete` молча неверно | генератор | каркас |
| G7 | схемы `input`/`output` из `TaskState.entries.<поле>` | `use-case.md` | док |
| G8 | ключ и путь репозитория в `app.ts` после `gen aggregate` (подсказки нет) | `project.md` §4, вывод `gen aggregate` | каркас/док |
| G9 | `Identified` в заготовке против `ExampleUser` в образце | `use-case.md`/`module.md` | док |
| G10 | команда раннера: TODO в заготовке вместо минимального кода | каркас раннера, `project.md` §4 п.3 | каркас/док |
| G11 | где можно брать uuid (в Ar нельзя, в UC образец — `crypto.randomUUID()`) | `aggregate.md`/`use-case.md` | док |

### Расхождения

- R1: вывод `gen module` — «package.json корня сборки» (`src/gen/kinds/app-module.ts:108`), а нужен `app/package.json`; `project.md` точнее.
- R2: дочерние `package.json` с `"dmg-core": "^0.1.0"` держатся на `overrides` с абсолютным путём к tarball — при переезде tarball правка руками (известно, решение 2026-10-28; упомянуть в `project.md`?).

## Задача 2 — закрыть пробелы прогона 1

Решение Нурболата 2026-10-28: всё на усмотрение оркестратора, прежние решения можно пересматривать; цель — пакет даёт конечному проекту максимум. Решения оркестратора: TR в конце брифа.

Читай до старта: этот бриф (протокол прогона 1 выше), `platform/dmg-core/docs/naming.md` §5, `docs/guides/project.md`, `docs/guides/use-case.md`, `docs/decisions.md` (D-50, D-52, D-53). Код: `src/gen/kinds/{operation,app-module,app-aggregate,module-package}.ts`, `src/gen/{apply,plan,layout}.ts`, `src/cli/scaffold/{app-sources,project-files,scaffold-layout,project-manifest}.ts`. Проект, поднятый агентом в прогоне 1 (образец ручных правок, которые надо убрать): `/tmp/claude-1000/-home-nur-dev-kalki-u7-school/a56f1f43-e8be-4008-907a-12c233a947ec/scratchpad/accept-1/work` (`app/src/app.ts`, `modules/todo/src/task/uc/create.uc.ts`, `runners/cli/src/runner-cli.ts`, `scripts/arch-check.ts`).

Общее: TDD по шагам (тест → запуск red → реализация → green); новых зависимостей нет; заготовки по-прежнему проходят `check` без правок; `consumer-e2e.sh` и `bun run e2e` пакета зелёные. `conductor/`, `data/` — нельзя. Не коммить.

### Шаг 1 — подключение модуля генератором (G8, R1)

Сейчас `gen module` печатает «Вставь вручную» для корня сборки, `arch-check.ts` и `app/package.json`; `gen aggregate` не подсказывает репозиторий для фабрики.

- `init` (оба профиля) пишет маркеры в `app.ts` корня сборки (импорт фабрик, список `modules`) и в `scripts/arch-check.ts` (импорт Def, список `modules`) — в стиле существующих `// gen:*`.
- `gen module` по маркерам вставляет: импорт и элемент `{ def: <M>ModuleDef, create: (deps) => create<M>Module({ ...deps, /* маркер репозиториев модуля */ }) }`; Def в `arch-check.ts`; в профиле с `gen.package` — зависимость `"<pkg>": "workspace:*"` в `package.json` пакета корня сборки (правка JSON, не текста; напомнить `bun install`).
- `gen aggregate` вставляет в фабрику модуля в `app.ts` репозиторий агрегата (`<a>Repo: new <A>JsonRepo(join(env.dataDir, '<a>.json'))` или как принято в каркасе — сверь с `app-aggregate.ts` и `Deps`), с импортом.
- Нет файла или маркера — прежнее «Вставь вручную» с точным путём файла (R1: `app/package.json`, а не «package.json корня сборки»), не падать.
- Результат: после `init` → `gen module` → `gen aggregate` → `gen uc` → `bun install` проект проходит `check` без ручного подключения.

### Шаг 2 — заготовка UC (G2, G3, G6)

- `emits`: `create` → `[<A>Events.created]`; иное имя — `emits: []` и `TODO` про событие операции (MAN-06: объявленное событие должен кто-то эмитить). Аналогично проверь заготовки ER/Job.
- `execute` с типизированными параметрами (`input`, `loaded`, `uow`, `caller` — как в образце `src/testing/example/app/todo/task/uc/*.uc.ts`), в теле — `TODO` с примером через `this.resolve.<a>Repo` и `uow.register`. Для не-`create` — `load` с загрузкой агрегата по образцу `complete-task.uc.ts` либо обоснуй, почему нет.
- `callers: ['user']` + комментарий: раннер каркаса до модуля пользователей вызывает от гостя (`'guest'` или `UserCaller`, ссылка на `project.md` §7).
- Тест реализации: репозиторий подставлен готовым (memory-репозиторий агрегата, если генератор его создаёт), а не `TODO`.

### Шаг 3 — раннер каркаса: универсальный вызов (G10)

CLI раннера в каркасе (оба профиля) получает команду `call <module>.<operation> [--input '<json>'] [--user <uuid>]`: `Caller` через резолвер → `app.api.dispatch` → печать `Result` JSON; неизвестная операция, неверный JSON или отказ — код 1. `whoami` остаётся. Тесты каркаса — red → green. Отдельная команда под каждый UC больше не нужна для проверки.

### Шаг 4 — `overrides` при установке из tarball (R2)

Пересмотр решения 2026-10-28: проверь, принимает ли Bun относительный путь к tarball в `overrides` корня (и в зависимости корня). Если да — `init` пишет путь относительно корня проекта (проект переносим вместе с tarball); если нет — оставить абсолютный и вернуть вывод с доказательством. Тест.

### Шаг 5 — документация (G1, G4, G5, G7, G9, G11 + шаги 1–4)

- `guides/use-case.md`: `this.resolve.<имя>` (Deps модуля), сигнатура `execute`/`load` с типами, схемы `input`/`output` из `<A>State.entries.<поле>`, тип пользователя (`Identified` в заготовке vs тип приложения), откуда uuid (снаружи Ar: UC — `crypto.randomUUID()` или вход), коды ошибок для `expectErr` (`<ПРЕФИКС>_<КЛЮЧ>`).
- `guides/project.md`: §4 — подключение генератором, `call`; §5 — что теперь руками; §6 чек-лист — MAN-06; `overrides` из шага 4.
- `guides/aggregate.md` — ссылка на MAN-06 у событий.
- `naming.md` §5 — новые маркеры; README, `llms.txt`, скил `dmg-architecture` — если затронуты.

### Отчёты: шаг 1 (api-author, Opus; reviewer)

- Маркеры `// gen:imports`, `// gen:modules` (`app.ts`, `scripts/arch-check.ts`), `// gen:repos:<m>` (фабрика модуля в `app.ts`). Поле `gen.compositionRoot` (single — `src/app`, monorepo — `app/src`); по умолчанию `src/app` только при раскладке по умолчанию, иначе общая подсказка «Корень сборки не задан».
- Зависимость пакета модуля — правка JSON (`PackageManifest`); импорты — `ImportBlock` (порядок и слияние как у biome; конфликт имён — «Вставь вручную» с причиной, без алиаса).
- Файл данных репозитория — `<m>.<a>.json` (уникально в приложении). `arch-check.ts`: `export const modules` — форма biome organizeImports (маркер под импортами только перед `export`).
- Ревью: error нет; 4 warn (длинные импорты, коллизия проверки присутствия и имени файла данных, ложный путь без `compositionRoot`, R1 в запасной подсказке) и info — исправлены автором, гейт/`e2e`/`check` зелёные.

### Отчёты: шаг 2 (api-author, Opus; reviewer)

- UC `create`/`create-*` — рабочая заготовка (`<A>Ar.create`, `uow.register`, `emits: [created]`, output `<a>Id`); прочие — `load` по `findById` + `NOT_FOUND`, `emits: []` с TODO (MAN-06). Сигнатура `execute` типизирована, комментарий к `callers` про гостя. Тест — с `<A>JsonRepo` во временном каталоге, без TODO.
- Подсказка MAN-06 в `notes`: `gen aggregate` всегда, `gen uc` не-create и `gen er` — если UC создания нет.
- Переносы длинных строк в форме biome — `src/gen/wrap.ts` (`fit`, `list`); срез с длинными именами в `src/gen/e2e.test.ts`. Попутно: `namedImport` не переносит одно имя; порядок путей импорта как у biome (`pathKey`).
- Отклонения: `biome.json` каркаса исключает `data` (UC создания пишет JSON, `check` краснел после запуска раннера); в e2e пакета и `scripts/gen-e2e.test.ts` добавлен UC создания.
- ERR-04: `ArchChecker` ждал префикс с дефисом для агрегата `study-group` — исправлено на UPPER_SNAKE.
- Ревью: error нет; warn (молчание о MAN-06) и info исправлены. Гейт/`check`/`e2e` зелёные.
- Замечено: `scripts/gen-e2e.test.ts` пишет срез в настоящие каталоги репо — гейт один раз упал с `ENOENT reading …/domain/src/genprobe/…test.ts` (гонка с обнаружением тестов), повтор зелёный. Было до трека; вынести вопрос Нурболату.

### Шаг 4а — `scripts/gen-e2e.test.ts` без гонки

Решение Нурболата 2026-10-28: в этом треке. Симптом: гейт/`check` изредка падает `Unhandled error between tests … ENOENT reading "/home/nur/dev/kalki/u7-school/domain/src/genprobe/…/*.test.ts"` (и `modules/genprobe/…`). Тест генерирует срез `genprobe` в настоящие каталоги репо (иначе не разрешаются `@u7-scl/domain` и `dmg-core`), запускает внутри biome/tsc/`bun test`/arch и удаляет в `afterAll`. Сначала воспроизведи и найди точную причину (какой процесс обнаруживает файлы среза: корневой `bun test` во время `beforeAll`, параллельные пакеты гейта, вложенный `bun test` и т. п.), потом чини причину. Варианты: копия/симлинк-окружение во временном каталоге с разрешением пакетов, исключение каталога среза из обнаружения корневым `bun test` (`bunfig.toml`/`pathIgnorePatterns`), уникальное имя среза — выбери и обоснуй. Проверка не ослабляется. Критерий: многократный прогон (например, 10 подряд полного `bun run check` и гейта) без падений.

### Решения оркестратора по ревью шагов 3–4 (2026-10-28, полномочия Нурболата)

- Резолвер каркаса: uuid → `UserCaller` без ролей только на канале `cli` — заглушка разработки; расхождение с D-50 (выдача `UserCaller` модулем пользователей) принято для каркаса без модуля пользователей, описать в `project.md` (шаг 5); придуманные uuid не совпадут с реальными пользователями.
- Видимость операции для транспорта задают `callers`/Policy, а не контракт: контракт (D-45) — граница TS-импортов между модулями. `dispatchByName`/`call` исполняют любой UC из `ModuleDef.useCases`. Записать в `decisions.md` пакета и `transport.md` (шаг 5).
- Коды выхода `call`: ввод — 1, `Err` — 2 (отличает «неверно вызвал» от «операция отказала»); вывод `call` — `Result` целиком (с `label`/`description`), не wire-формат `serializeResult` — описать (шаг 5).
- `portable` в обоих профилях.

### Отчёты: шаги 3–4 (api-author, Opus; reviewer)

- `ApiApp.dispatchByName(module, command, caller, trace)` — вызов по имени модуля без Def; `dispatch` идёт через него (одна ветка `OPERATION_NOT_FOUND`); `callers`/Policy/схема — через `uc.handle` (тесты `UNAUTHORIZED`, `ACCESS_DENIED`).
- Раннер каркаса: `call <module>.<operation> [--input json] [--user uuid]`, `whoami`; ввод — код 1, `Err` — 2, вывод — `Result` JSON. Резолвер: uuid → `UserCaller` без ролей только на канале `cli`, uuid с другого канала — исключение (дефект конфигурации), без uuid — гость.
- `ProjectManifest.portable`: путь к tarball относительно корня в обоих профилях (monorepo — и `overrides`); старый абсолютный `overrides` на тот же файл заменяется, на другой — `GenError` с подсказкой. Bun 1.4.2 принимает относительный путь (проверено переносом проекта и `--frozen-lockfile`).
- Видимость для транспорта — `callers`/Policy, не контракт: `scripts/consumer-wire.ts` удалён, e2e проходит без ручных правок.
- Ревью: error нет; 2 warn (доверие uuid вне CLI, нет тестов отказа на `ApiApp`) и info исправлены.

### Итог шага 4а (оркестратор, текущая сессия)

- Воспроизвести не удалось: 6 прогонов `CI=true bun test` подряд — без `ENOENT`; `agent-gate` в режиме full запускает один корневой `check`, параллельных пакетов нет. Версия: внешний `bun test` обнаруживает файлы среза `genprobe`, пока `beforeAll` их создаёт, а читает после `afterAll` (удалены).
- Решение: `scripts/gen-e2e.test.ts` → `scripts/gen-e2e.e2e.ts` (корневой `bun test` его не находит) и отдельный шаг `bun run gen:e2e` (`bun test ./scripts/gen-e2e.e2e.ts`) в `check` перед `bun test`. Генерация среза больше не идёт одновременно с другим обнаружением тестов. `pathIgnorePatterns` не подошёл: явный путь в `bun test` его не обходит.
- Проверка: 10 прогонов полного `bun run check` подряд — зелёные, `ENOENT` нет.

## Прогон 2 (2026-10-28, свежий tarball после задачи 2, Sonnet)

### single — короткий (`notes`, агрегат `Note` с `text`, UC создания, вызов через `call`)

**Итог:** `check` зелёный (34 теста), `call notes.create --input '{"text":"привет"}' --user <uuid>` → Ok, без `--user` → `UNAUTHORIZED` (код 2). Читал только `llms.txt` и `guides/project.md` — хватило; блокеров нет.

Мелкие пробелы:
- S1: список полей `F.*` — нашёл только grep по образцу (`guides/state.md`).
- S2: адрес `call` для `gen uc notes.note create` — `notes.create` (не `notes.note.create`): нет примера связи «имя в gen → адрес call».
- S3: новое поле state → править сгенерированные тесты (`<a>.ar.test.ts`, `<a>.policy.test.ts`, `<a>.json-repo.test.ts`, `create.uc.test.ts` с `handle({})`) — не сказано; `tsc`/тесты ведут, но напоминание помогло бы.
- S4: `check` зелёный при незаполненных `label: 'TODO: …'` — проверки не требуют заполнения TODO.

### monorepo — полный (`todo`: `Task` с `title`, `open`/`done`, `complete` только из `open`; UC create и complete; три вызова `call`)

**Итог:** `check` зелёный (40 тестов). `call todo.create` → Ok `taskId`; `call todo.complete` → Ok; повтор → `TASK_ALREADY_DONE` (код 2). Все `gen` — без «Вставь вручную», заготовки зелёные без правок (37 тестов). Блокеров нет; читал README, `llms.txt`, `project.md`, `app.md`, `naming.md` §5 (grep), `aggregate.md`, образец `todo/task`.

Мелкие пробелы:
- M1: синтаксис `transitions`/`rejects` — только в образце `task.ar.ts`; в `aggregate.md` §2 нет врезки.
- M2: выбор `kind` ошибки — `errors.md` не связан из `aggregate.md`/`project.md`.
- M3: метод Ar называется как переход (`this.transition('complete', …)`) — не сказано.
- M4: = S3 (тесты заготовок после смены state: `task.policy.test.ts` со статусом `active`, `task.json-repo.test.ts` без `title`).
- M5: README — путь раннера single/monorepo в одном примере легко перепутать.
- Вопрос агента: нужен ли e2e-тест `call` в проекте — нет: раннер покрыт тестами каркаса, сценарии — тестами Ar/UC (ответ в `project.md`).

## Задача 3 — остаток после прогона 2

Решение оркестратора: закрыть S1–S4, M1–M5 одним заходом, затем короткий контрольный прогон.

- **Код (api-author):**
  - (а) MAN-01 в `ArchChecker`: `label`/`description` Def, начинающиеся с `TODO`, — нарушение (заготовка не заполнена). Сейчас `check` проекта зелёный с `label: 'TODO: …'` (S4). Сгенерированные заготовки после `gen` тогда красные — это намеренно? **Нет:** заготовки должны проходить `check` без правок (спец., нефункциональные). Поэтому — предупреждение, не нарушение: `arch:check` печатает список незаполненных `TODO` в Def и выходит 0; флаг/опция строгости — на усмотрение автора с обоснованием.
  - (б) `gen uc` печатает адрес вызова: «Вызов: call <module>.<operation>» (S2).
  - (в) `gen aggregate` печатает: новое поле state — обнови `Create<A>` и тесты заготовок (`<a>.ar.test.ts`, `<a>.policy.test.ts`, `<a>.json-repo.test.ts`, тесты UC); статус по умолчанию — первый из `statuses` (S3/M4). Если тесты заготовок можно сделать устойчивыми к новым полям (одна фабрика входа `Create<A>` на агрегат в тестах, вместо литералов в каждом тесте) без type-level трюков — сделай и обоснуй.
- **Документация (оркестратор):** `aggregate.md` §2 — врезка `transitions`/`rejects`, имя метода = имя перехода, ссылка на `errors.md` для `kind`; `state.md`/`project.md` — где список `F.*`; README — пути раннера раздельно; `project.md` — адрес `call` из имени `gen uc`, e2e `call` не нужен.
