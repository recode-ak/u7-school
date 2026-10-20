# Бриф migrator: модуль `wish`

Читай до старта: `../plan.md`, `../debt.md` (D-21…D-23 уже заведены оркестратором и внесены в allowlist — тебе только расставить маркеры), `conductor/architecture/migration.md` §1, `legacy.md`, `slices/stream.md` (образец переноса).

## Границы
- Источник: `packages/wish/src/domain/**` (код + 4 тестовых файла; до переноса `bun test packages/wish/src/domain` = 40 pass). Куда: `packages/domain/src/wish/` (сохранить структуру: `module.ts`, `index.ts`, каталог `wish/` с `commands/`, `pools/` и остальным).
- `dependsOn` модуля: `user`, `course`, `questionnaire`, `stream`. Другие модули домена не импортировать.
- Не трогать: `data/`, `packages/dmg-core`, логику (правятся только импорты).

## Шаги
1. `git mv` кода и тестов в `packages/domain/src/wish/`; алиасы `#domain-legacy/*` внутри перенесённого кода (если есть) заменить относительными путями.
2. `index.ts` — публичный API (как был `packages/wish/src/domain/index.ts`; добавь экспорты `*-cmd.ts`, которые нужны потребителям, использующим глубокие пути); `state.ts` — схемы entity (Wish/статусы/target, `WishArMeta`); `contract.ts` — реэкспорт ошибок (`*UcError`, `WishModuleError`). Образец — `domain/course`, `domain/stream`.
3. В `packages/wish/src/domain/index.ts` — только `export * from '@u7-scl/domain/wish'` с `// DEBT(D-23)`.
4. Импорты `@u7-scl/{course,questionnaire,user,stream}/domain` → `@u7-scl/domain/<dep>` (ARC-04), без маркера.
5. Маркеры: все импорты `@u7-scl/core/*` в `packages/domain/src/wish/**` — `// DEBT(D-21)`; импорт `@u7-scl/app/domain` в `module.ts` — `// DEBT(D-22)` (рядом `biome-ignore lint/style/noRestrictedImports`, как в `stream/module.ts`). Многострочный импорт — маркер комментарием в конце строки `from`. Найдётся ещё импорт app/core вне перечисленных — эскалация.
6. Линтерные нарушения (DOM-12 `v.isoDateTime`, CODE-02 `#private`): `biome-ignore lint/plugin: … (долг не заведён)` — долг сам не заводи, оркестратор заменит.
7. Потребители в `packages/wish` (api/infra/ui) и `scripts/`, использующие `#domain-legacy/*` или глубокие пути в старый `domain` — заменить на `@u7-scl/domain/wish`. Импорты `@u7-scl/wish/domain` у других пакетов не трогать (их закрывает barrel D-23). Если домен импортирует что-то из `packages/wish/src/api` — перенеси это в домен с маркером и реэкспортом в старом месте `// DEBT(D-23)` (как `errors.ts` в stream), доложи.
8. Остальные пакеты не править. Пустые каталоги в старом `domain` удалить; неиспользуемый `#domain-legacy/*` в `packages/wish/package.json` удалить.

## Критерии приёмки
- `bun run scripts/agent-gate.ts` зелёный; число тестов модуля не уменьшилось (40).
- `bun run arch:check`: нарушений нет (импорты, граф, долг).
- В `packages/wish/src/domain/` — только `index.ts` (barrel).
- `bun run check` зелёный.

## Правила
Применимые ID из `rules.md`: ARC-02, ARC-04, ARC-05, ARC-06.

## Отчёт агента
(заполняет оркестратор из отчёта)

### Отчёт migrator (кратко)
Перенесено 4 тестовых файла (40 pass), `index/state/contract` созданы; импорты course/questionnaire/user/stream → `@u7-scl/domain/<dep>`; D-21 (core), D-22 (module.ts), D-23 (barrel). Домен не импортирует из api — реэкспорт errors не нужен. Вне брифа: путь к `pools/course.json` в `create-course-wish-uc.test.ts` (иначе tsc), удалён `#domain-legacy/*` из package.json. Линтерный долг D-24 (DOM-12, 2 места) заведён оркестратором; CODE-02 нет.
