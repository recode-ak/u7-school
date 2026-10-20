# Бриф migrator: модуль `dossier`

Читай до старта: `../plan.md`, `../debt.md` (D-30 уже заведён и внесён в allowlist), `conductor/architecture/migration.md` §1, `legacy.md`, `slices/peer-review.md` (образец).

## Границы
- Источник: `packages/dossier/src/{categories,scores}.ts` + `categories.test.ts`, `scores.test.ts` (до переноса `bun test packages/dossier` = 14 pass). Куда: `packages/domain/src/dossier/`.
- `dependsOn`: `[]`. Внешняя зависимость — только `valibot`; добавь `"valibot": "^1.0.0"` в `dependencies` `packages/domain/package.json` и выполни `bun install`.
- Не трогать: `data/`, `packages/dmg-core`, логику.

## Шаги
1. `git mv` двух файлов и двух тестов в `packages/domain/src/dossier/` (относительные импорты `./categories` сохраняются).
2. `index.ts` — публичный API: `export * from './categories'; export * from './scores'`. `state.ts` — схемы и типы (`SkillScoreSchema` и типы, выведенные из схем; категории/подкатегории как константы); `contract.ts` — только если есть контракт (ошибок/фасада нет — создай пустой реэкспорт с комментарием, как в модулях без ошибок, либо не создавай и сообщи).
3. `packages/dossier/src/index.ts` — только `export * from '@u7-scl/domain/dossier'` с `// DEBT(D-30)`.
4. Линтерные нарушения (DOM-12, CODE-02): `biome-ignore lint/plugin: … (долг не заведён)` — долг сам не заводи.
5. Комментарий в `packages/domain/src/peer-review/peer-review-question-pool.ts`, ссылающийся на `@u7-scl/dossier`, и правила `biome.json` — не править, сообщить в отчёте, если пути/ссылки устарели.

## Критерии приёмки
- `bun run scripts/agent-gate.ts` зелёный; тестов dossier — 14.
- `bun run arch:check`: нарушений нет.
- В `packages/dossier/src/` — только `index.ts` (barrel).

## Правила
Применимые ID: ARC-02, ARC-04, ARC-05, ARC-06.

## Отчёт агента
(заполняет оркестратор из отчёта)

### Отчёт migrator (кратко)
Перенесено 4 файла (rename 100%), 14 pass; `index.ts`, `state.ts` (реэкспорт — схемы лежат в `categories.ts`/`scores.ts`, без правок логики), `contract.ts` не нужен (нет контракта/ошибок). Barrel `packages/dossier/src/index.ts` — `DEBT(D-30)`. В `packages/domain/package.json` добавлен `valibot`. Линтерных долгов нет.

### Отчёт reviewer (кратко)
Нарушений ARC-02/04/05/06 нет. Вопрос по `state.ts` — подтверждено: реэкспорт намеренно. Замечание о `biome.json` (правила `packages/dossier/**`) — актуально до удаления пакета, снимается вместе с D-30.
