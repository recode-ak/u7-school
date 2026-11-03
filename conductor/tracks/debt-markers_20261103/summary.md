# Summary: debt-markers_20261103 (черновик)

## Базовая линия (Фаза 0, 2026-11-03, `d539a307`)

`bun run check` — зелёный; `bun test` — **3533 pass / 0 fail** (366 файлов); `arch:check` — 0 нарушений.

Замер по корням `arch:check` (`readPackageSources`: `{platform,modules,authoring,runners}/*/src`, `domain/src`, `scripts` без `scripts/**/*.test.ts`), `rg --type ts`:

| Что | Строк | Файлов |
|---|---|---|
| `DEBT-N` всего | 139 | 80 |
| — в `biome-ignore` | 45 | — |
| — вне `biome-ignore` | 94 | 75 |
| — из них голые `// DEBT-N` (строка — только маркер) | 71 | 56 |
| `TR-NN` | 67 | 40 |
| `TR-NN` в `runners/*/tests` (вне корней) | 1 | 1 |
| «временн… / уход(ит/ят) с миграц / до миграции / после перехода» | 73 | 53 |

Открытых записей DEBT в `debt.md` — 30.

Вне `biome-ignore` и не голые (23 строки): хвостовые у импортов в `errors.ts` (DEBT-1/11/16), шапки тестов DEBT-40 (8), DEBT-35 в имени теста и комментарии, DEBT-34 в текстах ошибок и комментарии `domain-check.ts` (3), DEBT-32 (2), DEBT-41, DEBT-42 (2, в т. ч. JSDoc `call-uc.ts`), DEBT-43 (2, в т. ч. JSDoc `review-render.ts`).

Расхождение с оценкой плана (86 голых в 70 файлах): план считал все упоминания вне `biome-ignore` иным способом; точкой отсчёта считать таблицу выше.
