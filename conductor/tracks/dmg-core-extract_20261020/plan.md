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
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md) (git note на 1fa0d8b)

## Фаза 3: Самодостаточность [checkpoint: f4cbb89]

> **Последняя фаза части А.** После её контрольной точки трек ставится на паузу (см. ниже Фазу 4).

- [x] Task: Свои `tsconfig`, `biome.json`, скрипты; `package.json` публикуемого пакета (`exports`, `files`, `peerDependencies`, `engines`); `testing`-подпуть отделён
- [x] Task: `scripts/extract-check.sh` — копия в пустой каталог, install, check; `bun pm pack` и установка tarball в пустой проект; подключить в `check`
- [x] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: Готовность к распределённому запуску (D-28) [checkpoint: b469825]

> **Пауза снята (2026-10-26).** Треки `generators`, `domain-package`, `golden-wish` завершены — Фазы 4–6 можно начинать; входной долг — [migration.md](../../architecture/migration.md) §6. Обоснование — [spec.md](./spec.md) §«Порядок относительно других треков».


Бриф: [slices/phase4.md](./slices/phase4.md). Решения: D-46, D-47, MAN-13. DEBT-1, 2, 6, 7, 11, 12, 16, 17, 25, 26 переданы трекам перевода модулей (Нурболат, 2026-10-26): гасятся только переводом модуля на Def.

- [x] Task: Круг через JSON (D-46): `Caller.toJSON/fromJSON` (субъект `U` целиком, `revive`), `Trace.toJSON/fromJSON`; тесты для всех видов `Caller`, `Trace`, конверта события, снапшота Ar (7bddc3b)
- [x] Task: Порты `Outbox` (вместо `bus` в UoW) и `Inbox` (отсев повтора `eventId`) в `dmg-core`, in-proc по умолчанию; контрактный хелпер идемпотентности ER в `dmg-core/testing` (D-47) (9f18f5d)
- [x] Task: Хелпер идемпотентности — к ER `wish`; нарушения — в DEBT (25592a0)
- [x] Task: MAN-13 «UoW — один модуль»: `checkDefs` и рантайм-проверка в UoW (c853e64)
- [x] Task: Подпуть контрактов модуля `domain/<m>/contract` — сделан в D-45 (61322654): `exports` пакета домена `./*/contract`, `contract.ts` у всех 7 модулей; наполнение остальных модулей — в треках их перевода
- [x] Task: ARC-04 в `checkFiles`: вход для других модулей задаёт приложение (`contract`, D-45); прикладной слой внешнего модуля не проверяется (как обещает JSDoc); приложение домена в `ARCH_APPS` — погасить DEBT-33 (f882206)
- [x] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md) (автономно)

## Фаза 5: Документация и инструменты в пакете [checkpoint: 249474e]

Цель: каждый, кто берёт `dmg-core` за основу, получает полную документацию и инструменты — для разработчика и для агента (D-30).

Гайды по видам артефактов пишутся в треке `golden-wish` в `conductor/architecture/guides/` с эталоном `wish`; здесь они переезжают в `docs/guides/` пакета и ссылаются на **учебный модуль пакета** (а не на `wish`).

- [x] Task: Разметка «что в пакет, что остаётся в проекте» по `conductor/architecture/*.md`, скилам и ролям; результат — таблица в `spec.md`, проектные ссылки в перенесённых файлах заменены на нейтральные (6e83c5f)
    - Правила нейтрализации — в `spec.md`; сама замена — при переносе файлов (задача «Сборка»)
- [x] Task: Обогатить учебный модуль `src/testing/example` до образца для всех гайдов (DCS, `contract.ts`, VO, вызов чужого UC, тесты state/events/errors/Job/идемпотентности ER) — бриф [slices/example-enrich.md](./slices/example-enrich.md); отдельная сессия, Opus (ee7e68d)
- [x] Task: Сборка артефактов пакета: `docs/` (платформа DMG + справочник ID правил `rules.md`), `skills/dmg-architecture` (обобщённый `architecture`), `agents/` (`domain-author`, `api-author`, `reviewer` из `.agents-core/roles` для Claude Code и pi), `llms.txt` в корне; всё в `files` (4c7a450)
    - [x] Источник правды один — в репозитории пакета; в проекте копий нет (кроме вставок `init`)
- [x] Task: CLI `dmg-core init` (копирует скилы и роли в `.claude/`, `.pi/`, добавляет в `AGENTS.md` вставку со ссылкой на `node_modules/dmg-core/llms.txt`, ставит версию-метку) и `dmg-core sync` / `sync --check` (обновляет; в `check` потребителя падает при устаревших копиях) (ee84adb)
    - [x] Тесты на временном проекте; идемпотентность `init`
    - [x] Общий инструмент (spec.md, решение 3): пакет не знает раскладки проекта и состава его агентов; выбор ролей и скилов и пути назначения — настройки проекта со значениями по умолчанию
    - [x] Подключение в u7-school поверх общего инструмента (решение 2): роли — в `.agents-core/roles/`, проектный блок — `agents:sync`; снять симлинк скила и чтение ролей из пакета (TR-28 п. 1–2); `sync --check` — в `bun run check`
- [x] Task: Генераторы в пакет: `dmg-core gen` (перенос `scripts/gen` с шаблонами; раскладка — `ArchApp.layout` проекта), тесты на временном проекте; `bun run gen` проекта вызывает CLI пакета, `scripts/gen` удалён; `naming.md` §5 — в `docs/` пакета (bd51181)
- [x] Task: Сообщения `arch:check` ссылаются на правило по ID с путём к `docs/rules.md` в пакете; README пакета: установка, быстрый старт на учебном модуле, ссылки на документацию (f748998)
- [x] Task: Проверка в `extract-check.sh`: установка tarball в пустой проект → `init` → `llms.txt`, документация и скилы на месте и валидны, битых ссылок нет (61d202c)
- [x] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md) (reviewer без error/major, минорные — 8baaa3a; переход к Ф6 — Нурболат, 2026-10-26)

## Фаза 6: Готовность к выносу

> **Решение Нурболата (2026-10-26):** пакет сейчас не выносим и не публикуем — только убеждаемся, что вынос сводится к переносу каталога. Фактический вынос (репозиторий, CI, npm, удаление `packages/dmg-core`) — чек-лист в `spec.md`, отдельным треком после релиза. Раскладка монорепо (`platform/`, `domain/`, `modules/`, `runners/`, `authoring/`) — отдельный трек.
>
> Сверка 2026-10-26: импорты проекта идут только через `exports`; в пакете нет импортов `@u7-scl/*`; имя `dmg-core` на npm свободно (404). Пробелы — задачи ниже.
>
> Открытые вопросы ревью Ф5 (проектные, не блокируют): выводить ли `DomainArch.layout` (`scripts/domain-arch.ts`) из секции `gen` в `dmg-core.json`, чтобы раскладка была в одном месте; создавать ли генератором `contract.ts` модуля домена (D-45). Первый решается в треке раскладки монорепо.

- [x] Task: GritQL-плагины в поставке: `biome-plugins` в `files`; `biome.json` проекта ссылается на `node_modules/dmg-core/biome-plugins/…` (не на `packages/dmg-core`); `consumer-check` проверяет плагины в установленном пакете и что biome потребителя их загружает (0086f90)
- [x] Task: Тест lint-правил пакета — в пакете: фикстуры `lint-fixtures/packages/dmg-core/**` и проверка конфига пакета переезжают в `packages/dmg-core` (входит в `check` пакета); в проекте остаются фикстуры проекта (b24fe01)
- [~] Task: Нейтрализовать проектные следы в конфиге пакета: ARC-10 в `biome.json` пакета без `@u7-scl/**` и `legacy-bridge` (общая формулировка: только объявленные зависимости); комментарий DOM-17 без `packages/wish`; проектный запрет `@u7-scl/*` — в `biome.json` проекта
- [ ] Task: Сквозная проверка потребителя — в пакете: часть `extract-check.sh` «tarball → пустой проект → init/gen/consumer-check» становится скриптом пакета (его будущий CI); проект вызывает его; проверка состава tarball (нет тестов и временных каталогов, есть `docs`, `skills`, `agents`, `biome-plugins`); `npm publish --dry-run`
- [ ] Task: Метаданные публикации и чек-лист выноса в `spec.md`: `license`, `repository`, `author` в `package.json` (по решению Нурболата), файл лицензии; шаги выноса (репозиторий, CI, публикация по тегу, перевод монорепо на npm, удаление `packages/dmg-core`, документация проекта)
- [ ] Task: Conductor - User Manual Verification 'Фаза 6' (Protocol in workflow.md)
