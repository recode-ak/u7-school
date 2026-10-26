# Plan: dmg-core-extract_20261020

Каждая задача — TDD, `bun run check` зелёный после каждой. Предшествует трек core-dmg (завершён).

**Порядок относительно других треков ([migration.md](../../architecture/migration.md) §2):**
- Фазы 1–3 — сразу, **до** `generators` и `golden-wish`: после них пути и import-спецификатор платформы (`dmg-core`) уже финальные, шаблоны генераторов и эталонный модуль пишутся без переименования.
- Фазы 4–6 — **после** `golden-wish`: контракты модуля (`domain/<m>/contract`) требуют `domain-package`, outbox и идемпотентность реакций проверяются на реальном модуле, документация пакета (Фаза 5) включает гайды, написанные по эталону.
- Мосты к legacy (Фаза 1) должны остаться рабочими для `golden-wish`: `wish` до миграции живёт на legacy-шине и legacy-`Job`.

## Фаза 1: Развязка от legacy [checkpoint: 26891c7]

Заметки для старта (на 2026-10-20, `packages/core/src/dmg`):
- Импорты legacy внутри `dmg` (не тесты): `app/context.ts` (`#domain-legacy/types`, `#shared-legacy/logger`), `app/errors/legacy-error.ts`, `app/events/legacy-event-bus.ts`, `app/job/legacy-job.ts`, `app/module/module-from-def.ts` (`#api-legacy/job/job`), `app/system/run-logged.ts` и `app/use-case/use-case-from-def.ts` (`#shared-legacy/serialize-error`), `kernel/time/now.ts` (`#shared-legacy/now`), `testing/app-context.ts`.
- `now()` читает legacy `shared/now`, чтобы `spyOn(Shared, 'now')` тоже действовал — при переносе сохранить это поведение в мосту.
- `ApiApp.run/execute/addDmgModules` живут в `packages/core/src/api/app/api-app.ts` (legacy-слой) и остаются в монорепо.
- Блокирующие lint-правила на `dmg` уже есть (ARC-01/02, GritQL); правило «без `*-legacy`» добавляется рядом в `biome.json` (`overrides`), проверяется `scripts/lint-rules.test.ts` на фикстуре-нарушителе в `lint-fixtures/`.
- Три теста с импортами `../../../infra/…` из legacy исчезнут в этой фазе.

- [x] Task: Перенести мосты (`legacy-event-bus`, `legacy-error`, `legacy-job`, `run-logged`, `context`, часть `use-case-from-def`, `now`) в `packages/core/src/legacy-bridge/`, внутрь `dmg` оставить порты
    - [x] Тесты моста сохраняются; `dmg` получает логгер/режим/время через порты
- [x] Task: Правило и проверка: `dmg` не импортирует `*-legacy` и `@u7-scl/*` (biome `noRestrictedImports` + тест `arch:check`)
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: Выделение пакета `dmg-core` [checkpoint: 1fa0d8b]

- [x] Task: Создать `packages/dmg-core` (перенос `dmg/**` в `src/`), алиас `#core/*`, `core/dmg` временно реэкспортирует
- [x] Task: Перевести потребителей на `dmg-core`; убрать `paths` на `@u7-scl/core/dmg*` из корневого `tsconfig`
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Самодостаточность [checkpoint: f4cbb89]

> **Последняя фаза части А.** После её контрольной точки трек ставится на паузу (см. ниже Фазу 4).

- [x] Task: Свои `tsconfig`, `biome.json`, скрипты; `package.json` публикуемого пакета (`exports`, `files`, `peerDependencies`, `engines`); `testing`-подпуть отделён
- [x] Task: `scripts/extract-check.sh` — копия в пустой каталог, install, check; `bun pm pack` и установка tarball в пустой проект; подключить в `check`
- [x] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: Готовность к распределённому запуску (D-28)

> **Пауза снята (2026-10-26).** Треки `generators`, `domain-package`, `golden-wish` завершены — Фазы 4–6 можно начинать; входной долг — [migration.md](../../architecture/migration.md) §6. Обоснование — [spec.md](./spec.md) §«Порядок относительно других треков».


- [ ] Task: Тесты «круг через JSON»: `Caller`, `Trace`, конверт события, снапшот Ar
- [ ] Task: Порт outbox в `dmg-core`; контрактный тест идемпотентности реакций; правило «UoW — один модуль» в `arch:check`
- [ ] Task: Подпуть контрактов модуля `domain/<m>/contract` (проект; каркасы `domain/<m>/contract` готовы в треке domain-package — [migration.md](../../architecture/migration.md) §6); вход для остального кода закреплён D-45 — остаётся содержимое `contract` остальных модулей по мере перевода
- [ ] Task: ARC-04 в `checkFiles`: вход для других модулей задаёт приложение (`contract`, D-45); прикладной слой внешнего модуля не проверяется (как обещает JSDoc); приложение домена в `ARCH_APPS` — погасить DEBT-33
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

## Фаза 5: Документация и инструменты в пакете

Цель: каждый, кто берёт `dmg-core` за основу, получает полную документацию и инструменты — для разработчика и для агента (D-30).

Гайды по видам артефактов пишутся в треке `golden-wish` в `conductor/architecture/guides/` с эталоном `wish`; здесь они переезжают в `docs/guides/` пакета и ссылаются на **учебный модуль пакета** (а не на `wish`).

- [ ] Task: Разметка «что в пакет, что остаётся в проекте» по `conductor/architecture/*.md`, скилам и ролям; результат — таблица в `spec.md`, проектные ссылки в перенесённых файлах заменены на нейтральные
- [ ] Task: Сборка артефактов пакета: `docs/` (платформа DMG + справочник ID правил `rules.md`), `skills/dmg-architecture` (обобщённый `architecture`), `agents/` (`domain-author`, `api-author`, `reviewer` из `.agents-core/roles` для Claude Code и pi), `llms.txt` в корне; всё в `files`
    - [ ] Источник правды один — в репозитории пакета; в проекте копий нет (кроме вставок `init`)
- [ ] Task: CLI `dmg-core init` (копирует скилы и роли в `.claude/`, `.pi/`, добавляет в `AGENTS.md` вставку со ссылкой на `node_modules/dmg-core/llms.txt`, ставит версию-метку) и `dmg-core sync` / `sync --check` (обновляет; в `check` потребителя падает при устаревших копиях)
    - [ ] Тесты на временном проекте; идемпотентность `init`
- [ ] Task: Сообщения `arch:check` ссылаются на правило по ID с путём к `docs/rules.md` в пакете; README пакета: установка, быстрый старт на учебном модуле, ссылки на документацию
- [ ] Task: Проверка в `extract-check.sh`: установка tarball в пустой проект → `init` → `llms.txt`, документация и скилы на месте и валидны, битых ссылок нет
- [ ] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md)

## Фаза 6: Вынос и публикация

- [ ] Task: Проверить свободное имя `dmg-core` на npm; репозиторий, CI, публикация по тегу
- [ ] Task: Перевести монорепо на версию из npm; удалить `packages/dmg-core`; обновить документацию проекта (`layers.md`, `migration.md`, `tech-stack.md`); документация платформы живёт только в пакете, проект ссылается на неё
- [ ] Task: Conductor - User Manual Verification 'Фаза 6' (Protocol in workflow.md)
