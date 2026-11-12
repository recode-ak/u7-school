# Бриф среза: job-scheduler (Ф2) — планировщик заданий в `dmg-core`

Черновик `dmg-tech-lead` (Sonnet). Трек `legacy-removal_20261112`. Правка репо пакета `~/dev/tools/dmg/dmg-core` по порядку `conductor/architecture/index.md` («Правка платформы `dmg-core`»). Раскладка файлов — [removal.md](./removal.md).

Срез **аддитивный**: `U7App` продолжает работать на legacy-планировщике до Ф4; `platform/core/src/infra` в u7-school не меняется. Подключение пакетного планировщика — `assembly.md` (Ф4).

## Границы

Правим — только репо `dmg-core`:
- `src/app/job/`: новые `job-schedule-planner.ts`, `job-run-repo.ts`, `scheduled-job-runner.ts`, `in-proc-job-scheduler.ts`, `job-scheduler.ts` (порт) + тесты рядом (`*.test.ts`); экспорт — `src/app/index.ts` (`dmg-core/app`).
- `docs/decisions.md` — запись `D-71` (последняя — D-70), раздел «Вызовы, границы и проверки» (там D-47, D-56).
- `docs/guides/job.md` (`covers: src/app/job/**`) — раздел «Запуск по расписанию»; `bun run docs:impact src/app/job/in-proc-job-scheduler.ts src/app/index.ts` → единственный документ — `docs/guides/job.md`.
- `docs/guides/app.md`, `docs/index.md`, `llms.txt` — проверить на упоминание планировщика (см. «Документы»).

Не трогаем: `JobFromDef`, `ApiApp`, `ModuleFromDef` (контракты `runJob` не меняются); весь u7-school (код, `conductor/`, `data/`).

## Решения брифа

**Закреплено spec** (не переоткрывать): порты `JobScheduler`/`JobRunRepo` и in-proc реализация (planner, runner, scheduler, Memory-репо запусков) — в пакет; вход — `AnyJobDef` + `ApiApp.runJob`; часы — `Clock` из `AppContext`; логгер — `Logger` пакета. Файловое `JobRunJsonRepo` и `FileReplayStore` в пакет **не идут** (остаются проектными, Ф4).

Решения Opus **до кода** (D-71; здесь — рекомендации):

1. **Форма входа планировщика.**
   - **A:** `start(jobs: readonly ScheduledJob[])` с `ScheduledJob = { module: AnyModuleDef; job: AnyJobDef }` и `runJob` в зависимостях — ближе к legacy (`start(jobs)`).
   - **B (рекомендую):** `new InProcJobScheduler({ api, modules, clock, logger, store?, startDelayMs? })`, где `api: Pick<ApiApp<U>, 'runJob'>`, `modules: readonly AnyModuleDef[]` (Def, из которых берутся `jobs`; `ApiApp` пакета модули наружу не отдаёт), порт `JobScheduler { start(): void; stop(): void }`. `U7App` в Ф4 передаёт `api` и список Def, который уже есть (`dmgApp().modules`).
2. **Время — `Timestamp` (число, мс UTC), не `Date`/ISO.** `JobSchedulePlanner.nextRunAfter(schedule, after: Timestamp): Timestamp` (внутри — `Date.UTC`, наружу — число); `JobRunRepo.getLastRunAt(jobName): Timestamp | undefined`, `setLastRunAt(jobName, at: Timestamp)`. Проектный `JobRunJsonRepo` (Ф4) сохранит формат файла `data/jobs/last-runs.json` (ISO-строки, `{ version: 1, lastRuns }`) и конвертирует на границе; миграция формата — трек `timestamp-data`. *Стратегическое: см. «Открытые вопросы» С1.*
3. **Ключ хранилища — `def.name`** (как сейчас `jobName`): иначе потеряется `lastRunAt` существующих заданий (`inactivitySweep`, `sweepAbandonedQuestionnaires`) и первый запуск после выкатки сработает как «нет истории». Коллизия имён между модулями — защита: `start()` бросает ошибку конфигурации, если имена двух заданий совпали (один тест).
4. **Результат прогона.** `api.runJob(module, job, Trace.forJob(job))` возвращает `Result<JobReport, DomainError>`: `Err` — как раньше исключение `Job <name>: <code>`: лог `warn` источника `job-runner`, `lastRunAt` фиксируется, следующий запуск армится; исключение `runJob` (ошибка конфигурации) обрабатывается так же. `JobReport` (`processed`/`failed`) в `info`-лог не обязателен.
5. **`JobExecutor`/`InProcJobExecutor` не переносятся** (точка расширения «воркер» без потребителя; `runJob` — единственный исполнитель). Сценарии `InProcJobExecutor` (2 теста) удаляются, поведение «ошибка прогона не роняет планировщик» покрыто тестом раннера.
6. **Часы.** Раннер и планировщик читают только `clock()`; `setTimeout` остаётся. `now()` из `@u7-scl/core/shared` в пакет не приходит.
7. **Параметры по умолчанию сохраняются:** `DEFAULT_START_DELAY_MS = 3 мин` (экспорт — API-06: пороги экспортируемые константы); источник логов `job-scheduler` и `job-runner`; тексты логов — как сейчас (по ним ищут в проде).
8. Имена по `reference/naming.md`: файлы `job-*.ts`, классы без префикса проекта; `InProcJobScheduler` по образцу `InProcEventBus`/`InProcOutbox`. Заготовок генератор не делает — вручную по образцу `src/app/events/`.

## Шаги

1. **Opus — D-71** в `docs/decisions.md` до кода: порты, форма входа (A/B), `Timestamp`, ключ, судьба `JobExecutor`; «Почему» с отвергнутыми вариантами. Нурболат утверждает только С1.
2. **`dmg-test-designer` (Sonnet)** — перенос тестов в пакет (TST-08: переезжают, не копируются; в u7-school старые остаются до Ф5, т.к. тестируют живой код):
   - `job-schedule-planner.test.ts` — из `platform/core/src/infra/job-schedule-planner.test.ts` (16): вход/выход `Timestamp`, сценарии те же (interval/alignUtc, dailyAt, weeklyAt, monthlyAt с клампом, високосный год).
   - `scheduled-job-runner.test.ts` — из `…/scheduled-job-runner.test.ts` (11): первый прогон по интервалу, `runAtStart` с историей и без, запись `lastRunAt`, `stop()`, ошибка прогона (теперь — `Err` и исключение), долгий прогон без параллельного запуска, misfire (один догон), без misfire, «без lastRunAt и время сегодня прошло — завтра». Время — `setSystemTime` + `clock = () => Date.now()`, как сейчас.
   - `in-proc-job-scheduler.test.ts` — 3 теста `InProcJobScheduler` из `…/in-proc-job-scheduler.test.ts` (start запускает все задания, stop; повторный `start` — ошибка; перезапуск после `stop`) + тест коллизии имён (п. 3). 2 теста `InProcJobExecutor` — **не переносятся**; 3 теста `JobRunJsonRepo` — не сюда (Ф4, проект).
   - `job-run-repo.test.ts` — **не нужен** (`MemoryJobRunRepo` — фейк, TST-09); он используется внутри остальных.
   - Итого переезжает 30 + 1 новый; red → запуск.
3. **`migrator` (flash)** — реализация по тестам (механический перенос с заменой `Job` → `AnyJobDef`, `executor.execute(job)` → `api.runJob`, `now()` → `clock()`, `Date` → `Timestamp`). Flash допустим: красные тесты держат поведение, календарная математика переносится без изменения алгоритма. Риск: правка арифметики дат при смене `Date` → число (grep на отсутствие `new Date(` в планировщике сверх `Date.UTC`/`getUTC*`), потеря `misfire`-ветки — страхуют тесты. Отдельной строкой: «тест кажется неверным — не правь, опиши».
4. **orchestrator:** `bun run check` и `bun run e2e` в `dmg-core` → коммит пакета → в u7-school `bun install`, `bun run dmg:sync`, `bun run agents:sync` → `bun run check` → коммит u7-school с SHA пакета.
5. **`dmg-reviewer` (Opus).**

## Было → станет

| Было (u7-school) | Станет (`dmg-core`) |
|---|---|
| `JobScheduler.start(jobs: Job[])` — `platform/core/src/api/job/job-scheduler.ts:9-16` | порт `JobScheduler` (`src/app/job/job-scheduler.ts`), вход B |
| `Job.execute()`, `jobName`, `schedule` — `api/job/job.ts` | `AnyJobDef` (`name`, `schedule`) + `ApiApp.runJob(module, job, trace)` |
| `JobSchedule` — `api/job/job.ts:6-17` | уже есть в `dmg-core` (`JobSchedule`, `job-def.types.ts`) |
| `JobSchedulePlanner` (`Date`) — `infra/job-schedule-planner.ts` | то же, `Timestamp` |
| `ScheduledJobRunner` (`now()`, `JobExecutor`) — `infra/scheduled-job-runner.ts:50-130` | то же, `clock()`, `runJob` |
| `InProcJobScheduler` — `infra/in-proc-job-scheduler.ts:35-80` | то же, вход B |
| `JobRunRepo` (ISO-строки) + `MemoryJobRunRepo` — `infra/job-run-repo.ts` | `JobRunRepo` (`Timestamp`) + `MemoryJobRunRepo` |
| `InProcJobExecutor`, порт `JobExecutor` | не переносятся |
| `LegacyJob`/`legacyJobsOf` — `legacy-bridge/legacy-job.ts` | не нужны: `runJob` вызывает планировщик |
| `JobRunJsonRepo` (ISO-файл) — `infra/job-run-json-repo.ts` | остаётся проектным (Ф4: `platform/app/src/infra`, конвертация ISO↔`Timestamp`) |

## Сохраняемое поведение

Переносится дословно (тесты выше — ответственность `dmg-test-designer`):
- расписание считается от фактического конца предыдущего прогона (пересчёт после каждого);
- упущенный запуск выполняется один раз через стартовую задержку, сколько бы ни пропущено;
- параллельных прогонов одного задания нет — тик во время прогона игнорируется;
- ошибка прогона: `warn` в журнал, `lastRunAt` всё равно пишется (рестарт не зацикливает догон);
- `runAtStart` без истории — первый прогон через стартовую задержку; со свежей историей — ждём остаток интервала;
- повторный `start()` без `stop()` — ошибка; после `stop()` запуск снова возможен; `stop()` идущий прогон не прерывает.
- Состав: тесты, закрепляющие состав модулей/Job в `dmg-core`: `src/app/job/job-from-def.test.ts`, `src/testing/example/.../todo.module.test.ts` — не затрагиваются (grep `JobScheduler|InProcJob` по `src/**/*.test.ts` — перед коммитом пакета). В u7-school: тестов состава заданий нет (`inactivitySweep`, `sweepAbandonedQuestionnaires` проверяются в модулях и e2e бота) — без изменений на Ф2.

## Внешние зависимости

- В пакете: `ApiApp.runJob`, `AnyJobDef`/`AnyModuleDef`, `Trace.forJob`, `Clock`, `Logger`, `Result`/`DomainError`, `JobReport`.
- Потребитель (Ф4): `U7App` — `new InProcJobScheduler({ api, modules, clock, logger, store: JobRunJsonRepo })`.
- Новых npm-зависимостей нет. `dependsOn` не затрагивается.

## Открытые вопросы

**Стратегическое (для Нурболата, рекомендация по умолчанию):**
- **С1. Тип времени публичного порта `JobRunRepo` — `Timestamp` (число) вместо ISO-строки.** Фиксирует публичный контракт пакета; ISO в порте противоречит D-34/DOM-12 (время — `Timestamp`). Рекомендация: число; проектный адаптер конвертирует и сохраняет формат файла, миграция — `timestamp-data`. Альтернатива — ISO в порте: меньше кода в адаптере, но пакет закрепляет строковые даты.

**Тактическое (предлагаемое решение):**
- Форма входа A или B — **B** (п. 1).
- `JobExecutor` не переносить — **не переносить** (п. 5); если Нурболат хочет заготовку воркера — отдельный трек.
- Ключ — `def.name` + защита от коллизии (п. 3).

## Правила (ID `rules.md`)

API-06 (пороги — экспортируемые константы, расписания UTC, ошибка одной записи не прерывает обход), ARC-01 (пакет не импортирует проект), ARC-10 (платформа не знает приложения), DOM-12 (время — `Timestamp`), TST-08 (тесты переезжают), TST-09 (фейк `MemoryJobRunRepo` не тестируем), TST-10 (негативных тестов типов не добавлять без публичной гарантии), CODE-02/03/04, ERR-07 (`Err` прогона не замалчивается: `warn`).

## Документы

`bun run docs:impact src/app/job/in-proc-job-scheduler.ts src/app/index.ts` → `docs/guides/job.md` (покрывает `src/app/job/**`): обновить — раздел про запуск по расписанию (форма входа, `Timestamp`, misfire, ключ). Остальное:

| Документ | Действие |
|---|---|
| `docs/decisions.md` | D-71 (шаг 1) |
| `docs/guides/job.md` | раздел «Запуск по расписанию»; ссылка на D-71 |
| `docs/guides/app.md` | проверить раздел сборки: добавить строку про `InProcJobScheduler`, если там перечислены порты (`InProcEventBus`, `InProcReplayStore`…); иначе «не затронуто, потому что планировщик не часть минимальной сборки» |
| `docs/index.md`, `llms.txt` | ссылка на D-71 не нужна (решения — по `decisions.md`); проверить, что строка Job в `llms.txt` не требует правки |
| `docs/reference/rules.md` | не затронуто: новых правил нет |

`bun run docs:covers` и `docs:jsdoc` входят в `bun run check` пакета.

## Критерии приёмки

- `cd ~/dev/tools/dmg/dmg-core && bun test src/app/job` зелёный; `bun run check` и `bun run e2e` зелёные.
- `grep -rn "InProcJobScheduler\|JobRunRepo\|JobSchedulePlanner" ~/dev/tools/dmg/dmg-core/src/app/index.ts` — экспорт есть; `grep -rn "new Date()\|Date.now()" ~/dev/tools/dmg/dmg-core/src/app/job/{in-proc-job-scheduler,scheduled-job-runner,job-schedule-planner}.ts` — пусто (часы — только `clock()`).
- D-71 записано до реализации (`git log --reverse` пакета: коммит решения не позже кода; в одном коммите допустимо, если запись есть).
- Число тестов планировщика в пакете: 16 + 11 + 3 + 1 = 31 (без `test.each`).
- В u7-school: `git status` — изменены только `node_modules/`-связанное (`bun.lock`), `.agents-core/`, `.pi/`, `.claude/` (результат `dmg:sync`/`agents:sync`); `platform/core/src/infra` **не изменён** (`git diff --stat platform/core` пуст); `bun run check` зелёный; коммит u7-school содержит SHA пакета.
