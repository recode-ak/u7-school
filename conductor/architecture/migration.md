# План перехода

**Назначение:** порядок треков, что исправляет переход, сосуществование старого и нового. Каждый пункт — отдельный трек conductor (создаётся при старте).

---

## 1. Принципы

- **Strangler:** старое и новое работают параллельно; модуль за модулем, гейт зелёный после каждого шага.
- **Переносить и перепроектировать — отдельно.** Сначала механический перенос (поведение не меняется), затем перевод на Def.
- **Данные в `data/`** — только отдельным треком (D-16), с `bun run backup` и подтверждением Нурболата.
- **Без деплоя до конца перехода.** Релиз выйдет после критерия §5. До этого работа идёт в автономном режиме ([agents.md](./agents.md) §9), а промежуточная работоспособность не требуется: модуль можно переводить целиком, без мостов ради прода. Затем отдельный трек — **ревизия**: сравнение с релизом `v0.2.6` (worktree `../u7-school-v0.2.6`), разбор `TR` и перепроектирование.

## 2. Порядок треков

| # | Трек | Суть | Исполнитель |
|---|---|---|---|
| 0 | **agents-setup** | роли агентов для Claude Code и pi из одного источника, хук гейта в обеих средах, режим оркестратора и передача между средами в `conductor-implement` ([agents.md](./agents.md) §8) | orchestrator |
| 1 ✅ | **core-dmg** | `Result`, Def-классы (`XxxDef.define`), `F.*`, `Timestamp`, `ReadonlyAr`, Aggregate v2, UoW, `Caller` и `callers`, `normalize(def)`, `*FromDef`, `appApi.run`, граф-движок, `arch:check`, линт-правила ARC/DOM/CODE | orchestrator + Нурболат |
| 1б ✅ | **dmg-core-extract** | платформа DMG — отдельный пакет `dmg-core` (npm), развязка от legacy, самодостаточные конфиги, готовность модулей к выносу в сервисы ([D-28](./decisions.md)); пакет готов к выносу, сам вынос — по чек-листу в spec трека после релиза. Трек: `conductor/archive/dmg-core-extract_20261020` | orchestrator + Нурболат |
| 2 ✅ | **generators** | `bun run gen` для всех видов артефактов по [naming.md](./naming.md) | orchestrator + Нурболат |
| 3 ✅ | **domain-package** | трек: `conductor/archive/domain-package_20261020`, реестр долга — [debt.md](./debt.md). Пакет-каркас `@u7-scl/domain` создан в треке generators; наполнить: механически перенести domain-слои снизу вверх: user (+ `User` из app) → course → questionnaire → stream → wish → peer-review → dossier. Старые пути `@u7-scl/<m>/domain` временно реэкспортируют | migrator |
| 4 ✅ | **golden-wish** | перевести `wish` на Def, `Result`, Policy, entity-правило, UoW, Timestamp. Эталон; по нему написаны гайды артефактов — [guides/](../../node_modules/dmg-core/docs/guides/index.md). Трек: `conductor/archive/golden-wish_20261020` | orchestrator + Нурболат |
| 5 ✅ | **peer-review** | первый модуль конвейером агентов; Ф0 — пилот ролей волны 1 ([agent-roles.md](./agent-roles.md) §4). Трек: `conductor/archive/peer-review-dmg_20261029` | агенты |
| 6 | остальные модули | сверху вниз по графу (§2.1): `stream` ✅ (бывший `stream-student`) → `questionnaire` ✅ → `course` ✅ → `user`; `dossier` — в любой момент | агенты |
| 7 | **timestamp-data** | пакетная миграция живых данных, удаление «чтения строки» | orchestrator, с подтверждением |
| 8 | **delegation** | агрегат `Delegation` в user, построение `delegate` в транспорте ([caller.md](../../node_modules/dmg-core/docs/reference/caller.md) §4) | агенты |
| 9 | **ui-manifests** | Def-манифесты UI, эталонный UI-срез, генерация спецификации экранов; `ui-spec.md` удаляются по мере перевода контроллеров ([ui-manifests.md](./ui-manifests.md)) | orchestrator + Нурболат |
| 10+ | потребители графа | CLI `domain`, `docs:domain`/`docs:tech`, `docs:llm`, http + OPTIONS, mcp; с ними — вычистка JSDoc, дублирующего `label`/`description` Def ([docs-strategy.md](./docs-strategy.md) §6) | по roadmap |

Треки 1 и 3 независимы; 1б и 2 — после 1; Фазы 1–3 трека 1б выполняются до 2 и 4, Фазы 4–6 — после 4 (golden-wish). Трек 1 выполнен (кроме выноса, он в 1б): 2 (generators) выполнен — `bun run gen` готов (с Ф5 трека 1б — `dmg-core gen` пакета); 3 (domain-package) выполнен и заархивирован; 4 (golden-wish) выполнен — разблокированы Фазы 4–6 трека 1б и трек 5.

### 2.1. Порядок модулей: сверху вниз по графу

Граф `dependsOn` (домен, `ModuleDef`): `user` и `dossier` — без зависимостей; `course`, `questionnaire` → `user`; `stream` → `user`, `course`; `peer-review` → `user`, `questionnaire`, `stream`; `wish` (на Def) → все четыре.

Переводим **от потребителей к поставщикам**: первым — модуль, от которого не зависит ни один legacy-модуль. Причина — цена мостов:

- **Прямой мост** (модуль на Def зовёт legacy-зависимость) уже есть и проверен на `wish`: внешний `ModuleDef` + адаптер над legacy-фасадом (TR-11), legacy-события — через `legacyEventBus` (`inbound`). Он дешёвый и снимается, когда зависимость переезжает.
- **Обратный мост** (legacy-модуль зовёт модуль на Def) не существует: legacy-код импортирует чужие entity, Ar и фасады напрямую (DEBT-34). Его пришлось бы строить на каждого клиента.

Снизу вверх (`user` первым) — обратный мост для `course`, `questionnaire`, `stream`, `peer-review` и entity `User` во всём репозитории (DEBT-4). Сверху вниз обратных мостов между модулями нет: к моменту перевода поставщика все его клиенты уже на Def. `peer-review` — вершина: от `stream` он получает события `student.completed`/`abandoned` (`StudentEvents`, через `inbound`) и зовёт UC состава потока `GetStreamMembersUcDef` (адаптер TR-11); обратных вызовов из `stream` нет. `user` — последний, вместе с ним уходят `U7CallerResolver` над legacy `userFacade` (TR-33) и DEBT-4. UI (stories бота) — клиент всех модулей при любом порядке: переводится на `dispatch` в треке своего модуля.

### 2.2. UC-адаптер над legacy-фасадом

Прямой мост из §2.1 — единый приём, а не разовые решения. Назвать его в коде и комментариях: **«адаптер над legacy-фасадом»** (без номера записи реестра).

- **Контракт.** Внешний (`external: true`) `ModuleDef` поставщика в `domain/src/<m>/`: Def UC, которые зовут клиенты на Def (D-42). Поставщик не мигрирован — реализации у Def нет.
- **Где живёт.** `modules/<m>/src/<a>/uc/<имя>.uc.ts` — `UseCaseFromDef` над Def контракта; `modules/<m>/src/<m>.module.ts` — `create<M>Module` (`ModuleFromDef`) и резолвер «платформа + legacy-фасад»; тест рядом (`*.uc.test.ts`, `<m>.module.test.ts`). Фабрику адаптеров собирает `U7App`; legacy-события входят через `legacyEventBus` (`inbound`).
- **Как называется.** Файл — глагол вопроса или команды как у Def (`get-stream-members.uc.ts`); тип зависимости — узкий порт «что адаптер берёт у legacy-фасада»; в JSDoc — «адаптер над legacy-фасадом `<имя фасада>`».
- **Что делает.** Переводит вход Def в вызов legacy и ответ legacy — в контракт (в т.ч. `if` по ответам legacy). Логики сверх перевода нет; ошибки legacy, которых нет в контракте, — `SERVER_INTERNAL`.
- **Когда уходит.** В треке модуля-поставщика (§6): адаптеры заменяются настоящими UC, `external` снимается, legacy-фасад удаляется. Срок — запись трека в `migration.md` §6, а не комментарий в коде.

## 3. Что исправляет переход

| Сейчас | Становится |
|---|---|
| `_state` мутируется до валидации (`safeUpdate`) | черновик → валидация → фиксация, отказы через `Result` |
| `new Ar(state)` и для создания, и для восстановления | `Ar.create(): Result<Ar>` и `Ar.restore()` |
| геттер `state` клонирует на каждое чтение, все читают поля | `snapshot()` только для репозитория, доменный API |
| domain импортирует api (`commands → api/errors`, Ds бросает UC-ошибки) | контракты и ошибки в domain |
| события — интерфейсы со строками, payload без схемы | `EventDef.define` со схемой и FQN |
| `CompleteStudentUc`: `switch` по исходу, снятие роли, выбор текста | `studentAr.complete(outcome)`; роль — ER модуля user; текст — UI |
| Policy → `boolean`, текст отказа в UC | правила с `denyMessage` в Def |
| фасад: `try/catch` по `kind`, `as Stream` | `Result` и `ReadonlyAr` |
| `StreamDs` — запись и UI-чтение вместе | DCS и DQS |
| `ApiModule`: список UC + union-мета + имя | карта Def → класс, пропуск — ошибка компиляции |
| ER: сбой гасится `console.error` | `Result`, логирование, журнал сбоев |
| `getDocType()` у инстансов | статический граф |

## 4. Сосуществование

- Старые `UseCase`/`EventReaction`/`Job`, `throw*`, Ds работают до миграции своего модуля; паттерны — [legacy.md](./legacy.md).
- UC legacy — `appApi.execute` по строковому имени (бросает); UC DMG — команда `appApi.dispatch(moduleDef, …)` (`Result`, D-49).
- Схемы с `F.timestamp` читают ISO-строку и число, пишут число — данные мигрируют лениво до трека 7.

## 5. Критерий завершения

Все модули в `@u7-scl/domain`, нет реэкспортов в старых пакетах, нет `throw*` для штатных отказов, нет строковых дат, все проверки [rules.md](./rules.md) машинные — блокирующие, кроме помеченных `review`; `legacy.md` удалён.

Общее видение процесса и оправдавшие себя роли переехали в пакет (трек `agent-roles-wave2`): [process.md](../../node_modules/dmg-core/docs/process.md) и `agents/` пакета; проектные документы ([agents.md](./agents.md), [agent-roles.md](./agent-roles.md)) оставляют только привязку к проекту. Роли пакета с префиксом `dmg-*` ([agent-roles.md](./agent-roles.md) §1, п. 6): `dmg-domain-author`, `dmg-api-author`, `dmg-reviewer`, `dmg-tech-lead`, `dmg-test-designer`, `dmg-data-keeper`; проектные роли без префикса.

## 6. Состояние переноса

- **На Def (DMG):** `wish` — домен `domain/src/wish`, прикладной слой `modules/wish/src` (4 UC, 4 ER, JSON-репозиторий, `ModuleFromDef`), legacy `wish` удалён. Эталон: гайды — [guides/](../../node_modules/dmg-core/docs/guides/index.md). Чужие вызовы UC — в шаге `fetch` после Policy (D-58 пакета).
- **На Def (DMG):** `peer-review` — домен `domain/src/peer-review` (агрегаты `review-campaign`, `review`), прикладной слой `modules/peer-review/src` (7 UC, ER `create-student-campaign`, JSON-репозитории через UoW со строгим разбором), legacy `PeerReviewApiModule` удалён; уведомление адресату — подписка story на `peer-review.review.created`. Stories бота — на `dispatch`.
- **На Def (DMG):** `stream` — домен `domain/src/stream` (агрегаты `stream`, `student`; DCS/DQS, правило зачисления по фактам Def UC `course`), прикладной слой `modules/stream/src` (UC через `UseCaseFromDef`, «состав потока», `findStreamByTelegramGroup`, `getActiveStudent`, Job `inactivity-sweep` через `JobFromDef`, JSON-репозитории через UoW со строгим разбором), `StreamModuleDef` без `external`, legacy `StreamApiModule` и legacy-домен удалены. Роль `STUDENT` stream не выдаёт — студента определяет `getActiveStudent` (сама роль — DEBT-48 трека `user`). Права ментора — `Role` из контракта `user` (TR-40). Бот подписан на Def-события `stream.created` и `student.*`. Трек: `conductor/archive/stream-dmg_20261103`.
- **На Def (DMG):** `questionnaire` — домен `domain/src/questionnaire` (один агрегат `questionnaire`, state — variant `kind`: standard и likert; чистый `QuestionnaireEngine`; 6 Def-событий без `telegramId`/`response`, имя `ownerInfo` во всех слоях — TR-46), прикладной слой `modules/questionnaire/src` (9 UC через `UseCaseFromDef`, в т.ч. 3 query-UC; Job `sweep-abandoned-questionnaires` через `JobFromDef`; JSON-репозиторий через UoW со строгим разбором), `QuestionnaireModuleDef` без `external`, legacy-фасад, inbound, адаптер `start-questionnaire` и метатипы удалены. Правило «только за себя» — `QuestionnairePolicy` (субъект `Identified`). Stories бота — на `dispatchUc` и подписках на 5 Def-событий; адрес респондента — через legacy `get-user` до перевода `user` (TR-49 (6)). Перед выкаткой — `bun run backup`: первая запись переписывает `questionnaires.json` в числовых датах (TR-49 (7)). Трек: `conductor/archive/questionnaire-dmg_20261104`.
- **На Def (DMG):** `course` — домен `domain/src/course` (агрегаты `course`, `module`, `lesson`, `step`; DQS видимости, снимка, «курсы модуля», пререквизита), прикладной слой `modules/course/src` (16 query-UC через `UseCaseFromDef`, JSON-репозитории через UoW со строгим разбором), `CourseModuleDef` без `external`, legacy-фасад, `CourseApiModule`, `CourseDs`, `content-path` и authoring-команды удалены (операций автора нет — кандидат [course-module-history.md](../roadmap/course-module-history.md)). Программа курса — `moduleIds`, этап — метка `fromModuleId` (D-64), в ответе `get-course` — `stages`. Клиенты (`stream`, `wish`) спрашивают курс, а не сравнивают id сами; пререквизит — вердикт `admitted` (D-65). Скрипты контента — на `U7App` и `dispatch` (`scripts/_course-client.ts`). Трек: `conductor/tracks/course-dmg_20261105`.
- **Корень сборки (D-50, D-52):** `@u7-scl/app` (`platform/app`) — `U7App` собирает всё приложение по `AppEnv`: legacy-модули, `AppContext` DMG, модули DMG через `ApiApp` пакета (фабрики `ModuleFactory`, фасады по `dependsOn`), резолвер `Caller` (`U7CallerResolver` над legacy `userFacade`). Legacy-ядро приложения — `@u7-scl/app-legacy` (`platform/app-legacy`, TR-33). Раннеры (`u7-bot`, `u7-cli`) и `scripts/call-uc.ts` получают приложение из `U7App`; ARC-07/08/09 и D-53 (ARC-06) — машинные (`arch:check`, `biome`).
- **Внешние модули (D-37):** `user`, `dossier` — `ModuleDef.define({ external: true })` в домене; UC, которые зовут модули на Def, исполняют адаптеры над legacy-фасадами (TR-11) — фабрики в `U7App`, legacy-события входят через `legacyEventBus` (`inbound`).
- **Механически перенесены** (трек 3): domain-слои всех модулей в `@u7-scl/domain`; старые `modules/<m>/src/domain/index.ts` и `modules/dossier/src/index.ts` — barrel-реэкспорты (долг — в Месте записи `debt.md`).
- **Граф `dependsOn`** строится из `ModuleDef` (`scripts/domain-arch.ts`, `DomainArch` с `root` и `runners`); `arch:check` сверяет код с реестром [debt.md](./debt.md) по полям Место/Признак/Корень; тактические решения перехода — `TR-<n>` там же (в код не пишутся).

### Входной долг для следующих треков

ID — канонические: слитые записи (DEBT-6, 7, 9, 11, 12, 14, 15, 16, 17, 19, 20 и др.) указывают на запись с меньшим ID ([debt.md](./debt.md), «Правила»).

| Владелец | Долги |
|---|---|
| перевод `user` | glob'ы `user` в DEBT-1, 2, 5; legacy-пары `user`/`dossier` в DEBT-34; роль `STUDENT` и данные `data/users` — DEBT-48; экспорт `Role` из контракта `user` — TR-40; адаптер `get-telegram-addresses` — DEBT-44; `U7CallerResolver` — TR-33; адрес респондента анкет через legacy `get-user` в stories — TR-49 (6) |
| по мере касания | тесты UC/ER/Job на JSON во временном каталоге — DEBT-40; `update-stream-snapshot.ts` — запись через репозитории Def и UoW (TR-45); чтение `students.json` один раз на UoW (TR-44) |
| трек «История модулей курса» | одно правило «курс модуля» — DEBT-50 |
| при росте каталога | два вызова на модуль в карточке курса — DEBT-51 |
| `ui-manifests` / `dmg-ui` | id апдейта Telegram неявным контекстом — DEBT-41 |
| после перехода | `u7-cli` и `call-uc` — общий инструмент вызова UC — DEBT-42 |
| последний трек миграции | barrel-реэкспорты и `User` в `app-legacy` — DEBT-3 (в т.ч. `@u7-scl/stream/domain` для скриптов снимков, TR-44) |

### Старт следующих треков

- **Трек волны 2 выполнен** (`agent-roles-wave2_20261104`, [agent-roles.md](./agent-roles.md) §4): каркас ролей `dmg-tech-lead`, `dmg-test-designer`, `dmg-data-keeper` в `dmg-core` с префиксом `dmg-*`, проектная часть — в `.agents-core/`; критерий 6 проверен пилотом на учебном модуле пакета (`summary.md` трека).
- **Следующий модуль — `user`** (трек 6, последний, §2.1): все его клиенты (`course`, `questionnaire`, `stream`, `peer-review`, `wish`) уже на Def, обратных мостов нет. Трек создаётся через `conductor-newtrack` (ID вида `user-dmg_<дата>`) по шаблону `course-dmg` (`conductor/tracks/course-dmg_20261105`):
  - **Конвейер среза** — как у `course-dmg` (`plan.md` трека); исполнители — §2 [deepseek.md](./deepseek.md).
  - **Мосты:** адаптер `get-telegram-addresses` (DEBT-44) — настоящим UC; `U7CallerResolver` над legacy `userFacade` (TR-33) — резолвер `Caller` на Def; адрес респондента анкет через legacy `get-user` (TR-49 (6)).
  - **Учесть:** `User`/`Role` импортируют ≈ 96 файлов через barrel `@u7-scl/user/domain` и реэкспорт `app-legacy` (DEBT-3); роль `STUDENT` в коде и в живых `data/users` (DEBT-48) — миграция данных только с бэкапом и разрешения Нурболата; `Role` в контракте (TR-40).
- Базовая линия тестов на конец `course`: `conductor/tracks/course-dmg_20261105/summary.md` («Гейт закрытия»).
