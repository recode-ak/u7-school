# Реестр долга

**Назначение:** учтённые временные нарушения целевой архитектуры ([D-03](./decisions.md), [migration.md](./migration.md)), допущенные ради поэтапного перехода. Живой реестр — не привязан к треку: долг заводят и гасят разные треки.

---

## Правила

- ID — `DEBT-<n>` (отдельно от решений `D-NN` в [decisions.md](./decisions.md)); номера не переиспользуются, новый — следующий после максимального, в т.ч. погашенного и слитого (последний выданный — DEBT-51).
- Реестр — **allowlist**: код к записи привязывают её поля, а не маркеры. Поля открытой записи:
  - **Место** (обязательно) — где долг допущен: glob'ы в бэктиках подряд через запятую в начале строки поля или пунктами первого уровня под ним; после glob'ов — пояснение текстом. У каждого glob может быть своё «Погашает» — в пояснении пункта.
  - **Признак** (обязательно) — регулярка (JS, флаг `m`) в бэктиках, которой долг выражен в коде.
  - **Корень** — glob области, где признак вне Места — новый долг без записи. Нет поля — весь код проверки. Исключения — перечислением в `{…}` (Bun.Glob не знает `!` и не разворачивает `/` внутри `{…}`).
- Проверяемый код — исходники пакетов (`{platform,modules,authoring,runners}/*/src`, `domain/src`, вместе с их тестами) и `scripts/` без тестов скриптов.
- `bun run arch:check` (`checkDebt`, `scripts/domain-check.ts`) по каждой открытой записи:
  - glob Места не находит файлов — устаревшее место;
  - признака нет ни в одном файле glob'а — долг погашен: сними glob или закрой запись;
  - признак в файле Корня вне Места — долг без записи: заведи запись или расширь Место.
- `DEBT-<n>` в коде — только в строке `biome-ignore` (текст причины) и только ID открытой записи; голые `// DEBT-<n>`, упоминания в JSDoc и ID закрытых записей — ошибка.
- Временное решение без записи — ошибка (`checkTempMarkers`): строка с маркером «Временное решение» или «Уходит с миграцией» (без учёта регистра) либо «ВРЕМЕННЫЙ» (только заглавными) допустима лишь в файле из Места **открытой** записи; Место закрытой («слит в») маркер не оправдывает. Область — исходники пакетов (`*/src`, `domain/src`, с тестами). Слова «временный», «временные метки», «одновременно» не срабатывают. Ошибка: `DEBT: <path>:<line>: маркер временности «…» вне Места открытой записи — заведи запись в debt.md или убери комментарий`.
- Погашение части долга — снять glob из Места; закрытие — удалить запись и `biome-ignore` с её ID одним коммитом.
- Слияние дублей — в запись с меньшим ID; закрытая запись остаётся заголовком `### DEBT-<n>: … — слит в DEBT-<m>` без полей, её ID в коде — ошибка.
- Долг в коде пакета `dmg-core` — в его собственном реестре (`debt.md` в корне репо пакета, свои `DEBT-<n>`); здесь только долг u7-school. Ссылка на него — «DEBT-<n> пакета `dmg-core`».
- В архиве трека `domain-package` ID записаны в старом формате: `D-<n>` там = `DEBT-<n>` здесь.
- **Тактические решения перехода** ведутся отдельно, как `TR-<n>` (§6, [agents.md](./agents.md) §9). `TR-<n>` в код не пишется (`arch:check` ловит). Если решение оставило временный код, на этот код заводится ещё и `DEBT-<n>`, и записи ссылаются друг на друга.

Шаблон записи:

```
### DEBT-<n>: <краткое название>
- **Место:** `<glob>`, `<glob>` — <пояснение>
- **Признак:** `<регулярка>`
- **Корень:** `<glob>`
- **Причина:** <почему нельзя убрать сейчас>
- **Погашает:** <трек>
- **Критерий снятия:** <что должно исчезнуть: признак, реэкспорт>
```

Место с разным «Погашает» по glob'ам:

```
- **Место:**
  - `<glob>` — <пояснение>; погашает <трек>
  - `<glob>` — <пояснение>; погашает <трек>
```

## Группы

1. Импорты `@u7-scl/app-legacy` / `@u7-scl/core` в домене.
2. Реэкспорты старых путей `modules/<m>/src/domain/index.ts`.
3. `User` в `app`.
4. Прочее.
5. Инструменты проверки.
6. Тактические решения перехода (`TR-<n>`).

## 1. Импорты `app` / `core` в домене

### DEBT-1: импорты `@u7-scl/core` в домене
- **Место:**
  - `domain/src/user/**` — `facade.ts`, `module.ts`, `user/a-root.ts`, `user/events.ts`, `user/commands/{errors,notify-user-cmd,register-guest-cmd}.ts`; погашает перевод `user` на Def
- **Признак:** `from '@u7-scl/core`
- **Корень:** `domain/src/**`
- **Причина:** `Aggregate`, `ArMeta`, `DomainEvent`, `NotifyKind`, ошибки (`AccessDeniedError`, `NotFoundError`, `errConflict`, `throwError`), `isoNow`, `now`, `UcMeta`, `FileMetadataSchema`, `ApiModuleMeta`, `BaseJsonDb` живут в `core`; механический перенос не меняет базовые классы.
- **Погашает:** трек перевода модуля на Def (из `dmg-core-extract` Ф4 снято — Нурболат, 2026-10-26); glob снимают по мере перевода
- **Критерий снятия:** в `domain/src/**` нет импортов `@u7-scl/core`

### DEBT-2: импорты `@u7-scl/app-legacy` в домене
- **Место:**
  - `domain/src/user/module.ts` — тип `U7ModuleResolver`; погашает перевод `user` на Def
- **Признак:** `from '@u7-scl/app-legacy`
- **Корень:** `domain/src/**`
- **Причина:** тип резолвера модулей и `U7_SCHOOL_ID` определены в `app`; создаёт циклическую зависимость пакетов `app` ↔ `domain` (только типы, в рантайме импорт стирается); сам цикл пакетов также снимается этим долгом.
- **Погашает:** перевод модуля на Def; glob снимают по мере перевода
- **Критерий снятия:** `domain/src/**` не импортирует `@u7-scl/app-legacy`

### DEBT-5: `v.isoDateTime` в схемах домена (DOM-12)
- **Место:**
  - `domain/src/user/user/entity.ts` — `createdAt`, `updatedAt`; `biome-ignore lint/plugin`; погашает перевод `user` на Def (`F.timestamp`)
- **Признак:** `v\.isoDateTime`
- **Корень:** `domain/src/**`
- **Причина:** схемы перенесены из `app` без изменений; DOM-12 запрещает `v.isoDateTime` в схемах домена.
- **Погашает:** перевод модуля на Def; glob снимают по мере перевода
- **Критерий снятия:** `biome-ignore` с `DEBT-5` удалены, даты описаны через поля Def

### DEBT-6: импорты `@u7-scl/core` в domain/course — слит в DEBT-1

### DEBT-7: импорт `@u7-scl/app-legacy/domain` в domain/course/module.ts — слит в DEBT-2

### DEBT-11: импорты `@u7-scl/core` в domain/questionnaire — слит в DEBT-1

### DEBT-12: импорт `@u7-scl/app-legacy/domain` в domain/questionnaire/module.ts — слит в DEBT-2

### DEBT-16: импорты `@u7-scl/core` в domain/stream — слит в DEBT-1

### DEBT-17: импорты `@u7-scl/app-legacy/domain` в domain/stream — слит в DEBT-2

## 2. Реэкспорты старых путей

### DEBT-3: barrel'ы `modules/<m>/src/domain/index.ts`
- **Место:**
  - `modules/user/src/domain/index.ts` — потребители (≈96 файлов) импортируют `@u7-scl/user/domain`
  - `modules/course/src/domain/index.ts` — потребители импортируют `@u7-scl/course/domain`
  - `modules/questionnaire/src/domain/index.ts` — потребителей нет (после `questionnaire-dmg` код импортирует `@u7-scl/domain/questionnaire` и контракт); удаляется вместе с остальными barrel'ами
  - `modules/stream/src/domain/index.ts` — потребители импортируют `@u7-scl/stream/domain`; погашает Ф3 трека `stream-dmg`
  - `modules/wish/src/domain/index.ts` — потребители импортируют `@u7-scl/wish/domain`
  - `modules/peer-review/src/domain/index.ts` — потребители импортируют `@u7-scl/peer-review/domain`
  - `modules/dossier/src/index.ts` — пакет `@u7-scl/dossier` публикует корень `.`; потребителей в коде нет, но публичный путь сохранён на время миграции
  - `platform/app-legacy/src/domain/user.ts` — реэкспорт `User`, `UserSchema`, `Role`, `RoleSchema`, `UserArMeta`: их импортируют из `@u7-scl/app-legacy/domain` во всём репозитории; канонический владелец — `domain/user`
- **Признак:** `export \* from '@u7-scl/domain/`
- **Корень:** `{modules,platform}/*/src/**`
- **Причина:** переписывать потребителей старых путей не входит в трек; реэкспорты сохраняют пути на время миграции.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют из `@u7-scl/domain/<модуль>`; barrel'ы и `platform/app-legacy/src/domain/user.ts` удалены

### DEBT-8: barrel `modules/course/src/domain/index.ts` — слит в DEBT-3

### DEBT-13: barrel `modules/questionnaire/src/domain/index.ts` — слит в DEBT-3

### DEBT-18: barrel `modules/stream/src/domain/index.ts` — слит в DEBT-3

### DEBT-23: barrel `modules/wish/src/domain/index.ts` — слит в DEBT-3

### DEBT-27: barrel `modules/peer-review/src/domain/index.ts` — слит в DEBT-3

## 3. `User` в `app`

### DEBT-4: реэкспорт `User`/`Role` в app-legacy — слит в DEBT-3

## 4. Прочее

### DEBT-9: `v.isoDateTime` в схемах domain/course (DOM-12) — слит в DEBT-5

### DEBT-14: `v.isoDateTime` в схемах domain/questionnaire (DOM-12) — слит в DEBT-5

### DEBT-15: приватные члены `#…` в QuestionnaireAr (CODE-02) — слит в DEBT-10 (погашен, `course-dmg` Ф5)

### DEBT-19: `v.isoDateTime` в схемах domain/stream (DOM-12) — слит в DEBT-5

### DEBT-20: приватные методы `#…` в StudentAr (CODE-02) — слит в DEBT-10 (погашен, `course-dmg` Ф5)

### DEBT-30: barrel `modules/dossier/src/index.ts` — слит в DEBT-3

### DEBT-40: тесты UC/ER/Job u7-school на JSON-репозитории во временном каталоге
- **Место:** `modules/wish/src/**/*.{uc,er,job}.test.ts`, `modules/peer-review/src/**/*.{uc,er,job}.test.ts` — тесты UC/ER на `mkdtemp`
- **Признак:** `mkdtemp`
- **Корень:** `modules/*/src/**/*.{uc,er,job}.test.ts`
- **Причина:** пирамида пакета `dmg-core` (`testing.md` §4, трек dmg-cleanup): UC/ER/Job тестируются на фейке порта (`<a>.repo.fake.ts`, `MemoryRepo`), выборку проверяет контрактный тест репозитория. Существующие тесты u7-school за рамками трека (spec «За рамками»).
- **Погашает:** переводятся по мере касания — задача, правящая UC/ER/Job, переводит его тест на фейк (сценарии 1:1)
- **Критерий снятия:** тесты UC/ER/Job без `mkdtemp`/`*JsonRepo`

### DEBT-41: id апдейта Telegram до story — неявным контекстом
- **Место:** `platform/core/src/ui/bot/bot-request-context.ts` — `BotRequestContext`; читает `U7BotUiStory.dispatchUc`, ставит `BotTransport`
- **Признак:** `AsyncLocalStorage`
- **Корень:** `{platform,runners}/*/src/**`
- **Причина:** контракт `handleCallback`/`handleMessage` ядра бота не несёт id запроса, а смена сигнатур затрагивает все stories (вариант A кандидата bot-request-id). Id апдейта передаётся через `AsyncLocalStorage` на время обработки (TR-30): зависимость story от транспорта неявная, вне апдейта `dispatchUc` пишет `warn`.
- **Погашает:** `dmg-ui` / трек ui-manifests (D-26) — контракт story несёт id запроса явно
- **Критерий снятия:** story получает id запроса аргументом контракта, `BotRequestContext` удалён

### DEBT-42: `u7-cli` и `call-uc` — два ручных входа без общего устройства
- **Место:** `runners/u7-cli/src/main.ts`, `scripts/call-uc.ts` — с ними `runners/u7-cli/src/cli-controller.ts`
- **Признак:** `dbDir: 'data'`
- **Корень:** `{runners,scripts}/**`
- **Причина:** после перехода на `U7App` (TR-33, TR-34) оба собираются как бот, но остались разными самописными инструментами. `u7-cli` — интерактивная консоль только для legacy-UC (`apiApp.execute`): UC DMG из неё не вызвать; при старте требует `modules/<m>/about.md` у каждого legacy-модуля и **сейчас не стартует** (нет `about.md` у `stream`, `questionnaire`, `peer-review`); `dbDir: 'data'` захардкожен, `DB_DIR` не читается; тестов нет. `call-uc` — разовый вызов (legacy + `wish`, лог операций), со своим разбором аргументов и актором по умолчанию. Назначение, отличия и порядок безопасной работы (бот остановлен, `backup`, `DB_DIR=./data/fixtures`) нигде не описаны.
- **Погашает:** после перехода (последний legacy-модуль на DMG). Кандидат — вынести в `dmg-core` как общий инструмент над `ApiApp.dispatchByName` (D-54: интерактивная консоль и разовый `call`), проект подключает его своим корнем сборки и резолвером `Caller`.
- **Критерий снятия:** один инструмент (или пара с общим ядром) вызывает любой UC по имени (D-54) через корень сборки, `Caller` — через резолвер приложения, каталог данных — из окружения; есть тесты старта и вызова; документ (в `dmg-core`, если инструмент переезжает в пакет) — что это, когда что использовать, как работать с живыми данными безопасно.

### DEBT-43: единая зона проекта UTC+5 вместо персональной зоны пользователя
- **Место:** `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts`, `runners/u7-bot/src/controllers/courses/stories/wish-invite.story.ts` — вывод времени через `getUTCHours`. С ними (признаком не ловится): ввод времени старта в `create-stream.ts` (`#handleDateInput`), даты в `BotUiStory.formatDate` и `review-render.ts` (`reviewDate`)
- **Признак:** `getUTCHours\(`
- **Корень:** `runners/u7-bot/src/**`
- **Причина:** решение Нурболата (2026-10-29): сервер и хранение — UTC; всё, что вводит и видит пользователь, — в зоне проекта UTC+5 (`Asia/Oral`), одной на всех. Персональной зоны у пользователя пока нет.
- **Погашает:** трек персональных зон — поле зоны в `user`, форматирование и разбор ввода по зоне пользователя (зона проекта — значение по умолчанию)
- **Критерий снятия:** даты для пользователя форматируются и разбираются по его зоне из `user`; жёстко заданная UTC+5 остаётся только как значение по умолчанию; маркер удалён

### DEBT-44: UC-адаптеры над legacy-фасадами
- **Место:**
  - `modules/user/src/user/uc/get-telegram-addresses.uc.ts` — адаптер над фасадом пользователей; погашает миграция модуля `user`
- **Признак:** `Адаптер .* над legacy`
- **Корень:** `modules/*/src/**/uc/*.uc.ts`
- **Причина:** TR-11 — модули не на DMG (D-37), внешний контракт закрыт UC-адаптером над legacy-фасадом; паттерн описан в [migration.md](./migration.md), раздел «UC-адаптер над legacy-фасадом».
- **Погашает:** миграция соответствующего модуля (по glob'у)
- **Критерий снятия:** адаптер заменён настоящим UC модуля, `external` снят, legacy-фасад удалён, заголовок адаптера удалён

### DEBT-45: проактив с кнопками `invite` (ФР-6)
- **Место:** `platform/core/src/ui/bot/{types,ui-app,bot-controller,bot-controller.test}.ts`, `runners/u7-bot/src/infra/{bot-transport,bot-transport.test}.ts`, `runners/u7-bot/src/controllers/{peer-review/stories/invite.story,courses/stories/wish-invite.story,learning/stories/{hub,hub.test},questionnaire/stories/{invite.story,fill.story,fill.story.events.test}}.ts`; погашает `tasks-system`
- **Признак:** `ФР-6`
- **Корень:** `{platform,runners}/*/src/**`
- **Причина:** кнопочные приглашения идут каналом `invite` в обход `enterDialog`: у проактива нет сессии-аргумента, получателю без диалога транспорт создаёт диалог-якорь (seq = 1). Модуля `tasks-system` ещё нет.
- **Погашает:** трек `tasks-system`
- **Критерий снятия:** `ProactiveSender.invite`, диалог-якорь и подписки stories на канал `invite` удалены, приглашения идут через `tasks-system`, признака нет

### DEBT-46: прямое чтение `manifest.json` менторских файлов в обход API
- **Место:** `scripts/list-lessons.ts`, `scripts/distribute-mentor.ts`
- **Признак:** `manifest\.json`
- **Корень:** `scripts/**`
- **Причина:** менторские шаги не добавлены в уроки через API (`mentorStepIds`), поэтому скрипты читают `mentor-files/manifest.json` с диска.
- **Погашает:** интеграция менторских шагов в уроки через API
- **Критерий снятия:** скрипты получают менторские файлы через `get-step` (`kind: 'file'`) по `mentorStepIds`, чтений `manifest.json` с диска нет

### DEBT-48: роль `STUDENT` в модуле `user`
- **Место:** `domain/src/user/user/{roles,policy}.ts` — значение `Role.STUDENT`, `UserPolicy.isStudent`, исключения `canAddRole`/`canRemoveRole` («ментор — любому, пользователь — себе»)
- **Признак:** `Role\.STUDENT`
- **Корень:** `**/*policy.ts`
- **Причина:** с трека `stream-dmg` (Ф2) `stream` не выдаёт и не снимает роль — студента определяет `getActiveStudent`. Роль осталась в `user` и в живых `data/users` (spec `stream-dmg`, «Роль `STUDENT`»); удаление — перевод `user`. В тестах `course`, `stream` и бота `Role.STUDENT` — роль без прав (TR-44), Корень их не ловит.
- **Погашает:** трек перевода `user` на Def
- **Критерий снятия:** `Role.STUDENT` и исключения удалены; `STUDENT` убран из `roles` в `data/users` — миграция данных с `bun run backup` и разрешения Нурболата


### DEBT-50: правило «курс модуля» — две ветки по статусу и порядок файла
- **Место:** `domain/src/course/module-courses.dqs.ts` — `firstIncluding` (любой статус) и `firstPublishedIncluding` (опубликованный), выбор первого курса в порядке файла, стартовый модуль — по одному курсу
- **Признак:** `^\s+first(Published)?Including\(`
- **Корень:** `domain/src/course/**`
- **Причина:** TR-56 (С2) — поведение v0.2.6 сохранено: UC курса выбирают курс модуля по разным правилам, `getCoursesStartingWithModule` смотрит место модуля в одном курсе, а не в кандидате; расходится только при двух и более курсах с общим модулем (в данных курс один). Единое правило зависит от архивации курсов и истории модулей.
- **Погашает:** трек «История модулей курса» ([course-module-history.md](../roadmap/course-module-history.md))
- **Критерий снятия:** одно правило выбора курса модуля, `getCoursesStartingWithModule` — по кандидату; методов `firstIncluding`/`firstPublishedIncluding` нет

### DEBT-51: каталог курсов — два DMG-вызова на каждый модуль при каждом показе
- **Место:** `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts` — `#loadModulesInfo` (`getModule` + `getModuleSnapshot` на модуль)
- **Признак:** `#loadModulesInfo\(`
- **Корень:** `runners/u7-bot/src/controllers/courses/**`
- **Причина:** TR-59 (Т4 брифа `ui.md`) — поведение v0.2.6 сохранено один к одному; каждый вызов пишет строку в `data/oplog` (TR-55), карточка курса из 4 модулей — ≈ 8 вызовов на показ.
- **Погашает:** при росте числа курсов/модулей или объёма `oplog`; вариант — один `listModules` для заголовков и снимок только на уровне модуля
- **Критерий снятия:** показ карточки курса и этапа — без вызова `getModuleSnapshot` на каждый модуль

## 5. Инструменты проверки

### DEBT-34: legacy-модули импортируют чужой `index`
- **Место:** `scripts/domain-check.ts` — `checkContractImports` пропускает пары legacy-модулей; `checkDomainImports` разрешает `index`
- **Признак:** `sub !== 'index'`
- **Корень:** `scripts/domain-check.ts`
- **Причина:** D-45 — чужой модуль только через `contract`; legacy-код `user`, `dossier` (`questionnaire`, `stream` и `course` переведены на Def) импортирует `index` друг друга (entity `User`, `Role`, фасады) — около 100 импортов.
- **Погашает:** перевод каждого модуля на Def — модуль попадает в проверку автоматически (`external` снят)
- **Критерий снятия:** все модули на Def; пропуск legacy-пар и `index` в `checkDomainImports` удалены

### DEBT-49: расширение pi `subagent` привязано к скриптам u7-school
- **Место:** `scripts/subagent-gate.ts` — гейт расширения `.pi/extensions/subagent` зашит на проектный `scripts/agent-gate.ts`; само расширение импортирует `scripts/subagent-config.ts` и `scripts/subagent-gate.ts` (`.pi/` реестр не проверяет)
- **Признак:** `'scripts/agent-gate\.ts'`
- **Корень:** `scripts/subagent-*.ts`
- **Причина:** вне u7-school расширение не загружается (пилот волны 2, `agent-roles-wave2_20261104/summary.md`); переносимость нужна, только если пакет `dmg-core` будет доставлять pi-расширение, а это новый API пакета — стратегическое решение.
- **Погашает:** трек по решению о доставке pi-расширения пакетом
- **Критерий снятия:** расширение без импортов из `scripts/`; конфиг в самом расширении, команда гейта — поле в `.pi/subagent.json`

## 6. Тактические решения перехода (TR)

Решения, которые orchestrator принял сам в автономном режиме ([agents.md](./agents.md) §9). На ревизии по ним видно, что сделано временно ради перехода, а что задумано. Номера не переиспользуются. Шаблон:

```
### TR-<n>: <краткое решение>
- **Трек / фаза:** <где принято>
- **Контекст:** <что мешало, какие были варианты>
- **Решение:** <что сделано>
- **Пересмотреть:** <что проверить на ревизии; DEBT-<n>, если есть временный код>
```

### TR-1: минимальные `WishErrors`/`WishEvents` в фазе агрегата
- **Трек / фаза:** `golden-wish`, Ф2
- **Контекст:** `defineAggregate` требует `events` и `errors` (у переходов — `rejects`), а события и ошибки `wish` — Ф3–4. Варианты: объединить Ф2 с Ф3–4 (большая фаза, эталон Ar смешан с событиями); оставить Ar на legacy до Ф3–4; завести минимальные группы сейчас.
- **Решение:** в Ф2 `wish.errors.ts` содержит только ошибки отказов переходов, `wish.events.ts` — минимум, который требует `defineAggregate`; legacy `errors.ts`/`events.ts` живут параллельно. В UC/ER `err` переходов временно превращается в прежнее legacy-исключение — поведение не меняется.
- **Состояние после Ф3–4:** параллельных групп нет (legacy `errors.ts`/`events.ts` удалены). Мост `modules/wish/src/api/legacy-reject.ts` (вне naming.md §3) остался и обобщён: `throwWishError` поднимает любую ошибку `WishErrors` через `toLegacyError` (код `WISH_*`, `kind` из Def) — UC/ER остаются legacy-классами до Ф8/Ф10. Тип `LegacyWishUcError` (`domain/wish/wish/commands/legacy-uc-error.ts`) — для `errors` legacy-мет команд.
- **Состояние после Ф5:** отказ Policy в `cancel-wish-uc.ts` (`CoreErrors.ACCESS_DENIED`) поднимается свободной функцией `throwWishError` мимо типизированного `WishUseCase.throwWishError`: `LegacyWishUcError` не описывает базовые ошибки. Ветка недостижима (желание ищется по актору). Там же остался `if` по статусу перед `cancel` (API-01) — legacy UC.
- **Пересмотреть:** в Ф8–11 (`UseCaseFromDef`/`ReactionFromDef`, `Result` через `appApi.execute`) `legacy-reject.ts` и `legacy-uc-error.ts` удалены. Policy подключается полем `policy` Def UC, `if` по статусу из `cancel-wish` уходит.

### TR-2: legacy-репозиторий `wish` на `WishArDef.state` через приведение типа
- **Трек / фаза:** `golden-wish`, Ф2
- **Контекст:** legacy `JsonFileRepo<T>` ждёт схему с одинаковым типом входа и выхода, а `F.timestamp` принимает строку или число и отдаёт число. Без разбора через `WishArDef.state` записи без `updatedAt` теряются (фолбэк D-36). Порт `WishRepo` в домене пока на `WishState`, поэтому `restore`/`snapshot()` вызывают UC/ER.
- **Решение:** `WishArDef.state as unknown as v.GenericSchema<WishState>` в `wish-json-repo.ts`; `core` не меняется. Часы и uuid в UC/ER — `Date.now()`/`crypto.randomUUID()`, как у соседних legacy-UC. Первая запись перепишет `data/wish/wishes.json` с числовыми датами и полями `updatedAt`/`version` — это формат spec (`F.timestamp` пишет число), старые ISO-записи читаются.
- **Пересмотреть:** в Ф6 (`WishJsonRepo`, порт на Ar/`Result`, UoW) приведения и `restore`/`snapshot` в UC/ER нет; часы — порт `Clock`.
- **Состояние после Ф6–7:** приведение и `JsonFileRepo` ушли (`infra/wish.json-repo.ts` по шаблону gen, строгий разбор — решение Нурболата), порт `WishRepo` в `modules/wish/src/wish/wish.repo.ts` принимает и возвращает `WishAr`. Остаток — часы (`Date.now()` в UC/ER) — в Ф8.

### TR-3: `kind: 'conflict'` у ошибок отказа переходов `wish`
- **Трек / фаза:** `golden-wish`, Ф2 (решение для Ф3–4; выбор поручен оркестратору Нурболатом)
- **Контекст:** legacy поднимал `BAD_REQUEST` (400) на недопустимый переход; в `WishErrors.WISH_NOT_*` — `conflict`. Варианты: сохранить `bad-request` ради совместимости или `conflict`.
- **Решение:** `conflict` — вход валиден, операция несовместима с текущим статусом агрегата (семантика 409). Код для вызывающих сменится в Ф3–4 вместе со снятием моста TR-1; тексты ошибок прежние. Ориентир для остальных модулей: отказ перехода жизненного цикла — `conflict`, невалидный вход — `validation` (legacy `bad-request`).
- **Пересмотреть:** на ревизии — согласованность `kind` отказов переходов во всех модулях; нет ли клиентов, различающих 400/409.

### TR-4: публикация событий `wish` из legacy-ER через `legacyEventBus`
- **Трек / фаза:** `golden-wish`, Ф3–4
- **Контекст:** события стали Def с FQN, а UoW (Ф6) и `ReactionFromDef` (Ф10) ещё нет; legacy-ER получают из резолвера только legacy-шину. Варианты: новый контракт резолвера с шиной DMG (правка `app`/`core`) или обёртка на месте.
- **Решение:** `modules/wish/src/api/legacy-publish.ts` (`publishWishEvents`, вне naming.md §3) строит конверт по образцу UoW (`systemCaller(<ER>)`, причина и `correlationId` — событие-причина) и публикует в `legacyEventBus(resolve.eventBus)`, который каждый ER создаёт сам. Legacy-подписчики (stories) получают FQN как `eventName`, `aggregateName` — `wish.wish`. Barrel `modules/wish/src/domain/index.ts` (DEBT-23) реэкспортирует `@u7-scl/domain/wish/contract`: у бота нет прямой зависимости от `@u7-scl/domain`.
- **Пересмотреть:** в Ф10–12 конверт строит UoW, wiring раздаёт **один** экземпляр шины DMG — сейчас конверт живёт в экземпляре моста конкретного ER, и подписчики DMG других модулей событий `wish` не увидят (таких пока нет). `legacy-publish.ts` удалён.

### TR-5: решения модели событий и ошибок `wish`
- **Трек / фаза:** `golden-wish`, Ф3–4
- **Контекст:** `invited` не меняет состояние; у module-желания нет курса для payload `confirmed`; коды `COURSE_NOT_FOUND`/`MODULE_NOT_FOUND` заняты модулем `course`.
- **Решение:** `invited` строит ER через `WishEvents.invited.make` (решение — на фасадах курсов и пользователей; метод Ar без перехода растил бы `version`), `telegramId` в payload оставлен — по нему UI отправляет карточку. `confirm` у module-желания в `pending` — `Err WISH_NOT_CONFIRMABLE` (ветка недостижима: module-желания создаются `expressed`). Отказы цели — `WISH_COURSE_NOT_FOUND`/`WISH_MODULE_NOT_FOUND` (`not_found`). Видимое пользователю не изменилось: бот ветвится по `kind`.
- **Пересмотреть:** на ревизии — не протекает ли адресация (`telegramId`) в домен; не нужна ли ER своя публикация событий (риск для Ф10: UoW публикует только события агрегатов).

### TR-6: Policy, DCS и метод-вопрос Ar в `wish`
- **Трек / фаза:** `golden-wish`, Ф5
- **Контекст:** ревью Ф5: `WishDcs.checkUnique` доверял вызывающему, что желания — этого пользователя на эту цель; геттер `WishAr.status` против DOM-04; право на создание.
- **Решение:** DCS сам отбрасывает чужие желания и желания на другую цель (`isOwnedBy`, метод-вопрос цели Ar `isFor`) — эталон не опирается на неявный контракт выборки. Фикстура дедуп-тестов `create-module-wish-uc.test.ts` строила «дубль» чужому пользователю — исправлена на актёра, сценарии и ожидания прежние. Геттер `status` оставлен до Ф6–7: по D-39 его заменяет метод Ar `alreadyExists()`, строящий ошибку. Право на создание не заводится (всегда за вызывающего) — с Ф8 UC создания ссылаются на `allowAll`.
- **Закрыто (Ф6–7, D-39/D-40):** `WishDcs` удалён — уникальность стала доменным правилом `WishRules.rules.unique`; геттер `status` заменён методом `WishAr.alreadyExists()`, строящим ошибку. Остаток — право на создание (`allowAll`) — в Ф8.

### TR-7: выбор «текущего» желания в репозитории `wish`
- **Трек / фаза:** `golden-wish`, Ф6–7
- **Контекст:** legacy `getByUserAndTarget` выбирал среди желаний пользователя на цель «активное последнее созданное, иначе последнее» — решение в хранилище (API-03). Его зовут `cancel-wish` и ER `confirm`/`abandon`, которые остаются legacy-классами до Ф9–11.
- **Решение:** порт `WishRepo.findCurrentByUserAndTarget` сохраняет выбор как есть (метод-вопрос Ar `isActive`); `WishAr` возвращается, `snapshot()` нужен репозиторию только для сортировки по `createdAt`. Резолвер `WishApiModuleResolver` (DEBT-22) переехал в `modules/wish/src/wish/wish.resolver.ts` — домен не импортирует порт прикладного слоя; подпуть `@u7-scl/wish/wish`.
- **Пересмотреть:** в Ф9–11 выбор уходит из репозитория (UC/ER получают `findAllByUserAndTarget` и решают через Ar или доменное правило); резолвер заменяет `WishModuleDef` (Ф12).
- **Ограничения до Ф8–11 (ревью Ф6–7):** `markStored()` зовёт только UoW — legacy-UC/ER, вызывающие `save` сами, не могут сохранить один экземпляр Ar дважды (второй `save` — `VersionConflict`; сейчас повторных нет). ER `fulfill-wish`, `invite-wishers` читают поля через `ar.snapshot()` и ветвятся по ним (как legacy, против D-39) — уходит вместе с переводом на `ReactionFromDef`.

### TR-8: решения по ревью Ф6–7 (платформа и правила)
- **Трек / фаза:** `golden-wish`, Ф6–7
- **Контекст:** ревью фазы: lint DOM-01 пропускает `*.dqs.ts` (D-39 разрешает форму проекциям DQS, но файл — и сервис); проверки DOM-16/ERR-02 в rules.md расходились с фактическими; `RulesDef` не проверяется как описанный Def; UoW публикует события записанных в `finally`.
- **Решение:** lint не меняется — у `*.dqs.ts` и доменного `*.facade.ts` проверка «state только для схем, без ветвления» — `review` (колонка DOM-01). DOM-16: тип — только своя ошибка в `check`; дубль в `rules` UC и ERR-02 — `checkDefs`; «ошибка группы своего агрегата» — `review`. `RulesDef` вне `describedDefs` — как `PolicyDef` (label/description правил проверяются через узлы правил графа). Публикация в `finally`: исключение шины подменяет результат UoW — принято (шина in-proc, её исключение — дефект); повтор операции после `VERSION_CONFLICT` может повторить события записанных — ER идемпотентны (D-36).
- **Пересмотреть:** при проверке принадлежности ошибки правила в `ArchChecker` (проверки Def) — снять `review` у DOM-16; при внешней шине — публикация вне `finally`.
- **Вопрос «DQS и state» закрыт** (Нурболат, 2026-11-03, трек `stream-dmg`): D-60 пакета `dmg-core` (`09005e1`). DQS читает поля через `view()` и может импортировать типы и схемы state; условие, нужное команде, Policy или правилу, — метод-вопрос Ar; только для показа DQS считает сам. Отдельного Def проекции нет — форма `V` агрегата или схема выхода UC. DCS state не видит. Первая редакция (запрет state в DQS, `<topic>.projection.ts`, `684d23e`) пересмотрена до применения: `ReadonlyAr` оставляет `view()`, запрет импорта утечку не закрывал. Lint DOM-01 и `review-draft.dqs.ts` не меняются.
- **Перед релизом (переход на прод):** строгий разбор `WishJsonRepo` — одна запись `data/wish/wishes.json` на сервере, не прошедшая `WishArDef.state`, остановит модуль `wish`. До переключения — прогнать разбор файла прода без записи (скрипт только читает). Локально каталога `data/wish` нет.

### TR-9: каркас модуля и сосуществование UC `wish` в Ф8
- **Трек / фаза:** `golden-wish`, Ф8
- **Контекст:** `gen uc` требует `<m>.module.ts`, а `WishModuleDef` по плану — Ф12; legacy-UC зарегистрированы в `api/module.ts` и вызываются ботом через `appApi.run('wish', 'create-course-wish', …)`.
- **Решение:** `gen module wish --adopt` выполнен в Ф8 (каркас `wish.module.ts` в домене и пакете; `dependsOn`, резолвер — Ф12). Новый `CreateCourseWishUc` (`UseCaseFromDef`, имя `createCourseWish`) живёт рядом с legacy-классом и тестируется отдельно; бот до Ф12 ходит в legacy (дублирование логики на время перехода). Схема входа legacy-команды выводится из Def, без копии.
- **Пересмотреть:** Ф12 — подключение `createWishModule` в приложение, перевод вызовов бота на новые имена, удаление legacy-классов и `commands/*-cmd.ts`.

### TR-10: детали платформы D-42 (Ф8 шаг 1)
- **Трек / фаза:** `golden-wish`, Ф8
- **Контекст:** перевод `dmg-core` на фасад без манифеста; решения автора, не оговорённые в D-42.
- **Решение:** (1) ошибки `load`/`execute` — `UseCaseErrorOf<D>` (с `CoreError`), чтобы потребитель отдавал отказ вызываемого UC как есть; ERR-02 для доменных ошибок сохраняется. (2) `module` с `origin = system` (ER/Job → фасад) — Policy вызываемого UC не проверяется, как у `system`; с `origin` пользователя — проверяется. (3) Отказ «UC нет в `calls` у `from`» — `UNAUTHORIZED` с необязательным `from` в payload. (4) `checkDefs` сверх брифа: вызываемый UC без `module` в `callers` — MAN-05. (5) `trace` — последний аргумент `load`/`execute`; `CallContext`, `Trace`, `Cause` — в `kernel` (их видит тип фасада в домене). (6) `asReadonlyAr` принимает класс Ar (Def агрегата `restore` не знает).
- **Пересмотреть:** ~~(2) — при делегировании и аудите системных цепочек; конверт события несёт `from` как Def целиком~~
- **Закрыто (Ф8а, Р7, D-43):** (1) остаётся — ошибки ядра чужого UC насквозь, необъявленная доменная не проходит по типу (закреплено тестами); (2) снято — Policy вызывается всегда (Р2); (3) снято — `UNAUTHORIZED` без `from`, рантайм-проверки `calls` нет; (4) снято — вида `module` нет, `calls` по типу только UC с `'system'` в `callers`, `checkDefs` остаётся; (5) остаётся (`CallContext` удалён); (6) снято — `Aggregate.readonly(state)`; `caller` удалён из конверта события и UoW.

### TR-11: UC-контракты внешних `course` и `questionnaire` с адаптерами
- **Трек / фаза:** `golden-wish`, Ф8
- **Контекст:** D-42 — межмодульный вызов идёт через Def UC владельца; `course` и `questionnaire` не мигрированы (D-37).
- **Решение:** во внешних контрактах — Def UC (query «старт записи на курс», command «запуск анкеты»); реализации — `UseCaseFromDef`-адаптеры поверх legacy-фасадов в пакетах владельцев; новый тип фасада рядом с legacy.
- **Детали 2a:** `CourseArDef` — минимальный (как `QuestionnaireArDef`); вход запуска — `owner` (как payload событий), адаптер переводит в legacy `ownerInfo`; `StartQuestionnaireUcDef.policy = allowAll` — респондент всегда субъект вызывающего, `origin` без субъекта — баг `callers` (`subject()` бросает); правило «только за себя» — при миграции (`QuestionnairePolicy` занято legacy). Типы фасадов — `CourseModuleFacade`/`QuestionnaireModuleFacade` (`<M>Facade` заняты legacy).
- **Детали 2b:** адаптеры — `UseCaseFromDef` в `modules/{course,questionnaire}/src/<a>/uc/`, владелец — обычный `ModuleFromDef` (`createCourseModule`, `createQuestionnaireModule`), подключение — Ф12. `if` по ответам legacy в адаптере курса — перевод в контракт (уходит с адаптером). `emits: [started]` адаптер не публикует: `questionnaire:start` по-прежнему в legacy-шине, в `inbound` его нет — добавить, когда появится DMG-подписчик. Ошибки legacy `start` — `SERVER_INTERNAL`.
- **Пересмотрено (Ф8а, Р9, D-43):** подход с Def UC во внешнем контракте и адаптерами принят; `callers: ['system']`; типы `CourseModuleFacade`/`QuestionnaireModuleFacade` удалены — `Facade<typeof <M>ModuleDef>` и `ModuleFacade`; `GetCourseEnrollmentUcDef.policy = allowAll` остаётся; `StartQuestionnaireUcDef.policy` — `QuestionnaireRespondentPolicy.rules.hasRespondent` (без субъекта — `ACCESS_DENIED`; имя — `QuestionnairePolicy` занято legacy).
- **Дополнено (Ф9):** `GetModuleEnrollmentUcDef` (`course`, query «модуль в программе опубликованного курса», `allowAll`) — адаптер `modules/course/src/course/uc/get-module-enrollment.uc.ts` над legacy `getModulePlace`.
- **Пересмотреть:** при миграции `course`/`questionnaire` — адаптеры заменяются настоящими UC, `external` снимается, legacy-фасады удаляются.
- **Снято для `stream`** (`stream-dmg`, Ф1): адаптеры `getStreamMembers`/`getStreamPresence` у `wish` и `peer-review` заменены настоящими UC модуля `stream`.
- **Снято для `questionnaire`** (`questionnaire-dmg`, Ф1, Ф3): адаптер `start-questionnaire` заменён настоящим UC, правило «только за себя» — в `QuestionnairePolicy` Def (субъект `Identified`), `external` снят, legacy-фасад удалён.
- **Снято для `course`** (`course-dmg`, Ф3, Ф5): адаптеры `course` заменены настоящими UC (Ф3), `external` снят, legacy-фасад и `CourseApiModule` удалены (Ф5). Запись закрыта для всех модулей.

### TR-12: решения по ревью Ф8
- **Трек / фаза:** `golden-wish`, Ф8
- **Контекст:** ревью Ф8 — ошибок нет; warn: гайд facade о `checkDefs`, тесты потребителя не проверяют `calls` (фейки фасадов), транзиентное поле `WishAr.questionnaireToStart()` вне state; info — ниже.
- **Решение:** (1) гайды и domain-modeling поправлены (оговорка D-41 у антипаттерна «скрытые мутации», имя `<M>ModuleFacade` у внешних). (2) Фейк фасада в `dmg-core/testing`, отказывающий, если Def UC нет в `call.from.calls`; тесты `wish` — через него. (3) Вместо транзиентного поля — `createForCourse` возвращает `{ wish, questionnaire? }` (анкета — результат создания, не свойство Ar). (4) Тип `owner` фасада анкет выводится из входа Def. Принятые риски: `CallingOperation` — структурный тип (можно собрать `from` вручную) и прямой `handle` с `user` у UC, принимающего `user` и `module`, — закрываются ARC-06 и in-proc вызовом; `UseCaseOwner` стирает субъект до `unknown` (DEBT-21/22, TR-11).
- **Пересмотреть:** при выходе модуля в сервис — подпись `from` (не структурный тип); при миграции анкет — типизация субъекта в `UseCaseOwner`.
- **Пересмотрено (Ф8а, Р10, D-43):** (3) снято — `createForCourse` → `Result<WishAr, never>`, анкета и ответ — методы-вопросы из state `questionnaire()`/`outcome()`, `CourseWishCreated` удалён; (2) — `StubFacade<M>` (Р4), проверка `calls` — типом (Р5); (4) — `owner` из Def через `Facade<M>`; риски `from`/прямого `handle` — сняты Р3/Р5. Остаётся: `SystemCaller<unknown>` на границе `Facade<M>` до миграции анкет (DEBT-21/22).

### TR-13: детали `Caller` по D-43 (Ф8а шаг 1)
- **Трек / фаза:** `golden-wish`, Ф8а
- **Контекст:** Р1 — иерархия `Caller`; решения автора сверх D-43.
- **Решение:** (1) ~~модуль для `OperationRef` — третий аргумент конструктора базы~~ → решение Нурболата на Р4–Р5: модуль передаёт себя — `ModuleMap` `new (deps, module)`, наследник `constructor(deps, module: typeof XModuleDef) { super(XUcDef, deps, module) }` (`ModuleDef` — только тип); Def вне модуля — исключение базы. (2) У `SystemCaller` поле человека приватное (`origin`), наружу — метод `person()`; у `DelegateCaller` субъект — приватный `principal`. (3) `Caller<unknown>` → `Caller` (дженерик ограничен `Identified`: `toLog` нужен `uuid`); `ApiApp.TActor` без ограничения ради legacy, DMG-часть — `TActor & Identified`. (4) Конверт legacy-события — `SystemCaller` с условной операцией `{ kind: 'useCase', module: 'legacy', name: eventName }`; `onBehalfOf` у ER снят. (5) ~~До Р2 Policy пропускается только для `system` без человека~~ — снято на Р2 (Policy всегда). (7) Р2: фиксация (`uow.commit()` и публикация) — не `protected`-шаг, а инвариант приватного `run` базы: наследнику в ней нечего менять. (6) ~~До Р5 рантайм-проверка `calls` — в `callUseCase`/`fakeFacadeCall` (в `OperationRef` нет `calls`), `UNAUTHORIZED { callerKind: 'system', from }`~~ — снято на Р5 (тип `call`).
(8) Р3: `runJob` → `Result<JobReport, DomainError>` (отчёт нужен планировщику); публичный `serves(def)` у модуля (выбор модуля в `ApiApp`); `jobTrace()` — до `Trace.forJob` (Р8); в `callUseCase` сначала `calls`, потом `handle` (до Р5); чужой Def в `handle`/`runJob` — ошибка типа, при стёртом типе — исключение (ошибка сборки, не штатный отказ, ERR-01).
(9) Р4–Р5: `handle` у `Facade`/`ModuleFacade`/`StubFacade` — `<D extends AnyUseCaseDef>(def: D extends SystemCallable<M> ? D : never, …)`, иначе фасады не кладутся в общий `ModuleFacades` без приведения; `SystemCallable` уже сужен до `'system'` в `callers` (для фасада и `StubFacade.answer`); `calls` у `EventReactionDef`/`JobDef` без объявления — `readonly []` (иначе ER/Job вызывали бы любой UC); нет фасада в `ModuleFacades` — исключение сборки; два рантайм-теста `wish` на подмену `calls` заменены проверкой состава `CreateCourseWishUcDef.calls`.
(10) Р6: запись лога берёт события из `published` всех UoW вызова (при `VERSION_CONFLICT` события записанных агрегатов уже опубликованы), у Job — одна запись на прогон; вход ER — событие без `caller`, Job — `null`; брошенное исключение пишется как `SERVER_INTERNAL` (стек — `logger.error`); сбой записи лога — `logger.warn`, результат операции не меняется (данные уже зафиксированы); `JsonlOperationLog` — в `dmg-core/app`. Прод-подключения нет: DMG-модули в приложении собираются в Ф12 — там `new JsonlOperationLog(`<DB_DIR>/oplog`)`.
(11) Р7: в `Aggregate.readonly` — `biome-ignore noThisInStatic` (полиморфный `this` — суть формы); фикстура графа с `calls: readonly AnyUseCaseDef[]` обходит проверку типа — Def с общим типом ловит только `checkDefs`; из `publishWishEvents` убраны `caller` и `source`; legacy-подписчики вызывающего и раньше не получали. (4) снято на Р7.
(12) Р8: класс `Trace` (`fromRequest` — две перегрузки: без `onMissing` `requestId` обязателен, с ним — создаётся с сообщением, ERR-07; `fromEvent`, `forJob(def)` — причина Job получила поле `job`; `toLog()`, `toEnvelope()` сверх D-43); `createUow(trace)` без `caller`; `ApiApp.run`/`execute` принимают `Trace` (след строит транспорт); `fromEvent` не переносит `channel` (в конверте его нет); символ-метка `create` vs `restore` остаётся, ставит её `newState`. (8) `jobTrace` снято на Р8.
- **Пересмотреть:** (10) подключение JSONL — Ф12; (12) `channel` в конверте события — когда ER понадобится канал.

### TR-14: решения по ревью Ф8а
- **Трек / фаза:** `golden-wish`, Ф8а
- **Контекст:** ревью Ф8а (`c05ec0a3..HEAD`): error и warn нет, 8 info.
- **Решение:** (1) ссылки doc `UseCaseFromDef.load` (D-42 → D-43) и `event-envelope` (caller.md п. 6) поправлены; (2) шаги `load`/`execute`/`react`/`run` полями-стрелками в тестах платформы → методы (эталон копируют); (3) `DeclaredCalls` — один тип в контрактах вместо копий в `define-job`/`define-event-reaction`; (4) Policy «респондент есть» — `rule<{ readonly uuid: string }>` без `_subject`; (5) гайды: `journal` — инвариант базы, наследник UC не вызывает (`protected` — ради ER/Job); нет фасада в `ModuleFacades` → `SERVER_INTERNAL` с `logger.error`, а не исключение до транспорта.
- **Принятый риск:** порог размера JSONL — только `input`/`output`; `payload` ошибки и `events` без обрезки (по D-43).
- **Пересмотреть:** порог для `events`/`payload` — при подключении JSONL в Ф12 (вместе с TR-13 п. 10); машинная проверка полей-стрелок шагов (GritQL-плагин biome) — когда появятся плагины правил.

### TR-15: решения по ревью Ф9
- **Трек / фаза:** `golden-wish`, Ф9
- **Контекст:** ревью Ф9 (`6e542c7d..HEAD`): error нет, 3 warning, 5 note.
- **Решение:** (1) сборка payload `WISH_NOT_FOUND` тернаром по цели в `CancelWishUc.load` → статическая фабрика ошибки Ar от цели (API-01), ею же выражен `notFound()`; (2) адаптер курса `getModuleEnrollment` дописан в TR-11; (3) `WISH_NOT_CANCELLABLE` в `errors` `cancelWish` при недостижимости через UC — оставлен (ERR-02: его возвращает переход Ar); подмена ошибки перехода в UC запрещена (гайд «use case» §4).
- **Принятый риск:** query `listUserWishes` отдаёт `wish.snapshot()` — идиома учебного `list-tasks` в `dmg-core`, расходится с D-05 / D-39 («`snapshot()` только для репозитория», данные выхода — методом Ar). В гайде помечено «временно (TR-15)».
- **Пересмотрено (Нурболат, 2026-10-22, D-44):** `Aggregate.view()` — состояние наружу (по умолчанию `snapshot()`, переопределяемо); `snapshot()` — только репозиторий, DOM-17 (lint). Перевод — Ф9а.
- **Было — пересмотреть:** с Нурболатом (открытый вопрос брифа `wish` п. 8) — как query отдаёт state агрегата: метод Ar, строящий выход, разрешение `snapshot()` в query, или иное; затем — учебный модуль `dmg-core`, `listUserWishes`, гайд; кандидат в машинную проверку — запрет `.snapshot()` в `modules/*/src/**/uc`.

### TR-16: legacy `wish` вне DOM-17
- **Трек / фаза:** `golden-wish`, Ф9а
- **Контекст:** D-44 / DOM-17 — `.snapshot()` только в репозитории; legacy ER и UC `modules/wish/src/api/**` читают поля через `snapshot()` — 6 вызовов: 5 в ER (`fulfill-wish-er.ts`, `invite-wishers-er.ts`) и legacy `api/wish/list-user-wishes-uc.ts`.
- **Решение:** путь исключён из плагина DOM-17 в корневом `biome.json` (одна строка), без `biome-ignore` по файлам.
- **Пересмотреть:** при переводе ER (Ф10–11) и удалении legacy-UC (Ф12) — исключение снять.
- **Пересмотрено (Ф12, TR-21):** legacy `wish` удалён, исключение из DOM-17 снято.

### TR-17: решения по ревью Ф9а
- **Трек / фаза:** `golden-wish`, Ф9а
- **Контекст:** ревью Ф9а (Opus, `de44c108..e5983103`): error нет, 3 warning, 4 note.
- **Решение:** (1) ~~`SameType` сверяет и множества ключей~~ — пересмотрено Нурболатом: `this`-ограничение и `SameType` удалены как избыточные, `view(): V` по умолчанию `snapshot()`; «объявил `V` — переопредели `view()`» — review и тест агрегата (принятый риск); типы агрегата вынесены из `aggregate.ts` в отдельный файл; (2) DOM-17 ловит `?.snapshot()`; (3) исключения DOM-17 — только по имени файла репозитория (`*.repo.ts`, `*-repo.ts`, `*.json-repo.ts`, `*.memory-repo.ts`), `infra/**` целиком больше не исключён (фасады — зона `view()`); (4) rules.md, TR-16 (6 вызовов), гайд «aggregate» (переопределение собирает объект явно) поправлены.
- **Принятый риск:** `ar['snapshot']()`, деструктуризация и `.call` lint не ловит — review.

### TR-18: ER `fulfill-wish` (Ф10)
- **Трек / фаза:** `golden-wish`, Ф10
- **Контекст:** первая ER `wish` на `ReactionFromDef`; запросы к курсу — внешние UC `getCoursesIncludingModule`, `getSameModules` (адаптеры TR-11).
- **Решение:** (1) module-ветка — один батч `getSameModules` (legacy `whichModulesAreSame`) вместо цикла `isSameModule`: поведение то же, контракт фасада курсов это обещает; (2) решение «что спросить у курса и что реализовать» — `WishFulfillmentDcs` (первый DCS `wish`, DOM-06: батч по нескольким агрегатам), вопросы одного желания — методы `WishAr` (`fulfillmentTargets`, `isFulfilledBy`); (3) отказ любого вопроса к курсу прерывает реакцию целиком (UoW атомарен), legacy при сбое фасада успевал сохранить часть course-желаний — отличие только в сбойном случае; (4) новая ER живёт рядом с legacy `api/er/fulfill-wish-er.ts`, в приложение не подписана (как TR-9).
- **Пересмотреть:** Ф12 — подписка `createWishModule`, удаление legacy ER; на ревизии — п. 3.

### TR-19: решения по ревью Ф10
- **Трек / фаза:** `golden-wish`, Ф10
- **Контекст:** ревью Ф10 (Opus, `23f27f3c..33018818`): error нет, 1 warning, 8 info.
- **Решение:** (1) `*.types.ts` (`wish.types.ts`, `wish-fulfillment.types.ts`) — по указанию Нурболата «экспортируемые типы — в отдельный файл» (как `aggregate.types.ts`); внесено в naming.md §4 (Нурболат, 2026-10-26); (2) гайд «event reaction»: вспомогательные `private`-методы ER допустимы, прямой `subscribe(bus)` — только в тестах — поправлено; (3) необязательный раздел «Устройство реализации» в гайдах (use-case, event-reaction) — `_template.md` не меняем до Ф13 (сводка гайдов); (4) JSDoc `GetSameModulesUcDef` о legacy-реализации, длина теста отказа и ожидание опросом в тесте `subscribe`, перепутанные виды id в фикстурах DCS-теста — оставлены, поправить в Ф11 вместе с остальными ER (тот же файл теста и образец); (5) `FulfillmentTargets` — и вопрос, и ответ `isFulfilledBy` — принято, одна форма списков целей.
- **Пересмотреть:** Ф11 — п. 4 (закрыт, TR-20 п. 6); Ф13 — п. 3.

### TR-20: ER `confirm-wish`, `abandon-wish`, `invite-wishers` и ревью Ф11
- **Трек / фаза:** `golden-wish`, Ф11
- **Контекст:** три оставшиеся ER `wish` по гайду Ф10; ревью (Sonnet, `cd5bd03..be43672a`): error нет, 1 warning, 6 info.
- **Решение:** (1) событие без смены статуса — `WishAr.invite` через `change` (Нурболат, 2026-10-26, вопрос 9 брифа): запись `version`/`updatedAt` на каждое приглашение; при `VERSION_CONFLICT` на N-м желании приглашения до него уходят, после — нет (D-15), legacy рассылал всем; (2) повторное `stream.created` — повторное приглашение (как legacy): идемпотентность требует приглашения в state — долг, вне трека; (3) внешние UC `getCoursesStartingWithModule` (одним вопросом `getModulePlace().isFirst` + `whichCoursesIncludeModule`, объединение в адаптере), `getStreamPresence`, `getTelegramAddresses` (адаптер — цикл по `getUserByUuid`, батча в legacy нет); минимальный `UserArDef`, карты `stream.module.ts`, `user.module.ts` (TR-11); (4) отличия от legacy в пропусках: «нет профиля» и «нет `telegramId`» — один случай, `warn` на пользователя, а не на желание; адаптер адресов отсекает только `undefined` (`telegramId: 0` невозможен в Telegram — принято); (5) по ревью: литералы статусов в `findAllByKind` ER убраны — отбор только `canInvite` в `WishInvitationDcs` (warning); `askMatch`/`askReach` — механика «вопрос → Def UC» в ER, кандидат в общий приём `ReactionFromDef` на ревизии; `invitationTargets`/`isInvitedBy` дублируют `fulfillment*` — общая форма при третьем потребителе; обновление `@types/bun` в `bun.lock` от `bun install` — принято; (6) хвосты TR-19 п. 4 закрыты в Ф11: JSDoc Def UC курса без legacy, виды id в фикстурах DCS-тестов, тест отказа и `subscribe` в `fulfill-wish.er.test.ts`.
- **Пересмотреть:** Ф12 — подписка новых ER в `createWishModule`, удаление legacy ER; на ревизии — п. 1, 2, `askMatch`/`askReach`.

### TR-21: сосуществование `wish` в приложении (Ф12)
- **Трек / фаза:** `golden-wish`, Ф12
- **Контекст:** подключение DMG-модуля `wish` и адаптеров зависимостей к боту; удаление legacy `wish` после переключения.
- **Решение:** (1) порядок задач Ф12: мост → сборка/stories → удаление legacy (иначе `check` между задачами красный); (2) мост: дефолт `onInvalid` — `console.warn` (исключение async-обработчика `InProcEventBus` глотает), маршрут `inbound` — одна подписка на legacy-шину; (3) одна сборка DMG для бота, test-app и `call-uc` — `runners/u7-bot/src/create-dmg-modules.ts` (`createDmgAppContext`, `createDmgModules`); (4) stories зовут UC по Def через `U7BotUiStory.executeUc` (`UserCaller`, `Trace.fromRequest` с каналом `telegram`); `requestId` генерируется с `warn` на каждый вызов — `update_id` до стори не доходит без смены контракта ядра бота; (5) `wishModule` убран из `ApiAppBundle` (потребителей нет); `call-uc` зовёт UC `wish` через DMG (oplog — `data/oplog`, как бот); (6) экспорт `"."` у `@u7-scl/user`, `./wish.module` у `@u7-scl/wish`; workspace-зависимости `dmg-core`, `@u7-scl/domain` у `runners/u7-bot`; (7) шаг 3: legacy `wish` удалён (`modules/wish/src/api/**`, резолвер, домен `module.ts` и `commands/**`, 67 legacy-тестов — случаи покрыты тестами DMG UC/ER и домена); исключение `modules/wish/src/api/**` из DOM-17 в `biome.json` и его фикстура сняты (TR-16 закрыт); DEBT-21/22 остаются в `modules/wish/src/{wish.module.ts,wish/uc/*.uc.ts}` — субъект `User` из `@u7-scl/app` (решается в Ф13).
- **Пересмотреть:** п. 4 — протащить `update_id` до стори (контракт `BotUpdate`/`handleCallback`) в треке ui-manifests, тогда `warn` уйдёт; п. 3 — при миграции следующих модулей сборка растёт там же.

### TR-22: решения по ревью Ф12
- **Трек / фаза:** `golden-wish`, Ф12
- **Контекст:** ревью (Opus, `211dbdb3..HEAD`): error 0, warning 0, info 8.
- **Решение:** (1) гайд «module»: место внешнего `defineModule` (`<m>.module.ts`, экспорт из `contract.ts`) и предупреждение о субъекте `User` (DEBT-21/22) — поправлены; (2) `warn` на каждый вызов `executeUc` — принято (TR-21 п. 4); (3) мост: пустой `Set` после отписки, обработчик для Def без маршрута `inbound`, лишняя проверка `isOf` — без влияния на поведение, принято; (4) шпион `console.error` в `legacy-event-bus.test.ts` снимается в теле теста, а не в `afterEach`; повтор сборки `UserCaller` + `Trace.fromRequest` в интеграционных тестах `u7-bot` — кандидат на хелпер `test-app`; (5) прямая зависимость `u7-bot` от `@u7-scl/domain` — повод пересмотреть barrel DEBT-23.
- **Пересмотреть:** п. 3, 4 — в Ф13 (чистка вместе с DEBT-21/22); п. 5 — Ф13 / последний трек миграции (DEBT-23).

### TR-23: закрытие DEBT-21/22/31 (Ф13)
- **Трек / фаза:** `golden-wish`, Ф13
- **Контекст:** в домене `wish` импортов `core`/`app` не осталось с Ф12; DEBT-21/22 держал субъект `User` из `@u7-scl/app` в UC `modules/wish` и адаптере анкет. DEBT-31 — ручной `DOMAIN_GRAPH`; у `peer-review` и `dossier` не было `ModuleDef`. Подключение приложения домена в `ARCH_APPS` дало 92 нарушения `checkFiles` платформы.
- **Решение:** (1) субъект модуля и UC `wish` — `Identified` (`dmg-core`); `this.call` к анкетам принимает его без изменений платформы; (2) адаптер анкет берёт `User` из `@u7-scl/domain/user` — DEBT-32; (3) внешние `PeerReviewModuleDef`, `DossierModuleDef`; граф ARC-04/05 — `domainGraphOf(DOMAIN_MODULES)` (`scripts/domain-arch.ts`, бывший `domain-debt.ts`), каталог домена без Def — ARC-05; `checkDefs` по модулям домена — в `runDomainCheck`; (4) `archCheck` домена не подключён — DEBT-33 (ARC-04 платформы без подпутей `/contract`, legacy внешних модулей); (5) тест `domain/src/domain.modules.test.ts` перенесён в `scripts/arch-check.test.ts`: файл в корне `domain/src` с импортами всех модулей нарушал ARC-04 проекта, а `checkDefs` по модулям теперь в `arch:check`; (6) DEBT-24 погашен ещё в Ф2.
- **Пересмотреть:** п. 4 — стратегически: открыть ли подпути `/contract`, `/state` в ARC-04 платформы или перевести домен на импорт через `index.ts` (вопрос Нурболату); TR-22 п. 3, 4 — без влияния на поведение, остаются принятыми.

### TR-24: форма портов `Outbox` и `Inbox` (Ф4)
- **Трек / фаза:** `dmg-core-extract`, Ф4 (шаг 2)
- **Контекст:** D-47 задаёт outbox и отсев повторов; детали формы портов решены оркестратором.
- **Решение:** (1) `Outbox.put(envelopes)` — асинхронный, партия одной фиксации; запись агрегатов и outbox не атомарна (JSON-хранилище, D-15); (2) `Inbox` — `claim`/`release`: доставка занимается до обработки, снимается при любом не-`Ok`; параллельный повтор во время первой доставки отбрасывается и теряется, если первая упала — для in-proc шины повторов нет, для relay «как минимум один раз» допустимо; (3) `outbox`, `inbox` в `AppContext` обязательные (ручных сборок две, остальные — `testAppContext`); (4) отсев — в `ReactionFromDef.handle`, а не в модуле: действует при любом пути доставки; повтор — `Ok`, без записи в лог операций, `debug`; (5) `InProcInbox` ограничен ёмкостью (`DEFAULT_INBOX_CAPACITY = 10_000`) — память процесса бота; (6) хелпер `expectIdempotentReaction` требует `Ok` и от второй доставки: отказ на повторе — нарушение. (7) по ревью: сбой `claim` — `SERVER_INTERNAL` без снятия доставки, сбой `release` — `error` в логгер; сбой `outbox.put` после сбоя сохранения — в `cause` исходного исключения.
- **Пересмотреть:** п. 1, 2 — при первом персистентном outbox или внешней шине.

### TR-25: MAN-13 в рантайме UoW — необязательный `module` (Ф4)
- **Трек / фаза:** `dmg-core-extract`, Ф4 (шаг 4)
- **Контекст:** UoW проверяет «один UoW — один модуль» по `UnitOfWorkContext.module`; Def агрегата и репозиторий свой модуль не знают, модуль передаёт `OperationFromDef`.
- **Решение:** поле необязательное, как `emits` и `touches`: UoW, созданные вне `OperationFromDef` (мосты legacy), в рантайме MAN-13 не проверяют; статически правило держит `checkDefs`. Ветка MAN-06 «агрегат другого модуля» снята — теперь это MAN-13.
- **Пересмотреть:** при удалении мостов legacy — сделать `module` обязательным.

### TR-26: ARC-04 между внешними модулями (Ф4, DEBT-33 погашен)
- **Трек / фаза:** `dmg-core-extract`, Ф4 (шаг 5)
- **Контекст:** подключение домена в `ARCH_APPS` со входом `contract` (D-45) дало 52 импорта чужого `index` из домена legacy-модулей (course 28, stream 19, questionnaire 3, peer-review 2) — это DEBT-34. Перевод на `/contract` невозможен: legacy-домену нужны legacy-классы, которых в контракте нет.
- **Решение:** `checkFiles(index, layout, entry = 'index')` — вход модуля задаёт приложение (`ArchApp.entry`, у домена — `contract`). Импорт мимо входа не проверяется, только если оба модуля `external` (реализованы вне приложения) — так D-45 читает «пары legacy-модулей — по долгу»; модуль на Def импортирует и импортируется только через вход; `dependsOn` проверяется для всех. Прикладной слой внешнего модуля не сканируется (цикл импортов не учитывал `external`). DEBT-33 погашен: `DomainArch` в `ARCH_APPS`.
- **Пересмотреть:** при переводе последнего legacy-модуля (DEBT-34) — исключение станет пустым.

### TR-30: контекст апдейта бота — `AsyncLocalStorage`, а не поле сессии
- **Трек / фаза:** `dmg-cleanup_20261028`, Ф4 (контекст запроса, вариант B кандидата bot-request-id)
- **Контекст:** вариант B велит положить id апдейта в объект, который story уже получает. `BotSession` сохраняется в JSON-репо на каждом апдейте (id апдейта в нём лишний), а `dispatchUc` сессию не получает — её пришлось бы протащить во все вызовы, то есть сменить сигнатуры (вариант A). Stories — общие для всех чатов, поэтому поле экземпляра даёт гонку между чатами.
- **Решение:** `BotRequestContext` (`platform/core/src/ui/bot`) на `AsyncLocalStorage` (`node:async_hooks`, встроен в Bun, без зависимостей). Транспорт ставит апдейт в очередь чата внутри `BotRequestContext.run(update_id, …)` — контекст захватывается при постановке и виден, когда до апдейта дойдёт черёд; `dispatchUc` берёт `requestId = tg:<update_id>#<n>` и `correlationId = tg:<update_id>`. Вне апдейта (проактив, тесты) контекста нет — прежний `warn` (ERR-07). Тестовый стенд e2e выдаёт новый `update_id` на каждый вызов обработчика.
- **Пересмотреть:** в `dmg-ui` — контракт story несёт id запроса явно (DEBT-41).

### TR-31: вход `cancelWish` — плоская цель с `expectedVersion`, а не обёртка `{ target, expectedVersion }`
- **Трек / фаза:** `aggregate-meta_20261029`, Ф3 (`cancelWish` с ожидаемой версией, D-57)
- **Контекст:** вход `cancelWish` был союзом `WishTargetVo` по `kind`. Ожидаемую версию можно добавить обёрткой (`{ target, expectedVersion }`) или полем в каждый вариант союза.
- **Решение:** поле в каждом варианте (`v.variant('kind', [{ ...WishCourseTargetVo.entries, expectedVersion }, { ...WishModuleTargetVo.entries, expectedVersion }])`): вызывающие (бот передаёт только цель) не меняются, `WishTargetVo` остаётся общим для других UC.
- **Пересмотреть:** если ожидаемая версия понадобится ещё нескольким UC с целью желания — вынести схему «цель + версия» в `wish.state.ts`.

### TR-32: шаг `fetch` (D-58) — задан `F` без `fetch` тип не ловит; склейка `L & F` поверхностная
- **Трек / фаза:** `app-assembly`, Ф1 (ревью reviewer)
- **Контекст:** reviewer: (1) UC, задавший пятый параметр `F`, но не переопределивший `fetch`, компилируется — поля `F` в контексте правил и `execute` будут `undefined`; закрыть типом можно только условными типами в сигнатуре базы (`fetch` абстрактный при `F ≠ unknown`); (2) `merge` — `Object.assign`: общее поле `L` и `F` молча берётся из `fetch`; (3) API-07 не ловит `load` полем-стрелкой и вызов через приватный хелпер из `load`.
- **Решение:** (1) принято как цена простых типов, ловит тест UC — описано в D-58 и гайде `use-case` §3, §7; (2) принято — контексты являются записями, ловушка в гайде §7, JSDoc `merge`; (3) стрелку уже запрещает гайд (§7, шаги — методами), хелпер — review (API-07 «lint + review»). `this.call<T>` и многоаргументные вызовы закрыты шаблоном и фикстурами (dmg-core `c8d0e93`). Подключение API-07 в корневом `biome.json` (`modules/*/src/**/*.uc.ts`) — правка оркестратора, не автора среза; карта ARC-07/LintMap сводится в Ф3.
- **Пересмотреть:** если UC с `fetch` станет много и ошибка (1) повторится — абстрактный `fetch` при заданном `F`.

### TR-33: корень сборки — `@u7-scl/app`, legacy-ядро — в `@u7-scl/app-legacy`
- **Трек / фаза:** `app-assembly`, Ф2 (разбор, решение Нурболата)
- **Контекст:** legacy-часть `@u7-scl/app` (`domain/`, `infra/logger`) импортируют `domain/` и все `modules/*`, поэтому корень сборки в этом пакете дал бы цикл пакетов (D-53). `create-api-app.ts` раннера собирает и legacy-, и DMG-модули. В DMG-модуле `user` нет `getUser`.
- **Решение:** legacy-содержимое переезжает в `@u7-scl/app-legacy` (`platform/app-legacy`), `@u7-scl/app` становится корнем сборки всего приложения (legacy и DMG, класс `U7App` по `AppEnv`). Резолвер `Caller` — над legacy `userFacade` (мост TR-11). Разбор — `conductor/archive/app-assembly_20261029/summary.md`.
- **Пересмотреть:** при переводе `user` на DMG резолвер идёт через `ApiApp.dispatch` (`getUser`), как в учебном приложении; `@u7-scl/app-legacy` удаляется вместе с последним legacy-модулем.

### TR-34: решения по ревью Ф2 `app-assembly` (корень сборки)
- **Трек / фаза:** `app-assembly`, Ф2
- **Контекст:** reviewer: резолвер `Caller` над legacy-фасадом без `SystemCaller` (D-51); лишнее чтение пользователя в `dispatchUc`; плоские копии фикстур e2e не обновляются после записей.
- **Решение:** (1) `SystemCaller` не вводится — legacy-фасад `Caller` не принимает и в лог операций не пишет; при переводе `user` на DMG — по TR-33 «Пересмотреть»; (2) чтение пользователя на вызов принято — цена одного пути построения `Caller` (D-50); (3) плоские копии фикстур читает только `fixture-loader.test` (начальное состояние) — принято. (4) CLI и `call-uc` собираются как бот — все UC и реакции (Нурболат, 2026-10-29: одна сборка на все входы, D-50); риск записи — в шапке `call-uc.ts`.
- **Пересмотреть:** (2) — если чтение станет заметным по времени ответа бота; (3) — если новый тест прочтёт плоскую копию после записи.

### TR-35: нарушения ARC-07/08 при включении `root` и `runners` у `DomainArch`
- **Трек / фаза:** `app-assembly`, Ф3
- **Контекст:** `AssemblyChecker` с корнем `platform/app/src` и раннерами `runners/*/src` дал 8 нарушений: `U7App` — `@u7-scl/wish/{infra,wish}` мимо `index.ts`; резолвер `Caller` — `User` из `@u7-scl/domain/user` мимо контракта; тест `u7-app.test.ts` строит legacy-агрегаты (`StreamAr`, `QuestionnaireFactory`, `ContentSnapshot`) из домена внешних модулей; stories бота — `WishEvents` из barrel `@u7-scl/wish/domain` (DEBT-23).
- **Решение:** (1) вход `@u7-scl/wish` — фабрика, репозиторий и тип порта `WishRepo`, как у учебного `todo`; `U7App` берёт их оттуда (часть задачи «ARC-07 корневого `biome.json`» сделана здесь — иначе `arch:check` красный между коммитами); (2) контракт `user` экспортирует тип `User` — его уже возвращает `UserFacade` из контракта, субъект резолвера — legacy-сущность (TR-33); (3) тест сосуществования — в `platform/app/tests/` (код слоя — `src`, тесты вне него не проверяются, как `runners/u7-bot/tests`); (4) stories бота — `WishEvents` из `@u7-scl/domain/wish/contract`. Список раннеров `DomainArch` — каталоги `runners/*`, новый раннер попадает под ARC-08 сам. (5) ARC-07 в корневом `biome.json` — блок `platform/app/src/**`: домен — только `@u7-scl/domain/<m>/contract`, прикладной пакет модуля на DMG — только вход (`@u7-scl/wish/**` запрещён); подпути пакетов внешних модулей разрешены — корень собирает и legacy (TR-33). В пакете ARC-07 только в `arch:check`; lint в корне — ранний сигнал в редакторе.
- **Ревью Ф3 (reviewer, без `error`):** (6) маска ARC-07 по домену разрешает `@u7-scl/domain/shared` (D-53); (7) `checkModuleImports` берёт пакеты корня и раннеров из `package.json` (`assemblyPackages`: `platform/app`, `runners/*`) — новый раннер попадает под ARC-06 сам; (8) `config.test.ts` — тест на литеральный `env`; (9) `IMPORT_RE` без `require()` и тесты корня вне ARC-07 (п. 3) — приняты.
- **Пересмотреть:** (5) — трек перевода модуля на Def добавляет `@u7-scl/<m>/**` в группу ARC-07 блока `platform/app/src/**` (шаг старта — `migration.md` §6); (2) — при переводе `user` на DMG (субъект — из `UserModuleDef`, entity из контракта уходит); (3) — если тесту корня понадобится проверка ARC-07 (сейчас тесты корня и раннеров вне правила).

### TR-36: охват ARC-09 в корне
- **Трек / фаза:** `app-assembly`, Ф3
- **Контекст:** по D-52 ARC-09 — на все `src`, кроме точек входа раннеров; в корне плагин стоял только на `domain/**`. Расширение дало одно место: `runners/u7-bot/src/config.ts` (`loadConfig` читал `process.env`).
- **Решение:** (1) плагин `arc-09-no-env.grit` — на `domain/**`, `platform/*/src/**`, `modules/*/src/**`, `runners/*/src/**`, кроме `runners/*/src/main.ts` и тестов; фикстуры на каждую область и на `main.ts`; (2) `loadConfig(env)` принимает окружение данными, `main.ts` передаёт `process.env`; тест `config.test.ts` — те же сценарии, вызов `loadConfig(process.env)`; (3) `authoring/*` и `scripts/` — вне правила: отдельные CLI-утилиты, не слои приложения, их файлы сами — точки входа.
- **Пересмотреть:** (3) — если утилита `authoring` станет частью приложения (раннер или модуль).

### TR-37: строгий разбор записей `peer-review`
- **Трек / фаза:** `peer-review-dmg`, Ф0 (решение поручено orchestrator'у Нурболатом)
- **Контекст:** legacy `JsonFileRepo` пропускает невалидную запись и копирует её в `backups/*.invalid.*`; репозиторий DMG по образцу `wish` (`v.parse`) бросает и не читает файл. Мягкий пропуск в DMG опасен: `write` переписывает файл целиком и затирает пропущенное.
- **Решение:** строгий разбор, как TR-2 у `wish`: невалидная запись → исключение, файл не читается и не перезаписывается. На проде (2026-10-29, только чтение): 65 кампаний и 24 рецензии, даты — ISO-строки, каталога `backups/*.invalid` нет, то есть невалидных записей не было.
- **Пересмотреть:** если строгий разбор остановит модуль на проде — нужен ли режим «карантин» в `VersionedRepository` пакета (общий вопрос для всех модулей).

### TR-38: red-тесты `review-campaign` до реализации и допущения `test-designer`
- **Трек / фаза:** `peer-review-dmg`, Ф1
- **Контекст:** `test-designer` пишет red-тесты до автора; отдельный red-коммит оставляет в истории красный `check` (ломает `bisect`), коммит на фазу слишком крупный для передачи и ревью. Бриф не фиксировал ошибку инвариантов адресации в `create` и поведение `onlyLives`.
- **Решение:** (1) коммит = пара «red-тесты шага + реализация автора», `check` зелёный (Нурболат, 2026-10-29). `test-designer` вызывается один раз на срез; тесты следующих шагов лежат незакоммиченными, пока их не закроет свой автор. При передаче посреди фазы — `wip` по протоколу «Остановка». Задача `test-designer` в плане получает SHA последнего коммита, где закрыта его часть; (2) инварианты адресации (`a-root.ts:57-80`) → `PEER_REVIEW_INVALID_PARTICIPANTS`, kind `validation`; (3) `get-my-campaigns` возвращает только живые кампании и без `onlyLives`: legacy `findActive*` уже отсекает истёкшие, поведение `v0.2.6` сохраняется. (4) граница окна: тесты проверяют разбор legacy-ISO без зоны как UTC (`Date.UTC`) — от зоны процесса не зависят. Прогон с `TZ=Asia/Oral` (`test:tz`) введён и снят по решению Нурболата (2026-10-29): прод и хранение в UTC, новые записи — числа, зона пользователя — вопрос вывода (DEBT-43). (5) `peer-review.module.test.ts`: обвязка `testAppContext` заменена на `MemoryBus` + `InProcOutbox` (шина тестового контекста не доставляет события подписчикам), проверки не менялись; `scripts/arch-check.test.ts` больше не ждёт `external` у `peer-review`. (6) `CampaignNotFoundUcError` и три legacy-ошибки окна остаются в `domain/peer-review/errors.ts` для моста `create-review-uc` до Ф2. (7) Ревью Ф1: два `minor` (недостижимый `throw` в `get-campaign-recipients`, проверка числа записей после resave) исправлены; `throw` при дубле пары в `write` репозитория оставлен — инвариант хранилища, штатный отказ даёт `ReviewCampaignRules.unique`.
- **Пересмотреть:** (1) — перенести правило в `workflow.md` (по итогам пилота `test-designer`, Ф4); (3) — закрыто: `onlyLives` удалён из входа (трек `tst-cleanup`, 2026-11-06).

### TR-39: тактические решения среза `review` (`peer-review`)
- **Трек / фаза:** `peer-review-dmg`, Ф2 (бриф `slices/review.md`)
- **Контекст:** перенос 5 UC рецензий и ER уведомления на DMG. Стратегические вопросы (место уведомления по D-41, код отказа, доступ к читающим UC) решил Нурболат; остальное — orchestrator.
- **Решение:** (1) строгий разбор `reviews.json` — как TR-37; (2) читающие UC (`list-scope-reviews` и др.) — `allowAll`, как в legacy: отзывы доступны всем, решение Нурболата. Списочные UC получают необязательный `ReviewFilter` (`direction`, `recipientId`, `campaignId`), фильтрует репозиторий; (3) событие `review.created` → `peer-review.review.created` (MAN-08), ошибки — группа `REVIEW_*`, `REVIEW_DUPLICATE` и `NOT_PARTICIPANT` не объявляются; (4) `PeerReviewApiModule` — пустая оболочка до Ф3; (5) дата отзыва в UI форматируется по UTC, как сейчас; (6) `peer-review-question-pool` не трогаем — потребителей нет. (7) Ревью Ф2: `create-review` пишет время из `load` (одно `at` для окна и записи); `view-stream` — и отказ, и исключение `dispatchUc` ⇒ `false`; `as unknown as ReviewRepo` в двух UC-тестах фильтров оставлен (узкий мок метода). (8) Файл `reviews.json` конвертируется лениво при первой записи; откат кода после неё — только с восстановлением файла из бэкапа (R1 data-keeper).
- **Пересмотреть:** (2) — нужна ли пагинация списков; (5) — вывод в UTC+5 вместе с DEBT-43; (6) — удалить пул или найти ему потребителя.

### TR-40: роль `MENTOR` в Policy `stream` через `Role` контракта `user`
- **Трек / фаза:** `stream-dmg`, Ф0 (решение Нурболата, 2026-11-03)
- **Контекст:** Policy `stream` проверяет права ментора, а `user` не переведён на Def: у субъекта `Caller` нет API `UserAr`.
- **Решение:** субъект `Caller` — legacy-entity `User` с `roles`; контракт `domain/src/user/contract.ts` дополнительно экспортирует `Role`; Policy `stream` проверяет `subject.roles.includes(Role.MENTOR)`. Расширять контракт `user` дальше — только если это меньше движений; небольшой долг предпочтительнее выхода за пределы модуля `stream`.
- **Пересмотреть:** при переводе `user` на Def — проверки переходят на API `UserAr` (`isMentor()`, `isAdmin()`), экспорт `Role` из контракта снимается. Передано треку `user` вместе с DEBT-48 (`stream-dmg`, Ф4).

### TR-41: решения брифа среза `stream` (`stream-dmg`)
- **Трек / фаза:** `stream-dmg`, Ф0 (бриф `slices/stream.md`; С1–С4 — Нурболат, 2026-11-03, по рекомендациям; Т1–Т13 — orchestrator)
- **Контекст:** перевод агрегата потока на Def; студент переводится в Ф2, а `activate`, `complete` и «состав потока» читают студентов.
- **Решение:** (С1) выход потока без `enrollmentKey`, с `requiresEnrollmentKey`; ключ проверяет только `enroll` (Ф2). (С2) активация студентов при запуске — DCS в одном UoW `activateStream` (форма — бриф Ф2). (С3) вход `createStream` без `mentorId`/`schoolId`: ментор — субъект, школа — deps. (С4) мост к legacy-студентам — порт `StreamStudents` над legacy `StudentRepo` (DEBT-47, снятие — Ф2); вызовы `get-stream` в `learning/*`, `inactivity`, `monitor` переводятся в Ф1, их студенческая логика — Ф2. (Т1) legacy `StreamAr`/`StreamPolicy` → `LegacyStreamAr`/`LegacyStreamPolicy` до Ф2. (Т3) `launch` — в `execute` после `uow.register` (D-41, вариант 1), повтор безопасен. (Т4) `external` у `StreamModuleDef` — до Ф3. (Т5) legacy потока удаляется в Ф1; `list-stream-students` и legacy `StreamJsonRepo` — до Ф2. (Т6) `getStreamMembers` + `studentId`, `inProgress`, `callers` + `user`, `guest`, без фильтра `status`. (Т7) `canManage` в ответе `getStream`. (Т8) `findStreamByTelegramGroup` — первое совпадение. (Т9) `v.description` в `ContentSnapshot`, `v.uuid` не меняется. (Т10) DEBT-35 — DCS + вопрос Ar, повтор `invite` — `WISH_ALREADY_INVITED`. (Т11) даты в выходе — числа, `formatDate` получает ISO из story. (Т12) тест репозитория — `mkdtemp` (`data/fixtures` нет в git). (Т13) снят: остатка TR-8 нет после пересмотра D-60. (Т14) тексты отказов: `label` в `ErrorDef` статичен. `STREAM_STUDENTS_IN_PROGRESS` — «Нельзя завершить поток: есть студенты без исхода. Сначала укажите исход для каждого.»; story завершения ветвится по коду и показывает прежний текст с числом из `pending.length`. `STREAM_NOT_ENROLLING`/`STREAM_NOT_ACTIVE` — «Недопустимый переход статуса. Поток не может быть запущен.» / «… завершён.» без сырого статуса (кнопки и так скрыты по статусу). (Т15) отклонения migrator в домене: `commands/list-stream-students-cmd.ts` и legacy `stream/repo.ts` остаются до Ф2 (нужны legacy-студенту); `v.trim()` снят с заголовков `ContentSnapshot` (`toJsonSchema` не поддерживает), trim `title`/`description` в state — через `v.transform`. (Т16) прикладной слой: legacy `StreamJsonRepo` → `LegacyStreamJsonRepo` (имя занял новый репозиторий; только чтение для legacy-студента до Ф2); субъект UC потока — `StreamUser = Pick<User, 'uuid' | 'roles'>`, у `getStreamMembers`/`getStreamPresence` — `Identified` (`callers` с `system`); DEBT-35 закрыт доменной частью, код ER `invite-wishers` не менялся. (Т17) кодовое слово (С1): ключа в ответе потока нет, UI спрашивает слово при `requiresEnrollmentKey` и передаёт его в legacy `enroll-student`; лимит 3 попытки сохраняется — неверное слово story распознаёт по тексту legacy-отказа «Неверное кодовое слово» (у `throwBadRequest` нет своего кода). Stories: «несуществующий поток» — `ucErrorNotify` (`notify`, а не `screen`); `dispatchUcAsGuest` для обработчиков событий без актора.
- **Пересмотреть:** (С4, Т1, Т5, Т15, Т16); (Т17) — в Ф2: распознавание по коду ошибки `enroll` на Def вместо текста — в Ф2 вместе с агрегатом студента; (Т4) — Ф3.


### TR-43: решения брифа среза `student` (`stream-dmg`)
- **Трек / фаза:** `stream-dmg`, Ф2 (бриф `slices/student.md`; С1, С3, С4 — Нурболат, 2026-11-04; С2, Т1–Т14 — orchestrator)
- **Контекст:** перевод агрегата студента на Def; Job на внешнем модуле запрещён `checkDefs` (MAN-06); stories видят только `contract` (D-45, ARC-08).
- **Решение:** (С1) расчёты UI — проекции в выходе query UC (`getStudentProgress`, расширенный `getStreamMembers`), вариант (a) брифа. Нурболат считает допустимым и путь «UI восстанавливает агрегаты из state и зовёт DQS» — сейчас его запрещают D-45/ARC-08, вопрос пересмотра решения пакета — на обсуждение, в Ф2 не применяется. (С2) адрес в `InactivityStory` — legacy `get-user`, как сейчас (отклонение от буквы spec п. 8; Job чисто доменный). (С3) вход `enrollStudent` без `userId`: зачисляется субъект. (С4) `external` и legacy-домен `stream` снимаются в Ф2; до Ф3 — оболочка (Т1). (Т1–Т14) — по рекомендациям брифа, раздел «Открытые вопросы».
- **Пересмотреть:** (С1) — решение по D-45; (С2) — перевод `user` на Def; (Т1) — Ф3.

### TR-44: замечания ревью среза `student` (`stream-dmg`, Ф2)
- **Трек / фаза:** `stream-dmg`, Ф2 (orchestrator, 2026-11-04; ревью — `slices/student.md`, «Отчёт ревью Ф2»)
- **Контекст:** срез влит из ветки A A/B-теста исполнителей; ревью: 1 error, 7 warn.
- **Решение:** `runJob` в `ApiApp` (`platform/core`) и в `tests/helpers/test-app.ts` принят — нужен e2e Job через `runJob`; скрипты `update-stream-snapshot`/`stream-snapshot-sync` импортируют `Student`/`StepRecord` через barrel `@u7-scl/stream/domain` (DEBT-3) — в контракте этих типов нет, контракт не расширяется; остальные замечания — к правке (таблица брифа).
- **Повторное ревью правок (8.5/10, без `error`):** `GetStudentProgressUc` считает отставание по всему составу потока — список монитора (`shared/student-rows.ts`) делает ≈2N+1 полных разборов `students.json` вместо N+1 (`StudentJsonRepo` без кэша); при десятках студентов терпимо, не правится. `view-stream-mentor.ts` (`STUDENTS_IN_PROGRESS`) оставлен на `as`: `ErrorDef.restore` строго валидирует схему, а story-тест мокает payload с не-uuid `userId`. Критерий приёмки Ф2 `grep "Role.STUDENT…"` относится к прод-коду: в тестах Policy потока и студента `Role.STUDENT` остаётся как роль, не дающая прав (роль ещё есть в `user`).
- **Пересмотреть:** Ф3 — скрипты на типы контракта или репозиторий DMG, barrel удаляется; чтение файла один раз на UoW в `StudentJsonRepo` или пакетный запрос прогресса по потоку (тогда `lagById` в `loadStudentRows` не нужен); `restore` в `view-stream-mentor` вместе с правкой мока.

### TR-45: границы среза сборки `stream` (`stream-dmg`, Ф3)
- **Трек / фаза:** `stream-dmg`, Ф3 (orchestrator, 2026-11-04; бриф — `slices/assembly.md`)
- **Контекст:** критерий плана Ф3 `grep "…|StreamJsonRepo"` написан до Ф1: `StreamJsonRepo`/`StudentJsonRepo` в `modules/stream/src/infra/` — новые репозитории (UoW, `VersionedRepository`), а не legacy. `StreamFacade`, `StreamInProcFacade`, `streamLegacyInbound`, `commands/*-cmd.ts`, `stream-uc.ts` удалены ещё в Ф1–Ф2; `external` у `StreamModuleDef` уже нет.
- **Решение:** `StreamJsonRepo` из критерия исключён; бриф сам, без `tech-lead` (срез по образцу `peer-review`); задачи 2–4 плана — один шаг `migrator`; legacy-entity потока и студента удаляются, если после перевода миров и скриптов потребителей не осталось (удалены). Ревью: `update-stream-snapshot.ts` правит `contentSnapshot` в `streams.json` сырым JSON, без `version`/`updatedAt` — оставлено (репозиторий читает, бриф не требовал); `students.json` пишется через строгий разбор `StudentArDef.state`, при сбое разбора — отказ до записи; справка — бэкап и запуск при остановленном боте (гонка перезаписи).
- **Пересмотреть:** `update-stream-snapshot.ts` — запись потока и студентов через репозитории Def и UoW (снимает гонку с ботом и обход `version`).

### TR-46: контракт событий и входа `questionnaire` (`questionnaire-dmg`)
- **Трек / фаза:** `questionnaire-dmg`, Ф0 (Q1–Q3, Q5 — Нурболат, 2026-11-04)
- **Контекст:** legacy публикует 10 событий `questionnaire:*` с `telegramId` и `response`; во входе и событиях — поле `owner`, в state — `ownerInfo`; likert-вариант без production-вызывающих.
- **Решение:** (Q1) 6 Def-событий: `started`, `invited`, `completed`, `abandoned` (`reason`: `timeout` / `by_user` / `declined` — `decline` сливается с `abandoned`), `abandonWarning`, `continueInvite`; likert — поле `kind` в payload, `completed` likert несёт `likertScores`. (Q2) имя `ownerInfo` во всех слоях: state (формат на диске не меняется), события, вход `StartQuestionnaireUcDef`; клиенты `wish` (`create-course-wish`, ER `confirm-wish`/`abandon-wish`) переходят на `ownerInfo`, собственное поле `wish` (`questionnaire.owner` в его state) не трогается. (Q3) события без `telegramId` и `response` — D-63; Job `sweep-abandoned-questionnaires` доменный. (Q5) likert переносится (нужен будущим анкетам кампаний peer-review).
- **Пересмотреть:** использование likert в кампаниях peer-review (техдолг peer-review).

### TR-47: тактические решения Ф0 `questionnaire-dmg`
- **Трек / фаза:** `questionnaire-dmg`, Ф0 (orchestrator, 2026-11-04)
- **Контекст:** два варианта анкеты (standard, likert) в одном файле `questionnaires.json`; бот читает анкеты через `appApi.execute`; фикстура `data/fixtures/questionnaires` пуста.
- **Решение:** (Т1) один `QuestionnaireArDef`, state — `v.variant('kind')`; если `AggregateDef` не поддерживает variant-state — правка `dmg-core` отдельным коммитом. (Т2) `get-questionnaire`, `get-current`, `get-questionnaires-by-user` — query-UC, бот вызывает через `dispatch`. (Т3) мёртвый `questionnaires/responses.json` в `materializer.ts` тестовых миров удаляется в Ф3. (Т4) `dmg-data-keeper` проверяет совместимость на собственных фикстурах (ISO и число, оба `kind`, `warnedAt`, `abandonReason`).
- **Пересмотреть:** (Т1) — если variant-state потребовал правки пакета, проверить её на учебном модуле `dmg-core`.

### TR-48: решения брифа среза `questionnaire` (`questionnaire-dmg`)
- **Трек / фаза:** `questionnaire-dmg`, Ф0 (бриф `slices/questionnaire.md`; С1, С2, Т1 — Нурболат, 2026-11-04, по рекомендациям; Т2–Т20 — orchestrator)
- **Контекст:** Job на внешнем модуле запрещён `checkDefs` (MAN-06); `GetTelegramAddressesUcDef` доступен только `system`, story вызывает UC как `user`/`guest`; `Aggregate.change` всегда ставит `updatedAt: at`, а пометки простоя не должны сдвигать таймер.
- **Решение:** (С1) `external` и legacy-реализация анкет (`QuestionnaireApiModule`, фасад, inbound, legacy-репозиторий в `U7App`) снимаются в Ф1; Ф3 — ARC-07 `biome.json`, скрипты, миры, `test-app`, удаление оболочки Т15. (С2) адрес в stories Ф2 — legacy `get-user`, как `InactivityStory` (TR-43 С2); D-63 действует для событий, Job и ER. (Т1) `markWarned`/`markContinueInvited` вызывают `change(this.state.updatedAt, …)`: растёт только `version`; тест «не сдвигает `updatedAt`» обязателен. (Т2–Т20) — по рекомендациям брифа, раздел «Открытые вопросы».
- **Пересмотреть:** (С2) — перевод `user` на Def; (Т1) — если платформа добавит проверку монотонности `at` или опцию «не трогать `updatedAt`»; (Т15, Т16) — Ф3/Ф2.

### TR-49: красная зона и тактика Ф1 `questionnaire-dmg`
- **Трек / фаза:** `questionnaire-dmg`, Ф1 (orchestrator, 2026-11-05)
- **Контекст:** в Ф1 модуль анкет переведён на Def целиком (TR-48 С1), а stories бота до Ф2 остаются на legacy-именах `questionnaire:*` и `appApi.execute`; legacy-UC удалены вместе с `a-root`.
- **Решение:**
  - (1) ~~Красная зона Ф1–Ф2~~ — снята в Ф2 (2026-11-05): 12 e2e `questionnaire-ux`/`wish-questionnaire` зелёные, stories на Def (TR-50).
  - (2) ~~Т16: временные типы legacy-событий~~ — `legacy-events.ts` удалён в Ф2, типы Def-событий — `stories/questionnaire-events.ts`.
  - (3) `AbandonUc` регистрирует агрегат в UoW только при росте версии: идемпотентный `abandon` на `abandoned` (Т3) иначе пишет запись без изменений.
  - (4) Т20: мост `legacyEventBus` оставлен, маршрутов анкет в `inbound` нет; поле `questionnaireFacade` и legacy-модуль анкет из `U7App` удалены, метатип оболочки Т15 удалён в Ф3 вместе с `QuestionnaireApiModuleMeta` (TR-51).
  - (5) Дефекты red-тестов, исправленные по эскалации автора: события не забирались после `createStandard` (Ar глушил `started`); текст отказа доступа — в `payload.denyMessage`, не в `label`; один `requestId` на все команды smoke-теста (D-56).
  - (6) С2 (Нурболат, 2026-11-05): stories Ф2 берут адрес Telegram через legacy `get-user`, как `InactivityStory` (TR-43 С2); `GetTelegramAddressesUcDef` остаётся `system` для Job и ER (D-63).
  - (7) Д1 (Нурболат, 2026-11-05): живой `questionnaires.json` сверен read-only (84 записи, проблемных 0). Новый репозиторий при первой записи переписывает весь файл в числовых датах с `version` — legacy `v0.2.6` его не прочитает: перед выкаткой `bun run backup`, откат — только с восстановлением файла.
- **Пересмотреть:** (6) — перевод `user` на Def; (7) — выкатка после ревизии; (3) — если UoW платформы научится пропускать неизменённые агрегаты (тогда условие убрать); (4) — снято в Ф3 (TR-51).

### TR-50: решения брифа UI Ф2 `questionnaire-dmg`
- **Трек / фаза:** `questionnaire-dmg`, Ф2 (orchestrator, 2026-11-05)
- **Контекст:** stories анкет переводятся на `dispatchUc` и Def-подписки (бриф `conductor/archive/questionnaire-dmg_20261104/slices/ui.md`). В базовой story нет Result-аналога legacy `handleError` (экран «⚠️ …» с «⬅️ Меню»), `ucErrorNotify` добавляет префикс «Ошибка валидации».
- **Решение:**
  - (1) Ветки навигации по кнопкам — экран `ucErrorScreen` (`stories/render.ts`, тексты как у `ucErrorNotify`, «⬅️ Меню»): нажатие на устаревшем сообщении заменяет его объяснением и выходом, а не оставляет мёртвые кнопки (UX, решение orchestrator по поручению Нурболата). Ветки ввода — `ucErrorNotify`; у `CHOICE_EXPECTED`/`EMPTY_ANSWER_CODE` появляется приставка «Ошибка валидации» (видимая правка, Нурболат, 2026-11-05).
  - (2) `invited`: экран приглашения — `GetCurrentUcDef` от профиля респондента; отказ или не-`invited` ответ → fallback «Заполните, пожалуйста, анкету.» без «Зачем» и `warn`.
  - (3) e2e `abandonWarning`/`continueInvite`/`abandoned(timeout)` — публикацией Def-события в шину: часами `createTestApp` не управляет, Job покрыт в Ф1.
  - (4) Тестовый кит stories — реэкспорт `dmgDispatch`/`refuse` из `stream-dmg.test-kit`.
  - (5) Порядок задач Ф2: red (test-designer) → механический перевод остальных тестов (flash) → реализация UI (Sonnet); критерии приёмки плана заменены grep-критериями брифа (многострочные вызовы).
  - (6) Типы Def-событий для stories — `stories/questionnaire-events.ts`, в контракт не реэкспортируются.
  - (7) Общий абстрактный `stories/questionnaire-story.ts` (`QuestionnaireStory.resolveRespondent`) — адрес респондента для двух story; сбой `get-user`, нет профиля, нет `telegramId` различаются в `warn`.
  - (8) Ревью Ф2: `ucErrorScreen` оставлен функцией `render.ts` (Т1), хотя дублирует ветки `ucErrorNotify`; текст validation на экране — без хвоста legacy «Пожалуйста, исправьте…» (тексты как у `ucErrorNotify`, срабатывает лишь при битом `qId`).
  - (9) `dispatchUc` из подписки `invited` (и `InactivityStory`) идёт вне контекста апдейта: штатный `warn` ERR-07 «нет requestId» на каждое событие, корреляции с исходной командой нет.
- **Пересмотреть:** (1), (8) — когда в `U7BotUiStory` появится общий экран отказа по `Result`; (9) — передача correlation из события в `dispatchUc` подписок (платформа бота); (3) — при управлении часами в `createTestApp`; (4) — общий тестовый кит DMG для stories.

### TR-51: границы среза сборки `questionnaire` (`questionnaire-dmg`, Ф3)
- **Трек / фаза:** `questionnaire-dmg`, Ф3 (orchestrator, 2026-11-05; бриф — `conductor/archive/questionnaire-dmg_20261104/slices/assembly.md`)
- **Контекст:** план Ф3 написан до Ф1: `api/*`, `module.ts`, `facade.ts`, фасады, `QuestionnaireUseCase`, legacy-Policy и legacy-репозиторий, поля `questionnaire`/`questionnaireFacade` в `U7App` удалены ещё в Ф1 (С1 TR-48), `external` у `QuestionnaireModuleDef` снят там же. `QuestionnairePolicy` в домене — новая Policy Def. Осталась оболочка метатипов: `domain/src/questionnaire/module.ts`, `commands/*-cmd.ts`, `entity.ts`, `QuestionnaireApiModuleMeta` в `U7BotAppMeta`; `call-uc` вызывает анкеты legacy `execute` — после Ф1 не работает.
- **Решение:** бриф сам, без `tech-lead` (срез по образцу `stream`); задачи 2–4 плана — один шаг `migrator` (flash); критерий «`QuestionnairePolicy` удалён» относится к legacy-классу (удалён в Ф1), Policy Def остаётся; миры — на `QuestionnaireView` из контракта; `call-uc` — анкеты через `dispatch` по образцу `wish`. DEBT-34 в части questionnaire погашен снятием `external` (модуль проверяется через вход `contract`); общий пропуск пар legacy в `domain-check.ts` остаётся до последнего трека — в `debt.md` снимается только упоминание questionnaire.
- **Ревью Ф3:** `modules/questionnaire/package.json` очищен от `./api`, `#*-legacy/*` и неиспользуемых зависимостей (warn вне границ, исправлено orchestrator'ом). `dmg-data-keeper` не вызывался: формат `questionnaires.json` не менялся; миры пишут во временный каталог тестов, `call-uc` пишет анкеты через тот же `QuestionnaireJsonRepo`, что и бот (совместимость — `data-keeper` Ф1). Формулировки DEBT-3 (barrel без внешних потребителей), TR-11 и TR-48 (4) — в Ф4.

### TR-52: состав UC, порядок срезов и красная зона `course-dmg`
- **Трек / фаза:** `course-dmg`, Ф0 (разбор `dmg-tech-lead`, решение Нурболата, 2026-11-05; запись — orchestrator)
- **Контекст:** legacy-модуль `course` несёт query-UC, 9 authoring-команд, `get-course-program`, `resolve-content-path` и методы `CourseInProcFacade`, которые клиенты (`stream`, `wish`) получают через адаптеры TR-11 (DEBT-44). Модели этапов (D-64) и вердикта пререквизита (D-65) — новые.
- **Решение:**
  - (1) Переносятся query-UC: `get-course`, `list-courses`, `get-course-by-module`, `get-module-place`, `get-module`, `list-modules`, `get-lesson`, `get-step`, `get-steps-by-lessons`, `get-module-snapshot`.
  - (2) Шесть внешних UC — `getCourseEnrollment`, `getModuleEnrollment`, `getCoursesIncludingModule`, `getCoursesStartingWithModule`, `getSameModules`, `getModulePrerequisite` — становятся настоящими UC; методы фасада сливаются в них, адаптеры `modules/course/src/course/uc/*` снимаются.
  - (3) Удаляются без вызывающих (вызывают только тесты): 9 authoring-команд (`create-course`, `add-phase-to-course`, `add-module-to-course`, `create-module`, `enrich-module`, `add-project`, `publish-module`, `create-lesson`, `create-step`), `get-course-program` (`CourseProgram`), `resolve-content-path` (с `content-path`). У `CourseAr` мутаций не остаётся: инварианты меток (D-64) проверяет схема state при строгом чтении. Операции автора — трек-кандидат [course-module-history.md](../roadmap/course-module-history.md).
  - (4) Порядок срезов: `module` → `lesson` + `step` + снимок → `course` (программа, этапы, клиент `stream`, данные) → UI → сборка. `course` зависит от `module` и `lesson`. Ф1–Ф2 аддитивны: legacy-UC живут рядом с Def, `check` зелёный.
  - (5) Красная зона Ф3–Ф4: строгий новый формат `courses.json` (Ф3) роняет legacy-UC курса, stories каталога/навигации и их integration/e2e. Список — поимённо в `debt.md` в Ф3, критерий снятия — конец Ф4.
- **Пересмотреть:** (3) — в треке «История модулей курса»; (5) — снять в Ф4.

### TR-53: решения брифов `module` и `lesson-step` (`course-dmg`, Ф0)
- **Трек / фаза:** `course-dmg`, Ф0 (брифы `conductor/tracks/course-dmg_20261105/slices/module.md`, `lesson-step.md`; стратегические — Нурболат, 2026-11-05; тактические — orchestrator по рекомендациям `dmg-tech-lead`)
- **Контекст:** бот читает контент курса без актора, поэтому автор черновиков не видит; `listModules` отдаёт модуль целиком, а потребители (`create-stream`, `list-lessons`, `distribute-lesson`) берут `uuid`, `title`, `status`; legacy-снимок падает на первом невидимом уроке (`getOutLesson`), хотя фильтр задуман; новые имена `ModuleAr`/`ModulePolicy`/`ModuleRepo` совпадают с legacy в `export *`.
- **Решение:**
  - (С1 `module`) после Ф4 (`dispatch` с реальным вызывающим) автор и администратор видят черновые проекты, уроки и шаги; для студента без изменений — принято.
  - (С2 `module`) `listModules` отдаёт `ModuleSummary` (`uuid`, `title`, `description`, `status`, `tags`) — в срезе Ф1.
  - (С1 `lesson-step`) черновые шаги в снимке — как v0.2.6: в `data/courses/steps.json` у 32 опубликованных уроков по одному черновому шагу, их `stepIds` входят в снимок, а `getStep` студенту их не отдаёт (число шагов и прогресс новых потоков завышены). Опубликовать шаги или считать их частью дизайна — решение автора контента; в код это не долг (реестр DEBT — только для кода), счёт проверяет `dmg-data-keeper` в Ф2.
  - (С2 `lesson-step`) снимок пропускает невидимый урок, а не роняет вызов — в срезе Ф2.
  - (Т `module`) Т1–Т13 брифа — по рекомендациям: legacy-классы переименовываются в `Legacy*` шагом S0 до red; субъект `CourseUser = Pick<User,'uuid'|'roles'>` (как TR-40, вызова `user` нет, D-41 не затронут); видимость — UC `allowAll` + правило `canSeeUnpublished` + `ModuleAr.viewFor`, отказ `CoreErrors.ACCESS_DENIED`; `ModuleErrors.NOT_FOUND` рядом с `COURSE_MODULE_NOT_FOUND` до Ф3; вход `{ moduleId }`; `limit` до отбора видимых (как v0.2.6); `CourseModuleDef` с `external` до Ф5 — вместо арх-проверок пар grep-критерии; новый `ModuleJsonRepo.save` над `data/` до Ф5 не вызывается (числовые даты не прочтёт legacy).
  - (Т `lesson-step`) Т1–Т11 брифа — по рекомендациям: снимок — в агрегат `module`, `callers` `['user','guest','system']`; своих Policy у `lesson`/`step` нет; ошибка снимка `COURSE_MODULE_NOT_FOUND` до Ф3; висячие `lessonId`/`stepId` и шаг без модуля в `getStepsByLessons` пропускаются молча (как v0.2.6); `CourseDs` и `content-snapshot.ts` — до Ф5.
  - (Расхождение) маркер DEBT-10 (`#filterPublished` legacy `module/a-root.ts`) уходит в Ф5 вместе с legacy-UC, а не в Ф1: критерий Ф1 относится к Def-файлам.
- **Пересмотреть:** (С1 `lesson-step`) — при правке данных автором контента или в треке «История модулей курса»; TR-40 — добавлен `course`; (Т11 `module`) — снять в Ф5; висячие ссылки — в треке «История модулей курса».

### TR-54: итоги среза `module` (`course-dmg`, Ф1)
- **Трек / фаза:** `course-dmg`, Ф1 (бриф `conductor/tracks/course-dmg_20261105/slices/module.md`, отчёты авторов и `dmg-reviewer`; orchestrator)
- **Контекст:** GritQL `dom-11-base-fields.grit` ловит любой ключ `uuid:` в `*.state.ts`, включая `uuid: F.uuid(…)` вложенного проекта; legacy `JsonFileRepo.readAll` на невалидной записи не падает, а отбрасывает её (`safeParse` + автобэкап); ревью Ф1 — без `error`, 8 `warn`.
- **Решение:**
  - проект модуля — вложенная сущность `ProjectEntity` в `module.state.ts` (Нурболат, 2026-11-05): у проекта есть идентичность (`uuid`, на него ссылаются снимок и бот), номера вместо `uuid` отклонены — сменили бы формат `modules.json` и контракт снимка. DOM-11 в `dmg-core` сужен (`15a74a6`): `uuid: F.uuid(…)` вложенной сущности разрешён; суффикс `Entity` — в `naming.md` пакета;
  - (Т11, уточнено `dmg-data-keeper`) первый `save` нового `ModuleJsonRepo` над `data/courses/modules.json` при живом legacy делает чтение legacy пустым, а следующий legacy `save` опустошает файл: запрет записи до Ф5 обязателен, перед первым `save` — `backup:adhoc`;
  - `listModules` проверяет видимость через `viewFor(...) !== undefined` (строит view ради флага) — форма, не поведение; оставлено;
  - smoke `getModule`/`listModules` через собранный `U7App` — не в Ф1 (потребителей нет), к Ф4;
  - остальные `warn` ревью (дублирование хелперов, лишний generic view, `ModuleSummary` в контракте, payload отказа из `Decision`, CODE-04, TST-04, экспорт порта) — исправлены в срезе.
- **Пересмотреть:** Т11 — снять в Ф5.

### TR-55: итоги среза `lesson` + `step` + снимок (`course-dmg`, Ф2)
- **Трек / фаза:** `course-dmg`, Ф2 (бриф `conductor/tracks/course-dmg_20261105/slices/lesson-step.md`, отчёты авторов, `dmg-data-keeper` и `dmg-reviewer`; orchestrator)
- **Контекст:** ревью — без `error`, 5 `warn`; данные совместимы на чтение (снимки 4 модулей и `getStepsByLessons` совпали с legacy побайтово), запись новыми репозиториями при живом legacy делает `lessons.json`/`steps.json` нечитаемыми для legacy.
- **Решение:**
  - исправлены в срезе: ссылки на фазы/вопросы в комментариях (CODE-04), копии массивов из `outline()`/`publishedOutline()` (DOM-17), вопрос `LessonAr.stepIds()` для `getStepsByLessons` вместо `outline()`, проверка доступа снимка до чтения уроков, мёртвая ветка в группировке шагов;
  - отбор и группировка шагов `getStepsByLessons` (API-01, `warn`) — в `LessonStepsDqs` (Нурболат, 2026-11-05): порядок по уроку, пропуск висячих ссылок и пустых уроков — правила чтения над несколькими Ar, а не оркестрация; UC вычисляет решения Policy по модулям и передаёт их картой. Довод «потребитель один» отклонён: DQS — место правил чтения, а не только переиспользования (так же устроен `ModuleSnapshotDqs`);
  - `LessonView`/`StepView` объявляют `version` обязательным своей схемой (`v.nonOptional` не переводится в JSON Schema, MAN-03); `ModuleView` — пока с необязательной версией, выровнять в срезе `course` (Ф3);
  - `FileVo` строже legacy `FileMetadataSchema` (`size` целое, `mimeType` обрезается) — шагов `kind: file` в данных 0, принято;
  - паспорт `CourseModuleDef` в тесте сверяется без учёта порядка — порядок не часть контракта;
  - `StepsByLesson`: в `index.ts` — legacy-тип, в `contract.ts` — новый (одно имя) — снимается с legacy в Ф5;
  - запрет `save` новых `LessonJsonRepo`/`StepJsonRepo` над `data/` до Ф5 — как Т11 (TR-53, TR-54);
  - наблюдение к Ф4: DMG-вызов пишет в `data/oplog` ~9 КБ на снимок и ~18 КБ на `getStepsByLessons` — при вызове на каждый рендер навигации учесть рост лога;
  - DEBT-44, «Место»: адаптер `get-module-snapshot` снят.
- **Пересмотреть:** `ModuleView.version` — Ф3; запрет записи — Ф5; CODE-04 (ссылки на фазы в комментариях) повторяется от Ф1 — кандидат в машинную проверку.

### TR-56: решения брифа среза `course` (`course-dmg`, Ф3)
- **Трек / фаза:** `course-dmg`, Ф3 (бриф `conductor/tracks/course-dmg_20261105/slices/course.md`; стратегические — Нурболат, 2026-11-05; тактические — orchestrator по рекомендациям `dmg-tech-lead`)
- **Контекст:** legacy `get-course`/`get-course-by-module` отдают курс любого статуса любому вызывающему; «курс модуля» в трёх UC выбирается по трём правилам, `getCoursesStartingWithModule` привязан к месту модуля в одном курсе; строгий новый формат `courses.json` роняет legacy-чтение; инвариант меток с `v.check` не проходит `toJsonSchema` state.
- **Решение:**
  - (С1) видимость курсов — как v0.2.6, без Policy (`allowAll`); правило «неопубликованное видят автор и администратор» — в треке-кандидате [course-module-history.md](../roadmap/course-module-history.md) вместе с архивацией;
  - (С2) правило «курс модуля» — как v0.2.6, собрано в одном `ModuleCoursesDqs`, фикстурные случаи с общим модулем закреплены тестами; единое правило и `getCoursesStartingWithModule` по кандидату — долг, запись `DEBT-<n>` с Местом `ModuleCoursesDqs` заводится вместе с кодом;
  - (С3) мост чтения legacy → новый формат не делается: красная зона поимённо в `debt.md`, снимается в конце Ф4;
  - (Т1–Т18) брифа — по рекомендациям, в том числе: S0 `Legacy*` для `CourseAr`/`CoursePolicy`/`CourseRepo`/`CourseJsonRepo`; вопросы одного курса — методы `CourseAr`, DQS — `ModuleCoursesDqs`, `ModulePrerequisiteDqs`; инвариант программы и меток — схема вне `state` + `v.parse` в конструкторе (прецедент `ReviewCampaignAr`), `dmg-core` не правится; единая ошибка `ModuleErrors.NOT_FOUND` (снятие `CourseErrors.MODULE_NOT_FOUND`); `passedModuleIds` — `PassedModulesDqs` в `stream`; legacy-deps (`CourseLegacy`, `U7LegacyFacades.course`) убираются в Ф3, а не Ф5; authoring-UC, `get-course-program`, `resolve-content-path`, `which-courses-include-module` — до Ф5; перевод `courses.json` — одноразовым скриптом вне репозитория.
  - (Данные) после коммита переведённого `courses.json` legacy-чтение молча теряет записи и пишет `data/courses/backups/`: legacy-UC курса над `data/` не запускать до Ф5.
- **Пересмотреть:** (С1) — в треке «История модулей курса»; (С2) — там же; (С3) — снять с красной зоной в Ф4.

### TR-57: красная зона Ф3–Ф4 `course-dmg`
- **Трек / фаза:** `course-dmg`, Ф3 (orchestrator, 2026-11-05; TR-52 (5), TR-56 С3)
- **Контекст:** сборка читает `courses.json` новым строгим `CourseJsonRepo` (`moduleIds` + `phases[].fromModuleId`), тестовые миры переведены на новый формат; stories каталога и навигации бота до Ф4 зовут legacy-UC курса (`list-courses`, `get-course`, `get-module-place` через `LegacyCourseJsonRepo`), а legacy-схема записи нового формата молча пропускает — курсов «нет». Мост чтения не делается (С3).
- **Решение:**
  - (1) Красная зона — 29 тестов в 8 файлах `runners/u7-bot/tests` (прогон `CI=true bun test`, 4903 pass / 29 fail):
    - `courses/course-catalog.integration.test.ts` — 1 (`list: курсы + этапы inline`);
    - `courses/wish-flow.integration.test.ts` — 2 (`cancel…`, `опасное название…`; курс строят legacy-команды в старом формате — падает строгое чтение нового `CourseJsonRepo`);
    - `e2e/curious-showcase.e2e.test.ts` — 9 (drill-down каталога);
    - `e2e/pagination.e2e.test.ts` — 2 (каталог: «Полный трек»);
    - `e2e/questionnaire-ux.e2e.test.ts` — 5 и `e2e/wish-questionnaire.e2e.test.ts` — 6 (нет кнопки «Хочу пройти курс» — пустой каталог);
    - `e2e/student-dmg.e2e.test.ts` — 2 и `e2e/user-notify.e2e.test.ts` — 2 («Курс завершён» / «записаться на следующий» — legacy `get-module-place` пуст).
  - (2) Гейт Ф3 — `check` зелёный, кроме списка (1); новых красных вне списка нет.
  - (3) legacy-UC курса над `data/` не запускать до Ф5: после коммита переведённого `courses.json` legacy-чтение теряет записи и пишет `data/courses/backups/` (TR-56).
  - (4) ~~`computeSourceHash` не учитывал вложенные поля определения мира~~ — исправлено после контрольной точки Ф3 (решение orchestrator по поручению Нурболата): ключи сортируются на каждом уровне. Остаётся: хеш — от определения, а не от кода сборки мира — правка `builder.ts` без правки определения кеш не сбрасывает (очистка `.cache/worlds` вручную или `force`).
- **Пересмотреть:** ~~(1)–(2)~~ — сняты в Ф4 (stories на `dispatchUc`, `check` зелёный, TR-59); (3) — Ф5; (4) — при следующей правке сборки миров.

### TR-58: итоги ревью среза `course` (`course-dmg`, Ф3)
- **Трек / фаза:** `course-dmg`, Ф3 (отчёт `dmg-reviewer`; orchestrator, автономно)
- **Контекст:** ревью — без `error`, 4 `warn` (правило «стартовый модуль» в UC мимо `ModuleCoursesDqs`; решение по статусу в `get-course-enrollment`; нет записи долга С2; CODE-04 — ссылки на ID брифа и фазы в комментариях), 8 `info`, 5 кандидатов в чистку тестов.
- **Решение:**
  - все `warn` и `info` по коду исправлены в срезе (шаг `cd-F3-fix`): проверка стартового модуля — метод `ModuleCoursesDqs`, «стартовый модуль для записи» — вопрос `CourseAr`, вердикт пререквизита считается в `execute`, связь записи с потоком — методом Ar, форма этапа — из схемы;
  - строгое чтение `courses.json`: инвариант программы проверяется для всех записей файла — нарушение у любой записи роняет чтение всего файла, как неверное поле (единое правило «файл читается целиком или никак»);
  - долг С2 — DEBT-50;
  - дубли тестов (UC ↔ DQS/Ar) почищены в срезе (TST-08), журнал — `conductor/roadmap/test-bloat.md`;
  - не сделано: общая схема `versionOut` для четырёх Ar `course` — форма, не поведение; к сборке (Ф5) или треку чистки; экспорт `CourseProgramInvariant` для тестовых миров — разрешён брифом.
- **Пересмотреть:** CODE-04 (ссылки на фазы и ID брифа в комментариях) повторяется с Ф1 — кандидат в машинную проверку; `versionOut` — Ф5.

### TR-59: UI курса по этапам и судьба тестов бота (`course-dmg`, Ф4)
- **Трек / фаза:** `course-dmg`, Ф4 (бриф `slices/ui.md`; решения Нурболата 2026-11-11 и orchestrator)
- **Контекст:** модель допускает курс без этапов, с одним и с несколькими; бот v0.2.6 всегда показывал уровень «этапы». Три integration-теста бота проверяют удалённые UC или дублируют тесты модуля.
- **Решение:**
  - без этапов — карточка курса сразу показывает модули (`Модули курса:`), в крошках этапа нет (Нурболат);
  - один этап — карточка курса сразу показывает модули этапа, этап виден в крошках и подзаголовке (`Этап 1/1: {заголовок}` › `Модули этапа:`); с уровня модуля «⬅️ Назад к курсу»; старый колбэк `phase:<course>:0` по-прежнему открывает экран этапа (Нурболат; детали — orchestrator). Критерий плана «курс из одного этапа выглядит как раньше» заменён этим;
  - два этапа и больше — как в v0.2.6;
  - вызовы UC курса из stories идут от имени пользователя (раньше legacy-вызовы шли без актора): автор и администратор видят в каталоге заголовки своих неопубликованных модулей вместо заглушки `Модуль xxxx` — принято (orchestrator, ревью Ф4); отказ `listCourses`/`listModules` — экран ошибки, а не пустой список (ERR-06);
  - загрузка карточек модулей — как в v0.2.6, долг DEBT-51;
  - тесты по ответственности (Нурболат): тесты удалённых UC удаляются вместе с ними; integration бота — UC подключён + один самый длинный путь без моков внутри модуля; базовая линия `test:bot` пересчитывается в `summary.md`.
- **Пересмотреть:** при появлении курсов без этапов в проде — сверить экран с `ui-spec.md`.

### TR-60: границы и порядок среза сборки `course` (`course-dmg`, Ф5)
- **Трек / фаза:** `course-dmg`, Ф5 (orchestrator, 2026-11-11; бриф — `slices/assembly.md`)
- **Контекст:** план Ф5 писался до Ф4: поля `courseFacade` и тип `CourseLegacy` в `platform/app` уже удалены; рантайм бота legacy `course` не использует. Legacy держат только `U7App`, тестовый хелпер бота, миры, `scripts/_app-factory.ts` и три скрипта на нём.
- **Решение:** бриф сам, без `tech-lead` (срез по образцу `questionnaire`/`stream`). Три задачи `migrator` плана — два шага в обратном порядке: (1) сборка + клиенты (legacy ещё на месте, `check` зелёный), (2) удаление legacy — иначе промежуточный шаг красный. `_app-factory.ts` удаляется, скрипты — на `U7App` и `dispatch` через общий класс `scripts/_course-client.ts`. Barrel `@u7-scl/course/domain` (DEBT-3) остаётся; миры — на state-типы Def. DEBT-34 снимает orchestrator в `debt.md` (`course` попадает в проверку ARC-04 сам, без `external`).
- **Дополнено (эскалация шага 1):** снятие `external` сразу включает ARC-04/ARC-06 по ещё живому legacy-коду `course` — «`check` зелёный после шага 1» невыполним; шаги 1–2 идут подряд, коммит общий. Места `course` сняты из DEBT-1, 2, 5; DEBT-10 закрыт (единственное место — legacy `module/a-root.ts`); причина DEBT-34 — без `course`. Скрипты на `dispatch` пишут query в `<dbDir>/oplog` (раньше legacy не писал) — принято, как у `call-uc`.
- **Ревью (Opus, 0 `error`):** `CourseClient` падает, если админа `NUR_UUID` нет в `DB_DIR` (раньше `get-user` бросал — без проверки скрипт молча работал бы гостем); `update-stream-snapshot` запрашивает снимок от админа, а не анонимно — состав тот же (DQS берёт только опубликованное), черновой модуль потока даёт снимок вместо отказа — принято; подпуть `@u7-scl/course/infra` убран (потребителей нет); `modules/stream/src/analysis.md` со ссылками на удалённый `CourseDs` — исторический разбор, не правится.
- **Пересмотреть:** —
