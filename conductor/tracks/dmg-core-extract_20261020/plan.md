# Plan: dmg-core-extract_20261020

Каждая задача — TDD, `bun run check` зелёный после каждой. Предшествует трек core-dmg (завершён).

**Порядок относительно других треков ([migration.md](../../architecture/migration.md) §2):**
- Фазы 1–3 — сразу, **до** `generators` и `golden-wish`: после них пути и import-спецификатор платформы (`dmg-core`) уже финальные, шаблоны генераторов и эталонный модуль пишутся без переименования.
- Фазы 4–6 — **после** `golden-wish`: контракты модуля (`domain/<m>/contract`) требуют `domain-package`, outbox и идемпотентность реакций проверяются на реальном модуле, документация пакета (Фаза 5) включает гайды, написанные по эталону.
- Мосты к legacy (Фаза 1) должны остаться рабочими для `golden-wish`: `wish` до миграции живёт на legacy-шине и legacy-`Job`.

## Фаза 1: Развязка от legacy

- [ ] Task: Перенести мосты (`legacy-event-bus`, `legacy-error`, `legacy-job`, `run-logged`, `context`, часть `use-case-from-def`, `now`) в `packages/core/src/legacy-bridge/`, внутрь `dmg` оставить порты
    - [ ] Тесты моста сохраняются; `dmg` получает логгер/режим/время через порты
- [ ] Task: Правило и проверка: `dmg` не импортирует `*-legacy` и `@u7-scl/*` (biome `noRestrictedImports` + тест `arch:check`)
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: Выделение пакета `dmg-core`

- [ ] Task: Создать `packages/dmg-core` (перенос `dmg/**` в `src/`), алиас `#core/*`, `core/dmg` временно реэкспортирует
- [ ] Task: Перевести потребителей на `dmg-core`; убрать `paths` на `@u7-scl/core/dmg*` из корневого `tsconfig`
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Самодостаточность

- [ ] Task: Свои `tsconfig`, `biome.json`, скрипты; `package.json` публикуемого пакета (`exports`, `files`, `peerDependencies`, `engines`); `testing`-подпуть отделён
- [ ] Task: `scripts/extract-check.sh` — копия в пустой каталог, install, check; `bun pm pack` и установка tarball в пустой проект; подключить в `check`
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: Готовность к распределённому запуску (D-28)

- [ ] Task: Тесты «круг через JSON»: `Caller`, `Trace`, конверт события, снапшот Ar
- [ ] Task: Порт outbox в `dmg-core`; контрактный тест идемпотентности реакций; правило «UoW — один модуль» в `arch:check`
- [ ] Task: Подпуть контрактов модуля `domain/<m>/contract` (проект; реализация — трек domain-package)
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

## Фаза 5: Документация и инструменты в пакете

Цель: каждый, кто берёт `dmg-core` за основу, получает полную документацию и инструменты — для разработчика и для агента (D-30).

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
