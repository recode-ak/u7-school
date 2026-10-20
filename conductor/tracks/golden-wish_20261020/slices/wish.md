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

- **Уникальность — доменное правило `WishRules.unique` (Ф6–7, D-40; в Ф5 было DCS); DCS и DQS нет.** `list-user-wishes` — query UC, читает один агрегат через репозиторий; output выводится из схемы entity. Гайд «dcs/dqs» описывает критерий выбора, эталон DCS/DQS — в `stream`.
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
