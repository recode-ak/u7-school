# Долг кода (`C-DEBT-<n>`)

**Назначение:** открытые временные нарушения целевой архитектуры в коде u7-school. Правила и формат — [README.md](./README.md) §1–2; проверка — `bun run arch:check`.

**Последний выданный ID:** C-DEBT-57

---

### C-DEBT-41: id апдейта Telegram до story — неявным контекстом
- **Место:**
  - `platform/core/src/ui/bot/bot-request-context.ts` — `BotRequestContext`; читает `U7BotUiStory.dispatchUc`, ставит `BotTransport`
  - `platform/core/src/ui/ui-event-context.ts` — `UiEventContext` (след события для реакций UI); ставит `UiApp.subscribeEvents`, читает тот же `requestTrace`
- **Признак:** `AsyncLocalStorage`
- **Корень:** `{platform,runners}/*/src/**`
- **Причина:** контракт `handleCallback`/`handleMessage` ядра бота не несёт id запроса, а смена сигнатур затрагивает все stories. Id апдейта передаётся через `AsyncLocalStorage` на время обработки ([D-76](../architecture/decisions.md)): зависимость story от транспорта неявная, вне апдейта `dispatchUc` пишет `warn`.
- **Погашает:** `dmg-ui` (D-26) — контракт story несёт id запроса явно
- **Критерий снятия:** story получает id запроса (и след события в подписке) аргументом контракта, `BotRequestContext` и `UiEventContext` удалены

### C-DEBT-42: `call-uc` — ручной вход без общего устройства
- **Место:** `scripts/call-uc.ts`; с ним (признаком не ловится) `scripts/_app.ts` — сборка `U7App` для скриптов с `mode: 'development'` и школой `TEST_SCHOOL` (UC скриптов школу бота не используют)
- **Признак:** `dbDir: 'data'`
- **Корень:** `scripts/**`
- **Причина:** `call-uc` — разовый вызов UC DMG (лог операций), со своим разбором аргументов и актором по умолчанию; `dbDir: 'data'` захардкожен — проверка на fixtures возможна только из временного каталога (запуск на живом `data/` дописывает строку в `oplog`). Назначение и порядок безопасной работы (бот остановлен, `backup`, `DB_DIR=./data/fixtures`) описаны только в шапке скрипта. Второй ручной вход — интерактивная консоль — вынесен в нерабочую заготовку `~/dev/tools/dmg/dmg-cli`; `call-uc` остаётся до готовности `dmg-cli`.
- **Погашает:** `dmg-cli` (кандидат в [roadmap.md](../roadmap.md)) — общий инструмент над `ApiApp.dispatchByName` (D-54: интерактивная консоль и разовый `call`), проект подключает его своим корнем сборки и резолвером `Caller`
- **Критерий снятия:** один инструмент (или пара с общим ядром) вызывает любой UC по имени (D-54) через корень сборки, `Caller` — через резолвер приложения, каталог данных — из окружения; есть тесты старта и вызова; документ — что это, когда что использовать, как работать с живыми данными безопасно; `scripts/call-uc.ts` удалён или переведён на него

### C-DEBT-45: проактив с кнопками `invite` (маркер `ФР-6`)
- **Место:** `platform/core/src/ui/bot/{types,ui-app,bot-controller,bot-controller.test}.ts`, `runners/u7-bot/src/infra/{bot-transport,bot-transport.test}.ts`, `runners/u7-bot/src/controllers/{peer-review/stories/invite.story,courses/stories/wish-invite.story,learning/stories/{hub,hub.test},questionnaire/stories/{invite.story,fill.story,fill.story.events.test}}.ts`
- **Признак:** `ФР-6`
- **Корень:** `{platform,runners}/*/src/**`
- **Причина:** кнопочные приглашения идут каналом `invite` в обход `enterDialog`: у проактива нет сессии-аргумента, получателю без диалога транспорт создаёт диалог-якорь (seq = 1). Модуля `tasks-system` ещё нет. Маркер `ФР-6` — имя требования трека, который ввёл канал; с требованиями текущих треков не связан.
- **Погашает:** трек `tasks-system`
- **Критерий снятия:** `ProactiveSender.invite`, диалог-якорь и подписки stories на канал `invite` удалены, приглашения идут через `tasks-system`, признака нет

### C-DEBT-46: прямое чтение `manifest.json` менторских файлов в обход API
- **Место:** `scripts/list-lessons.ts`, `scripts/distribute-mentor.ts`
- **Признак:** `manifest\.json`
- **Корень:** `scripts/**`
- **Причина:** менторские шаги не добавлены в уроки через API (`mentorStepIds`), поэтому скрипты читают `mentor-files/manifest.json` с диска.
- **Триггер:** менторские шаги добавляются в уроки через API (`mentorStepIds`) — работа из [roadmap.md](../roadmap.md) (Нурболат, 2026-11-12)
- **Критерий снятия:** скрипты получают менторские файлы через `get-step` (`kind: 'file'`) по `mentorStepIds`, чтений `manifest.json` с диска нет

### C-DEBT-50: правило «курс модуля» — две ветки по статусу и порядок файла
- **Место:** `domain/src/course/module-courses.dqs.ts` — `firstIncluding` (любой статус) и `firstPublishedIncluding` (опубликованный), выбор первого курса в порядке файла, стартовый модуль — по одному курсу
- **Признак:** `^\s+first(Published)?Including\(`
- **Корень:** `domain/src/course/**`
- **Причина:** поведение v0.2.6 сохранено: UC курса выбирают курс модуля по разным правилам, `getCoursesStartingWithModule` смотрит место модуля в одном курсе, а не в кандидате; расходится только при двух и более курсах с общим модулем (в данных курс один). Единое правило зависит от архивации курсов и истории модулей.
- **Погашает:** трек «История модулей курса» ([course-module-history.md](../roadmap/course-module-history.md))
- **Критерий снятия:** одно правило выбора курса модуля, `getCoursesStartingWithModule` — по кандидату; методов `firstIncluding`/`firstPublishedIncluding` нет

### C-DEBT-51: каталог курсов — два DMG-вызова на каждый модуль при каждом показе
- **Место:** `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts` — `#loadModulesInfo` (`getModule` + `getModuleSnapshot` на модуль)
- **Признак:** `#loadModulesInfo\(`
- **Корень:** `runners/u7-bot/src/controllers/courses/**`
- **Причина:** поведение v0.2.6 сохранено один к одному; каждый вызов пишет строку в `data/oplog`, карточка курса из 4 модулей — ≈ 8 вызовов на показ.
- **Триггер:** рост числа курсов и модулей или объёма `oplog`, заметный на показе каталога; вариант решения — один `listModules` для заголовков и снимок только на уровне модуля
- **Критерий снятия:** показ карточки курса и этапа — без вызова `getModuleSnapshot` на каждый модуль

### C-DEBT-53: список монитора студентов — ≈2N+1 полных разборов `students.json`
- **Место:** `runners/u7-bot/src/controllers/shared/student-rows.ts` — `loadStudentRows` собирает `lagById` отдельным вызовом прогресса на каждого студента
- **Признак:** `lagById`
- **Корень:** `runners/u7-bot/src/**`
- **Причина:** `GetStudentProgressUc` считает отставание по всему составу потока, а `StudentJsonRepo` читает файл без кэша; при десятках студентов терпимо, оптимизация без замеров не делалась (ревизия v0.3.0).
- **Погашает:** `dmg-ui` — при переносе экрана монитора (Нурболат, 2026-11-14); раньше — если экран заметно тормозит
- **Критерий снятия:** чтение `students.json` один раз на UoW либо пакетный запрос прогресса по потоку; `lagById` в `loadStudentRows` не нужен

### C-DEBT-55: список ролей объявлен дважды
- **Место:** `domain/src/user/user/roles.ts` — enum `Role` и `RoleSchema` рядом с picklist `UserRoleName` в `user.state.ts`
- **Признак:** `export enum Role\b`
- **Корень:** `domain/src/**`
- **Причина:** `Role` — наследие legacy (enum и своя схема), `UserRoleName` — поле state по D-нотации `F.picklist`. Значения совпадают, но новую роль надо добавить в оба места; enum используют политики и бот (`Role.ADMIN` и др.).
- **Триггер:** добавление или удаление роли
- **Критерий снятия:** одно объявление — `UserRoleName`; `Role` и `RoleSchema` удалены или выведены из него

### C-DEBT-56: презентер навигации знает значки статуса контента
- **Место:** `platform/core/src/ui/content-nav/presenter.ts` — `cleanChildButtonTitle` сохраняет ведущие `🚧`/`🗄`, остальные эмодзи срезает
- **Признак:** `\(🚧\|🗄\)`
- **Корень:** `platform/core/src/**`
- **Причина:** метка статуса (Ф4а `pre-dmg-ui-cleanup`) приходит в презентер склеенной с названием, отдельного поля отметки у узла нет; презентер срезал её как декор.
- **Погашает:** `dmg-ui` — узел навигации с явным полем отметки статуса
- **Критерий снятия:** отметка — поле узла, презентер не разбирает эмодзи в названии; признака нет

### C-DEBT-57: ключ `VisitorId` — процесс-глобальная установка
- **Место:**
  - `runners/u7-bot/src/core/dispatch-uc.ts` — `requestTrace` читает установленный ключ; ставят `runners/u7-bot/src/main.ts` и `scripts/test-preload.ts` (класс — `runners/u7-bot/src/core/visitor-id.ts`)
  - `runners/u7-bot/src/core/u7-bot-ui-story.test.ts`, `runners/u7-bot/src/core/visitor-id.test.ts` — ожидания по установленному ключу
- **Признак:** `VisitorId\.installed\(`
- **Корень:** `runners/*/src/**`
- **Причина:** Telegram ID в `trace.channel.visitorId` попадал в лог операций (F-111); HMAC-ключу нужен путь до `requestTrace`, а передача через `resolve` бота меняет ручную сборку `resolve` в сотнях тестов. Ключ ставится один раз при старте, повторная установка — исключение.
- **Погашает:** `dmg-ui` (D-26) — контракт story и сборка UI-приложения несут зависимости явно (вместе с C-DEBT-41)
- **Критерий снятия:** `VisitorId` передаётся экземпляром в сборку UI-приложения, статических `install`/`installed` нет; признака нет
