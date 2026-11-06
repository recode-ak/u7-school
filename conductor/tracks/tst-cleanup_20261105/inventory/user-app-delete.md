# Таблица удаления тестов: прикладной слой `user` и тесты пользователя в боте

Трек `tst-cleanup_20261105`, фаза 2. Основание — инвентаризация [`user-app.md`](./user-app.md) (кандидаты, закономерности Б-1…Б-13, Н1, §4 «Полезные тесты», §5 «Открытые вопросы»), сводные закономерности [`test-bloat.md` §2](../../../roadmap/test-bloat.md) (Б-1…Б-16), правила `node_modules/dmg-core/docs/reference/testing.md` §3, §5, §5.1 (TST-08, TST-09), [`bot-test.md`](../../../architecture/ui/bot-test.md) §2 п. 5 и решения трека [`spec.md`](../spec.md) «Решения».

Область — `modules/user/src/**/*.test.ts` (12 файлов) и тесты пользователя в боте: `runners/u7-bot/src/controllers/user/**/*.test.ts`, `runners/u7-bot/src/ensure-registered.test.ts`, `runners/u7-bot/tests/e2e/user-notify.e2e.test.ts`. База (перепроверено в worktree `tst-cleanup`): `cd modules/user && bun test` → **103 pass, 0 fail**; `cd runners/u7-bot && bun test src/controllers/user src/ensure-registered.test.ts tests/e2e/user-notify` → **13 pass, 2 fail** (красные — `user-notify.e2e.test.ts:186`, `:254`, причина TR-57, см. ниже).

Номера строк — по текущему коду worktree, а не по инвентаризации. Каждая ссылка «где покрыто» проверена скриптом (файл существует, на строке начинается `it(`/`test(`/`it.each(`/`test.each(`) и чтением (тест проверяет то же). Ссылки в другие уровни ведут только на тесты из §4 инвентаризации того уровня и не на кандидатов его §3: домен — [`user-dossier-domain.md`](./user-dossier-domain.md) §4 (проверено: ни одна цитируемая строка — `a-root.test.ts:20`, `:116`; `policy.test.ts:191`, `:195` — не входит в её §3); платформа — вне области чистки трека.

Решения задачи, применённые ниже: паспорта Def удаляются (Б-7), состав модуля остаётся **один** — доменный `domain/src/user/user.module.test.ts:7`; тексты `label` не тестируются (TST-09) — см. раздел «Остающиеся проверки `label`»; Policy-отказ UC остаётся **один** на модуль — `modules/user/src/api/user/add-role-to-user-uc.test.ts:101` (решение: единственная обвязка «UC → `UserPolicy` → `ACCESS_DENIED`», где правило получает загруженную цель; `create-user-uc.test.ts:122` — чистая копия `policy.test.ts:83`, уходит, её упоминает и §5 п. 3 доменной инвентаризации); схемы — свой приём/отказ полей платформы не тестируется (Б-8), своя логика схемы остаётся одной таблицей «валидно/невалидно»; схема state, разбираемая при чтении файла, остаётся (`user-json-repo.test.ts:395`); мёртвые ветки и поля — `отложить: удалить с кодом` (Б-13); красное из-за `course-dmg`/TR-57 — `отложить до course-dmg`.

Действия: `удалить` / `слить в <файл>:<строка>` / `переписать` / `перенести в <файл>` / `отложить до course-dmg` / `отложить: удалить с кодом`.
В таблицу вошли только строки, по которым есть действие: полезные тесты (§4 инвентаризации) не перечислены — их не трогают. Приёмники слияния — `api/module.test.ts:22`, `api/user/list-users-uc.test.ts:77`, `infra/user-in-proc-facade.test.ts:15`. Отдельная строка есть только у `:22` (его тело меняется на один тест сборки); `:77` и `:15` остаются в коде как полезные тесты и меняются по описанию в разделе «Переписать, слить, перенести».

## Таблица

| файл | строка | имя теста | Б-ID | действие | где покрыто |
|---|---|---|---|---|---|
| `modules/user/src/api/module.test.ts` | 22 | user.create: создаёт пользователя если есть права ADMIN | Б-7 | переписать | — (оставить один тест сборки: `UserApiModule` на реальном `UserJsonRepo` — `mod.useCases` содержит 9 UC с ожидаемыми `ucName` (`modules/user/src/api/module.ts:22`) плюс одна вертикаль create → get → list → get-by-telegram-id → get-users-by-ids; см. «Переписать» 1) |
| `modules/user/src/api/module.test.ts` | 52 | user.get: возвращает пользователя | Б-6 | слить в `modules/user/src/api/module.test.ts:22` | — (тот же `mod.execute` по тому же реальному репозиторию; в `:22` — шаг «get» вертикали) |
| `modules/user/src/api/module.test.ts` | 78 | user.list: возвращает список | Б-6 | слить в `modules/user/src/api/module.test.ts:22` | — (шаг «list» вертикали в `:22`) |
| `modules/user/src/api/module.test.ts` | 104 | user.get-by-telegram-id: находит пользователя | Б-6 | слить в `modules/user/src/api/module.test.ts:22` | — (шаг «get-by-telegram-id» вертикали в `:22`) |
| `modules/user/src/api/module.test.ts` | 132 | user.get-users-by-ids: возвращает карточки пачкой | Б-6 | слить в `modules/user/src/api/module.test.ts:22` | — (шаг «get-users-by-ids» вертикали в `:22`; сам UC — `modules/user/src/api/user/get-users-by-ids-uc.test.ts:55`) |
| `modules/user/src/api/module.test.ts` | 169 | неизвестная команда — ошибка | Б-9 | удалить | `platform/core/src/api/module/api-module.test.ts:125` (`NO_COMMAND_FOUND` для неизвестной команды; ветка — `platform/core/src/api/module/api-module.ts:121`, `:124`); модуль в отказе не участвует |
| `modules/user/src/api/user/create-user-uc.test.ts` | 66 | пользователь сохраняет переданные роли | Б-6 | удалить | `modules/user/src/api/user/create-user-uc.test.ts:78` (тот же вызов с теми же значениями: `roles`, `name`, `save`) |
| `modules/user/src/api/user/create-user-uc.test.ts` | 105 | отклоняет невалидную команду | Б-8 | удалить | нигде: `name`/`telegramId`/`roles` — поля `UserSchema` (`domain/src/user/user/entity.ts:12`), инварианты агрегата — `domain/src/user/user/a-root.test.ts:20`; применение входной схемы — `platform/core/src/api/uc/use-case.test.ts:106` |
| `modules/user/src/api/user/create-user-uc.test.ts` | 114 | отклоняет создание без авторизации | Б-9 | удалить | `platform/core/src/api/uc/use-case-auth.test.ts:123` |
| `modules/user/src/api/user/add-role-to-user-uc.test.ts` | 69 | не дублирует существующую роль | Б-1 | удалить | `domain/src/user/user/a-root.test.ts:116` (идемпотентность `addRole`); запись — `modules/user/src/api/user/add-role-to-user-uc.test.ts:53` |
| `modules/user/src/api/user/add-role-to-user-uc.test.ts` | 113 | отклоняет самостоятельное добавление роли без прав ADMIN | Б-1 | удалить | `domain/src/user/user/policy.test.ts:177` (ветка «себе роль не из разрешённых → отказ», `domain/src/user/user/policy.ts:54`; строку 191 удаляет доменная таблица — приёмка) |
| `modules/user/src/api/user/add-role-to-user-uc.test.ts` | 124 | отклоняет при отсутствии авторизации | Б-9 | удалить | `platform/core/src/api/uc/use-case-auth.test.ts:123` |
| `modules/user/src/api/user/add-role-to-user-uc.test.ts` | 132 | отклоняет невалидную команду | Б-8 | удалить | нигде: `uuid` — `UserSchema.entries.uuid` (`domain/src/user/user/entity.ts:12`), `role` — `RoleSchema` (`domain/src/user/user/roles.ts`); применение входной схемы — `platform/core/src/api/uc/use-case.test.ts:106`; отказ при чтении файла — `modules/user/src/infra/db/user-json-repo.test.ts:395` |
| `modules/user/src/api/user/get-users-by-ids-uc.test.ts` | 68 | пустой список — пустой результат без похода в репозиторий | Б-12 | удалить | нигде: без раннего возврата `getByUuids([])` даёт тот же `[]` (`modules/user/src/api/user/get-users-by-ids-uc.ts:34`); содержательный путь — `modules/user/src/api/user/get-users-by-ids-uc.test.ts:55` |
| `modules/user/src/api/user/get-users-by-ids-uc.test.ts` | 121 | публичный read: без актора — пустой список (не UNAUTHORIZED) | Б-9 | удалить | `modules/user/src/api/user/get-users-by-ids-uc.test.ts:43` (без актора — содержательный вызов) + `platform/core/src/api/uc/use-case-auth.test.ts:148` |
| `modules/user/src/api/user/list-users-uc.test.ts` | 48 | возвращает пустой список для пустого репозитория | Б-12 | удалить | нигде: `users`/`total` — прямые выражения выдачи (`modules/user/src/api/user/list-users-uc.ts:50`); содержательный путь — `modules/user/src/api/user/list-users-uc.test.ts:58` |
| `modules/user/src/api/user/list-users-uc.test.ts` | 86 | передаёт кастомный лимит | Б-6 | слить в `modules/user/src/api/user/list-users-uc.test.ts:77` | — (строка «лимит явно» таблицы фильтров в `:77`) |
| `modules/user/src/api/user/list-users-uc.test.ts` | 95 | передаёт фильтр по роли | Б-6 | слить в `modules/user/src/api/user/list-users-uc.test.ts:77` | — (строка «role») |
| `modules/user/src/api/user/list-users-uc.test.ts` | 106 | передаёт фильтр по имени (частичное совпадение) | Б-6 | слить в `modules/user/src/api/user/list-users-uc.test.ts:77` | — (строка «name»; частичное совпадение — контракт репозитория `modules/user/src/infra/db/user-json-repo.test.ts:226`) |
| `modules/user/src/api/user/list-users-uc.test.ts` | 117 | передаёт фильтр по telegramId | Б-6 | слить в `modules/user/src/api/user/list-users-uc.test.ts:77` | — (строка «telegramId») |
| `modules/user/src/api/user/list-users-uc.test.ts` | 128 | передаёт сортировку (по умолчанию createdAt:desc) | Б-6 | слить в `modules/user/src/api/user/list-users-uc.test.ts:77` | — (строка «sort по умолчанию») |
| `modules/user/src/api/user/list-users-uc.test.ts` | 139 | передаёт кастомную сортировку | Б-6 | слить в `modules/user/src/api/user/list-users-uc.test.ts:77` | — (строка «sort явно») |
| `modules/user/src/api/user/list-users-uc.test.ts` | 150 | возвращает appliedFilters в результате | Б-13 | отложить: удалить с кодом | нигде: `appliedFilters` (и `total`) не читает ни один продовый вызывающий — `runners/u7-cli/src/cli-controller.ts:380` берёт только `users` (grep по `appliedFilters` вне тестов даёт только объявления: `domain/src/user/user/commands/list-users-cmd.ts:24`, `modules/user/src/api/user/list-users-uc.ts:32`, `:53`); поля уходят вместе с тестом |
| `modules/user/src/api/user/notify-user-uc.test.ts` | 54 | ничего не мутирует: репозиторий не вызывается, output — undefined | Б-9 | удалить | нигде: в `execute` нет ни чтения, ни `save` (`modules/user/src/api/user/notify-user-uc.ts:26`), публикация события — `:39` покрыта `modules/user/src/api/user/notify-user-uc.test.ts:24` |
| `modules/user/src/api/user/notify-user-uc.test.ts` | 72 | handle: пустой текст → INPUT_VALIDATION_ERROR | Б-8 | переписать | — (своя логика схемы — одна таблица «валидно/невалидно»: `'Текст'` / `'   '` / 3501 символ; правило — `domain/src/user/user/commands/notify-user-cmd.ts:9`) |
| `modules/user/src/api/user/notify-user-uc.test.ts` | 81 | handle: некорректный kind → INPUT_VALIDATION_ERROR | Б-8 | удалить | нигде: `kind` — `NotifyKindSchema` платформы (`domain/src/user/user/commands/notify-user-cmd.ts:15`); применение входной схемы — `platform/core/src/api/uc/use-case.test.ts:106` |
| `modules/user/src/api/user/notify-user-uc.test.ts` | 90 | handle: некорректный userId → INPUT_VALIDATION_ERROR | Б-8 | удалить | нигде: `userId` — `UserSchema.entries.uuid` (`domain/src/user/user/entity.ts:12`); применение входной схемы — `platform/core/src/api/uc/use-case.test.ts:106`; отказ при чтении файла — `modules/user/src/infra/db/user-json-repo.test.ts:395` |
| `modules/user/src/api/user/register-guest-uc.test.ts` | 86 | SUCCESS: nick опционален — может отсутствовать | Б-12 | удалить | нигде: `UserAr.register` пишет `nick` только при непустом значении (`domain/src/user/user/a-root.ts:49`), `undefined` и `''` дают одно состояние; передача nick — `modules/user/src/api/user/register-guest-uc.test.ts:76`, регистрация без nick уже проходит — `:64` |
| `modules/user/src/api/user/register-guest-uc.test.ts` | 120 | FAIL: отклоняет вызов не от админа | Н1-app | переписать | — (добавить `await`: `await expect(promise).rejects.toThrow(...)`; без `await` провал приписывается следующему тесту файла) |
| `modules/user/src/infra/user-in-proc-facade.test.ts` | 28 | передаёт kind и actor, если они указаны | Б-6 | слить в `modules/user/src/infra/user-in-proc-facade.test.ts:15` | — (`:15` становится `it.each` по двум наборам: `(text)` → `kind`/`actor` не переданы, `(text, 'warn', actor)` → оба поля; вызов UC один) |
| `modules/user/src/infra/db/user-json-repo.test.ts` | 102 | сохраняет несколько пользователей | Б-3 | удалить | `modules/user/src/infra/db/user-json-repo.test.ts:183` (3 сохранённых — все на месте); хелпер `saveUsers` используется телами всех фильтров ниже |
| `modules/user/src/infra/db/user-json-repo.test.ts` | 119 | обновляет telegramId при перезаписи | Б-6 | удалить | `modules/user/src/infra/db/user-json-repo.test.ts:110` (перезапись по uuid заменяет запись целиком) |
| `modules/user/src/infra/db/user-json-repo.test.ts` | 131 | возвращает пользователя по существующему uuid | Б-6 | удалить | `modules/user/src/infra/db/user-json-repo.test.ts:97` (дословно то же тело: `save` → `getByUuid`) |
| `modules/user/src/infra/db/user-json-repo.test.ts` | 157 | пустой список — пустой результат | Б-12 | удалить | нигде: `filter` по пустому множеству пуст по построению; пропуск отсутствующих — `modules/user/src/infra/db/user-json-repo.test.ts:150` |
| `modules/user/src/infra/db/user-json-repo.test.ts` | 179 | возвращает пустой массив для пустого репозитория | Б-12 | удалить | нигде: `readAll()` на отсутствующем файле — платформа (`@u7-scl/core/infra`, `JsonFileRepo`); положительный путь — `modules/user/src/infra/db/user-json-repo.test.ts:183` |
| `modules/user/src/infra/db/user-json-repo.test.ts` | 191 | возвращает актуальные данные после обновления | Б-6 | удалить | `modules/user/src/infra/db/user-json-repo.test.ts:110` (после перезаписи чтение отдаёт новую запись) |
| `modules/user/src/infra/db/user-json-repo.test.ts` | 215 | фильтрует по роли — роль без совпадений возвращает пустой массив | Б-12 | удалить | нигде: `filter` без совпадений пуст по построению; положительный — `modules/user/src/infra/db/user-json-repo.test.ts:207` |
| `modules/user/src/infra/db/user-json-repo.test.ts` | 240 | ищет по имени — нет совпадений | Б-12 | удалить | нигде: то же; положительный — `modules/user/src/infra/db/user-json-repo.test.ts:220` |
| `modules/user/src/infra/db/user-json-repo.test.ts` | 251 | фильтрует по telegramId — нет совпадений | Б-12 | удалить | нигде: то же; положительный — `modules/user/src/infra/db/user-json-repo.test.ts:245` |
| `modules/user/src/infra/db/user-json-repo.test.ts` | 289 | сортирует по name по убыванию | Б-6 | удалить | `modules/user/src/infra/db/user-json-repo.test.ts:275` (ветка `desc`) + `:282` (поле `name`) |
| `modules/user/src/infra/db/user-json-repo.test.ts` | 312 | limit больше количества пользователей возвращает всех | Б-6 | удалить | `modules/user/src/infra/db/user-json-repo.test.ts:302` (граница `slice` уже проверена на меньшем `limit`) |
| `modules/user/src/infra/db/user-json-repo.test.ts` | 350 | без фильтра — возвращает всех | Б-6 | удалить | `modules/user/src/infra/db/user-json-repo.test.ts:183` (тот же `getAll()` без аргумента) |
| `modules/user/src/infra/db/user-json-repo.test.ts` | 355 | пустой фильтр — возвращает всех | Б-6 | удалить | `modules/user/src/infra/db/user-json-repo.test.ts:183` (пустой объект выборку не сужает) |
| `modules/user/src/infra/db/user-json-repo.test.ts` | 372 | отслеживает изменения при перезаписи | Б-6 | удалить | `modules/user/src/infra/db/user-json-repo.test.ts:110` (перезапись заменяет запись) + `:363` (`isTelegramIdTaken` по файлу) |
| `modules/user/src/infra/db/user-json-repo.test.ts` | 424 | корректно работает последовательность операций | Б-6 | удалить | `modules/user/src/infra/db/user-json-repo.test.ts:183`, `:110`, `:165` (те же ассерты по отдельности) |
| `modules/user/src/user.module.test.ts` | 79 | пользователей нет — пусто, legacy не спрашивается | Б-12 | удалить | нигде: цикл по пустому `userIds` не выполняется (`modules/user/src/user/uc/get-telegram-addresses.uc.ts:32`) — «legacy не спрашивался» неотличимо от «вызовов не было»; содержательные ветки — `modules/user/src/user.module.test.ts:65`, `:72` |
| `modules/user/src/user.module.test.ts` | 85 | модуль обслуживает свой UC | Б-9 | удалить | `node_modules/dmg-core/src/app/facade/module-facade.test.ts:69` (сам `serves`); достижимость UC через фасад — `modules/user/src/user.module.test.ts:54` |
| `runners/u7-bot/src/controllers/user/stories/notify.story.test.ts` | 100 | конвертирует упрощённый markdown в MarkdownV2 в точке доставки | Б-9 | удалить | `platform/core/src/shared/markdown.test.ts:86` (+`:106`) — наш конвейер конвертации; сама конвертация — библиотека `markdown-to-telegram`, её вызов держит `runners/u7-bot/src/controllers/user/stories/notify.story.test.ts:86` (`Привет, мир\!`) |
| `runners/u7-bot/src/controllers/user/stories/notify.story.test.ts` | 135 | пользователь без telegramId → доставка пропущена, без исключения | Б-13 | отложить: удалить с кодом | нигде: ветка недостижима — `telegramId` обязателен в схеме (`domain/src/user/user/entity.ts:14`), проверка в `notify.story.ts:60`; соседние отказы — `runners/u7-bot/src/controllers/user/stories/notify.story.test.ts:128`, `:144` |
| `runners/u7-bot/src/controllers/user/stories/notify.story.test.ts` | 151 | story не интерактивна: callback — заглушка «Неизвестная команда» | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` (`unknownCommand`), `:658` (стори с переопределённым `handleCallback`) |
| `runners/u7-bot/src/controllers/user/stories/notify.story.test.ts` | 166 | handleMessage — дефолт ядра: реплика-отказ без захвата экрана | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:246` |
| `runners/u7-bot/src/ensure-registered.test.ts` | 63 | без username → nick не передаётся | Б-12 | удалить | нигде: `UserAr.register` пишет `nick` только при непустом (`domain/src/user/user/a-root.ts:49`), `undefined` и `''` дают одно состояние; передача nick — `runners/u7-bot/src/ensure-registered.test.ts:26` |
| `runners/u7-bot/tests/e2e/user-notify.e2e.test.ts` | 186 | закрытие потока на последнем модуле → «🎉 Курс завершён!» (FR-6 #7c) | Б-4 | отложить до course-dmg | отложено (слияние после TR-57): пара — `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts:96` (в `stream-bot-delete.md` она записана как `:122` — нумерация того файла устарела) + `runners/u7-bot/src/controllers/learning/stories/hub.test.ts:389` |
| `runners/u7-bot/tests/e2e/user-notify.e2e.test.ts` | 254 | закрытие на модуле с следующим → уведомления студенту нет (кнопка 7a) | Б-4 | отложить до course-dmg | отложено (слияние после TR-57): пара — `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts:158` (в `stream-bot-delete.md` — `:251`) + `runners/u7-bot/src/controllers/learning/stories/hub.test.ts:331`; сейчас красный (TR-57) |

## Переписать, слить, перенести

**Переписать (3).**

1. `modules/user/src/api/module.test.ts:22` — из пяти smoke-тестов (`:22`, `:52`, `:78`, `:104`, `:132`) оставить **один** тест сборки: на реальном `UserJsonRepo` проверить, что `mod.useCases` — это 9 UC с ожидаемыми `ucName` (`create-user`, `get-user`, `list-users`, `get-user-by-telegram-id`, `get-users-by-ids`, `add-role-to-user`, `remove-role-to-user`, `notify-user`, `register-guest`; перечисление — `modules/user/src/api/module.ts:22`), и провести одну вертикаль create → get → list. Состав модуля при этом держит домен (`domain/src/user/user.module.test.ts:7`), поэтому перечисление UC здесь — только «реестр собрался без дыр» (прецедент — `modules/questionnaire/src/questionnaire.module.test.ts:164`).
2. `modules/user/src/api/user/notify-user-uc.test.ts:72` — вместо одного отказа сделать `it.each` «валидно/невалидно» по `text`: `'Текст'` → проходит, `'   '` → отказ (трим), 3501 символ → отказ (`maxLength` сейчас не проверен нигде).
3. `modules/user/src/api/user/register-guest-uc.test.ts:120` — добавить `await` перед `expect(promise).rejects` (Н1-app): сейчас тест падает, но провал приписывается следующему тесту файла.

**Слить (8 приёмников, 11 строк).**

- `modules/user/src/api/module.test.ts:22` ← `:52`, `:78`, `:104`, `:132` (шаги одной вертикали).
- `modules/user/src/api/user/list-users-uc.test.ts:77` ← `:86`, `:95`, `:106`, `:117`, `:128`, `:139`: `:77` становится `it.each` по шести конфигурациям фильтра — «по умолчанию (`limit` 20, `sort` `createdAt:desc`)», «лимит явно», «role», «name», «telegramId», «sort явно»; ожидание — полный объект аргументов `getAll` (вместо `expect.objectContaining`), `:128` отсюда уже не отдельный тест.
- `modules/user/src/infra/user-in-proc-facade.test.ts:15` ← `:28`: `:15` становится `it.each` по двум наборам аргументов (`(text)` / `(text, 'warn', actor)`), ожидание — объект аргументов UC целиком.

**Перенести:** нет.

**Отложено (2 строки).** `modules/user/src/api/user/list-users-uc.test.ts:150` — снимается вместе с полями `appliedFilters`/`total` (`modules/user/src/api/user/list-users-uc.ts:52`-`:58`, тип — `domain/src/user/user/commands/list-users-cmd.ts:24`). `runners/u7-bot/src/controllers/user/stories/notify.story.test.ts:135` — снимается вместе с мёртвой веткой `notify.story.ts:60`.

## Остающиеся проверки `label`

Прямых проверок `.label`/`denyMessage` в области нет (grep пуст), но в легаси-UC текст ошибки и есть `label` (`errAccessDenied`/`errNotFound(name, message, params)`), и 6 оставшихся тестов проверяют именно его через `toThrow('<текст>')` (TST-09). В этом же срезе текст заменить на код ошибки и `params`, а текст не проверять:

| где | что снять | на что заменить |
|---|---|---|
| `modules/user/src/api/user/add-role-to-user-uc.test.ts:98` | `toThrow('Пользователь не найден')` | `USER_NOT_FOUND` + `params.uuid` |
| `modules/user/src/api/user/get-user-uc.test.ts:70` | `toThrow('Пользователь не найден')` | `USER_NOT_FOUND` + `params.uuid` |
| `modules/user/src/api/user/get-user-by-telegram-id-uc.test.ts:68` | `toThrow('Пользователь не найден')` | `USER_NOT_FOUND` + `params.telegramId` |
| `modules/user/src/api/user/register-guest-uc.test.ts:144` | `toThrow('Только администратор')` | `ACCESS_DENIED` (строка переписывается по Н1-app) |
| `modules/user/src/api/user/notify-user-uc.test.ts:75` | `toThrow('Переданы некорректные данные')` | `INPUT_VALIDATION_ERROR` (текст платформы) + «событие не опубликовано» |
| `modules/user/src/api/user/get-users-by-ids-uc.test.ts:83` | `toThrow('Переданы некорректные данные')` | `INPUT_VALIDATION_ERROR` + «`getByUuids` не вызван» |

Не трогаем: `modules/user/src/infra/user-in-proc-facade.test.ts:56` — `'Текст'` там сообщение от мока шины (проверяется прозрачность ошибки, а не `label`).

## Состав модуля

Один тест состава — доменный `domain/src/user/user.module.test.ts:7` (UC-список, `dependsOn`, ER нет — инвентаризация домена §4). В прикладном слое своего теста состава не остаётся: `modules/user/src/api/module.test.ts:22` после переписывания — тест **сборки** (реальный репозиторий, а не карта Def), `modules/user/src/user.module.test.ts` — тест адаптера `getTelegramAddresses` (`:54`, `:65`, `:72`), который домен не видит (легаси-фасад модуля).

## Согласование с доменной инвентаризацией

- `add-role-to-user-uc.test.ts:101` (единственный Policy-отказ) держит обвязку UC, правило — домен `policy.test.ts:195` (не кандидат §3).
- Цитируемые доменные строки вне §3 `user-dossier-domain.md`: `a-root.test.ts:20`, `:116`; `policy.test.ts:83`, `:191`, `:195`. Мёртвые правила (`canRead`, `canEdit`, `isSubscriber`, `isGuest`, `isStudent`) не цитируются нигде.
- §5 п. 3 доменной инвентаризации перечисляет `create-user-uc.test.ts:122 ≙ policy.test.ts:83` как копию — учтено: строка удаляется.

## Приёмка (orchestrator)

- `create-user-uc.test.ts:122` **оставлен**: в legacy-UC вызов `UserPolicy.canCreate` — своя строка `create-user-uc.ts:33`, без теста её покрытие падает (гейт). Правило «один Policy-отказ на модуль» — для UC на Def, где Policy вызывает платформа; у legacy-UC — по одному отказу на UC.
- `add-role-to-user-uc.test.ts:113` — ссылка переведена на `policy.test.ts:177` (строку 191 удаляет доменная таблица).

## Итог

| действие | модуль | бот | всего |
|---|---|---|---|
| удалить | 33 | 4 | **37** |
| слить | 11 | 0 | **11** |
| переписать | 3 | 0 | **3** |
| перенести | 0 | 0 | **0** |
| отложить: удалить с кодом | 1 | 1 | **2** |
| отложить до course-dmg | 0 | 2 | **2** |
| **строк в таблице** | **48** | **7** | **55** |

Уходит выполнений сейчас: 48 (37 удалить + 11 слить). Остаётся в таблице до удаления кода: 4 (`отложить`).

**Ожидаемое число тестов: 70** (было 118; модуль 103 → **59**, бот 15 → **11**).
По файлам: модуль — `api/module` 6→1, `create-user-uc` 6→2, `add-role-to-user-uc` 7→3, `get-user-uc` 2→2, `get-user-by-telegram-id-uc` 2→2, `get-users-by-ids-uc` 7→5, `list-users-uc` 10→3, `notify-user-uc` 6→3, `register-guest-uc` 5→4, `user-in-proc-facade` 3→2, `user-json-repo` 44→29, `user.module` 5→3; бот — `notify.story` 9→6, `ensure-registered` 3→2, `user-notify.e2e` 3→3.

**Кандидатов инвентаризации не вошло: 0** (все 38 модульных и 7 ботовых строк из §3 есть в таблице). Сверх инвентаризации добавлено 10 строк, все — следствие решений задачи, а не новых находок: `create-user-uc.test.ts:105` и `:122` (Б-8 и Б-1 после выбора единственного Policy-отказа), `api/module.test.ts:22`, `:52`, `:78`, `:104`, `:132` (решение 6 + Б-7: один тест сборки), `notify-user-uc.test.ts:72` (таблица схемы), `register-guest-uc.test.ts:120` (Н1-app), `list-users-uc.test.ts:150` (Б-13).

## Спорные строки

1. `create-user-uc.test.ts:122` — удаляется как копия `policy.test.ts:83`, но её удаление оставляет `modules/user/src/api/user/create-user-uc.ts:33` без единой строки покрытия. Симметрично: удаление `add-role:101`/`:113` оставило бы без покрытия `add-role-to-user-uc.ts:39`. Критерий «покрытие не падает» строго не выполняется на 1 строке-делегате; если это блокер — оставить `:122` вместо `:101`.
2. `api/module.test.ts:22` — слияние пяти smoke-тестов в один идёт против `testing.md` §3 («по `it` на UC»): падение перестанет адресоваться конкретному UC. Прецедент — `questionnaire.module.test.ts:164`.
3. `list-users-uc.test.ts:58` (не в таблице) содержит `expect(result.total)` — при удалении поля `total` вместе с `:150` эту строку снять в том же шаге, иначе тест упадёт.
4. `notify.story.test.ts:100` — удаляется как Б-9, но это единственное место в боте, где вообще упоминается конвертация разметки для ленты; если понадобится регресс диалекта, он должен жить в `platform/core/src/shared/markdown.test.ts`, а не здесь.
5. Номера строк в `inventory/stream-bot-delete.md` для `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts` устарели (`:122` → сейчас `:96`, `:251` → `:158`) — при применении той таблицы их надо перепроверить по коду.
