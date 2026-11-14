# Итоги: revision-release_20261112

## Базовая линия (Ф0, 2026-11-12)

От `d7148f0f`, рабочее дерево — только правки статуса трека.

| Команда | Гейт закрытия `legacy-removal` | База Ф0 | Разница |
|---|---|---|---|
| `CI=true bun test` | 2899 pass, 0 fail, 297 файлов | **2899 pass**, 0 fail, 297 файлов | 0 |
| `bun run test:bot` | 924 pass | **924 pass**, 0 fail, 95 файлов | 0 |
| `bun run check` | зелёный | **зелёный** | — |

Числа 3083 / 921 в плане — база Ф0 трека `legacy-removal`; его итог (2899 / 924) объяснён в `conductor/archive/legacy-removal_20261112/summary.md` («Гейт закрытия»). Сверка ведётся с итогом.

Находка при первом прогоне: 1 fail — страж `scripts/repo-layout.test.ts` (ссылки на старые каталоги в `spec.md:25` и `plan.md:117` этого трека, коммиты `8a47a2ee`/`d7148f0f`). Исправлено переформулировкой, после — 0 fail.

## Worktree `v0.2.6` (Ф0)

`../u7-school-v0.2.6` — detached HEAD `dffa561b` (тег `v0.2.6`). Был изменён `bun.lock` (+5 строк `@u7-scl/app: workspace:*` у course, peer-review, questionnaire, stream, wish) — след `bun install`: в релизе lock отставал от `package.json`. Откачен (`git checkout -- bun.lock`, с разрешения Нурболата): worktree — точная копия тега, не запускается. Дерево чистое.

## DeepSeek по фазам (deepseek.md §5)

- **Ф5.6** (2026-11-14): `migrator` flash, одна сессия, 58 ходов, $0.07, hit 98%, доработок по гейту 0. Ревью Opus: принять; на приёмке — переименование `currentOf` → `latest` (путалось с `WishAr.current`) и ссылка `TR-7` в комментарии теста.
- **Ловушка гейта:** `scripts/agent-gate.ts` гоняет `check` пакетов, но не корневой `arch:check` — ссылку на TR в коде он пропускает, ловит только полный `bun run check`. Перед коммитом шага flash — полный `check`.
