# Plan: golden-wish_20261020

Каждая задача — TDD (red → запуск → green, по шагам), `bun run check` и `arch:check` зелёные после каждой. Структура создаётся `bun run gen`, не руками. Пишут `migrator` / `domain-author` / `api-author`, проверяет `reviewer`, коммитит orchestrator ([agents.md](../../architecture/agents.md)).

**Каждая фаза = один вид манифеста:** код → гайд (пишется сразу) → отчёт reviewer → контрольная точка.

**С Фазы 2 — автономный режим** ([agents.md](../../architecture/agents.md) §9): Нурболат включается только по стратегическим вопросам, тактика записывается в `TR-<n>` ([debt.md](../../architecture/debt.md) §6), гайды Нурболат смотрит на ревизии.

Данные `data/` не трогаем; репозиторий проверяется на `DB_DIR=./data/fixtures`. Входной долг — в [spec.md](./spec.md).

## Фаза 0: Бриф и база [checkpoint: 85dd753]

- [x] Task: Бриф среза `slices/wish.md`: границы, перечень Def и реализаций, сохраняемое поведение, ID правил, список файлов «было → станет» по [naming.md](../../architecture/naming.md); решение, нужен ли DCS/DQS (запрос `list-user-wishes` → DQS?); Job нет `e3a6f222`
- [x] Task: Зафиксировать базовую линию тестов (`bun test`: 3211 pass) и тестов `wish` — 3211 pass / 0 fail; `wish` (домен + пакет): 107 pass / 14 файлов (в брифе)
- [x] Task: Режим `--adopt` генератора для legacy-модуля: `gen module|aggregate … --adopt` создаёт недостающие файлы рядом с legacy, существующий `index.ts` пропускает и печатает шаблон (пакетные `package.json`/`tsconfig.json` генератор и так не пересоздаёт); коллизия остальных файлов — по-прежнему ошибка; строка в naming.md §5 `ef2a3c41`
- [x] Task: Каркас гайда (шаблон по Ф4 спеки) в `conductor/architecture/guides/` и контрактный тест живости ссылок гайдов (в `check`); ссылка из `architecture/index.md` `ffb2ddf9`
- [x] Task: Контракты зависимостей (D-37, бриф §«Открытые вопросы» п. 2–3): в `domain/{user,course,questionnaire,stream}/contract.ts` — Def событий, на которые реагирует `wish` (`student.enrolled`, `stream.created`, `questionnaire:complete`, `questionnaire:abandon`), и внешние `ModuleDef` (`external: true`); карта `inbound` для `legacyEventBus` с переводом legacy-payload; тест доставки на реальном legacy-событии. Учитывает изменения платформы по ревью — [review-fixes.md](./review-fixes.md) `21109e88`
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md)

## Фаза 1: State (схема entity) [checkpoint: c978c43]

- [x] Task: Платформа: запись без `updatedAt` читается как `updatedAt = createdAt` (по образцу `version`, D-36) `9048034a`
- [x] Task: Перенос структуры по naming.md (`wish/wish.state.ts`, вручную по шаблону gen), имена `WishState`/`WishTarget`/`WishStatus`, поля через `F.*`, `v.description()` на каждом поле; базовые поля и даты — Ф2 `65a148a2`
- [x] Task: Гайд «state» `24259803`
- [x] Task: Ревью reviewer → обзор `2aaeb230` (VO с суффиксом `Vo` — решение Нурболата)
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: Агрегат (`defineAggregate` + Ar) [checkpoint: 9674e0b0]

- [x] Task: State на `BaseEntityFields` + `F.timestamp` (DEBT-24) вместе с `WishArDef`; legacy-репозиторий разбирает `WishArDef.state` (фолбэк `updatedAt`, иначе `JsonFileRepo` теряет записи без `updatedAt`) — тест на legacy-записи (ISO без зоны, без `updatedAt`/`version`); гайд «state» дополнить `8353be9` (гайд — в задаче «Гайд «aggregate»»)
- [x] Task: `WishArDef`: статусы и переходы двух веток; `WishAr.create(): Result`, `restore()`, `snapshot()` только для репозитория; переходы `confirm/abandon/cancel/fulfill` возвращают `Result`; убрать `safeUpdate`/`throwBadRequest` и импорты `core` `8353be9`
- [x] Task: Гайд «aggregate» `ce7e32e`
- [x] Task: Ревью reviewer; замечания без `error` — решение orchestrator (TR) `e558b5c`
- [x] Task: Контрольная точка 'Фаза 2' (автономно, workflow.md)

## Фаза 3–4: События и ошибки (`defineEvents`, `defineErrors`) [checkpoint: 9f13113]

> Объединены ради экономии: один прогон reviewer, одна контрольная точка; гайды — по видам.

- [x] Task: `WishEvents` (FQN по модулю и агрегату, прошедшее время), схемы payload; перевод потребителей событий `4e6c7e9`
- [x] Task: `WishErrors` с кодами `WISH_*`, `kind`, схемой payload; замена `throw*` на ошибки `Result` `4e6c7e9` (`Result` до вызывающих — Ф8/Ф10, мост TR-1)
- [x] Task: Гайды «events» и «errors» `96c7993`
- [x] Task: Ревью reviewer; замечания без `error` — решение orchestrator (TR) `4e6c7e9`
- [x] Task: Контрольная точка 'Фаза 3–4' (автономно, workflow.md)

## Фаза 5: Policy (`definePolicy` / `rule`) [checkpoint: 1a12024]

> После ошибок: `denyMessage` и ошибки Policy ссылаются на `WishErrors`.

- [x] Task: `WishPolicy` правилами с `label` и `denyMessage` (только права, `canCancel`); правило «не более одного активного wish на (user, target)» — DCS с `Result` `WISH_ALREADY_EXISTS`, `isActive` — метод Ar (бриф §Ф5, вопрос 7, вариант A) `dea81f8`
- [x] Task: Гайд «policy» `6aaf21c`
- [x] Task: Ревью reviewer; замечания без `error` — решение orchestrator (TR) `99bb251` (TR-6)
- [x] Task: Контрольная точка 'Фаза 5' (автономно, workflow.md)

## Фаза 6–7: Репозиторий, сервисы и фасад (Repo, DCS/DQS, `defineFacade`) [checkpoint: b72599f]

> Объединены ради экономии: один прогон reviewer, одна контрольная точка; гайды — по видам.

- [x] Task: Платформа по D-40: декларативное доменное правило в `dmg-core` (Def по образцу `rule`: имя, `label`, `description`, ссылка на `ErrorDef`, проверка → `Result`), поле правил в Def UC рядом с `policy`, видимость в манифесте/графе, `checkDefs`; имена API и файлов — в naming.md; DOM-16 машинно (type) `e55292c`
- [x] Task: Lint DOM-01 по D-39: импорт `…/state` разрешён Def контрактов своего модуля (`*.uc.ts`, `*.events.ts`, `*.dqs.ts`, `*.facade.ts`), фикстуры `lint-rules.test.ts` (red → green) `f47aa38`
- [x] Task: `wish` по D-39/D-40: `WishDcs.checkUnique` → доменное правило уникальности (`WISH_ALREADY_EXISTS`); геттер `WishAr.status` → метод `alreadyExists()`, строящий ошибку; UC — без изменений видимого поведения; гайд «policy» — третий уровень; TR-6 закрыть `43ee307`
- [x] Task: Платформа по ревью приёмки (`slices/wish.md`, «Приёмка правок платформы»): `assertVersion` отличает новый агрегат от записи версии 0 (create с занятым uuid — конфликт, legacy-записи `data/wish` без `version` не перезаписываются); поведение событий записанных агрегатов при `VERSION_CONFLICT` — исправить или описать в errors-result.md §3 `18d2930`
- [x] Task: Порт `WishRepo` на Ar/`Result`, `WishJsonRepo` с `F.timestamp` (чтение строки и числа), UoW; DQS для чтения списка, если решено в Фазе 0 `9639fe8`
- [x] Task: Тест репозитория на `DB_DIR=./data/fixtures`: ISO-строка читается, число пишется `87149fa`
- [x] Task: Генератор по D-38: `gen module` создаёт фасад (домен и пакет) только с `--facade`; тесты `scripts/gen` (red → green); у `wish` фасада нет — потребителей нет `8fbced5`
- [x] Task: Гайды «repo / dcs / dqs» и «facade» (критерий «только по потребителю», эталон — пример `dmg-core`) `f3f69a8`
- [x] Task: Ревью reviewer; замечания без `error` — решение orchestrator (TR) `67d4ca6` (TR-7, TR-8)
- [x] Task: Контрольная точка 'Фаза 6–7' (автономно, workflow.md)

## Фаза 8: Use Case — эталон (`create-course-wish`) [checkpoint: 6e2e7e9]

- [x] Task: Платформа по D-42: фасад без манифеста (`defineFacade`/`method`/`facade` в модуле, узлы фасадов в графе, `gen --facade` уходят); `calls` (Def UC других модулей) у UC/ER/Job; вызывающий `module` (`from`, `origin`, субъект `origin`); отказ UC, если его нет в `calls` у `from` или `module` нет в `callers`; помощник фасада (вызов UC, state → `ReadonlyAr`); `checkDefs` (`calls` из `dependsOn`); граф «UC → UC»; Def UC у внешнего модуля (D-37); учебный модуль `dmg-core` переведён `7e05eca`
- [x] Task: Контракты внешних зависимостей для `create-course-wish` (D-42): Def UC `course` (допуск к записи, стартовый модуль) и `questionnaire` (запуск анкеты) без реализации; адаптеры legacy-фасадов под них (TR) `d9fee2e6`
- [x] Task: `CreateCourseWishUcDef` (`policy`, `rules`, `callers`, `calls`, `input`, `output`, `errors`, `emits`) + реализация `UseCaseFromDef`, UoW, `Result`; запуск анкеты — в `execute` до фиксации (D-41, вариант 1); выбор статуса по пулу — в домене (API-01) `f3dc5930`
- [x] Task: Гайд «use case»; гайд «facade» переписан по D-41/D-42 `acfe748b`
- [x] Task: Ревью reviewer; замечания без `error` — решение orchestrator (TR) `9c0a7047` (TR-12)
- [x] Task: Контрольная точка 'Фаза 8' (автономно, workflow.md)

## Фаза 8а: Вызовы и граница модуля (платформа)

> Решения Р1–Р10 — [OPEN-QUESTIONS-F8.md](../../../OPEN-QUESTIONS-F8.md) (Нурболат, 2026-10-21). Платформенный эталон: TDD (red → green по шагам), Opus. Классы с зоной ответственности, не функции-хелперы.

- [x] Task: D-43 в decisions.md (Р1–Р10; D-42 — вызывающий `module` и рантайм-проверка `calls` заменены); `caller.md` и связанные документы `architecture/` `d625e982`
- [ ] Task: Р1 — `Caller` иерархией классов (`subject()`, `person()`, `toLog()`), один `SystemCaller(from: OperationRef, person?)`; `channel` → `Trace.channel`; `callers` без `module`; удалить `subjectOf`/`originOf`/`moduleCaller`/`systemCaller`
- [ ] Task: Р2 — `Rule.evaluate(subject, ctx)`, без `delegable`; Policy всегда; шаги `UseCaseFromDef` — `protected` (`checkCaller` … `parseOutput`)
- [ ] Task: Р3 — `ModuleFromDef.handle`/`runJob`, `useCase` не публичный; `ApiApp` — только через модуль
- [ ] Task: Р4–Р5 — `OperationFromDef` (база UC/ER/Job, типизированный `call` по `D['calls']`), `Facade<M>` в домене, `ModuleFacade<M>`, `ModuleFacades` в `deps`, `StubFacade<M>` в `dmg-core/testing`; удалить `CallContext`, `callUseCase`, `fakeFacadeCall`, рантайм-проверку `calls`
- [ ] Task: Р6 — `OperationLog` в `AppContext`, запись в `OperationFromDef`, `uow.commit()` возвращает события; JSONL в `data/oplog/` (порог размера `input`/`output`), `.gitignore`, AGENTS.md — список живых данных
- [ ] Task: Р7 — `calls` по типу только UC с `'system'` в `callers`; `UNAUTHORIZED` без `from`; `Aggregate.readonly(state)` вместо `asReadonlyAr`; `caller` удалён из конверта события (и UoW); TR-10 в debt.md закрыть
- [ ] Task: Р8 — `OperationFromDef.createUow` вместо `contractUnitOfWork`; класс `Trace` (`fromRequest`/`fromEvent`/`forJob`) вместо `requestTrace`/`incomingRequestId`; `Aggregate.newState` вместо `newEntity`
- [ ] Task: Р9 — `StartQuestionnaireUcDef.policy`: правило «респондент есть» вместо `allowAll`; TR-11 в debt.md — пересмотр отметить
- [ ] Task: Р10 — `WishAr.createForCourse` → `Result<WishAr, never>`, методы `questionnaire()` и `outcome()` из state (red → green в домене); `create-course-wish` берёт их; TR-12 в debt.md — пересмотр отметить
- [ ] Task: Перевод потребителей: учебный модуль `dmg-core`, `wish` (`create-course-wish`), `course`, `questionnaire`; гайды «use case» и «facade»
- [ ] Task: Ревью reviewer; замечания без `error` — решение orchestrator (TR)
- [ ] Task: Контрольная точка 'Фаза 8а' (автономно, workflow.md); удалить `OPEN-QUESTIONS-F8.md` (решения — в D-43)

## Фаза 9: Остальные Use Case

> **Перед стартом:** Фаза 8а закрыта; `OPEN-QUESTIONS-F8.md` перенесён в D-43 и удалён.

- [ ] Task: `create-module-wish`, `cancel-wish`, `list-user-wishes` по гайду Фазы 8 (по одному, отдельный TDD-цикл)
- [ ] Task: Уточнить гайд «use case» (command и query, отличия)
- [ ] Task: Ревью reviewer; замечания без `error` — решение orchestrator (TR)
- [ ] Task: Контрольная точка 'Фаза 9' (автономно, workflow.md)

## Фаза 10: Event Reaction — эталон (`fulfill-wish`)

- [ ] Task: `defineEventReaction` (`on`, `touches`, `calls`, `emits`) + `ReactionFromDef`, идемпотентность, `Result`, журнал сбоев вместо `console.error`
- [ ] Task: Гайд «event reaction»
- [ ] Task: Ревью reviewer; замечания без `error` — решение orchestrator (TR)
- [ ] Task: Контрольная точка 'Фаза 10' (автономно, workflow.md)

## Фаза 11: Остальные Event Reaction

- [ ] Task: `confirm-wish`, `abandon-wish`, `invite-wishers` по гайду Фазы 10 (по одному, отдельный TDD-цикл)
- [ ] Task: Уточнить гайд «event reaction»
- [ ] Task: Ревью reviewer; замечания без `error` — решение orchestrator (TR)
- [ ] Task: Контрольная точка 'Фаза 11' (автономно, workflow.md)

## Фаза 12: Модуль (`defineModule`) и сосуществование

- [ ] Task: `WishModuleDef` (`dependsOn`: user, course, questionnaire, stream), `ModuleFromDef` — карта Def → класс; тип резолвера из платформы (DEBT-22), без `core`/`app` (DEBT-21)
- [ ] Task: Мост по ревью приёмки: `inbound` разбирается один раз на маршрут (без дублей `onInvalid`), `onInvalid` в приложении — `logger.warn`, дефолт и JSDoc согласованы с `InProcEventBus` (исключение глотается); `Date.parse` в конверте проверяется
- [ ] Task: Сосуществование: `appApi.run` и `appApi.execute` для wish; вызывающие stories и UI не сломаны; barrel DEBT-23 сохранён
- [ ] Task: Гайд «module»; stub-гайд «job» (эталона нет)
- [ ] Task: Ревью reviewer; замечания без `error` — решение orchestrator (TR)
- [ ] Task: Контрольная точка 'Фаза 12' (автономно, workflow.md)

## Фаза 13: Закрытие

- [ ] Task: Погасить DEBT-21, DEBT-22, DEBT-24, DEBT-31 (маркеры и `debt.md` синхронно); новые долги — с DEBT-32
- [ ] Task: Сводка гайдов: индекс в `architecture/index.md`, ссылки на эталон из [agents.md](../../architecture/agents.md) §6
- [ ] Task: Обновить [migration.md](../../architecture/migration.md) (§2 пункт 4 ✅, §6 состояние переноса, снять блок с Фаз 4–6 `dmg-core-extract`), `summary.md`
- [ ] Task: Контрольная точка 'Фаза 13' (автономно, workflow.md)
