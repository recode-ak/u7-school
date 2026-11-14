# Долг кода (`C-DEBT-<n>`)

**Назначение:** открытые временные нарушения целевой архитектуры в коде u7-school. Правила и формат — [README.md](./README.md) §1–2; проверка — `bun run arch:check`.

**Последний выданный ID:** C-DEBT-53

---

### C-DEBT-40: тесты UC/ER/Job на JSON-репозитории во временном каталоге
- **Место:** `modules/wish/src/**/*.{uc,er,job}.test.ts`, `modules/peer-review/src/**/*.{uc,er,job}.test.ts` — тесты UC/ER на `mkdtemp`
- **Признак:** `mkdtemp`
- **Корень:** `modules/*/src/**/*.{uc,er,job}.test.ts`
- **Причина:** пирамида пакета `dmg-core` (`testing.md` §4): UC/ER/Job тестируются на фейке порта (`<a>.repo.fake.ts`, `MemoryRepo`), выборку проверяет контрактный тест репозитория. У `wish` и `peer-review` фейков репозиториев ещё нет.
- **Погашает:** трек `pre-dmg-ui-cleanup`, Ф5 — фейки репозиториев и перевод тестов (сценарии 1:1)
- **Критерий снятия:** тесты UC/ER/Job без `mkdtemp`/`*JsonRepo`

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
- **Место:** `scripts/call-uc.ts`
- **Признак:** `dbDir: 'data'`
- **Корень:** `scripts/**`
- **Причина:** `call-uc` — разовый вызов UC DMG (лог операций), со своим разбором аргументов и актором по умолчанию; `dbDir: 'data'` захардкожен — проверка на fixtures возможна только из временного каталога (запуск на живом `data/` дописывает строку в `oplog`). Назначение и порядок безопасной работы (бот остановлен, `backup`, `DB_DIR=./data/fixtures`) описаны только в шапке скрипта. Второй ручной вход — интерактивная консоль — вынесен в нерабочую заготовку `~/dev/tools/dmg/dmg-cli`; `call-uc` остаётся до готовности `dmg-cli`.
- **Погашает:** `dmg-cli` (кандидат в [roadmap.md](../roadmap.md)) — общий инструмент над `ApiApp.dispatchByName` (D-54: интерактивная консоль и разовый `call`), проект подключает его своим корнем сборки и резолвером `Caller`
- **Критерий снятия:** один инструмент (или пара с общим ядром) вызывает любой UC по имени (D-54) через корень сборки, `Caller` — через резолвер приложения, каталог данных — из окружения; есть тесты старта и вызова; документ — что это, когда что использовать, как работать с живыми данными безопасно; `scripts/call-uc.ts` удалён или переведён на него

### C-DEBT-43: единая зона проекта UTC+5 вместо персональной зоны пользователя
- **Место:** `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts`, `runners/u7-bot/src/controllers/courses/stories/wish-invite.story.ts` — вывод времени через `getUTCHours`. С ними (признаком не ловится): ввод времени старта в `create-stream.ts` (`#handleDateInput`), даты в `BotUiStory.formatDate` и `review-render.ts` (`reviewDate`)
- **Признак:** `getUTCHours\(`
- **Корень:** `runners/u7-bot/src/**`
- **Причина:** решение Нурболата (2026-10-29): сервер и хранение — UTC; всё, что вводит и видит пользователь, — в зоне проекта UTC+5 (`Asia/Oral`), одной на всех. Персональной зоны у пользователя пока нет.
- **Погашает:** трек персональных зон — цепочка: зона пользователя → зона школы, с которой он взаимодействует → по умолчанию UTC+5 (Уральск) (Нурболат, 2026-11-12); поле зоны в `user` и в школе, форматирование и разбор ввода по этой цепочке; заготовка — [schools-system](../roadmap/schools-system.md)
- **Критерий снятия:** даты для пользователя форматируются и разбираются по его зоне из `user`; жёстко заданная UTC+5 остаётся только как значение по умолчанию; маркер удалён

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
- **Триггер:** задержка экрана монитора заметна (замер) или поток вырос за несколько десятков студентов
- **Критерий снятия:** чтение `students.json` один раз на UoW либо пакетный запрос прогресса по потоку; `lagById` в `loadStudentRows` не нужен
