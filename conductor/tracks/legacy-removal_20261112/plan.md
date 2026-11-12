# Plan: legacy-removal_20261112

Каждая задача кода идёт по TDD: red → запуск → green. Код пишут роли конвейера, коммитит orchestrator ([agents.md](../../architecture/agents.md) §3).

**Конвейер среза:** `dmg-tech-lead` (бриф) → `dmg-test-designer` (red) → `migrator` (green) → гейт → `dmg-reviewer` → решение orchestrator. `dmg-data-keeper` не нужен: данные и форматы `data/` не меняются (триггер — правка state/репозиториев/снимков модулей).

**Исполнители** — по таблице §2 [deepseek.md](../../architecture/deepseek.md); метка в скобках у задачи. После каждого шага на flash — гейт (`bun run scripts/agent-gate.ts`), `git diff --numstat` (не удалены ли проверки) и grep-критерии брифа; строка расхода — в `summary.md` → «DeepSeek».

**Режим — автономный** ([agents.md](../../architecture/agents.md) §9). Живые данные трек не трогает: smoke бота — только `DB_DIR=./data/fixtures`, тесты — во временном каталоге.

**Правки `dmg-core`** (Ф2, Ф3 при необходимости) — в репо `~/dev/tools/dmg/dmg-core` по порядку `architecture/index.md` («Правка платформы `dmg-core`»): решение D-NN в `docs/decisions.md` пакета до кода → `bun run check` и `bun run e2e` пакета → коммит там → `bun install`, `dmg:sync`, `agents:sync` в u7-school → коммит u7-school с SHA пакета.

**Красная зона Ф3–Ф4 — избегается** (TR-62): в Ф3 `U7App` отдаёт наружу dmg `ApiApp` и шину DMG, legacy-оболочка приватна до Ф4. Если не удастся — гейт `check` зелёный, кроме поимённого списка в `debt.md`; критерий снятия — конец Ф4.

**Перепроектирование** — только с явного разрешения Нурболата: вопрос «сейчас или в `debt.md`», ответ — в TR до выполнения.

## Фаза 0: База и решения [checkpoint: 5855ee9e]

- [x] Task: Зафиксировать свежую базовую линию в `summary.md`: `CI=true bun test`, `bun run test:bot`, `bun run check`, `bun test` в `dmg-core`; каркас раздела «DeepSeek» (Opus) 9894083d
    - [x] проверить состояние `runners/u7-bot/tests/courses/course-catalog.integration.test.ts` (tsc в редакторе: `@u7-scl/user/domain`, `userFacade` — остаток `user-dmg`): входит ли в прогон, сообщить Нурболату до правки
- [x] Task: `dmg-tech-lead`: брифы срезов `slices/dossier.md`, `slices/job-scheduler.md`, `slices/core-ui.md`, `slices/assembly.md`, `slices/removal.md` с таблицей раскладки «файл → куда / удалить» и «Сохраняемым поведением» (Sonnet) db05a24
    - [x] список тестов на перенос (TST-08) и на удаление вместе с legacy-кодом
    - [x] список тестов состава модуля и графа (`scripts/{arch-check,domain-check,domain-arch,agent-gate}.test.ts`)
- [x] Task: orchestrator проверяет брифы (Opus); вопросы Нурболату — только стратегические db05a24
- [x] Task: Записать решения в TR (`debt.md`): раскладка, реализации в пакете vs проекте, подписки по Def (Opus) db05a24
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (автономно: документы, `check` зелёный) (Protocol in workflow.md)

**Критерии приёмки Фазы 0:**
- Базовая линия (pass/fail по командам) — в `summary.md`.
- Брифы приняты (`slices/`, факты — `slices/inventory.md`), таблица раскладки покрывает каждый файл `platform/core/src`, `platform/app-legacy/src`, `runners/u7-cli`.
- Решения записаны в TR.

## Фаза 1: `dossier` на Def, DEBT-3 и DEBT-34 [checkpoint: 87c6623f]

- [x] Task: `dmg-test-designer`: red-тесты (Sonnet) ff7727d
    - [x] `modules/dossier/src/dossier.module.test.ts` — пустой модуль собирается, граф содержит `dossier` без `external`
    - [x] правка `scripts/arch-check.test.ts` (ожидание `external` у `dossier`), `scripts/domain-check.test.ts` (нет пропуска legacy-пар и `index`)
- [x] Task: `migrator` (flash): `DossierModuleDef` без `external`, `description` — текущее понимание; `createDossierModule` с пустыми картами; `modules/dossier/src/index.ts` — вход модуля вместо реэкспорта домена; фабрика в `U7App`; `domain-check.ts` без `sub !== 'index'` (оба места) и пропуска legacy-пар; `arch-check.ts` — `modules.dmg` → `modules.all`, если применимо ff7727d
- [x] Task: Opus: `modules/dossier/README.md` — назначение, источники фактов (peer-review, sessions, stream), связь с `passport`, ссылка на `roadmap/metrics`; DEBT-3 и DEBT-34 сняты в `debt.md` — **до гейта** после `migrator` (`checkDebt`, TR-62) ff7727d
- [x] Task: `dmg-reviewer` (Opus) ff7727d
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (автономно: `check` зелёный, ревью без `error`, TR-63) (Protocol in workflow.md)

**Критерии приёмки Фазы 1:**
- `grep -rn "external" domain/src/dossier` пуст; `grep -n "sub !== 'index'" scripts/domain-check.ts` пуст; `modules/dossier/src/index.ts` не содержит `@u7-scl/domain`.
- `bun run arch:check` зелёный, `dossier` проверяется как обычный модуль; DEBT-3, DEBT-34 сняты.
- `check` зелёный, тесты не ниже базовой линии.

## Фаза 2: `dmg-core` — планировщик заданий

- [ ] Task: Opus: решение D-NN в `docs/decisions.md` пакета — порты `JobScheduler`/`JobRunRepo`, in-proc реализация (planner, runner, scheduler, Memory-репо запусков); вход — `AnyJobDef` + `ApiApp.runJob`, `Clock` из `AppContext`, `Logger` пакета
- [ ] Task: `dmg-test-designer`: перенос тестов `core/infra/{job-schedule-planner,scheduled-job-runner,in-proc-job-scheduler,in-proc-job-executor,job-run-repo}` в пакет (TST-08), red под новый вход (Sonnet)
- [ ] Task: `migrator` (flash): реализация в `~/dev/tools/dmg/dmg-core`; документы пакета по `bun run docs:impact`
- [ ] Task: orchestrator: `check` и `e2e` пакета, коммит пакета; `bun install`, `dmg:sync`, `agents:sync` в u7-school; `check` u7-school
- [ ] Task: `dmg-reviewer` (Opus)
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

**Критерии приёмки Фазы 2:**
- В `dmg-core` тесты планировщика зелёные, `bun run check` и `bun run e2e` зелёные, D-NN записано, документы по `covers:` обновлены.
- В u7-school `core/infra` ещё на месте (аддитивно), `check` зелёный; коммит u7-school содержит SHA пакета.

## Фаза 3: `core/ui` без legacy

- [ ] Task: `dmg-test-designer`: red-тесты (Sonnet)
    - [ ] тесты `ui` и 8 stories `u7-bot` (14 подписок), `questionnaire-dmg.test-kit.ts`, 4 e2e с legacy-публикацией в `app.eventBus` — на конверты событий DMG по Def (`name`, `payload`, `occurredAt` числом); помощник `envelopeOf`; `tests/helpers/{test-app,test-bot-transport}.ts` на шину DMG
    - [ ] `handleError`/`errorNotify`: необработанное исключение → `internal`; тесты `AppException` в `u7-bot-ui-story.test`, `bot-ui-story.test`, `bot-controller.test` — удалить или переписать (список в отчёте)
- [ ] Task: `migrator` 3a (Sonnet — видимое поведение): `ui` (`handleError`, подписки по Def, типы без `TAppMeta`), `serialize-error`; 3b (flash): stories, `questionnaire-events.ts`, `config.ts`, закрывающие типы бота, `U7App` наружу — dmg `ApiApp` и шина DMG (оболочка приватна до Ф4, TR-62). Исходная формулировка: `ui` на dmg `ApiApp` (без дженерика `TAppMeta`) и `EventBus`/`EnvelopeOf` пакета; закрывающие типы `u7-bot-ui-story`, `u7-bot-controller`, `u7-bot-app-meta`, `ui-app`; stories — `eventSubscription(def, …)`; `fromError` → локальный разбор `unknown`; `NotifyKind` → `ui/bot/types.ts`; `#*-legacy` внутри `ui` → относительные импорты
- [ ] Task: `dmg-reviewer` (Opus)
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

**Критерии приёмки Фазы 3:**
- `grep -rn "#[a-z]*-legacy/\|@u7-scl/core/domain\|@u7-scl/core/api" platform/core/src/ui runners/u7-bot` пуст; `grep -rn "DomainEvent" platform/core/src/ui runners` пуст.
- `test:bot` и e2e не ниже базовой линии с поправкой на удалённые тесты `AppException` (список в отчёте); падения красной зоны — поимённо в `debt.md`.

## Фаза 4: Сборка — `U7App` без legacy

- [ ] Task: `dmg-test-designer`: red-тесты `platform/app/tests` — `apiApp` = dmg `ApiApp`, планировщик пакета, `School` из `platform/app/src/school`; тесты `FileReplayStore`/`JobRunJsonRepo` переезжают в `platform/app/src/infra` (Sonnet)
- [ ] Task: `migrator` (flash):
    - [ ] `School` → `platform/app/src/school/`; `U7AppResolver` → явный тип в `app`
    - [ ] `U7App` на dmg `ApiApp`, `InProcEventBus` и планировщик пакета, `systemClock`; `legacyEventBus`/`legacyClock`/`legacyJobsOf` не используются
    - [ ] `FileReplayStore`, `JobRunJsonRepo` → `platform/app/src/infra/`
    - [ ] `JsonFileRepo` (без `BaseJsonDb`) → `runners/u7-bot/src/infra/`; `CompositeLogger` → `runners/u7-bot/src/infra/logger/`
    - [ ] импорты в `scripts/*`, мирах и тестах `u7-bot`; проверка тестов с `spyOn(Shared,'now')` (замороженное время)
- [ ] Task: smoke бота на `DB_DIR=./data/fixtures` (без записи в живые данные; `git status data/` чист) (Opus)
- [ ] Task: `dmg-reviewer` (Opus)
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

**Критерии приёмки Фазы 4:**
- `grep -rn "legacy-bridge\|U7ApiApp\|U7AppResolver\|legacyClock\|legacyEventBus" --include=*.ts .` пуст вне `node_modules`, архива и самого `platform/core/src/legacy-bridge`.
- `grep -rn "@u7-scl/core/infra\|@u7-scl/app-legacy" --include=*.ts runners platform/app scripts` пуст.
- `check` зелёный, `test:bot` и e2e не ниже базовой; записи красной зоны в `debt.md` сняты; бот стартует на fixtures.

## Фаза 5: Удаление legacy

- [ ] Task: `migrator` (flash): удалить `platform/core/src/{api,domain,infra,legacy-bridge}`, `shared/iso-now`; сузить `exports` `@u7-scl/core` до `./ui`, `./shared`, убрать `paths` в `tsconfig`; удалить `platform/app-legacy`; убрать `#*-legacy/*` и `@u7-scl/app-legacy` из всех `package.json`; ARC-02 (`PLATFORM` в `domain-check.ts`) — только `core`; переписать строки `@u7-scl/app-legacy` в `scripts/*.test.ts`; `biome.json` (override `app-legacy`, исключения `core/infra`); мёртвая `@u7-scl/core` в `modules/*/package.json`; `bun install`
- [ ] Task: orchestrator: список удалённых тестов в `summary.md` (Opus)
- [ ] Task: `dmg-reviewer` (Opus)
- [ ] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md)

**Критерии приёмки Фазы 5:**
- `grep -rn "app-legacy\|legacy-bridge\|-legacy/" --include=*.ts --include=*.json .` пуст вне `node_modules` и архива (`runners/u7-cli` уже удалён в Ф6).
- Каталога `platform/app-legacy` нет; `@u7-scl/core` экспортирует только `ui` и `shared`; классов `UseCase`, `ApiModule`, `ApiApp`, `Aggregate`, `AppError` в `core` нет.
- `check` зелёный; число тестов сверено с базой, удалённые перечислены.

## Фаза 6: `u7-cli` → `dmg-cli`

- [ ] Task: Opus: `~/dev/tools/dmg/dmg-cli` — `git init`, перенос `src/` без `package.json` и `node_modules`; README: «нерабочая заготовка — не собирается, не используется» и концепция (автоматический текстовый интерфейс к бэку на dmg-core: модули и UC из графа Def, ввод по схеме входа, `dispatch`, выполнение от чужого имени — подмена `Caller`; одна механика для терминала и бота с адаптацией под канал; заменит `call-uc`); первый коммит
- [ ] Task: `migrator` (flash): удалить `runners/u7-cli`, правка `scripts/domain-arch.test.ts`, упоминаний в `README.md`; `bun install`
- [ ] Task: Opus: DEBT-42 переформулировать (`call-uc` остаётся) — **до гейта** удаления `u7-cli` (`checkDebt`, TR-62); кандидат «`dmg-cli`» в `roadmap.md` со ссылкой на README
- [ ] Task: Conductor - User Manual Verification 'Фаза 6' (Protocol in workflow.md)

**Критерии приёмки Фазы 6:**
- Каталога `runners/u7-cli` нет; `~/dev/tools/dmg/dmg-cli/README.md` есть, код перенесён, первый коммит сделан.
- Критерий spec 1 выполнен полностью; `check` зелёный.

## Фаза 7: Документы, аудит `throw*`, итог

- [ ] Task: Opus: удалить `legacy.md`; вычистить ссылки в источниках: `AGENTS.md`, `conductor/architecture/{index,rules,migration,decisions}.md`, `.agents-core/`, `.pi/skills/*`, `conductor/roadmap/tasks-system-*.md`; `bun run agents:sync`
- [ ] Task: Opus: `migration.md` §2/§5/§6 — переход завершён, остаётся чек-лист релиза; `debt.md` — DEBT-3, DEBT-34, TR-33 закрыты, остаток legacy расписан; `architecture/index.md` — пометка «`@u7-scl/core` — кандидат на удаление при `dmg-ui`»
- [ ] Task: `dmg-reviewer` (Opus): аудит `throw*` для штатных отказов в живом коде → `summary.md`
- [ ] Task: Opus: гейт закрытия — полный `check`, сравнение с базовой линией Ф0, таблица критериев spec в `summary.md`, строка «DeepSeek»
- [ ] Task: Conductor - User Manual Verification 'Фаза 7' (Protocol in workflow.md)

**Критерии приёмки Фазы 7:**
- `legacy.md` нет; `grep -rn "legacy.md" --include=*.md --include=*.ts .` вне архива пуст.
- `arch:check` чист; `debt.md`, `migration.md` синхронны с кодом.
- Аудит `throw*` и таблица критериев spec — в `summary.md`; `check` зелёный, число тестов сверено с базой.

## Порядок

Ф0 → Ф1 → Ф2 → **Ф6** → Ф3 → Ф4 → Ф5 → Ф7 (TR-62): `runners/u7-cli` компилируется корневым `tsc` и держит legacy — с Ф3 `tsc` красный, поэтому Ф6 раньше Ф3. Номера фаз не меняются.
