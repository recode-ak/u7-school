# Бриф среза: `user` / прикладной слой (Ф2)

> **Статус:** принят orchestrator (Ф0). Решения С1–С5 (Нурболат) и Т1–Т17 — TR-61 (`conductor/architecture/debt.md`); полный разбор — `../summary.md` → «Ф0: вопросы». Где текст ниже расходится с TR-61 — прав TR-61 и раздел «Решения Ф0» в конце брифа.

Черновик — `dmg-tech-lead`, Ф0; проверка — orchestrator. Читать вместе с `../spec.md`, `../plan.md` (Ф2), `../slices/user-domain.md` (Ф1 принят), эталоном `wish` (`modules/wish/src`), `modules/stream/src` и `conductor/archive/course-dmg_20261105/slices/module.md`.

## Расхождения spec/plan с кодом

1. **`U7LegacyFacades`/`UserLegacy` снимаются в Ф2, не в Ф6.** Единственный потребитель — адаптер `getTelegramAddresses` (`platform/app/src/u7-app.ts:132,240`; `u7-app.types.ts:33`; `index.ts` экспортирует `U7LegacyFacades`). Ф2 заменяет его настоящим UC, поэтому тип и параметр `legacy` теряют смысл (Т8). Ф6 снимает остальное: `userFacade`, `UserInProcFacade`, `UserApiModule`.
2. **«Профиль без `telegramId`»** (`modules/user/src/user.module.test.ts`, 3-й тест) в новой модели недостижим: `telegramId` — обязательное поле state. Тест не переносится.
3. **Запись новым репозиторием в `data/users/users.json` числами сломает чтение legacy** (`v.isoDateTime`, `domain/src/user/user/entity.ts:25-30`). Аналог Т11 из `course/module`. В проде новый `save` до Ф5 не вызывается (UI регистрирует и меняет роли legacy-UC); в Ф2 запись — только во временный каталог тестов.
4. **`scripts/*.test.ts` состав `user` не закрепляют** (пп. 4 сводки): правятся `user.module.test.ts` ×2, `u7-app*.test.ts`.
5. **Legacy-репозиторий пропускает невалидные записи с логом** (`user-json-repo.test.ts:304`), новый кинет исключение (строгое чтение по spec) — зафиксировано в С5.

## Границы

**Прикладной слой `modules/user/src`.**
- Новое: `user/user.repo.ts` (порт + `UserFilter`), `user/user.repo.fake.ts`, `user/uc/{get-user,get-user-by-telegram-id,get-users-by-ids,list-users,register-guest,add-role-to-user,remove-role-from-user}.uc.ts` и тесты рядом, `infra/user.json-repo.ts` и тест.
- Изменяется: `user.module.ts` (`UserDeps`, карта UC, фабрика; убираются `UserLegacy`, `legacy`), `user/uc/get-telegram-addresses.uc.ts` (настоящий UC), `index.ts` (экспорт `UserRepo`, нового `UserJsonRepo`, `UserDeps`), `infra/index.ts`, `user.module.test.ts`.

**Домен `domain/src/user` (регистрация Def — Р7 из Ф1).**
- `user.module.ts` (`useCases` = 8), `contract.ts` (+ Def UC, `UserErrors` уже есть), `index.ts`, `user.module.test.ts`.

**Вне пакета.**
- `platform/app/src/u7-app.ts` (фабрика `UserModuleDef`: `createUserModule({ ...deps, users: repos.users })`, `repos.users = new UserJsonRepo(`${dbDir}/users/users.json`)`; убирается параметр `legacy` у `dmgApp`);
- `platform/app/src/u7-app.types.ts`, `index.ts` (`U7LegacyFacades` убирается);
- `platform/app/tests/*` — только если `U7LegacyFacades` попал в тесты (проверить grep).

**Не трогать:** `data/`; legacy-UC `modules/user/src/api/**`, `UserInProcFacade`, `LegacyUserJsonRepo`, `UserApiModule`, `U7CallerResolver` (Ф4), stories и UI (Ф5), `external: true` (Ф6), Policy клиентов (Ф4), `dmg-core`.

## Решения брифа

**Р1. Порт `UserRepo`** (`user/user.repo.ts`) — `Repository<UserAr> & { findById(uuid); findByTelegramId(telegramId); findByIds(uuids: string[]); findAll(filter: UserFilter) }`.
- `UserFilter = { limit?; role?; name?; telegramId?; sort? }` (поля как у `UserListFilter`, `domain/src/user/user/repo.ts:5-12`).
- Не переносятся: `isTelegramIdTaken` (проверка — доменное правило `telegramIdFree` на ответе `findByTelegramId`), `isEmpty` (вызывающих нет), `getAll()` без фильтра (заменён `findAll`).
- `findByIds` — только выборка; порядок запроса и дедуп собирает UC (Р4).

**Р2. Фейк `UserRepoFake`** (`user/user.repo.fake.ts`): наследник `MemoryRepo`; `find*` объявляются `this.unanswered(...)`, ответ тест задаёт присваиванием (D-55); `findById` — через `restored`.

**Р3. JSON-репозиторий** (`infra/user.json-repo.ts`) по образцу `modules/wish/src/infra/wish.json-repo.ts`.
- `extends VersionedRepository<UserAr>`, `aggregate = UserArDef`, `Rows = v.array(UserArDef.state)` (именно `ArDef.state`, а не `UserState`: только Def оборачивает схему `withEntityDefaults`, D-36; DOM-01).
- Чтение строгое: `v.parse` — битая запись → исключение, файл не перезаписывается. `stored`/`write` — как у `wish`.
- `findAll`: фильтры `role` (включает), `name` (подстрока, регистронезависимо), `telegramId` (точно), `sort` (`createdAt|name`, `asc|desc`), `limit` — логика из `user-json-repo.ts:101-143`; сортировка по `createdAt` теперь числовая (в legacy — строки ISO, порядок тот же).
- **Seed не переносится** (`seedPath`, `user-json-repo.ts:14-72`): решение вместе с С4 (bootstrap первого ADMIN). Пока С4 не решён — рекомендация: seed не переносить, три теста seed не переезжают.
- `BaseJsonDb` не используется (транзакции legacy в DMG не нужны, UoW даёт сверку версии).

**Р4. UC** (`UseCaseFromDef`, API-05). Общее: `Loaded`-тип на UC, без `if` по состоянию в `execute` (API-01), uuid нового агрегата — `crypto.randomUUID()` в UC (DOM-14), время — `this.now()`.
- `getUser`, `getUserByTelegramId`: `load` — `findById`/`findByTelegramId`, нет → `err(UserErrors.NOT_FOUND.make({ uuid }))` / `({ telegramId })`; `execute` — `ok(user.view())`.
- `getUsersByIds`: `load` — `ok(undefined)`; `execute` — пустой вход → `[]`; дедуп; `findByIds`; результат в порядке запроса; ненайденные пропускаются с `this.resolve.app.logger.warn('user', …, { missing })` (как `get-users-by-ids-uc.ts:50-65`). Порог 100 — в схеме входа Def.
- `listUsers`: `findAll(input)` → `view()` каждого.
- `registerGuest`: `load` — `findByTelegramId` (контекст правила `telegramIdFree`); Policy `canRegisterGuest`; `rules: [UserRules.rules.telegramIdFree]`; `execute` — `UserAr.create(…, at)` → `uow.register` → `ok(ar.view())`. Занятый `telegramId` → `USER_TELEGRAM_ID_TAKEN` (legacy возвращал существующего, `register-guest-uc.ts:34-36`); идемпотентность `/start` сохраняет `ensureRegisteredGuest` (сначала `getUserByTelegramId`, `ensure-registered.ts:27`). Вариант (возврат существующего) — Т1.
- `addRoleToUser`, `removeRoleFromUser`: `load` — `findById` (нет → `NOT_FOUND`); Policy `canManageRoles`; `execute` — `user.addRole(role, at)`/`removeRole` → `uow.register`; ошибки Ar возвращаются как есть.
- `getTelegramAddresses`: настоящий UC: `findByIds(userIds)`, адреса только достижимых пользователей, порядок — как во входе, ненайденные просто отсутствуют (без ошибки и без warn — как в Def). Заголовок «Адаптер … над legacy» и `legacy.` удаляются (DEBT-44 закрывается в этой точке; формально снимается в Ф8).

**Р5. Модуль** (`user.module.ts`): `UserDeps = ModuleDeps & { readonly users: UserRepo }`; карта `userModuleMap` (8 UC, `reactions: {}`, `jobs: {}`) `satisfies ModuleMap<typeof UserModuleDef, UserDeps, Identified>`; `createUserModule(deps)`. `UserLegacy` и поле `legacy` удаляются. Тип субъекта карты — `ReadonlyAr<UserAr>` (TR-61 С1). До Ф4 резолвер `Caller` отдаёт legacy `User` без методов: Def-команды `user` с Policy (`registerGuest`, `addRoleToUser`, `removeRoleFromUser`) прод в Ф2–Ф3 не вызывает, тесты берут субъект-`UserAr`.

**Р6. Сборка.** `U7App.dmgApp`: фабрика `{ def: UserModuleDef, create: (deps) => createUserModule({ ...deps, users: repos.users }) }`; legacy `UserApiModule`, `userFacade`, `userRepo` (теперь `LegacyUserJsonRepo`) остаются. Два репозитория (legacy и новый) смотрят на один `users/users.json`; новый в Ф2 в проде только читает (через `getTelegramAddresses` для ER `wish.invite-wishers`).

**Р7. Что остаётся от legacy.** Legacy-UC `modules/user/src/api/**` живут рядом (имена kebab, `ApiApp.execute`) — коллизии с Def-именами (`getUser`) нет: вызов Def идёт `dispatch` (D-49). `module.test.ts` и `user-in-proc-facade.test.ts` не трогаются до Ф6.

## Шаги (по ролям)

1. **`dmg-test-designer` (Sonnet)** — red-тесты (D-55: UC — на фейке, репозиторий и smoke — на временном каталоге):
   - UC `getUser`/`getUserByTelegramId`: найден → `UserView`; нет → `USER_NOT_FOUND` с payload;
   - `getUsersByIds`: пусто → `[]`; порядок запроса и дедуп; частично найдены → найденные + warn; без актора (`SystemCaller`/гость) — проходит; больше 100 — отказ валидации входа (1 тест, граница);
   - `listUsers`: фильтры пробрасываются в `findAll` (логика фильтра — в тесте репозитория, не дублировать на уровне UC, TST-08);
   - `registerGuest`: новый гость (`GUEST`, nick), nick `''` не записывается, не-админ → `ACCESS_DENIED`, занятый `telegramId` → `USER_TELEGRAM_ID_TAKEN` (Т1);
   - `addRoleToUser`/`removeRoleFromUser`: ADMIN добавляет/снимает; не-админ — `ACCESS_DENIED`; нет пользователя — `USER_NOT_FOUND` (раньше Policy); снятие последней роли → `GUEST`; повторное добавление — версия не растёт;
   - `getTelegramAddresses`: адреса по порядку, нет профиля — не в ответе (замена теста адаптера; тест «профиль без telegramId» не переносится);
   - `user.json-repo.test.ts` (TST-04): save/round-trip, перезапись по uuid, `findById`/`findByTelegramId`/`findByIds`, фильтры (роль, имя — подстрока и регистр, telegramId), сортировка (createdAt asc/desc, name asc), лимит (в т.ч. `limit=0`), комбинации; **чтение legacy-записи** (ISO без `updatedAt`/`version`) → число, round-trip пишет числа; **невалидная запись → исключение, файл не изменён**; конкуррентный `save` с конфликтом версии → `VersionConflict` (контракт `VersionedRepository`);
   - smoke модуля (TST-04): `createUserModule` на реальном репозитории во временном каталоге: `registerGuest` → `getUser` → `addRoleToUser` → `listUsers`; **запись — только во временный каталог**.
2. **`migrator` (flash).** Файлы из «Границ»; регистрация Def UC в `UserModuleDef` и `contract.ts` (+ `index.ts`); карта модуля; `U7App`; обновление `user.module.test.ts` (домен: `useCases` — 8 имён; прикладной: через `createUserModule`) и `platform/app/**`.
3. **`dmg-data-keeper` (flash).** Читает `users.json` на копии `data/fixtures/users/users.json` (во временный каталог) и на `DB_DIR=./data/fixtures`: все 14 записей проходят строгий разбор (в том числе со `STUDENT`), даты ISO → число; живые данные не открываются.
4. **`dmg-reviewer` (Opus).** Вне этого брифа.

## Было → станет

| Было | Станет |
|---|---|
| `modules/user/src/api/user/*-uc.ts` (9 UC на `U7UseCase`, исключения, `UserApiModule`) | `user/uc/*.uc.ts` (7 UC на `UseCaseFromDef`) + `getTelegramAddresses`; legacy-UC живут до Ф6 |
| `infra/db/user-json-repo.ts` (`JsonFileRepo`, толерантное чтение, seed) | `infra/user.json-repo.ts` (`VersionedRepository`, строгое чтение, без seed); legacy → `LegacyUserJsonRepo` до Ф6 |
| `UserLegacy = Pick<UserFacade,'getUserByUuid'>`, `legacy` в `UserModuleDeps` | `UserDeps = ModuleDeps & { users: UserRepo }` |
| Адаптер `GetTelegramAddressesUc` над `getUserByUuid` (по одному) | UC над `findByIds` (один запрос) |
| `U7LegacyFacades { user: UserLegacy }`, `dmgApp(…, legacy, repos)` | параметра нет; `repos.users` |

## Сохраняемое поведение

- Тексты и коды: `USER_NOT_FOUND` (payload `{uuid}` или `{telegramId}`), «Только администратор может регистрировать гостей», «Недостаточно прав для выполнения действия».
- Порядок «не найден» → «нет прав» в ролевых UC (`add-role-to-user-uc.ts:29-40`).
- `getUsersByIds`: пустой вход → `[]`, дедуп, порядок запроса, пропуск ненайденных с warn, доступ без актора (peer-review invite, `invite.story.ts:144`).
- `listUsers`: `limit` по умолчанию 20, сортировка по умолчанию `createdAt:desc`, фильтры как в `user-json-repo.ts:101-143`.
- `getTelegramAddresses`: достижимые пользователи в порядке входа, ненайденные — отсутствуют.
- Legacy-UC и бот продолжают работать (Ф2 аддитивна).
- **Тесты состава модуля, правятся в Ф2:** `domain/src/user/user.module.test.ts`, `modules/user/src/user.module.test.ts`; проверить `platform/app/tests/u7-app.test.ts` (сборка `U7App` не должна падать от смены фабрики). Вне границ и не правятся в Ф2: `modules/user/src/api/module.test.ts`, `domain/src/user/contract.role.test.ts`.

## Судьба legacy-тестов прикладного слоя (TST-08)

| Файл | Решение |
|---|---|
| `api/user/get-user-uc.test.ts` (2) | → `get-user.uc.test.ts` (found/not-found); legacy остаётся до Ф6 |
| `api/user/get-user-by-telegram-id-uc.test.ts` (2) | → `get-user-by-telegram-id.uc.test.ts` |
| `api/user/get-users-by-ids-uc.test.ts` (5) | → 4 теста (без актора, порядок/дедуп, частично найдены+warn, >100); «возвращает всех» сливается с порядком |
| `api/user/list-users-uc.test.ts` (1) | → 1 тест пробрасывания фильтра (фильтрация — в репозитории) |
| `api/user/register-guest-uc.test.ts` (4) | → 4 (новый, nick, не-админ, занятый `telegramId` вместо «возвращает существующего» — Т1) |
| `api/user/add-role-to-user-uc.test.ts` (3) | → 3 (админ добавляет, нет пользователя, не-админ); + новый тест для `removeRoleFromUser` (legacy-теста нет, пробел п. 14) |
| `api/user/create-user-uc.test.ts` (3) | Не переносится (С2); удаляется в Ф6 |
| `api/user/notify-user-uc.test.ts` (2), `infra/user-in-proc-facade.test.ts` (2) | Не переносятся (С3); удаляются в Ф6 |
| `api/module.test.ts` (1, «реестр из 9 UC») | Заменяется smoke-тестом модуля (TST-04); legacy удаляется в Ф6 |
| `infra/db/user-json-repo.test.ts` (407 строк) | Фильтры, сортировка, лимит, round-trip → `user.json-repo.test.ts`; `isTelegramIdTaken` и `isEmpty` не переносятся; «невалидные пропускаются с логом» (`:304`) заменяется «невалидная → исключение»; 3 seed-теста не переносятся (Р3, С4). Legacy остаётся до Ф6 |
| `user.module.test.ts` (3 теста адаптера) | Переписывается на настоящий UC; «профиль без telegramId» не переносится |

Кандидаты в `conductor/roadmap/test-bloat.md`: `list-users-uc.test.ts` и 12 «одно-ветвных» legacy-тестов UC, дублирующих фильтры репозитория; `module.test.ts` — вертикаль дублирует UC-тесты (TST-08); `platform/app/src/u7-caller-resolver.test.ts` — переписывается в Ф4.

## Внешние зависимости

- `dependsOn` — `[]`. Модуль `user` ни одного чужого UC не вызывает.
- Потребители: `wish` ER `invite-wishers` вызывает `getTelegramAddresses` через `this.call` (контракт не меняется).
- Inbound-событий нет.

## Данные

- Строгое чтение: все 14 фикстурных записей проходят (`STUDENT` пока допустим).
- Запись новым репозиторием в Ф2 — только во временный каталог. Живые данные не трогаются, `git status data/` чист.
- Риск живых данных: одна невалидная запись в `data/users/users.json` теперь роняет все чтения нового UC (и ER `invite-wishers`); в Ф2 это единственный потребитель. Проверка живого файла — на стороне Нурболата при релизе (С5), скрипт миграции Ф3 в режиме «сухой прогон» должен перечислять невалидные записи (Т9).

## Открытые вопросы

- С1–С5 решены (TR-61): субъект — `ReadonlyAr<UserAr>`; состав UC по брифу; `notify-user` удалён; seed не переносится (DEBT-52); строгое чтение, порядок выкатки — чек-лист `migration.md`.
- **Т1** (идемпотентность `registerGuest`), **Т3**, **Т7**, **Т8**, **Т13**, **Т15**.

## Правила (ID)

ARC-02 (модуль: `domain` по контракту, `core` и `app-legacy` не импортирует в новых файлах), ARC-04, ARC-06 (прикладной пакет не импортирует соседей), ARC-07 (корень сборки: контракты и вход пакета), DOM-01 (без `…/state` вне `infra/`; репозиторий разбирает `UserArDef.state`), DOM-14, DOM-17 (`.snapshot()` только в `*.json-repo.ts`), API-01, API-02, API-03, API-05, API-07, ERR-01, ERR-02 (в `errors` Def — все ошибки, включая правила), ERR-06, TST-04, TST-06, TST-07 (рабочий код не импортирует фейки), TST-08, TST-09, CODE-02.

## Документы

Срез не правит `dmg-core` — `docs:impact` не нужен. Проектные: `modules/user/about.md` описывает legacy UC для u7-cli — не трогается до Ф6; `debt.md` — маркер DEBT-44 (`Адаптер .* над legacy`) снимается этим срезом по критерию, запись в `debt.md` убирает orchestrator в Ф8.

## Критерии приёмки

- `grep -n "legacy\." modules/user/src/user/uc/get-telegram-addresses.uc.ts` пуст; `grep -rn "Адаптер .* над legacy" modules/user/src` пуст.
- Новые файлы `modules/user/src/user/**`, `infra/user.json-repo.ts`: `grep -nE "\bthrow\b|new [A-Za-z]*Ar\(|#[a-z]|@u7-scl/(core|app-legacy)|…/state"` пуст (кроме тестов).
- `grep -rn "UserLegacy\|U7LegacyFacades" --include=*.ts platform modules` пуст.
- `UserModuleDef.useCases` — 8 имён, `external: true` сохранён; `bun run arch:check` синхронен (модуль помечен внешним — проверка арх-пар по `debt.md`).
- `bun test modules/user domain/src/user platform/app` — не ниже базовой линии (94 pass на `domain/src/user` + `modules/user`; пока legacy-тесты живы число не падает).
- Тест репозитория: round-trip legacy-записи, невалидная запись → исключение и файл не перезаписан.
- `bun run check` зелёный; `git status data/` чист; чтение `data/fixtures` data-keeper'ом прошло.

## Решения Ф0

TR-61 (`conductor/architecture/debt.md`), D-69 пакета `dmg-core` (`d71ccd4`). Тактические Т1–Т17 приняты по предложению `dmg-tech-lead`.

## Отчёты Ф2

**`dmg-test-designer` (Sonnet).** 9 тестовых файлов (7 UC, `user.json-repo.test.ts`, переписан `user.module.test.ts`) и фикстура `user/uc/user-uc.fixture.ts`; перенос legacy — по таблице TST-08 брифа; новых кандидатов в чистку нет. Red: 64 pass / 9 fail («Cannot find module»).

**`migrator` (flash, `ud-F2-app`, $0.18).** Код по Р1–Р6, гейт зелёный. Эскалации: (1) smoke отдавал один `requestId` четырём командам → `REQUEST_CONFLICT` (D-56) — тест исправлен; (2) маркер DEBT-44 исчез — `arch:check` требует снять запись, orchestrator снял DEBT-44 в Ф2. Отклонения: query-UC типизированы `Identified` (Policy ролей — на командах); `v.trim()` убран из входа `registerGuest` (MAN-03, обрезает `UserAr.create`); `v.description` у полей `listUsers` (MAN-02).

**`dmg-data-keeper` (flash, `ud-F2-data`, $0.04).** Совместимо для чтения: копия `data/fixtures/users/users.json` — 14/14 записей строго разобраны (3 со `STUDENT`), ISO → число. Прод до Ф5 новый `save` не вызывает (grep `dispatch` в `runners/**`, `platform/**` пуст). **Риск выкатки:** первый `save` нового репозитория переписывает весь файл числами → legacy читает 0 записей, следующий legacy-`save` оставляет в файле только свои (на копии 14 → 1). Окно «пишут оба» недопустимо: конвертация и снятие legacy-писателя — в одном релизе, перед ним `bun run backup` (чек-лист `migration.md`, Ф8). Чтение живого файла не выполнялось: legacy-репозиторий при чтении пишет `data/users/backups/` — проверка на релизе (С5).
