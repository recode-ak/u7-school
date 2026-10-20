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

- **DCS/DQS нет.** `list-user-wishes` — query UC, читает один агрегат через репозиторий; output выводится из схемы entity. Гайд «dcs/dqs» описывает критерий выбора, эталон DCS/DQS — в `stream`.
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
| — | `wish.facade.ts` (`WishFacadeDef`) | 7 |
| `wish/commands/<n>-cmd.ts` | `wish/uc/<n>.uc.ts` (`<N>UcDef`) | 8–9 |
| — (ER только в api) | `wish/er/<n>.er.ts` (`<N>ErDef`) | 10–11 |
| `module.ts` (мета + резолвер) | `wish.module.ts` (`WishModuleDef`) | 12 |

Прикладной слой `packages/wish/src/`:

| Было | Станет | Фаза |
|---|---|---|
| `infra/db/wish-json-repo.ts` | `infra/wish.json-repo.ts` | 6 |
| — | `wish.facade.ts` (`implementFacade`) | 7 |
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

1. **Ф3/Ф12. Имена событий.** FQN по naming.md — `wish.wish.invited`, а stories подписаны на `'wish.invited'`/`'wish.confirmed'`. Мост `legacyEventBus` передаёт legacy-подписчикам FQN как `eventName` — без решения stories перестанут получать события.
2. ✅ **Решено (D-37):** события зависимостей описываются в их `contract.ts`, модуль-зависимость — внешний `defineModule({ external: true })`, legacy-события доставляет карта `inbound` в `legacyEventBus` (payload проверяет схема Def). Задача — Фаза 0 плана.
   **Было: Ф10–11. Входящие события legacy.** ER `wish` слушают `student.enrolled`, `stream.created` (stream) и `questionnaire:complete`/`questionnaire:abandon` — это legacy-события без Def; `legacyEventBus` **не доставляет** legacy-события подписчикам DMG. `defineEventReaction.on` требует Def события. Нужен мост «legacy → DMG» или Def событий зависимостей (их модули не мигрированы).
3. ✅ **Решено (D-37):** `dependsOn` ссылается на внешние `ModuleDef` зависимостей (тот же контракт, что в п. 2); при миграции зависимости `external` снимается.
   **Было: Ф12. `dependsOn`.** У `user`, `course`, `questionnaire`, `stream` нет `ModuleDef`; `defineModule.dependsOn` ждёт Def. Варианты: stub-Def зависимостей (долг) или временное ослабление.
4. **Ф7. Содержимое фасада.** Сейчас у `wish` нет фасада и внешних потребителей фасада (UI ходит через `appApi`). Что выставить в `WishFacadeDef` без спекулятивного API.
5. **Фасады зависимостей** (`CourseFacade` и др.) — legacy: `boolean`/`undefined`, без `Result`. UC `wish` вызывает их как есть; перевод — в их треках.

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
