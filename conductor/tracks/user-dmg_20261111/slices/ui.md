# Бриф среза: `user` / UI бота (Ф5)

> Черновик `dmg-tech-lead` (Sonnet), на приёмку orchestrator. Читать с `../spec.md`, `../plan.md` (Ф5), `slices/user-app.md` (Def UC), `slices/caller.md` (Ф4, Р5), TR-61 (`conductor/architecture/debt.md`), `../summary.md` → Т14–Т16. Эталон поведения — `../u7-school-v0.2.6/apps/u7-bot/src` (читать только). Гайды UI — `conductor/architecture/ui/{bot-ui-story,bot-controller,bot-test,bot-architecture}.md`.

## Решения orchestrator

- **О1 — вариант А, Нурболат 2026-11-11.** Актор stories — `U7BotActor = ReadonlyAr<UserAr>`; мост Р5 (`subjectOf`) снимается в Ф5; Т14 `summary.md` в части «alias `User` до Ф7» для `runners` отменяется.
- **О3 — вариант (а), тактика (TR-61 «Ф5»).** `u7-cli`: `currentActor: UserView`, к legacy `execute` — явное приведение с пометкой DEBT-42; `/login` остаётся.
- **Риск `call-uc`/`_course-client` между Ф5 и Ф6** — мост до Ф6, строка в `debt.md` (шаг 4).
- Поведение для пользователя не меняется (О2 — «нет»): любое видимое отличие от `v0.2.6` в шагах — эскалация.

## Расхождения plan/spec с кодом

1. **Тип актора UI не решён.** Т14 (`summary.md`) — «временный alias `User` в контракте, снимается в Ф7»; TR-61 «Пересмотреть» (Ф4) — «`subjectOf` уходит в Ф5, актор stories — `ReadonlyAr<UserAr>`». В плане Ф5 шага нет. Контракт всё ещё экспортирует legacy `User` с ISO-датами (`domain/src/user/contract.ts:12`), а `getUser`/`getUserByTelegramId` отдают `UserView` (даты — числа). Актор без смены типа не получить из Def-UC → **О1**.
2. **Список flash-мест плана неполон.** Кроме `streams`/`learning`/`peer-review`/`u7-cli`/`test-bot-transport` вызовы legacy-имён есть в `school` (`school-hub.story.ts:60`, `school-reviews.story.ts:128`), `mentor/monitor.ts:325`, `courses` (`wish-invite.story.ts:201`, `wish-confirmed.story.ts:124`) — все «механика» (flash). Не названы и тесты: 28 файлов `runners/u7-bot/tests/**` (53 вхождения `userFacade`, 44 вызова `app.userFacade.getUserByTelegramId`) и `tests/helpers/{test-app,test-bot-transport,student-fate}.ts`.
3. **Критерий плана «`userFacade.`» узок:** не ловит тип/поле `userFacade` (`create-ui-app.ts:17,97`, `u7-bot-app-meta.ts:15`, `ui-app.ts:71,180`, `test-bot-transport.ts:189-209,423`, `test-app.ts:33,75`). Критерий среза — ноль `userFacade|UserFacade` в `runners`.
4. **`test-app.ts` в Ф6 (план) против Ф5 (критерий):** поле `TestApp.userFacade` живёт в `runners`, критерий Ф5 его запрещает → снимается в Ф5. В Ф6 остаются `scripts/*`, `platform/app`.
5. **Т16: `dispatchByName` нет** в установленном `dmg-core` (grep по `node_modules/dmg-core` пуст). `u7-cli` — через `apiApp.dispatch(UserModuleDef, <Def>.command(…), caller, trace)`, как `scripts/call-uc.ts:160-170`. Выход `listUsers` — `UserView[]`, а не `{ users }` (`cli-controller.ts:374-379`).
6. **«Красной зоны» нет:** Ф3 записала «красной зоны нет» (`plan.md`, Ф3). Задача «снять красную зону» сводится к записи в `debt.md`: мост Р5 (`subjectOf`) закрыт, TR-49 (6) и TR-61 «Ф5» — состояние (формальное снятие — Ф8).
7. **`user-notify.e2e.test.ts` вводит в заблуждение:** файл не про `NotifyStory` — три сценария (приглашение желающих, «🎉 Курс завершён!», отсутствие уведомления) идут через `WishInviteStory`/`HubStory`; `UserController` в нём — лишний. Простое удаление теряет три e2e (`:107,187,255`) → Р7.
8. **Продюсеры `user.notified` в `v0.2.6` были** (`packages/peer-review/src/api/er/notify-review-recipient-er.ts:49`, `complete-student`, `mark-abandoned`, `invite-wishers`); в HEAD их заменили Def-подписки stories (`ReviewNotifyStory`, `HubStory`, `InactivityStory`, `WishInviteStory`) — удаление `NotifyStory` поведения не меняет (С3). Но комментарии с `userFacade.notify`/`user.notified` остались: `inactivity.e2e.test.ts:37,64`, `streams/controller.ts:21`, `peer-review/ui-spec.md:9`, `bot-controller.md:16,28`.
9. **Ветка «нет `telegramId`» в `resolveRespondent`** (`questionnaire-story.ts:36-43`) недостижима: `telegramId` — обязательное поле state (`UserView`), строгое чтение. Удаляется вместе с тестом (не изменение поведения).
10. **`getUsersByIds` не имеет `errors`** (`domain/src/user/user/uc/get-users-by-ids.uc.ts`): `Err` возможен только как ошибка входа (>100 id). Legacy при >100 тоже отказывал валидацией; сайты с `try/catch` ловят то же самое.

## Границы

**Меняется (`runners/`).**
- Ядро UI: `u7-bot/src/core/{u7-bot-app-meta,u7-bot-ui-story,ui-app,u7-bot-controller}.ts` (+ тесты), `u7-bot/src/create-ui-app.ts` (+ тест), `u7-bot/src/ensure-registered.ts` (+ тест), `u7-bot/src/main.ts` — только если нужен `botAdminUuid` из `createUiApp` (проверка `BOT_ADMIN_UUID` в `main.ts:149-163` остаётся как есть).
- Stories и контроллеры по инвентарю (раздел «Было → станет»), `mentor/stories/submenu.ts` (+ тест), `school/controller.ts` (+ тест), `questionnaire/stories/questionnaire-story.ts`.
- Удаляются: `controllers/user/controller.ts`, `controllers/user/stories/notify.story.ts` (+ `.test.ts`), `UserController`/`userController` в `create-ui-app.ts`.
- `u7-cli/src/cli-controller.ts:374,409`.
- Тесты: все по разделу 3; кит `streams/stories/stream-dmg.test-kit.ts`, `questionnaire/stories/questionnaire-dmg.test-kit.ts`; `tests/helpers/{test-app,test-bot-transport,student-fate}.ts`; 28 integration/e2e файлов.
- Документы UI: `conductor/architecture/ui/bot-ui-story.md` §7, `bot-controller.md:16,28`, `runners/u7-bot/src/controllers/{streams,peer-review}/ui-spec.md` (`streams/ui-spec.md:84`, `peer-review/ui-spec.md:9`).

**Не трогать.**
- Ф6: `UserInProcFacade`, `U7App.userFacade`/`userRepo` (`platform/app/src/u7-app.ts:79,80,119`), `UserApiModule`, legacy-UC `modules/user/src/api/**`, `LegacyUser*`, `external: true`, `scripts/{call-uc,_course-client}.ts` (`call-uc.ts:149`, `_course-client.ts:83`), `platform/app/tests/u7-app.test.ts:139-140`, `modules/user/about.md`.
- Ф7: barrel-импорты, `tests/worlds/**` (в т. ч. `invariants.ts:91,133`), `TEST_SCHOOL`/`School` из `app-legacy/domain`.
- `dmg-core`, `data/`, `conductor/` (кроме строк «Документы»).

**Мост Р5 из Ф4** (`U7BotUiStory.subjectOf`, `u7-bot-ui-story.ts:208`; единственный потребитель — `submenu.ts:50`) — **снимается в Ф5** при О1-А (актор сам субъект). При О1-Б остаётся до Ф7.

## Решения брифа

**Р1. Тип актора (по умолчанию — О1-А).** `type U7BotActor = ReadonlyAr<UserAr>` — один экспорт в `core/u7-bot-app-meta.ts`; `U7BotUiAppResolve extends BotUiAppResolve<U7BotAppMeta, U7BotActor>`; stories, контроллеры, `U7BotUiApp`, `TestBotTransport` — на него (замена `User` из `@u7-scl/app-legacy/domain`). Имя/`telegramId` — `actor.view().name` / `.view().telegramId`, `uuid` — `actor.uuid` (23 использования `actor.uuid`, 8 — `telegramId`, 1 — `name`; `actor.roles|createdAt|nick` нет). Роли — `actor.isMentor()`/`isAdmin()`.
- `dispatchUc(module, command, actor)` → `#dispatchAs(module, command, actor.uuid, actor.view().telegramId)`; резолв `Caller` — по-прежнему `callers.resolve` (D-50; лишний `getUser` на команду — как с Ф4, не оптимизируется).
- `subjectOf` и `requestTrace`-вызов из него удаляются; `requestTrace` остаётся в `dispatch-uc.ts`.
- Фикстуры тестов: `userSubject({ uuid, name, telegramId, roles })` из `@u7-scl/domain/user/testing` (D-70; разрешён `*.test.ts`, `*.test-kit.ts`, `tests/**`); `Role.X` → литерал `'MENTOR'`, импорты `Role` из `@u7-scl/user/domain` в `runners` исчезают.

**Р2. `actorResolver(tgId)`** (`create-ui-app.ts:90-95`): `dispatchModuleUc(UserModuleDef, GetUserByTelegramIdUcDef.command({ telegramId }), { resolve, uuid: undefined, telegramId, warn })` → `ok` → `callers.resolve(view.uuid, trace).subject()`; `NOT_FOUND` → `throw new Error(\`Пользователь с telegramId ${tgId} не найден\`)` (текст сохранить); прочий `Err` или `subject() === undefined` → исключение (ERR-01/ERR-06). `UserAr.restore` вне модуля не вызывается (D-69 — только резолвер `Caller`).

**Р3. `botAdminUser` → `botAdminUuid: string`** в `U7BotUiAppResolve`; `createUiApp` проверяет админа через `app.callers.resolve(uuid, trace).subject()` — нет субъекта → тот же `Error('BOT_ADMIN_UUID не найден: пользователь … не существует')` (`create-ui-app.ts:84-88`; срабатывает раньше проверки в `main.ts:149-163`, как сейчас; дубль не трогается). Поле `userFacade` из `resolve` и `UiAppSource` удаляется.

**Р4. `ensureRegisteredGuest`** остаётся функцией в `ensure-registered.ts` (перенос в класс — вне среза, вариант на ревью): `(resolve: Pick<U7BotUiAppResolve, 'appApi' | 'callers' | 'botAdminUuid'>, sender: TgSender): Promise<void>`.
1. `getUserByTelegramId` от гостя (`uuid: undefined`): `ok` → выход; `NOT_FOUND` → дальше; прочий `Err` → исключение.
2. `registerGuest({ telegramId, name: first_name, nick: username })` от `botAdminUuid` (ник — только если `username` задан); `ok` → выход; `USER_TELEGRAM_ID_TAKEN` (гонка двух `/start`, Т1) → выход без ошибки (идемпотентность сохраняется); прочий `Err` (в т. ч. `ACCESS_DENIED`) → исключение (как у legacy: сбой `/start` пробрасывался).
3. След: каждая команда — свой `requestId` из `BotRequestContext` (`requestTrace`); вне апдейта (`handleMessengerEvent`) — `warn` ERR-07 на команду (как TR-50 (9)), не ошибка.
Вызовы `ui-app.ts:70,179` — `ensureRegisteredGuest(this.resolve, …)`.

**Р5. `school/controller.ts`** (FR-7, `Role.SUBSCRIBER` → `'SUBSCRIBER'`): `getUserByTelegramId` (guest) → `NOT_FOUND` → пропуск (как `if (user)`), `ok` → `addRoleToUser`/`removeRoleFromUser` от `botAdminUuid`; прочий `Err` → исключение → существующий `catch` (`warn` «Ошибка при обработке события школьной группы: …», реакция `'stop'`). Обёртка — `dispatchModuleUc` приватным методом (как `StreamsController.#dispatchAsGuest`); общий метод в `U7BotController` — кандидат, не в срезе.

**Р6. Профили в stories (вариант с рекомендацией).** Рекомендуется два метода в `U7BotUiStory` (класс, а не хелперы): `protected async findUser(uuid, actor?): Promise<UserView | undefined>` (`getUser` через `dispatchUc`/`dispatchUcAsGuest`; `NOT_FOUND` → `undefined`; прочий `Err` → `throw new Error(code)`; исключения `dispatch` не глотаются) и `findUsers(uuids, actor?): Promise<UserView[]>` (`getUsersByIds`; пустой вход — без вызова; `Err` → исключение). Сайты (flash) остаются ровно с прежними `try/catch` и fallback. Вариант Б — `dispatchUc(UserModuleDef, GetUserUcDef.command(…))` на каждом сайте (дубль ~20 раз). Методы покрываются тестами один раз в `u7-bot-ui-story.test.ts` (TST-08), сайты — на моках `appApi.dispatch`.
- Сайты без `try/catch` (`hub.ts:64`, `campaign.story.ts:435`, `school-reviews.story.ts:128`, `scope-reviews`/`reviews-for-me`/`my-reviews` `#namesOf`, `review-notify.story.ts:51`) и раньше падали на ненайденном/сбое — сохраняется: `undefined` там, где код уже терпим (`hub.ts:64` — `if (!user?.telegramId) return`), иначе исключение. Единственное место, где `undefined` дал бы новое поведение, — `campaign.story.ts:435` (`user.name`): сохранить исключение (не добавлять fallback без решения).
- Типы `Profile`/`Mentor`/`MentorProfile` в stories (локальные интерфейсы под `User`) — на `UserView`.

**Р7. `NotifyStory`/`UserController` удаляются (С3).** Файл `user-notify.e2e.test.ts` **остаётся** (сценарии 1–3 про `WishInviteStory`/`HubStory`), без `UserController`, заголовок describe — без «userFacade.notify»; `test-designer` до переноса сверяет перекрытие с `wish-flow.integration.test.ts`/`student-dmg.e2e.test.ts` и дубль удаляет (TST-08, решение по каждому сценарию — в отчёт). `UserController` убрать из `student-dmg`, `inactivity`, `stream-dmg`, `user-notify` e2e.

**Р8. Тестовая инфраструктура.**
- `TestApp.userFacade` → метод `userByTelegramId(tgId): Promise<U7BotActor>` (`dispatch` `getUserByTelegramId` от гостя + `callers.resolve(uuid).subject()`; нет → ошибка теста «Нет пользователя фикстуры tg=…» как в `student-fate.ts:22-24`); 44 вызова в 28 файлах — механическая замена, `student-fate.ts` использует его же.
- `createTestBotTransport`: `actorResolver` — тот же метод; опции `userFacade` и `botAdminUser` заменить на `botAdminUuid` (по умолчанию — админ мира, `tg 1005`); заглушка `registerGuest: async () => undefined` (`test-bot-transport.ts:203-209`) исчезает — гост-регистрация идёт настоящей (+ один e2e, см. раздел 3).
- `dmgDispatch` (`stream-dmg.test-kit.ts:37-39`, обёртка в `questionnaire-dmg.test-kit.ts:33`, kit peer-review) — допустимые модули по умолчанию + `UserModuleDef`; ответы по имени UC: `getUser`, `getUsersByIds`, `getUserByTelegramId`.
- `ProfileOf`/`users`/`getUserFails` кита анкет: `users` → ответ `getUser` (`ok` / `refuse('USER_NOT_FOUND','not_found')`), `getUserFails` → `dispatch` бросает; `execute` в ките удаляется (по-прежнему любой legacy-вызов — ошибка теста, теперь через отсутствие `execute` в моке).

**Р9. `u7-cli` (flash).** `/login`: `listUsers` → `apiApp.dispatch(UserModuleDef, ListUsersUcDef.command({}), new GuestCaller(), trace)` (`callers` включает `guest`; `trace` — `Trace.fromRequest({ requestId: crypto.randomUUID(), channel: { name: 'cli' } })`, как `call-uc.ts:162-165`); `getUser` — так же; результат `UserView[]`. `currentActor` и вызовы остальных legacy-UC (`execute`, `:321,324`) — см. **О3**.

**Р10. `submenu.ts`:** `#isMentor(actor)` снова синхронный: `actor.isMentor() || actor.isAdmin()`; `async`/`subjectOf` убираются (Р1). Тексты, `priority: 30` — без изменений.

## Шаги

Порядок внутри фазы — один коммит чтений и записей (Т15); промежуточный `check` красный допустим, итоговый — зелёный.

1. **`dmg-test-designer` (Sonnet)** — red-тесты и перенос тестов, TST-08 (разделы 1 и 3):
   - kit-ы и `TestApp`/`TestBotTransport` (Р8); characterization для Sonnet-мест (раздел 3); новые тесты Р1–Р6, Р10;
   - перевод остальных unit-тестов stories на `dmg` моки (`getUser`/`getUsersByIds` ответами) — по списку раздела 3: если объёма много — механическую часть отдаёт flash (в отчёт);
   - красный прогон `bun run test:bot` — список упавших в отчёт.
2. **UI-stories (Sonnet)** — Р1–Р5, Р10, `questionnaire-story.ts`, удаление `UserController`/`NotifyStory`, методы Р6.
3. **`migrator` (flash)** — механика: сайты Р6 по инвентарю, тип `U7BotActor` в остальных файлах (замена `User` из `app-legacy/domain` и `Role`), `u7-cli` (Р9), `tests/**` (Р8: 28 файлов, `student-fate.ts`), ui-spec/комментарии. После шага — `bun run check` и grep критериев.
4. **Opus** — `debt.md`: TR-61 «Ф5» (мост Р5 закрыт, О1, `registerGuest` TAKEN-гонка, `findUser`/`findUsers`), строка о `call-uc`/`_course-client` между Ф5 и Ф6 (риск ниже); документы UI (раздел «Документы»).
5. **`dmg-reviewer` (Opus).**

## Было → станет

### Инвентарь вызовов legacy-имён `user` в `runners/` (S — Sonnet, F — flash)

| Файл:строка | Вызов | Станет | Кто |
|---|---|---|---|
| `u7-bot/src/ensure-registered.ts:27,29` | `userFacade.getUserByTelegramId` / `registerGuest` | Р4: `GetUserByTelegramIdUcDef` (guest) → `RegisterGuestUcDef` от `botAdminUuid`, `dispatch` | S |
| `u7-bot/src/core/ui-app.ts:71,180` | `ensureRegisteredGuest(this.resolve.userFacade, botAdminUser, …)` | `ensureRegisteredGuest(this.resolve, …)` | S |
| `u7-bot/src/create-ui-app.ts:17,83,92,97` | `userFacade` в `UiAppSource`; `getUserByUuid(botAdminUuid)`; `getUserByTelegramId` в `actorResolver`; `userFacade` в `resolve` | Р2, Р3 | S |
| `u7-bot/src/core/u7-bot-app-meta.ts:15,17` | поле `userFacade: UserFacade`, `botAdminUser: User` | убраны; `botAdminUuid: string`, `U7BotActor` | S |
| `u7-bot/src/controllers/school/controller.ts:46,50,61,65,75,79` | `userFacade.getUserByTelegramId`/`addRoleToUser`/`removeRoleFromUser` | Р5 | S |
| `u7-bot/src/controllers/questionnaire/stories/questionnaire-story.ts:23` | `execute('get-user')` в `try/catch`: сбой → `warn` «…сбой чтения профиля респондента», нет профиля → `warn` «…профиль респондента не найден» | `findUser(respondentId)` (guest — вызов из подписки без актора, `dispatchUcAsGuest`); `NOT_FOUND`→`undefined`→второй `warn`; исключение/`Err`→первый `warn`; ветка «нет telegramId» удалена; `AddressedRespondent.user` — `UserView` (TR-49 (6)) | S |
| `u7-bot/src/controllers/user/stories/notify.story.ts:44` | `execute('get-user')` | файл удалён (С3) | S |
| `u7-bot/src/controllers/streams/controller.ts:52,78` | `userFacade.getUserByTelegramId(event.user.id)` | `GetUserByTelegramIdUcDef` (guest), `NOT_FOUND` → `undefined` (дальше `Boolean(user)`) | F |
| `u7-bot/src/controllers/streams/controller.ts:61,87` | `resolve.appApi.execute('get-user', { uuid: stream.mentorId })` (внутри общего `try` → `warn`+`stop`) | `GetUserUcDef` (guest); `mentor?.telegramId` как есть; `Err` → `throw` (в тот же `catch`) | F |
| `u7-bot/src/controllers/streams/stories/view-stream.story.ts:151,222` | `execute('get-user')`, `catch` → `mentorName=''` / `userId.slice(0, 8)` | `findUser(uuid, actor)`; `undefined`/исключение → те же fallback | F |
| `u7-bot/src/controllers/streams/stories/inactivity.story.ts:357` | `execute('get-user')`, `catch` → `undefined` | `findUser(uuid)` (подписка — без актора) | F |
| `u7-bot/src/controllers/learning/stories/hub.ts:64` | `execute('get-user')` без `catch`; `if (!user?.telegramId) return` | `findUser(userId)` (`undefined` → `return`) | F |
| `u7-bot/src/controllers/peer-review/stories/invite.story.ts:144` | `execute('get-users-by-ids')`, `catch` → пустой `Map` | `findUsers(userIds)`; `catch` остаётся | F |
| `u7-bot/src/controllers/peer-review/stories/{scope-reviews:119, reviews-for-me:148, my-reviews:310}.story.ts` | `execute('get-users-by-ids', …, actor)` без `catch` | `findUsers(userIds, actor)` | F |
| `u7-bot/src/controllers/peer-review/stories/review-notify.story.ts:51` | `execute('get-users-by-ids')` без `catch` | `findUsers([authorId, recipientId])` | F |
| `u7-bot/src/controllers/peer-review/stories/campaign.story.ts:435` | `execute('get-user', …, actor)` без `catch`, `user.name` | `findUser(userId, actor)`; не найден → исключение (Р6) | F |
| `u7-bot/src/controllers/mentor/stories/monitor.ts:325` | `execute('get-user')`, `catch` → `userId.slice(0, 8)` | `findUser` | F |
| `u7-bot/src/controllers/courses/stories/{wish-invite:201, wish-confirmed:124}.story.ts` | `execute('get-user')`, `catch` → `undefined` | `findUser` | F |
| `u7-bot/src/controllers/school/stories/school-hub.story.ts:60` | `execute('get-users-by-ids', { userIds: school.mentors })`, `catch` → без списка менторов | `findUsers(school.mentors)`; `catch` остаётся | F |
| `u7-bot/src/controllers/school/stories/school-reviews.story.ts:128` | `execute('get-users-by-ids', …, actor)` без `catch` | `findUsers(userIds, actor)` | F |
| `u7-cli/src/cli-controller.ts:374,409` | `execute('list-users')`, `execute('get-user')` | Р9 | F |
| `u7-bot/tests/helpers/test-bot-transport.ts:189,203-209,414,423` | `userFacade` (опция, заглушка, `getUserByTelegramId`) | Р8 | F |
| `u7-bot/tests/helpers/test-app.ts:33,75`, `student-fate.ts:22` | `TestApp.userFacade`, `userFacade.getUserByTelegramId` | `userByTelegramId` (Р8) | F |
| `u7-bot/tests/{courses,e2e,learning,mentor,streams}/**` (28 файлов, 44 вызова `app.userFacade.getUserByTelegramId`) | список — `grep -rn "userFacade" runners/u7-bot/tests` | `await app.userByTelegramId(tg)` | F |

Остальные `.execute(` в `runners/` не про `user`: `infra/bot-transport.ts:548` (собственный метод транспорта), `cli-controller.ts:321` (общий вызов legacy-UC по имени, DEBT-42). Имена `'add-role'`/`'remove-role'`/`'register-guest'`/`'notify-user'`/`'create-user'` в `runners` вызовами не встречаются (только комментарий `ensure-registered.ts:14` — переписать).

### Прикладной слой

| Было | Станет |
|---|---|
| `U7BotUiAppResolve.userFacade`, `botAdminUser: User` | `botAdminUuid: string`; `userFacade` нет |
| актор `User` (`app-legacy/domain`, ISO-даты) | `U7BotActor = ReadonlyAr<UserAr>` (О1-А) |
| `U7BotUiStory.subjectOf` (мост Р5) | удалён; `submenu` — `actor.isMentor()/isAdmin()` |
| `UserController` + `NotifyStory` | удалены (С3) |
| `ensureRegisteredGuest(userFacade, actor, sender)` | `ensureRegisteredGuest(resolve, sender)` на `dispatch` |
| `execute('get-user')` ×14, `execute('get-users-by-ids')` ×8 | `findUser`/`findUsers` (`dispatch`, Def) |
| `TestApp.userFacade`, заглушка `registerGuest` | `TestApp.userByTelegramId`, настоящая регистрация |

## Сохраняемое поведение

Эталон — `../u7-school-v0.2.6/apps/u7-bot/src`; `ensure-registered.ts`, `school/controller.ts`, `submenu.ts` там совпадают с HEAD с точностью до импорта/Ф4.

**Регистрация (`ensure-registered.ts`; тест `ensure-registered.test.ts`, `core/ui-app.test.ts:147-190,626-690`).**
- Незнакомый `telegramId` на `/start` и на `member_joined`/`bot_membership` (с `byUser`) → создаётся `GUEST`: `telegramId` = id отправителя, имя = `first_name` (на `/start` — `update.name ?? 'друг'`), ник = `username` (без `username` — без ника). Регистрирует бот от лица `BOT_ADMIN_UUID` (политика UC не ослабляется — см. шапку файла).
- Знакомый → регистрации нет, диалог/меню дальше как обычно; `/start` после регистрации показывает welcome-экран («Привет», «u7 schools», кнопка `app:help`), `app/menu`, `seq++`.
- Отказ регистрации (не админ/сбой) — исключение наружу, не молчаливый пропуск. Нового: гонка `TELEGRAM_ID_TAKEN` — тихий успех (результат тот же, что у legacy: «возвращал существующего»).
- Старт бота: `BOT_ADMIN_UUID не найден: пользователь … не существует` (`create-ui-app.ts:84-88`, `main.ts:156`), `…нет роли ADMIN` (`main.ts:160`), лог «Верификация бота пройдена: ADMIN подтверждён».

**Роли и подписка сообщества (`school/controller.ts`; тест `school/controller.test.ts:140-260`).**
- Событие вне группы школы (`communityGroup.id`) → `'pass'`, `user`-UC не вызываются.
- `bot_membership(added, byUser)` и `member_joined` → пользователь по `telegramId`; есть → `SUBSCRIBER` добавляется; нет → пропуск; реакция `'stop'`. `member_left` → `SUBSCRIBER` снимается. Ошибка → `warn` «Ошибка при обработке события школьной группы: …» (источник `school-controller`), `'stop'`.

**Меню (`submenu.ts`).** Доступ — `MENTOR` или `ADMIN`; кнопка «🛠️ Инструменты ментора» `priority: 30`, у остальных (GUEST, SUBSCRIBER, гость-актор) нет; отказ «⚠️ У вас нет доступа к инструментам ментора\\.»; `start` → подменю, прочее → `unknownCommand`. Главное меню (`menuButtons`) и остальной UI от ролей не зависят.

**Анкеты, адрес респондента (`questionnaire-story.ts`; тесты `fill.dialog.test.ts`, `invite.story.dmg.test.ts`, `fill.story.events.test.ts`, кит).** Профиль — по `respondentId` без актора (подписка на событие); сообщение не отправляется (`warn`, источник — имя story, meta `{respondentId, questionnaireId}`): сбой чтения — «…сбой чтения профиля респондента» (+`error`), нет профиля — «…профиль респондента не найден». Тексты сохраняются; ветки «нет `telegramId`» нет (недостижима, п. 9). Успех — `telegramId` из профиля.

**Уведомления.** `notify-user`/`user.notified` удалены (С3); адресная доставка (приглашение желающих, «🎉 Курс завершён!», отзыв, неактивность) идёт Def-подписками stories и не меняется. Нет `NotifyStory` — нет `get-user` в `notify`.

**Профили в stories (по инвентарю).** Не найден/недоступен: имя ментора в карточке потока — пусто; имя в `view-stream`/`monitor`/`inactivity` — первые 8 символов uuid; профили менторов школы недоступны — список менторов опускается; приглашения peer-review при сбое профилей пропускаются; `hub.ts` — без `telegramId` уведомление не шлётся. Порядок `getUsersByIds` — как во входе, дедуп, пропуск ненайденных (`user-app.md`).

**Тесты, закрепляющие состав.** `grep` по `*.test.ts`: `create-ui-app.test.ts` (`UiAppBundle.schoolController`, `resolve.callers`), `core/ui-app.test.ts` (7 вызовов `makeUserFacade`), `core/u7-bot-controller.test.ts`/`u7-bot-ui-story.test.ts` (актор `User`), 4 e2e с `UserController` (`student-dmg`, `inactivity`, `stream-dmg`, `user-notify`), `modules/user/src/user.module.test.ts`/`domain/src/user/user.module.test.ts` (8 UC — не меняются). Вне границ перечислений ошибок/событий `user`, затрагивающих UI, нет.

## Тесты бота на перевод (раздел 3)

**Литералы и стабы legacy-UC (→ ответы `dmg` по имени `getUser`/`getUsersByIds`/`getUserByTelegramId`).**
- `'get-user'`: `streams/controller.test.ts:32`, `streams/controller.stream-group.test.ts:78`, `learning/stories/hub.test.ts:302,432`, `streams/stories/{inactivity.story.test.ts:157,448, view-stream.story.test.ts:79,761}`, `mentor/stories/{view-stream-mentor.test.ts:93,190,209,258,297,319, monitor.test.ts:154}`, `courses/stories/{wish-invite.story.test.ts:110, wish-confirmed.story.test.ts:72}`, `peer-review/stories/campaign.story.test.ts:125`, `user/stories/notify.story.test.ts:35` (удаляется), `questionnaire/stories/{questionnaire-dmg.test-kit.ts:220, fill.dialog.test.ts:488, invite.story.dmg.test.ts:213, fill.story.events.test.ts:34}` (последние три — `toHaveBeenCalledWith('get-user', …)` → `dispatchedOf`/`getUser` с `uuid`).
- `'get-users-by-ids'`: `school/stories/{school-reviews.story.test.ts:68, school-hub.story.test.ts:30,67,110}`, `peer-review/stories/{reviews-for-me:84,196, my-reviews:201,293,433, review-notify:61,148, invite:97,265,298, scope-reviews:82,239, campaign:127}.story.test.ts`.
- Фасадные заглушки: `ensure-registered.test.ts`, `core/ui-app.test.ts:49-56,115-184,626-690`, `create-ui-app.test.ts:22`, `school/controller.test.ts:156-260`, `streams/controller.stream-group.test.ts:81-90`, `tests/helpers/test-bot-transport.ts`.
- Акторы: фикстуры `User` (42 файла, 87 строк `createdAt: '…'`; 98 файлов импортируют `app-legacy/domain`, из них ~половина ради `User`) → `userSubject(...)` (О1-А).
- Кит `dmgDispatch` — допустимые модули + `UserModuleDef`.

**Red-тесты — характеризация (поведение `v0.2.6`, перенос на `dispatch`):**
- `ensure-registered.test.ts`: новый → `registerGuest` с `(tg, first_name, username)` от `botAdminUuid`; существующий → не вызывается; `ui-app.test.ts`: `/start` (новый/знакомый), `member_joined`, `bot_membership` — те же утверждения аргументов;
- `school/controller.test.ts`: четыре существующих сценария + «вне группы», «нет пользователя»;
- `questionnaire-story`/кит: два `warn` (нет профиля, сбой), успех;
- сайты stories — существующие тесты с теми же ожиданиями, стабы — `dmg`;
- `submenu.test.ts` — на актор (`userSubject`): MENTOR/ADMIN — кнопка и вход; GUEST/SUBSCRIBER — нет.

**Red-тесты — новое:**
- `ensureRegisteredGuest`: `TELEGRAM_ID_TAKEN` → успех без исключения; прочий `Err` (в т. ч. `ACCESS_DENIED`) → исключение; `getUserByTelegramId` с `Err ≠ NOT_FOUND` → исключение; ник не передаётся без `username`;
- `createUiApp`: нет админа → `Error('BOT_ADMIN_UUID не найден…')`; `actorResolver` — субъект с `isMentor()`, незнакомый `tg` → `Error('Пользователь с telegramId … не найден')`; `resolve` без `userFacade`;
- `u7-bot-ui-story.test.ts`: `findUser`/`findUsers` (найден; `NOT_FOUND` → `undefined`; прочий `Err` → исключение; пустой вход `findUsers` — без `dispatch`; актор и гость → `callers.resolve` с нужным `uuid`); `subjectOf` отсутствует;
- e2e: `/start` незнакомого `telegramId` → в `users.json` временного каталога появляется `GUEST` (имя, ник), второй `/start` — без дубля (проверить сначала, нет ли уже в `main-menu.e2e.test.ts`); вступление в группу школы → `SUBSCRIBER` — если нет e2e-покрытия (grep);
- `user-notify.e2e` — без `UserController`, те же три сценария (Р7).

**Судьба старых тестов (TST-08).** `notify.story.test.ts` (подписка `user.notified`, `get-user` → `telegramId`) — не переносится (С3); остальное — переносится стабами; «нет `telegramId` респондента» (кит/`fill`) — удаляется (п. 9); тесты роли в `submenu.test.ts` — не дублируются сверх Ф4.

**Базовая линия:** `bun run test:bot` — 894 pass (94 файла, `summary.md`); `CI=true bun test` — 3179 (с поправкой на `data/**` −113: 3158 → ориентир Ф4). Число не ниже с поправкой на удалённые `notify.story.test.ts` и перекрытые дубли `user-notify.e2e`.

## Внешние зависимости

- Def из `@u7-scl/domain/user/contract` (все уже экспортируются): `UserModuleDef`, `GetUserUcDef`, `GetUserByTelegramIdUcDef`, `GetUsersByIdsUcDef`, `RegisterGuestUcDef`, `AddRoleToUserUcDef`, `RemoveRoleFromUserUcDef`, `ListUsersUcDef`, `UserErrors`, `UserAr`/`UserView` (типы). Новых связей `dependsOn` нет (runners — вход, ARC-08); контракт `user` не меняется.
- `callers.resolve` (`U7CallerResolver`, Ф4) — единственный источник `Caller`; `dispatchModuleUc`/`requestTrace` (`core/dispatch-uc.ts`).
- Права Def: `getUser`/`getUserByTelegramId`/`getUsersByIds`/`listUsers` — `guest|user|system`; `registerGuest`/`addRoleToUser`/`removeRoleFromUser` — `user` с ролью `ADMIN` (поэтому вызывающий — `botAdminUuid`).

## Открытые вопросы

**О1 (стратегический — перепроектирование UI-модели). Тип актора stories.**
- **А (рекомендую, TR-61 «Пересмотреть»):** `U7BotActor = ReadonlyAr<UserAr>`; мост `subjectOf` снимается, роли — `isMentor()/isAdmin()`, `Role`/`User` из `app-legacy` уходят из `runners` (Ф7 сокращается на ~75 файлов `runners`). Цена: ~45 файлов фикстур (`userSubject`), `.view().name/.telegramId` в ~9 местах. Фикстуры 42 файла/87 строк `createdAt` нужно менять при любом варианте.
- **Б (Т14):** актор — `UserView` (числовые даты), `subjectOf` остаётся до Ф7 (`submenu`: проверка ролей без `roles.includes` невозможна без субъекта), `Role` — литералы. Меньше диффа в stories, но мост и «двойное чтение» живут дольше; `UserAr.restore` вне модуля недопустим.
- Без ответа брифы шагов исходят из А; смена на Б — правка Р1, Р2, Р10 и удаление `U7BotActor` из тестов.

**О2 (изменение поведения, одобрение Нурболата). Нет.** Видимых изменений нет: экраны и тексты прежние; гонка `TELEGRAM_ID_TAKEN` — тот же итог; ветка «нет `telegramId`» недостижима.

**О3 (тактический, но вне плана). `u7-cli`:** не стартует (DEBT-42), тестов нет. После Р9 `currentActor` (legacy `User`, передаётся в `execute` остальных legacy-UC, `cli-controller.ts:324,376`) получает `UserView` из `getUser`. Варианты: (а, рекомендую) `currentActor: UserView`, к legacy `execute` — явное приведение с пометкой DEBT-42; (б) убрать `/login` (изменение поведения — только с одобрением).

## Правила (ID `rules.md`)

Пакет: ERR-06 (явная ветка по `Err`), ERR-07 (`warn` без `requestId`, Р4 п. 3), ARC-04, ARC-06/ARC-07 (корень не меняется), CODE-02, CODE-04 (комментарии — только причина; ссылки на фазы не писать), TST-04, TST-06, TST-07 (`…/testing` — только тест-код), TST-08, TST-09. Проект: ARC-08 (runners вызывают операции через приложение, `dispatch`), ARC-04, ARC-06 (`checkModuleImports`, `arch:check`), ARC-10 (только `@u7-scl/*`). Гайды UI: `bot-ui-story.md` §2, §3 (исключения; `try/catch` только при специфичной реакции), §7 (тесты — обновить: актор), `bot-controller.md` §1, `bot-test.md` §2.

## Документы

`dmg-core` не правится — `docs:impact` не нужен. Проектные: `bot-ui-story.md` §7 (актор — `userSubject`, Def-моки вместо `execute`), `bot-controller.md:16,28` и `bot-architecture.md` — актор/`UserController`; `streams/ui-spec.md:84` (`get-user` → `getUser`), `peer-review/ui-spec.md:9` (`user.notified`/`NotifyStory`); комментарии п. 8 расхождений; `debt.md` — TR-61 «Ф5» и состояние `subjectOf` (orchestrator). `migration.md` §6, `conductor/roadmap/tasks-system-*.md` — Ф8.

## Риски

- **Одновременность чтений и записей (Т15).** После Ф5 бот пишет `users.json` новым репозиторием (числовые даты); legacy-чтение их отбрасывает. До Ф6 legacy-читатели `scripts/call-uc.ts:149`, `_course-client.ts:83` (`app.userFacade.getUserByUuid`) на файле, записанном ботом, получат «не найден». Деплоя и пуша до релиза нет (решение Нурболата, spec «Нефункциональные»), `scripts` — на `DB_DIR=./data/fixtures`, где запись — только после первой регистрации/роли; записать в `debt.md` как мост до Ф6.
- **Нагрузка чтения:** с Ф4 каждая команда — `getUser` (резолв `Caller`), `actorResolver` — два чтения; число пользователей мало, мониторить не нужно, но не оптимизировать в срезе.
- **Объём:** один коммит с ~110 файлами; flash-шаг с гейтом `agent-gate`/`numstat` по каждому подпакету (`streams`, `peer-review`, `tests/e2e`).

## Критерии приёмки

- `grep -rnE "'(get-user|get-users-by-ids|get-user-by-telegram-id|register-guest|add-role|add-role-to-user|remove-role|remove-role-to-user|notify-user|list-users|create-user)'" runners --include=*.ts` — пусто (сюда входят и тесты).
- Многострочные: `grep -rPzo "execute\(\s*'(get-user[a-z-]*|register-guest|add-role[a-z-]*|remove-role[a-z-]*|notify-user|list-users|create-user)'" runners --include=*.ts` — пусто; `grep -rn "\.execute(" runners --include=*.ts` — только `infra/bot-transport.ts:548`, `cli-controller.ts:321`.
- `grep -rniE "userFacade|UserFacade|botAdminUser|subjectOf" runners --include=*.ts --include=*.md` — пусто.
- `ls runners/u7-bot/src/controllers/user` — нет; `grep -rnE "UserController|NotifyStory|user\.notified|UserNotifiedEvent" runners` — пусто.
- (О1-А) `grep -rnE "import (type )?\{[^}]*\b(User|Role)\b[^}]*\} from '@u7-scl/(app-legacy|user)" runners --include=*.ts` — пусто, кроме `u7-bot/tests/worlds/**` (Ф7); `grep -rn "roles.includes\|roles.some" runners/u7-bot/src` — пусто.
- `grep -rn "Ar\.restore\|new UserAr" runners --include=*.ts` — пусто (D-69; `userSubject` — через `…/testing`).
- `grep -rn "@u7-scl/domain/user/testing" runners --include=*.ts` — только `*.test.ts`, `*.test-kit.ts`, `tests/**`.
- Характеризация: сценарии раздела 3 существуют и зелёные (`ensure-registered`, `ui-app /start|member_joined|bot_membership`, `school/controller`, `submenu`, анкеты, e2e `main-menu`/`student-dmg`/`stream-dmg`/`inactivity`/`user-notify`); новые red→green: `TAKEN`, `createUiApp`, `findUser`/`findUsers`, e2e `/start`.
- `bun run check` зелёный (lint, типы, `arch:check`, `gen:e2e`, `bun test`); `bun run test:bot` — не ниже 894 с поправкой на удалённые тесты `NotifyStory`/дубли; `git status data/` чист.
- Ревью: `error` нет; `debt.md` — запись TR-61 «Ф5»; красной зоны нет.
