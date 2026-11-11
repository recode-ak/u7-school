# Бриф среза: `user` / домен (Ф1)

> **Статус:** принят orchestrator (Ф0). Решения С1–С5 (Нурболат) и Т1–Т17 — TR-61 (`conductor/architecture/debt.md`); полный разбор — `../summary.md` → «Ф0: вопросы». Где текст ниже расходится с TR-61 — прав TR-61 и раздел «Решения Ф0» в конце брифа.

Черновик — `dmg-tech-lead`, Ф0; проверка — orchestrator. Читать вместе с `../spec.md`, `../plan.md` (Ф1), `../slices/user-app.md`, D-37, D-45, D-53, D-64, TR-40, эталоном `wish` (`domain/src/wish`) и образцом формы `conductor/archive/course-dmg_20261105/slices/module.md`.

Код `user` в `../u7-school-v0.2.6` (пакет `user` релиза) совпадает с HEAD по логике (`diff` для `a-root.ts`, `policy.ts`, `register-guest-uc.ts`, `add-role-to-user-uc.ts`, `user-json-repo.ts`, `user-in-proc-facade.ts` — только импорты и удалённые `isStudent`/`isSubscriber`/`isGuest`). Характеризация строится на текущих тестах и логике `a-root.ts` как ожиданиях нового кода.

## Расхождения spec/plan с кодом

(пп. 1, 2, 5, 6, 11, 12, 14 сводки; для Ф1 существенны:)
1. Grep `new [A-Za-z]*Ar\b` ловит `new UserAr(` внутри собственной фабрики; критерий — с исключением собственного класса.
2. `UserPolicy.isStudent` в HEAD нет.
3. ~~`domain/src/shared` ломает `checkDomainDirs`; тип субъекта — в `contract.ts`~~ — снято: субъект `Caller` — `ReadonlyAr<UserAr>` из контракта (D-69, TR-61 С1), `AppUser` и `shared` не заводятся.
4. Новые имена `UserAr`, `UserPolicy`, `UserRepo` занимают имена legacy (`domain/src/user/index.ts:4,67,68`, `module.ts:13,35`): нужен шаг S0.

## Границы

**Домен `domain/src/user`.**
- Новое: `user/user.state.ts` (`UserState`, `UserView` не здесь), `user/user.errors.ts`, `user/user.policy.ts`, `user/user.rules.ts`, `user/user.fixture.ts`, `user/uc/{get-user,get-user-by-telegram-id,get-users-by-ids,list-users,register-guest,add-role-to-user,remove-role-from-user}.uc.ts` (только Def, без регистрации в `UserModuleDef` — Р7), тесты рядом: `user.state.test.ts`, `user.ar.test.ts`, `user.policy.test.ts`, `user.rules.test.ts`.
- Изменяется: `user/user.ar.ts` (заглушка `UserArDef` → полный Def + `UserAr`), `state.ts`, `contract.ts` (+ `UserView`, `UserErrors`, `UserAr` с JSDoc «субъект `Caller`, Policy клиентов», D-69), `index.ts` (экспорты нового; legacy под `Legacy*`), `user.module.test.ts`.
- Шаг S0 (переименование legacy): `user/a-root.ts` (`UserAr` → `LegacyUserAr`), `user/policy.ts` (`UserPolicy` → `LegacyUserPolicy`), `user/repo.ts` (`UserRepo` → `LegacyUserRepo`; `UserListFilter` не трогать — конфликта нет), и все ссылки: `index.ts:4,67,68`, `module.ts:13,35`, `a-root.test.ts`, `policy.test.ts`.

**Вне домена (только механика S0 — подмена импортов, логика не меняется).**
- `modules/user/src/infra/db/user-json-repo.ts` (+ тест) — `UserJsonRepo` → `LegacyUserJsonRepo`, `implements LegacyUserRepo`; `infra/index.ts:2`;
- `modules/user/src/api/user/*.ts` (9 UC) и их тесты: `UserAr`, `UserPolicy`, `UserRepo`, `UserJsonRepo`, `api/module.test.ts`;
- `platform/app/src/u7-app.ts:51,80,107` — импорт и тип поля `userRepo`;
- `runners/u7-bot/src/main.ts:14,155` — `UserPolicy` → `LegacyUserPolicy`.

**Не трогать:** `data/`; Policy клиентов (`course`, `stream`, `questionnaire` — Ф4); stories и UI; `contract.role.test.ts` и `Role` (Ф3–Ф4); `modules/user/src/user/uc/get-telegram-addresses.uc.ts` и `user.module.ts` (Ф2); `external: true` (Ф6); `dmg-core`; `biome.json`.

## Решения брифа

**Р1. Состояние (`user.state.ts`)** по образцу `domain/src/stream/stream/stream.state.ts`.
- `UserState = v.object({ ...BaseEntityFields, name, telegramId, roles, nick? })`.
- `name`: `v.pipe(v.string(), v.description(...), v.transform(trim), v.nonEmpty(...))` (описание до `transform`).
- `telegramId`: `F.int(...)` + `v.minValue(1, …)` — как `entity.ts` (`integer`, `minValue(1)`).
- `roles`: `v.pipe(v.array(UserRoleName), v.minLength(1, …))`; `UserRoleName = F.picklist([...], 'Роль пользователя')` с литералами `GUEST|SUBSCRIBER|STUDENT|MENTOR|AUTHOR|ADMIN`.
- `STUDENT` остаётся в списке до Ф3 (помечен DEBT-48): фикстуры и живые данные его содержат (`data/fixtures/users/users.json`: 3 из 14 пользователей), строгое чтение без него ранее Ф3 уронило бы записи.
- `nick`: опциональный, trim + `nonEmpty`.
- Даты — только из `BaseEntityFields` (`F.timestamp`): читает legacy `YYYY-MM-DDTHH:mm` как UTC и число; нет `updatedAt` → `createdAt`, нет `version` → 0 (D-36). Legacy `entity.ts` с `biome-ignore DEBT-5` остаётся до Ф6.
- Тип роли называется `UserRole` (не `Role` — имя занято legacy-enum до Ф4).

**Р2. `UserArDef` + `UserAr`** (`user/user.ar.ts`).
- Def: `name: 'user'`, без `statuses` и `transitions` (у пользователя нет жизненного цикла), `events: {}` (потребителей нет, MAN-06), `errors: UserErrors`.
- `UserAr extends Aggregate<typeof UserArDef, UserView>`: `private constructor`, `static create(input, at)` и `static restore(state)`; без `new` других Ar.
- `UserView` = `UserState`-форма наружу (даты числами, `version` включена) по образцу `StreamView`; `view()` переопределять не нужно.
- Методы-вопросы (DOM-02/04, без `Result`): `hasRole(role)`, `isAdmin()`, `isMentor()`. `isAuthor()` не добавлять — вызывающих нет (Т4).
- Мутации (DOM-02, `Result`):
  - `addRole(role, at)` идемпотентно: роль уже есть → `ok()` без `change` (версия и `updatedAt` не меняются);
  - `removeRole(role, at)`: нет роли → `ok()`; после снятия пусто → `['GUEST']` (как `a-root.ts:76-79`).
- Начальная роль гостя `GUEST` — доменное решение, держит `UserAr.create` (`a-root.ts:45`); если `create-user` останется (С2), `create` получает `roles`. Рекомендуемый путь: `create` создаёт гостя, `uuid` приходит из UC (DOM-14).
- Пустой `nick` (после trim) не записывается (`a-root.ts:49-51`: `if (command.nick)`).
- Не переносятся: `setRole` (`a-root.ts:86`, вызывающих нет), `static register` (слился с `create`), конструктор-валидатор legacy (`new UserAr(state)` бросал).

**Р3. Ошибки (`user.errors.ts`).** `UserErrors = ErrorDef.define('USER', { NOT_FOUND, TELEGRAM_ID_TAKEN })`.
- `NOT_FOUND` (`kind: 'not_found'`): payload — объединение `{ uuid }` или `{ telegramId }` (по образцу `withTarget` в `wish.errors.ts`) → код `USER_NOT_FOUND` совпадает с legacy.
- `TELEGRAM_ID_TAKEN` (`conflict`, `{ telegramId }`) → код `USER_TELEGRAM_ID_TAKEN` (legacy — без префикса, `commands/errors.ts`; ERR-04 требует префикс; вызывающих нет).
- Отказ прав — базовый `CoreErrors.ACCESS_DENIED` с `{ rule, denyMessage }`; групповых ACCESS_DENIED не заводить.

**Р4. Policy (`user.policy.ts`).** `UserPolicy = PolicyDef.define({ name: 'user', rules: { canRegisterGuest, canManageRoles } })`.
- Оба правила — `Rule.of` над структурным субъектом `{ isAdmin(): boolean }`; тексты `denyMessage` — прежние: «Только администратор может регистрировать гостей» (`register-guest-uc.ts:30`), «Недостаточно прав для выполнения действия» (`add-role-to-user-uc.ts:39`).
- Исключения `STUDENT` (`policy.ts:32,34,43,45`) не переносятся (DEBT-48): `canManageRoles` — только ADMIN; контекста правил нет.
- `canCreate` не переносится вместе с `create-user` (С2); если `create-user` остаётся — `canCreate` с прежним текстом «Недостаточно прав для создания пользователя».
- `isAuthor`/`isMentor`/`isAdmin` как публичные проверки Policy legacy → вопросы Ar; в новую Policy не входят.

**Р5. Доменное правило (`user.rules.ts`).** `UserRules = RulesDef.define({ rules: { telegramIdFree } })` — `DomainRuleDef.define` (DOM-16): `name`, `label`, `description`, ошибка `USER.TELEGRAM_ID_TAKEN`; контекст `{ holder?: ReadonlyAr<UserAr> }` приходит из `load` UC (по образцу `WishRules.rules.unique`, `domain/src/wish/wish/wish.rules.ts:28`). Используется `registerGuest` (и `create-user`, если останется).

**Р6. Def UC (`user/uc/*.uc.ts`).**

| Def | type | `callers` | `policy` | Вход | Выход | `errors` |
|---|---|---|---|---|---|---|
| `getUser` | query | guest, user, system | `allowAll` | `{ uuid }` | `UserView` | `NOT_FOUND` |
| `getUserByTelegramId` | query | guest, user, system | `allowAll` | `{ telegramId }` | `UserView` | `NOT_FOUND` |
| `getUsersByIds` | query | guest, user, system | `allowAll` | `{ userIds }` (≤ `GET_USERS_BY_IDS_MAX = 100`, экспортируемая константа) | `UserView[]` | — |
| `listUsers` | query | guest, user, system | `allowAll` | `{ limit (по умолчанию 20), role?, name?, telegramId?, sort ('createdAt\|name' ':' 'asc\|desc', по умолчанию createdAt:desc) }` | `UserView[]` | — |
| `registerGuest` | command | user | `canRegisterGuest` | `{ telegramId, name, nick? }` | `UserView` | `TELEGRAM_ID_TAKEN` (Т1) |
| `addRoleToUser` | command | user | `canManageRoles` | `{ userId, role }` | `UserView` | `NOT_FOUND` |
| `removeRoleFromUser` | command | user | `canManageRoles` | `{ userId, role }` | `UserView` | `NOT_FOUND` |
| `getTelegramAddresses` | query | system | `allowAll` | не меняется | не меняется | — |

- `callers` с `guest` — потому что stories зовут запросы из подписок на события без актора (`dispatchUcAsGuest`, `runners/u7-bot/src/core/u7-bot-ui-story.ts:181`) и так же ведут себя прод-вызовы `get-users-by-ids` без актора (`get-users-by-ids-uc.ts`, `requiresAuth: false`); `system` — резолвер `Caller` (D-51).
- Публичность `listUsers`/`getUser*` (в том числе для гостя) — как legacy (`requiresAuth: false`); при выносе в HTTP пересмотреть (запись в TR).
- Порядок проверок: в `addRoleToUser`/`removeRoleFromUser` `load` (NOT_FOUND) идёт перед Policy — как в legacy (`add-role-to-user-uc.ts:29-40`: «не найден» раньше «нет прав»); сохраняется.

**Р7. Регистрация в паспорте.** Ф1 создаёт Def-файлы UC, но **не добавляет** их в `UserModuleDef.useCases` и в контракт: карта `satisfies ModuleMap<typeof UserModuleDef, …>` в `modules/user/src/user.module.ts` требует реализации каждого Def, и `check` стал бы красным до Ф2. Регистрация, экспорт в `contract.ts`, `index.ts`, `user.module.test.ts` — в Ф2 одним коммитом с реализациями. `external: true` остаётся.

**Р8. Контракт Ф1.** Добавляются: `UserView` (тип), `UserErrors`, `UserAr` (D-69: субъект `Caller` и вопросы ролей для Policy клиентов; чужой код видит `ReadonlyAr<UserAr>`). Сохраняются до Ф4/Ф6: `UserFacade`, `Role`, `User`, `UserNotifiedEvent`, типы ошибок.

**Р9. Фикстура `user.fixture.ts`.** Общие uuid и `stored(overrides)` по образцу `stream.fixture.ts`; фикстура субъекта для тестов клиентов (`UserAr` по `{ uuid, roles }`) — форма и место экспорта решаются брифом Ф4 (TR-61).

## Шаги (по ролям)

0. **`migrator` S0 (flash).** Переименование legacy и подмена ссылок из «Границ»; поведение не меняется; `check` зелёный после шага. Предварительно `bun run gen aggregate user.user --adopt` (dry-run, без `--write`) — сверить, что генератор не перезапишет `index.ts`/`contract.ts`.
1. **`dmg-test-designer` (Sonnet)** — red-тесты:
   - `user.state.test.ts`: чтение legacy-записи (`createdAt: '2026-06-25T12:00'`, нет `updatedAt`/`version`) → число UTC, `updatedAt = createdAt`, `version = 0` (D-36); trim имени; запись со `STUDENT` проходит (до Ф3); пустой `roles` отклоняется;
   - `user.ar.test.ts`: `create` (GUEST, nick только непустой), `addRole` (добавляет, идемпотентна без роста версии), `removeRole` (снимает; последняя роль → `GUEST`; нет роли → ok без изменений), `hasRole`/`isAdmin`/`isMentor`;
   - `user.policy.test.ts`: `canManageRoles`, `canRegisterGuest` — ADMIN разрешено; MENTOR, GUEST, SUBSCRIBER, без субъекта — отказ с `denyMessage` (TST-02);
   - `user.rules.test.ts`: `telegramIdFree` — свободен → ok, занят → `USER_TELEGRAM_ID_TAKEN` с payload (TST-03).
2. **`migrator` домен (flash).** Файлы из «Границ»; Def UC без регистрации; `AggregateDef.define` по текущему образцу (без `statuses`).
3. Гейт и grep-критерии — после каждого шага flash.

## Было → станет

| Было | Станет |
|---|---|
| `entity.ts` `UserSchema` (ISO-строки, `biome-ignore DEBT-5`), `User` | `user/user.state.ts` `UserState` (`BaseEntityFields`, `F.timestamp`), `UserView`; legacy `entity.ts` живёт до Ф6 |
| `a-root.ts` `UserAr` (конструктор бросает, `#`-нет, `isoNow`, `crypto.randomUUID`) | `user.ar.ts` `UserAr` (`create`/`restore`, `Result`, `at`); legacy → `LegacyUserAr` |
| `policy.ts` `UserPolicy` (объект функций) | `user.policy.ts` `UserPolicy = PolicyDef.define`; legacy → `LegacyUserPolicy` |
| `commands/errors.ts` (`USER_NOT_FOUND`, `TELEGRAM_ID_TAKEN`, `ACCESS_DENIED`) | `user.errors.ts` `UserErrors` (`USER_NOT_FOUND`, `USER_TELEGRAM_ID_TAKEN`) |
| `commands/*-cmd.ts` (9 мета-типов) | Def UC (7 + `getTelegramAddresses`); legacy-мета до Ф6 |
| `repo.ts` `UserRepo` (домен) | порт в `modules/user` (Ф2); legacy → `LegacyUserRepo` |
| `events.ts` `UserNotifiedEvent` | не переносится (С3) |

## Сохраняемое поведение

- Все 8 веток из «Р2–Р6»: идемпотентность `addRole`/`removeRole`; `GUEST` при пустых ролях; `GUEST` для нового; `nick` пишется только непустой.
- Тексты отказов (Р4) и код `USER_NOT_FOUND`.
- Порядок «не найден» раньше «нет прав» в ролевых UC.
- Чтение legacy-записей без `updatedAt`/`version` и с ISO-датами.
- **Тесты состава модуля, которые падают при добавлении элементов:**
  - `domain/src/user/user.module.test.ts` (`external: true`, `useCases: ['getTelegramAddresses']`, `aggregates: ['user']`) — меняется в Ф2;
  - `modules/user/src/user.module.test.ts` — переписывается в Ф2;
  - `domain/src/user/contract.role.test.ts` — Ф3/Ф4.
- Вне границ среза (Ф3–Ф6): `platform/app-legacy/src/domain/{user,api}.test.ts` (`Role.STUDENT`), `modules/user/src/api/module.test.ts`, `platform/app/src/u7-caller-resolver.test.ts`, `platform/app/tests/u7-app*.test.ts`.

## Судьба legacy-тестов домена (TST-08)

| Файл | Решение |
|---|---|
| `domain/src/user/user/a-root.test.ts` (100 строк, 8 тестов) | Переносится частично: `create`/`register` → `user.ar.test.ts`; `addRole` (2 теста) → `user.ar.test.ts`; «нарушение инвариантов бросает» не переносится (Ar не бросает, TST-09). Файл остаётся (переименованный `LegacyUserAr`) до Ф6, затем удаляется |
| `domain/src/user/user/policy.test.ts` (156 строк) | Переносится: ADMIN разрешено, остальные — отказ (`canAddRole`/`canRemoveRole` → `canManageRoles`); не переносится: ветки `STUDENT` (86, 96–106, 138–152 — исключения удалены, DEBT-48), `canCreate` (С2), `isAuthor` (Т4). Остаётся до Ф6 |
| `domain/src/user/user.module.test.ts` | Переписывается в Ф2 |
| `domain/src/user/contract.role.test.ts` | Не переносится; удаляется в Ф4 вместе с экспортом `Role` |

Кандидаты в `conductor/roadmap/test-bloat.md`: `platform/app-legacy/src/domain/user.test.ts` — 50 тестов полей схемы `UserSchema`/`RoleSchema` (TST-09: схемы по логике, не по полям); их логика уходит в `user.state.test.ts` (4–5 тестов), файл удаляется в Ф7 вместе с `platform/app-legacy/src/domain/user.ts`.

## Внешние зависимости

- `dependsOn` — `[]`, не меняется. Новые связи не нужны.
- Потребитель контракта — `wish` (ER `invite-wishers`: `domain/src/wish/wish/er/invite-wishers.er.ts:9,30`, `wish-invitation.types.ts:6`): сигнатура `GetTelegramAddressesUcDef` не меняется.
- Inbound-событий и ER/Job нет.

## Данные

- Формат записи (`data/fixtures/users/users.json`, только чтение, 14 записей): `uuid`, `name`, `telegramId`, `roles` (`GUEST` 5, `STUDENT` 3, `MENTOR` 2, `AUTHOR` 2, `ADMIN` 2, `SUBSCRIBER` 1), `createdAt` вида `2026-06-25T12:00`; `updatedAt`, `version`, `nick` в фикстурах нет (но в коде `nick`/`updatedAt` допустимы). Плоская копия `data/fixtures/users.json` читается только `fixture-loader.test`.
- `Role.STUDENT` — только значение enum и picklist; из state не убирается до Ф3.
- Живые данные не открывались.

## Открытые вопросы

- С1–С3 решены (TR-61): субъект — `ReadonlyAr<UserAr>`; `create-user` удалён, `list-users` переносится, `removeRoleFromUser`; `notify-user` удалён.
- **Т1, Т4, Т5, Т6, Т14** — см. списки ниже.

## Правила (ID)

ARC-02 (домен: только `dmg-core` и `valibot`), ARC-04 (чужой — через `contract`), DOM-01, DOM-02, DOM-03, DOM-04, DOM-05, DOM-10, DOM-11, DOM-12, DOM-13 (VO без дат — в `user` VO нет), DOM-14, DOM-15, DOM-16, DOM-17, MAN-01, MAN-02, MAN-11, ERR-01, ERR-04, API-01 (UC без ветвлений — Ф2), CODE-01, CODE-02, CODE-04, TST-01, TST-02, TST-03, TST-06, TST-08, TST-09.

## Документы

Срез не правит `dmg-core` — `bun run docs:impact` не нужен (дока пакета не затрагивается). Проектные: `conductor/architecture/debt.md` (DEBT-1, 2, 5 для `domain/src/user/**` частично снимаются — orchestrator в Ф8; маркер `biome-ignore DEBT-5` в legacy `entity.ts` остаётся до Ф6), `modules/user/about.md` — не затронуто в Ф1.

## Критерии приёмки

- `bun test domain/src/user` — не ниже базовой линии (27 pass, 4 файла) плюс новые тесты; `bun test modules/user` — не ниже 67 pass.
- Новые Def-файлы чисты: `grep -nE "\bthrow\b|new [A-Za-z]*Ar\(|#[a-z]|@u7-scl/(core|app-legacy)" domain/src/user/user/user.{state,errors,ar,policy,rules,fixture}.ts domain/src/user/user/uc/*.ts | grep -v "new UserAr("` пуст.
- `grep -rnE "\b(UserAr|UserPolicy|UserRepo|UserJsonRepo)\b" --include=*.ts domain modules platform runners scripts` — только новые Def-файлы (`user.ar.ts`, `user.policy.ts` …); legacy везде под `Legacy*`.
- `UserModuleDef` по-прежнему `external: true`, `useCases` — `['getTelegramAddresses']`; Def UC не зарегистрированы (Р7).
- `bun run check` зелёный, `bun run arch:check` синхронен, `git status data/` чист.
- Сценарии `a-root`/`policy` перенесены (список выше сверен).

## Решения Ф0

TR-61 (`conductor/architecture/debt.md`), D-69 пакета `dmg-core` (`d71ccd4`). Тактические Т1–Т17 приняты по предложению `dmg-tech-lead`.
