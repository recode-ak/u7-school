# Бриф migrator: модуль `user` (+ `User` из `app`)

Читай до старта: `../plan.md`, `../debt.md` (D-1…D-4 уже заведены оркестратором и внесены в allowlist — тебе только расставить маркеры), `conductor/architecture/migration.md` §1, `legacy.md`.

## Границы
- Источник: `packages/user/src/domain/**` (21 файл + 2 теста: `user/a-root.test.ts`, `user/policy.test.ts`). Куда: `packages/domain/src/user/` (сохранить внутреннюю структуру: `facade.ts`, `module.ts`, `index.ts` и каталог `user/`).
- `dependsOn` модуля: нет. Другие модули домена не импортировать.
- Не трогать: `data/`, `packages/dmg-core`, логику (правятся только импорты и места определения `User`).
- Потребителей (≈96 файлов `@u7-scl/user/domain`, `@u7-scl/app/domain`) не править.

## Шаги
1. `git mv` кода и тестов в `packages/domain/src/user/`; алиасы `#domain-legacy/user/…` заменить относительными путями (11 мест `#domain-legacy/user/entity`, 1 — `roles`).
2. Перенос `User` из `app`: определения `Role`, `RoleSchema`, `UserSchema`, `User`, `UserArMeta` из `packages/app/src/domain/user.ts` переезжают в `packages/domain/src/user/user/{roles,entity}.ts` (сейчас это реэкспорты из app — заменить определениями без изменения текста схем). В `packages/app/src/domain/user.ts` остаётся только реэкспорт из `@u7-scl/domain/user` с `// DEBT(D-4)`.
3. `packages/domain/src/user/state.ts` — схемы entity (`UserSchema`, `RoleSchema`, `Role`, типы `User`, `UserArMeta`); `contract.ts` — реэкспорт фасада (`UserFacade`), событий (`UserNotifiedEvent`), ошибок (`UserModuleError` и остальные из `commands/errors`). `index.ts` — публичный API (как был `packages/user/src/domain/index.ts`).
4. Подпуть `contract`: добавить `"./*/contract": "./src/*/contract.ts"` в `exports` `packages/domain/package.json` (перед `"./*"`) и `"@u7-scl/domain/*/contract"` в `paths` корневого `tsconfig.json` (перед `"@u7-scl/domain/*"`). В `dependencies` пакета `domain` добавить `@u7-scl/core` и `@u7-scl/app` (`workspace:*`), выполнить `bun install`.
5. В `packages/user/src/domain/index.ts` — только `export * from '@u7-scl/domain/user'` с `// DEBT(D-3)`.
6. Маркеры: все импорты `@u7-scl/core` в `packages/domain/src/user/**` — `// DEBT(D-1)`; импорт `@u7-scl/app/domain` в `module.ts` — `// DEBT(D-2)`. Если после переноса найдётся ещё импорт app/core вне перечисленных — эскалация (нужен новый D-<n>).
7. Остальные пакеты не править.

## Критерии приёмки
- `bun run scripts/agent-gate.ts` зелёный; число тестов модуля не уменьшилось (до: прогнать `bun test packages/user/src/domain` перед переносом).
- `bun run arch:check`: нарушений нет (импорты, граф, долг).
- В `packages/user/src/domain/` — только `index.ts` (barrel). В `packages/app/src/domain/user.ts` — только реэкспорт.
- `bun run check` зелёный.

## Правила
Применимые ID из `rules.md`: ARC-02, ARC-04, ARC-05, ARC-06.

## Отчёт агента
(заполняет оркестратор из отчёта)
