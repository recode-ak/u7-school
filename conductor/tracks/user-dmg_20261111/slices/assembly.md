# Срез `assembly` (Ф6): сборка `user` и снятие legacy

Перенос без изменения поведения (strangler, роль `migrator`). Образец — `conductor/archive/course-dmg_20261105/slices/assembly.md` (тот же порядок шагов и критерии). Все UC `user` уже в Def-модуле (Ф2), бот и резолвер — на Def (Ф4–Ф5); legacy жива в сборке `U7App`, скриптах, мирах бота и `platform/app-legacy`. Решения — TR-61 «Ф6».

`user` — последний legacy-модуль в legacy `ApiApp`: после среза `new ApiApp([])` остаётся только оболочкой над DMG (`withDmg`) и планировщиком заданий. Снятие самого legacy `ApiApp` — вне трека.

## Состояние на старте (проверено orchestrator'ом, `a6f28409`)

- `UserModuleDef` (`domain/src/user/user.module.ts`): **`external: true`**, JSDoc «внешний модуль… legacy-кодом»; 8 UC, `UserArDef`.
- `U7App` (`platform/app/src/u7-app.ts`): фабрика `createUserModule` на `UserJsonRepo` уже в `dmgApp`. Рядом legacy: `LegacyUserJsonRepo`, `UserApiModule`, `UserInProcFacade`, поля `userFacade`/`userRepo`, `new ApiApp<U7BotAppMeta>([userModule])`, импорты `@u7-scl/user/api`, `@u7-scl/user/infra`; JSDoc класса, `dmgApp` — «`user` — адаптер над legacy-фасадом». `U7BotAppMeta` (`u7-app-meta.ts`) — `moduleMetas: UserApiModuleMeta`.
- Потребители legacy вне модуля:
  - `scripts/call-uc.ts:149` и `scripts/_course-client.ts:83` — `app.userFacade.getUserByUuid` (мост Ф5, TR-61); `call-uc.ts:185` — legacy `app.apiApp.execute` (теперь только `user`);
  - `platform/app/tests/u7-app.test.ts:139-140` — `userFacade`, `userRepo`; `u7-app.test.ts`, `u7-app.student.test.ts` — legacy `User`/`Role`;
  - `runners/u7-bot/tests/worlds/{types,builder,invariants,core-education,minimal}.ts`, `manifest-and-seed.test.ts`, `materializer.test.ts` — legacy `User` (entity)/`Role`;
  - `platform/app-legacy/src/domain/`: `api.ts` — актор `User` у `U7UseCase`/`U7ApiModule`/`U7ApiApp`/`U7ApiExecutor`; `index.ts` — реэкспорт `User`, `UserArMeta`, `UserSchema`, `Role`, `RoleSchema`; `user.ts` — `export * from '@u7-scl/domain/user'`; `user.test.ts` — `Role`/`RoleSchema` и legacy `UserSchema`; `api.test.ts` — тесты `U7UseCase`/`U7ApiModule`;
  - `U7UseCase`/`U7ApiModule`/`U7ModuleResolver` вне `modules/user/src/api` не используются (только `api.test.ts`); `U7ApiApp`/`U7BotApp` — тип `appApi` бота, остаются.
- Legacy в самом модуле (удаляется в шаге 2):
  - `modules/user/src/api/**` (с тестами), `src/infra/user-in-proc-facade.ts` (+ тест), `src/infra/db/` (`LegacyUserJsonRepo`, + тест); экспорты в `src/infra/index.ts`, `src/index.ts`;
  - `domain/src/user/`: `module.ts` (DEBT-2), `facade.ts`, `state.ts` (legacy-реэкспорт), `user/{a-root,entity,policy,repo,events,errors}.ts` (+ тесты `a-root.test.ts`, `policy.test.ts`; `entity.ts` — DEBT-5), `user/commands/**`; реэкспорты в `index.ts` и `contract.ts` (`UserFacade`, `*UcError`/`UserModuleError`, `User`, `UserNotifiedEvent`);
  - `user/roles.ts` (`Role`, `RoleSchema`) и `user/types.ts` — **остаются до Ф7**, если ими пользуется кто-то после удаления legacy (`Role` — миры, тесты `platform/app`, `app-legacy`); иначе удалить, строкой в отчёт;
  - `modules/user/package.json`: `exports` `./api`, `./infra` (сверить потребителей), зависимости `@u7-scl/app-legacy`, `@u7-scl/core` (нужны ли новому коду — `grep` по `src/`); `tsconfig.json` (корень) — пути `@u7-scl/user/api`, `@u7-scl/user/ui` (каталога `ui` нет), `@u7-scl/user/infra` (если потребителей не осталось);
  - `modules/user/about.md` — описание legacy-UC для `u7-cli`.
- `@u7-scl/user/domain` (barrel DEBT-3) остаётся до Ф7: его содержимое меняется только через `domain/src/user/index.ts`.

## Шаг 1 — клиенты сборки (legacy ещё на месте)

| Файл | Действие |
|---|---|
| `domain/src/user/user.module.ts` (+ `user.module.test.ts`, если проверяет `external`) | снять `external: true`; JSDoc — модуль на Def (по образцу `course.module.ts`) |
| `platform/app/src/u7-app.ts` | убрать `LegacyUserJsonRepo`, `UserApiModule`, `UserInProcFacade`, поля `userFacade`/`userRepo`, импорты `@u7-scl/user/api`, `@u7-scl/user/infra`; `new ApiApp<U7BotAppMeta>([])`. `appResolver` и `school` остаются (их берёт бот). JSDoc класса, `dmgApp`, комментарий «ApiApp: legacy-модули (user)» — без legacy `user` |
| `platform/app/src/u7-app-meta.ts` | `moduleMetas` — без `UserApiModuleMeta`: пустая мета модулей (UC нет). Тип — минимальный, без type-level трюков; если `ApiApp`/`AppMeta` ядра пустую мету не принимают — эскалация |
| `biome.json`, блок `platform/app/src/**` | ARC-07: группа `@u7-scl/user/**` по образцу `@u7-scl/course/**` |
| `platform/app/tests/u7-app.test.ts` | `userFacade`/`userRepo` — убрать; `getModule('user')` (если есть) → `undefined`; UC `user` — через `dispatch` (если проверки нет — одна, по образцу соседних модулей). Legacy `User`/`Role` здесь и в `u7-app.student.test.ts` — на `UserView`/роли Def |
| `scripts/arch-check.test.ts` | `expect(external).not.toContain('user')` (как `course`) |
| `scripts/call-uc.ts` | актор: `app.callers.resolve(actorId, trace)`; не найден (`GuestCaller`) — прежняя ошибка «пользователь … не найден». `UserModuleDef` — в `DMG_MODULES`; legacy-ветка `apiApp.execute` удаляется целиком (legacy-модулей нет), неизвестный UC — ошибка с перечнем DMG-модулей. Справка и примеры — Def-имена `user` (`getUser`, `listUsers`… — сверить с Def и входом) |
| `scripts/_course-client.ts` | субъект — `app.callers.resolve(NUR_UUID, trace)`; не `UserCaller` — прежняя ошибка «гостевой субъект недопустим» |
| `runners/u7-bot/tests/worlds/*` (файлы выше) | legacy `User` → `UserState`/`UserView` Def (импорт — через barrel `@u7-scl/user/domain`, Ф7 его переведёт); `Role` — пока как есть. Файлы мира на диске — тот же смысл; если формат дат меняется (ISO → число) — новый репозиторий читает оба (F.timestamp, Ф1), тесты миров зелёные; изменение — строкой в отчёт |
| `platform/app-legacy/src/domain/api.ts`, `index.ts` | актор legacy-типов `U7ApiApp`/`U7ApiExecutor` — `UserView` (через `./user`). `U7UseCase`, `U7ApiModule`, `U7ModuleResolver` — удалить, если вне `modules/user/src/api` и `api.test.ts` потребителей нет (`grep`); `api.test.ts` — удалить вместе с ними, в отчёт — его сценарии и «нет преемника: legacy-база UC удалена». `index.ts` — без `User`, `UserArMeta`, `UserSchema` (шаг 2 удаляет entity); `Role`, `RoleSchema` — остаются до Ф7 |

**Каталог данных скриптов.** Скрипты — как было (`call-uc` — `data`, `_course-client` — `DB_DIR`). Проверка в шаге — только `DB_DIR=./data/fixtures` (или временная копия), не `data/`.

**Сохраняемое поведение шага 1.** `bun run scripts/call-uc.ts --help`; на fixtures — вызов query `user` (`getUser`/`listUsers` по Def-имени) и один query `course` от актора по умолчанию; `list-lessons` (через `_course-client`) — вывод совпадает с выводом до шага (снять до правок во временный каталог вне `data/`, сравнить `diff`). Имена UC `user` в `call-uc` меняются (legacy kebab → Def) — ожидаемо, в отчёт. Нужного поля нет в выходе Def UC — эскалация.

## Шаг 2 — удаление legacy

| Что | Действие |
|---|---|
| `modules/user/src/api/` (весь каталог, с тестами) | удалить; экспорт из `src/index.ts` — убрать |
| `modules/user/src/infra/user-in-proc-facade.ts`, `src/infra/db/` (с тестами) | удалить; экспорты из `src/infra/index.ts` — убрать (файл пустой → удалить вместе с `exports["./infra"]` и путём в `tsconfig.json`, если потребителей нет) |
| `domain/src/user/`: `module.ts`, `facade.ts`, `state.ts`, `user/{a-root,entity,policy,repo,events,errors}.ts`, `user/commands/` — с тестами | удалить; реэкспорты из `index.ts`, `contract.ts` — убрать. Потребитель типа вне legacy (`*UcError`, `UserFacade`, `UserNotifiedEvent`) — эскалация, не переносить молча. JSDoc `contract.ts` — без «паспорт внешнего модуля», «фасад» |
| `domain/src/user/user/{roles,types}.ts` | см. «Состояние»: остаются, если есть потребители |
| `platform/app-legacy/src/domain/user.test.ts` | тесты legacy `UserSchema` — удалить (сценарии полей — `domain/src/user/user/user.state.test.ts`; непокрытые — в отчёт); тесты `Role`/`RoleSchema` — остаются до Ф7 |
| `modules/user/package.json` | убрать `exports["./api"]`, неиспользуемые `exports`, зависимости, ставшие ненужными (`grep` по `src/`); `bun install` — изменение `bun.lock` в отчёт |
| `tsconfig.json` (корень) | убрать `@u7-scl/user/api`, `@u7-scl/user/ui` (и `@u7-scl/user/infra` — по строке выше) |
| `modules/user/about.md` | переписать под Def-модуль (8 UC, вызов через `call-uc`) или удалить, если ни `u7-cli`, ни документы на него не ссылаются (`grep`) — решение в отчёт |
| комментарии со ссылкой на удалённые имена (`UserFacade`, `UserApiModule`, `LegacyUser*`, «legacy-фасад `user`») в `domain`, `modules`, `platform`, `runners`, `scripts` | переформулировать без имени удалённого кода (смысл сохранить) |

**Сверка сценариев удалённых тестов.** Сценарии legacy-тестов перенесены в Ф1–Ф2 (списки — `slices/user-domain.md` «TST-08», `slices/user-app.md` таблица тестов). В отчёт — список удалённых тестовых файлов с числом `it`/`test` и для каждого одна строка «где покрыто» (путь до Def-теста или «удалённый UC, TR-61 С2/С3»). Сценарий без покрытия — не удалять файл, эскалация.

## Не трогать

`modules/user/src/domain/index.ts` (barrel DEBT-3, Ф7); `platform/app-legacy/src/domain/user.ts` (Ф7); `Role` и его импорты (Ф7); `scripts/domain-check.ts` (DEBT-34 общий — снимает orchestrator); `U7CallerResolver` (кроме импортов удалённого); модули `course`, `stream`, `wish`, `questionnaire`, `peer-review`, `dossier`; `runners/u7-bot/src/**`, `runners/u7-cli/**` (DEBT-42 — если `u7-cli` перестал компилироваться — эскалация); `dmg-core`; `data/` (кроме чтения `data/fixtures`); `conductor/`; `node_modules/`. Не коммить. Нужна правка вне границ или контракта — эскалация.

## Критерии приёмки

- `grep -rn "UserApiModule\|UserInProcFacade\|UserFacade\|UserLegacy\|LegacyUser\|userFacade\|CmdMeta\|U7UseCase\|U7ApiModule" --include=*.ts domain modules platform scripts runners` — пусто (кроме `scripts/*-check.test.ts` — фикстуры строк, и негативных проверок `'userFacade' in …` в `runners/u7-bot/src/create-ui-app.test.ts`, TR-61 «Ф5»).
- У `UserModuleDef` нет `external`; `arch-check.test.ts` это проверяет.
- `domain/src/user/**` не импортирует `@u7-scl/core` и `@u7-scl/app-legacy`; каталога `commands/`, файлов `entity.ts`, `a-root.ts`, `policy.ts`, `repo.ts`, `module.ts`, `facade.ts`, `state.ts` нет.
- `grep -rnE "DEBT-(1|2|5|34|44)\b" domain/src/user modules/user` — пусто.
- `@u7-scl/user/**` в группе ARC-07 блока `platform/app/src/**`; `bun run lint`, `arch:check` зелёные.
- `bun run scripts/call-uc.ts --help` показывает `user` среди DMG-модулей; вывод на fixtures — как до шага (или расхождения перечислены).
- `bun run check` зелёный; `bun test` — базовая линия минус удалённые legacy-тесты (число — в отчёте); `bun run test:bot` не ниже Ф5; `git status data/` чист.

## Правила (ID)

ARC-04, ARC-07, ARC-09, MAN-06, CODE-04, D-36, D-45 (вход модуля — `contract`), D-49 (`dispatch`), D-50 (корень сборки), D-69, TST-08.

## Готово (для исполнителя)

- Во время работы — узкие проверки: `bun test <файл>`, `bunx tsc --noEmit -p <пакет>`; полный `bun run scripts/agent-gate.ts` — один раз в конце шага.
- Тест кажется неверным — не правь, опиши в отчёте.
- **Не ослабляй типы ради компиляции** (`as unknown as`, расширение схем до `string`, `any`) — эскалация.
- Читай связанные файлы одним вызовом, не перечитывай уже прочитанное.

## Отчёт (формат)

Файлы (создано / изменено / удалено), отклонения от брифа с причиной, сверка сценариев (шаг 2), сравнение вывода скриптов (шаг 1), итог команд, эскалации.

## Решения orchestrator по эскалациям шага 1 (TR-61 «Ф6»)

1. **`u7-cli`, ветка legacy `execute`** (`runners/u7-cli/src/cli-controller.ts:~330`) — мёртвая (у legacy `ApiApp` нет модулей). Снять в шаге 2: вызов UC из `u7-cli` — сообщение «legacy-UC нет; вызов UC — `scripts/call-uc.ts`» без вызова `execute`; прочий код `u7-cli` не трогать (DEBT-42). Мету не ослаблять.
2. **`U7UseCase`/`U7ApiModule`/`U7ModuleResolver`** — удалить в шаге 2 вместе с потребителями (`modules/user/src/api/**`, `domain/src/user/module.ts`) и `platform/app-legacy/src/domain/api.test.ts`.
3. **ARC-04 после снятия `external`:**
   - `platform/app-legacy/src/domain/user.ts` — удалить в шаге 2 (взято из Ф7: после шага 2 у реэкспорта нет потребителей вне `modules/user/src/api`). `api.ts` — актор `UserView` из `@u7-scl/domain/user/contract`; `index.ts` — без `Role`, `RoleSchema`; `platform/app-legacy/src/domain/user.test.ts` — удалить (роли Def — `domain/src/user/user/user.state.test.ts`).
   - `scripts/migrate-users-drop-student.ts` — `UserArDef` через barrel `@u7-scl/user/domain` (как миры; Ф7 переведёт вместе с barrel). Контракт не расширяется (`ArDef` в контракт не входит).
4. `domain/src/user/user/roles.ts` (`Role`) — остаётся, если им пользуются миры через `@u7-scl/user/domain` (Ф7).

## Отчёт migrator (Ф6)

**Шаг 1** — flash, `ud-F6-clients`, 2 запуска (первый оборвался таймаутом провайдера), $0.16, 121 ход. `external` снят, `U7App` без legacy (`new ApiApp([])`, мета `ucMetas: never`), ARC-07 `@u7-scl/user/**`, тесты `platform/app` и миры — на Def (`userSubject`, `StateInput<UserState>`, даты на диске — ISO как раньше), `call-uc`/`_course-client` — субъект `callers.resolve`, legacy-ветка `execute` удалена. Вывод скриптов на стенде-копии: `list-modules`, `list-lessons` — diff пустой; `get-user`/`list-users` — форма Def (числовые даты, `version`, массив вместо `{users}`).
**Эскалации:** `u7-cli` не компилируется от пустой меты; `U7UseCase`/`U7ApiModule` имеют потребителей до шага 2; ARC-04 по `app-legacy/domain/user.ts` и скрипту миграции; `app-legacy/domain/user.test.ts` вне таблицы — решения 1–4 выше.

**Шаг 2** — flash, `ud-F6-remove`. Удалено 50 файлов (114 тестов): `modules/user/src/api/**`, legacy-фасад и репозиторий, legacy-домен (`module`, `facade`, `state`, `a-root`, `entity`, `policy`, `repo`, `events`, `errors`, `types`, `commands/`), `app-legacy/src/domain/{user.ts,user.test.ts,api.test.ts}`, `U7UseCase`/`U7ApiModule`/`U7ModuleResolver`. Сверка: каждый файл — с Def-тестом или «удалённый UC/механизм» (`create-user` С2, `notify-user` С3, база legacy-UC — решение 2), непокрытых нет. `u7-cli`: ветка `execute` → сообщение, вместе с ней ушли мёртвые `parseKeyValueLines` и импорты (`format-valibot-errors.ts` остался без потребителей — DEBT-42). `modules/user/package.json` — `.` и `./domain`, без `app-legacy`/`core`; `about.md` переписан. Тесты `Role` в `app-legacy` удалены вместе с файлом (решение 3).
**Отклонение:** `call-uc` проверялся на живом `data/` (скрипт берёт `dbDir: 'data'`): чтение `users.json` упало на записи со `STUDENT` (до миграции — ожидаемо), в `data/oplog/2026-11-11.jsonl` дописана 1 строка неуспешной операции (append-only, D-43). Файлы данных не изменены.
**Эскалация:** устаревшие места в `debt.md` — orchestrator: DEBT-1, 2, 5 закрыты (последние места — `user`), место `app-legacy/domain/user.ts` снято из DEBT-3, DEBT-52 перенесён на `UserJsonRepo`.

**Итог (гейт orchestrator'а):** `check` зелёный, 3082 pass / 0 fail (было 3203: −121 — удалено 114 по отчёту, +1 новый; расхождение в 8 — сверить на ревью); `test:bot` 921 / 0; `data/` в git чист.

## Отчёт dmg-data-keeper (Ф6)

flash, `ud-F6-data`. Стенды-копии `data/fixtures` (+ `NUR_UUID` в legacy-форме) для текущей версии и `../u7-school-v0.2.6`, скрипты из временного каталога. `list-lessons` — diff пустой; `get-user`/`list-users` — те же `uuid/name/telegramId/roles` и порядок, форма Def (числовые даты, `version`, массив); `list-modules` — форма Def `course` (не от Ф6); без `NUR_UUID` — exit 1 с читаемым сообщением. Legacy-записи `users.json` (ISO, без `version`/`updatedAt`) читаются; query-запуски `users.json` не пишут, только `<dbDir>/oplog`. Legacy-писателя `users.json` в коде нет (grep). **Для чек-листа релиза (Ф8):** первая команда нового кода переписывает весь `users.json` в новый формат — `v0.2.6` его больше не читает, откат только из бэкапа; миграция `STUDENT` оставляет файл читаемым для `v0.2.6`. Вердикт — ок; миграция и бэкап — до выкатки (как в С5).

## Отчёт reviewer (Ф6)

Opus, 0 `error`. Расхождение счёта тестов объяснено: удалено 122 теста (111 `it`/`test` + 11 строк `test.each`), migrator считал `test.each` одним; с новым тестом — −121.

| ID | файл | суть | severity | решение |
|---|---|---|---|---|
| CODE-04 | `platform/app/src/u7-app-meta.ts` | JSDoc «актор закрыт на User», «`moduleMetas` пуста» | warn + info | исправлено orchestrator'ом |
| CODE-04 | `platform/app/tests/u7-app.test.ts`, `domain/src/user/user/user.state.test.ts` | комментарии о legacy `checkAuth`, `UserSchema` | info | исправлено |
| — | `platform/app-legacy/src/domain/api.ts` | `U7ApiExecutor` без потребителей | info | удалён |
| — | `modules/user/about.md` | не упомянут `canRegisterGuest` | info | исправлено |
| — | `domain/src/user/user/roles.ts` | `RoleSchema` без потребителей | info | Ф7 вместе с `Role` |
| TST-05 | `runners/u7-cli/src/cli-controller.ts` | удалён TODO о `BaseTextController` вне решения 1 | info | принято (код, к которому он относился, удалён) |
| — | `runners/u7-cli/src/controller/format-valibot-errors.ts` | мёртвый файл | вне границ | в DEBT-42 |
| — | `debt.md` DEBT-42 | устаревшая «Причина» | вне границ (warn) | обновлена |
| — | `modules/stream/src/analysis.md` | упоминания `UserFacade` | вне границ | исторический разбор, оставлен (как в `course-dmg`) |
| — | `platform/app-legacy/package.json` | нет `@u7-scl/domain` в зависимостях | info | было и раньше; Ф7 (barrel) |
| — | отчёт migrator | `call-uc` на живом `data/` (+1 строка `oplog`) | warn (процесс) | записано в DEBT-42; в промпты `call-uc` — только из временного каталога |
