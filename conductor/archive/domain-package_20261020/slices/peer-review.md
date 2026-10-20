# Бриф migrator: модуль `peer-review`

Читай до старта: `../plan.md`, `../debt.md` (D-25…D-27 уже заведены оркестратором и внесены в allowlist — тебе только расставить маркеры), `conductor/architecture/migration.md` §1, `legacy.md`, `slices/stream.md` и `slices/wish.md` (образцы переноса).

## Границы
- Источник: `packages/peer-review/src/domain/**` (код + 8 тестовых файлов; до переноса `bun test packages/peer-review/src/domain` = 99 pass). Куда: `packages/domain/src/peer-review/` (сохранить структуру: `module.ts`, `index.ts`, `peer-review-question-pool*`, каталоги `review/`, `review-campaign/`).
- `dependsOn` модуля: `user`, `questionnaire`, `stream`. Другие модули домена не импортировать.
- Не трогать: `data/`, `packages/dmg-core`, логику (правятся только импорты).

## Шаги
1. `git mv` кода и тестов в `packages/domain/src/peer-review/`; алиасы `#domain-legacy/*` (если есть) заменить относительными путями.
2. `index.ts` — публичный API (как был, плюс экспорты, нужные потребителям api/infra); `state.ts` — схемы entity (Review, ReviewCampaign, `*ArMeta`); `contract.ts` — реэкспорт ошибок (`*UcError`, `PeerReviewUcErrors`). Образец — `domain/stream`, `domain/wish`.
3. Домен импортирует `PeerReviewUcErrors` из `../../../api/errors` (направление вверх). Перенеси `packages/peer-review/src/api/errors.ts` в `packages/domain/src/peer-review/errors.ts` (маркер D-25 на core-импортах), в старом месте оставь `// DEBT(D-27)` + `export * from '@u7-scl/domain/peer-review/contract'`; относительные импорты в домене перепиши (как в stream). Если `api/errors.ts` содержит что-то, что нельзя вынести — эскалация.
4. В `packages/peer-review/src/domain/index.ts` — только `export * from '@u7-scl/domain/peer-review'` с `// DEBT(D-27)`.
5. Импорты `@u7-scl/{user,stream}/domain` → `@u7-scl/domain/<dep>` (ARC-04), без маркера.
6. Маркеры: все импорты `@u7-scl/core/*` (включая `core/api`) в `packages/domain/src/peer-review/**` — `// DEBT(D-25)`; `@u7-scl/app/domain` в `module.ts` — `// DEBT(D-26)` (рядом `biome-ignore lint/style/noRestrictedImports`, как в `stream/module.ts`). Многострочный импорт — маркер комментарием в конце строки `from`. Иной app/core вне перечисленных — эскалация.
7. Линтерные нарушения (DOM-12, CODE-02): `biome-ignore lint/plugin: … (долг не заведён)` — долг сам не заводи, оркестратор заменит.
8. Потребители в `packages/peer-review` (api/infra/ui) и `scripts/`, использующие `#domain-legacy/*` или глубокие пути в старый `domain` — заменить на `@u7-scl/domain/peer-review`. Импорты `@u7-scl/peer-review/domain` у других пакетов не трогать (закрывает barrel D-27). Остальные пакеты не править; пустые каталоги в старом `domain` удалить; `#domain-legacy/*` из `packages/peer-review/package.json` удалить.

## Критерии приёмки
- `bun run scripts/agent-gate.ts` зелёный; число тестов модуля не уменьшилось (99).
- `bun run arch:check`: нарушений нет.
- В `packages/peer-review/src/domain/` — только `index.ts` (barrel).
- `bun run check` зелёный.

## Правила
Применимые ID из `rules.md`: ARC-02, ARC-04, ARC-05, ARC-06.

## Отчёт агента
(заполняет оркестратор из отчёта)

### Отчёт migrator (кратко)
Перенесено 8 тестовых файлов (99 pass), `index/state/contract` созданы; `api/errors.ts` → `domain/peer-review/errors.ts` (в api реэкспорт `DEBT(D-27)`); D-25 (core вкл. `core/api` и 2 теста с `AppException`), D-26 (module.ts), D-27 (barrel + api/errors). В `index.ts` добавлены экспорты `*-cmd` и `events` (подбарреллы их не отдавали). Линтерные долги заведены оркестратором: D-28 (DOM-12, `shared/schema.ts`), D-29 (CODE-02, `#validateText`).
