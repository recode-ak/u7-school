# Бриф среза: `user` / резолвер `Caller` и Policy клиентов (Ф4)

> Черновик `dmg-tech-lead` (Sonnet), принят orchestrator с решениями ниже. Читать с `../spec.md`, `../plan.md` (Ф4), TR-61 (`conductor/architecture/debt.md`), `slices/user-app.md`, D-69/D-51 пакета `dmg-core`. Образец резолвера — `node_modules/dmg-core/src/testing/example/app/example-caller-resolver.ts`.

## Решения orchestrator

- **Фикстура субъекта (Р3) — общий хелпер владельца, Нурболат 2026-11-11.** Файл `domain/src/user/testing.ts`, импорт `@u7-scl/domain/user/testing` (рядом с `contract.ts`, тем же способом: подпуть `"./*/testing": "./src/*/testing.ts"` в `exports` `domain/package.json`, `testing` в `PUBLIC_SUBPATHS` `scripts/domain-check.ts`). Импорт `…/testing` разрешён только тестовому коду (`*.test.ts`, `*.fixture.ts`, `*.test-kit.ts`, `tests/**`, `testing.ts`) — проверка в `domain-check.ts` (+ тест) и/или `biome.json` (TST-07). Соглашение `<m>/testing.ts` — строка в `naming.md` (orchestrator). Локальные копии хелпера в клиентах не заводятся.
- **Р5 (двойное чтение в подменю)** — принято как мост до Ф5, запись в TR-61.
- **Р8 (`main.ts`)** — migrator читает файл: если `adminUser` нужен ниже (`botAdminUser`), `getUserByUuid` остаётся до Ф5, проверка роли — через субъект резолвера; отклонение — в отчёт.
- **Расхождение 1** — `U7CallerResolver` переписывается на месте; в plan.md Ф6 удаляется только legacy-зависимость резолвера, не класс.

## Расхождения plan/spec с кодом

1. Ф6 удаляет `U7CallerResolver`, а Ф4 его заменяет. Класс — тип в `platform/app/src/index.ts:4`, `u7-app.ts:65,83,171`, `runners/u7-bot/tests/helpers/test-app.ts`, `runners/u7-bot/src/core/u7-bot-app-meta.ts`. Решение: переписать на месте (имя и файл остаются).
2. «5 Policy» — 5 правил в 4 файлах: `stream.policy.ts` (2), `student.policy.ts` (1), `module.policy.ts` (1), `questionnaire.policy.ts` (1).
3. Субъект вводят и типы карт модулей `CourseUser` (`modules/course/src/course.module.ts:27`), `StreamUser` (`modules/stream/src/stream.module.ts:26`), `QuestionnaireUser` (`modules/questionnaire/src/questionnaire.module.ts:17`) = `Pick<User,'uuid'|'roles'>`; ~25 импортов.
4. `main.ts:149–160` — `app.userFacade.getUserByUuid` + `LegacyUserPolicy.isAdmin` (`BOT_ADMIN_UUID`).
5. `new UserCaller(`: 67 вхождений в 30 файлах; 3 уже на `UserAr`, 1 — резолвер, 1 — `wish.module.test.ts` (`Identified`, не трогать). Остаётся 62 в 26 файлах: фикстуры UC 12, `get-module-snapshot.uc.test.ts` 1, `platform/app/tests` 16, runners 33.
6. `Role` из `@u7-scl/domain/user/contract` вне `user` — 14 файлов (4 policy, 4 policy-теста, 4 UC-фикстуры, `controller.stream-group.test.ts`, `questionnaire-dmg.test-kit.ts`). `platform/app/tests` берут `Role` из `@u7-scl/app-legacy` (Ф6–Ф7).
7. `roles.some(` в `runners/u7-bot/tests/worlds/invariants.ts:91,133` — вне путей grep Ф4, legacy `Role` (Ф7).
8. `domain/src/user/contract.role.test.ts` — удаляется вместе с экспортом `Role`.

## Границы

**Меняется.**
- `platform/app/src/u7-caller-resolver.ts` и `.test.ts`, `u7-app.ts:171` (`userFacade` остаётся для legacy-потребителей до Ф5–Ф6).
- Policy: `domain/src/stream/stream/stream.policy.ts`, `domain/src/stream/student/student.policy.ts`, `domain/src/course/module/module.policy.ts`, `domain/src/questionnaire/questionnaire/questionnaire.policy.ts` и их `*.policy.test.ts`.
- Типы субъекта карт: `modules/{course,stream,questionnaire}/src/*.module.ts` (`= ReadonlyAr<UserAr>`, имена остаются).
- `domain/src/user/contract.ts` (снять `export { Role }`), удалить `domain/src/user/contract.role.test.ts`.
- Новое: `domain/src/user/testing.ts`, `domain/package.json` (`exports`), `scripts/domain-check.ts` (+ `.test.ts`), при необходимости `biome.json`.
- Фикстуры UC: `module-uc.fixture.ts`, `stream-uc.fixture.ts`, `student-uc.fixture.ts`, `questionnaire-uc.fixture.ts`, `get-module-snapshot.uc.test.ts:91`.
- Тесты и хелперы клиентов с `new UserCaller(<plain>)`, идущие в UC с Policy ролей (по красному прогону).
- `runners/u7-bot/src/controllers/mentor/stories/submenu.ts` (+ `submenu.test.ts`), `runners/u7-bot/src/core/u7-bot-ui-story.ts` (Р5), `runners/u7-bot/src/main.ts:149-160`, `controller.stream-group.test.ts`, `questionnaire-dmg.test-kit.ts` (убрать `Role`).

**Не трогать.** Stories и их актор `User` (Ф5), `ensure-registered`, legacy-UC, `UserInProcFacade`, `LegacyUserPolicy`, `LegacyUserJsonRepo`, `userFacade` в `U7App` (Ф6), barrel `@u7-scl/user/domain` и `invariants.ts` (Ф7), `data/`, `dmg-core`, `external: true`, `conductor/`. `user-notify.e2e.test.ts` — только если красный от Ф4 (умрёт в Ф5, С3).

## Решения брифа

**Р1. Резолвер** — `U7CallerResolver` в том же файле, по образцу `ExampleCallerResolver`. `constructor(private readonly api: Pick<ApiApp, 'dispatch'>)`; вызов от `SystemCaller` с `from: { kind: 'app', module: 'u7-app', name: 'resolveCaller' }` (D-51; `getUser` допускает `system`). Алгоритм:
- `uuid === undefined` → `GuestCaller`;
- `api.dispatch(UserModuleDef, GetUserUcDef.command({ uuid }), system, trace)`;
- `ok` → `new UserCaller(UserAr.restore(res.value))` (D-69: восстановление вне модуля — резолвер);
- `err` с кодом `UserErrors.NOT_FOUND.code` → `GuestCaller`;
- прочий `err` (не-uuid, `UNAUTHORIZED` и т. п.) → исключение (ERR-01).
Тип — `PersonCaller<ReadonlyAr<UserAr>>`; `trace` используется.

**Р2. Субъект Policy — структурный `Pick`**, как `UserSubject` в `domain/src/user/user/user.policy.ts`: `Pick<ReadonlyAr<UserAr>, 'uuid' | 'isMentor' | 'isAdmin'>` (по нужде правила); `UserAr` — `import type` из контракта. Правила — `subject.isMentor()` / `subject.isAdmin()`. В картах модулей — `ReadonlyAr<UserAr>` целиком.

**Р3. Фикстура субъекта** — `domain/src/user/testing.ts` (см. «Решения orchestrator»): `userSubject(init: { uuid: string; roles: UserView['roles'] } & Partial<UserView>): ReadonlyAr<UserAr>`, дефолты — как `stored()` в `domain/src/user/user/user.fixture.ts` (переиспользовать, не дублировать), `UserAr.restore`. JSDoc — кто и зачем (CODE-04). Клиенты: `new UserCaller(userSubject({ uuid, roles: ['MENTOR'] }))`; legacy-актор e2e — `userSubject({ uuid: mentor.uuid, roles: mentor.roles })`.

**Р4. Policy-тесты домена** — `who(uuid, ...roles)` через `userSubject`; ролевое правило проверяется сценариями «ментор потока / админ / чужой» (маппинг роль → `isAdmin()` покрыт `user.ar.test.ts`, TST-08).

**Р5. Субъект в UI.** В `U7BotUiStory` рядом с `#dispatchAs` — `protected async subjectOf(actor: User): Promise<ReadonlyAr<UserAr> | undefined>`: след тем же способом, что `dispatchUc` (общий приватный хелпер следа, без дубля), `this.resolve.callers.resolve(actor.uuid, trace)`, `caller.subject()` (у гостя — `undefined`). `SubmenuStory.#isMentor` → `async`, `isMentor() || isAdmin()`. Мост до Ф5.

**Р6. `Role` из контракта** снимается (`contract.ts:14`); `domain/src/user/user/roles.ts` остаётся. `contract.role.test.ts` удаляется; если picklist ролей не проверен в `user.state.test.ts` — одна проверка переезжает туда (TST-08).

**Р7. `tests/worlds/invariants.ts`** — Ф7.

**Р8. `main.ts`.** Проверка `BOT_ADMIN_UUID`: `app.callers.resolve(config.botAdminUuid, Trace.fromRequest({ requestId: crypto.randomUUID() }))`; не `UserCaller` → ошибка «не существует» (текст сохранить); `!subject.isAdmin()` → «нет роли ADMIN» (текст сохранить). Убрать `LegacyUserPolicy`; `getUserByUuid` — см. «Решения orchestrator».

## Шаги

1. **`dmg-test-designer` (Sonnet)** — red-тесты (D-55; не `data/`):
   - `domain/src/user/testing.ts` — тест хелпера не нужен сверх одного сценария «субъект с ролями отвечает `isMentor()`/`isAdmin()`»; тест проверки импортов `…/testing` в `scripts/domain-check.test.ts` (тестовый файл — можно, рабочий — ARC-04/TST-07);
   - `platform/app/src/u7-caller-resolver.test.ts`: известный → `UserCaller`, `subject()` — `UserAr` с ролями из записи (в т.ч. legacy ISO); неизвестный → гость; без uuid → гость; не-uuid → исключение; прочий `err` UC (подмена `api.dispatch`) → исключение;
   - Policy `stream`, `student`, `module`, `questionnaire` — субъект Р3;
   - UC-фикстуры клиентов — на хелпер, ожидания не меняются;
   - `submenu.test.ts`: MENTOR и ADMIN видят кнопку и входят, GUEST — нет, гость-актор — нет;
   - красный прогон → список падающих `new UserCaller(<plain>)` (в отчёт); непадающие (`wish`, `peer-review`) не трогать.
2. **`migrator` (flash)** — по Р1–Р8: (а) `testing.ts`, `exports`, проверка импортов; (б) Policy и типы субъекта карт; (в) резолвер и `u7-app.ts`; (г) `submenu.ts`, `u7-bot-ui-story.ts`, `main.ts`; (д) фикстуры и тесты клиентов по красному списку; (е) снятие `Role` из контракта, удаление `contract.role.test.ts`.
3. **`dmg-reviewer` (Opus).**

## Было → станет

| Было | Станет |
|---|---|
| `U7CallerResolver(users: Pick<UserFacade,'getUserByUuid'>)` → `UserCaller(<legacy User>)` | `U7CallerResolver(api)`, `dispatch` `getUser` от `SystemCaller` `kind:'app'`, `UserCaller(UserAr.restore(view))`; `NOT_FOUND` → гость; прочий `err` → исключение |
| `u7-app.ts:171` `new U7CallerResolver(userFacade)` | `new U7CallerResolver(apiApp)` |
| Policy: `subject.roles.includes(Role.X)`, субъект `Pick<User,'uuid'\|'roles'>` | `subject.isMentor()` / `isAdmin()`, субъект `Pick<ReadonlyAr<UserAr>, …>` |
| `CourseUser`/`StreamUser`/`QuestionnaireUser = Pick<User,…>` | `= ReadonlyAr<UserAr>` |
| `contract.ts`: `export { Role }` | снят; `contract.role.test.ts` удалён |
| `submenu.ts`: `actor.roles.includes(Role.MENTOR \|\| ADMIN)` | `await this.subjectOf(actor)` → `isMentor() \|\| isAdmin()` |
| `main.ts`: `getUserByUuid` + `LegacyUserPolicy.isAdmin` | `callers.resolve` + `subject.isAdmin()` |
| ~62 `new UserCaller(<plain>)` | `new UserCaller(userSubject({ uuid, roles }))` (только идущие в Policy ролей) |

## Сохраняемое поведение

- Нет uuid или пользователя → гость; сбой чтения (в т.ч. невалидный uuid) — исключение, не тихий гость.
- Права как в `../u7-school-v0.2.6` и текущем коде: поток создаёт `MENTOR` (админ без `MENTOR` — нет), управляют ментор потока или админ; модуль — админ или автор модуля; анкеты — админ, респондент, владелец списка. Тексты отказов не меняются.
- Подменю ментора (`u7-bot/src/controllers/mentor/stories/submenu.ts` эталона `../u7-school-v0.2.6`): доступ `MENTOR` или `ADMIN`; кнопка `priority: 30`; отказ «⚠️ У вас нет доступа к инструментам ментора\\.».
- Старт: тексты «BOT_ADMIN_UUID не найден…» / «…нет роли ADMIN», лог «Верификация бота пройдена: ADMIN подтверждён».
- Тесты состава: `contract.role.test.ts` (удаляется), `domain/src/user/user.module.test.ts`, `modules/user/src/user.module.test.ts` (не меняются), `scripts/domain-check.test.ts` (+ сценарии `testing`), `platform/app/tests/u7-app.test.ts` (`app.callers`).

## Внешние зависимости

- `dependsOn` `course`, `stream`, `questionnaire` уже содержат `UserModuleDef` — новых связей нет.
- Корень сборки берёт домен только через контракт (ARC-07); `UserAr.restore` в корне допустим (D-69).

## Правила (ID `rules.md`)

ARC-04, ARC-07, DOM-01, DOM-17, API-07, ERR-01, ERR-02, CODE-04, TST-04, TST-06, TST-07, TST-08, TST-09.

## Документы (orchestrator)

`naming.md` — соглашение `<m>/testing.ts`; `debt.md` — TR-61 (Ф4: хелпер, мост Р5), TR-33 и TR-40 к снятию; `plan.md` Ф6 — `U7CallerResolver` не удаляется.

## Критерии приёмки

- `grep -rn "roles.includes(Role\.\|roles.some(" domain/src modules runners/u7-bot/src` — пусто вне `user`.
- `grep -n "Role" domain/src/user/contract.ts` — пусто; `contract.role.test.ts` нет; `grep -rln "Role.*from '@u7-scl/domain/user/contract'" domain modules runners platform` — пусто.
- `grep -rn "getUserByUuid\|LegacyUserPolicy" platform/app/src/u7-caller-resolver.ts runners/u7-bot/src/controllers/mentor` — пусто; `LegacyUserPolicy` нет в `main.ts`.
- `@u7-scl/domain/user/testing` не импортируется рабочим кодом (проверка с тестом).
- Красный список шага 1 пуст после шага 2; `wish`/`peer-review` не тронуты.
- `bun run check` зелёный, тестов не меньше базовой линии с поправкой на удалённый `contract.role.test.ts`; `arch:check` синхронен; `git status data/` чист.

## Отчёты

### `dmg-test-designer` (Sonnet), шаг 1

Red-тесты: `domain/src/user/testing.test.ts`, `scripts/domain-check.test.ts` (подпуть `testing`), `platform/app/src/u7-caller-resolver.test.ts` (Р1, подмена `api.dispatch`), 4 `*.policy.test.ts` (субъект `userSubject`), `submenu.test.ts` (права — через `callers.resolve`); UC-фикстуры клиентов, `platform/app/tests/u7-app*.test.ts`, `view-stream.integration`, `user-notify.e2e` — на `userSubject`. Red: 3107 pass / 7 fail / 1 error. Эскалаций нет.

### `migrator` (flash), шаг 2

Р1–Р8 выполнены. Эскалация: платформенные `FileChecker`/`AssemblyChecker` не знали входа `testing` (10 нарушений `arch:check`) → решение Нурболата: вход `testing` в платформе, D-70 `dmg-core@d2128ce` (правка — Opus); проектная `checkTestingImports` удалена как дубль. Отклонения (приняты): `test-app.ts` — `apiApp: U7App['apiApp']`; `main.ts` без `getUserByUuid` (`adminUser` ниже не нужен); `Role` в `controller.stream-group.test.ts`, `questionnaire-dmg.test-kit.ts` — из `@u7-scl/user/domain` (legacy-актор `User`, учесть в Ф7); picklist ролей → `user.state.test.ts`; общий `requestTrace` в `runners/u7-bot/src/core/dispatch-uc.ts`; критерий `grep "Role" contract.ts` уточнён до `\bRole\b` (в контракте `AddRoleToUserUcDef`).

### `dmg-reviewer` (Opus)

`error` нет. Закрыто в срезе: TST-08 (warn) — матрицы ролей в `stream`/`questionnaire.policy.test.ts` сведены к сценариям правила, тест ролей `UserAr` в резолвере удалён (−7 тестов); мёртвая ветка `who` и дубли `type Role` в policy-тестах; CODE-04 — одна D-NN в JSDoc резолвера и `subjectOf`; meta `{ op: 'resolveCaller' }`. Принято (TR-61 «Ф4»): `requestTrace` берёт `requestId`/`correlationId` из `BotRequestContext` и в `#dispatchAsGuest` контроллера потоков (раньше — всегда новый id) — исправление сквозного следа; повтор `new UserCaller(userSubject(…))` в `user-notify.e2e` (файл уходит в Ф5); длина теста резолвера «от SystemCaller»; тест bare-спецификатора TST-07 в пакете — проверен вручную (`Bun.resolveSync`).
