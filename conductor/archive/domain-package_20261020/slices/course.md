# Бриф migrator: модуль `course`

Читай до старта: `../plan.md`, `../debt.md` (D-6…D-8 уже заведены оркестратором и внесены в allowlist — тебе только расставить маркеры), `conductor/architecture/migration.md` §1, `legacy.md`, `slices/user.md` (образец переноса).

## Границы
- Источник: `packages/course/src/domain/**` (код + 18 тестов; до переноса `bun test packages/course/src/domain` = 221 pass). Куда: `packages/domain/src/course/` (сохранить внутреннюю структуру: `facade.ts`, `module.ts`, `index.ts`, `status.ts`, `types.ts`, каталоги `course/`, `lesson/`, `module/`, `step/`, `content-path/` и файлы `content-*`, `course-ds*`).
- `dependsOn` модуля: `user`. Другие модули домена не импортировать.
- Не трогать: `data/`, `packages/dmg-core`, логику (правятся только импорты).

## Шаги
1. `git mv` кода и тестов в `packages/domain/src/course/`; алиасы `#domain-legacy/status` и `#domain-legacy/module/entity` в перенесённом коде заменить относительными путями.
2. `index.ts` — публичный API (как был `packages/course/src/domain/index.ts`); `state.ts` — схемы entity (Course/Phase/Module/Project/Lesson/Step*, `StatusSchema`/`Status`, типы `*ArMeta`, id-типы) ; `contract.ts` — реэкспорт фасада (`CourseFacade`, `CourseProgram`, `ModulePlace`), ошибок (`*UcError`, `*ModuleError`). Подпуть `contract` и зависимости пакета `domain` уже настроены.
3. В `packages/course/src/domain/index.ts` — только `export * from '@u7-scl/domain/course'` с `// DEBT(D-8)`.
4. Импорты `@u7-scl/user/domain` (28) → `@u7-scl/domain/user` (ARC-04), без маркера долга.
5. Маркеры: все импорты `@u7-scl/core/*` в `packages/domain/src/course/**` — `// DEBT(D-6)`; импорт `@u7-scl/app/domain` в `module.ts` — `// DEBT(D-7)`. Найдётся ещё импорт app/core вне перечисленных — эскалация.
6. Потребители внутри пакета (`packages/course/src/api|infra`, `scripts/`), использующие алиас `#domain-legacy/*` (он теперь указывает на удалённый каталог): заменить путь импорта на `@u7-scl/domain/course` (только путь; при необходимости дополнить `index.ts` экспортами, нужными api/infra). `packages/course/package.json` — убрать зависимость на `@u7-scl/user` только если больше не используется (иначе не трогать).
7. Остальные пакеты не править.

## Критерии приёмки
- `bun run scripts/agent-gate.ts` зелёный; число тестов модуля не уменьшилось (221).
- `bun run arch:check`: нарушений нет (импорты, граф, долг).
- В `packages/course/src/domain/` — только `index.ts` (barrel).
- `bun run check` зелёный.

## Правила
Применимые ID из `rules.md`: ARC-02, ARC-04, ARC-05, ARC-06.

## Отчёт агента
(заполняет оркестратор из отчёта)

### Отчёт migrator (кратко)
Перенесено 18 тестовых файлов (221 pass); 28 импортов user → `@u7-scl/domain/user`; D-6 ×16, D-7 ×2; 52 потребителя api/infra и `scripts/_app-factory.ts` переведены на `@u7-scl/domain/course`. Вне брифа: `biome.json` — `!@u7-scl/domain/**` в обоих блоках `packages/domain/**` (иначе ARC-02 блокирует `domain/user` из `course`; граф проверяет `arch:check`). Новый долг D-9 (DOM-12) и D-10 (CODE-02) заведён оркестратором.

### Отчёт reviewer
Блокеров и major нет. minor: правка `biome.json` широкая, но страхуется `arch:check` (`PUBLIC_SUBPATHS`) — принято. Вопрос: дублирование экспортов `state.ts`/`contract.ts` и `index.ts` — намеренно до перевода на Def (так же в user).
