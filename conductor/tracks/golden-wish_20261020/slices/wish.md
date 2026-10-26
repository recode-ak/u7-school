# Бриф среза: модуль `wish` (эталон)

Читай до старта: `../spec.md`, `../plan.md` (текущая фаза), `conductor/architecture/` — `naming.md`, `manifests.md`, `errors-result.md`, `domain-modeling.md`, `rules.md`. Образец формы — учебный модуль `packages/dmg-core/src/testing/example/` (`todo`, `users`).

Срез идёт **фазами по виду артефакта** (план). Агент получает путь к брифу и номер фазы; делает только её.

## Границы

- Домен: `packages/domain/src/wish/**`. Прикладной слой: `packages/wish/src/**`.
- `dependsOn`: `user`, `course`, `questionnaire`, `stream` — только через `@u7-scl/domain/<dep>`.
- Точечно: вызывающие stories и тесты `apps/u7-bot` (Ф12, сосуществование), `scripts/call-uc.ts`.
- Не трогать: `data/`, `packages/dmg-core` (кроме эскалации), чужие модули, их контракты и фасады.
- Структура — `bun run gen … --adopt` (задача Ф0); руками только перенос содержимого.

## Решения брифа

- **Уникальность — доменное правило `WishRules.unique` (Ф6–7, D-40; в Ф5 было DCS); DQS нет; DCS — `WishFulfillmentDcs` (Ф10: батч по желаниям пользователя, DOM-06).** `list-user-wishes` — query UC, читает один агрегат через репозиторий; output выводится из схемы entity. Гайд «dcs/dqs» описывает критерий выбора, эталон DCS/DQS — в `stream`.
- **Job нет.**
- **Формат данных не меняется:** `F.timestamp` читает ISO-строку и число, пишет число. Репозиторий проверяется на `DB_DIR=./data/fixtures`.
- **Пулы анкет** (`wish/pools/course-pool.ts`, `course.json`) остаются доменными данными модуля, путь не меняется.

## Ф0: контракты зависимостей (D-37)

API платформы — [review-fixes.md](../review-fixes.md) (подпути `dmg-core` / `dmg-core/app`, D-33…D-37). Образец внешнего модуля — тест `packages/dmg-core/src/arch/check-defs.test.ts` («внешний модуль»).

**Шаг 1 — domain-author** (`packages/domain/src/{user,course,questionnaire,stream}`):
- Def событий — на финальных путях naming.md (при миграции модуля контракт остаётся):
  - `stream/student/student.events.ts` — `StudentEvents.enrolled` (`stream.student.enrolled`): `studentId`, `userId`, `streamId`, `moduleId`;
  - `stream/stream/stream.events.ts` — `StreamEvents.created` (`stream.stream.created`): `streamId`, `moduleId`;
  - `questionnaire/questionnaire/questionnaire.events.ts` — `QuestionnaireEvents.completed`, `.abandoned` (`questionnaire.questionnaire.*`): `questionnaireId`, `respondentId`, `owner` (`v.record(v.string(), v.unknown())` — данные владельца анкеты, модуль анкет их не толкует), у `abandoned` — `reason?` (`timeout | by_user`).
  - Поля через `F.*`, `v.description()` на каждом; label/description у событий. Только поля, нужные контракту, не весь legacy-payload.
- `<m>/<m>.module.ts` — `defineModule({ external: true })` для `user`, `course`, `questionnaire`, `stream`; `dependsOn` — по `DOMAIN_GRAPH` (`scripts/domain-debt.ts`); агрегаты — минимальные `defineAggregate` (state `v.object({ ...BaseEntityFields })`, события группы, `defineErrors('<AGG>', {})`); у `user`/`course` агрегатов нет; фасад не объявляется (legacy-фасады — не `defineFacade`).
- `contract.ts` каждого модуля реэкспортирует `<M>ModuleDef` и группы событий. Коллизии имён с legacy-экспортами `index.ts` — эскалация.
- Тест: `checkDefs` по внешним модулям — без нарушений (MAN-01/02/03/08, ARC-05).

**Шаг 2 — api-author** (`packages/stream`, `packages/questionnaire` — владельцы legacy-формата):
- `src/legacy-inbound.ts` — `LegacyInbound[]` (`@u7-scl/core/legacy-bridge`): `student.enrolled` → `StudentEvents.enrolled`, `stream.created` → `StreamEvents.created`; `questionnaire:complete` / `:abandon` → `QuestionnaireEvents.*`, перевод `{ ...payload, owner: ownerInfo }`.
- Тест доставки на **реальном** legacy-событии: событие строит legacy-агрегат (`StudentAr` зачисление, `StreamAr` создание, `QuestionnaireAr` завершение/прерывание), публикуется в `InProcEventBus`, подписчик DMG через `legacyEventBus(legacy, { inbound })` получает конверт Def с ожидаемым payload; payload вне схемы → `onInvalid`.
- Подключение карты в `apps/u7-bot` — Ф12, не сейчас.

## Ф1: State

**Шаг 1 — domain-author, платформа** (`packages/dmg-core/src/kernel/fields`, `domain/aggregate`; выход за границы согласован с Нурболатом): запись без `updatedAt` читается как `updatedAt = createdAt` — по образцу `version` (D-36), миграция данных не нужна. В legacy `updatedAt` появляется только после первой мутации; так же у `user`, `course`.
- Авторы state по-прежнему пишут `v.object({ ...BaseEntityFields, … })`; тип вывода `updatedAt` — обязательный `Timestamp`. DOM-11 не ослабляется.
- Фолбэк работает при любом разборе сырых данных схемой state (репозиторий в Ф6 парсит `def.state`); граф (`graph/normalize`), JSON Schema и `checkDefs` не ломаются.
- Место и способ — на твоё усмотрение, с обоснованием в отчёте. TDD: запись без `updatedAt` → `createdAt`; с `updatedAt` → без изменений.

**Шаг 2 — migrator** (`packages/domain/src/wish/**`, потребители в `packages/wish`, `apps/u7-bot`, `scripts`). Решение Нурболата по эскалации: в Ф1 — только структура и имена, базовые поля и даты — Ф2.
- `wish/wish.state.ts` — **вручную** по шаблону `stateSrc` (`scripts/gen/kinds/aggregate.ts`): gen без паспорта модуля не работает, а `gen module` создал бы артефакты Ф2–Ф12 (отклонение согласовано). `entity.ts` → `wish.state.ts`, `entity.test.ts` → `wish.state.test.ts`, `entity.ts` удаляется; `state.ts` реэкспортирует `wish/wish.state`.
- Имена по образцу `todo/task/task.state.ts`: `WishState` (схема и тип), `WishTarget`, `WishStatus`. Старые имена `WishSchema`/`Wish`/`*Schema` — переименовать у потребителей, без алиасов.
- Поля через `F.*` (`F.uuid('пользователя')`, `F.picklist`), `v.description()` на каждом поле, включая ветки `target`; цель — `F.uuid('курса')`/`F.uuid('модуля')` вместо схем `course`.
- **Не трогать в Ф1:** `uuid`, `createdAt`, `updatedAt` — как есть (строки ISO, DEBT-24 остаётся, маркеры переносятся вместе с полями). `BaseEntityFields` и `F.timestamp` — Ф2 вместе с `WishArDef`.
- `WishArMeta` (core `ArMeta`, DEBT-21) — в `a-root.ts`: это мета Ar, уходит в Ф2. Места DEBT-21 и DEBT-24 в `debt.md` — путь `wish.state.ts`.
- Поведение и формат данных не меняются; логика Ar, Policy, UC, репозитория — не трогать.

## Ф2: Агрегат

Образец — `packages/dmg-core/src/testing/example/todo/task/task.ar.ts` (+ тест). Решение оркестратора — TR-1 (`debt.md` §6).

**Шаг 1 — domain-author** (`packages/domain/src/wish/**`):
- `wish.state.ts` — `v.object({ ...BaseEntityFields, … })`, даты через `F.timestamp` (читает ISO-строку, в т. ч. без зоны, и число; пишет число); маркеры DEBT-24 и `biome-ignore` DOM-11 под ним снять, запись DEBT-24 в `debt.md` удалить (гасится этой задачей).
- `wish/wish.ar.ts`: `WishArDef = defineAggregate({ … })` — `statuses` (6), `transitions` `confirm/abandon/cancel/fulfill` с `from`/`to`/`rejects` по двум веткам (поведение — §«Сохраняемое поведение»); `WishAr extends Aggregate<typeof WishArDef>`: приватный конструктор, `static create(input, at: Timestamp): Result` (вход — `uuid`, `userId`, `target`, начальный статус `expressed | pending` или две фабрики — на твой выбор с обоснованием), `static restore(snapshot)`, `snapshot()` — только для репозитория; переходы возвращают `Result`. Предикаты `canConfirm/…` оставить, если платформа не даёт свой способ спросить «возможен ли переход» (ER на них держат идемпотентность).
- **TR-1:** `wish/wish.errors.ts` — `WishErrors` только с ошибками отказов переходов (коды `WISH_*`, `kind`); `wish/wish.events.ts` — `WishEvents` минимально, сколько требует `defineAggregate` (Ar в legacy событий не порождает — новых событий не добавлять). Legacy `errors.ts`, `events.ts`, `contract.ts` и их экспорты не трогать — их переводит Ф3–4. Коллизия имён с legacy-экспортами — эскалация.
- `a-root.ts` удалить (с ним `WishArMeta`, `isoNow`, импорты `core` из Ar; маркеры DEBT-21 остаются там, где ещё есть импорты `core`), тест — в `wish.ar.test.ts`; `uuid` и время приходят входом — в домене нет `crypto.randomUUID()`/часов (DOM-14).
- Реэкспорты домена (`index.ts`, `state.ts`, `contract.ts`) — по необходимости, без алиасов старых имён.
- TDD: тесты на каждый переход (успех + каждый `rejects`), `create`, `restore` записи без `updatedAt`/`version` (фолбэк D-36), `snapshot` — round trip.
- Потребители в `packages/wish`, `apps/*`, `scripts` — **не трогать**, это шаг 2: гейт по ним будет красным, это ожидаемо. Пакет `packages/domain` — зелёный.

**Шаг 2 — migrator** (`packages/wish/src/**`, вызывающие в `apps/u7-bot`, `scripts`):
- Потребители `WishAr`: `create(…, at)` — `uuid` и время берутся в прикладном слое (порт/часы, как у соседних UC; без `Date.now()` в домене); `Result` переходов: `err` → прежнее legacy-исключение с тем же текстом/кодом, чтобы поведение UC/ER не изменилось (замена `throw*` на `Result` — Ф3–4).
- `infra/db/wish-json-repo.ts`: разбор записи через `WishArDef.state` (фолбэк `updatedAt`, иначе `JsonFileRepo` теряет записи без `updatedAt`); восстановление — `WishAr.restore`, запись — `snapshot()`. Тест на legacy-записи: ISO без зоны, без `updatedAt`/`version` — читается, не теряется.
- Где даты wish уходят наружу (output UC, stories, тексты) — числа вместо строк не должны изменить видимое пользователю. Если меняется — эскалация.
- Базовая линия: `bun run check` зелёный, тестов wish не меньше, чем до фазы.

**Шаг 3 — гайд «aggregate»** (оркестратор / domain-author) и дополнение гайда «state» (`BaseEntityFields`, `F.timestamp`, фолбэк `updatedAt`).

## Ф3–4: События и ошибки

Образец — `packages/dmg-core/src/testing/example/todo/task/task.{events,errors,ar}.ts` (событие порождает переход Ar через `emit`). Решения: открытые вопросы 1 (FQN, stories переписываются) и 6 (TR-3, `conflict`). UC/ER остаются legacy-классами до Ф8/Ф10, UoW — Ф6: **`Result` до вызывающих UC не доходит**, legacy-исключения поднимаются из ошибок `WishErrors` (код, `kind`, текст `label`, `payload`).

**Шаг 1 — domain-author** (`packages/domain/src/wish/**`):
- `wish.events.ts` — `WishEvents.invited` (`wish.wish.invited`), `WishEvents.confirmed` (`wish.wish.confirmed`); payload — поля нынешних интерфейсов `WishInvitedEvent`/`WishConfirmedEvent` (`events.ts`) через `F.*`, `v.description()` на каждом, label/description у событий. Прошедшее время — уже так.
- `confirmed` порождает переход `WishAr.confirm` (`emit`, как `TaskEvents.completed`). `invited` состояние не меняет: метод Ar без перехода, порождающий событие, или событие строит ER — выбор с обоснованием в отчёте (критерий — `domain-modeling.md`, где решение «пригласить»; telegramId — адресация, домен его не знает? решить, оставить ли поле в payload: stories на нём держат отправку — поведение UI сохраняется).
- `wish.errors.ts` — к 4 ошибкам переходов добавить ошибки UC: `WISH_ALREADY_EXISTS` (`conflict`, payload `{ userId, courseId?, moduleId?, status }`), `WISH_NOT_FOUND` (`not_found`), отказы «курс/модуль недоступен для записи» — `COURSE_NOT_FOUND`/`MODULE_NOT_FOUND` заняты модулем `course` (коды уникальны в приложении, errors-result.md §2) → `WISH_COURSE_NOT_FOUND`/`WISH_MODULE_NOT_FOUND` (или точнее по смыслу — с обоснованием), `kind: 'not_found'`, payload из legacy-типов. `label` — прежние тексты исключений UC.
- Legacy `events.ts`, `errors.ts` удалить; `contract.ts`, `index.ts` реэкспортируют группы, без алиасов. Маркеры DEBT-21 снимаются вместе с импортами `core`.
- TDD: Ar — событие `confirmed` в результате `confirm` (и нет событий при отказе); схемы payload — допустимый/недопустимый payload; коды групп уникальны (контрактный тест, если платформа его даёт).
- Потребители — шаг 2, гейт по `packages/wish`, `apps/u7-bot` красный ожидаемо.

**Шаг 2 — migrator** (`packages/wish/src/**`, `apps/u7-bot` stories `wish-invite`, `wish-confirmed`, `course-catalog` и их тесты, e2e `user-notify`, `scripts`):
- UC: `throwError(errNotFound<…>/errConflict<…>)` → исключение из ошибки `WishErrors` одной функцией-мостом (обобщить `api/legacy-reject.ts`; переиспользовать конвертер `Err → AppException`, которым пользуется `appApi.execute`, если он доступен прикладному слою, — не писать второй). Отказ переходов больше не `BAD_REQUEST`: код `WISH_NOT_*`, `kind` из Def (TR-3).
- ER `confirm-wish`, `invite-wishers`: события строятся из Def (`WishEvents.*.make` или события Ar) и публикуются через `legacyEventBus(legacy)` (`@u7-scl/core/legacy-bridge`) — legacy-подписчики получают FQN как `eventName`. Шину DMG ER получают из резолвера/wiring без нового контракта; если без правки `app`/`core` нельзя — эскалация.
- Stories `wish-invite`, `wish-confirmed`: подписка на FQN (`WishEvents.*.name`), тип события — из Def, интерфейсы legacy удалены. Тексты и адресация — без изменений.
- Видимое пользователю не меняется: бот ветвится по `kind` (`conflict` у create, `not-found` у cancel), отказ перехода в `cancel-wish` и раньше уходил в `errorNotify`. Если `errorNotify` или иной вызывающий различает `kind`/код так, что текст сменится, — эскалация.
- Базовая линия: `bun run check` зелёный, тестов wish не меньше 123.

**Шаг 3 — гайды «events» и «errors»** (оркестратор): форма Def, кто порождает событие, FQN и подписка legacy, коды и `kind`, мост в legacy-исключение.

## Ф5: Policy

Образец — `packages/dmg-core/src/testing/example/todo/task/task.policy.ts` (+ тест). Legacy `wish/policy.ts` — не политика прав, а вопрос о статусе (`isActive`), его зовут `create-*-wish` UC и `wish-json-repo`. Прав в UC сейчас нет: желание ищется по `userId` вызывающего, владение неявное.

**Развилка (открытый вопрос 7):** где правило «не более одного активного желания на (user, target)». Policy отказывает `ACCESS_DENIED` (`kind: access`) с `denyMessage` — а бот ветвится по `conflict` и `payload.status` существующего желания (`course-catalog`, `#handleApply`), то есть перенос правила в Policy меняет поведение для пользователя. Решение Нурболата — вариант A.

**Шаг 1 — domain-author** (`packages/domain/src/wish/**`), по варианту A:
- `isActive` → метод-вопрос Ar (`WishAr.isActive()`), статусы — из Def; legacy `policy.ts` удалить.
- Правило уникальности — доменное решение по нескольким агрегатам (DOM-06): функция DCS/доменного сервиса над активными желаниями пользователя на цель, `Result` с `WISH_ALREADY_EXISTS` (`conflict`, `status` существующего). Имя и файл — по naming.md; решение брифа «DCS нет» пересматривается этой задачей.
- `WishPolicy = definePolicy(...)` — только права: `canCancel` (владелец желания, `rule` с `label`/`denyMessage`); для `create-*` — право «пользователь выражает желание за себя» или `allowAll`, с обоснованием. Без спекулятивных правил.
- TDD: каждое правило — разрешение и отказ; DCS — нет активных / есть активное каждого статуса / есть только неактивные.

**Шаг 2 — migrator** (`packages/wish/src/**`): UC зовут DCS и Policy вместо `WishPolicy.isActive`; отказ DCS — через мост `throwWishError` (TR-1); отказ Policy — ветка, которой сейчас нет (новых отказов в боте быть не должно — правила совпадают с текущим поведением). Видимое пользователю не меняется.

**Шаг 3 — гайд «policy»** (оркестратор): критерий Policy vs DCS vs метод-вопрос Ar на примере уникальности.

## Ф6–7: доменное правило, репозиторий, генератор фасада

Решения: D-39 (доступ к state), D-40 (доменное правило без субъекта), D-38 (фасад по потребителю). Форма API — решение Нурболата (2026-10-20), ниже.

**Шаг 1 — domain-author, платформа** (`packages/dmg-core/src/**`; выход за границы согласован с Нурболатом). Образец формы — `domain/policy/{policy,define-policy}.ts`.
- `domain/rules/domain-rule.ts` — `domainRule({ name, label, description, error, check })`: `error` — `ErrorDef` группы (из `defineErrors`), `check(ctx: C) => Result<void, ErrorOf<E>>`; тип запрещает вернуть ошибку другого `ErrorDef` (DOM-16 машинно, тест на `@ts-expect-error`). Без субъекта: `check` получает только контекст. Возврат — `{ dmg: 'domainRule', name, label, description, error, check }` (свойство, а не метод — контравариантность, как у `Rule.evaluate`). Типы `AnyDomainRule`, `DomainRuleContextOf<R>`.
- `domain/rules/define-rules.ts` — `defineRules({ name, label, description, rules: { <key>: domainRule(...) } })` → `RulesDef` (`dmg: 'rules'`), по образцу `definePolicy`. Файл в модуле — `<aggregate>/<aggregate>.rules.ts`, объект `<A>Rules`.
- Def UC (`defineUseCase`): необязательное поле `rules?: readonly AnyDomainRule[]` рядом с `policy`. `UseCaseFromDef`: порядок `callers → вход → load → Policy → rules → execute → выход → commit`; правила исполняются над `loaded` (как Policy, в т. ч. для `system`), первое `err` — ответ UC, `execute` не вызывается, UoW не создаётся. Контекст: `L` расширяет контекст Policy **и** контексты всех правил (пересечение по кортежу, как `Contexts<R>` в `policy.ts`). Тип ошибок UC не расширяется автоматически.
- `checkDefs`: ошибка каждого правила из `rules` UC объявлена в `errors` UC (новое нарушение с ID правила, по образцу соседних; ID — DOM-16 или MAN-*, выбери по смыслу `rules.md` и обоснуй). Дубли правил в `rules` UC — нарушение, если это дёшево.
- Граф и манифест (`graph/normalize.ts`, `def-index.ts`, `described-defs.ts`): правило — узел с `name`/`label`/`description`/кодом ошибки; UC ссылается на правила; `defineRules` — описанный Def (label/description проверяются, как у Policy).
- Экспорт: корень `dmg-core` (домен) — `domainRule`, `defineRules`, типы.
- Учебный модуль `testing/example/`: одно правило без субъекта (например, «у пользователя не больше N открытых задач» или уникальность заголовка) в `<a>.rules.ts`, UC ссылается на него; тест UC: отказ правила возвращает его ошибку и ничего не фиксирует.
- TDD (red → запуск → green по шагам): `domainRule` ok/err; тип ошибки чужого `ErrorDef` не компилируется; `UseCaseFromDef` — порядок (Policy отказала → правила не вызваны; правило отказало → `execute` не вызван); `checkDefs` — необъявленная ошибка правила; граф — узел правила и ссылка UC.
- Не трогать: `packages/domain`, `packages/wish`, `conductor/` (naming.md, rules.md правит оркестратор). Генераторы — не в этом шаге.

**Шаг 2 — domain-author** (`packages/domain/src/wish/**`), по D-39/D-40. Образец — `packages/dmg-core/src/testing/example/todo/task/task.rules.ts`.
- `wish/wish.rules.ts` — `WishRules = defineRules({ … rules: { unique: domainRule({ error: WishErrors.ALREADY_EXISTS, check }) } })`: логика `WishDcs.checkUnique` без изменений (все желания, `isOwnedBy` + `isFor` + `isActive`). Контекст — `{ userId, target, wishes: readonly ReadonlyAr<WishAr>[] }`; тип цели — из входа Ar (`CreateWish['target']`), не из state (DOM-01 для `*.rules.ts`).
- `WishAr.alreadyExists(): Result<never, …ALREADY_EXISTS>` (или `ErrorOf<…>` — по образцу платформы, с обоснованием): строит ошибку с `userId`, `courseId | moduleId`, `status` из своего state. Геттер `status` удалить (DOM-04, D-39); при необходимости других потребителей геттера — эскалация.
- `wish.dcs.ts` (+ тест) удалить — мутаций нескольких агрегатов нет (DOM-06); тесты переносятся в `wish.rules.test.ts` (нет активных / активное каждого статуса / только неактивные / чужие и на другую цель отбрасываются).
- Реэкспорты (`index.ts`, `contract.ts`) — `WishRules` вместо `WishDcs`, без алиасов.
- Потребители в `packages/wish` — шаг 3, гейт по ним красный ожидаемо.

**Шаг 3 — migrator** (`packages/wish/src/**`): `create-course-wish-uc.ts`, `create-module-wish-uc.ts` зовут `WishRules.rules.unique.check({ userId, target, wishes })` вместо `new WishDcs().checkUnique(…)`; отказ — тот же мост `throwWishError` (TR-1). UC — legacy-классы до Ф8, `rules` в Def UC подключается там. Видимое поведение не меняется; тестов `wish` не меньше, чем до шага.

**Шаг 4 — domain-author, платформа** (`packages/dmg-core/src/**`; замечания `warn` приёмки правок платформы, §«Отчёты агентов»):
- `assertVersion` (`app/uow/repository.ts`) не отличает новый агрегат от записи версии 0: `create` с занятым uuid перезапишет legacy-запись без `version` (их много в `data/wish`). Нужно: агрегат знает, новый ли он (`create` → новый, `restore` → нет; форма — на твой выбор, например `isNew` в `Versioned`); новый + запись есть → `VersionConflict`; восстановленный + записи нет или версия иная → `VersionConflict`; восстановленный legacy без `version` (0) + запись без `version` → ок. Сигнатуру `assertVersion` можно менять (вызывающие — `app.fixture.ts`, `task.json-repo.ts` примера; в `packages/*` пока нет). После успешной записи агрегат больше не «новый» (повторный `save` в том же UoW, если возможен, — не конфликт; проверь, бывает ли).
- События при `VERSION_CONFLICT` на N-м агрегате UoW: записанные до него агрегаты остаются (D-15), их события не публикуются. Исправь, если это делается без отката записанных и без нарушения D-15 (например, публиковать события записанных), иначе — не меняй и опиши в отчёте точное поведение: документ `errors-result.md` §3 правит оркестратор.
- TDD: каждая ветка сверки; UoW — create с занятым uuid → `VERSION_CONFLICT`, legacy-запись не изменена.
- Не трогать: `packages/domain`, `packages/wish`, `conductor/`.

**Шаг 5 — migrator** (`packages/domain/src/wish/**`, `packages/wish/src/**`, вызывающие в `apps/u7-bot` (`src/create-api-app.ts`, `tests/helpers/test-app.ts`), `scripts/call-uc.ts`). Образец — шаблон `scripts/gen/kinds/app-aggregate.ts` и `packages/dmg-core/src/testing/example/app/todo/{task/task.repo.ts,infra/task.json-repo.ts}` (+ тест).
- Порт `packages/wish/src/wish/wish.repo.ts`: `WishRepo = Repository<WishAr> & { … }` (`dmg-core/app`), методы принимают и возвращают `WishAr` (API-03), не state. Набор — по нынешним потребителям, имена по образцу (`find*`): `findById`, `findAllByUserAndTarget`, `findByUser`, `findAllByKind(kind, statuses?)` и замена `getByUserAndTarget` (выбор «среди активных — последнее созданное, иначе последнее» сохраняется как есть; это решение, а не хранение — уйдёт из репозитория в Ф9–11, оркестратор записывает TR). `getByUuid` → `findById`. `Result` в порте не нужен: чтение — `Ar | undefined`, `save` бросает `VersionConflict` (контракт `Repository`).
- Доменный `wish/repo.ts` удалить. `WishApiModuleResolver` ссылается на порт — его объявление переезжает из `packages/domain/src/wish/module.ts` в прикладной пакет (домен не импортирует `packages/<m>`); `WishApiModuleMeta` остаётся в домене. Импорты вызывающих — из пакета `@u7-scl/wish` (подпуть — на твой выбор, без алиасов). Маркер DEBT-22 идёт вместе с импортом `U7ModuleResolver`.
- `infra/db/wish-json-repo.ts` → `infra/wish.json-repo.ts` (тест — рядом, `wish.json-repo.test.ts`) по шаблону gen: `aggregate = WishArDef`, `createLock`, `assertVersion(this.aggregate, ar, stored)`, запись `ar.snapshot()`, разбор **строго** `v.parse(v.array(WishArDef.state))` — решение Нурболата (2026-10-21): битая запись — исключение, файл без неё не перезаписывается (legacy пропускал с бэкапом). `JsonFileRepo` и импорт `@u7-scl/core/infra` уходят. Путь файла — обязательный аргумент конструктора (вызывающие уже передают).
- Потребители (`api/wish-uc.ts`, UC `create-*`, `cancel-wish`, `list-user-wishes`, ER `confirm/abandon/fulfill/invite-wishers`): работают с `WishAr` из репозитория вместо `restore(state)`; `save(ar)` вместо `save(ar.snapshot())`. `list-user-wishes` по-прежнему отдаёт state наружу (`snapshot()` в UC — до Ф9, output UC не меняется). UC/ER остаются legacy-классами, UoW подключается в Ф8 — порт уже `Repository<WishAr>`.
- Видимое поведение не меняется; тексты, коды, `kind` — прежние. Новое поведение — только конфликт версии (`VersionConflict`) и строгий разбор: тесты на оба.
- TDD: тест репозитория по образцу шаблона gen (save/findById round trip; устаревшая версия → `VersionConflict`; `create` с занятым uuid → `VersionConflict`, запись не изменена; битая запись → исключение, файл не изменён; legacy-запись без `updatedAt`/`version`, ISO без зоны — читается и сохраняется с `version: 1` после перехода) + каждый `find*`. Тест на `DB_DIR=./data/fixtures` — следующая задача, не сейчас.
- Не трогать: `data/`, `packages/dmg-core`, `conductor/`. Тестов `wish` не меньше, чем до шага.

**Шаг 6 — api-author** (только тесты `apps/u7-bot/tests/**`). `DB_DIR=./data/fixtures` — материализация мира `core-education` (`tests/worlds/materializer.ts`, `seed:fixtures`); тесты работают с её копией через `loadFixtures`/`createTestApp` (`tests/helpers/`). В `data/fixtures` и `data/` не писать.
- Интеграционный тест (рядом с `tests/courses/wish-flow.integration.test.ts`, имя — по соседям): в копию `${fixtures.dbDir}/wish/wishes.json` кладётся **сырая** legacy-запись (`createdAt` — ISO-строка без зоны, без `updatedAt`/`version`) на курс мира; затем путь через приложение, как у соседних тестов (`appApi`/story — по образцу), например `cancel-wish` или `list-user-wishes`:
  - чтение: запись видна (ISO разобран, `createdAt` — ожидаемое число);
  - запись после перехода (`cancel-wish`): в сыром файле `createdAt`/`updatedAt` — числа, `version: 1`, статус `cancelled`; соседняя legacy-запись после записи файла тоже с числами (формат spec, TR-2) и не потеряна.
- TDD: тест сначала запускается; если он зелёный сразу (поведение уже есть) — так и отметь в отчёте, без подгонки кода. Прод-код не меняется; если без его правки тест не проходит — эскалация.

**Правки по ревью Ф6–7** (замечания `warn`, отчёт «Ревью Ф6–7» в конце брифа). Шаги 8 и 9 независимы.

**Шаг 8 — api-author** (только тесты: `packages/wish/src/infra/wish.json-repo.test.ts`, `apps/u7-bot/tests/courses/wish-legacy-records.integration.test.ts`):
- Интеграционный тест: ожидания дат — явное UTC (`Date.UTC(...)`), не `new Date(iso)`; проверить, что тест зелёный и при `TZ=Asia/Oral bun test <файл>`.
- Тест репозитория — пробелы: (а) цель `module` хотя бы в `findAllByUserAndTarget` и `findCurrentByUserAndTarget` (и `module` ≠ `course` с тем же id); (б) восстановленный агрегат, записи нет → `VersionConflict`; (в) несколько активных — берётся последнее созданное; (г) битая запись — проверка типа исключения (`ValiError` valibot), плюс невалидный JSON и не-массив — исключение, файл не изменён; (д) фабрика `makeWish` не подменяет статус молча — статусы строятся переходами Ar или `restore` явно; (е) временный каталог — `tmpdir()`, как в примере платформы.
- Прод-код не меняется; если тест вскрывает дефект — эскалация, не чинить.

**Шаг 9 — domain-author, платформа** (`packages/dmg-core/src/**`): узел доменного правила в графе — id с агрегатом-владельцем ошибки (`<модуль>.<агрегат>.<name>`), чтобы правила с одинаковым `name` у двух агрегатов модуля не сливались; `describedDefs` строит заголовок правила от того же владельца (модуль ошибки, а не модуль UC). TDD: два агрегата одного модуля с правилом `unique` — два узла, `usedBy` раздельно; правило чужого модуля в UC — id и заголовок по владельцу ошибки. Не трогать `packages/domain`, `packages/wish`, `conductor/`.

## Ф8: эталонный UC `create-course-wish`

Решения: D-41 (место межмодульного эффекта — выбор Нурболата; здесь вариант 1: `startStandard` в `execute` после `uow.register`, до фиксации), D-42 (фасад без манифеста, `calls` — Def UC других модулей, вызывающий `module`), TR-9 (каркас модуля в Ф8, legacy-UC рядом до Ф12).

**Шаг 1 — domain-author, платформа (Opus)** (`packages/dmg-core/src/**`, `scripts/gen/**` — шаблоны и тесты генератора, где они ссылаются на фасад). Образец переделки — шаг 1 Ф6–7 (доменное правило).
- **Убрать фасад из манифестов:** `defineFacade`, `method`, `FacadeDef`/`FacadeApi`/`AnyFacadeDef`, поле `facade` в `defineModule`, `ModuleFromDef` и `ModuleMap`, `implementFacade`, `guard-calls` (заменяется проверкой ниже), узлы фасадов в графе (`normalize`, `def-index`, `described-defs`), экспорт из корня и `dmg-core/app`; `gen module --facade` и шаблоны фасада. Ничего «на всякий случай» не оставлять.
- **`calls`:** необязательное поле `calls?: readonly AnyUseCaseDef[]` у `defineUseCase`, `defineEventReaction` (заменяет `calls: AnyFacadeDef[]`), `defineJob`. Ссылки — объектами (MAN-07).
- **Вызывающий `module`** (`kernel/caller`): `{ kind: 'module', from, origin }` — `from` — Def вызвавшего UC/ER/Job, `origin` — исходный `Caller`; `subjectOf` — субъект `origin` (рекурсивно). Policy вызываемого UC проверяется (не как `system`). Транспорт его не строит.
- **Отказ в `UseCaseFromDef`:** `module` не в `callers` — `UNAUTHORIZED` (как сейчас); `module`, но Def вызываемого UC нет в `from.calls` — тоже отказ до `load` (код и payload — по смыслу `CoreErrors`, обоснуй; MAN-05).
- **Помощник для фасадов** (`dmg-core/app`): реализация фасада в пакете модуля вызывает UC своего модуля без ручной сборки `Caller` — например, контекст вызова `{ from, caller, trace }`, который вызывающий UC/ER/Job получает от базы (`this.callContext(caller)` или аналог; у `execute` сейчас нет `trace` — реши, как пробросить), и функция вызова UC модуля по Def с подстановкой `module`. Восстановление `ReadonlyAr` из выхода UC, который является state агрегата (один и массив), — по Def агрегата (`restore`). Форма и имена — твои, с обоснованием в отчёте; тип фасада — обычный TS-тип в домене владельца (не Def).
- **Внешний модуль (D-37):** `defineModule({ external: true })` допускает `useCases` — Def без реализации; у внешнего — по-прежнему без ER/Job; MAN-06 и `checkDefs` это учитывают.
- **`checkDefs`:** UC в `calls` принадлежит модулю из `dependsOn`, не своему (ID — MAN-05 или ARC-04, обоснуй); неизвестный Def в `calls` — нарушение.
- **Граф:** ребро «UC/ER/Job → UC» из `calls` (L1), межмодульные связи L0 выводятся из них; command-цель различима от query (атрибут ребра или узла — на твой выбор).
- **Учебный модуль** `testing/example/`: фасад `todo` переводится — тип в домене, реализация через помощник над query UC (возврат `ReadonlyAr`); вызывающий (сейчас по `calls` фасада) объявляет `calls: [<Def UC todo>]`; тест: вызов через фасад проходит, вызов UC, которого нет в `calls`, — отказ; `subjectOf` у `module` — субъект `origin`.
- **TDD** (red → запуск → green по шагам): каждая ветка отказа `module`; `subjectOf`; `checkDefs` (`calls` вне `dependsOn`, свой модуль, внешний UC без реализации — не нарушение); граф (ребро и вид цели); помощник `ReadonlyAr` (один, массив); генератор без `--facade`.
- **Не трогать:** `packages/domain`, `packages/wish`, остальные `packages/*`, `apps/*`, `conductor/` (документы правит оркестратор). Legacy-фасады модулей (`CourseFacade` и др.) — не `dmg-core`, не трогаются. Если что-то вне `dmg-core` и `scripts/gen` ломается от удаления — эскалация.

**Шаг 2 — контракты внешних зависимостей (D-42, D-37).** Образец формы — учебный `todo` после шага 1 (`todo/task/uc/get-task.uc.ts`, `todo/todo.facade.ts`, `app/todo/todo.facade.ts` + тест). Вызовы `create-course-wish`: курс доступен для записи + стартовый модуль (сейчас два вызова legacy `CourseFacade`), запуск анкеты (`QuestionnaireFacade.startStandard`).

*2a — domain-author (Opus)* (`packages/domain/src/{course,questionnaire}/**`, выход за границы согласован):
- `course`: query UC-контракт на один вопрос — «с какого модуля начинается запись на курс» (вход `courseId`, выход — стартовый модуль или признак «недоступен для записи»: курс не опубликован/архив/пустая программа неотличимы); имя по naming.md (например `getCourseEnrollment`), `callers: ['module']`, `policy: allowAll` (с обоснованием), агрегат — Def агрегата курса (если его нет во внешнем контракте — минимальный `defineAggregate` по образцу `QuestionnaireArDef` в Ф0; эскалация, если нужно больше). Путь — `course/course/uc/<имя>.uc.ts`, в `CourseModuleDef.useCases`.
- `questionnaire`: command UC-контракт запуска анкеты (вход: пул и `ownerInfo`; выход — пустой/идентификатор анкеты по смыслу legacy), `callers: ['module']`, `emits` — Def события старта, если оно у внешнего модуля описывается дёшево (иначе без `emits`, отметь в отчёте); путь — `questionnaire/questionnaire/uc/<имя>.uc.ts`, в `QuestionnaireModuleDef.useCases`.
- Тип фасада каждого модуля по D-42 — TS-тип в домене владельца (`<m>.facade.ts`; legacy `facade.ts` и `CourseFacade`/`QuestionnaireFacade` не трогать и не переименовывать — имя нового типа без коллизии, без алиасов). Ошибки — ошибки UC.
- Тесты Def (normalize, `checkDefs` модулей зелёный). Схемы — `description` на каждом поле (MAN-02).

*2b — api-author (Opus)* (`packages/{course,questionnaire}/src/**`): временные реализации этих UC — `UseCaseFromDef` поверх legacy-фасадов модуля (`course`: `isCourseEnrollable` + `getCourseStartModuleId`; `questionnaire`: `startStandard` с субъектом вызывающего как legacy `User` — маркер DEBT-21/22), плюс реализация нового типа фасада через `callUseCase` и владелец (`UseCaseOwner`). Где собирается владелец внешнего модуля — реши по образцу `createTodoModule` (возможно, минимальный объект `{ def, useCase }`, если `ModuleFromDef` для external неприменим). Маркер TR-11 на каждом файле адаптера. Тесты: ответ при доступном/недоступном курсе (оба legacy-случая), запуск анкеты вызывает legacy с теми же аргументами; вызов не из `calls` — `UNAUTHORIZED`.
- Не трогать: legacy-классы и legacy-фасады модулей, `packages/wish`, `packages/dmg-core`, `apps/*`, `conductor/`.

**Шаг 3 — сам UC `create-course-wish`.** Каркас создан оркестратором: `gen module wish --adopt`, `gen uc wish.wish create-course-wish` (`packages/domain/src/wish/{wish.module.ts,wish/uc/create-course-wish.uc.ts}`, `packages/wish/src/{wish.module.ts,wish/uc/create-course-wish.uc.ts}` + тесты; заготовка ссылается на несуществующий `WishEvents.created` — гейт красный до 3a). Образцы: `dmg-core` `testing/example/{todo,app/todo}` (`create-task` с `rules`, потребитель фасада из теста `todo.facade.test.ts`), адаптеры шага 2b. Legacy `CreateCourseWishUc` и бот не трогаются (TR-9). Сохраняемое поведение — §«Сохраняемое поведение» (порядок: сначала курс, затем дубль).

*3a — domain-author (Opus)* (`packages/domain/src/wish/**`):
- `WishModuleDef`: `label`/`description`, `aggregates: [WishArDef]`, `dependsOn` — внешние `user`, `course`, `questionnaire`, `stream` (как в брифе; нужны `calls`), `useCases: [CreateCourseWishUcDef]`; legacy `module.ts` остаётся до Ф12.
- `CreateCourseWishUcDef`: `label`/`description`, `callers: ['user']`, `policy: allowAll` (как предписывает комментарий `WishPolicy`), `rules: [WishRules.rules.unique]`, `calls: [GetCourseEnrollmentUcDef, StartQuestionnaireUcDef]`, вход `{ courseId }` (схема — из state/входа Ar по D-39, без копии), выход `{ outcome: 'instant' | 'questionnaire' }`, `errors: [WishErrors.COURSE_NOT_FOUND, WishErrors.ALREADY_EXISTS]` (+ ошибки вызываемых UC, если тип этого потребует), `emits` — пусто (события создания нет; заготовку убрать). Legacy `commands/create-course-wish-cmd.ts` — схемы входа и выхода выводятся из Def, не копируются.
- **API-01 — решения в домен:** (1) «курс недоступен для записи → `WISH_COURSE_NOT_FOUND`» по ответу `CourseEnrollment`; (2) статус по пулу анкеты: есть пул → `pending`, нет → `expressed`; (3) нужно ли запускать анкету — метод-вопрос Ar (например `awaitsQuestionnaire()`), а не `if` по статусу в UC. Форма — твоя (фабрика Ar `createForCourse(…, at): Result`, доменная функция — по domain-modeling.md), с обоснованием; пул (`findCoursePool`) — доменные данные модуля.
- TDD: тест Def (normalize, `checkDefs` модуля без нарушений), тесты доменных решений (оба случая курса, оба случая пула).

*3b — api-author (Opus)* (`packages/wish/src/**`):
- `WishDeps`: `wishes: WishRepo`, фасады `CourseModuleFacade`, `QuestionnaireModuleFacade` (имена полей — по образцу); субъект — legacy `User` (адаптер анкет ждёт его; маркер DEBT-21/22), если иначе не выходит — эскалация.
- `CreateCourseWishUc extends UseCaseFromDef`: `load` — ответ курса через фасад (`this.callContext`), доменное решение 3a(1), желания пользователя на цель из репозитория → контекст правила `{ userId, target, wishes }`; `execute` — создание по 3a(2), `uow.register`, при 3a(3) — `startQuestionnaire(call, pool, { courseId })` **после `uow.register`, до фиксации** (D-41, вариант 1): ошибка фасада — ответ UC, желание не записано.
- Тесты (перенести все случаи legacy `api/wish/create-course-wish-uc.test.ts` на новый UC): курс недоступен / без стартового модуля → `WISH_COURSE_NOT_FOUND` и ничего не записано; дубль каждого активного статуса → `WISH_ALREADY_EXISTS` со `status` существующего; только неактивные → создаётся; пул → `pending` + анкета с `{ courseId }`, outcome `questionnaire`; без пула → `expressed`, outcome `instant`, анкета не вызвана; **сбой анкеты → ошибка UC, желание не записано**; вызывающий `guest` → `UNAUTHORIZED`. Репозиторий — `WishJsonRepo` во временном каталоге или in-memory по образцу.
- Не трогать: legacy-классы `api/**`, `apps/*`, `packages/{course,questionnaire,dmg-core}`, `conductor/`.


## Ф8а: вызовы и граница модуля (платформа, D-43)

**Источник формы:** D-43 в [decisions.md](../../../architecture/decisions.md), [caller.md](../../../architecture/caller.md) (детали Р1–Р10 были в `OPEN-QUESTIONS-F8.md`, удалён в контрольной точке Ф8а; решения — в D-43, отклонения — TR-13, TR-14).

**Порядок:** один шаг = одна задача плана Ф8а, по очереди (Р1 → Р2 → Р3 → Р4–Р5 → Р6 → Р7 → Р8 → Р9 → Р10 → перевод потребителей). Платформа — `domain-author`, Opus; Р10 в пакете и перевод потребителей — `api-author`.

**Правила шага:**
- TDD: сначала тест нового API в `dmg-core` и запуск (red), затем реализация (green) — по шагам, не одновременно.
- Классы с зоной ответственности, не функции-хелперы (классы вместо россыпи функций — решение Нурболата); удаляемые функции удаляются, без алиасов и реэкспортов «для совместимости».
- После шага `check` зелёный: платформенный шаг сам **механически** правит потребителей, чтобы компилировались и тесты проходили (учебный `dmg-core/src/testing/example`, `packages/domain/src/{course,questionnaire,wish}`, `packages/{course,questionnaire,wish}`, `packages/core/src/legacy-bridge`, `packages/core/src/api/app/api-app.ts`, шаблоны `scripts/gen`). Идиоматичный перевод потребителей и гайды «use case»/«facade» — последний шаг.
- Тестов не меньше: удалённый API — его тесты переносятся на замену, а не удаляются молча.
- `conductor/`, `data/` не трогать; тесты не пишут в `data/` (oplog в тестах — память или временный каталог).
- Отклонения от D-43 и решения сверх него — в отчёт (оркестратор запишет в `TR-<n>`).

**Шаги:**
1. **Р1 `Caller`.** `kernel/caller`: абстрактный `Caller<U>` и `GuestCaller`/`UserCaller`/`DelegateCaller`/`SystemCaller(from: OperationRef, person?)`, `PersonCaller<U>`, `CallerLog`, `OperationRef`. `channel` — в `Trace.channel?: { name; visitorId? }`. `callers` — без `module`. Удалить `ModuleCaller`, `subjectOf`, `originOf`, `moduleCaller`, `systemCaller`. Временный мост для `from` фасада (до Р4–Р5) — `SystemCaller` с `OperationRef` вызвавшей операции.
2. **Р2 Policy.** `Rule.evaluate(subject, ctx)`; `rule()` без субъекта — отказ; `delegable` удалить (и из `graph/normalize`). Policy в `UseCaseFromDef` вызывается всегда. Шаги `UseCaseFromDef` — `protected`: `checkCaller` → `parseInput` → `load` → `checkPolicy` → `checkRules` → `execute` → `parseOutput` → фиксация; тест наследника, ослабляющего `checkPolicy`.
3. **Р3 модуль.** `ModuleFromDef.handle(def, input, caller, trace)`, `runJob(def, trace)`; `useCase(def)` не публичный; `ApiApp` и фасад — через `handle`.
4. **Р4–Р5 `OperationFromDef` и фасад.** База UC/ER/Job (`now()`, типизированный `protected call` по `D['calls']`); `Facade<M>` и `SystemCallable<M>` в `dmg-core/domain` (контракты); `ModuleFacade<M>` (`serves`, `handle`) и `ModuleFacades` (в `ModuleDeps`, `call` выбирает фасад по `serves`) в `dmg-core/app`; `StubFacade<M>` в `dmg-core/testing`. Удалить `CallContext`, `callUseCase`, `fakeFacadeCall`, `this.callContext`, рантайм-проверку `calls` в `UseCaseFromDef`. `CourseModuleFacade`/`QuestionnaireModuleFacade` → `Facade<typeof CourseModuleDef>`/`Facade<typeof QuestionnaireModuleDef>`; их реализации в пакетах — `ModuleFacade`.
5. **Р6 лог операций.** `OperationRecord`, `OperationLog` в `AppContext`; запись — последним шагом `OperationFromDef` при успехе и отказе; `uow.commit()` возвращает опубликованные события; JSONL-реализация по дням (каталог из конфигурации, в приложении — `data/oplog/`), порог размера `input`/`output` (≈8 КБ, обрезка с пометкой); тестовая реализация в памяти в `dmg-core/testing`. `.gitignore` и AGENTS.md — оркестратор.
6. **Р7.** `calls` по типу — только UC с `'system'` в `callers`; `UNAUTHORIZED` без `from`; `Aggregate.readonly(state)` (полиморфный `this`) вместо `asReadonlyAr`; `caller` удалить из конверта события и из UoW, если больше не нужен (legacy-мост `legacyEventBus`, `legacy-publish.ts` — по месту).
7. **Р8.** `protected createUow(caller, trace)` у `OperationFromDef` вместо `contractUnitOfWork`; класс `Trace` (`fromRequest`, `fromEvent`, `forJob`, `channel`, `toLog()`) вместо `requestTrace`/`incomingRequestId`; `protected static newState(uuid, at)` у `Aggregate` вместо `newEntity` (+ шаблон `gen aggregate`).
8. **Р9.** `StartQuestionnaireUcDef.policy` — правило «респондент есть» (без субъекта — `ACCESS_DENIED`); тест адаптера.
9. **Р10.** Домен: `WishAr.createForCourse → Result<WishAr, never>`, методы `questionnaire()` и `outcome()` из state, `CourseWishCreated` удалить (domain-author). Пакет: `create-course-wish` берёт ответ и анкету из них (api-author).
10. **Перевод потребителей** (api-author): учебный модуль, `wish`, `course`, `questionnaire` — по идиоме D-43 (`this.call`, `ModuleFacade`, `StubFacade`, `Aggregate.readonly`); гайды «use case» и «facade» — оркестратор.

## Ф9: остальные UC (`create-module-wish`, `cancel-wish`, `list-user-wishes`)

**Образец:** гайд [use-case.md](../../../architecture/guides/use-case.md) и эталон `create-course-wish` (Def + реализация + тесты); query — учебный `dmg-core/src/testing/example/todo/task/uc/{get-task,list-tasks}.uc.ts`. Сохраняемое поведение — legacy `packages/wish/src/api/wish/<n>-uc.ts` и их тесты: **все случаи переносятся** на новый UC. Legacy-UC, `commands/*-cmd.ts`, бот не трогаются (TR-9, до Ф12).

**Порядок:** один UC = домен (domain-author) → пакет (api-author) → гейт → коммит. Каркас — `bun run gen uc wish.wish <имя> --write` (оркестратор до шага домена). Модель — Sonnet (работа по эталону, agents.md §10); второй красный гейт по той же причине — Opus.

**Общее:** `callers: ['user']`, вход — из state (`WishTargetVo` и его ветки, D-39), без копий схем; `description` на каждом поле (MAN-02); `emits` — нет (событий создания/отмены у `wish` нет). Выход «без данных» у command — как допускает платформа (смотри `defineUseCase`/учебный модуль; legacy возвращал `undefined`). Субъект — legacy `User` (DEBT-21/22), как у эталона.

### 9.1 `create-module-wish`

*Домен (domain-author):*
- Внешний `course`: query UC-контракт `getModuleEnrollment` по образцу `GetCourseEnrollmentUcDef` — вход `{ moduleId }`, выход «модуль в программе опубликованного курса» (`enrollable: boolean`; места модуля в выходе не нужно — потребителя нет), `callers: ['system']`, `allowAll` (обоснование как у `getCourseEnrollment`); путь `course/course/uc/get-module-enrollment.uc.ts`, в `CourseModuleDef.useCases`. Выход за границы — как в Ф8 шаг 2a (TR).
- `WishRules.rules.moduleEnrollable` → `WISH_MODULE_NOT_FOUND` по ответу (контекст `{ moduleId, enrollment }`).
- `WishAr.createForModule({ uuid, userId, moduleId }, at): Result<WishAr, never>` — статус `expressed` решает фабрика (без анкеты: студент уже верифицирован).
- `CreateModuleWishUcDef`: `allowAll`, `rules: [moduleEnrollable, unique]` (порядок legacy: модуль, затем дубль), `calls: [GetModuleEnrollmentUcDef]`, `errors: [MODULE_NOT_FOUND, ALREADY_EXISTS]`; в `WishModuleDef.useCases`.
- TDD: тесты Def (normalize, `checkDefs`), правила (оба ответа), фабрики.

*Пакет (api-author):*
- `packages/course`: временная реализация `GetModuleEnrollmentUc` поверх legacy `getModulePlace` (маркер TR-11, по образцу адаптера `getCourseEnrollment`), регистрация в модуле/фасаде курса; тесты: модуль есть → `enrollable: true`, нет → `false`.
- `CreateModuleWishUc`: `load` — ответ через `this.call`, все желания на цель; `execute` — `createForModule` → `uow.register`.
- Тесты (все случаи legacy): модуль недоступен → `WISH_MODULE_NOT_FOUND`, ничего не записано; дубль каждого активного статуса → `WISH_ALREADY_EXISTS` со `status`; только неактивные → создаётся `expressed`; порядок правил; сбой вызова курса (`StubFacade.answer` с ошибкой); `received`; `guest` → `UNAUTHORIZED`.

### 9.2 `cancel-wish`

*Домен (domain-author):*
- `CancelWishUcDef`: вход — `WishTargetVo` (вариант по `kind`), `policy: WishPolicy.rules.canCancel` (первый UC `wish` с реальной Policy над загруженным агрегатом), `errors` — `NOT_FOUND` + ошибка Policy по платформе; в `WishModuleDef.useCases`.
- **Сохраняемое поведение:** нет текущего желания на цель **или** оно не отменяемо (`pending`, финальные) → `WISH_NOT_FOUND` с `{ userId, courseId | moduleId }` (как legacy; `NOT_CANCELLABLE` через UC недостижим). Решение «не отменяемо → NOT_FOUND» — в домене (правило в `rules` или метод Ar), не `if` по статусу в UC (API-01). Отсутствие агрегата при загрузке — где ему место по `errors-result.md`/платформе (`load` порядок `load → checkPolicy → checkRules`: Policy получает `wish` в контексте) — реши и обоснуй в отчёте.
- TDD: тесты Def и доменного решения.

*Пакет (api-author):*
- `CancelWishUc`: `load` — текущее желание (`findCurrentByUserAndTarget`) → контекст Policy/правил; `execute` — `wish.cancel(this.now())` → `uow.register`.
- Тесты (все случаи legacy): отмена `expressed` и `confirmed` (обе цели) → `cancelled` записано; `pending`/финальные/нет желания → `WISH_NOT_FOUND`, ничего не записано; чужое желание недостижимо (ищется по субъекту) — Policy проверяется тестом Policy в домене; `guest` → `UNAUTHORIZED`.

### 9.3 `list-user-wishes`

*Домен (domain-author):* `ListUserWishesUcDef` — `type: 'query'`, вход `{}`, выход — массив state желания (из `WishArDef.state`, без копии), `allowAll` (только свои: `userId` из субъекта), `errors: []`; в `WishModuleDef.useCases`. Тест Def.

*Пакет (api-author):* `ListUserWishesUc` — желания субъекта (`findByUser`) → выход по идиоме query учебного модуля (как отдать state, не нарушая «`snapshot()` только для репозитория» — по образцу `list-tasks`; отклонение — в отчёт). Тесты legacy: все статусы и виды целей, только свои, пусто → `[]`; `guest` → `UNAUTHORIZED`; query не пишет (UoW пуст / лог операции).

## Ф9а: `view()` (платформа, D-44)

**Шаг 1 — domain-author, платформа (Opus)** (`packages/dmg-core/src/**`, `scripts/gen/**`, механически — `packages/wish/src/wish/uc/list-user-wishes.uc.ts`):
- `Aggregate.view()`: по умолчанию возвращает `snapshot()`; агрегат может переопределить (скрыть/преобразовать поля). Тип возврата — твой выбор с обоснованием (переопределение с другой формой должно типизироваться; выход UC проверяется схемой `output`). Доступен ли `view()` у `ReadonlyAr` — да (это чтение).
- Lint DOM-17 по образцу DOM-01 (`lint-rules.test.ts`, фикстуры red → green): `.snapshot()` разрешён только в репозиториях (`*.repo.ts`, `*.json-repo.ts`, `infra/**`, in-memory репозитории платформы и фикстуры вроде `app.fixture.ts`), в самом `Aggregate` и в тестах (`*.test.ts`); остальное — нарушение. Legacy `packages/wish/src/api/**` (ER и legacy-UC, уходят в Ф10–12) — исключение на время перехода, если правило ловит их (маркер/список исключений с TR, без глушения комментариями по файлу — обоснуй).
- Потребители: учебный `get-task`/`list-tasks` и `listUserWishes` → `view()`; шаблоны `scripts/gen` (тест Ar может проверять `snapshot()` как контракт репозитория — реши и обоснуй).
- TDD (red → запуск → green по шагам): `view()` по умолчанию, переопределение, lint-фикстуры.
- Не трогать: `conductor/`, `data/`, legacy-код вне перечисленного.

## Ф10: эталонная ER `fulfill-wish`

**Платформа уже есть:** `defineEventReaction` (`on`, `touches`, `calls`, `emits`), `ReactionFromDef` (`react` → `Result`; фиксация UoW, лог отказа и исключения — `runLogged`, запись в `oplog` — база), учебный образец — `packages/dmg-core/src/testing/example/{todo,app/todo}/task/er/archive-removed-user-tasks.er.ts`. Правка платформы — только если без неё эталон не собрать (эскалация оркестратору). Сосуществование — как TR-9: новая ER живёт рядом с legacy `api/er/fulfill-wish-er.ts`, в приложение не подписывается до Ф12.

**Сохраняемое поведение** (legacy `packages/wish/src/api/er/fulfill-wish-er.ts` и его тест — источник случаев): на `student.enrolled` (`StudentEvents.enrolled`: `userId`, `moduleId`) желания пользователя, реализуемые зачислением (`canFulfill`: `expressed | confirmed`), переходят в `fulfilled`: course-желание — если курс включает модуль потока (в т.ч. исторически, одним батч-запросом по всем курсам-кандидатам); module-желание — если модуль желания исторически тот же, что модуль потока. Остальные — игнор (идемпотентность: повторное событие ничего не меняет). Нет кандидатов — вызовов курса нет.

**Шаг 1 — domain-author (Opus)** (`packages/domain/src/{course,wish}`):
- Внешние Def UC курса (по образцу `GetModuleEnrollmentUcDef`: `type: 'query'`, `callers: ['system']`, `allowAll`, `description` на полях, MAN-02): «какие из курсов включают модуль» (`{ moduleId, courseIds }` → `{ courseIds }`, legacy `whichCoursesIncludeModule`) и «какие из модулей — тот же модуль» (`{ moduleId, moduleIds }` → `{ moduleIds }`, legacy `whichModulesAreSame`, батч-аналог `isSameModule`). Имена — по naming.md и соседям (`get…`); добавить в `CourseModuleDef.useCases`. Переход с `isSameModule` на батч — TR (поведение то же, контракт фасада это обещает).
- `wish/wish/er/fulfill-wish.er.ts` — `FulfillWishErDef` через `bun run gen er wish.wish fulfill-wish` (если генератор не подходит под адаптированный модуль — вручную по шаблону, отметить в отчёте): `on: [StudentEvents.enrolled]`, `touches: [WishArDef]`, `calls` — два UC выше, `emits: []` (события реализации у `wish` нет). В `WishModuleDef.reactions`.
- Доменное решение (API-01, DOM-04, DOM-17): ER не читает state (`snapshot()`/`view()` для решения не годится) и не ветвится по статусу/виду цели. Что именно спросить у курса и какие желания реализовать — методы Ar или доменный сервис, по образцу Р10 (`questionnaire()`/`outcome()`): например, метод, отдающий «вопрос к курсу» по цели, и переход, принимающий ответ. Форма — твоя, с обоснованием. Unit-тесты домена (red → green).

**Шаг 2 — api-author (Opus)** (`packages/course/src/**`, `packages/wish/src/**`):
- Адаптеры двух UC курса над legacy-фасадом (маркер TR-11, по образцу `get-module-enrollment.uc.ts`), регистрация в карте модуля курса; тесты: ответ legacy передаётся как есть.
- `packages/wish/src/wish/er/fulfill-wish.er.ts` — `FulfillWishEr extends ReactionFromDef` (`gen er`), в `wishMap.reactions`. `react`: желания пользователя (`wishes.findByUser`) → вопросы к курсу через `this.call` (только если есть кандидаты; course — один батч) → доменный переход `fulfill(this.now())` → `uow.register`. Без `Date.now()`, без `throw`, без `console.*`.
- Тесты (`StubFacade`, in-memory репозиторий, по образцу UC `wish` и учебной ER): все случаи legacy-теста; повторное событие — без изменений (идемпотентность); отказ/сбой вызова курса → `Result` с ошибкой, ничего не записано, отказ в логе (`logger.error`) и запись в `oplog`; доставка через `subscribe` на шине по событию `StudentEvents.enrolled`.
- Legacy ER и её тест не трогать (удаление — Ф12).

**Шаг 3 — оркестратор:** гайд «event reaction» (`conductor/architecture/guides/`, формат Ф4 спеки, 40–80 строк), эталон — файлы шагов 1–2.

## Ф11: остальные ER (`confirm-wish`, `abandon-wish`, `invite-wishers`)

Гайд — `conductor/architecture/guides/event-reaction.md`, эталон — Ф10 (`fulfill-wish`). Каждая ER — отдельный TDD-цикл (red → green). Сосуществование — как Ф10: новые ER рядом с legacy `packages/wish/src/api/er/*-er.ts`, в приложение не подписываются до Ф12; legacy ER и их тесты не трогать.

### 11.1 `confirm-wish` и `abandon-wish`

**Сохраняемое поведение** (legacy `confirm-wish-er.ts`, `abandon-wish-er.ts` и их тесты — источник случаев): на `QuestionnaireEvents.completed` / `QuestionnaireEvents.abandoned` (`respondentId` — пользователь, `owner` — данные владельца анкеты; `wish` сам задал `owner: { courseId }` в `WishAr.questionnaire()`) желание пользователя на курс `owner.courseId` в `pending` переходит в `confirmed` (событие `WishEvents.confirmed`) / `abandoned`. Любое другое состояние или отсутствие желания — игнор (идемпотентность). Анкета чужого владельца (`owner` не разбирается как анкета `wish`) — игнор.

**Шаг 1 — domain-author (Sonnet)** (`packages/domain/src/wish/**`):
- `ConfirmWishErDef`, `AbandonWishErDef` через `bun run gen er wish.wish <имя>`: `on` — Def события анкеты из `@u7-scl/domain/questionnaire/contract`, `touches: [WishArDef]`, `calls: []`, `emits`: `[WishEvents.confirmed]` / `[]`. В `WishModuleDef.reactions`.
- Разбор `owner` → цель желания — домен `wish` (формат `owner` задаёт он сам, `questionnaire()`): одно место правила рядом с `questionnaire()`, схема valibot, чужой/битый `owner` → «не наша анкета».
- Выбор желания среди желаний пользователя на цель — домен, не ER и не репозиторий (`findCurrentByUserAndTarget` помечен TR «уйдёт из репозитория», новые ER его не используют; ER грузит `findAllByUserAndTarget`). ER не читает state, не сравнивает статусы и не выбирает агрегат сам (API-01, DOM-17). Форма (метод Ar / статический метод / `WishRules`) — твоя, с обоснованием в отчёте; помни, что активное желание на пару одно (`WishRules.unique`).
- Unit-тесты домена (red → green).

**Шаг 2 — api-author (Sonnet)** (`packages/wish/src/**`):
- `ConfirmWishEr`, `AbandonWishEr` extends `ReactionFromDef` (заготовки `gen er`), в `wishMap.reactions`. `react`: разбор `owner` доменом → нет цели — `ok()` без загрузки; `findAllByUserAndTarget` → доменный выбор → переход с `this.now()` → `uow.register`.
- Тесты по образцу `fulfill-wish.er.test.ts`: все случаи legacy-тестов; повтор события — без изменений; чужой `owner` — ничего не загружено/записано; `confirmed` опубликовано на шине с payload `{ userId, courseId }`; доставка через `subscribe` по Def события.

### 11.2 `invite-wishers`

**Сохраняемое поведение** (legacy `invite-wishers-er.ts` и его тест — источник 12 случаев): на `StreamEvents.created` (`streamId`, `moduleId`) приглашаются активные (`expressed | confirmed`) желания: course-желание — если модуль потока стартовый в опубликованном курсе (`getModulePlace(moduleId)?.isFirst`) и курс желания включает модуль (в т.ч. исторически, батч по кандидатам); module-желание — если модуль желания исторически тот же (батч). Приглашение — `WishEvents.invited` (`userId`, `telegramId`, `streamId` + цель желания) от агрегата. Поток не найден — никого не зовём, без ошибки. У адресата нет `telegramId` или профиль недоступен — пропуск с `warn`, без ошибки. Нет кандидатов — вызовов нет.

**Решение (открытый вопрос 9, вариант а):** `WishAr.invite(at, to)` через `change` — событие `invited` строит Ar из своего state (цель), статус не меняется; ER регистрирует приглашённых в UoW (запись `version`/`updatedAt`).

**Шаг 1 — domain-author (Sonnet)** (`packages/domain/src/{course,stream,user,wish}`):
- Внешние Def UC по образцу `GetCoursesIncludingModuleUcDef` (`type: 'query'`, `callers: ['system']`, `allowAll`, `description` на полях), регистрация в `useCases` внешнего `ModuleDef`, экспорт из `contract.ts`:
  - course: «какие из курсов начинаются с модуля» (`{ moduleId, courseIds }` → `{ courseIds }`): модуль стартовый в курсе и курс включает модуль — объединяет legacy `getModulePlace().isFirst` и `whichCoursesIncludeModule` в одном вопросе (один раунд вместо двух);
  - stream: «есть ли поток» (`{ streamId }` → признак наличия; отсутствие — не ошибка) над legacy `getStream`;
  - user: «адреса Telegram пользователей» батчем (`{ userIds }` → пары `userId`/`telegramId` только для тех, у кого он есть; недоступный профиль — просто нет в ответе). У `UserModuleDef` агрегатов нет — минимальный `UserArDef` по образцу `CourseArDef` (D-37).
  - Имена — по naming.md и соседям (`get…`).
- `InviteWishersErDef` (`gen er wish.wish invite-wishers`): `on: [StreamEvents.created]`, `touches: [WishArDef]`, `calls` — три UC выше, `emits: [WishEvents.invited]`; в `WishModuleDef.reactions`. Снять фильтр MAN-06 для `invited` в `wish.module.test.ts`, если он больше не нужен.
- `WishAr.invite(at, to: { streamId, telegramId })` — `change`, payload по цели из state; только для приглашаемого (`expressed | confirmed`) — иначе отказ (форма ошибки — по образцу переходов).
- Доменный батч — DCS по образцу `WishFulfillmentDcs` (DOM-06), «вопрос → ответ» в два раунда: (1) по кандидатам — вопросы к курсу (course — только при course-кандидатах, module — при module-кандидатах); (2) по совпавшим — вопрос о потоке и адресах пользователей (только если совпавшие есть); итог — приглашённые Ar и недостижимые `userId` (для `warn` в ER). Форма — твоя, с обоснованием; ER не читает state и не ветвится по виду цели (API-01, DOM-17). Unit-тесты домена.

**Шаг 2 — api-author (Sonnet)** (`packages/{course,stream,user,wish}/src/**`):
- Адаптеры трёх UC над legacy-фасадами (маркер TR-11, по образцу `packages/course/src/course/uc/get-courses-including-module.uc.ts`). Для `stream` и `user` — карта модуля и `create<M>Module` по образцу `packages/course/src/course.module.ts` (`<M>Legacy = Pick<…>`); адресам пользователей — цикл по legacy `getUserByUuid` внутри адаптера (батча в legacy нет, TR). Тесты адаптеров: ответ legacy передаётся как есть.
- `InviteWishersEr extends ReactionFromDef` в `wishMap.reactions`: `findAllByKind` кандидатов → DCS → `this.call` только по вопросам домена → `invite` → `uow.register`; недостижимые — `warn` через логгер базы. Без `Date.now()`, `throw`, `console.*`, `snapshot()`.
- Тесты по образцу `fulfill-wish.er.test.ts`: все 12 случаев legacy-теста; отказ/исключение вызова — `Result` с ошибкой, ничего не записано, `logger.error`, запись в oplog; доставка через `subscribe` по `StreamEvents.created`; `invited` опубликовано с payload legacy.

## Ф12: модуль и сосуществование

`WishModuleDef` (домен) и `createWishModule`/`wishMap` (пакет) уже собраны в Ф8–11; модули-адаптеры зависимостей — `packages/{course,questionnaire,stream,user}/src/*.module.ts` (TR-11). Платформа подключения есть: `ApiApp.addDmgModules`, `run(Def…)`, `execute(Def, input, caller, trace)` (`Err` → `AppException` через `toLegacyError`). Образец сборки legacy + DMG — `packages/core/src/legacy-bridge/example-app.test.ts`. Фаза — переключить приложение на DMG-модуль `wish` и удалить legacy.

**Порядок (TR):** шаг 1 (мост) → шаг 2 (сборка, stories) → шаг 3 (удаление legacy и DEBT-маркеров `wish`). Задача плана «`WishModuleDef` … DEBT-21/22» закрывается шагом 3: без шага 2 удаление legacy ломает приложение.

**Шаг 1 — api-author (Opus)** (`packages/core/src/legacy-bridge/legacy-event-bus.ts` + тест), TDD:
- `inbound` разбирается один раз на маршрут (на создании моста, не на каждый `subscribe`): payload вне схемы → `onInvalid` ровно один раз, сколько бы подписчиков ни было.
- Дефолт `onInvalid` и JSDoc согласованы с `InProcEventBus` (исключение в async-обработчике шина глотает): дефолт не полагается на `throw`; форма — твоя, с обоснованием.
- `Date.parse` в конверте проверяется: невалидная дата legacy-события → `onInvalid`, не `NaN` в `occurredAt`.
- Публичный API моста не ломать без эскалации; потребители — `example-app.test.ts`, тесты `legacy-inbound` в `stream`/`questionnaire`.

**Шаг 2 — api-author (Opus)** (`apps/u7-bot/**`, `scripts/call-uc.ts`):
- `create-api-app.ts`: `AppContext` — `bus: legacyEventBus(appResolver.eventBus, { inbound: [...streamLegacyInbound, ...questionnaireLegacyInbound], onInvalid: <logger.warn> })`, `clock: legacyClock()`, `logger` приложения, `mode`, `oplog: new JsonlOperationLog(`${config.dbDir}/oplog`)` (TR-13 п. 10); DMG-модули `user`, `course`, `questionnaire`, `stream` (адаптеры над legacy-фасадами) и `wish` (`WishJsonRepo` на прежнем файле `${config.dbDir}/wish/wishes.json`), `ModuleFacades` по `dependsOn`; `apiApp.addDmgModules(...)` до `init`. `WishApiModule` из списка `ApiApp` убрать — legacy ER больше не подписаны (двойной обработки событий нет); `wishModule` из `ApiAppBundle` — по потребителям.
- Stories `wish` (`course-catalog.story.ts` и др. вызовы `create-course-wish`, `create-module-wish`, `cancel-wish`, `list-user-wishes`): `execute(<Def>, input, caller, trace)` вместо строкового имени. `caller` — `UserCaller` над актором, `trace` — `Trace.fromRequest` с каналом бота; откуда `requestId` (update Telegram или генерация с `warn`) — твоё решение, одно место (метод/класс, не копипаста по stories), с обоснованием в отчёте. Видимое поведение stories (тексты, ветки по коду ошибки `WISH_ALREADY_EXISTS` со `status`, `COURSE_NOT_FOUND`) не меняется; на `run` переводить не обязательно.
- `U7BotAppMeta` без `WishApiModuleMeta`. `tests/helpers/test-app.ts` — та же сборка; `oplog` тестов — во временном каталоге, **не** в `data/`. `scripts/call-uc.ts` — UC `wish` через DMG-модуль (или явный отказ с подсказкой, если скрипт рассчитан только на строковые имена — отметить в отчёте).
- Тесты: stories и их unit-тесты, `tests/courses/wish-*.integration.test.ts`, `tests/e2e/wish-questionnaire.e2e.test.ts`, `tests/e2e/user-notify.e2e.test.ts` — зелёные; события `wish.wish.invited`/`confirmed` доходят до stories `wish-invite`/`wish-confirmed`; legacy-события `student.enrolled`, `stream.created`, `questionnaire:complete|abandon` доходят до DMG ER (интеграционный тест на сборке приложения).
- Legacy-код `packages/wish/src/api/**` не удалять (шаг 3).

**Шаг 3 — migrator (Sonnet)** (`packages/domain/src/wish/**`, `packages/wish/src/**`, `apps/u7-bot` — только импорты):
- Удалить legacy: `packages/wish/src/api/**` (UC, ER, `module.ts`, `wish-uc.ts`, `legacy-publish`/`legacy-reject`, если потребителей нет), `packages/wish/src/wish/wish.resolver.ts` (DEBT-22), домен `wish/module.ts` (`WishApiModuleMeta`, DEBT-21) и `wish/commands/**`; экспорты `index.ts`, `package.json` (`exports`) — по потребителям.
- Barrel DEBT-23 `packages/wish/src/domain/index.ts` сохраняется: убрать из него только удалённое.
- Маркеры DEBT-21/22 в `packages/{domain,wish}/src/wish` — только там, где импорт `core`/`app` реально ушёл; `debt.md` не трогать (гасит оркестратор в Ф13). Если субъект модуля (`User` из `@u7-scl/app/domain` в `packages/wish/src/wish.module.ts`) нельзя заменить без смены контракта — оставить с маркером и описать в отчёте.
- Нет `@u7-scl/core`/`@u7-scl/app` в `packages/domain/src/wish/**`; поведение не меняется — тесты удалённого legacy уходят вместе с ним, их случаи уже покрыты тестами DMG UC/ER (Ф8–11); если найдёшь непокрытый случай — эскалация.

**Шаг 4 — оркестратор:** гайд «module» (эталон — `packages/domain/src/wish/wish.module.ts`, `packages/wish/src/wish.module.ts`, сборка `apps/u7-bot/src/create-api-app.ts`), stub-гайд «job».

## Было → станет (naming.md §2–§3)

Домен `packages/domain/src/wish/`:

| Было | Станет | Фаза |
|---|---|---|
| `wish/entity.ts` (+ `state.ts` — подпуть `./state`) | `wish/wish.state.ts`; `state.ts` реэкспортирует его | 1 |
| `wish/a-root.ts` | `wish/wish.ar.ts` (`WishArDef` + `WishAr`) | 2 |
| `wish/events.ts` (интерфейсы) | `wish/wish.events.ts` (`WishEvents`) | 3 |
| `wish/errors.ts`, `contract.ts` | `wish/wish.errors.ts` (`WishErrors`) | 4 |
| `wish/policy.ts` | `wish/wish.policy.ts` (`WishPolicy`) | 5 |
| `wish/repo.ts` (порт в домене) | `packages/wish/src/wish/wish.repo.ts` | 6 |
| — | фасада нет (D-38) | 7 |
| `wish/commands/<n>-cmd.ts` | `wish/uc/<n>.uc.ts` (`<N>UcDef`) | 8–9 |
| — (ER только в api) | `wish/er/<n>.er.ts` (`<N>ErDef`) | 10–11 |
| `module.ts` (мета + резолвер) | `wish.module.ts` (`WishModuleDef`) | 12 |

Прикладной слой `packages/wish/src/`:

| Было | Станет | Фаза |
|---|---|---|
| `infra/db/wish-json-repo.ts` | `infra/wish.json-repo.ts` | 6 |
| — | фасада нет (D-38) | 7 |
| `api/wish/<n>-uc.ts`, `api/wish-uc.ts` | `wish/uc/<n>.uc.ts` (`UseCaseFromDef`); базовый `WishUseCase` удаляется | 8–9 |
| `api/er/<n>-er.ts` | `wish/er/<n>.er.ts` (`ReactionFromDef`) | 10–11 |
| `api/module.ts` | `wish.module.ts` (`ModuleFromDef`, карта Def → класс) | 12 |
| `domain/index.ts` (barrel DEBT-23) | остаётся | — |

Тесты переезжают вместе с файлом (`<file>.test.ts` рядом).

## Сохраняемое поведение

- Две ветки статусов: `expressed → cancelled | fulfilled`; `pending → confirmed | abandoned`, `confirmed → cancelled | fulfilled`.
- Не более одного активного (`expressed | pending | confirmed`) желания на пару (user, target): проверяются **все** желания на цель, не «последнее».
- `create-course-wish`: курс недоступен для записи или без стартового модуля → `COURSE_NOT_FOUND`; есть пул анкеты → `pending` + `startStandard`, outcome `questionnaire`; нет → `expressed`, outcome `instant`. Дубль → `WISH_ALREADY_EXISTS` с `status` существующего.
- ER: идемпотентность (нереализуемые статусы игнорируются); идентичность курсов и модулей решает фасад курсов (`whichCoursesIncludeModule`, `isSameModule`, `whichModulesAreSame`); `invite-wishers` без `telegramId` → предупреждение и пропуск.
- Публичное поведение для UI: события `wish.invited`, `wish.confirmed` с текущим payload доходят до stories `wish-invite`, `wish-confirmed`.
- Базовая линия: репозиторий 3211 pass / 0 fail; `wish` (домен + пакет) — 107 pass / 14 файлов.

## Открытые вопросы (решаются с Нурболатом до соответствующей фазы)

1. ✅ **Решено (Нурболат, 2026-10-20): вариант «б».** Def событий — с FQN по naming.md (`wish.wish.invited`, `wish.wish.confirmed`); подписки stories `wish-invite`, `wish-confirmed` переписываются на FQN в Ф3–4, без перевода имён в мосте `legacyEventBus`.
   **Было: Ф3/Ф12. Имена событий.** FQN по naming.md — `wish.wish.invited`, а stories подписаны на `'wish.invited'`/`'wish.confirmed'`. Мост `legacyEventBus` передаёт legacy-подписчикам FQN как `eventName` — без решения stories перестанут получать события.
2. ✅ **Решено (D-37):** события зависимостей описываются в их `contract.ts`, модуль-зависимость — внешний `defineModule({ external: true })`, legacy-события доставляет карта `inbound` в `legacyEventBus` (payload проверяет схема Def). Задача — Фаза 0 плана.
   **Было: Ф10–11. Входящие события legacy.** ER `wish` слушают `student.enrolled`, `stream.created` (stream) и `questionnaire:complete`/`questionnaire:abandon` — это legacy-события без Def; `legacyEventBus` **не доставляет** legacy-события подписчикам DMG. `defineEventReaction.on` требует Def события. Нужен мост «legacy → DMG» или Def событий зависимостей (их модули не мигрированы).
3. ✅ **Решено (D-37):** `dependsOn` ссылается на внешние `ModuleDef` зависимостей (тот же контракт, что в п. 2); при миграции зависимости `external` снимается.
   **Было: Ф12. `dependsOn`.** У `user`, `course`, `questionnaire`, `stream` нет `ModuleDef`; `defineModule.dependsOn` ждёт Def. Варианты: stub-Def зависимостей (долг) или временное ослабление.
4. ✅ **Решено (Нурболат, 2026-10-20, D-38): фасад — только по потребителю.** У `wish` потребителей фасада нет (UI ходит через `appApi`) — `WishFacadeDef` не объявляется. `dmg-core` это уже допускает; `gen module` создаёт фасад только с `--facade` (задача Ф6–7). Гайд «facade» — критерий и эталон платформы (`dmg-core` example), без фасада `wish`.
   **Было: Ф7. Содержимое фасада.** Что выставить в `WishFacadeDef` без спекулятивного API.
5. **Фасады зависимостей** (`CourseFacade` и др.) — legacy: `boolean`/`undefined`, без `Result`. UC `wish` вызывает их как есть; перевод — в их треках.
6. ✅ **Решено (оркестратор по поручению Нурболата, TR-3): `conflict`.** Отказ перехода — операция несовместима с текущим состоянием ресурса, а не некорректный запрос (вход валиден); общепринятое соответствие — 409 Conflict. Видимый код сменится в Ф3–4, когда `Result` дойдёт до вызывающих; тексты прежние.
   **Было: Ф4. `kind` ошибок переходов.** `WishErrors.WISH_NOT_*` — `conflict`, legacy отдавал `BAD_REQUEST`. Когда `Result` дойдёт до вызывающих, код/статус сменится (400 → 409?) — решить явно (TR-1).
7. ✅ **Решено (Нурболат, 2026-10-20): вариант A.**
   **Было: Ф5. Где правило «одно активное желание на (user, target)».** A — DCS/доменный сервис с `Result` `WISH_ALREADY_EXISTS` (`conflict` + `status`), Policy — только права (`canCancel` владельцем), `isActive` — метод Ar. B — правило Policy (`ACCESS_DENIED`, `access`): бот перестанет показывать «продолжи анкету / уже обучаешься» — меняется поведение. C — в UC через метод Ar: доменное решение в UC (API-01). Рекомендация — A.

8. ✅ **Решено (Нурболат, 2026-10-22, D-44): `view()`** — состояние наружу (UC, выход, рендереры UI), по умолчанию `snapshot()`, переопределяемо; `snapshot()` — только репозиторий (DOM-17). Задача — Ф9а.
   **Было: Ф9 (TR-15), к контрольной точке.** Как query отдаёт state агрегата: сейчас `snapshot()` в UC (идиома учебного `list-tasks`) против D-05/D-39. Варианты: (а) метод Ar, строящий выход (например `view()` — по сути тот же state, но через доменный API); (б) разрешить `snapshot()` в query UC явной оговоркой D-05; (в) query читает через DQS/репозиторий, отдающий state. Рекомендация — (а): единообразно с D-39 и не расширяет доступ к entity.

9. ✅ **Решено (Нурболат, 2026-10-26): вариант (а)** — `WishAr.invite(at, …)` через `change`, событие от агрегата, платформа не меняется. Запись желания на приглашение и частичная публикация при `VERSION_CONFLICT` (D-15) — TR; приглашение в state (идемпотентность повторного `stream.created`) — долг, не в этом треке.
   **Было: Ф11. Событие без смены состояния.** Legacy ER строит `WishEvents.invited` сама (`WishEvents.invited.make`), желание не меняется. В DMG события публикует только UoW из `pullEvents()` зарегистрированных агрегатов — ER опубликовать событие не может. Варианты: (а) метод Ar `invite(...)` через `change` — событие от агрегата, но запись желания (`version`/`updatedAt`) на каждое приглашение; (б) API `dmg-core`: событие ER без агрегата (например, `uow.emit`) — форма Def/API платформы.

## Правила (ID rules.md)

ARC-02, ARC-04, ARC-06; DOM-01…05, DOM-09…12; MAN-01…11; ERR-01…06; API-01…05; CODE-01…03; TST-01…06.

## Критерии приёмки среза

См. `../spec.md` «Критерии приёмки». По фазе — гейт `bun run scripts/agent-gate.ts`, затем `bun run check` и отчёт reviewer без `error`.

## Отчёты агентов

(заполняет оркестратор по фазам)

### Приёмка правок платформы (reviewer, diff `460362f8..2c629a93`)
Блокеров нет; `check` 3252 pass. `error`: DOM-14 не действует в `dmg-core` — плагин `dom-14-no-clock.grit` подключён только в корневом `biome.json`, а корень исключает `packages/dmg-core`; фикстура зелёная, т.к. `lint-rules.test.ts` берёт корневой конфиг (нарушений в коде сейчас нет). `warn`: `assertVersion` не отличает новый агрегат от записи версии 0 (create с занятым uuid перезапишет legacy-запись); при `VERSION_CONFLICT` на N-м агрегате события записанных не публикуются (не задокументировано); `onInvalid` по умолчанию бросает внутри async-обработчика legacy-шины — исключение глотает `InProcEventBus`; inbound разбирается на каждый `subscribe` (дубли `onInvalid`); «в production warn» в D-37 — подключения нет; `migration.md` §6 — старые ID `D-<n>`, нет DEBT-31. `info`: часы читаются отдельно для операции и `occurredAt`; `createLock` на экземпляр, не на файл; `Date.parse` без проверки; лишний `rejects` для статуса из `from` не ловится; DOM-14 в rules.md смешивает lint и runtime; грит ловит только `Date.now()`/`new Date()`; spec.md:65 без DEBT-31; архивный spec про allowlist; `const T1` среди импортов.

### Ф0 шаг 1 — domain-author
Внешние `ModuleDef` (`user`, `course`, `questionnaire`, `stream`) в `<m>/<m>.module.ts`; Def событий `StudentEvents.enrolled`, `StreamEvents.created`, `QuestionnaireEvents.completed/abandoned`; минимальные `StudentArDef`, `StreamArDef`, `QuestionnaireArDef` в `<a>.ar.ts` (финальный путь); реэкспорт в `contract.ts`. Вне брифа: без `gen` (`--adopt` создал бы фасад и прикладной слой, `gen aggregate` — Ar/Policy/repo); межмодульные импорты через `@u7-scl/domain/<dep>/contract` (ARC-04); тест на модуль. Тесты 12 pass (red → green), гейт `packages/domain` зелёный, `arch:check` 0, `check` 3264 pass.

### Ф0 шаг 2 — api-author
`packages/stream/src/legacy-inbound.ts` (`streamLegacyInbound`: payload как есть), `packages/questionnaire/src/legacy-inbound.ts` (`questionnaireLegacyInbound`: `{ ...payload, owner: ownerInfo }`); тесты доставки на событиях реальных legacy-агрегатов (`StudentAr.enroll`, `StreamAr.create`, `QuestionnaireFactory` → `handleAction`/`abandon`) с полным конвертом, `onInvalid`-шпион на payload вне схемы, лишние поля (`telegramId`) отбрасываются. Вне брифа: подпуть `./legacy-bridge` в `packages/core/package.json` (не было экспорта); реэкспорт карт из `src/index.ts` пакетов. Тесты 6 pass (red → green), гейт зелёный.

### Исправление DOM-14 (оркестратор, `d9927a34`)
Плагины DMG перенесены в `packages/dmg-core/biome-plugins/`, конфиг пакета их подключает, корень ссылается оттуда, мёртвые override корня удалены; `lint-rules.test.ts` гонит фикстуры `dmg-core` конфигом пакета (red: dom-14, arc-01 → green). Фикстура `arc-01` в `dmg-core` → `arc-10-u7scl` (в пакете импорт `@u7-scl/*` ловит ARC-10).

### Ревью задачи «Контракты зависимостей» (reviewer)
`error` нет. Контракты совпадают с реальными legacy-событиями (`owner` — record любого владельца, `reason` всегда из picklist, `telegramId` отбрасывается); решения вне брифа приняты. `warn`: TST-04 — тесты карт ~25 строк из-за литерала полного конверта (хватит `name` и `payload`); `dmg-core`/`@u7-scl/domain` не объявлены в `dependencies` пакетов `stream`/`questionnaire` (хойстинг); ERR-07 — в Ф12 передать `onInvalid` с `warn` (задача в плане). `info`: `legacy-inbound.ts` вне naming §3 (временный); picklist `reason` дублирует legacy `AbandonReasonSchema`.

### Ф1 шаг 1 — domain-author (платформа)
`withEntityDefaults(schema)` в `kernel/fields/fields.ts`: копия схемы state, которая перед разбором дописывает `updatedAt = createdAt` (если поле есть в `entries`); `~run` вызывает исходный разбор с `this` производной схемы — `v.pick`/`v.omit`/`v.partial` наследуют фолбэк и проверяют свои поля. `defineAggregate` кладёт копию в `def.state`; тип, `entries`, JSON Schema — как у исходной. Ограничения (JSDoc): `def.state !== spec.state`, фолбэк работает только при разборе через `def.state` — репозиторий Ф6 разбирает `WishArDef.state`; пример `TaskJsonRepo` разбирает `TaskState` напрямую — перевести в Ф6. Дополнение к D-36 в `decisions.md`. Тесты red → green, dmg-core 229 pass.

### Ревью Ф1 шаг 1 (reviewer, 2 раунда)
Раунд 1: `error` — `this` исходной схемы в обёртке, производные `pick/omit/partial` проверяли все поля; `warn` — тесты композиции, ограничения в JSDoc. Раунд 2: закрыто, новых `error`/`warn` нет. `info`: схемы без `entries` (union) подставляют всегда — для state недостижимо. `question`: `v.partial(def.state)` подставит `updatedAt` при наличии `createdAt` — принято: DTO-патчи строятся от экспортированной схемы state, не от `def.state`.

### Ф1 шаг 2 — migrator (вариант C)
Первая попытка — эскалация: gen без паспорта модуля не работает; legacy `ArMeta` (даты-строки) не принимает `F.timestamp`; без `WishArDef` фолбэк `updatedAt` не срабатывает. Решение Нурболата — C (базовые поля и даты в Ф2), файл вручную. Сделано: `wish/wish.state.ts` (`WishState`, `WishTarget`, `WishStatus`; `F.uuid`/`F.picklist`, описания на полях и ветках `target`; импорты схем `user`/`course` ушли), `entity.ts` удалён, `WishArMeta` → `a-root.ts` (DEBT-21), переименования у потребителей без алиасов. Отклонение: `biome-ignore` DOM-11 на `uuid`/`createdAt`/`updatedAt` под DEBT-24 (расширен на DOM-11). Тесты 15 → 17, wish 109 pass.

### Ревью Ф1 шаг 2 (reviewer)
`error`/`warn` нет. `info`: пропали свои тексты ошибок схемы (не видны пользователю — команды валидируют свои схемы); MAN-02 упадёт на базовых полях при `WishArDef` — покрыто DEBT-24; DOM-01 — state видят Policy/repo/UC/stories (legacy, уходит с Ф2+).

### Ревью гайда «state» (reviewer)
`error` нет. `warn` исправлены: описания у `kind` веток и `variant`, а не у веток; тест эталона проверяет описания только собственных полей (оговорка про DEBT-24/DOM-01 в шапке); `gen module` создаёт только паспорт — пофазный перевод ломает `gen aggregate`; обоснование про тексты ошибок (DTO выводятся из state). Вопрос к Нурболату: VO в naming.md — суффикс `Vo` (`StepRecordVo`), в эталоне — `WishTarget`. `info` учтены (DOM-12 все iso-*, `shared/` по naming §2, тест описаний до Def, дубль про генератор).

### Ф2 шаг 1 — domain-author
`wish.state.ts` на `BaseEntityFields` + `F.timestamp` (DEBT-24 погашен, запись удалена); `wish.ar.ts` — `WishArDef` (6 статусов, переходы с `rejects` по всем статусам вне `from`), `WishAr`: приватный конструктор, `create(input, at): Result<WishAr, never>` без событий, `restore`, `snapshot`, переходы `confirm/abandon/cancel/fulfill(at): Result`; `WishErrors` — 4 ошибки `WISH_NOT_{CONFIRMABLE,ABANDONABLE,CANCELLABLE,FULFILLABLE}` (`conflict`, `label` = прежний текст исключения); `WishEvents` — пустая группа (TR-1). `a-root.ts` удалён. Вне брифа: одна фабрика `create` со `status: 'expressed' | 'pending'` (ветку выбирает UC по пулу анкеты); предикаты `can*` оставлены и читают `from` из Def (своего способа платформа не даёт); `arMeta` legacy-команд — литерал `{ name: 'Wish'; label: 'Желание' }`. Тесты red → green, `packages/domain` 758 pass, `wish` в домене 55 pass. Гейт: красные `packages/wish`, `apps/u7-bot` — шаг 2.

### Ф2 шаг 2 — migrator
UC/ER `packages/wish` на `WishAr.create/restore/snapshot`; `err` переходов → `throwIfRejected` (`api/legacy-reject.ts`: `errBadRequest('BAD_REQUEST', error.label)` — код и текст прежние); `arMeta` UC — литералы `'Wish'`/`'Желание'`. `wish-json-repo.ts` разбирает `WishArDef.state` (TR-2), сортировка по числовому `createdAt`; тест legacy-записи (ISO без зоны, без `updatedAt`/`version`) red → green. Фикстуры 8 тестов UC/ER — числовые даты, `updatedAt`, `version`; ожидания не менялись; `apps/u7-bot` правок не потребовал. Видимого пользователю изменения нет (даты wish в UI и событиях не выводятся). wish 123 pass, `check` 3300 pass.

### Ревью Ф2 (reviewer, diff `c978c439..ce7e32e3`)
`error` нет. Поведение сохранено: `from`/`rejects` = прежние `can*`, код `BAD_REQUEST` и тексты исключений прежние, legacy-записи читаются через `WishArDef.state` (ISO без зоны → UTC верно). Решения оркестратора: `warn` TST-05 — тест «legacy-запись не теряется после `save` другой» добавлен (зелёный сразу, фиксирует поведение); `warn` CODE-02 — `#create` убран, распаковка `create` одной формой `unwrapInfallible` в `legacy-reject.ts`; `info` — тип `Result` из `dmg-core` (`dmg-core` в `dependencies` `wish`), мост `legacy-reject.ts` вписан в TR-1; `minor` — ловушка «фабрики» в гайде переписана как критерий; `question` `kind: conflict` vs `BAD_REQUEST` — открытый вопрос 6 (Ф4).

### Ф3–4 шаг 1 — domain-author
`WishEvents.invited`/`.confirmed` (FQN, `F.*`, описания; payload `invited` — `v.variant('targetKind')`, ветка требует свой id); `WishErrors` + `WISH_ALREADY_EXISTS` (`conflict`), `WISH_NOT_FOUND`, `WISH_COURSE_NOT_FOUND`, `WISH_MODULE_NOT_FOUND` (`not_found`), `label` — прежние тексты, payload обязателен. `confirm` порождает `confirmed`; module-желание в `pending` → `Err WISH_NOT_CONFIRMABLE` (в домене нельзя `throw`, курса для payload нет; ветка недостижима — module-желания создаются `expressed`). Legacy `events.ts`/`errors.ts` удалены; `commands/legacy-uc-error.ts` — тип `LegacyWishUcError<K>` (Def → legacy-ошибка для мет команд, до Ф8, DEBT-21 переехал сюда). Вне брифа: `invited` строит ER (`WishEvents.invited.make`) — решение на фасадах, состояние не меняется, а метод Ar без перехода только через `change` (растит `version`); риск Ф10 — у ER нет своего канала публикации. `telegramId` оставлен (адресация stories). В пробе `checkDefs` отфильтрован MAN-06 (нет `emits` до Ф8/Ф10). Тесты домена wish 55 → 67, `packages/domain` 770 pass.

### Ф3–4 шаг 2 — migrator
Мост `legacy-reject.ts`: `throwWishError` и обобщённый `throwIfRejected` бросают `AppException(toLegacyError(err))` — конвертер тот же, что у `appApi.execute`; отказ перехода теперь `WISH_NOT_*`/`conflict` (TR-3), тексты прежние. UC бросают `WishErrors.*.make(payload)` через мост. ER: `confirm-wish` берёт `pullEvents()`, `invite-wishers` — `WishEvents.invited.make`; публикация — `legacy-publish.ts` (`publishWishEvents`, конверт по образцу UoW) в `legacyEventBus(resolve.eventBus)` (TR-4). Stories подписаны на `WishEvents.*.name`, тип из схемы Def, `courseId`/`moduleId` по ветке `variant`. Вне брифа: реэкспорт `@u7-scl/domain/wish/contract` в barrel DEBT-23 (у бота нет зависимости от домена). Видимое пользователю не изменилось: бот ветвится по `kind`, `errorNotify` для `conflict`/`bad-request` показывает тот же `message`, отказ перехода в `cancel-wish` недостижим (раньше срабатывает `WISH_NOT_FOUND`); в legacy-событиях сменились `eventName` (FQN) и `aggregateName` (`wish.wish`) — stories читают только payload. Тесты wish 148 (домен 67 + пакет 81), `check` 3325 pass.

### Ревью Ф3–4 (reviewer, незакоммиченный diff)
`error` нет, поведение сохранено (бот ветвится по `kind`, подписчики `wish.*` — только две stories, `make` payload не валидирует). Решения оркестратора: `warn` ERR-02 — `WishUseCase.throwWishError` с кодом из `errors` меты (`@ts-expect-error`-тест); `warn` DOM-09 — условие course-желания в одном `confirmableCourseId`; `warn` payload `ALREADY_EXISTS`/`NOT_FOUND` — `v.union` двух `strictObject`; `warn` гайд «aggregate» — ловушка `can*` переписана; `info` — ручной тип в `invite-wishers-er.test.ts` выведен из Def; оговорки в гайдах (TST-04 для теста конверта, DOM-14 только `occurredAt`, ERR-04 — `checkDefs` не видит legacy-коды, ERR-03 «через фасад»); `question` TR-3 — `validation`, а не `bad-request`. Принято как есть: текст `NOT_CONFIRMABLE` у недостижимой ветки (TR-5), дубль типа legacy-события в двух stories. `check` 3326 pass.

### Ф5 шаг 1 — domain-author
`WishAr.isActive()` (активные статусы типизированы ключами `WishArDef.statuses`), `isOwnedBy(userId)`, геттер `status`; `wish/wish.policy.ts` — `WishPolicy.rules.canCancel` (`rule` `isAuthor`, контекст `ReadonlyAr<WishAr>`); `wish.dcs.ts` — `WishDcs.checkUnique(userId, target, wishes): Result<void, WISH_ALREADY_EXISTS>`; legacy `policy.ts` удалён. Вне брифа: create-* — `allowAll` в Def UC (Ф8), правила нет — всегда за вызывающего; `gen dcs` без паспорта модуля неприменим — вручную по `service.ts`; цель — `CreateWish['target']` (DOM-01). Тесты +15, `packages/domain` 785 pass.

### Ф5 шаг 2 — migrator
`create-*-wish-uc` — `WishDcs.checkUnique` над `WishAr.restore`, отказ через `throwWishError`; `wish-json-repo` — `isActive` через Ar; `cancel-wish-uc` — `canCancel.evaluate` → `CoreErrors.ACCESS_DENIED` через свободный `throwWishError` (код не в мете команды; ветка недостижима). Тест чужого желания red → green. wish 165 pass, `check` 3342 pass.

### Ревью Ф5 (reviewer, `dea81f8` + гайд)
`error` нет, поведение бота сохранено (`conflict`, `payload.status`). Решения оркестратора (TR-6): `warn` DCS доверял выборке — `isFor(target)` в Ar, DCS отбрасывает чужие желания и другие цели (тесты +3; фикстура `create-module-wish-uc.test.ts` строила дубль чужому пользователю — исправлена, ожидания прежние); `warn` гайд/JSDoc про `allowAll` — «с Ф8»; `info` DOM-04 геттер `status` — критерий исключения в `domain-modeling.md` §5; `info` ERR-02 обход меты и `if` по статусу в `cancel-wish` — в TR-1 (снять в Ф8); `info` TST-03 в гайде уточнён; `ACTIVE_STATUSES` после блока типов. `check` 3345 pass.

### Ф6–7 шаг 1 — domain-author (платформа, Opus)
`domain/rules/{domain-rule,define-rules}.ts`; `check` — `Result<void, ErrorOf<NoInfer<E>>>`, чужой ErrorDef — ошибка типа (`@ts-expect-error`, DOM-16). `UseCaseFromDef`: `load → Policy → rules → execute`, правила и для `system`, отказ до UoW; `L extends контекст Policy & контексты rules` (пересечение по кортежу); конструктор принимает только правила с ошибкой из `errors` UC — пропуск ловит и компилятор. `checkDefs`: ошибка правила не в `errors` UC → ERR-02, дубль правила → DOM-16, label/description правил — MAN-01. Граф: узел `rules[<модуль>.<имя>]` (`usedBy`), модуль — владелец ошибки правила. Пример: `TaskRules.withinOpenLimit` (< 3 открытых), `TASK_TOO_MANY_OPEN`, `TaskAr.isOpen()`, тест отказа без записей и событий. Отклонения: `RulesDef` сам в `checkDefs` не попадает (на него нет ссылки из модуля, как у Policy); `TaskAr.complete/archive` возвращают `RejectOf<…>`, а не всю группу ошибок (иначе ERR-02 в `CompleteTaskUc`).

### Ф6–7 шаг 2 — domain-author (Opus)
`wish/wish.rules.ts` (`WishRules.rules.unique`, контекст `{ userId, target: CreateWish['target'], wishes }`), тесты DCS перенесены в `wish.rules.test.ts`; `WishAr.alreadyExists(): ErrorOf<…ALREADY_EXISTS>` — не `Result`: `ReadonlyAr` вырезает методы с `Result`, а правило работает над `ReadonlyAr`; в `err` оборачивает правило. Геттер `status` и `wish.dcs.ts` удалены. Эскалация: ссылки гайда «policy» на `wish.dcs.ts` — исправил оркестратор вместе с гайдом.

### Ф6–7 шаг 3 — migrator (Sonnet)
`create-{course,module}-wish-uc.ts`: `WishRules.rules.unique.check(…)`, отказ — `throwWishError` (TR-1). Тесты без изменений, поведение прежнее.

### Ф6–7 шаг 4 — domain-author (платформа, Opus)
Новизна — `storedVersion: number | undefined` (`undefined` — создан, не записан; `markStored()` после записи); признак ставит `newEntity()` символьной меткой, её отбрасывают схема, `snapshot()` и JSON — `restore` всегда «не новый», конструкторы наследников не меняются. `assertVersion(aggregate, ar, stored: StoredRecord | undefined)` — запись целиком: «нет записи» ≠ «legacy без version». UoW: события публикуются только у записанных агрегатов (в `finally`) — и при `VERSION_CONFLICT`, и при исключении; D-36 и errors-result.md §3 поправил оркестратор. Ограничение: `create` обязан строить базу через `newEntity` — иначе первая запись падает `VersionConflict` (не тихая перезапись).

### Ф6–7 шаг 5 — migrator (Sonnet)
Готово, гейт и `check` зелёные (3401 pass). Порт `WishRepo = Repository<WishAr> & {…}` — `packages/wish/src/wish/wish.repo.ts` (`findById`, `findAllByUserAndTarget`, `findCurrentByUserAndTarget`, `findByUser`, `findAllByKind`); резолвер — `wish/wish.resolver.ts`, подпуть `@u7-scl/wish/wish`; доменный `wish/repo.ts` удалён. `infra/wish.json-repo.ts` по шаблону gen (`createLock`, `assertVersion`, строгий `v.parse`), `JsonFileRepo` ушёл. UC/ER работают с `WishAr`, `save(ar)`; `cancel-wish` — `ar.canCancel()` вместо сравнения статусов (то же условие). Тесты `wish`: 171 → 178; репозиторий 12 → 19 (конфликт версии, `create` с занятым uuid, битая запись, legacy → `version: 1`). Отклонения, принятые оркестратором: правлены адаптеры трёх тестов бота (`wish-flow.integration`, e2e `user-notify`, `wish-questionnaire`) — чтение через `snapshot()`, подготовка состояния через `restore`, сценарии прежние; тест репозитория написан после реализации (red не зафиксирован) — замечание для ревью фазы. TR-7, TR-2 дополнен.

### Ф6–7 шаг 6 — api-author (Sonnet)
Готово, `check` зелёный (3403 pass). `apps/u7-bot/tests/courses/wish-legacy-records.integration.test.ts` (2 теста) на копии мира `core-education`: две сырые legacy-записи (ISO без зоны, без `updatedAt`/`version`) — `list-user-wishes` их видит с числовым `createdAt`; `cancel-wish` через `apiApp.execute` — в файле целевая `cancelled`, `version: 1`, даты числа, соседняя не потеряна и тоже с числами. Прод-код не менялся. Red при первом запуске — из-за фикстуры агента (`…T10:00:00`, секунды без зоны схема не принимает). Сверка оркестратора: legacy писал даты `isoNow()` = `toISOString().slice(0, 16)` (`YYYY-MM-DDTHH:mm`), `F.timestamp` принимает его и полный ISO с зоной — риска для `data/wish` нет.

### Ф6–7 шаг 7 — оркестратор (генератор, инфраструктура)
`gen module` создаёт фасад (домен и пакет: файл, импорт, поле `facade`, экспорт, ожидание в тесте паспорта) только с `--facade` (D-38); `--facade` у других видов — ошибка. TDD: тесты `cli`, `kinds/module`, `kinds/app-module` красные → green; snapshot дерева домена идёт с `--facade` (полное дерево naming.md §2), e2e (`genprobe`) — без фасада: tsc, biome, тесты заготовок и `arch:check` чистые. Путь с фасадом в e2e больше не собирается — шаблон фасада не менялся, проверен unit-тестами. `check` — 3406 pass.

### Ревью Ф6–7 (reviewer, Opus, diff `1a12024..57387865`)
`error` нет; регресса видимого поведения нет; `assertVersion`/UoW по D-15/D-36; гайды соответствуют коду. `warn`: интеграционный тест зависит от TZ, пробелы теста репозитория (→ шаг 8); id узла правила без агрегата (MAN-08, → шаг 9); колонка проверки DOM-16 (→ rules.md, TR-8). `question`: DQS вне полного запрета DOM-01 (→ TR-8, вопрос при первом DQS); строгий разбор и живые данные (→ Нурболату на контрольной точке: разбор `data/wish/wishes.json` без записи перед релизом; `createLock` — в пределах процесса, `scripts/call-uc.ts` пишет отдельным процессом). `info`: ERR-02 `test` (→ rules.md), дубль правила под DOM-16 (→ формулировка DOM-16), `RulesDef` вне `describedDefs`, публикация в `finally` (→ TR-8), `markStored` и `snapshot()` в ER (→ TR-7), резолвер в `src/wish/` (TR-7), `/tmp` в тесте (→ шаг 8).

### Ф6–7 шаги 8–9 — правки по ревью (api-author Sonnet, domain-author Opus)
Шаг 8: даты интеграционного теста — `Date.UTC`, зелёный при `TZ=Asia/Oral`; тест репозитория 19 → 25 (цель `module`, восстановленный без записи → `VersionConflict`, несколько активных, `ValiError` у битой записи и не-массива, невалидный JSON, `makeWish` без подмены статуса, `tmpdir()`); дефектов нет. Шаг 9: id узла правила — `<модуль>.<агрегат>.<name>` по владельцу ошибки (`ruleId` в `graph/def-index.ts`, общий для графа и `describedDefs`; неизвестный владелец — `?.?.<name>`); тесты на два агрегата с `unique` и правило чужого модуля. `check` — 3415 pass.

### Ф8 шаг 1 — domain-author (платформа, Opus)
Фасад убран из манифестов (`define-facade`, `implement-facade`, `guard-calls`, `facade` в модуле/карте/графе, `gen --facade`). `calls?: AnyUseCaseDef[]` у UC/ER/Job. `ModuleCaller { kind: 'module', from, origin }`, `moduleCaller`, `originOf`; `subjectOf(module)` — субъект `origin`; `delegable` — по `originOf`. `UseCaseFromDef`: `module` без UC в `from.calls` — `UNAUTHORIZED { callerKind, from }` до входа. `checkDefs`: `calls` вне `dependsOn` — ARC-04, свой модуль — MAN-05, вызываемый без `module` в `callers` — MAN-05, неизвестный Def — MAN-06; внешнему — `useCases` без реализации. Граф: `calls`/`calledBy`, L0 `{ kind: 'calls', …, type: command|query }`. Помощники: `CallContext { from, caller, trace }`, `this.callContext(…)` у баз, `callUseCase(owner, def, input, call)`, `asReadonlyAr(ArClass, res)`; `trace` — последний аргумент `load`/`execute`; `Trace`/`Cause` — в `kernel/trace`. Пример: query UC `todo.getTask` (`callers: ['module']`), `TodoFacade` — TS-тип в домене, тест фасада. Эскалация — тест `packages/core/src/legacy-bridge/example-app.test.ts` (сигнатура фасада примера), правка теста разрешена оркестратором. Отклонения — TR-10. `check`: 3439 pass / 0 fail.

### Ф8 шаг 2a — domain-author (Opus)
`course`: `CourseArDef` (минимальный), `GetCourseEnrollmentUcDef` (query, `callers: ['module']`, `allowAll`, выход — `variant('enrollable', [{ true, startModuleId }, { false }])`), тип `CourseModuleFacade` (`course.facade.ts`). `questionnaire`: `StartQuestionnaireUcDef` (command, вход `{ pool, owner }`, выход `{}`, `emits: [QuestionnaireEvents.started]`), событие `questionnaire.questionnaire.started`, тип `QuestionnaireModuleFacade`; `v.description` на полях пула (MAN-02). Отклонения — TR-11. `check`: 3449 pass / 0 fail.

### Ф8 шаг 2b — api-author (Opus)
Адаптеры `GetCourseEnrollmentUc`, `StartQuestionnaireUc` (`UseCaseFromDef` над legacy-фасадами), модули `createCourseModule`/`createQuestionnaireModule` (`ModuleFromDef`, ER/Job пустые), фасады `courseModuleFacade`/`questionnaireModuleFacade` через `callUseCase`; тесты 4 + 2 (в т. ч. `UNAUTHORIZED` вне `calls`). Маркеры TR-11, DEBT-21/22. Оркестратор: зависимости `dmg-core`/`@u7-scl/domain` в `packages/course/package.json`, «Место» DEBT-21/22. Сборка фасадов в приложении — Ф12: `courseModuleFacade(createCourseModule({ app, legacy }))`. `check`: 3455 pass / 0 fail.

### Ф8 шаг 3a — domain-author (Opus)
Решение (1) — доменное правило `WishRules.rules.courseEnrollable` (контекст `{ courseId, enrollment: CourseEnrollment }`), порядок — `rules: [courseEnrollable, unique]`; `load` только кладёт `enrollment` в контекст. (2)–(3): `WishAr.createForCourse({ uuid, userId, courseId }, at): Result<WishAr, never>` сам ищет пул (`pending`/`expressed`); `questionnaireToStart(): { pool, owner: { courseId } } | undefined` — транзиентное поле, только у созданного `createForCourse`. Вход UC — из `WishCourseTargetVo` (D-39). `WishModuleDef`: `dependsOn` [user, course, questionnaire, stream]. В тесте модуля отфильтрован MAN-06 для `invited`/`confirmed` (до Ф10–11). Домен wish: 109 pass; гейт красный только по заготовке 3b.

### Ф8 шаг 3b — api-author (Opus)
`WishDeps = ModuleDeps & { wishes: WishRepo; course: CourseModuleFacade; questionnaire: QuestionnaireModuleFacade }`, субъект — legacy `User` (DEBT-21/22). `CreateCourseWishUc`: `load` — `course.getCourseEnrollment(this.callContext(caller, trace), …)` (ошибка — как есть) + `findAllByUserAndTarget` → `{ courseId, enrollment, userId, target, wishes }`; `execute` — `createForCourse` → `uow.register` → `questionnaireToStart()` → `startQuestionnaire` до фиксации (D-41). 16 тестов UC (все 13 случаев legacy; 4 случая курса слились в `enrollable: false` — различие в тестах адаптера 2b; фейки типов фасадов из-за ARC-06) + smoke модуля. `createWishModule` в приложение — Ф12. `check`: 3494 pass / 0 fail.

### Ревью Ф8 (reviewer, Opus, diff `c4a31b7b..9774d353`)
Ошибок нет. warn: facade.md о `checkDefs` (MAN-05); тесты потребителя не сверяют `calls` (MAN-05); транзиентное поле `questionnaireToStart` вне state — рекомендация: фабрика возвращает пару. info: структурный `from` и прямой `handle` — обходы проверки; `UseCaseOwner` стирает субъект; `outcome` выбирает UC; оговорка `OUTPUT_VALIDATION` к D-41; антипаттерн в domain-modeling; имя `<M>ModuleFacade`; тип `owner` вручную. Решения — TR-12.

**Правки по ревью Ф8.**

*Шаг 4 — domain-author (Opus)* (`packages/dmg-core/src/testing/**`, `packages/domain/src/{wish,questionnaire}/**`):
- `dmg-core/testing`: фейк вызова фасада для тестов потребителя — например `fakeFacadeCall(def, answer)` или обёртка над функцией-ответом, которая по `call.from.calls` возвращает `UNAUTHORIZED` (тот же payload, что `UseCaseFromDef`), если Def UC не объявлен; экспорт из `dmg-core/testing`; тест (объявлен / не объявлен); переведи на него тест потребителя в учебном модуле, если он есть.
- `WishAr.createForCourse(…, at): Result<{ wish: WishAr; questionnaire?: WishQuestionnaire }, never>` (или `Result<…>` с типом, который выберешь); транзиентное поле и `questionnaireToStart()` удалить; тесты Ar — по новой форме. Если `outcome` выводится из результата без `if` в UC — сделай (например, `questionnaire ? 'questionnaire' : 'instant'` в домене как поле результата), с обоснованием.
- `questionnaire.facade.ts`: тип `owner` (и `pool`) выводится из входа `StartQuestionnaireUcDef` (`InputOf`), не вручную.
- Потребитель в `packages/wish` — шаг 5, его красный ожидаем.

*Шаг 5 — api-author (Sonnet)* (`packages/wish/src/**`): `CreateCourseWishUc` — по новой форме `createForCourse`; тесты UC и smoke модуля — фасады через фейк шага 4, плюс тест «Def вызываемого UC убран из `calls` → `UNAUTHORIZED`» (через подмену `from`, без правки Def). Тестов не меньше.

### Ф8 шаг 4 — domain-author (Opus)
`fakeFacadeCall(def, answer)` в `dmg-core/testing`: та же сигнатура, что у метода фасада; `UNAUTHORIZED` без `module` в `callers` или вне `call.from.calls` (ответ не вызывается). `WishAr.createForCourse(…): Result<CourseWishCreated, never>` — размеченное объединение `{ wish, outcome: 'instant' } | { wish, outcome: 'questionnaire', questionnaire }`; транзиентное поле и `questionnaireToStart()` удалены. `QuestionnaireModuleFacade`: `pool`/`owner` — из `InputOf<StartQuestionnaireUcDef>`. Тест `todo.facade.test.ts` не переведён (проверяет настоящий фасад). Домен wish: 103 pass (−7 тестов удалённого метода, +1).

### Ф8 шаг 5 — api-author (Sonnet)
`CreateCourseWishUc.execute` — по `{ wish, outcome, questionnaire }`; тесты UC и smoke модуля — фасады через `fakeFacadeCall`; +2 теста «вызываемый UC убран из `calls` → `UNAUTHORIZED`, ничего не записано» (подмена `def` экземпляра). Отдельный red для нового теста не запускался (написан вместе с реализацией). `packages/wish`: 116 pass. `check`: 3494 pass / 0 fail.

### Ф8а шаг 1 — domain-author (платформа, Opus)
`kernel/caller`: абстрактный `Caller<U extends Identified>`, `GuestCaller`/`UserCaller`/`DelegateCaller`/`SystemCaller(from: OperationRef, person?)`, `PersonCaller`, `CallerLog`, `OperationRef`; TDD (13 тестов). Удалены `ModuleCaller`, `CallingOperation`, `subjectOf`, `originOf`, `moduleCaller`, `systemCaller`, вид `'module'` (Def, `check-defs` MAN-05, шаблоны — `'system'`). `Trace.channel`. Потребители — механически (учебный модуль, `domain`, `wish`/`course`/`questionnaire`, `core` `api-app`/`legacy-bridge`, `scripts/gen`). Отклонения и временные мосты до Р2/Р5/Р7 — TR-13. `check`: 3504 pass / 0 fail.

### Ф8а шаг 2 — domain-author (платформа, Opus)
`Rule.evaluate(subject, ctx)`, `rule()` без субъекта — отказ без вызова `check`; `delegable` удалён (Policy, `graph/normalize`). `UseCaseFromDef`: Policy всегда; `protected` шаги `checkCaller` → `parseInput` → `load` → `checkPolicy` → `checkRules` → `execute` → `parseOutput`, фиксация — в приватном `run` (TR-13 п. 7). Тесты: system без человека → `ACCESS_DENIED`; системный UC с `allowAll`; наследник с ослабленным `checkPolicy`. Поведение потребителей не изменилось: системные UC (`GetCourseEnrollment`, `StartQuestionnaire`, `RemoveUser`) — `allowAll`, учебный `GetTaskUcDef` зовётся только с человеком. `check`: 3505 pass / 0 fail.

### Ф8а шаг 3 — domain-author (платформа, Opus)
`ModuleFromDef.handle(def, input, caller, trace)` (D — UC модуля по типу), `runJob(def, trace)`, `serves(def)`; `useCase` и карта Job — приватные. `ApiApp` — через `serves` + `handle`; `callUseCase` — `UseCaseOwner = { def; handle }`. `JobFromDef.handle(trace)`, временный `jobTrace()`; мост `legacyJob(module, def)`/`legacyJobsOf(module)` через `runJob`. Отклонения — TR-13 п. 8. Предложение к TR-13 п. 1: `ModuleMap` — `new (deps, module)`, база фабрикой `class X extends UseCaseFromDef.of(XUcDef)<Deps> {}` без своего конструктора (риск TS4094 при генерации деклараций). `check`: 3511 pass / 0 fail.

### Ф8а шаг 4 — domain-author (платформа, Opus)
`OperationFromDef` (`app/operation/`): `ref`, проверка «Def в модуле», `now()`, `protected call` по `CallsOf<D>`. `Facade<M>`/`SystemCallable<M>` (`domain/contracts/facade.ts`), `ModuleFacade`, `ModuleFacades`, `RoutableFacade` (`app/facade/`), `ModuleDeps.facades` обязателен; `StubFacade` (`testing/`: `answer`, `received`). Конструктор операций `(deps, module)` — решение Нурболата (TR-13 п. 1). Удалены `CallContext`, `callUseCase`, `UseCaseOwner`, `fakeFacadeCall`, `callContext`, `TodoFacade`, `CourseModuleFacade`, `QuestionnaireModuleFacade` и реализации фасадов в пакетах (`new ModuleFacade(createXModule(deps))`). `create-course-wish` — `this.call`, тесты — `StubFacade`; «UC не из `calls`» — `@ts-expect-error`. Эскалация: битые ссылки `guides/facade.md` — оркестратор поправил минимально (гайд — шаг 10). Отклонения — TR-13 п. 9. `check`: 3523 pass / 0 fail.

### Ф8а шаг 5 — domain-author (платформа, Opus)
`app/oplog/`: `OperationRecord`, `OperationLog`, `OperationRun` (на вызов: `at`, `durationMs`, `track(uow)`, `record(result)`), `JsonlOperationLog(dir, { maxBytes? })` (файл на день UTC, порог 8 КБ в байтах UTF-8 → `{ truncated, bytes, head }`). `AppContext.oplog` обязателен; `OperationFromDef.journal(call, body)` в `handle` UC/ER/Job — последний шаг при любом исходе. `uow.commit()` → `Result<readonly PublishedEvent[], CommitError>`. `MemoryOperationLog` в `testing/`, по умолчанию в `testAppContext`. Тесты: JSONL 7 (временный каталог), UoW 2, UC 8, ER 3, Job 3. Решения — TR-13 п. 10; прод-подключение — Ф12. Оркестратор: AGENTS.md (`data/oplog/` — живые данные), комментарий `.gitignore` (`data/*` уже исключает). `check`: 3546 pass / 0 fail.

### Ф8а шаг 6 — domain-author (платформа, Opus)
`SystemCallableUc<D>` в `define-use-case.ts`, `SystemCalls<S>` в параметрах `defineUseCase`/`defineEventReaction`/`defineJob` (UC без `'system'` → `never` на своём месте), 3 теста `@ts-expect-error`. `UNAUTHORIZED` — только `callerKind`. `Aggregate.readonly(state)` (`this: Restorable`, `NoInfer<S>`); `asReadonlyAr` удалён, тесты — в `domain/aggregate/readonly-ar.test.ts`. `caller` удалён из `EventEnvelope`, `UnitOfWorkContext`, `OperationContract`; legacy-мост — без условного `SystemCaller`, `publishWishEvents` без `caller`/`source`. Уже было: ошибки чужого UC и `trace` последним — закреплено тестами. TR-10 закрыт; отклонения — TR-13 п. 11. К Р8: `createUow(trace)` без `caller`. `check`: 3552 pass / 0 fail.

### Ф8а шаг 7 — domain-author (платформа, Opus)
Класс `Trace` (`kernel/trace`, приватный конструктор): `fromRequest(meta, onMissing?)`, `fromEvent`, `forJob(def)`, `channel`, `toLog(): TraceLog`, `toEnvelope()`; `app/trace.ts` удалён, тесты — `kernel/trace/trace.test.ts`. `OperationFromDef.createUow(trace)` (`emits` из Def, `touches`/`scans`), `contractUnitOfWork`/`OperationContract` удалены. ER/UoW/`OperationRun`/мосты — через `Trace`. `Aggregate.newState` вместо `newEntity` (`task.ar.ts`, `wish.ar.ts`, шаблоны `gen`). `ApiApp.run`/`execute` — готовый `Trace`. Отклонения — TR-13 п. 12. `check`: 3561 pass / 0 fail.

### Ф8а шаг 8 — domain-author (Sonnet)
`QuestionnaireRespondentPolicy` (`questionnaire-respondent.policy.ts`, правило `hasRespondent`; `QuestionnairePolicy` занято legacy) — `StartQuestionnaireUcDef.policy` вместо `allowAll`. Адаптер не менялся (субъект гарантирует Policy). Тесты: Policy (с человеком / без субъекта), модуль — `SystemCaller` без человека → `ACCESS_DENIED`, `startStandard` не вызван. TR-11 — пересмотр отмечен. `check`: 3565 pass / 0 fail.

### Ф8а шаг 9 (Р10) — отчёт
- domain-author (Sonnet): `createForCourse` → `Result<WishAr, never>` (статус `pending` при найденном пуле); `questionnaire()` — `pending` + курс + пул, `outcome()` — из `questionnaire()`; `CourseWishCreated` удалён; тест «анкета — не свойство Ar» заменён тестами методов после `restore`. red 5 fail → green 105 pass.
- api-author (Sonnet): `create-course-wish` берёт `wish.questionnaire()`/`wish.outcome()`; тесты пакета без изменений, 115 pass.
- Оркестратор: ловушка в гайде use case поправлена; TR-12 — блок «Пересмотрено». `check`: 3567 pass / 0 fail.

### Ф8а шаг 10 (перевод потребителей) — отчёт
- api-author (Opus): прод-код без изменений поведения — комментарии к D-43 (`get-task` todo, `create-course-wish`); тесты: `load` методом вместо поля-стрелки (todo, course, questionnaire), `create-course-wish.uc.test.ts` — ручной учёт вызовов заменён `StubFacade.received`, `StubFacade` в `beforeEach`/`makeModule` (не копят `received`); questionnaire — без `as unknown as User`, Policy-тесты через `module.handle`; в todo добавлен тест «потребитель отдельно — `StubFacade`». 3568 pass (+1).
- Оставлено: ссылки на D-42 про связь «UC → UC» (в силе); ручной `SystemCaller` в тесте вызываемого UC (системный вызов без человека); в платформе `dmg-core` — doc `UseCaseFromDef.load` с D-42 и поля-стрелки в `operation-from-def.test.ts` (вне границ шага → ревью).
- Оркестратор: гайды «use case» (новый §3 «Устройство реализации») и «facade» переписаны по D-43.

### Ф8а ревью — отчёт
- reviewer (Opus), `c05ec0a3..HEAD`: error/warn нет, 8 info; проверены MAN-05, MAN-09, MAN-11, API-01, API-04, API-05, ERR-01, ERR-03, ERR-07, DOM-03, DOM-04, DOM-15, TST-02, TST-03, TST-05, CODE-03; остатков удалённого API нет.
- api-author (Sonnet): ссылки D-43/caller.md п. 6; поля-стрелки шагов → методы (4 тестовых файла); `DeclaredCalls` — один тип в `define-use-case.ts`; `hasRespondent` — явный дженерик `rule`. 3568 pass.
- Оркестратор: гайды (`journal`, нет фасада → `SERVER_INTERNAL`); TR-14.

### Ф9.1 домен — domain-author (Sonnet)
`GetModuleEnrollmentUcDef` (`course`, query, `system`, `allowAll`, выход `{ enrollable }`); `WishRules.rules.moduleEnrollable` (`WISH_MODULE_NOT_FOUND`); `WishAr.createForModule` (`expressed`); `CreateModuleWishUcDef`; `WishModuleTargetVo` экспортирован для входа. TDD wish соблюдён (red 9 → green); Def `course` — тест и код одним шагом (тривиально). Гейт красный по границе шага (реализации в пакетах) — ожидаемо.

### Ф9.1 пакет — api-author (Sonnet)
Адаптер TR-11 `GetModuleEnrollmentUc` над legacy `getModulePlace` (`packages/course`), регистрация в `courseModuleMap`; `CreateModuleWishUc` (`load` — `this.call` + желания на цель, `execute` — `createForModule` + `uow.register`). Перенесены все случаи legacy (случай «модуль вне опубликованных» совпал с «недоступен»). `kind` ошибки `not_found` вместо legacy `not-found` — по платформе (мост TR-1). Адаптер `course` — код раньше теста. Гейт и `check` зелёные (3597 pass).

### Ф9.2 домен — domain-author (Sonnet)
`WishAr.notFound()` (по образцу `alreadyExists`); правило `WishRules.rules.cancellable` (`{ wish }`: `canCancel()` → ok, иначе `wish.notFound()`); `CancelWishUcDef` (`policy: canCancel`, `rules: [cancellable]`, вход `WishTargetVo`, выход `{}`). «Нет желания» → `NOT_FOUND` из `load` (отказ загрузки, образец `complete-task`/`get-task`; Policy требует `wish` в контексте); «не отменяемо» → правило после Policy. TDD соблюдён.

### Ф9.2 пакет — api-author (Sonnet)
`CancelWishUc`: `load` — `findCurrentByUserAndTarget`, нет → `NOT_FOUND`; `execute` — `cancel` → `uow.register`. 12 тестов (все случаи legacy + `ACCESS_DENIED` чужого желания подменой поиска, `UNAUTHORIZED`). Правка оркестратора: подмена ошибки перехода в UC (`err(wish.notFound())`) убрана — `return cancelled`, `WISH_NOT_CANCELLABLE` в `errors` Def (недостижим через UC, ERR-02). Гейт и `check` зелёные (3623 pass).

### Ф9.3 — domain-author + api-author (Sonnet)
`ListUserWishesUcDef`: query, `allowAll`, вход `{}`, выход `v.array(WishArDef.state)`, `errors: []`. `ListUserWishesUc`: `load` — `ok(undefined)`, `execute` — `findByUser(subject)` → `snapshot()` (идиома учебного `list-tasks`). Тесты: все случаи legacy + только свои, `UNAUTHORIZED`, query не пишет. TDD соблюдён; гейт и `check` зелёные (3630 pass).

### Ревью Ф9 (reviewer, Sonnet, diff `6e542c7d..be6392c3`)
error нет. warning: `snapshot()` в query UC и в гайде (D-05/D-39) — принятый риск TR-15, открытый вопрос п. 8; тернар payload `NOT_FOUND` в `CancelWishUc.load` (API-01) — исправлено: `WishAr.notFoundFor(userId, target)`, через неё `notFound()` (domain-author, Sonnet, TDD). note: `NOT_CANCELLABLE` в `errors` оправдан; разделение `load`/`cancellable` верно; адаптер курса — дописан в TR-11; избыточность `Loaded` в `createModuleWish` — поля нужны контексту правил, оставлено. Перенос legacy (TST-05) выполнен.

### Ф9а шаг 1 — domain-author (платформа, Opus)
`Aggregate<D, V = StateOf<D>>`: `view(): V`, по умолчанию `snapshot()` (исходно — `this: SameType…` с ошибкой типа без переопределения; упрощено в `23f27f3c`, TR-17); доступен у `ReadonlyAr`. Lint DOM-17 — GritQL-плагин `packages/dmg-core/biome-plugins/dom-17-snapshot-repo-only.grit` на `packages/*/src/**` и `apps/**` (расширено по указанию оркестратора), исключения: тесты, `*.repo.ts`, `*.json-repo.ts`, `infra/**`, `app.fixture.ts`, `aggregate.ts`, legacy `packages/wish/src/api/**` (TR-16). 14 фикстур (red → green). Переведены `get-task`, `list-tasks`, `listUserWishes`. Шаблоны `scripts/gen` без изменений: тест Ar проверяет `snapshot()` как контракт репозитория. `check` зелёный (3650 pass).

### Ревью Ф9а (reviewer, Opus, diff `de44c108..e5983103`)
error нет. warning: дыра `SameType` (форма без необязательного поля), `?.snapshot()` не ловится, `!**/infra/**` слишком широк — исправлены (domain-author, Opus, red → green). note: rules.md, TR-16, гайд «aggregate» — поправлены оркестратором. Решения — TR-17. `check` зелёный (3654 pass).

### Ф10 шаг 1 — domain-author (Opus)
Def UC курса `GetCoursesIncludingModuleUcDef` (`{ moduleId, courseIds }` → `{ courseIds }`), `GetSameModulesUcDef` (`{ moduleId, moduleIds }` → `{ moduleIds }`) в `CourseModuleDef`; `FulfillWishErDef` (`gen er`) в `WishModuleDef.reactions`; `WishAr.fulfillmentTargets()`, `isFulfilledBy(enrolled)` (`wish.types.ts`); `WishFulfillmentDcs(moduleId, wishes)` (`gen dcs`): `question()` — по батчу на вид цели, только при кандидатах; `fulfill(answer, at)` → `Result<WishAr[]>`. Обоснование DCS: батч по нескольким агрегатам (DOM-06), иначе ER делит по виду цели (API-01). Заготовка `packages/wish/src/wish/er/fulfill-wish.er.ts` от генератора. Гейт красный только на карте модуля курса (адаптеры — шаг 2). TR-кандидаты: батч `getSameModules` вместо цикла `isSameModule`; первый `*.types.ts` в домене wish.

### Ф10 шаг 2 — api-author (Opus)
Адаптеры курса `get-courses-including-module.uc.ts`, `get-same-modules.uc.ts` (TR-11, над `whichCoursesIncludeModule`/`whichModulesAreSame`) в `courseModuleMap`; `FulfillWishEr` (`react`: `findByUser` → `WishFulfillmentDcs` → `this.call` только по вопросам домена → `fulfill` → `uow.register`). 13 тестов (red 8 → green): случаи legacy, повтор события, отказ/исключение курса → `SERVER_INTERNAL`, ничего не записано, `logger.error`, запись в oplog; доставка через `subscribe`. Тесты — `WishJsonRepo` во временном каталоге (как у UC). Отличие от legacy: сбой — атомарно (TR-18 п. 3). `check` 3696 pass, `arch:check` 0.

### Ревью Ф10 (reviewer, Opus, diff `23f27f3c..33018818`)
error нет. warning: `*.types.ts` вне naming.md. info: раздел «Устройство реализации» вне шаблона, `ask` и прямой `subscribe` в гайде, двойной смысл `FulfillmentTargets`, JSDoc legacy в контракте курса, длина/опрос в тестах ER, виды id в фикстурах DCS, атомарность (TR-18 п. 3). Поведение legacy сохранено (11 случаев + новые). Решения — TR-19.

### Ф11.1 шаг 1 — domain-author (Sonnet)
`ConfirmWishErDef` (`on: QuestionnaireEvents.completed`, `emits: [WishEvents.confirmed]`), `AbandonWishErDef` (`on: QuestionnaireEvents.abandoned`, `emits: []`) через `gen er`, в `WishModuleDef.reactions`. `WishAr.questionnaireTarget(owner)` — разбор `owner` (valibot, обратен `questionnaire().owner`; чужой → `undefined`). `WishAr.current(wishes, userId, target)` — статический выбор активного желания (набор агрегатов; `WishRules` — проверки, не выбор). Гейт зелёный (домен wish 170 pass); заготовки реализаций в `packages/wish` от генератора.

### Ф11.1 шаг 2 — api-author (Sonnet)
`ConfirmWishEr`, `AbandonWishEr` (`react`: `questionnaireTarget` → нет цели — `ok()` без загрузки; `findAllByUserAndTarget` → `WishAr.current` → `canConfirm`/`canAbandon` → переход `this.now()` → `uow.register`). По 9 тестов: случаи legacy, выбор активного среди завершённых, изоляция курса/пользователя, повтор, чужой `owner`, `confirmed` на шине через UoW, доставка через `subscribe`. Red пропущен — добран мутацией (`react` → `ok()`): confirm 5/9 fail, abandon 4/9 fail (прошли только негативные). `check` 3729 pass.

### Ф11.2 шаг 1 — domain-author (Sonnet)
Внешние Def: `GetCoursesStartingWithModuleUcDef` (course), `GetStreamPresenceUcDef` (stream, `{ exists }`), `GetTelegramAddressesUcDef` (user, `{ addresses }`), минимальный `UserArDef`. `InviteWishersErDef`: `calls` — три новых + `GetSameModulesUcDef` (module-ветка), `emits: [WishEvents.invited]`; фильтр MAN-06 снят. `WishAr.invite(at, to)` (`change`), `WISH_NOT_INVITABLE` (conflict), `canInvite`/`invitationTargets`/`isInvitedBy`/`addresseeId`. `WishInvitationDcs(streamId, moduleId, wishes)`: `matchQuestion()` → `reachQuestion(match)` → `invite(match, reach, at)` → `{ invited, unreachable }`; потока нет — пустой итог без `warn`; `unreachable` — уникальные `userId` (legacy — по желанию). Red→green по артефактам, кроме `addresseeId` и ожидания `reactions` (одним заходом). TR-кандидат: `invitationTargets`/`isInvitedBy` дублируют `fulfillment*`. Гейт красный только на карте курса (шаг 2).

### Ф11.2 шаг 2 — api-author (Sonnet)
Адаптеры TR-11: `GetCoursesStartingWithModuleUc` (`getModulePlace().isFirst` → `whichCoursesIncludeModule`, иначе пусто), `GetStreamPresenceUc` (`getStream`), `GetTelegramAddressesUc` (цикл `getUserByUuid`); новые карты `stream.module.ts`, `user.module.ts` (`<M>Legacy = Pick<…>`, `create<M>Module`), `packages/user` получил workspace-зависимости `@u7-scl/domain`, `dmg-core`. `InviteWishersEr`: два `findAllByKind` → `WishInvitationDcs` (2 раунда) → `invite` → `uow.register`; `warn` по уникальному `unreachable`. Red→green: course 3 fail → 13 pass, ER 13 fail/5 pass (негативные) → 18 pass, stream 1 → 3, user 1 → 5 (адаптеры stream/user — со второго захода, после возврата оркестратором). Отличия от legacy: «нет профиля» и «нет `telegramId`» — один случай; `warn` на пользователя, не на желание; `version`/`updatedAt` растут (вопрос 9); повторное событие — повторное приглашение (как legacy). TR-кандидат: один метод репозитория вместо двух `findAllByKind`. `check` 3793 pass.

### Ревью Ф11 (reviewer, Sonnet, diff `cd5bd03..be43672a`)
error нет. warning: литералы статусов в `findAllByKind` `invite-wishers.er.ts` (дубль `canInvite`) — убраны (api-author, рефакторинг без red). info: `askMatch`/`askReach` в ER, дубль `invitationTargets`/`fulfillment*`, запись на приглашение (вопрос 9), отличия пропусков от legacy (`telegramId: 0`), `@types/bun` в lock. Поведение legacy сохранено (5+3+12 случаев). Хвосты TR-19 п. 4: JSDoc `GetSameModulesUcDef`, виды id в фикстурах DCS, тест отказа `fulfill-wish`, детерминированное ожидание `subscribe` (`er.fixture.ts`, `trackHandling`). Решения — TR-20.
