# Спецификация: завершение перехода — `dossier` на Def и удаление legacy

## Обзор

Последний трек перехода ([migration.md](../../architecture/migration.md) §2 п. 6, §5). `dossier` — заготовка без поведения: снимаем `external` и фиксируем текущее понимание модуля в нём самом. Из репозитория уходит весь legacy: то, что нужно новой архитектуре, переезжает на своё место, остальное удаляется. Остаётся только то, что сейчас удалить нельзя, — с записью в [debt.md](../../architecture/debt.md).

Тип: Refactor/Chore. Живые данные не затрагиваются. Шаблон процесса — `conductor/archive/user-dmg_20261111`.

## Функциональные требования

1. **`dossier` на Def без поведения.** `DossierModuleDef` без `external`; агрегатов, UC, ER, Job нет; схемы `categories`/`scores` остаются в `domain/src/dossier`. Текущее понимание модуля (назначение, источники фактов — peer-review, sessions, stream; связь с `passport`; концепция — `roadmap/metrics`) — в `modules/dossier/README.md` и `description` Def. Прикладной пакет `modules/dossier` — **пустой модуль** (`dossier.module.ts`, `createDossierModule` с пустыми картами; ARC-06 требует файл после снятия `external`), фабрика подключена в `U7App`.
2. **DEBT-3.** Barrel `modules/dossier/src/index.ts` удалён; реэкспортов домена в пакетах нет.
3. **DEBT-34.** В `scripts/domain-check.ts` удалены пропуск legacy-пар и разрешение `index`; все модули проверяются через `contract`.
4. **Раскладка: «нужное новой архитектуре — на своё место».**
   - **`@u7-scl/core`** — только `ui` и часть `shared`, нужная `ui`. Пакет — кандидат на удаление при переводе UI в dmg (`dmg-ui`), это записано в документации.
   - **`dmg-core`** — интерфейсы, нужные новой архитектуре; реализации — только при явной заинтересованности будущих проектов. Решение трека: порты `JobScheduler`/`JobRunRepo` и in-proc планировщик (planner, runner, scheduler, Memory-репо запусков) — в пакет (аналога нет, любой проект с Job нуждается в нём; запись D-NN в `docs/decisions.md` пакета до кода). Правки — в репо пакета по порядку `architecture/index.md` («Правка платформы `dmg-core`»).
   - **`@u7-scl/app`** — архитектурные решения проекта за пределами `dmg-core`, каталоги по содержимому: `platform/app/src/school/` (`School`, `SchoolSchema`, `createSchool`, `U7_SCHOOL_*`, `TEST_SCHOOL` — конфигурация школы корня сборки до модуля `schools`), `platform/app/src/infra/` (файловые адаптеры портов пакета: `FileReplayStore`, `JobRunJsonRepo`). `U7AppResolver` заменяется явным типом в `app` (его читает `u7-bot-app-meta`).
   - **`runners/u7-bot/src/infra`** — `CompositeLogger` и `JsonFileRepo` (без `BaseJsonDb`): единственный потребитель — бот (логгер, сессии бота).
   - **`core/ui` без legacy:** dmg `ApiApp` вместо legacy-типа `ApiApp<TAppMeta>`/`AppMeta`; подписки stories — на конверты событий DMG по Def (`EventBus`/`EnvelopeOf` пакета) вместо `DomainEvent`; `AppException`/`fromError` — локальный разбор `unknown` (живых источников нет, поведение «необработанное → internal» сохраняется); `NotifyKind` — в `ui/bot/types.ts`.
   - **Удаляется** то, чему в новой архитектуре нет места: legacy-`api` (`UseCase`, `EventReaction`, `ApiModule`, legacy-`ApiApp`, legacy-`Job`), legacy-`domain` (`Aggregate`, `AppError`, `throw*`-хелперы, `ApiExecutor`, `AppResolver`, `DomainEvent`), legacy-`infra` (`base-json-db`, legacy-шина), `legacy-bridge` (после перевода доставки событий, часов и заданий), `U7ApiApp`, пакет `platform/app-legacy` (TR-33), алиасы `#*-legacy/*` и мёртвые зависимости `@u7-scl/app-legacy` во всех `package.json`; строки `@u7-scl/app-legacy` в тестах `scripts/*` переписываются, ARC-02 (`PLATFORM` в `domain-check.ts`) сужается до `core`.
   - **Остаток legacy** — только то, что сейчас удалить нельзя; каждый пункт — в `debt.md` с причиной и треком-погашателем.
   - Раскладка по файлам («файл → куда / удалить») — в черновике плана `dmg-tech-lead`, согласуется с Нурболатом.
5. **`u7-cli` → `dmg-cli`.** Код `runners/u7-cli` переезжает в новый репозиторий `~/dev/tools/dmg/dmg-cli` (рядом с `dmg-core`, свой `git init`); в u7-school каталог удаляется. Пакет — **нерабочая заготовка**: README прямо говорит «не собирается, не используется»; запись — в `debt.md` (DEBT-42 переформулируется, не закрывается: `call-uc` остаётся). Код переносится без `package.json` и `node_modules`. README фиксирует концепцию: **автоматический текстовый интерфейс к бэку на dmg-core** без своего UI-кода — модули и UC из графа Def, ввод по схеме входа, вызов через `dispatch`, выполнение от чужого имени (подмена `Caller`); одна механика для однотипных текстовых UI — терминал (CLI) и бот — с адаптацией под канал (в боте — кнопки). Заменит и `call-uc`. Кандидат в `roadmap` ссылается на README.
6. **Документация.** `legacy.md` удалён, ссылки на него вычищены. Обновлены `migration.md` (§2, §5, §6 — переход завершён, остаётся чек-лист релиза), `debt.md` (DEBT-3, DEBT-34, TR-33 закрыты; записи о legacy сняты или переформулированы), `architecture/index.md`, `AGENTS.md` (снято правило «немигрированный код — по `legacy.md`»), `rules.md`, `decisions.md`, `roadmap/tasks-system-*`, источники ролей и скилов (`.agents-core/`, `.pi/skills/*`) — правятся источники, сгенерированные копии обновляются `bun run agents:sync`/`dmg:sync`.
7. **Аудит `throw*`.** Список мест `throw*` для штатных отказов в живом коде — в `summary.md` трека (исправление — за рамками).

## Нефункциональные требования

- Поведение бота не меняется: тесты бота, миры, e2e зелёные.
- Форматы файлов `data/` не меняются, данные не трогаются.
- `bun run check` и `arch:check` зелёные на конце каждой фазы; поломки между фазами — только с записью в `debt.md`.
- Новых npm-зависимостей нет.

## Критерии приёмки

1. `grep -rn "app-legacy\|legacy-bridge\|-legacy/"` по `*.ts`/`*.json` вне `node_modules` и архива — пусто; каталогов `platform/app-legacy` и `runners/u7-cli` нет.
2. В `@u7-scl/core` только `ui` и используемая ими часть `shared`; legacy-`UseCase`/`ApiModule`/`ApiApp`/`Aggregate`/`AppError` нет; остаток legacy расписан в `debt.md`.
3. `DossierModuleDef` без `external`, README модуля описывает текущее понимание; `arch:check` проверяет `dossier` как обычный модуль.
4. В `domain-check.ts` нет `sub !== 'index'` и пропуска legacy-пар; DEBT-3 и DEBT-34 сняты в `debt.md`.
5. `legacy.md` удалён, битых ссылок на него нет; `migration.md` фиксирует завершение перехода.
6. Существует `~/dev/tools/dmg/dmg-cli` с кодом бывшего `u7-cli` и README-концепцией; кандидат в `roadmap` ссылается на него.
7. Полный `bun run check` зелёный; число тестов сверено со свежей базовой линией Ф0 трека, удалённые legacy-тесты перечислены в `summary.md`.
8. Аудит `throw*` — в `summary.md`.

## За рамками

- Строковые даты и миграция данных — трек 7 `timestamp-data`.
- Исправление `throw*` (только аудит).
- Перенос `core/ui` и `core/shared` в `dmg-ui`.
- Реализация `dmg-cli`.
- Настоящий агрегат досье.
- Деплой, чек-лист релиза.
