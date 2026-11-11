# Plan: course-dmg_20261105

Каждая задача кода идёт по TDD: red → запуск → green. Структуру создаёт `bun run gen … --adopt`. Код пишут роли конвейера, коммитит orchestrator ([agents.md](../../architecture/agents.md) §3).

**Конвейер среза:** `dmg-tech-lead` (бриф) → `dmg-test-designer` (red) → `migrator` (green) → гейт → `dmg-data-keeper` (по триггеру) → `dmg-reviewer` → решение orchestrator.

**Исполнители** — по таблице §2 [deepseek.md](../../architecture/deepseek.md); метка в скобках у задачи:
- **Opus:** orchestrator (в т.ч. приёмка брифов), `dmg-reviewer`.
- **Sonnet:** `dmg-tech-lead`, red-тесты, UI-stories.
- **flash:** через `scripts/pi-role.ts`, один шаг — один `--label`.

После каждого шага на flash — гейт (`bun run scripts/agent-gate.ts`), `git diff --numstat` (не удалены ли проверки) и grep-критерии брифа. Строка расхода по фазе — в `summary.md` → «DeepSeek». Отклонение от таблицы — в отчёт фазы с причиной.

**Режим — автономный** ([agents.md](../../architecture/agents.md) §9). В `data/` пишем только в Ф3 (`courses.json`, после бэкапа). Решения и входной долг — в [spec.md](./spec.md).

**Перепроектирование** — только с разрешения Нурболата: вопрос «сейчас или в `debt.md`», ответ — в TR или `decisions.md` до выполнения.

**Красная зона Ф3–Ф4.** Ф1–Ф2 аддитивны: legacy-UC `course` живут рядом с Def, `check` зелёный. С Ф3 (строгий новый формат `courses.json`) падают legacy-UC курса, stories каталога/навигации и их integration/e2e. Гейт Ф3 — `check` зелёный, кроме поимённого списка в `debt.md`; критерий снятия — конец Ф4.

## Фаза 0: База и решения [checkpoint: 1a576c04]

- [x] Task: Зафиксировать базовую линию в `summary.md`: `CI=true bun test`, `bun run test:bot`, тесты `domain/src/course` и `modules/course`, `dmg-core` `bun test`. Каркас раздела «DeepSeek» (Opus) b1d57ddb
- [x] Task: Записать решения spec в TR (`debt.md`) и `decisions.md` (Opus): cf07c035
    - [x] этап — метка программы (`moduleIds` + `fromModuleId`), `stages` в ответе `get-course`;
    - [x] «клиент спрашивает — курс разруливает», вердикт пререквизита `admitted`;
    - [x] состав UC: переносимые, сливаемые методы фасада, удаляемые (9 команд, `get-course-program`, `resolve-content-path`);
    - [x] порядок срезов, аддитивные Ф1–Ф2, план красной зоны Ф3–Ф4.
- [x] Task: `dmg-tech-lead`: брифы `slices/module.md`, `slices/lesson-step.md` (Sonnet). Обязательно: способ получить роль и авторство для Policy видимости при субъекте `Identified` (сверка с `wish`/`stream`; если нужен `user` — вопрос Нурболату, D-41); список legacy-тестов на перенос; ID `rules.md` 3dc0da16
- [x] Task: orchestrator проверяет брифы (Opus). Вопросы перепроектирования — Нурболату 3dc0da16
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md; автономно) 1a576c04

**Критерии приёмки Фазы 0:**
- Базовая линия (pass/fail по командам) — в `summary.md`.
- Решения spec записаны в TR и `decisions.md`.
- Брифы `module` и `lesson-step` приняты; вопрос о роли в Policy закрыт или передан Нурболату.

## Фаза 1: Срез `module` [checkpoint: 07e2c6eb]

- [x] Task: `migrator` S0 (flash): legacy `ModuleAr`/`ModulePolicy`/`ModuleRepo`/`ModuleJsonRepo` → `Legacy*` (бриф, шаг 0) 3c4faa9d
- [x] Task: `dmg-test-designer`: характеризация на `../u7-school-v0.2.6` и red-тесты (Sonnet) b035df66
    - [x] state `Module` (проекты — VO, `status`, `tags`) с `F.timestamp`, чтение дат без секунд;
    - [x] DQS/Policy видимости: автор/админ видит всё, остальным — опубликованное (замена `#filterPublished`, DEBT-10);
    - [x] UC `get-module`, `list-modules`; ошибки `MODULE_NOT_FOUND`, `MODULE_ACCESS_DENIED`;
    - [x] репозиторий: legacy ISO → число, round-trip, невалидная запись;
    - [x] перенос сценариев legacy-тестов `module` (список — в отчёте).
- [x] Task: `migrator`, домен и прикладной слой (flash): Def, Ar без `#` и `throw*`, `UseCaseFromDef`, репозиторий через UoW со строгим разбором; `CourseModuleDef` пока с `external` b035df66
- [x] Task: `dmg-data-keeper` (flash): чтение `data/courses/modules.json` (копия и `DB_DIR=./data/fixtures`), откат 42352b72
- [x] Task: `dmg-reviewer` (Opus). Замечания без `error` решает orchestrator (TR), перепроектирование — Нурболату 6e4363ae
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 1:**
- `grep -rnE "throw[A-Z]|new [A-Za-z]*Ar\b|#[a-z]|@u7-scl/(core|app-legacy)"` по Def-файлам `module` пуст (legacy-файлы, удаляемые в Ф5, — исключение поимённо).
- `get-module`, `list-modules` — через `UseCaseFromDef`; маркера DEBT-10 в `module` нет.
- Тест репозитория читает legacy ISO и даты без секунд.
- `check` зелёный, тесты не ниже базовой линии, `git status data/` чист.

## Фаза 2: Срез `lesson` + `step` + снимок [checkpoint: 39981831]

- [x] Task: `migrator` S0 (flash): legacy `Lesson*`/`Step*` (Ar, Policy, Repo, JsonRepo) → `Legacy*` (бриф, шаг 0) 48ae3c7c
- [x] Task: `dmg-test-designer`: red-тесты (Sonnet) ffca0443
    - [x] агрегаты `lesson`, `step`; UC `get-lesson`, `get-step`, `get-steps-by-lessons`; видимость от модуля;
    - [x] `GetModuleSnapshotUcDef` настоящим UC: снимок (`ContentSnapshotVo`, сборка — DQS вместо `CourseDs.buildSnapshot`) только из опубликованного;
    - [x] перенос сценариев `content-snapshot*.test.ts`, `course-ds.test.ts`, `lesson/*`, `step/*` (список — в отчёте).
- [x] Task: `migrator`, домен и прикладной слой (flash); адаптер `get-module-snapshot` заменён настоящим UC ffca0443
- [x] Task: `dmg-data-keeper` (flash): чтение `lessons.json`, `steps.json` ffca0443
- [x] Task: `dmg-reviewer` (Opus) 9d3dc1f0
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 2:**
- Те же grep-критерии по `lesson`, `step`, снимку.
- В `get-module-snapshot.uc.ts` нет `legacy.`.
- Сценарии старых тестов перенесены (список в отчёте сверен).
- `check` зелёный, тесты не ниже базовой линии, `git status data/` чист.

## Фаза 3: Срез `course` — программа, этапы, `stream`, данные [checkpoint: 21e17c7d]

- [x] Task: `dmg-tech-lead`: бриф `slices/course.md` (Sonnet); приёмка — orchestrator (Opus); решения — TR-56
- [x] Task: `migrator` S0 (flash): legacy `CourseAr`/`CoursePolicy`/`CourseRepo`/`CourseJsonRepo` → `Legacy*`, снять реэкспорт legacy-типов из `contract.ts` (бриф, шаг 0) 82106df3
- [x] Task: `dmg-test-designer`: характеризация и red-тесты (Sonnet) 215964f3
    - [x] state: `moduleIds`, `phases: [{ title, track?, fromModuleId }]`, `F.timestamp`; инварианты меток (в программе, по порядку, первый — с первого модуля);
    - [x] DQS «этапы курса» (`stages`), «место модуля», «предыдущий модуль»; курс без этапов, с одним, с несколькими;
    - [x] UC `get-course` (со `stages`), `list-courses`, `get-course-by-module`, `get-module-place`; шесть внешних UC; вердикт `getModulePrerequisite` (`admitted`);
    - [x] `stream`: правило `prerequisitePassed` и `EnrollStudentUc` на вердикте, `passedModuleIds` из пройденных потоков;
    - [x] репозиторий `courses.json`: строгий новый формат, старый — ошибка.
- [x] Task: `migrator`, домен и прикладной слой `course` (flash); адаптеры TR-11 сняты 215964f3
- [x] Task: `migrator`, клиент `stream` (flash): `student.rules.ts` на вердикте, `enroll-student` собирает `passedModuleIds`, `StreamAr.teachesModule` и его тест удалены, стенд `student-uc.fixture.ts` 215964f3
- [x] Task: `migrator`, тестовые миры (flash): `runners/u7-bot/tests/worlds/*` на новый формат, `bun run seed:fixtures` 215964f3
- [x] Task: Перевод `data/courses/courses.json` (только этот файл): 5534ac1b
    - [x] `bun run backup:adhoc --courses course-dmg-phases` (Opus);
    - [x] `dmg-data-keeper` (flash): перевод «Fullstack JS» (`moduleIds` — 4 id, этап «Основы JS» с `fromModuleId` первого), round-trip, откат из бэкапа, дата без секунд;
    - [x] отдельный коммит `courses.json` (Opus).
- [x] Task: Записать красную зону в `debt.md` (TR-57): поимённо legacy-UC курса, stories и тесты каталога/навигации, integration/e2e, тесты состава модуля; критерий снятия — конец Ф4 (Opus) 215964f3
- [x] Task: `dmg-reviewer` (Opus); решения — TR-58, правки af6946b7
- [x] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 3:**
- grep-критерии домена по `course` пусты (кроме удаляемого legacy).
- `grep -rn "teachesModule" domain/src/stream modules/stream` пуст; `grep -rn "legacy\." modules/course/src/course` пуст.
- Курс без этапов валиден (тест); для курса с одним этапом `getModulePlace` совпадает с прежним.
- `courses.json` в новом формате, бэкап снят до перевода, в `git status data/` — только одобренный коммит.
- `check` зелёный, кроме поимённого списка красной зоны в `debt.md`.

## Фаза 4: UI [checkpoint: e1631b6d]

**Вход для брифов Ф4–Ф5 — ветка `tst-cleanup`** (на `main` этих файлов нет): `git show tst-cleanup:conductor/roadmap/test-bloat.md` — §2 закономерности Б-1…Б-17 (не переносить лишние тесты), §6 «Рекомендации для `course`».

- [x] Task: `dmg-tech-lead`: бриф `slices/ui.md` с «Сохраняемым поведением» (Sonnet); приёмка — Opus, решения — TR-59
- [x] Task: `dmg-test-designer`: перевод тестов бота на Def-имена и red-тесты навигации по `stages` (курс без этапов / один / несколько) (Sonnet — курс и kit; flash `cd-F4-tests` — остальные stories) eee83a10
- [x] Task: UI-stories (Sonnet): `courses/*` (`course-nav-resolver`, `course-catalog`, `wish-*`), `learning/*`, `streams/*`, `mentor/create-stream` — на `dispatchUc` и `stages`; `ui-spec.md` (Sonnet — этапы; flash `cd-F4-calls` — механика) eee83a10
- [x] Task: Снять красную зону в `debt.md` (Opus) — TR-57 (1)–(2), DEBT-51
- [x] Task: `dmg-reviewer` (Opus): 0 `error`, 6 `warn` — исправлены (`cd-F4-review`) eee83a10
- [x] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 4:**
- В `runners` нет вызовов legacy-имён UC курса через `appApi.execute` (с учётом многострочных) и чтения `phase.moduleIds`.
- Курс из одного этапа: карточка сразу показывает модули этапа, этап виден в крошках (TR-59); остальное — как в `v0.2.6` (характеризация). Курс из двух этапов и больше — как в `v0.2.6`.
- `check` целиком зелёный, `test:bot` и e2e не ниже базовой линии, пересчитанной по TR-59 (удалённые UC — без тестов), красной зоны в `debt.md` нет.

## Фаза 5: Сборка и снятие legacy [checkpoint: 3e0f68e2]

- [x] Task: Бриф `slices/assembly.md` (Opus, TR-45; решения — TR-60) e17c7c12
- [x] Task: `migrator`, сборка (flash): `CourseModuleDef` без `external`, фабрика в `U7App`, `@u7-scl/course/**` — в ARC-07 `biome.json` bd13f3df
- [x] Task: `migrator`, удаление legacy (flash): `api/*`, `module.ts`, `facade.ts`, `commands/*-cmd.ts`, `CourseInProcFacade`, `CourseApiModule`, legacy-репозитории, `content-path`, поля `courseModule`/`courseFacade` и тип `CourseLegacy` в `platform/app` bd13f3df
- [x] Task: `migrator`, клиенты сборки (flash): `tests/helpers/test-app.ts`, `scripts/_app-factory.ts`, `scripts/{call-uc,domain-arch,stream-snapshot-sync,update-stream-snapshot,list-lessons,distribute-lesson,distribute-mentor}.ts`, тесты `u7-app` и `arch-check` bd13f3df (TR-60: шаги «клиенты» → «удаление», общий коммит)
- [x] Task: `dmg-data-keeper` (flash): скрипты `distribute-*`, `list-lessons` на `DB_DIR=./data/fixtures` — вывод совпадает с `v0.2.6`, запись — только через репозитории Def (`cd-F5-data`: вывод совпал; `distribute-mentor` не запускался — шлёт в Telegram, курс не использует)
- [x] Task: `dmg-reviewer` (Opus): 0 `error`, 1 `warn` — исправлены (`cd-F5-fix`), решения — TR-60
- [x] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md; автономно) 3e0f68e2

**Критерии приёмки Фазы 5:**
- `grep -rn "CourseApiModule\|CourseInProcFacade\|CourseFacade\|CourseLegacy" --include=*.ts .` пуст (вне `node_modules`).
- У `CourseModuleDef` нет `external`; `lint` (ARC-07) и `arch:check` зелёные.
- Маркеров DEBT-1, 2, 5, 10, 34, 44 и TR-11 (course) в коде нет.
- `check` зелёный, `git status data/` чист.

## Фаза 6: Итог [checkpoint: 0368348d]

- [x] Task: Гейт закрытия: `CI=true bun test`, `bun run test:bot`, `dmg-core` `bun test` — сравнение с базовой линией в `summary.md` (Opus) d6881f0a
- [x] Task: Документы (Opus): d6881f0a
    - [x] `debt.md` — снять DEBT-1, 2, 5, 10, 34, 44 (course), закрыть TR-11 (сделано в Ф5, TR-60; сверено);
    - [x] `course-module-history.md` — сверить §2 с итогом трека; `content-management.md` — пометка о новой модели этапов;
    - [x] `migration.md` §6 — состояние, следующий трек `user`;
    - [x] `deepseek.md` — сверка таблицы §2 с данными трека;
    - [x] `summary.md` — таблица критериев spec и строка «DeepSeek».
- [x] Task: Conductor - User Manual Verification 'Фаза 6' (Protocol in workflow.md; автономно) 0368348d

**Критерии приёмки Фазы 6:**
- Все критерии приёмки spec выполнены (таблица в `summary.md`).
- `arch:check` чист, `debt.md` и `migration.md` синхронны с кодом.

## Фаза 7: Слияние ветки `tst-cleanup`

Трек чистки тестов (TST-08) закрыт в ветке `tst-cleanup` (worktree `../u7-school-tst-cleanup`, от `816908b1`): −952 теста в `wish`, `stream`, `questionnaire`, `peer-review`, `user`, `dossier`. Вливается после Ф6, порядок — `git show tst-cleanup:conductor/tracks/tst-cleanup_20261105/summary.md`, раздел «Поправка базовой линии `course-dmg`».

- [x] Task: Замер `main` перед слиянием: `CI=true bun test`, `bun run test:bot` — в `summary.md` (Opus) 4e7e1d3a
- [x] Task: `git merge tst-cleanup` (без fast-forward). Конфликты: в тестах — по таблицам `inventory/*-delete.md` ветки (удалённый там тест, который Ф4–Ф5 переписали, — сверить с таблицей, а не воскрешать); в `tracks.md` — оставить запись трека `tst-cleanup` и кандидата по `course` из ветки (Opus) 4e7e1d3a (3 конфликта — по `stream-bot-delete.md`; новый тест Ф4 «отказ UC → 7d» перенесён в `hub.test.ts`)
- [x] Task: Добить отложенное до `course-dmg` (список «Дальше» в `plan.md` трека `tst-cleanup`): `wish-questionnaire.e2e.test.ts:460` → `wish-flow.integration.test.ts:251`, `student-dmg.e2e.test.ts:122`, `:251`, `questionnaire-ux.e2e.test.ts`, `questionnaire.module.test.ts:169` (`probe`) — таблица удаления → приёмка → удаление; отметки в журнале `test-bloat.md` (flash, приёмка Opus) f8c8b29b (−8; `:460` удалён, а не слит — приёмник снят в Ф4)
- [x] Task: Гейт: `check` зелёный, число тестов ≈ замер − 952 (± правки Ф4–Ф5 в почищенных файлах), `course` не уменьшился, покрытие собственных исходников модулей не упало; новая базовая линия — в `summary.md` (Opus) — 3602 / бот 932; потери покрытия — 3 побочных, `summary.md` «Слияние `tst-cleanup`»
- [x] Task: Удалить worktree `../u7-school-tst-cleanup` и ветку — только с подтверждения Нурболата (подтверждено 2026-11-11; ветка была `1221c370`)

**Критерии приёмки Фазы 7:**
- `git branch --no-merged main` не содержит `tst-cleanup`.
- В журнале `test-bloat.md` нет строк «ждёт `course-dmg`».

## Фаза 8: Чистка тестов `course` (TST-08)

Та же работа, что `tst-cleanup` для шести модулей, — для `course`: домен `domain/src/course`, модуль `modules/course`, тесты бота по курсу (`runners/u7-bot`). Идёт после Ф7: закономерности, промпты и скрипт — уже на `main`. Схема и образцы — `conductor/tracks/tst-cleanup_20261105/` (`plan.md` Ф2, `inventory/prompt-*.md`, `inventory/check-chains.py`); признаки — `test-bloat.md` §2, порядок и «не трогать» — §6.

- [ ] Task: Базовая линия: число тестов `domain/src/course`, `modules/course`, тестов бота по курсу; покрытие строк исходников `course` — в `summary.md` (Opus)
- [ ] Task: Инвентаризация по слоям ‖ — домен, модуль, бот (flash, `dmg-tech-lead`, только чтение): `inventory/course-{domain,app,bot}.md` по образцу `prompt-<m>.md`
- [ ] Task: Таблицы удаления ‖ «тест → закономерность → где покрыт (путь до `it`)» (flash); проверка цепочек между таблицами — `check-chains.py`
- [ ] Task: Приёмка таблиц (Opus); новые закономерности — в `test-bloat.md` §2
- [ ] Task: Удаление по таблицам: домен ‖ бот → модуль (flash); мёртвый код, найденный при чистке, — удалить (Б-13), строкой в отчёт
- [ ] Task: Гейт: `check` зелёный; покрытие собственных исходников `course` не ниже; `git diff --numstat` — только тестовые файлы (кроме Б-13); строки расхода — в `summary.md` «DeepSeek» (Opus)
- [ ] Task: Журнал `test-bloat.md` — строки «почищено»; в `tracks.md` снять кандидата «чистка тестов `course`» (Opus)

**Критерии приёмки Фазы 8:**
- Число тестов `course` упало, покрытие строк его исходников не упало, `check` зелёный.
- Каждое удаление есть в принятой таблице; в `test-bloat.md` по `course` нет строк «ждёт трека».
