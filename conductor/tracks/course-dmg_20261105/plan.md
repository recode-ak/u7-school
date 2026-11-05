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

## Фаза 0: База и решения

- [~] Task: Зафиксировать базовую линию в `summary.md`: `CI=true bun test`, `bun run test:bot`, тесты `domain/src/course` и `modules/course`, `dmg-core` `bun test`. Каркас раздела «DeepSeek» (Opus)
- [ ] Task: Записать решения spec в TR (`debt.md`) и `decisions.md` (Opus):
    - [ ] этап — метка программы (`moduleIds` + `fromModuleId`), `stages` в ответе `get-course`;
    - [ ] «клиент спрашивает — курс разруливает», вердикт пререквизита `admitted`;
    - [ ] состав UC: переносимые, сливаемые методы фасада, удаляемые (9 команд, `get-course-program`, `resolve-content-path`);
    - [ ] порядок срезов, аддитивные Ф1–Ф2, план красной зоны Ф3–Ф4.
- [ ] Task: `dmg-tech-lead`: брифы `slices/module.md`, `slices/lesson-step.md` (Sonnet). Обязательно: способ получить роль и авторство для Policy видимости при субъекте `Identified` (сверка с `wish`/`stream`; если нужен `user` — вопрос Нурболату, D-41); список legacy-тестов на перенос; ID `rules.md`
- [ ] Task: orchestrator проверяет брифы (Opus). Вопросы перепроектирования — Нурболату
- [ ] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 0:**
- Базовая линия (pass/fail по командам) — в `summary.md`.
- Решения spec записаны в TR и `decisions.md`.
- Брифы `module` и `lesson-step` приняты; вопрос о роли в Policy закрыт или передан Нурболату.

## Фаза 1: Срез `module`

- [ ] Task: `dmg-test-designer`: характеризация на `../u7-school-v0.2.6` и red-тесты (Sonnet)
    - [ ] state `Module` (проекты — VO, `status`, `tags`) с `F.timestamp`, чтение дат без секунд;
    - [ ] DQS/Policy видимости: автор/админ видит всё, остальным — опубликованное (замена `#filterPublished`, DEBT-10);
    - [ ] UC `get-module`, `list-modules`; ошибки `MODULE_NOT_FOUND`, `MODULE_ACCESS_DENIED`;
    - [ ] репозиторий: legacy ISO → число, round-trip, невалидная запись;
    - [ ] перенос сценариев legacy-тестов `module` (список — в отчёте).
- [ ] Task: `migrator`, домен и прикладной слой (flash): Def, Ar без `#` и `throw*`, `UseCaseFromDef`, репозиторий через UoW со строгим разбором; `CourseModuleDef` пока с `external`
- [ ] Task: `dmg-data-keeper` (flash): чтение `data/courses/modules.json` (копия и `DB_DIR=./data/fixtures`), откат
- [ ] Task: `dmg-reviewer` (Opus). Замечания без `error` решает orchestrator (TR), перепроектирование — Нурболату
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 1:**
- `grep -rnE "throw[A-Z]|new [A-Za-z]*Ar\b|#[a-z]|@u7-scl/(core|app-legacy)"` по Def-файлам `module` пуст (legacy-файлы, удаляемые в Ф5, — исключение поимённо).
- `get-module`, `list-modules` — через `UseCaseFromDef`; маркера DEBT-10 в `module` нет.
- Тест репозитория читает legacy ISO и даты без секунд.
- `check` зелёный, тесты не ниже базовой линии, `git status data/` чист.

## Фаза 2: Срез `lesson` + `step` + снимок

- [ ] Task: `dmg-test-designer`: red-тесты (Sonnet)
    - [ ] агрегаты `lesson`, `step`; UC `get-lesson`, `get-step`, `get-steps-by-lessons`; видимость от модуля;
    - [ ] `GetModuleSnapshotUcDef` настоящим UC: снимок (`ContentSnapshotVo`, сборка — DQS вместо `CourseDs.buildSnapshot`) только из опубликованного;
    - [ ] перенос сценариев `content-snapshot*.test.ts`, `course-ds.test.ts`, `lesson/*`, `step/*` (список — в отчёте).
- [ ] Task: `migrator`, домен и прикладной слой (flash); адаптер `get-module-snapshot` заменён настоящим UC
- [ ] Task: `dmg-data-keeper` (flash): чтение `lessons.json`, `steps.json`
- [ ] Task: `dmg-reviewer` (Opus)
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 2:**
- Те же grep-критерии по `lesson`, `step`, снимку.
- В `get-module-snapshot.uc.ts` нет `legacy.`.
- Сценарии старых тестов перенесены (список в отчёте сверен).
- `check` зелёный, тесты не ниже базовой линии, `git status data/` чист.

## Фаза 3: Срез `course` — программа, этапы, `stream`, данные

- [ ] Task: `dmg-tech-lead`: бриф `slices/course.md` (Sonnet); приёмка — orchestrator (Opus)
- [ ] Task: `dmg-test-designer`: характеризация и red-тесты (Sonnet)
    - [ ] state: `moduleIds`, `phases: [{ title, track?, fromModuleId }]`, `F.timestamp`; инварианты меток (в программе, по порядку, первый — с первого модуля);
    - [ ] DQS «этапы курса» (`stages`), «место модуля», «предыдущий модуль»; курс без этапов, с одним, с несколькими;
    - [ ] UC `get-course` (со `stages`), `list-courses`, `get-course-by-module`, `get-module-place`; шесть внешних UC; вердикт `getModulePrerequisite` (`admitted`);
    - [ ] `stream`: правило `prerequisitePassed` и `EnrollStudentUc` на вердикте, `passedModuleIds` из пройденных потоков;
    - [ ] репозиторий `courses.json`: строгий новый формат, старый — ошибка.
- [ ] Task: `migrator`, домен и прикладной слой `course` (flash); адаптеры TR-11 сняты
- [ ] Task: `migrator`, клиент `stream` (flash): `student.rules.ts` на вердикте, `enroll-student` собирает `passedModuleIds`, `StreamAr.teachesModule` и его тест удалены, стенд `student-uc.fixture.ts`
- [ ] Task: `migrator`, тестовые миры (flash): `runners/u7-bot/tests/worlds/*` на новый формат, `bun run seed:fixtures`
- [ ] Task: Перевод `data/courses/courses.json` (только этот файл):
    - [ ] `bun run backup:adhoc course-dmg-phases --courses` (Opus);
    - [ ] `dmg-data-keeper` (flash): перевод «Fullstack JS» (`moduleIds` — 4 id, этап «Основы JS» с `fromModuleId` первого), round-trip, откат из бэкапа, дата без секунд;
    - [ ] отдельный коммит `courses.json` (Opus).
- [ ] Task: Записать красную зону в `debt.md`: поимённо legacy-UC курса, stories и тесты каталога/навигации, integration/e2e, тесты состава модуля; критерий снятия — конец Ф4 (Opus)
- [ ] Task: `dmg-reviewer` (Opus)
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 3:**
- grep-критерии домена по `course` пусты (кроме удаляемого legacy).
- `grep -rn "teachesModule" domain/src/stream modules/stream` пуст; `grep -rn "legacy\." modules/course/src/course` пуст.
- Курс без этапов валиден (тест); для курса с одним этапом `getModulePlace` совпадает с прежним.
- `courses.json` в новом формате, бэкап снят до перевода, в `git status data/` — только одобренный коммит.
- `check` зелёный, кроме поимённого списка красной зоны в `debt.md`.

## Фаза 4: UI

- [ ] Task: `dmg-tech-lead`: бриф `slices/ui.md` с «Сохраняемым поведением» (Sonnet); приёмка — Opus
- [ ] Task: `dmg-test-designer`: перевод тестов бота на Def-имена и red-тесты навигации по `stages` (курс без этапов / один / несколько) (Sonnet)
- [ ] Task: UI-stories (Sonnet): `courses/*` (`course-nav-resolver`, `course-catalog`, `wish-*`), `learning/*`, `streams/*`, `mentor/create-stream` — на `dispatchUc` и `stages`; `ui-spec.md`
- [ ] Task: Снять красную зону в `debt.md` (Opus)
- [ ] Task: `dmg-reviewer` (Opus)
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 4:**
- В `runners` нет вызовов legacy-имён UC курса через `appApi.execute` (с учётом многострочных) и чтения `phase.moduleIds`.
- Курс из одного этапа выглядит для пользователя как раньше (характеризация на `v0.2.6`).
- `check` целиком зелёный, `test:bot` и e2e не ниже базовой линии, красной зоны в `debt.md` нет.

## Фаза 5: Сборка и снятие legacy

- [ ] Task: Бриф `slices/assembly.md` (Opus, TR-45)
- [ ] Task: `migrator`, сборка (flash): `CourseModuleDef` без `external`, фабрика в `U7App`, `@u7-scl/course/**` — в ARC-07 `biome.json`
- [ ] Task: `migrator`, удаление legacy (flash): `api/*`, `module.ts`, `facade.ts`, `commands/*-cmd.ts`, `CourseInProcFacade`, `CourseApiModule`, legacy-репозитории, `content-path`, поля `courseModule`/`courseFacade` и тип `CourseLegacy` в `platform/app`
- [ ] Task: `migrator`, клиенты сборки (flash): `tests/helpers/test-app.ts`, `scripts/_app-factory.ts`, `scripts/{call-uc,domain-arch,stream-snapshot-sync,update-stream-snapshot,list-lessons,distribute-lesson,distribute-mentor}.ts`, тесты `u7-app` и `arch-check`
- [ ] Task: `dmg-data-keeper` (flash): скрипты `distribute-*`, `list-lessons` на `DB_DIR=./data/fixtures` — вывод совпадает с `v0.2.6`, запись — только через репозитории Def
- [ ] Task: `dmg-reviewer` (Opus)
- [ ] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 5:**
- `grep -rn "CourseApiModule\|CourseInProcFacade\|CourseFacade\|CourseLegacy" --include=*.ts .` пуст (вне `node_modules`).
- У `CourseModuleDef` нет `external`; `lint` (ARC-07) и `arch:check` зелёные.
- Маркеров DEBT-1, 2, 5, 10, 34, 44 и TR-11 (course) в коде нет.
- `check` зелёный, `git status data/` чист.

## Фаза 6: Итог

- [ ] Task: Гейт закрытия: `CI=true bun test`, `bun run test:bot`, `dmg-core` `bun test` — сравнение с базовой линией в `summary.md` (Opus)
- [ ] Task: Документы (Opus):
    - [ ] `debt.md` — снять DEBT-1, 2, 5, 10, 34, 44 (course), закрыть TR-11;
    - [ ] `course-module-history.md` — сверить §2 с итогом трека; `content-management.md` — пометка о новой модели этапов;
    - [ ] `migration.md` §6 — состояние, следующий трек `user`;
    - [ ] `deepseek.md` — сверка таблицы §2 с данными трека;
    - [ ] `summary.md` — таблица критериев spec и строка «DeepSeek».
- [ ] Task: Conductor - User Manual Verification 'Фаза 6' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 6:**
- Все критерии приёмки spec выполнены (таблица в `summary.md`).
- `arch:check` чист, `debt.md` и `migration.md` синхронны с кодом.
