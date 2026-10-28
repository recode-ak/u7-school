# Summary: dmg-cleanup_20261028

## Итог

- **ФР-1.** Параллельная разработка платформы оформлена: `AGENTS.md`, `agents.md`, `index.md` §«Правка платформы».
- **ФР-2.** `MemoryRepo<A>` в `dmg-core/testing`; тесты UC/ER/Job примера и шаблон `gen` — на фейке; пирамида в `testing.md` §4 и гайдах; D-55, TST-07. Тесты u7-school — DEBT-40 (по мере касания).
- **ФР-3.** Отсев повторов command UC в `dispatch` пакета: порт `ReplayStore`, `REQUEST_CONFLICT`, серверный `requestId` без отсева; D-56; DEBT-1 пакета снят.
- **ФР-4.** Бот: `requestId = tg:<update_id>#<n>`, `correlationId = tg:<update_id>`; файловый `ReplayStore` в `data/replay/` (TTL, вне бэкапа); e2e повтора апдейта; DEBT-38 снят, заведён DEBT-41 (неявный контекст апдейта).
- **ФР-5.** `ucErrorNotify` показывает ошибку DMG по `kind` без `toLegacyError`; мост удалён; DEBT-37 снят.

## Базовая линия (2026-10-28)

| Где | Команда | Результат |
|---|---|---|
| u7-school (`adaf7d58`) | `bun run check` | зелёный; `bun test` — 3273 pass, 0 fail (340 файлов) |
| dmg-core (`b001e0e`) | `bun run check` | зелёный; `bun test` — 1246 pass, 0 fail (128 файлов) |
| dmg-core (`b001e0e`) | `bun run e2e` | `e2e: ok` |

## Гейт качества (2026-10-29)

| Где | Команда | Результат |
|---|---|---|
| u7-school (`cb4d1001`) | `bun run check` | зелёный; `CI=true bun test` — 3304 pass, 0 fail (342 файла) |
| dmg-core (`c949ba0`) | `bun run check` | зелёный; `bun test` — 1316 pass, 0 fail (130 файлов) |
| dmg-core (`c949ba0`) | `bun run e2e` | `e2e: ok` |

- Красных тестов нет: промежуточных состояний и регрессов нет.
- Удалённые тестовые файлы: в u7-school — `legacy-bridge/legacy-error.test.ts` (мост удалён вместе с кодом); сценарии показа — `label` из Def, `denyMessage` отказа Policy, `unauthorized` без утечки — покрыты тестами `ucErrorNotify` в `bot-ui-story.test.ts`. Отображение `kind` и `level` на legacy ушло вместе с мостом. В dmg-core удалённых тестовых файлов нет; тесты UC/ER/Job примера переписаны на фейк со сверкой сценариев 1:1 (Фаза 2).
- Маркеров DEBT-1 (пакет), DEBT-37, DEBT-38 в коде нет.
