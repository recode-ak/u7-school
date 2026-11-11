# Срез `assembly` (Ф5): сборка `course` и снятие legacy

Перенос без изменения поведения (strangler, роль `migrator`). Образцы — `conductor/archive/questionnaire-dmg_20261104/slices/assembly.md`, `conductor/archive/stream-dmg_20261103/slices/assembly.md`. Все UC курса уже в Def-модуле (Ф1–Ф3), бот — на `dispatchUc` (Ф4); legacy жива только в сборке `U7App`, тестовом хелпере бота, мирах и скриптах. Решения — TR-60.

## Состояние на старте (проверено orchestrator'ом, `bb07f4c1`)

- `CourseModuleDef` (`domain/src/course/course.module.ts`): **`external: true`** и устаревший JSDoc «внешний модуль… реализован legacy-кодом»; `dependsOn: [UserModuleDef]`, 16 UC, 4 агрегата.
- `U7App` (`platform/app/src/u7-app.ts`): фабрика `createCourseModule` с новыми `CourseJsonRepo`/`ModuleJsonRepo`/`LessonJsonRepo`/`StepJsonRepo` уже в `dmgApp`. Рядом — legacy: `Legacy{Course,Module,Lesson,Step}JsonRepo`, `CourseApiModule`, поле `courseModule`, `new ApiApp([userModule, courseModule])`, импорты `@u7-scl/course/api` и `@u7-scl/course/infra`. `U7BotAppMeta` (`u7-app-meta.ts`) — `CourseApiModuleMeta` из `@u7-scl/course/domain`. Полей `courseFacade` и типа `CourseLegacy` в `platform/app` уже нет.
- Рантайм бота (`runners/u7-bot/src/**`) legacy `course` не использует — только `@u7-scl/domain/course/contract`.
- Потребители legacy вне модуля:
  - `runners/u7-bot/tests/helpers/test-app.ts` — поля `courseModule: CourseApiModule`, `courseFacade: CourseInProcFacade` (других потребителей этих полей в тестах нет — сверь `grep`);
  - `runners/u7-bot/tests/worlds/{types,builder,invariants}.ts` — legacy-entity `Module`, `Lesson`, `Step`, `Project`, `CourseState`, `Status`, `CourseArDef`, `CourseProgramInvariant` из `@u7-scl/course/domain`;
  - `scripts/_app-factory.ts` — собирает legacy `ApiApp([userModule, CourseApiModule])` на `Legacy*JsonRepo`; им пользуются `list-lessons.ts`, `distribute-lesson.ts`, `update-stream-snapshot.ts` (`app.execute('list-modules' | 'get-module-snapshot' | 'get-lesson' | 'get-step', …)`);
  - `scripts/stream-snapshot-sync.ts` (+ тест), `update-stream-snapshot.ts` — тип `ContentSnapshot` из `@u7-scl/course/domain` (он есть в `@u7-scl/domain/course/contract`);
  - `scripts/call-uc.ts` — `course` вызывается legacy `apiApp.execute`; `DMG_MODULES` — без `course`;
  - `platform/app/tests/u7-app.test.ts:138` — `getModule('course')` равен `app.courseModule`;
  - `scripts/domain-arch.ts`, `scripts/distribute-mentor.ts` — legacy `course` не используют (сверить, без правок).
- Legacy в самом модуле (удаляется в шаге 2):
  - `modules/course/src/api/**` (`module.ts`, `course-uc.ts`, `index.ts`, UC и их тесты), `src/infra/course-in-proc-facade.ts` (+ тест), `src/infra/db/*-json-repo.ts` (`Legacy*JsonRepo`, + тесты); экспорты в `src/infra/index.ts`, `src/index.ts` (`export * from './api'`);
  - `domain/src/course/`: `module.ts` (DEBT-1, DEBT-2), `facade.ts`, `course-ds.ts` (+ тест), `content-path.ts` и `content-path/` (+ тест), `state.ts` (реэкспорт entity), `{course,lesson,module,step}/{a-root,entity,policy,repo}.ts` (+ тесты, DEBT-5, DEBT-10), `{course,lesson,module,step}/commands/**`; реэкспорты в `index.ts`;
  - `contract.ts` реэкспортирует legacy-типы ошибок `*UcError`/`CourseModuleError`/`LessonModuleError`/`StepModuleError` из `*/commands/errors.ts`;
  - `modules/course/package.json`: `exports["./api"]`, `imports` `#*-legacy/*`, зависимости `@u7-scl/app-legacy`, `@u7-scl/core`, `@u7-scl/user` (сверить, нужны ли новому коду); `tsconfig.json` (корень) — путь `@u7-scl/course/api`.
- `content-snapshot.ts` (`ContentSnapshotVo`) — **новый** код (контракт, `module-snapshot.dqs.ts`, `get-module-snapshot.uc.ts`), остаётся. `status.ts` используют и новые fixture-файлы — остаётся, если новому коду нужен (иначе удалить вместе с legacy).
- `@u7-scl/course/domain` (`modules/course/src/domain/index.ts`, barrel DEBT-3) — остаётся, после чистки реэкспортирует только Def-код домена.

## Шаг 1 — клиенты сборки (legacy ещё на месте, `check` зелёный)

| Файл | Действие |
|---|---|
| `domain/src/course/course.module.ts` | снять `external: true`; JSDoc — модуль на Def (по образцу `questionnaire.module.ts`) |
| `platform/app/src/u7-app.ts` | убрать legacy-репозитории, `CourseApiModule`, поле `courseModule`; `new ApiApp<U7BotAppMeta>([userModule])`; импорты `@u7-scl/course/api`, `@u7-scl/course/infra` → только вход `@u7-scl/course` (фабрика, новые репозитории и их типы — экспортировать из `modules/course/src/index.ts`, если ещё нет). JSDoc класса и `dmgApp` — `course` на своих репозиториях, не «внешний» |
| `platform/app/src/u7-app-meta.ts` | `moduleMetas: UserApiModuleMeta` (без `CourseApiModuleMeta`) |
| `biome.json`, блок `platform/app/src/**` | ARC-07: группа `@u7-scl/course/**` по образцу `@u7-scl/questionnaire/**` |
| `platform/app/tests/u7-app.test.ts` | `getModule('course')` → `undefined`; UC курса — через `dispatch` (если такой проверки нет — одна, по образцу соседних модулей) |
| `scripts/arch-check.test.ts` | в тест графа домена — `expect(external).not.toContain('course')` (как `questionnaire`) |
| `runners/u7-bot/tests/helpers/test-app.ts` | убрать поля `courseModule`, `courseFacade` и их импорты |
| `runners/u7-bot/tests/worlds/types.ts`, `builder.ts`, `invariants.ts` | legacy-entity → state-типы Def (`ModuleState`, `LessonState`, `StepState`, `CourseState`, `ProjectEntity`/VO проекта) из barrel `@u7-scl/course/domain`; `Status` — если остаётся (см. выше). Файлы миров на диске — **в том же виде** (материализатор пишет то же; новые репозитории читают его — тесты миров зелёные) |
| `scripts/_app-factory.ts` | **удалить**. Скрипты собирают `U7App` (как `call-uc.ts`), запросы — `app.apiApp.dispatch(CourseModuleDef, UseCaseDef.commandOf(<UcDef>, вход), caller, trace)`, субъект — `app.callers.resolve(NUR_UUID, trace)`. Общий для скриптов код (сборка `U7App` для скрипта, субъект админа, `dispatch` с разбором `Result`) — один модуль `scripts/_course-client.ts` (класс, не набор функций), без дублирования в трёх скриптах |
| `scripts/list-lessons.ts`, `distribute-lesson.ts`, `update-stream-snapshot.ts` | на `_course-client.ts`: `ListModulesUcDef`, `GetModuleSnapshotUcDef`, `GetLessonUcDef`, `GetStepUcDef`. Флаги, аргументы, `--help`, формат вывода и Telegram-отправка `distribute-lesson` — **без изменений**. JSDoc — без `Legacy*`, `CourseDs`, `CourseApiModule`. `update-stream-snapshot.ts` пишет `streams.json` как раньше (TR-45 — не трогать) |
| `scripts/stream-snapshot-sync.ts` (+ тест), `update-stream-snapshot.ts` | `ContentSnapshot` — из `@u7-scl/domain/course/contract` |
| `scripts/call-uc.ts` | `CourseModuleDef` — в `DMG_MODULES`; legacy `execute` — только `user`; справка и пример — по фактическому входу Def (например, `get-module '{"moduleId":"<uuid>"}'` — сверь с Def) |

**Каталог данных скриптов.** `U7App` пишет лог операций в `<dbDir>/oplog`. Проверь, пишет ли `dispatch` query в oplog: если да — в отчёт (скрипты только читают курсы; запуск в шаге 1 и у data-keeper — только с `DB_DIR=./data/fixtures`). Каталог по умолчанию — как было у скрипта (`DB_DIR`/`data`), не менять.

**Сохраняемое поведение шага 1.** Вывод `list-lessons`, `distribute-lesson --preview` (или режим без отправки — сверь флаги) и `update-stream-snapshot` (dry-run, если есть) на `DB_DIR=./data/fixtures` совпадает с выводом до шага (снять до правок в `/tmp`-копию вне `data/`, сравнить `diff`). Расхождение из-за формата нового UC (поля, даты, порядок, видимость) — не подгоняй вывод вручную, опиши в отчёте построчно. Нужного скрипту поля нет в выходе Def UC — эскалация.

## Шаг 2 — удаление legacy

| Что | Действие |
|---|---|
| `modules/course/src/api/` (весь каталог, с тестами) | удалить; `export * from './api'` из `src/index.ts` — убрать |
| `modules/course/src/infra/course-in-proc-facade.ts`, `src/infra/db/` (с тестами) | удалить; экспорты из `src/infra/index.ts` — убрать |
| `domain/src/course/`: `module.ts`, `facade.ts`, `course-ds.ts`, `content-path.ts`, `content-path/`, `state.ts`, `{course,lesson,module,step}/{a-root,entity,policy,repo}.ts`, `{course,lesson,module,step}/commands/` — с тестами | удалить; реэкспорты из `index.ts` — убрать |
| `domain/src/course/contract.ts` | реэкспорты `*/commands/errors.ts` убрать. Если потребители типов `*UcError` есть вне legacy — эскалация (не переносить молча); JSDoc контракта — без «паспорт внешнего модуля» и «legacy-фасад» |
| `domain/src/course/*/types.ts`, `status.ts`, `*.fixture.ts` | остаются, если ими пользуется Def-код или тесты Def; иначе — удалить, строкой в отчёт |
| `modules/course/package.json` | убрать `exports["./api"]`, `imports` `#*-legacy/*`, зависимости, ставшие ненужными (`grep` по `src/`); `bun install` — изменение `bun.lock` в отчёт |
| `tsconfig.json` (корень) | убрать путь `@u7-scl/course/api` |
| `domain/src/course/module/module.ar.test.ts:146`, `module-snapshot.dqs.ts:8`, `module-snapshot.dqs.test.ts:18`, `domain/src/stream/student-progress.dqs.ts:219` | комментарии со ссылкой на удалённый `CourseDs` — переформулировать без имени удалённого кода (смысл сохранить) |

**Сверка сценариев удалённых тестов.** Сценарии legacy-тестов перенесены в Ф1–Ф3 (списки — в отчётах `slices/module.md`, `lesson-step.md`, `course.md`). В отчёт — список удалённых тестовых файлов с числом `it` и для каждого файла одна строка «где покрыто» (путь до Def-теста или «удалённый UC, TR-59/spec»). Сценарий без покрытия — не удалять файл, эскалация.

## Не трогать

`modules/course/src/domain/index.ts` (barrel DEBT-3; только его содержимое меняется через `domain/src/course/index.ts`); `scripts/domain-check.ts` (DEBT-34 общий — снимает orchestrator в `debt.md`); модули `user`, `stream`, `wish`, `questionnaire`, `peer-review`, `dossier`; `runners/u7-bot/src/**`; `dmg-core`; `data/` (кроме чтения `data/fixtures`); `conductor/`; `node_modules/`. Не коммить. Нужна правка вне границ или контракта — эскалация.

## Критерии приёмки

- `grep -rn "CourseApiModule\|CourseInProcFacade\|CourseFacade\|CourseLegacy\|LegacyCourse\|LegacyModule\|LegacyLesson\|LegacyStep\|CourseDs\b\|ContentPath\|CmdMeta" --include=*.ts domain/src/course modules/course platform scripts runners` — пусто (кроме `scripts/*-check.test.ts`, где имена — фикстуры строк).
- У `CourseModuleDef` нет `external`; `arch-check.test.ts` это проверяет.
- `domain/src/course/**` не импортирует `@u7-scl/core` и `@u7-scl/app-legacy`; каталогов `commands/`, `content-path/`, файлов `entity.ts`, `a-root.ts`, `policy.ts`, `repo.ts`, `module.ts`, `facade.ts`, `course-ds.ts` нет.
- `grep -rnE "DEBT-(1|2|5|10|44)\b|TR-11\b" domain/src/course modules/course` — пусто.
- `@u7-scl/course/**` в группе ARC-07 блока `platform/app/src/**`; `bun run lint`, `arch:check` зелёные.
- `scripts/_app-factory.ts` нет; `list-lessons`, `distribute-lesson`, `update-stream-snapshot` на fixtures дают тот же вывод (или расхождения перечислены); `bun run scripts/call-uc.ts --help` показывает `course` среди DMG-модулей.
- `bun run check` зелёный; `bun test` — 4910 pass минус удалённые legacy-тесты (число — в отчёте); `bun run test:bot` ≥ 1097 pass; `git status data/` чист.

## Правила (ID)

ARC-04, ARC-07, ARC-09, MAN-06, D-36, D-45 (вход модуля — `contract`), D-49 (`dispatch`), D-50 (корень сборки), D-53.

## Готово (для исполнителя)

- Во время работы — узкие проверки: `bun test <файл>`, `bunx tsc --noEmit -p <пакет>`; полный `bun run scripts/agent-gate.ts` — один раз в конце шага.
- Тест кажется неверным — не правь, опиши в отчёте.
- **Не ослабляй типы ради компиляции** (`as unknown as`, расширение схем до `string`, `any`) — эскалация.
- Читай связанные файлы одним вызовом, не перечитывай уже прочитанное.

## Отчёт (формат)

Файлы (создано / изменено / удалено), отклонения от брифа с причиной, сверка сценариев (шаг 2), сравнение вывода скриптов (шаг 1), итог команд, эскалации.

## Отчёт migrator (Ф5)

**Шаг 1** — flash, `cd-F5-clients`, $0.26, 166 ходов. `external` снят (`course.module.test.ts` — проверка переведена, вне таблицы брифа), `U7App` без legacy, ARC-07 `@u7-scl/course/**`, миры на `ModuleState`/`LessonState`/`StepState`/`CourseState`/`ProjectEntity` (`invariants.ts` без правок), `_app-factory.ts` → класс `scripts/_course-client.ts`, `call-uc` — `course` в `DMG_MODULES`. В `distribute-lesson` `step.order ?? i + 1` → `i + 1` (поля `order` нет ни в legacy-схеме, ни в данных). Скрипты теперь читают курсы из `DB_DIR` (раньше фабрика его игнорировала). Вывод скриптов на одном стенде до/после — без расхождений. `dispatch` query пишет `<dbDir>/oplog`.
**Эскалация:** снятие `external` включает ARC-04/06 по живому legacy — `check` между шагами красный; решение — шаги подряд, общий коммит (TR-60).

**Шаг 2** — flash, `cd-F5-remove`, $0.09, 64 хода. Удалены 41 тестовый файл (350 `it`) с legacy-кодом; сверка сценариев — каждый файл указан с Def-тестом или «authoring/`content-path` удалены по spec, TR-52 (3)», непокрытых нет. Удалены также 5 `types.ts` и `module/get-visible-for.test.ts` (импорт удалённого `a-root`, сценарии — в `module.ar.test.ts`); `status.ts` и `*.fixture.ts` остаются. `bun test` 4910 → 4562.
**Эскалация:** устаревшие места DEBT-1, 2, 5, 10 в `debt.md` — сняты orchestrator'ом, DEBT-10 закрыт.

**Итог (гейт orchestrator'а, `bd13f3df`):** `check` зелёный, 4562 pass / 0 fail; `test:bot` 1097 / 0; `data/` чист.

## Отчёт dmg-data-keeper (Ф5)

flash, `cd-F5-data`, $0.05. Стенды-копии (fixtures-курсы и потоки, реальные пользователи) для текущей версии и `../u7-school-v0.2.6`: `list-lessons`, `distribute-lesson 1:1:1 --preview`, `update-stream-snapshot --dry-run` (3 потока) — diff пустой, коды выхода совпадают. `distribute-mentor` не запускался (нет режима без отправки в Telegram; курс не использует, diff — одна строка справки). Запись: `streams.json` сырым JSON — TR-45; `students.json` — через строгий разбор Def; oplog — до 143 записей / 134 КБ на полный `list-lessons`. Миграция и бэкап перед выкаткой не нужны. Вердикт — ок.

## Отчёт reviewer (Ф5)

Opus, 0 `error`.

| ID | файл | суть | severity | решение |
|---|---|---|---|---|
| ERR-01 | `scripts/_course-client.ts` | без `NUR_UUID` в `DB_DIR` скрипт молча работает гостем | warn | исправлено (`cd-F5-fix`): ошибка «гостевой субъект недопустим» |
| — | `scripts/update-stream-snapshot.ts` | снимок теперь от админа, а не анонимно | question | принято (TR-60) |
| — | `modules/course/package.json`, `tsconfig.json` | подпуть `./infra` без потребителей | info | убран |
| — | `scripts/_course-client.ts` | `NUR_UUID` дублируется в `call-uc` | info | одна константа |
| CODE-04 | `modules/course/src/index.ts`, `module-snapshot.dqs.ts`, `course.module.test.ts` | устаревшие и «исторические» комментарии | info | исправлено |
| — | `scripts/distribute-lesson.ts` | `--help`: слиты две строки | info | исправлено |
| TR-11 | `debt.md` | «Остаётся для `course`» | вне границ | снято orchestrator'ом |
| — | `TODO.md`, `modules/stream/src/analysis.md` | ссылки на удалённые имена | вне границ | `TODO.md` — переформулирован (flash); `analysis.md` — исторический разбор, оставлен |

**Итог после правок** (`cd-F5-fix`, flash, $0.04): `check` 4562 / 0, `data/` чист.
