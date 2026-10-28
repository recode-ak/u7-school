# Правила в проекте

**Назначение:** как каталог правил платформы применяется в u7-school. Сам каталог с ID (ARC, DOM, MAN, ERR, API, CODE, TST) — в пакете: [rules.md](../../node_modules/dmg-core/docs/rules.md). Своих ID у проекта нет; правило меняется через решение D-NN ([decisions.md](./decisions.md) проекта или пакета).

---

## Где проверяется

- **lint** — `biome.json` корня (`overrides`; у пакета — свой `biome.json` в его репо), плагины — `node_modules/dmg-core/biome-plugins/*.grit` (правила DMG принадлежат пакету; корень подключает их из установленного пакета); тест правил проекта — `scripts/lint-rules.test.ts` на фикстурах `lint-fixtures/`, правил на коде пакета — `scripts/lint-rules.test.ts` на `lint-fixtures/` в репо пакета.
- **test** — `bun run arch:check` (`scripts/arch-check.ts`, `ArchApp` проекта) и контрактные тесты; всё входит в `bun run check`.
- **review** — роль `reviewer` (`node_modules/dmg-core/agents/roles/reviewer.md` + общий блок проекта).

## Что блокирует, что нет

Блокируют только новые пути (`domain/**`; код пакета проверяется в его репо). На legacy действуют ARC-01 и ARC-07, а ARC-06 и ARC-08 — `warn` ([legacy.md](./legacy.md)). DOM-01 не охватывает рендереры UI и stories (до миграции UI).

## Привязка правил к пакетам проекта

| ID | В проекте |
|---|---|
| ARC-01 | платформа — `dmg-core` и legacy `@u7-scl/core` |
| ARC-02 | домен — `@u7-scl/domain` (`domain`); импорт `@u7-scl/core` — только по долгу ([debt.md](./debt.md)) |
| ARC-04 | контракт модуля — `@u7-scl/domain/<m>/contract`; пары legacy-модулей — по долгу до миграции |
| ARC-06 | прикладной пакет модуля — `modules/<m>` |
| ARC-07 | приложение — `@u7-scl/app` |
| ARC-08 | входные адаптеры — `runners/*`, вызов операций — через `appApi` |
| ARC-09 | данные школы — через резолвер (`resolve.school`) |
| ARC-10 | код приложения — `@u7-scl/*` и `#*-legacy/*` (отсекает белый список импортов в `biome.json` пакета); мосты — `platform/core/src/legacy-bridge` |
| TST-06 | `bun run check` и `bun run arch:check` |

Тестирование бота — [ui/bot-test.md](./ui/bot-test.md).
