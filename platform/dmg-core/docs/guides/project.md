# Проект — гайд

**Назначение:** как начать проект на DMG и как он растёт: каркас `dmg-core init --profile single|monorepo` (конфиги, `check`, корень сборки, раннер CLI), затем модули генератором и подключение каждого к приложению руками.

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

Порядок важен: сначала `bun add dmg-core`, потом `init` — бинарь `dmg-core` берётся из установленного пакета. Имя проекта — `--name`, иначе `name` из `package.json`, иначе имя каталога. Существующие файлы не перезаписываются (коллизия — ошибка, ничего не записано); существующий `package.json` дополняется. В monorepo, если `dmg-core` поставлен не из реестра (tarball, `file:`, `link:`), `init` при слиянии с `package.json` добавляет `overrides.dmg-core` с тем же спецификатором — иначе `bun install` ищет пакеты модулей в реестре и падает 404. Поставил `dmg-core` не из реестра уже после `init` — добавь `overrides` руками.

## 3. Что создаёт `init`

| Файл | single | monorepo |
|---|---|---|
| `package.json` | скрипты `check`, `lint`, `format`, `arch:check`; версии из пакета | то же + `workspaces`, домен в `devDependencies` корня |
| `tsconfig.json`, `biome.json` | строгий TS; `overrides` по [карте линтера](../rules.md#карта-линтера) | то же; у каждого пакета свой `tsconfig.json` поверх корневого |
| `dmg-core.json` | секция `gen` по умолчанию | `gen` с `domainImport` и `package` |
| `scripts/arch-check.ts` | `ArchApp` из `GenLayout`, `root` и `runners` — для ARC-07/08 | то же |
| домен | `src/domain/shared/app-user.ts` — тип пользователя | `domain/` — пакет с `exports` `./*/contract`, `./*` |
| корень сборки | `src/app/app.ts`, резолвер `Caller`, тест | `app/` — пакет `@<scope>/app` |
| раннер | `src/runner/`: окружение, CLI, `main.ts`, тесты | `runners/cli/` |
| `.gitignore`; агенты (`init` выполняет `dmg-core sync`) | `.gitignore`; скилы и роли (`.claude/`), ссылка на `llms.txt` в `AGENTS.md` | то же |

Раннер сразу работает: `APP_DATA_DIR=data bun <раннер>/main.ts whoami`. Как устроены приложение и раннер — [app.md](./app.md).

`check` проекта: `dmg-core sync --check` → `biome check` → `tsc --noEmit` → `arch:check` → `bun test`.

## 4. Как растёт проект

1. `gen module <m>`, `gen aggregate <m>.<a>`, `gen uc <m>.<a> <имя>` и т.д. ([naming.md](../naming.md) §5). В monorepo `gen module` создаёт и пакет `modules/<m>` (`package.json`, `tsconfig.json`).
2. Подключение модуля — `gen module` печатает его «Вставь вручную»:
   - корень сборки: фабрика в список модулей — `{ def: <M>ModuleDef, create: (deps) => create<M>Module({ ...deps, <репозитории> }) }`; фабрика — из входа прикладного пакета (`index.ts`), Def — из контракта домена; после `gen aggregate` — его репозиторий в `create`, например `taskRepo: new TaskJsonRepo(join(env.dataDir, 'task.json'))` (подсказки нет — о нём скажет `tsc`);
   - `scripts/arch-check.ts`: `<M>ModuleDef` в `modules`;
   - monorepo: `"@<scope>/<m>": "workspace:*"` в `app/package.json`, затем `bun install`.
3. Внешние операции модуля — в его `contract.ts` (D-45); вызов UC из раннера — команда через `app.api.dispatch` (TODO в `runner-cli.ts`, образец — [app.md](./app.md) §3).
4. Модуль пользователей — резолвер `Caller` перестаёт отдавать только гостя (TODO в `app-caller-resolver.ts`).
5. После каждого шага — `bun run format` (ручные правки ломают порядок импортов biome), затем `bun run check`.

## 5. Кто что правит руками

- **Каркас** пишется один раз: дальше `app.ts`, `arch-check.ts`, раннер и конфиги — код проекта, `init` их не обновляет.
- **Генератор** создаёт заготовки и правит только файлы с маркерами `// gen:…` (модуль, `index.ts`, `Deps`). Корень сборки, `arch-check.ts`, раннер и `package.json` корня сборки маркеров не имеют — по подсказке `gen module`.
- **Автор** заполняет `TODO` заготовок, контракт модуля, `dependsOn`, `callers` UC и репозитории в фабрике.
- **`dmg-core sync`** обновляет скилы и роли агентов после обновления пакета; `biome.json` и `tsconfig.json` после обновления пакета сверяй с картой линтера сам.

## 6. Чеклист правил

- ARC-07, ARC-08 — корень сборки берёт фабрику только из входа прикладного пакета; раннер — только приложение и контракты.
- ARC-06 — прикладной пакет модуля не импортирует соседей; один пакет на модуль домена.
- ARC-09 — окружение читает только `main.ts` раннера.
- TST-06 — `check` проекта зелёный после каждого шага.

## 7. Типичные ловушки

- Модуль сгенерирован, но не подключён — UC отвечает `OPERATION_NOT_FOUND`, `arch:check` модуль не проверяет.
- monorepo: забыта зависимость `app` на пакет модуля — `tsc` не находит `@<scope>/<m>`; после правки `package.json` — `bun install`.
- Модуль домена назван зарезервированным именем — ложное ARC-02: single — `app`, `runner`; monorepo — `app`, `runners`, `modules` ([rules.md](../rules.md#карта-линтера)).
- UC каркаса без модуля пользователей вызывается гостем: в `callers` UC нужен `'guest'` или резолвер с пользователями.
