# Правила в проекте

**Назначение:** как каталог правил платформы применяется в u7-school. Сам каталог с ID (ARC, DOM, MAN, ERR, API, CODE, TST) — в пакете: [rules.md](../../node_modules/dmg-core/docs/reference/rules.md). Своих ID у проекта нет; правило меняется через решение D-NN ([decisions.md](./decisions.md) проекта или пакета).

---

## Где проверяется

- **lint** — `biome.json` корня (`overrides`; у пакета — свой `biome.json` в его репо), плагины — `node_modules/dmg-core/biome-plugins/*.grit` (правила DMG принадлежат пакету; корень подключает их из установленного пакета); тест правил проекта — `scripts/lint-rules.test.ts` на фикстурах `lint-fixtures/`, правил на коде пакета — `scripts/lint-rules.test.ts` на `lint-fixtures/` в репо пакета.
- **test** — `bun run arch:check` (`scripts/arch-check.ts`, `ArchApp` проекта) и контрактные тесты; всё входит в `bun run check`.
- **review** — роль `dmg-reviewer` (`node_modules/dmg-core/agents/roles/dmg-reviewer.md` + общий блок проекта).

## Что блокирует, что нет

Блокируют проверки всего кода проекта: домен, модули, корень сборки, раннеры; код пакета проверяется в его репо. Lint ARC-06 — ранний `warn`, `arch:check` по ARC-06/07/08 — `error`. В UI (stories, рендереры) DOM-01 проверяется review: stories и экраны принимают решения только через доменный API, поля state/`view()` — только для рендеринга (D-72, DOM-18 — review).

## Привязка правил к пакетам проекта

| ID | В проекте |
|---|---|
| ARC-01 | платформа — `dmg-core` и `@u7-scl/core` (только `ui` и `shared`, кандидат на удаление при `dmg-ui`) |
| ARC-02 | домен — `@u7-scl/domain` (`domain`); импорт `@u7-scl/core` — только в Месте открытой записи долга ([code.md](../debt/code.md), поля Место/Признак/Корень), без маркера в коде |
| ARC-04 | контракт модуля — `@u7-scl/domain/<m>/contract` (публичны только `contract` и `testing`) |
| ARC-06 | прикладной пакет модуля — `modules/<m>`; чужие пакеты — lint `warn` по модулю; корень сборки и раннеры — `arch:check` для всех пакетов (`checkModuleImports`, D-53) |
| ARC-07 | приложение (корень сборки) — `@u7-scl/app` (`platform/app/src`, `DomainArch.root`): домен — только `contract`, прикладной пакет модуля — только вход (`index`). Lint дублирует для раннего сигнала: маска прикладных пакетов в `biome.json` пополняется с новым модулем |
| ARC-08 | входные адаптеры — `runners/*` (`src`, `DomainArch.runners` — все каталоги `runners/*`), вызов операций — через приложение; тесты вне `src` не проверяются |
| ARC-09 | окружение читает только `runners/*/src/main.ts` (lint на `domain`, `platform/*/src`, `modules/*/src`, `runners/*/src`); `authoring/*` и `scripts/` — отдельные утилиты, вне правила; данные школы — через резолвер (`resolve.school`) |
| ARC-10 | код приложения — `@u7-scl/*` (отсекает белый список импортов в `biome.json` пакета) |
| TST-06 | `bun run check` и `bun run arch:check` |

Тестирование бота — [ui/bot-test.md](./ui/bot-test.md).
