# Бриф migrator: модуль `stream`

Читай до старта: `../plan.md`, `../debt.md` (D-16…D-18 уже заведены оркестратором и внесены в allowlist — тебе только расставить маркеры), `conductor/architecture/migration.md` §1, `legacy.md`, `slices/course.md` (образец переноса).

## Границы
- Источник: `packages/stream/src/domain/**` (код + 10 тестовых файлов; до переноса `bun test packages/stream/src/domain` = 220 pass). Куда: `packages/domain/src/stream/` (сохранить структуру: `facade.ts`, `module.ts`, `index.ts`, `status.ts`, `types.ts`, `stream-ds*`, каталоги `stream/`, `student/` и остальные файлы).
- `dependsOn` модуля: `user`, `course`. Другие модули домена не импортировать.
- Не трогать: `data/`, `packages/dmg-core`, логику (правятся только импорты).

## Шаги
1. `git mv` кода и тестов в `packages/domain/src/stream/`; алиасы `#domain-legacy/status` и `#domain-legacy/stream/policy` заменить относительными путями.
2. `index.ts` — публичный API (как был `packages/stream/src/domain/index.ts`, включая реэкспорт `ContentSnapshot`/`ContentSnapshotSchema` — теперь из `@u7-scl/domain/course`); `state.ts` — схемы entity (Stream/Student, `StreamStatus*`, типы `*ArMeta`, id-типы); `contract.ts` — реэкспорт фасада (`StreamFacade`, `StreamMember`, `StreamMembers`) и ошибок (`*UcError`). Образец — `domain/course` и `domain/questionnaire`.
3. В `packages/stream/src/domain/index.ts` — только `export * from '@u7-scl/domain/stream'` с `// DEBT(D-18)`.
4. Импорты `@u7-scl/course/domain` → `@u7-scl/domain/course`, `@u7-scl/user/domain` → `@u7-scl/domain/user` (ARC-04), без маркера. `User` из `@u7-scl/app/domain` (facade.ts) → `@u7-scl/domain/user`, без маркера.
5. Маркеры: все импорты `@u7-scl/core/*` (включая `core/api`) в `packages/domain/src/stream/**` — `// DEBT(D-16)`; импорты `@u7-scl/app/domain` в `module.ts` и `stream/stream/a-root.ts` — `// DEBT(D-17)`. Многострочный импорт — маркер комментарием в конце строки `from`. Найдётся ещё импорт app/core вне перечисленных — эскалация.
6. Линтерные нарушения при переносе (DOM-12 `v.isoDateTime`, CODE-02 `#private`): `biome-ignore lint/plugin: … (долг не заведён)` — не заводи долг сам, оркестратор заменит.
7. Потребители внутри пакета (`packages/stream/src/api|infra`, остальные пакеты `packages/*/src/api|infra|ui`, `apps/`, `scripts/`), использующие `#domain-legacy/*` (указывает на удалённый каталог) или `@u7-scl/stream/domain` — только алиас `#domain-legacy/*` заменить на `@u7-scl/domain/stream`; импорты `@u7-scl/stream/domain` у внешних потребителей не трогать (их закрывает barrel D-18), кроме файлов самого `packages/stream`.
8. Остальные пакеты не править. Пустые каталоги в старом `domain` удалить.

## Критерии приёмки
- `bun run scripts/agent-gate.ts` зелёный; число тестов модуля не уменьшилось (220).
- `bun run arch:check`: нарушений нет (импорты, граф, долг).
- В `packages/stream/src/domain/` — только `index.ts` (barrel).
- `bun run check` зелёный.

## Правила
Применимые ID из `rules.md`: ARC-02, ARC-04, ARC-05, ARC-06.

## Отчёт агента
(заполняет оркестратор из отчёта)

### Отчёт migrator (кратко)
Перенесено 10 тестовых файлов (220 pass), `index/state/contract` созданы; импорты course/user/`User` → `@u7-scl/domain/<dep>`; D-16 (core, вкл. `core/api`), D-17 (module.ts, stream/a-root.ts), D-18 (barrel). Вне брифа: (1) `packages/stream/src/api/errors.ts` → `domain/stream/errors.ts` (домен импортировал ошибки из api «вверх»), в api остался реэкспорт с `DEBT(D-18)`, ошибки в `contract.ts`; (2) в `index.ts` добавлены экспорты 15 `*-cmd.ts` (как у course); (3) `scripts/{stream-snapshot-sync(.test),update-stream-snapshot}.ts` переведены на `@u7-scl/domain/stream`; (4) в `packages/stream/package.json` остался неиспользуемый `#domain-legacy/*`. Линтерные долги заведены оркестратором: D-19 (DOM-12, 9 мест), D-20 (CODE-02, 2 метода).
