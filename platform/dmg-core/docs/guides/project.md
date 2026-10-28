# Проект — гайд

**Назначение:** как начать проект на DMG и как он растёт: каркас `dmg-core init --profile single|monorepo` (конфиги, `check`, корень сборки, раннер CLI), затем модули генератором — он же подключает их к приложению; руками — только смысл заготовок.

---

## 1. Когда применять

- **single** — один пакет, всё в `src/`: домен `src/domain`, прикладной слой и корень сборки `src/app`, раннер `src/runner`. Для старта, учебных и небольших проектов; раскладка как у учебного модуля пакета.
- **monorepo** — пакеты workspaces `@<scope>/*`: домен `domain`, корень сборки `app`, прикладной пакет на модуль `modules/<m>`, раннеры `runners/<r>`. Когда модулей несколько и границы должны держаться на уровне пакетов; `scope` — из имени проекта (`@acme/school` → `acme`).
- Профиль выбирается один раз: переход между ними — перенос каталогов и правка секции `gen` `dmg-core.json`, генератора для него нет.
- Уже есть проект — `dmg-core init` без профиля (только `dmg-core.json`, скилы и роли) и раскладка в секции `gen` ([naming.md](../naming.md) §5).

## 2. Команда

```sh
mkdir school && cd school && echo '{ "name": "@acme/school" }' > package.json
bun add dmg-core                         # до публикации: bun add ./dmg-core-<версия>.tgz
bunx dmg-core init --profile monorepo   # или single; --dry-run — только план, --name — имя проекта
bun install && bun run check
```

Порядок важен: сначала `bun add dmg-core`, потом `init` — бинарь `dmg-core` берётся из установленного пакета. Имя проекта — `--name`, иначе `name` из `package.json`, иначе имя каталога. Существующие файлы не перезаписываются (коллизия — ошибка, ничего не записано); существующий `package.json` дополняется. Если `dmg-core` поставлен не из реестра (tarball, `file:`), `init` переписывает путь в зависимости корня относительно корня проекта (`../dmg-core-0.1.0.tgz`) — проект переносим вместе с tarball. В monorepo он же добавляет `overrides.dmg-core` с тем же путём — иначе `bun install` ищет `dmg-core` пакетов workspaces в реестре и падает 404. Старый абсолютный `overrides` на тот же файл заменяется; на другой пакет — ошибка с подсказкой, ничего не записано. Поставил `dmg-core` не из реестра уже после `init` — добавь `overrides` руками.

## 3. Что создаёт `init`

| Файл | single | monorepo |
|---|---|---|
| `package.json` | скрипты `check`, `lint`, `format`, `arch:check`; версии из пакета | то же + `workspaces`, домен в `devDependencies` корня |
| `tsconfig.json`, `biome.json` | строгий TS; `overrides` по [карте линтера](../rules.md#карта-линтера); `data/` biome не проверяет | то же; у каждого пакета свой `tsconfig.json` поверх корневого |
| `dmg-core.json` | секция `gen`: `compositionRoot: src/app` | `gen` с `domainImport`, `package`, `compositionRoot: app/src` |
| `scripts/arch-check.ts` | `ArchApp` из `GenLayout`, `root` и `runners` — для ARC-07/08; список `modules` с маркером генератора | то же |
| домен | `src/domain/shared/app-user.ts` — тип пользователя | `domain/` — пакет с `exports` `./*/contract`, `./*` |
| корень сборки | `src/app/app.ts`, резолвер `Caller`, тест | `app/` — пакет `@<scope>/app` |
| раннер | `src/runner/`: окружение, CLI, `main.ts`, тесты | `runners/cli/` |
| `.gitignore`; агенты (`init` выполняет `dmg-core sync`) | `.gitignore`; скилы и роли (`.claude/`), ссылка на `llms.txt` в `AGENTS.md` | то же |

Раннер сразу работает (`<раннер>` — `src/runner` | `runners/cli/src`):

```sh
APP_DATA_DIR=data bun <раннер>/main.ts whoami [--user <uuid>]
APP_DATA_DIR=data bun <раннер>/main.ts call <module>.<operation> [--input '<json>'] [--user <uuid>]
```

`call` вызывает любой UC подключённого модуля по имени (`todo.create` — имена Def модуля и UC, как в логе операций; `gen uc todo.task complete-task` → `call todo.completeTask`, агрегата в адресе нет) через `app.api.dispatchByName` и печатает `Result` JSON целиком (с `label`/`description` ошибки — это вывод для человека, не wire-формат [transport.md](../transport.md)). Коды выхода: 0 — `Ok`, 1 — ошибка ввода (argv, JSON, uuid), 2 — `Err` операции (в том числе `OPERATION_NOT_FOUND`, `INPUT_VALIDATION`, `UNAUTHORIZED`), 3 — окружение. Как устроены приложение и раннер — [app.md](./app.md).

**Резолвер каркаса — заглушка разработки.** Пока нет модуля пользователей, `--user <uuid>` даёт `UserCaller` без ролей, без `--user` — гость. Uuid принимается на веру только с канала `cli` (проверка в коде): с другого канала — исключение, удалённый вход (HTTP, бот) без модуля пользователей — дефект конфигурации. Uuid, придуманные в CLI, попадут в данные и не совпадут с реальными пользователями — это отступление от D-50 (`UserCaller` выдаёт модуль пользователей) только для каркаса.

`check` проекта: `dmg-core sync --check` → `biome check` → `tsc --noEmit` → `arch:check` → `bun test`. Незаполненные `TODO` в `label`/`description` Def `arch:check` печатает предупреждением (MAN-01) и не роняет — заготовки зелёные; `bun run arch:check --strict` считает их нарушениями (код 1) — для CI и перед выпуском.

## 4. Как растёт проект

```sh
bunx dmg-core gen module todo --write          # домен, прикладной слой (monorepo — пакет modules/todo), подключение
bunx dmg-core gen aggregate todo.task --write  # агрегат и JSON-репозиторий в фабрике модуля
bunx dmg-core gen uc todo.task create --write  # рабочий UC создания, публикует created
bunx dmg-core gen uc todo.task complete --write
bun install && bun run check                   # bun install — после gen module в monorepo
APP_DATA_DIR=data bun <раннер>/main.ts call todo.create --user "$(bun -e 'console.log(crypto.randomUUID())')"
```

1. **Подключение — генератор** ([naming.md](../naming.md) §5, маркеры `// gen:imports`, `// gen:modules`, `// gen:repos:<m>`):
   - `gen module` — фабрика в список модулей корня сборки (`{ def: <M>ModuleDef, create: (deps) => create<M>Module({ ...deps }) }`; фабрика — из входа прикладного пакета, Def — из контракта домена), `<M>ModuleDef` — в `modules` `scripts/arch-check.ts`, в monorepo — `"@<scope>/<m>": "workspace:*"` в `app/package.json` (затем `bun install`);
   - `gen aggregate` — репозиторий в фабрику: `<a>Repo: new <A>JsonRepo(join(env.dataDir, '<m>.<a>.json'))` (имя файла уникально в приложении).
   - Нет маркера (своя раскладка, правленый `app.ts`) или конфликт имён импортов (агрегаты с одним именем в двух модулях) — генератор печатает «Вставь вручную в <файл> перед <маркер>» с причиной и не падает. Без `gen.compositionRoot` при своей раскладке корень сборки не правится — подсказка называет поле.
2. **UC.** `gen uc <m>.<a> create` (или `create-*`) — рабочий: `<A>Ar.create`, `uow.register`, `emits: [created]`, выход `<a>Id`; остаётся перенести поля входа. Остальные — `load` агрегата по `<a>Id` с `NOT_FOUND`, `execute` с `TODO` для операции домена, `emits: []` ([use-case.md](./use-case.md) §2). Событие `created` должен кто-то публиковать (MAN-06): генератор напоминает, пока UC создания нет.
3. **Вызов.** Любой UC — `call` раннера; отдельный e2e-тест `call` проекту не нужен: раннер покрыт тестами каркаса, сценарии — тестами Ar и UC. Своя команда в `runner-cli.ts` нужна только для удобного интерфейса (образец — [app.md](./app.md) §3). Видимость для транспорта задают `callers` и Policy, а не `contract.ts` (D-54): контракт — граница импортов между модулями.
4. **Модуль пользователей** — резолвер `Caller` вместо заглушки (TODO в `app-caller-resolver.ts`, образец — [app.md](./app.md) §3).
5. После ручных правок — `bun run format` (порядок импортов biome), затем `bun run check`. Код генератора проходит `check` без правок.

## 5. Кто что правит руками

- **Каркас** пишется один раз: дальше `app.ts`, `arch-check.ts`, раннер и конфиги — код проекта, `init` их не обновляет. Маркеры `// gen:…` в них не удаляй — по ним генератор подключает модули.
- **Генератор** создаёт заготовки и правит существующие файлы только по маркерам: паспорт и карту модуля, `index.ts`, `Deps`, корень сборки, `arch-check.ts`, `dependencies` пакета корня сборки.
- **Автор** заполняет `TODO` заготовок (названия, схемы, поля state, операции Ar), контракт модуля для других модулей (D-45), `dependsOn`, `callers` и `policy` UC.
- **`dmg-core sync`** обновляет скилы и роли агентов после обновления пакета; `biome.json` и `tsconfig.json` после обновления пакета сверяй с картой линтера сам.

## 6. Чеклист правил

- ARC-07, ARC-08 — корень сборки берёт фабрику только из входа прикладного пакета; раннер — только приложение и контракты.
- ARC-06 — прикладной пакет модуля не импортирует соседей; один пакет на модуль домена.
- ARC-09 — окружение читает только `main.ts` раннера.
- MAN-01 — `label`/`description` Def заполнены (включая метки статусов и Policy): `arch:check` без предупреждения «незаполненных TODO», `arch:check --strict` зелёный.
- MAN-06 — каждое событие агрегата публикует какой-то UC/ER/Job (`arch:check`: «событие … никто не публикует»): объявил событие — сгенерируй операцию, которая его эмитит, или убери событие.
- TST-06 — `check` проекта зелёный после каждого шага.

## 7. Типичные ловушки

- Генератор напечатал «Вставь вручную» и это пропустили — модуль не подключён: UC отвечает `OPERATION_NOT_FOUND`, `arch:check` модуль не проверяет.
- monorepo: после `gen module` не выполнен `bun install` — `tsc` не находит `@<scope>/<m>`.
- Модуль домена назван зарезервированным именем — ложное ARC-02: single — `app`, `runner`; monorepo — `app`, `runners`, `modules` ([rules.md](../rules.md#карта-линтера)).
- `call` без `--user` — гость: UC с `callers: ['user']` отвечает `UNAUTHORIZED` (код 2). Нужен `--user <uuid>` или `'guest'` в `callers`.
- UC не-create сгенерирован раньше UC создания — `arch:check` красный по MAN-06 (`created` никто не публикует): `gen uc <m>.<a> create`.
