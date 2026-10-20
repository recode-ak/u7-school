# Бриф migrator: модуль `questionnaire`

Читай до старта: `../plan.md`, `../debt.md` (D-11…D-13 уже заведены оркестратором и внесены в allowlist — тебе только расставить маркеры), `conductor/architecture/migration.md` §1, `legacy.md`, `slices/course.md` (образец переноса).

## Границы
- Источник: `packages/questionnaire/src/domain/**` (код + 8 тестов; до переноса `bun test packages/questionnaire/src/domain` = 86 pass, 8 файлов). Куда: `packages/domain/src/questionnaire/` (сохранить внутреннюю структуру: `facade.ts`, `module.ts`, `index.ts`, каталог `questionnaire/`).
- `dependsOn` модуля: `user`. Другие модули домена не импортировать.
- Не трогать: `data/`, `packages/dmg-core`, логику (правятся только импорты).

## Шаги
1. `git mv` кода и тестов в `packages/domain/src/questionnaire/`; алиасы `#domain-legacy/*` в перенесённом коде (если есть) заменить относительными путями.
2. `index.ts` — публичный API (как был в старом barrel, плюс то, что нужно api/infra); `state.ts` — схемы entity и `*ArMeta`; `contract.ts` — реэкспорт фасада, событий, ошибок.
3. В `packages/questionnaire/src/domain/index.ts` — только `export * from '@u7-scl/domain/questionnaire'` с `// DEBT(D-13)`.
4. Импорты `@u7-scl/user/domain` → `@u7-scl/domain/user` (ARC-04), без маркера долга. `User` из `@u7-scl/app/domain` (facade.ts) → `@u7-scl/domain/user` без долга.
5. Маркеры: импорты `@u7-scl/core/*` — `// DEBT(D-11)`; `@u7-scl/app/domain` (`U7ModuleResolver` в `module.ts`) — `// DEBT(D-12)` (+ `biome-ignore` как в `course/module.ts`). Новые нарушения линтера (DOM-12 `v.isoDateTime`, CODE-02 и т.п.) — точечный `biome-ignore lint/plugin: … (долг не заведён)`, оркестратор заведёт D-<n>. Другие импорты app/core — эскалация.
6. Потребители внутри пакета (`api`/`infra`/`ui`, `scripts/`) с алиасом `#domain-legacy/*`: заменить путь на `@u7-scl/domain/questionnaire`. `package.json` пакета не трогать.
7. Остальные пакеты не править.

## Критерии приёмки
- `bun run scripts/agent-gate.ts` зелёный; число тестов модуля не уменьшилось (86).
- `bun run arch:check`: нарушений нет (импорты, граф, долг).
- В `packages/questionnaire/src/domain/` — только `index.ts` (barrel).
- `bun run check` зелёный.

## Правила
Применимые ID из `rules.md`: ARC-02, ARC-04, ARC-05, ARC-06.

## Отчёт агента
Перенесено 8 тестов (86 pass); D-11 на всех `core/*`, D-12 в `module.ts`, D-13 в barrel; `User` из app в `facade.ts` → `@u7-scl/domain/user`; 22 потребителя api/infra переведены на `@u7-scl/domain/questionnaire`. Вне брифа заведены оркестратором: D-14 (DOM-12, 7 мест), D-15 (CODE-02, 11 мест).

### Отчёт reviewer
Блокеров и major нет. minor: пустые каталоги в старом `domain` удалены; формулировка D-15 уточнена (10 методов и поле `#engine`).
