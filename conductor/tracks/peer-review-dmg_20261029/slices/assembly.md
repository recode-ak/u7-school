# Срез `assembly` (Ф3): сборка `peer-review` и снятие legacy

Перенос без изменения поведения (strangler, роль `migrator`). Все UC и ER уже в Def-модуле (Ф1–Ф2); legacy остался пустой оболочкой.

## Состояние на старте (проверено orchestrator'ом)

- `PeerReviewModuleDef` (`domain/src/peer-review/peer-review.module.ts`): без `external`, 2 агрегата, 7 UC, ER `create-student-campaign`; тест `checkDefs` — `domain/src/peer-review/peer-review.module.test.ts`. Задача 1 плана — только сверка.
- Фабрика `createPeerReviewModule` подключена в `U7App.dmgApp` (`platform/app/src/u7-app.ts`).
- «Старые репозитории» сняты в Ф1–Ф2: `modules/peer-review/src/infra/*.json-repo.ts` — новые (UoW, TR-37), остаются.

## Границы (что меняется)

| Файл | Действие |
|---|---|
| `modules/peer-review/src/api/` (`module.ts`, `module.test.ts`, `index.ts`, `errors.ts`) | удалить |
| `domain/src/peer-review/module.ts` (`PeerReviewApiModuleResolver`, `PeerReviewApiModuleMeta`, DEBT-26) | удалить; убрать реэкспорт из `domain/src/peer-review/index.ts` |
| `modules/peer-review/src/index.ts` | убрать `export * from './api'` |
| `platform/app/src/u7-app.ts` | убрать `PeerReviewApiModule` (импорт, создание, место в `ApiApp`) — как у `wish` |
| `platform/app/src/u7-app-meta.ts` | убрать `PeerReviewApiModuleMeta` из `U7BotAppMeta` |
| `biome.json`, блок `platform/app/src/**` | ARC-07: добавить группу `@u7-scl/peer-review/**` по образцу `@u7-scl/wish/**` (TR-35, п. 5) |
| `runners/u7-bot/tests/e2e/peer-review-smoke.e2e.test.ts` | только комментарий: «PeerReviewApiModule» → Def-модуль `peer-review` |

Не трогать: `modules/peer-review/src/domain/index.ts` и прочие DEBT-27-barrel'ы, кроме `api/errors.ts` (он уходит вместе с `api/`; потребителей нет — проверить `grep`). `scripts/domain-check.ts` (DEBT-34 общий, снимается последним треком). `data/` — не трогать.

## Сохраняемое поведение

Бот и UC — без изменений: e2e бота и тесты `peer-review` зелёные, число `test:bot` ≥ 978 pass.

## Сверка сценариев удалённых тестов

`modules/peer-review/src/api/module.test.ts` — проверяет только пустую оболочку (`useCases`/`reactions`/`jobs` пусты). В отчёте перечисли его сценарии и укажи, что переносить нечего (или куда перенесено).

## Критерии приёмки

- `grep -rn "PeerReviewApiModule\|peer-review/module'\|U7ModuleResolver" domain/src/peer-review modules/peer-review platform runners --include=*.ts` — пусто по `peer-review`.
- Маркера DEBT-26 нет; `domain/src/peer-review/**` не импортирует `@u7-scl/app-legacy` и `@u7-scl/core`.
- `@u7-scl/peer-review/**` в группе ARC-07 блока `platform/app/src/**`; `bun run lint` зелёный.
- `bun run check` зелёный; `bun run test:bot` ≥ 978 pass; `git status data/` чист.

## Правила (ID)

ARC-07, MAN-06, D-45 (вход модуля — `contract`), D-53.

## Отчёт migrator (Ф3)

Удалены `modules/peer-review/src/api/` (`module.ts`, `module.test.ts`, `index.ts`, `errors.ts` — потребителей не было) и `domain/src/peer-review/module.ts`; реэкспорты сняты; `PeerReviewApiModule` убран из `U7App` и `U7BotAppMeta`; ARC-07-группа `@u7-scl/peer-review/**` в блоке `platform/app/src/**`; комментарий e2e. Удалённый `api/module.test.ts` проверял один сценарий — пустую оболочку; переносить нечего. Первый гейт красный: `platform/app/tests/u7-app.test.ts` (2 теста на legacy-оболочку, `test:bot` их не запускает) — переписаны: `getModule('peer-review')` — `undefined`, UC — через `dispatch(PeerReviewModuleDef…)`. Итог: гейт зелёный, `bun test` 3526 pass / 0 fail, `test:bot` 996 pass.

## Отчёт reviewer (Ф3)

`error` нет. warning: `debt.md`, DEBT-27 ссылался на удалённый `api/errors.ts` — исправлено orchestrator'ом. info: «DEBT-34 в части `peer-review`» срез не трогает — orchestrator проверил grep: `peer-review` импортирует чужие модули только через `contract`, его `index` извне не импортируют; `peer-review` убран из описания DEBT-34 (маркер общий, снимается последним треком).
