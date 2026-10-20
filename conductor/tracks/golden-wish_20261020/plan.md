# Plan: golden-wish_20261020

Каждая задача — TDD (red → запуск → green, по шагам), `bun run check` и `arch:check` зелёные после каждой. Структура создаётся `bun run gen`, не руками. Пишут `migrator` / `domain-author` / `api-author`, проверяет `reviewer`, коммитит orchestrator ([agents.md](../../architecture/agents.md)).

**Каждая фаза = один вид манифеста:** код → гайд (пишется сразу) → отчёт reviewer → обзор Нурболата; правки по обзору вносятся в код и гайд до чекпоинта.

Данные `data/` не трогаем; репозиторий проверяется на `DB_DIR=./data/fixtures`. Входной долг — в [spec.md](./spec.md).

## Фаза 0: Бриф и база [checkpoint: 85dd753]

- [x] Task: Бриф среза `slices/wish.md`: границы, перечень Def и реализаций, сохраняемое поведение, ID правил, список файлов «было → станет» по [naming.md](../../architecture/naming.md); решение, нужен ли DCS/DQS (запрос `list-user-wishes` → DQS?); Job нет `e3a6f222`
- [x] Task: Зафиксировать базовую линию тестов (`bun test`: 3211 pass) и тестов `wish` — 3211 pass / 0 fail; `wish` (домен + пакет): 107 pass / 14 файлов (в брифе)
- [x] Task: Режим `--adopt` генератора для legacy-модуля: `gen module|aggregate … --adopt` создаёт недостающие файлы рядом с legacy, существующий `index.ts` пропускает и печатает шаблон (пакетные `package.json`/`tsconfig.json` генератор и так не пересоздаёт); коллизия остальных файлов — по-прежнему ошибка; строка в naming.md §5 `ef2a3c41`
- [x] Task: Каркас гайда (шаблон по Ф4 спеки) в `conductor/architecture/guides/` и контрактный тест живости ссылок гайдов (в `check`); ссылка из `architecture/index.md` `ffb2ddf9`
- [x] Task: Контракты зависимостей (D-37, бриф §«Открытые вопросы» п. 2–3): в `domain/{user,course,questionnaire,stream}/contract.ts` — Def событий, на которые реагирует `wish` (`student.enrolled`, `stream.created`, `questionnaire:complete`, `questionnaire:abandon`), и внешние `ModuleDef` (`external: true`); карта `inbound` для `legacyEventBus` с переводом legacy-payload; тест доставки на реальном legacy-событии. Учитывает изменения платформы по ревью — [review-fixes.md](./review-fixes.md) `21109e88`
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md)

## Фаза 1: State (схема entity)

- [x] Task: Платформа: запись без `updatedAt` читается как `updatedAt = createdAt` (по образцу `version`, D-36) `9048034a`
- [~] Task: Перенос структуры по naming.md (`wish/wish.state.ts`), поля через `F.*`, даты `F.timestamp` (DEBT-24), `v.description()` на каждом поле
- [ ] Task: Гайд «state»
- [ ] Task: Ревью reviewer → обзор
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: Агрегат (`defineAggregate` + Ar)

- [ ] Task: `WishArDef`: статусы и переходы двух веток; `WishAr.create(): Result`, `restore()`, `snapshot()` только для репозитория; переходы `confirm/abandon/cancel/fulfill` возвращают `Result`; убрать `safeUpdate`/`throwBadRequest` и импорты `core`
- [ ] Task: Гайд «aggregate»
- [ ] Task: Ревью → обзор
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: События (`defineEvents`)

- [ ] Task: `WishEvents` (FQN по модулю и агрегату, прошедшее время), схемы payload; перевод потребителей событий
- [ ] Task: Гайд «events»
- [ ] Task: Ревью → обзор
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: Ошибки (`defineErrors`)

- [ ] Task: `WishErrors` с кодами `WISH_*`, `kind`, схемой payload; замена `throw*` на ошибки `Result`
- [ ] Task: Гайд «errors»
- [ ] Task: Ревью → обзор
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

## Фаза 5: Policy (`definePolicy` / `rule`)

> После ошибок: `denyMessage` и ошибки Policy ссылаются на `WishErrors`.

- [ ] Task: `WishPolicy` правилами с `label` и `denyMessage` вместо `boolean` и текстов в UC; entity-правило «не более одного активного wish на (user, target)»
- [ ] Task: Гайд «policy»
- [ ] Task: Ревью → обзор
- [ ] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md)

## Фаза 6: Репозиторий и сервисы (Repo, DCS/DQS)

- [ ] Task: Платформа по ревью приёмки (`slices/wish.md`, «Приёмка правок платформы»): `assertVersion` отличает новый агрегат от записи версии 0 (create с занятым uuid — конфликт, legacy-записи `data/wish` без `version` не перезаписываются); поведение событий записанных агрегатов при `VERSION_CONFLICT` — исправить или описать в errors-result.md §3
- [ ] Task: Порт `WishRepo` на Ar/`Result`, `WishJsonRepo` с `F.timestamp` (чтение строки и числа), UoW; DQS для чтения списка, если решено в Фазе 0
- [ ] Task: Тест репозитория на `DB_DIR=./data/fixtures`: ISO-строка читается, число пишется
- [ ] Task: Гайд «repo / dcs / dqs»
- [ ] Task: Ревью → обзор
- [ ] Task: Conductor - User Manual Verification 'Фаза 6' (Protocol in workflow.md)

## Фаза 7: Фасад (`defineFacade`)

- [ ] Task: `WishFacadeDef` + `implementFacade`; `Result` и `ReadonlyAr`, без `try/catch` по `kind` и `as`
- [ ] Task: Гайд «facade»
- [ ] Task: Ревью → обзор
- [ ] Task: Conductor - User Manual Verification 'Фаза 7' (Protocol in workflow.md)

## Фаза 8: Use Case — эталон (`create-course-wish`)

- [ ] Task: `defineUseCase` (контракт: `policy`, `callers`, `input`, `output`, `errors`, `emits`) + реализация `UseCaseFromDef`, UoW, `Result`
- [ ] Task: Гайд «use case»
- [ ] Task: Ревью → обзор
- [ ] Task: Conductor - User Manual Verification 'Фаза 8' (Protocol in workflow.md)

## Фаза 9: Остальные Use Case

- [ ] Task: `create-module-wish`, `cancel-wish`, `list-user-wishes` по гайду Фазы 8 (по одному, отдельный TDD-цикл)
- [ ] Task: Уточнить гайд «use case» (command и query, отличия)
- [ ] Task: Ревью → обзор
- [ ] Task: Conductor - User Manual Verification 'Фаза 9' (Protocol in workflow.md)

## Фаза 10: Event Reaction — эталон (`fulfill-wish`)

- [ ] Task: `defineEventReaction` (`on`, `touches`, `calls`, `emits`) + `ReactionFromDef`, идемпотентность, `Result`, журнал сбоев вместо `console.error`
- [ ] Task: Гайд «event reaction»
- [ ] Task: Ревью → обзор
- [ ] Task: Conductor - User Manual Verification 'Фаза 10' (Protocol in workflow.md)

## Фаза 11: Остальные Event Reaction

- [ ] Task: `confirm-wish`, `abandon-wish`, `invite-wishers` по гайду Фазы 10 (по одному, отдельный TDD-цикл)
- [ ] Task: Уточнить гайд «event reaction»
- [ ] Task: Ревью → обзор
- [ ] Task: Conductor - User Manual Verification 'Фаза 11' (Protocol in workflow.md)

## Фаза 12: Модуль (`defineModule`) и сосуществование

- [ ] Task: `WishModuleDef` (`dependsOn`: user, course, questionnaire, stream), `ModuleFromDef` — карта Def → класс; тип резолвера из платформы (DEBT-22), без `core`/`app` (DEBT-21)
- [ ] Task: Мост по ревью приёмки: `inbound` разбирается один раз на маршрут (без дублей `onInvalid`), `onInvalid` в приложении — `logger.warn`, дефолт и JSDoc согласованы с `InProcEventBus` (исключение глотается); `Date.parse` в конверте проверяется
- [ ] Task: Сосуществование: `appApi.run` и `appApi.execute` для wish; вызывающие stories и UI не сломаны; barrel DEBT-23 сохранён
- [ ] Task: Гайд «module»; stub-гайд «job» (эталона нет)
- [ ] Task: Ревью → обзор
- [ ] Task: Conductor - User Manual Verification 'Фаза 12' (Protocol in workflow.md)

## Фаза 13: Закрытие

- [ ] Task: Погасить DEBT-21, DEBT-22, DEBT-24, DEBT-31 (маркеры и `debt.md` синхронно); новые долги — с DEBT-32
- [ ] Task: Сводка гайдов: индекс в `architecture/index.md`, ссылки на эталон из [agents.md](../../architecture/agents.md) §6
- [ ] Task: Обновить [migration.md](../../architecture/migration.md) (§2 пункт 4 ✅, §6 состояние переноса, снять блок с Фаз 4–6 `dmg-core-extract`), `summary.md`
- [ ] Task: Conductor - User Manual Verification 'Фаза 13' (Protocol in workflow.md)
