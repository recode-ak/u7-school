# Бриф migrator: модуль `<m>`

Читай до старта: `../plan.md`, `../debt.md`, `conductor/architecture/migration.md` §1, `legacy.md`.

## Границы
- Источник: `packages/<m>/src/domain/**` (код + тесты). Куда: `packages/domain/src/<m>/`.
- Зависимости модуля по `dependsOn`: <список>. Другие модули — только через `index.ts`.
- Не трогать: `data/`, `packages/dmg-core`, логику (правятся только импорты).

## Шаги
1. `git mv` кода и тестов в `packages/domain/src/<m>/`; история сохраняется.
2. `packages/domain/src/<m>/index.ts` — публичный API; `state.ts` — схемы entity (подпуть `./state`); `contract.ts` — реэкспорт фасада, событий, ошибок (если есть).
3. В `packages/<m>/src/domain/index.ts` — только `export * from '@u7-scl/domain/<m>'` с `// DEBT(D-<n>)`.
4. Импорты `@u7-scl/app` / `@u7-scl/core` в перенесённом коде — оставить, каждый пометить `// DEBT(D-<n>)` (строка выше или в конце строки).
5. Для каждого долга: запись в `debt.md` (формат — шаблон там), ID в `scripts/domain-debt.ts`.
6. Импорты зависимостей по `dependsOn` внутри перенесённого кода: `@u7-scl/<dep>/domain` → `@u7-scl/domain/<dep>` (ARC-04), без маркера долга.
7. Алиас `#domain-legacy/*` ведёт в удалённый `src/domain`: в `packages/<m>/src/api|infra|ui` и `scripts/` заменить его на `@u7-scl/domain/<m>` (только путь импорта; опыт Ф2 `user`). Публичный `index.ts` при необходимости дополнить экспортами, нужными api/infra.
8. Остальные потребители не правятся: работают через barrel.
9. Импорты `@u7-scl/core/infra` и другие платформенные подпути в домене — тоже долг (отдельный D-<n>, если не покрыт группой).

## Критерии приёмки
- `bun run scripts/agent-gate.ts` зелёный; число тестов модуля не уменьшилось.
- `bun run arch:check`: нарушений нет (импорты, граф, долг).
- В `packages/<m>/src/domain/` — только barrel.

## Правила
Применимые ID из `rules.md`: ARC-02, ARC-04, ARC-05, ARC-06.

## Отчёт агента
(заполняет оркестратор из отчёта)
