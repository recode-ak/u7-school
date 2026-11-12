# Бриф среза: barrel-реэкспорты (DEBT-3), Фаза 7

Автор брифа — orchestrator (Opus), без `tech-lead`: механический перенос импортов. Исполнитель — `migrator` (flash), один шаг.

## Состояние на старте (HEAD `b8e095b0`)

Ф5–Ф6 сократили объём плана (46/102/8/11 → ниже). `@u7-scl/app-legacy/domain` больше не реэкспортирует `User`/`Role` (только `School`, `U7ApiApp`, `U7AppResolver`, константы школы) — его импорты **не barrel модуля**, не трогаются. `@u7-scl/core/domain` — вход платформы, не barrel модуля, не трогается.

## Границы

### Импорты `@u7-scl/<m>/domain` → `@u7-scl/domain/<m>`

Тесты вне `runners/*/src` и `scripts/` не проверяются ARC-08, поэтому полный вход домена (`@u7-scl/domain/<m>`) им разрешён. Имена символов не меняются: barrel'ы — `export *` из того же входа.

| Файл | Было | Станет |
|---|---|---|
| `scripts/migrate-users-drop-student.ts` | `@u7-scl/user/domain` | `@u7-scl/domain/user` |
| `scripts/stream-snapshot-sync.ts` | `@u7-scl/stream/domain` | `@u7-scl/domain/stream` |
| `runners/u7-bot/tests/worlds/{materializer.test,core-education,minimal,types,manifest-and-seed.test,invariants,builder}.ts` | `@u7-scl/user/domain`, `@u7-scl/{course,stream,wish}/domain` | `@u7-scl/domain/{user,course,stream,wish}` |
| `runners/u7-bot/tests/e2e/wish-questionnaire.e2e.test.ts`, `runners/u7-bot/tests/courses/wish-flow.integration.test.ts` | `@u7-scl/wish/domain` | `@u7-scl/domain/wish` (символ из контракта — `@u7-scl/domain/wish/contract`, если во входе `wish` его нет) |

`builder.ts` импортирует `UserRole` — проверь, экспортирует ли его `@u7-scl/domain/user` (`user.state`). Нет — эскалация, не добавляй экспорт.

### Удалить

- `modules/{course,peer-review,questionnaire,stream,user,wish}/src/domain/index.ts` (и каталог `src/domain`, если опустел);
- строку `"./domain"` в `exports` этих шести `modules/*/package.json`;
- пути `@u7-scl/{user,course,wish,questionnaire}/domain` в корневом `tsconfig.json` (остальных путей `<m>/domain` нет; `@u7-scl/core/domain` и `@u7-scl/app-legacy/domain` — оставить).

### Попутно

- `platform/app-legacy/package.json` — добавить `"@u7-scl/domain": "workspace:*"` в `dependencies` (`api.ts` импортирует контракт `user`; info ревью Ф6). Если после правки нужен `bun install` — запусти его.

## Не трогать

`@u7-scl/app-legacy/domain`, `@u7-scl/core/domain` и их импорты; `modules/dossier/src/index.ts` (остаток DEBT-3, трек `dossier`); строки-литералы в `scripts/domain-check.test.ts`; `TODO.md` и прочие `.md`; `domain/src/**` (экспорты не расширять); `dmg-core`; `data/`; `conductor/`; `node_modules/`. Не коммить. Нужна правка вне границ — эскалация.

## Критерии приёмки

- `grep -rnE "@u7-scl/(user|course|stream|wish|questionnaire|peer-review)/domain\b" --include=*.ts --include=*.json . --exclude-dir=node_modules --exclude-dir=conductor` пуст.
- `ls modules/*/src/domain/index.ts` — нет файлов.
- `bun x tsc --noEmit`, `bun run lint`, `bun run arch:check` зелёные; `bun run check` зелёный.
- `git status data/` чист.

**Уточнение критерия плана Ф7** (TR-61 «Ф7»): grep плана `@u7-scl/[a-z-]*/domain` ловит и входы платформы `core/domain`, `app-legacy/domain` — они не barrel'ы модулей и остаются (`app-legacy` остаётся целиком, spec). Критерий сужен до шести модулей.

ID: ARC-04, ARC-07, ARC-08, TST-08 (тесты не удаляются и не копируются).

## Шаг 2 (после эскалации ARC-04)

**Эскалация шага 1.** ARC-04 (`checkContractImports`, `scripts/domain-check.ts`) проверяет и `runners/*/tests/**`, и `scripts/**/*.ts` (D-45); barrel'ы `@u7-scl/<m>/domain` прятали 23 нарушения в 11 файлах. Утверждение брифа «тестам полный вход разрешён» неверно.

**Решение Нурболата (TR-61 «Ф7»):**
1. **Тесты — вход `testing` (D-70).** Миры и тесты `runners/u7-bot/tests/**` (каталог `tests/` — тестовый код, TST-07) берут символы вне контракта из `@u7-scl/domain/<m>/testing`. Создать/дополнить `domain/src/{user,course,stream,wish}/testing.ts` реэкспортом **ровно** тех символов, что нужны тестам (список — из нарушений `arch:check`); у `user` вход уже есть — дополнить. Символ есть в `contract` — брать из `contract`, в `testing` не дублировать. JSDoc у реэкспорта: «кто и зачем» (миры u7-bot: форма записей на диске / Def для проверки инвариантов).
2. **`scripts/` вне ARC-04.** В `checkContractImports` (`scripts/domain-check.ts`) пропускать файлы `scripts/**`; TDD: сначала тест в `scripts/domain-check.test.ts` (`scripts/x.ts` с полным входом чужого модуля на Def — нет ARC-04; файл модуля с тем же импортом — ARC-04 есть), запуск — red, затем правка. Скрипты остаются на `@u7-scl/domain/<m>`.

**Границы шага 2:** `domain/src/{user,course,stream,wish}/testing.ts`, импорты в `runners/u7-bot/tests/**` (из шага 1), `scripts/domain-check.ts`, `scripts/domain-check.test.ts`. Экспорты `contract.ts`/`index.ts` не менять. Остальное «Не трогать» — как выше.

**Критерии:** `bun run arch:check` и `bun run check` зелёные; `grep -rn "@u7-scl/domain/[a-z-]*['\"]" runners/*/tests --include=*.ts` пуст (только `/contract` и `/testing`).

## Отчёт автора (`migrator`, flash, `ud-F7-barrel`)

Шаг 1: импорты переведены, 6 barrel'ов, `"./domain"` в `exports` (у `course` ключ `exports` удалён целиком — в нём был только `./domain`), пути `tsconfig.json` удалены; `@u7-scl/domain` — в `platform/app-legacy/package.json`. Вынужденно вне таблицы: `export * from './domain'` снят в шести `modules/*/src/index.ts`, `scripts/stream-snapshot-sync.test.ts` — `StudentState` из `@u7-scl/domain/stream`. Эскалация: 23 × ARC-04 (barrel'ы прятали полный вход домена в мирах и скриптах) → решение Нурболата, шаг 2.

Шаг 2: `testing.ts` у `course`, `stream`, `wish` (новые) и `user` (дополнен) — только символы, нужные `runners/u7-bot/tests/**`, без дублей с `contract` (`StreamStatus` — из `stream/contract`). `scripts/` вне ARC-04 по TDD (red: `ARC-04: scripts/x.ts … '@u7-scl/domain/wish'`, 69 pass / 1 fail → 70 pass). `arch:check` — 0 нарушений, `check` — 3083 pass.

## Отчёт ревью (`dmg-reviewer`, Opus)

`error` нет. Minor (исправлены в срезе, круг 3 `ud-F7-barrel`): CODE-04 — комментарий исключения `scripts/` без ссылки на D-45/TR-61 и дубль комментария с JSDoc; TST-08 — контрольный случай теста повторял `:304–308` (взят тот же импорт `@u7-scl/domain/wish` вне `scripts/`); осиротевшие `// Domain` в `modules/*/src/index.ts`; `bun.lock` без новой зависимости `app-legacy → domain`.

Вне границ (Ф8): `domain/package.json` объявляет `@u7-scl/app-legacy`, но `domain/src` его не импортирует — мёртвая запись, вместе с новой `app-legacy → domain` даёт цикл в манифестах. Вопрос: `testing` реэкспортирует state-типы и Def агрегатов (шире «фикстур владельца» D-70) — решение записано в TR-61 «Ф7»; `decisions.md` пакета не меняется (вход тот же, правило TST-07 то же).
