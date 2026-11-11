# Инвентаризация тестов: прикладной слой `user` (модуль и бот)

Трек `tst-cleanup_20261105`, фаза 2. Только чтение кода и прогоны `bun test`. Ничего не удалено и не изменено, кроме этого файла.

Основание — закономерности [`test-bloat.md` §2](../../../roadmap/test-bloat.md) (Б-1…Б-16, признаки поиска), правила `node_modules/dmg-core/docs/reference/testing.md` §3, §5, §5.1 (TST-08, TST-09), [`bot-test.md` §2 п. 5](../../../architecture/ui/bot-test.md), решения трека [`spec.md`](../spec.md) «Решения», режим legacy — [`legacy.md`](../../../architecture/legacy.md) (модуль `user` ещё не на Def: `api/**` легаси-UC, доменные правила в `domain/src/user/`).

**Прогоны (worktree `tst-cleanup`).**

| Команда | Итог |
|---|---|
| `cd modules/user && bun test` | **103 pass, 0 fail** (12 файлов), 164 `expect()` |
| `cd runners/u7-bot && bun test src/controllers/user src/ensure-registered.test.ts tests/e2e/user-notify` | **13 pass, 2 fail** (15 тестов, 3 файла) |

Оба красных — `tests/e2e/user-notify.e2e.test.ts:186` («Курс завершён») и `:254` («записаться на следующий»): студенту приходит «🏁 Модуль завершён!» вместо 7c/7a. Причина — незакрытый TR-57 (`get-module-place` пуст, `course-dmg`); к `user` отношения не имеет. По решению трека (`stream-bot-delete.md:97`, `stream-bot.md:16`) это **работающий сторож связки стори ↔ модуль курса**, а не пустой тест: `:186` там же назначен приёмником слияния для `student-dmg.e2e.test.ts:122`. Поэтому в таблице они — с действием «отложить до course-dmg».

Номера строк — по текущему коду worktree. «Где покрыто» указывает на `it`/`test`, который сам не кандидат.

---

## 1. Сводка

### Модуль — `modules/user/src/**/*.test.ts` — 103 теста / 38 кандидатов

| Файл | Тестов | Полезен | Сомнителен | Пуст |
|---|---|---|---|---|
| `api/module.test.ts` | 6 | 5 | 1 | 0 |
| `api/user/create-user-uc.test.ts` | 6 | 4 | 2 | 0 |
| `api/user/add-role-to-user-uc.test.ts` | 7 | 3 | 4 | 0 |
| `api/user/get-user-uc.test.ts` | 2 | 2 | 0 | 0 |
| `api/user/get-user-by-telegram-id-uc.test.ts` | 2 | 2 | 0 | 0 |
| `api/user/get-users-by-ids-uc.test.ts` | 7 | 5 | 1 | 1 |
| `api/user/list-users-uc.test.ts` | 10 | 3 | 6 | 1 |
| `api/user/notify-user-uc.test.ts` | 6 | 3 | 3 | 0 |
| `api/user/register-guest-uc.test.ts` | 5 | 4 | 0 | 1 |
| `infra/user-in-proc-facade.test.ts` | 3 | 2 | 1 | 0 |
| `infra/db/user-json-repo.test.ts` | 44 | 29 | 10 | 5 |
| `user.module.test.ts` | 5 | 3 | 1 | 1 |
| **Итого** | **103** | **65** | **29** | **9** |

### Бот — `runners/u7-bot` (тесты про пользователя) — 15 тестов / 7 кандидатов

| Файл | Тестов | Полезен | Сомнителен | Пуст |
|---|---|---|---|---|
| `src/controllers/user/stories/notify.story.test.ts` | 9 | 5 | 3 | 1 |
| `src/ensure-registered.test.ts` | 3 | 2 | 0 | 1 |
| `tests/e2e/user-notify.e2e.test.ts` | 3 | 1 | 2 *(отложены)* | 0 |
| **Итого** | **15** | **8** | **5** | **2** |

**Всего 118 тестов, 45 кандидатов (43 к удалению/слиянию сейчас + 2 отложены до `course-dmg`), 73 полезны.**

---

## 2. Закономерности

Новых Н-ID не появилось: все встреченные случаи уложились в Б-1…Б-13. Отдельно проверены два подозрения и не подтвердились как новая закономерность: (а) `expect(promise).rejects` без `await` в `api/user/register-guest-uc.test.ts:144` — в bun 1.4.2 ассерт всё равно валит прогон (проверено отдельным прогоном), это дефект оформления, а не «тест не может упасть»; (б) «негативные проверки отсутствия побочного эффекта» (`repo` не вызван, `notify` не вызван) — это уже принятая в `stream`/`peer-review` трактовка Б-9 («докажем, чего нет»).

| ID | Случаев | Признак в области | Примеры |
|---|---|---|---|
| Б-1 | 2 | правило `UserAr`/`UserPolicy` проверено своим тестом в `domain/src/user/` и повторено тестом UC (UC своей логики в этом кейсе не добавляет) | `api/user/add-role-to-user-uc.test.ts:69` (идемпотентность `addRole` ↔ `domain/src/user/user/a-root.test.ts:116`), `:113` (отказ `canAddRole` ↔ `domain/src/user/user/policy.test.ts:191`) |
| Б-3 | 1 | общий хелпер `saveUsers` проверен в каждом тесте фильтров, отдельный `it` на хелпер ничего не добавляет | `infra/db/user-json-repo.test.ts:102` |
| Б-4 | 2 *(отложено)* | e2e дословно повторяет сценарий соседнего e2e того же поведения (курс/модуль) | `tests/e2e/user-notify.e2e.test.ts:186`, `:254` |
| Б-6 | 17 | копия соседнего `it` без нового класса входа: строка «таблицы конфигурации» отдельным тестом (проброс `limit`/`role`/`name`/`telegramId`/`sort`), «пустой фильтр», границы `slice`, сквозной «комбинированный сценарий», подмножество более полного теста | `api/user/list-users-uc.test.ts:86,95,106,117,128,139` (6 строк одной таблицы проброса), `api/user/create-user-uc.test.ts:66` (подмножество `:78`), `infra/db/user-json-repo.test.ts:350,355` (без фильтра / пустой фильтр), `:424` (повтор всех предыдущих ассертов) |
| Б-8 | 3 | приём/отказ полей схемы-механики: формат uuid (`UserSchema`), пиклист (`RoleSchema`, `NotifyKindSchema`) | `api/user/add-role-to-user-uc.test.ts:132`, `api/user/notify-user-uc.test.ts:81`, `:90` |
| Б-9 | 9 | поведение платформы: `UNAUTHORIZED` без актора, «команда не найдена» в модуле, умолчания стори (`unknownCommand`, `handleMessage`), конвертация markdown `safeConvert`, «не мутирует / ничего не вызывает» | `api/user/create-user-uc.test.ts:114`, `api/module.test.ts:169`, `src/controllers/user/stories/notify.story.test.ts:166` |
| Б-12 | 10 | пустой вход / пустая выдача → пустой результат («… нет — пусто»), в т.ч. пустой список id, пустой репозиторий, фильтр без совпадений | `infra/db/user-json-repo.test.ts:157,179,215,240,251`, `api/user/list-users-uc.test.ts:48`, `user.module.test.ts:79` |
| Б-13 | 1 | тест мёртвого кода: ветка недостижима, т.к. поле обязательно в схеме | `src/controllers/user/stories/notify.story.test.ts:135` (`user.telegramId === undefined` при обязательном `telegramId` в `UserSchema`) |

Наблюдение по области: `user` — легаси-модуль, поэтому Б-1 здесь мало (2 случая) — UC-тесты почти всегда доходят до своей ответственности (загрузка, `save`, своя ошибка). Зато много Б-6 и Б-12 (28 из 45): файл `user-json-repo.test.ts` писан «на покрытие строк» — по `it` на каждую границу `filter`/`slice`, и `list-users-uc.test.ts` — по `it` на каждую строку объекта фильтра.

---

## 3. Кандидаты

| путь:строка | имя теста | Б-ID | где покрыто | что делать |
|---|---|---|---|---|
| `modules/user/src/api/module.test.ts:169` | неизвестная команда — ошибка | Б-9 | нигде: ветка и текст — платформы (`platform/core/src/api/module/api-module.ts:125`), наш модуль в отказе не участвует | удалить |
| `modules/user/src/api/user/create-user-uc.test.ts:66` | пользователь сохраняет переданные роли | Б-6 | `modules/user/src/api/user/create-user-uc.test.ts:78` (роли + имя + `save`) | удалить |
| `modules/user/src/api/user/create-user-uc.test.ts:114` | отклоняет создание без авторизации | Б-9 | `platform/core/src/api/uc/use-case-auth.test.ts:123` (`requiresAuth=true` без актора) | удалить |
| `modules/user/src/api/user/add-role-to-user-uc.test.ts:69` | не дублирует существующую роль | Б-1 | `domain/src/user/user/a-root.test.ts:116` (идемпотентность `addRole`); `save` — `modules/user/src/api/user/add-role-to-user-uc.test.ts:53` | удалить |
| `modules/user/src/api/user/add-role-to-user-uc.test.ts:113` | отклоняет самостоятельное добавление роли без прав ADMIN | Б-1 | `domain/src/user/user/policy.test.ts:191` (себе чужую роль — denied) + UC-отказ `modules/user/src/api/user/add-role-to-user-uc.test.ts:101` | удалить |
| `modules/user/src/api/user/add-role-to-user-uc.test.ts:124` | отклоняет при отсутствии авторизации | Б-9 | `platform/core/src/api/uc/use-case-auth.test.ts:123` | удалить |
| `modules/user/src/api/user/add-role-to-user-uc.test.ts:132` | отклоняет невалидную команду | Б-8 | нигде по правилу (приём/отказ uuid и picklist не тестируются, TST-09): применение схемы — `platform/core/src/api/uc/use-case.test.ts:106`, отказ uuid-формата на чтении — `modules/user/src/infra/db/user-json-repo.test.ts:395` | удалить |
| `modules/user/src/api/user/get-users-by-ids-uc.test.ts:68` | пустой список — пустой результат без похода в репозиторий | Б-12 | нигде: без раннего возврата `getByUuids([])` даёт тот же ответ (`get-users-by-ids-uc.ts:34`), тест ловит только лишний вызов; содержательный путь — `modules/user/src/api/user/get-users-by-ids-uc.test.ts:55` | удалить |
| `modules/user/src/api/user/get-users-by-ids-uc.test.ts:121` | публичный read: без актора — пустой список (не UNAUTHORIZED) | Б-9 | `modules/user/src/api/user/get-users-by-ids-uc.test.ts:43` (без актора — содержательный вызов) + `platform/core/src/api/uc/use-case-auth.test.ts:148` | удалить |
| `modules/user/src/api/user/list-users-uc.test.ts:48` | возвращает пустой список для пустого репозитория | Б-12 | нигде: `users`/`total` — прямые выражения выдачи (`list-users-uc.ts:50-56`), пустая выдача по построению | удалить |
| `modules/user/src/api/user/list-users-uc.test.ts:86` | передаёт кастомный лимит | Б-6 | `modules/user/src/api/user/list-users-uc.test.ts:77` (приёмник слияния: полный объект фильтра) | слить в `modules/user/src/api/user/list-users-uc.test.ts:77` |
| `modules/user/src/api/user/list-users-uc.test.ts:95` | передаёт фильтр по роли | Б-6 | `modules/user/src/api/user/list-users-uc.test.ts:77` | слить в `:77` |
| `modules/user/src/api/user/list-users-uc.test.ts:106` | передаёт фильтр по имени (частичное совпадение) | Б-6 | `modules/user/src/api/user/list-users-uc.test.ts:77` | слить в `:77` |
| `modules/user/src/api/user/list-users-uc.test.ts:117` | передаёт фильтр по telegramId | Б-6 | `modules/user/src/api/user/list-users-uc.test.ts:77` | слить в `:77` |
| `modules/user/src/api/user/list-users-uc.test.ts:128` | передаёт сортировку (по умолчанию createdAt:desc) | Б-6 | `modules/user/src/api/user/list-users-uc.test.ts:77` | слить в `:77` |
| `modules/user/src/api/user/list-users-uc.test.ts:139` | передаёт кастомную сортировку | Б-6 | `modules/user/src/api/user/list-users-uc.test.ts:77` | слить в `:77` |
| `modules/user/src/api/user/notify-user-uc.test.ts:54` | ничего не мутирует: репозиторий не вызывается, output — undefined | Б-9 | нигде: в `NotifyUserUc.execute` нет ни чтения, ни `save` (`notify-user-uc.ts:26-41`) — проверять нечего | удалить |
| `modules/user/src/api/user/notify-user-uc.test.ts:81` | handle: некорректный kind → INPUT_VALIDATION_ERROR | Б-8 | нигде по правилу: `kind` — `NotifyKindSchema` платформы (`domain/src/user/user/commands/notify-user-cmd.ts:15`); применение схемы — `platform/core/src/api/uc/use-case.test.ts:106` | удалить |
| `modules/user/src/api/user/notify-user-uc.test.ts:90` | handle: некорректный userId → INPUT_VALIDATION_ERROR | Б-8 | нигде по правилу: uuid — примитив платформы (`domain/src/user/user/entity.ts:12`); отказ формата на чтении — `modules/user/src/infra/db/user-json-repo.test.ts:395` | удалить |
| `modules/user/src/api/user/register-guest-uc.test.ts:86` | SUCCESS: nick опционален — может отсутствовать | Б-12 | нигде: `UserAr.register` пишет `nick` только при непустом значении (`domain/src/user/user/a-root.ts:132`), «нет поля» и `undefined` неразличимы; передача nick — `modules/user/src/api/user/register-guest-uc.test.ts:76` | удалить |
| `modules/user/src/infra/user-in-proc-facade.test.ts:28` | передаёт kind и actor, если они указаны | Б-6 | `modules/user/src/infra/user-in-proc-facade.test.ts:15` (приёмник слияния: те же «аргументы доходят как есть») | слить в `modules/user/src/infra/user-in-proc-facade.test.ts:15` |
| `modules/user/src/infra/db/user-json-repo.test.ts:102` | сохраняет несколько пользователей | Б-3 | `modules/user/src/infra/db/user-json-repo.test.ts:183` (3 сохранённых — все на месте); хелпер `saveUsers` работает в каждом блоке фильтров | удалить |
| `modules/user/src/infra/db/user-json-repo.test.ts:119` | обновляет telegramId при перезаписи | Б-6 | `modules/user/src/infra/db/user-json-repo.test.ts:110` (перезапись по uuid заменяет запись, стабильного индекса по `telegramId` нет) | удалить |
| `modules/user/src/infra/db/user-json-repo.test.ts:131` | возвращает пользователя по существующему uuid | Б-6 | `modules/user/src/infra/db/user-json-repo.test.ts:97` (дословно то же тело: `save` → `getByUuid`) | удалить |
| `modules/user/src/infra/db/user-json-repo.test.ts:157` | пустой список — пустой результат | Б-12 | нигде: `filter` по пустому множеству пуст по построению; пропуск отсутствующих — `modules/user/src/infra/db/user-json-repo.test.ts:150` | удалить |
| `modules/user/src/infra/db/user-json-repo.test.ts:179` | возвращает пустой массив для пустого репозитория | Б-12 | нигде: `readAll()` на отсутствующем файле даёт `[]`; положительный случай — `modules/user/src/infra/db/user-json-repo.test.ts:183` | удалить |
| `modules/user/src/infra/db/user-json-repo.test.ts:191` | возвращает актуальные данные после обновления | Б-6 | `modules/user/src/infra/db/user-json-repo.test.ts:110` (после перезаписи читается новое состояние) | удалить |
| `modules/user/src/infra/db/user-json-repo.test.ts:215` | фильтрует по роли — роль без совпадений возвращает пустой массив | Б-12 | нигде: `filter` без совпадений пуст по построению; положительный — `modules/user/src/infra/db/user-json-repo.test.ts:207` | удалить |
| `modules/user/src/infra/db/user-json-repo.test.ts:240` | ищет по имени — нет совпадений | Б-12 | нигде: то же; положительный — `modules/user/src/infra/db/user-json-repo.test.ts:220` | удалить |
| `modules/user/src/infra/db/user-json-repo.test.ts:251` | фильтрует по telegramId — нет совпадений | Б-12 | нигде: то же; положительный — `modules/user/src/infra/db/user-json-repo.test.ts:245` | удалить |
| `modules/user/src/infra/db/user-json-repo.test.ts:289` | сортирует по name по убыванию | Б-6 | `modules/user/src/infra/db/user-json-repo.test.ts:275` (ветка `desc`) + `:282` (поле `name`) | удалить |
| `modules/user/src/infra/db/user-json-repo.test.ts:312` | limit больше количества пользователей возвращает всех | Б-6 | `modules/user/src/infra/db/user-json-repo.test.ts:302` (граница `slice` уже проверена: 2 из 6) | удалить |
| `modules/user/src/infra/db/user-json-repo.test.ts:350` | без фильтра — возвращает всех | Б-6 | `modules/user/src/infra/db/user-json-repo.test.ts:183` (тот же `getAll()` без аргумента) | удалить |
| `modules/user/src/infra/db/user-json-repo.test.ts:355` | пустой фильтр — возвращает всех | Б-6 | `modules/user/src/infra/db/user-json-repo.test.ts:183` (пустой объект не сужает выборку) | удалить |
| `modules/user/src/infra/db/user-json-repo.test.ts:372` | отслеживает изменения при перезаписи | Б-6 | `modules/user/src/infra/db/user-json-repo.test.ts:110` (перезапись заменяет запись) + `:363` (`isTelegramIdTaken` — true для существующего) | удалить |
| `modules/user/src/infra/db/user-json-repo.test.ts:424` | корректно работает последовательность операций | Б-6 | `modules/user/src/infra/db/user-json-repo.test.ts:183`, `:110`, `:165` (те же ассерты по одному) | удалить |
| `modules/user/src/user.module.test.ts:79` | пользователей нет — пусто, legacy не спрашивается | Б-12 | нигде: цикл по пустому `userIds` не выполняется (`user/uc/get-telegram-addresses.uc.ts:32`); содержательные ветки — `modules/user/src/user.module.test.ts:65`, `:72` | удалить |
| `modules/user/src/user.module.test.ts:85` | модуль обслуживает свой UC | Б-9 | `node_modules/dmg-core/src/app/facade/module-facade.test.ts:69` (сам `serves`); достижимость UC через фасад — `modules/user/src/user.module.test.ts:54` | удалить |
| `runners/u7-bot/src/controllers/user/stories/notify.story.test.ts:100` | конвертирует упрощённый markdown в MarkdownV2 в точке доставки | Б-9 | `platform/core/src/shared/markdown.test.ts:86` (`**bold** → *bold*`), `:106` (`!` экранируется); сам вызов `safeConvert` — `runners/u7-bot/src/controllers/user/stories/notify.story.test.ts:86` | удалить |
| `runners/u7-bot/src/controllers/user/stories/notify.story.test.ts:135` | пользователь без telegramId → доставка пропущена, без исключения | Б-13 | нигде: ветка недостижима — `telegramId` обязателен (`domain/src/user/user/entity.ts:14`); соседние отказы — `runners/u7-bot/src/controllers/user/stories/notify.story.test.ts:128`, `:144` | удалить (вместе с мёртвой веткой — см. вопрос 3) |
| `runners/u7-bot/src/controllers/user/stories/notify.story.test.ts:151` | story не интерактивна: callback — заглушка «Неизвестная команда» | Б-9 | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` (`unknownCommand`), `:658` (стори с переопределённым `handleCallback`) | удалить |
| `runners/u7-bot/src/controllers/user/stories/notify.story.test.ts:166` | handleMessage — дефолт ядра: реплика-отказ без захвата экрана | Б-9 | `platform/core/src/ui/bot/bot-ui-story.test.ts:246` (дефолт `handleMessage`: warn + «не принимаются» + `release`) | удалить |
| `runners/u7-bot/src/ensure-registered.test.ts:63` | без username → nick не передаётся | Б-12 | нигде: `UserAr.register` ставит `nick` только при непустом значении (`domain/src/user/user/a-root.ts:132`), `undefined` и `''` дают один результат; передача nick — `runners/u7-bot/src/ensure-registered.test.ts:26` | удалить |
| `runners/u7-bot/tests/e2e/user-notify.e2e.test.ts:186` | закрытие потока на последнем модуле → «🎉 Курс завершён!» (FR-6 #7c) | Б-4 | отложено: сам приёмник слияния для `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts:122` (см. `inventory/stream-bot-delete.md:97`); красный по TR-57 | отложить до course-dmg |
| `runners/u7-bot/tests/e2e/user-notify.e2e.test.ts:254` | закрытие на модуле с следующим → уведомления студенту нет (кнопка 7a) | Б-4 | отложено: дубль `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts:251`; поведение 7a — unit-тесты хаба (`inventory/stream-bot.md:97`); красный по TR-57 | отложить до course-dmg |

Приёмники слияния, которые сами кандидатами не являются (`modules/user/src/api/user/list-users-uc.test.ts:77`, `modules/user/src/infra/user-in-proc-facade.test.ts:15`) после слияния переписываются на полный объект аргументов — иначе часть строк таблицы останется без проверки.

---

## 4. Полезные тесты

- `modules/user/src/api/module.test.ts` — 5 тестов, полезны, защищают реестр UC модуля: вызов по имени через `mod.execute` на реальном `UserJsonRepo` (`:22`, `:52`, `:78`, `:104`, `:132`) — без них пропуск UC в `UserApiModule.useCases` или расхождение `ucName` не ловится ничем (UC-тесты зовут `uc.handle` напрямую).
- `modules/user/src/api/user/create-user-uc.test.ts` — 4 теста, полезны: своя ошибка `TELEGRAM_ID_TAKEN` (`:94`), правила своей схемы входа (`:105`), вызов `UserPolicy.canCreate` + отказ UC (`:122`), сквозной успех с `save` (`:78`).
- `modules/user/src/api/user/add-role-to-user-uc.test.ts` — 3 теста, полезны: загрузка + `addRole` + `save` (`:53`), своя ошибка `USER_NOT_FOUND` (`:90`), отказ Policy на уровне UC (`:101`).
- `modules/user/src/api/user/get-user-uc.test.ts` — 2 теста, полезны, защищают загрузку и свою ошибку `USER_NOT_FOUND` с payload `uuid` (`:50`, `:64`).
- `modules/user/src/api/user/get-user-by-telegram-id-uc.test.ts` — 2 теста, полезны, защищают поиск по `telegramId` и свою ошибку с payload `telegramId` (`:48`, `:63`).
- `modules/user/src/api/user/get-users-by-ids-uc.test.ts` — 5 тестов, полезны, защищают содержательные ветки пакетного чтения: вызов без актора (`:43`), сборка в порядке запроса (`:55`), своё правило схемы «не больше 100» (`:78`), дедуп (`:89`), пропуск ненайденных с `warn` (`:105`).
- `modules/user/src/api/user/list-users-uc.test.ts` — 3 теста, полезны: проброс выдачи репозитория и `total` (`:58`), таблица фильтров (`:77` — приёмник слияния), умолчания в `appliedFilters` (`:150`).
- `modules/user/src/api/user/notify-user-uc.test.ts` — 3 теста, полезны: публикация `user.notified` с payload (`:24`), проброс `kind` (`:44`), своё правило схемы «текст после trim не пуст» (`:72`).
- `modules/user/src/api/user/register-guest-uc.test.ts` — 4 теста, полезны: сквозная регистрация гостя на реальном репозитории (`:64`), `nick` из telegram-username (`:76`), идемпотентность «пользователь есть — без изменений» (`:96`), отказ не-админу (`:120`, ассерт без `await` на `:144` — работает, но падение приписывается следующему тесту в файле, см. вопрос 5).
- `modules/user/src/infra/user-in-proc-facade.test.ts` — 2 теста, полезны: имя UC и аргументы доходят до `execute` (`:15` — приёмник слияния), ошибка шины не глушится (`:48`, страхует от копирования `try/catch` из `getUserByUuid`).
- `modules/user/src/infra/db/user-json-repo.test.ts` — 29 тестов, полезны, защищают контракт репозитория: round-trip `save`→`getByUuid` (`:97`), перезапись по uuid (`:110`), `undefined` при отсутствии (`:136`, `:172`), выборка по списку id с пропуском отсутствующих (`:142`, `:150`), поиск по `telegramId` (`:165`), все сохранённые (`:183`), свои фильтры `role`/`name` (в т.ч. регистр и частичное совпадение — `:207`, `:220`, `:226`, `:234`) и `telegramId` (`:245`), сортировки `createdAt`/`name` обе стороны (`:262`, `:275`, `:282`), `slice`-лимит и граница `limit=0` (`:302`, `:307`), порядок применения фильтра до лимита (`:323`, `:334`), все фильтры по И (`:339`), `isTelegramIdTaken` (`:363`, `:368`), `isEmpty` (`:384`, `:388`), отбрасывание невалидных записей файла (`:395` — uuid-отказ через `UserSchema` в проводке), три ветки seed-инициализации (`:447`, `:478`, `:505`).
- `modules/user/src/user.module.test.ts` — 3 теста, полезны, защищают адаптер `getTelegramAddresses` над legacy: порядок и состав пар (`:54`), нет профиля (`:65`), профиль без `telegramId` (`:72`).
- `runners/u7-bot/src/controllers/user/stories/notify.story.test.ts` — 5 тестов, полезны: единственная подписка на `user.notified` (`:79`), доставка проактива с резолвом `telegramId` и экранированием (`:86`), проброс `kind` (`:116`), адресат не найден (`:128`), сбой `get-user` не всплывает (`:144`).
- `runners/u7-bot/src/ensure-registered.test.ts` — 2 теста, полезны: регистрация от имени бота с `first_name`+`username` и актором (`:26`), идемпотентность «пользователь есть — регистрации нет» (`:46`).
- `runners/u7-bot/tests/e2e/user-notify.e2e.test.ts` — 1 тест, полезен: сквозная пользовательская история «выразил желание → ментор открыл набор → одно кнопочное приглашение → отмена» (`:106`).

---

## 5. Открытые вопросы

1. **Ссылки на доменный уровень.** Кандидаты Б-1/Б-6 в `api/user/*-uc.test.ts` покрыты тестами `domain/src/user/user/{a-root,policy}.test.ts` (`a-root.test.ts:116`, `policy.test.ts:191` и др.). Параллельно пишется `inventory/user-dossier-domain.md` — нужно подтвердить на приёмке, что эти строки не попадают в её §3 (иначе 3 кандидата остаются без покрытия: `add-role-to-user-uc.test.ts:69`, `:113`, `notify-user-uc.test.ts:90`).
2. **Механизм `userFacade.notify` без производственного потребителя.** Цепочка `UserInProcFacade.notify` → UC `notify-user` → событие `user.notified` → сторя `notify` в проде не вызывается (её зовёт только `platform/app/src/u7-app.ts:126` как поле фасада; все уведомления бота идут через `proactiveSender` из сторей, например `runners/u7-bot/src/controllers/learning/stories/hub.ts:95`). Так же без потребителей живут `total`/`appliedFilters` ответа `list-users` (клиент берёт только `users` — `runners/u7-cli/src/cli-controller.ts:374`). По Б-13 это сигнал удалять код, а не только тесты: решить, чистим ли механизм целиком (тогда под нож идут 3 файла тестов: `notify-user-uc.test.ts`, `user-in-proc-facade.test.ts`, `notify.story.test.ts`) или он ждёт потребителя из `course-dmg`.
3. **Мёртвая ветка `user.telegramId === undefined`** в `runners/u7-bot/src/controllers/user/stories/notify.story.ts:60`: `telegramId` обязателен в `UserSchema` (`domain/src/user/user/entity.ts:14`). Удалять тест `notify.story.test.ts:135` без кода нельзя (TST-08 развернётся в обратную сторону), а правка кода вне тестового среза — решение оркестратора: удалить тест вместе с веткой отдельным шагом или оставить как защиту на будущее `telegramId?: number`.
4. **Уровень «Схемы» для легаси-команд `user`.** Свои правила схем входа (`CreateUserCmdSchema`, `AddRoleToUserCmdSchema`, `NotifyUserCmdSchema`) живут в `domain/src/user/user/commands/` и проверяются **только** тестами UC — доменных схемных тестов у `user` нет. Если правило «Схемы — только своя логика схемы» (spec, «Решения») применяется к домену `user`, доменной инвентаризации нужно завести таблицу схем команд; иначе снятие строк Б-8 (`notify-user-uc.test.ts:81`, `:90`, `add-role-to-user-uc.test.ts:132`) оставляет правила схемы без единого теста. Решение влияет на 3 строки таблицы §3.
5. **`expect(promise).rejects` без `await`** в `modules/user/src/api/user/register-guest-uc.test.ts:144`: прогон краснеет (проверено), но провал приписывается следующему тесту файла — тест хрупкий при добавлении кейсов после него. Добавить в таблицу удаления строку «переписать +`await`» или оставить до миграции `user` на Def?
