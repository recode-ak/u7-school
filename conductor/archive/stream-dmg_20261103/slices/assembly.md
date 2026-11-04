# Срез `assembly` (Ф3): сборка `stream` и снятие legacy

Перенос без изменения поведения (strangler, роль `migrator`). Образец — `conductor/archive/peer-review-dmg_20261029/slices/assembly.md`. Все UC, ER и Job уже в Def-модуле (Ф1–Ф2); legacy остался пустой оболочкой.

## Состояние на старте (проверено orchestrator'ом)

- `StreamModuleDef` (`domain/src/stream/stream.module.ts`): `external` нет, `dependsOn: [UserModuleDef, CourseModuleDef]`. Задача 2 плана в части `external` — только сверка (тест `checkDefs` зелёный).
- Фабрика `createStreamModule` уже в `U7App.dmgApp` (`platform/app/src/u7-app.ts`), репозитории `StreamJsonRepo`/`StudentJsonRepo` (`modules/stream/src/infra/`) — **новые** (UoW, `VersionedRepository`, Ф1–Ф2), остаются.
- Уже удалены в Ф1–Ф2: `StreamFacade`, `StreamInProcFacade`, `streamLegacyInbound`, `commands/*-cmd.ts`, `stream-uc.ts`, legacy-репозитории. `grep` по этим именам — пусто.
- Осталось legacy: оболочка `StreamApiModule` (`modules/stream/src/api/`), `StreamApiModuleResolver`/`StreamApiModuleMeta` (`domain/src/stream/module.ts`, DEBT-2 — импорт `U7ModuleResolver` из `app-legacy`), поле `U7App.streamModule` и его потребители, legacy-entity `domain/src/stream/stream/entity.ts` и `student/entity.ts` (через `domain/src/stream/state.ts`) с потребителями в мирах и скриптах.

## Границы (что меняется)

| Файл | Действие |
|---|---|
| `modules/stream/src/api/` (`module.ts`, `module.test.ts`, `index.ts`) | удалить |
| `modules/stream/src/index.ts` | убрать `export * from './api'` |
| `domain/src/stream/module.ts` | удалить; убрать реэкспорт из `domain/src/stream/index.ts` |
| `platform/app/src/u7-app.ts` | убрать `StreamApiModule` (импорт, создание, место в `ApiApp`, поле `streamModule`) — как у `peer-review`/`wish` |
| `platform/app/src/u7-app-meta.ts` | убрать `StreamApiModuleMeta` из `U7BotAppMeta`; `u7-app.types.ts` — сверить, убрать упоминания `stream`, если есть |
| `platform/app/tests/u7-app.test.ts` | тест `getModule('stream')` → `undefined`; UC — через `dispatch(StreamModuleDef…)` (как в Ф3 `peer-review`) |
| `biome.json`, блок `platform/app/src/**` | ARC-07: группа `@u7-scl/stream/**` по образцу `@u7-scl/wish/**` |
| `runners/u7-bot/tests/helpers/test-app.ts` | убрать `streamModule`; если тестам нужен доступ к потоку — через `dispatch` Def-модуля или репозитории Def |
| `runners/u7-bot/tests/worlds/` (`builder.ts`, `types.ts`, `invariants.ts`, `materializer.test.ts`) | типы — из контракта/state Def (`StreamState`, `StudentState` из `@u7-scl/domain/stream`), а не legacy-entity |
| `scripts/update-stream-snapshot.ts`, `scripts/stream-snapshot-sync.ts` (+ тест) | типы — из state Def; запись в обход репозитория сохраняет `version` и числовые даты (`F.timestamp`), иначе строгий разбор `StreamJsonRepo`/`StudentJsonRepo` упадёт. Лучше — писать через репозиторий Def. Тест скрипта на это — обязателен |
| `domain/src/stream/stream/entity.ts`, `student/entity.ts`, их тесты, `state.ts` | удалить, если после правок выше потребителей нет (`grep`). Остались потребители вне границ — не удалять, перечислить в отчёте |
| `modules/stream/src/stream/uc/*.uc.test.ts`, `student/uc/student-uc.fixture.ts` | убрать упоминания `StreamApiModule`/legacy, если ссылаются |

**Не трогать:** `modules/stream/src/domain/index.ts` (barrel DEBT-3); `scripts/domain-check.ts` (DEBT-34 общий, снимается последним треком); `scripts/migrate-streams-school-id.ts` (разовая миграция, `U7_SCHOOL_ID` — не в границах); модули `user`, `course`, `questionnaire`; `dmg-core`; `data/`; `conductor/`. Нужна правка вне границ или контракта — эскалация.

## Сохраняемое поведение

Бот, UC и скрипты — без изменений: e2e бота и тесты `stream` зелёные, `test:bot` ≥ 1039 pass (конец Ф2), `bun test` ≥ 3970 pass за вычетом удалённых тестов оболочки (число удалённых — в отчёте). Скрипты читают и пишут те же файлы в формате, который читает строгий разбор Def.

## Сверка сценариев удалённых тестов

`modules/stream/src/api/module.test.ts`, тесты legacy-entity (`stream/entity.test.ts`, `student/entity.test.ts`) — перечисли сценарии и укажи, куда перенесены (тесты state Def, `*.state.test.ts`) или почему переносить нечего.

## Критерии приёмки

- `grep -rn "StreamApiModule\|StreamApiModuleResolver\|StreamInProcFacade\|streamLegacyInbound\|streamModule" --include=*.ts . --exclude-dir=node_modules` — пусто. (`StreamJsonRepo` остаётся — это новый репозиторий; критерий плана уточнён TR-45.)
- `domain/src/stream/**` не импортирует `@u7-scl/app-legacy` и `@u7-scl/core` (DEBT-2 в части stream — маркера нет).
- `scripts/update-stream-snapshot.ts` и `stream-snapshot-sync.ts`: импорты `@u7-scl/stream/domain` — только barrel DEBT-3 или контракт; тест на `version` и числовые даты зелёный.
- `@u7-scl/stream/**` в группе ARC-07 блока `platform/app/src/**`; `bun run lint` зелёный; `checkDefs` зелёный.
- `bun run check` зелёный; `bun run test:bot` ≥ 1039 pass; `git status data/` чист.

## Правила (ID)

ARC-07, MAN-06, D-36, D-45 (вход модуля — `contract`), D-53.

## Отчёт migrator (Ф3)

Удалены `modules/stream/src/api/` (оболочка, 2 теста), `domain/src/stream/module.ts`, legacy-entity `stream/entity.ts` и `student/entity.ts` с тестами (14 + 10 сценариев — уже в `stream.state.test.ts`, `student.state.test.ts`, `course/content-snapshot.test.ts`); `state.ts` — только `status`. `StreamApiModule`, `streamModule`, `StreamApiModuleMeta` убраны из `U7App`, `U7BotAppMeta`, `test-app.ts`; `u7-app.test.ts`: `getModule('stream')` — `undefined`. ARC-07-группа `@u7-scl/stream/**` в блоке `platform/app/src/**`. Миры (`builder`, `types`, `invariants`, `relative-time` — хелпер `utcMs`) — на `StreamState`/`StudentState`: числовые даты, `updatedAt`, `version: 0`; тексты инвариантов прежние (`isoMinute`). `stream-snapshot-sync.ts`: `parseStudentRows`/`writeStudentRows` — строгий разбор `StudentArDef.state`, запись с `version` и числами; `update-stream-snapshot.ts` студентов пишет через них, `streams.json` — правка только `contentSnapshot` в сыром JSON. +2 теста скрипта (файл после записи читает `StudentJsonRepo`; битая запись — исключение до записи).

**Отклонения:** типы в мирах — из barrel `@u7-scl/stream/domain` (DEBT-3): прямой `@u7-scl/domain/stream` — нарушение ARC-04, в контракте `StreamState`/`StudentState` нет. Устаревшие места DEBT-2 и DEBT-5 в `debt.md` сняты orchestrator'ом (`arch:check`).

**Итог (гейт orchestrator'а):** `check` зелёный, `bun test` 3946 pass / 0 fail (−24 сценария entity и −2 оболочки, +2 скрипта), `test:bot` 1039 pass (по отчёту), `data/` чист.

## Отчёт reviewer (Ф3)

8.5/10, `error` нет. Проверены grep-критерии, ARC-07, DEBT-2/5, миры (даты UTC через `utcMs`, инварианты, тексты), тесты скрипта (не ослаблены), отклонение barrel DEBT-3 (обосновано).

| ID | файл | суть | severity | решение |
|---|---|---|---|---|
| D-36 | `scripts/update-stream-snapshot.ts` | ошибка строгого разбора `students.json` гасится в `warn`, `streams.json` всё равно пишется | warn | к правке: отказ до записи + тест |
| TST-05 | `scripts/stream-snapshot-sync.test.ts` | «битая запись» — `toThrow()` без причины | info | к правке |
| D-36 | `update-stream-snapshot.ts` | `students.json` нормализуется целиком (все потоки) | info | ожидаемо (= первая запись репозитория); в справку скрипта |
| — | `update-stream-snapshot.ts` | `streams.json` — сырой JSON, `contentSnapshot` без `version`/`updatedAt` | info | TR-45 |
| ARC-04 | миры, скрипты | barrel DEBT-3 | info | принято |

## Отчёт data-keeper (Ф3)

Вердикт warn, блокеров нет. `streams.json` — ok (правится только `contentSnapshot`, репозиторий читает legacy). `students.json` — ok с оговорками: формат Def, `version` сохраняется; ключи вне схемы отбрасываются (как и у репозитория). Warn: тихий пропуск проверки дельты при сбое разбора (= warn ревью, к правке); гонка с ботом при перезаписи файла целиком — было и до diff, в справку. Бэкап перед `--sync-students` на живых данных — обязателен (`bun run backup`). Открытый вопрос: есть ли в живом `students.json` ключи вне схемы — проверка только чтением, с разрешения Нурболата.

## Правки по ревью (Ф3)

`readStudentRows` (`stream-snapshot-sync.ts`): нет файла — `[]`, сбой строгого разбора — `ValiError`; в `update-stream-snapshot.ts` `catch` с warn снят, отказ — exit 1 до записи `streams.json`. Тест «битая запись» — `toThrow(v.ValiError)`; новый тест отказа чтения. Справка — в шапке скрипта (бэкап, остановленный бот, формат Def, отказ до записи). Итог: `check` зелёный (3947 / 0), `test:bot` 1039 / 0, `data/` чист.

## Проверка живых данных (2026-11-04, с разрешения Нурболата)

Открытый вопрос `data-keeper` закрыт. Копии `kalki_server:/srv/u7-school/data/streams/{students,streams}.json` (только чтение, `scp` в scratchpad; сервер не менялся) разобраны схемами `StudentArDef.state` и `StreamArDef.state` с обходом вложенных объектов и массивов: `students.json` — 104 записи, `streams.json` — 9; все разобраны строгой схемой, ключей вне схемы нет (контроль: подложенный ключ обнаруживается). Первая запись репозитория или `--sync-students` полей не потеряет.
