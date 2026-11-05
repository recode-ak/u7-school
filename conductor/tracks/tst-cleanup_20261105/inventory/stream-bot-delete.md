# Таблица удаления тестов: бот `stream` (потоки, ментор, учёба)

Трек `tst-cleanup_20261105`, фаза 2. Основание — инвентаризация [`stream-bot.md`](./stream-bot.md) (кандидаты, З1–З13), сводные закономерности [`test-bloat.md` §2](../../../roadmap/test-bloat.md) (Б-1…Б-13), правила `node_modules/dmg-core/docs/reference/testing.md` §3, §5, §5.1 (TST-08, TST-09), [`bot-test.md` §2 п. 5](../../../architecture/ui/bot-test.md) («уровни не повторяют друг друга»), решения трека [`spec.md`](../spec.md) «Решения» и решения среза (`stream-bot.md` → «Что проверить перед удалением»).

Номера строк — по текущему коду worktree `tst-cleanup`. Базовая линия области — **333 объявления / 335 кейсов** (`test.each` разворачивается), из них 2 красных: `tests/e2e/student-dmg.e2e.test.ts:122` и `:251` (TR-57, незавершённый `course-dmg`, `conductor/architecture/debt.md`).

Действия: `удалить` / `слить в <файл>:<строка>` / `переписать` / `перенести в <файл>` / `отложить до course-dmg`. Тесты-кандидаты, оставленные без изменений, в таблицу не входят (см. «Итог»).

Ссылки «где покрыто» проверены скриптом (файл существует, указанная строка начинается с `it(`/`test(`/`it.each(`/`test.each(`, тест не удаляется этой же таблицей — цепочек A→B, B удалён, нет). Пути — от корня репозитория.

## Таблица

| файл | строка | имя теста | Б-ID | действие | где покрыто |
|---|---|---|---|---|---|
| `runners/u7-bot/src/controllers/learning/controller.test.ts` | 5 | имя контроллера — learning | Б-11 | удалить | нигде: константа `name`, маршрут держит `app-controller` |
| `runners/u7-bot/src/controllers/learning/controller.test.ts` | 10 | содержит 4 стори | Б-11 | удалить | нигде: падает при добавлении стори, маршрут держат forward-тесты |
| `runners/u7-bot/src/controllers/learning/controller.test.ts` | 24 | все ожидаемые имена стори присутствуют | Б-11 | удалить | нигде: дубль `:10` другими словами |
| `runners/u7-bot/src/controllers/learning/stories/hub.student-events.test.ts` | 63 | подписка идёт на FQN Def, а не на legacy-имя student.completed | Б-5 | перенести в `runners/u7-bot/src/controllers/learning/stories/hub.test.ts` | — (единственный FQN-сторож подписки) |
| `runners/u7-bot/src/controllers/learning/stories/hub.student-events.test.ts` | 72 | advanced, место известно, модуль последний → notify «Курс завершён» (7c), kind info | Б-5 | удалить | `runners/u7-bot/src/controllers/learning/stories/hub.test.ts:392` |
| `runners/u7-bot/src/controllers/learning/stories/hub.student-events.test.ts` | 86 | advanced, место неизвестно → notify «Модуль завершён» (7d) | Б-5 | удалить | `runners/u7-bot/src/controllers/learning/stories/hub.test.ts:432` |
| `runners/u7-bot/src/controllers/learning/stories/hub.student-events.test.ts` | 96 | advanced + есть следующий модуль → только invite 7a, notify нет | Б-5 | удалить | `runners/u7-bot/src/controllers/learning/stories/hub.test.ts:334` (строже: код кнопки) |
| `runners/u7-bot/src/controllers/learning/stories/hub.student-events.test.ts` | 104 | not_advanced → только invite 7b «Пройти модуль снова», notify нет | Б-5 | удалить | `runners/u7-bot/src/controllers/learning/stories/hub.test.ts:364` (строже: код кнопки) |
| `runners/u7-bot/src/controllers/learning/stories/hub.student-events.test.ts` | 112 | у пользователя нет telegramId → ни notify, ни invite | Б-5 | удалить | `runners/u7-bot/src/controllers/learning/stories/hub.test.ts:412` |
| `runners/u7-bot/src/controllers/learning/stories/hub.test.ts` | 264 | неизвестная команда — экран unknownCommand | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` |
| `runners/u7-bot/src/controllers/learning/stories/nav-tree.test.ts` | 391 | nav-tree:step:<id> — на текущем шаге «След. ▶️» исчезает, если следующий шаг заблокирован | Б-1 | удалить | `runners/u7-bot/src/controllers/learning/student-nav-resolver.test.ts:256` |
| `runners/u7-bot/src/controllers/learning/stories/nav-tree.test.ts` | 444 | студент не записан — экран «не записаны» | Б-3 | удалить | `runners/u7-bot/src/controllers/learning/stories/hub.test.ts:113` (тот же `notEnrolled()`) |
| `runners/u7-bot/src/controllers/learning/stories/nav-tree.test.ts` | 460 | неизвестная команда — экран unknownCommand | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` |
| `runners/u7-bot/src/controllers/learning/stories/progress.test.ts` | 155 | студент не записан → экран «не записаны» | Б-3 | удалить | `runners/u7-bot/src/controllers/learning/stories/hub.test.ts:113` |
| `runners/u7-bot/src/controllers/learning/stories/progress.test.ts` | 171 | неизвестная команда — экран unknownCommand | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` |
| `runners/u7-bot/src/controllers/learning/stories/step-view.test.ts` | 437 | complete (level=lesson) — «↩️ Главное меню» в конце | Б-9 | удалить | `runners/u7-bot/src/controllers/learning/stories/step-view.test.ts:156` (правило футера `buttons.mainMenu()`) |
| `runners/u7-bot/src/controllers/learning/stories/step-view.test.ts` | 458 | complete (level=stream) — «↩️ Главное меню» в конце | Б-6 | удалить | `runners/u7-bot/src/controllers/learning/stories/step-view.test.ts:422` (тот же экран `level: stream`) + `:156` |
| `runners/u7-bot/src/controllers/learning/stories/step-view.test.ts` | 531 | my-study:view — другой streamId → ошибка | Б-6 | удалить | `runners/u7-bot/src/controllers/learning/stories/step-view.test.ts:332` (тот же guard `student.streamId`, `step-view.ts:200`) |
| `runners/u7-bot/src/controllers/learning/stories/step-view.test.ts` | 571 | студент не записан — экран «не записаны» | Б-3 | удалить | `runners/u7-bot/src/controllers/learning/stories/hub.test.ts:113` |
| `runners/u7-bot/src/controllers/learning/stories/step-view.test.ts` | 587 | неизвестная команда — экран unknownCommand | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` |
| `runners/u7-bot/src/controllers/mentor/stories/activate-stream.test.ts` | 35 | menuButtons: пусто (запуск только из карточки потока) | Б-9 | удалить | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts:294` |
| `runners/u7-bot/src/controllers/mentor/stories/activate-stream.test.ts` | 71 | неизвестная команда — экран «Неизвестная команда» | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` |
| `runners/u7-bot/src/controllers/mentor/stories/activate-stream.test.ts` | 83 | handleMessage: дефолт ядра — реплика-отказ + release | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:246` + `runners/u7-bot/src/infra/bot-transport.test.ts:918` |
| `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts` | 118 | menuButtons: пусто (создание только через подменю) | Б-9 | удалить | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts:294` |
| `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts` | 297 | accept-goal: цель из модуля → шаг 5 (Результат) | Б-6 | переписать | — (становится `test.each` по `OPTIONAL_FIELDS`: accept пяти полей) |
| `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts` | 320 | skip-goal: пустая цель → шаг 5 | Б-6 | переписать | — (то же: skip пяти полей) |
| `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts` | 342 | accept-result → шаг 6 (Правила) | Б-6 | слить в `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:297` | — (строка таблицы «accept для `result`») |
| `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts` | 363 | skip-rules → шаг 7 (Целевая аудитория) | Б-6 | слить в `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:320` | — (строка таблицы «skip для `rules`») |
| `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts` | 384 | accept-targetAudience → шаг 8 (Дополнительно) | Б-6 | слить в `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:297` | — (строка таблицы «accept для `targetAudience`») |
| `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts` | 405 | skip-additional → шаг 9 (Telegram-группа) | Б-6 | слить в `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:320` | — (строка таблицы «skip для `additional`») |
| `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts` | 426 | ввод шаг 4 — цель вручную → шаг 5 | Б-6 | переписать | — (становится `test.each`: ввод на шагах 4–8) |
| `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts` | 448 | ввод шаг 8 — дополнительно → шаг 9 (группа) | Б-6 | слить в `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:426` | — (строка таблицы «ввод `additional`») |
| `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts` | 779 | неизвестная кнопка — экран «Неизвестная команда» | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` |
| `runners/u7-bot/src/controllers/mentor/stories/monitor.test.ts` | 219 | menuButtons: пусто (вход из карточки потока) | Б-9 | удалить | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts:294` |
| `runners/u7-bot/src/controllers/mentor/stories/monitor.test.ts` | 790 | неизвестная команда — экран «Неизвестная команда» | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` |
| `runners/u7-bot/src/controllers/mentor/stories/monitor.test.ts` | 800 | пустой action — экран «Неизвестная команда» | Б-6 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` (пустой action — та же ветка `default`, отдельного класса входа нет) |
| `runners/u7-bot/src/controllers/mentor/stories/monitor.test.ts` | 806 | handleMessage: дефолт ядра — реплика-отказ + release | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:246` |
| `runners/u7-bot/src/controllers/mentor/stories/my-streams.test.ts` | 63 | menuButtons: пусто (вход только через подменю ментора) | Б-9 | удалить | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts:294` |
| `runners/u7-bot/src/controllers/mentor/stories/my-streams.test.ts` | 174 | неизвестный action — экран «Неизвестная команда» | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` |
| `runners/u7-bot/src/controllers/mentor/stories/my-streams.test.ts` | 184 | handleMessage: дефолт ядра — реплика-отказ + release | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:246` |
| `runners/u7-bot/src/controllers/mentor/stories/submenu.test.ts` | 93 | неизвестный action — экран «Неизвестная команда» | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` |
| `runners/u7-bot/src/controllers/mentor/stories/submenu.test.ts` | 101 | handleMessage: реплика-отказ без захвата экрана + release | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:246` |
| `runners/u7-bot/src/controllers/mentor/stories/view-stream-mentor.test.ts` | 147 | menuButtons: пусто (вход только через «Мои потоки») | Б-9 | удалить | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts:294` |
| `runners/u7-bot/src/controllers/mentor/stories/view-stream-mentor.test.ts` | 220 | program: карточка модуля (root) — без статусов, назад в view-stream-mentor | Б-1 | удалить | `runners/u7-bot/src/controllers/streams/stream-nav-resolver.test.ts:82` (тот же `resolveStreamNavLevel`, режим `mentor`) |
| `runners/u7-bot/src/controllers/mentor/stories/view-stream-mentor.test.ts` | 245 | program: карточка проекта — список уроков | Б-1 | удалить | `runners/u7-bot/src/controllers/streams/stream-nav-resolver.test.ts:114` |
| `runners/u7-bot/src/controllers/mentor/stories/view-stream-mentor.test.ts` | 263 | program: карточка урока — все шаги доступны для ментора | Б-1 | удалить | `runners/u7-bot/src/controllers/streams/stream-nav-resolver.test.ts:154` |
| `runners/u7-bot/src/controllers/mentor/stories/view-stream-mentor.test.ts` | 295 | program: карточка шага — ментор видит тело шага (readOnly) | Б-1 | удалить | `runners/u7-bot/src/controllers/streams/stream-nav-resolver.test.ts:201` (readOnly-карточка шага ментора) |
| `runners/u7-bot/src/controllers/mentor/stories/view-stream-mentor.test.ts` | 350 | details: показывает заполненные поля | Б-1 | удалить | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:285` (рендер — в родителе) |
| `runners/u7-bot/src/controllers/mentor/stories/view-stream-mentor.test.ts` | 567 | неизвестная команда — экран «Неизвестная команда» | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` |
| `runners/u7-bot/src/controllers/mentor/stories/view-stream-mentor.test.ts` | 577 | handleMessage: дефолт ядра — реплика-отказ + release | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:246` |
| `runners/u7-bot/src/controllers/streams/controller.test.ts` | 51 | имя контроллера — stream | Б-11 | удалить | маршрут — `runners/u7-bot/src/controllers/streams/controller.test.ts:70`, `:83` |
| `runners/u7-bot/src/controllers/streams/controller.test.ts` | 56 | содержит 3 stories (catalog + view-stream + inactivity) | Б-11 | удалить | `:70`, `:83` (forward требует, чтобы стори была) |
| `runners/u7-bot/src/controllers/streams/controller.test.ts` | 62 | menuButtons пуст (сторис не экспортируют кнопок в главное меню) | Б-9 | удалить | `runners/u7-bot/src/core/u7-bot-controller.test.ts:112` |
| `runners/u7-bot/src/controllers/streams/controller.test.ts` | 95 | handleCallback — неизвестный префикс | Б-9 | удалить | `platform/core/src/ui/bot/bot-controller.test.ts:625` |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts` | 118 | три подписки на FQN Def, legacy-имён student.* нет | Б-5 | перенести в `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts` | — (FQN-сторож подписок) |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts` | 136 | студенту invite с «🚪 Покинуть учёбу»; адрес из профиля, дни из payload.days | Б-5 | удалить | `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts:238` |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts` | 152 | %s — пропуск без исключения и без отправки | Б-5 | перенести в `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts` | — (пропуск без профиля/`telegramId`) |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts` | 166 | ментору invite с «⚠️ Снять с учёбы»; ментор — из getStream, имя студента из профиля | Б-5 | удалить | `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts:279` |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts` | 182 | wasWarned → строка «Уведомления были ранее отправлены» | Б-5 | удалить | `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts:307` |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts` | 190 | имя студента не резолвится → первые 8 символов userId | Б-5 | удалить | `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts:320` |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts` | 198 | поток недоступен — ментор неизвестен, отправки нет | Б-5 | перенести в `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts` | — (`candidate` без потока) |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts` | 204 | у ментора нет telegramId — отправки нет | Б-5 | перенести в `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts` | — (у ментора нет `telegramId`) |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts` | 214 | кик из группы потока при любом уходе | Б-6 | удалить | `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts:339` (кик не зависит от причины ухода) |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts` | 226 | self → ментору notify kind info «покинул учёбу … по собственному желанию» | Б-5 | перенести в `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts` | — (`self` → ментору `info`) |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts` | 240 | mentor + inactivity → студенту notify kind warn «снят с учёбы … за бездействие» | Б-5 | перенести в `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts` | — (`mentor` + `inactivity` → студенту `warn`) |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts` | 253 | mentor + by_mentor → студенту текста нет (Т6), кик есть | Б-5 | перенести в `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts` | — (`by_mentor` → без текста) |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts` | 261 | поток недоступен — уведомление пропущено, исключения нет | Б-5 | перенести в `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts` | — (поток недоступен) |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts` | 268 | у студента нет telegramId — кика нет; уведомление студенту невозможно | Б-5 | перенести в `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts` | — (у студента нет `telegramId`) |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts` | 223 | подписывается на три события бездействия и ухода | Б-5 | удалить | заменяется перенесённым из `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts:118` |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts` | 534 | неизвестный action — экран «Неизвестная команда» | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` |
| `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.test.ts` | 31 | menuButtons возвращает пустой массив (вход из главного меню убран) | Б-9 | удалить | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts:294` |
| `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.test.ts` | 213 | неизвестная команда каталога — экран «Неизвестная команда» | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` |
| `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.test.ts` | 220 | handleMessage — дефолт ядра (ввод без ожидания до стори не доходит) | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:246` |
| `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.test.ts` | 231 | тексты экрана: заголовок и легенда статусов | Б-6 | переписать | — (легенда → `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.test.ts:37`; остаётся plain-текст кнопки со спецсимволами) |
| `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts` | 324 | неизвестная команда | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` |
| `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts` | 547 | handleMessage: ввод без awaitInput-контекста — реплика-отказ + release | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:246` + `runners/u7-bot/src/infra/bot-transport.test.ts:918` |
| `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts` | 692 | project: карточка проекта — список уроков и листание проектов | Б-1 | переписать | — (оставить коды кнопок; крошки/`prev`/`next` — `runners/u7-bot/src/controllers/streams/stream-nav-resolver.test.ts:114`) |
| `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts` | 722 | lesson: карточка урока — заголовки шагов в тексте, но кнопок шагов нет | Б-1 | удалить | `runners/u7-bot/src/controllers/streams/stream-nav-resolver.test.ts:154`, `:236` (один экран программы — `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:659`) |
| `runners/u7-bot/tests/e2e/stream-dmg.e2e.test.ts` | 97 | createStream → желающий получает ровно одно приглашение | Б-4 | удалить | `runners/u7-bot/tests/e2e/user-notify.e2e.test.ts:106` («ровно одно приглашение») |
| `runners/u7-bot/tests/e2e/stream-dmg.e2e.test.ts` | 135 | findStreamByTelegramGroup: поток по группе; чужая группа — пусто | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/controller.stream-group.test.ts:108`, `:124` |
| `runners/u7-bot/tests/e2e/stream-dmg.e2e.test.ts` | 160 | в группе нового потока вступил чужой → ментору предупреждение | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/controller.stream-group.test.ts:136` |
| `runners/u7-bot/tests/e2e/stream-dmg.e2e.test.ts` | 175 | событие в чужой группе → никому ничего не уходит | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/controller.stream-group.test.ts:124` |
| `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts` | 122 | advanced на последнем модуле → «🎉 Курс завершён!» (7c) | Б-4 | отложить до course-dmg | `runners/u7-bot/tests/e2e/user-notify.e2e.test.ts:186` (вне области — слияние после TR-57) |
| `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts` | 184 | not_advanced → студенту «Пройти модуль снова» (7b) | Б-4 | удалить | `runners/u7-bot/src/controllers/learning/stories/hub.test.ts:364` |
| `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts` | 251 | advanced на модуле со следующим → студенту уведомления нет | Б-4 | отложить до course-dmg | `runners/u7-bot/tests/e2e/user-notify.e2e.test.ts:254` + `runners/u7-bot/src/controllers/learning/stories/hub.test.ts:334` (сейчас красный — TR-57) |
| `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts` | 290 | dropStudent → ментору «покинул учёбу … по собственному желанию» + мягкий кик | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts:339` (кик) + перенесённый туда тест «self → ментору `info`» |
| `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts` | 324 | markAbandoned(inactivity) → студенту «снят с учёбы … за бездействие» + кик | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts:339` + перенесённый туда тест «`mentor` + `inactivity` → студенту `warn`» |
| `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts` | 359 | markAbandoned(by_mentor) → кик, студенту текст не приходит (Т6) | Б-4 | удалить | перенесённый в `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts` тест «`by_mentor` → без текста» |
| `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts` | 393 | runJob(inactivitySweep): студенту «Учёба стоит», ментору «Кандидат на снятие с учёбы» | Б-4 | удалить | `runners/u7-bot/tests/e2e/inactivity.e2e.test.ts:177`, `:198` (тот же Job, те же тексты) |
| `runners/u7-bot/tests/mentor/mentor.integration.test.ts` | 85 | enrollment поток существует и доступен | Б-10 | удалить | `modules/stream/src/stream/uc/read-stream.uc.test.ts:82` (`canManage` по Policy) |
| `runners/u7-bot/tests/mentor/mentor.integration.test.ts` | 94 | active поток — статус active | Б-10 | удалить | `modules/stream/src/stream/uc/read-stream.uc.test.ts:82` |
| `runners/u7-bot/tests/mentor/mentor.integration.test.ts` | 103 | список студентов enrollment-потока (пустой) | Б-10 | удалить | `modules/stream/src/stream/uc/stream-students.uc.test.ts:161` (пустой список — не ошибка) |
| `runners/u7-bot/tests/mentor/mentor.integration.test.ts` | 114 | wizard: список модулей для создания потока | Б-10 | удалить | `modules/course/src/module/uc/list-modules.uc.test.ts:37` |
| `runners/u7-bot/tests/mentor/mentor.integration.test.ts` | 175 | полный wizard: все шаги → поток создан | Б-4 | удалить | `runners/u7-bot/tests/e2e/mentor-management.e2e.test.ts:299` |
| `runners/u7-bot/tests/mentor/mentor.integration.test.ts` | 270 | wizard: ввод ID группы и инвайт-ссылки → оба поля сохранены в потоке | Б-4 | удалить | `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:550`, `:581` + `runners/u7-bot/tests/e2e/mentor-management.e2e.test.ts:299` |
| `runners/u7-bot/tests/mentor/mentor.integration.test.ts` | 359 | wizard: отмена создания потока через /cancel | Б-4 | удалить | `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:805` + `runners/u7-bot/tests/e2e/mentor-management.e2e.test.ts:400` |
| `runners/u7-bot/tests/streams/catalog.integration.test.ts` | 66 | list: показывает enrollment и active потоки | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.test.ts:37` |
| `runners/u7-bot/tests/streams/catalog.integration.test.ts` | 78 | list: скрывает completed и archived по умолчанию | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.test.ts:69` |
| `runners/u7-bot/tests/streams/catalog.integration.test.ts` | 89 | list-with-completed: показывает завершённые | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.test.ts:105` |
| `runners/u7-bot/tests/streams/catalog.integration.test.ts` | 102 | handleStart: кнопка «📚 Потоки курсов» отсутствует в главном меню | Б-4 | удалить | `runners/u7-bot/tests/e2e/main-menu.e2e.test.ts:93` (состав меню гостя) |
| `runners/u7-bot/tests/streams/catalog.integration.test.ts` | 109 | легенда цветных кружков | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.test.ts:37` (легенда переезжает туда из `:231`) |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts` | 82 | view: показывает карточку enrollment-потока | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:137` |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts` | 91 | view: кнопки Программа, Детали, Назад к списку | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:196` |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts` | 109 | view: нет менторских lifecycle-кнопок (ментор своего потока) | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:223` |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts` | 129 | program: показывает карточку программы модуля | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:241` |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts` | 137 | program: кнопка «Назад к потоку» | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:659` |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts` | 146 | details: показывает детали потока | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:285` |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts` | 153 | details: кнопка «Назад к потоку» | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:310` |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts` | 233 | students: кнопка «👥 Студенты» в карточке потока | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:196` |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts` | 248 | students: кнопка студента ведёт в view-stream:student-detail (не monitor) | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:560` |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts` | 266 | students: публичный режим НЕ содержит кнопок ⛔✅🔄 | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:367` |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts` | 276 | students: публичная карточка студента (student-detail) | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:381` |

## Переписать (5)

1. `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:297` — свести к `test.each(OPTIONAL_FIELDS)`: accept каждого из пяти полей ведёт на `nextStep` из таблицы (шаги 4–8).
2. `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:320` — то же для `skip-<field>`: пустое поле и переход на `nextStep`.
3. `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:426` — то же для ввода текста: `#handleOptionalFieldInput` по любому шагу 4–8 пишет значение в `ctx[fieldName]` и ведёт дальше.
4. `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:692` — оставить только коды кнопок проекта (мосты в `nav-tree`); крошки, `prev`/`next` и `enterable` — правило `stream-nav-resolver.ts`, покрыто `runners/u7-bot/src/controllers/streams/stream-nav-resolver.test.ts:114`.
5. `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.test.ts:231` — оставить один кейс «название потока со спецсимволами → plain-текст кнопки без экранирования»; легенду статусов перенести в `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.test.ts:37`.

## Слить (5)

1. `…/mentor/stories/create-stream.test.ts:342` → `:297` — строка «accept для `result`».
2. `…/mentor/stories/create-stream.test.ts:384` → `:297` — строка «accept для `targetAudience`».
3. `…/mentor/stories/create-stream.test.ts:363` → `:320` — строка «skip для `rules`».
4. `…/mentor/stories/create-stream.test.ts:405` → `:320` — строка «skip для `additional`».
5. `…/mentor/stories/create-stream.test.ts:448` → `:426` — строка «ввод `additional`».

## Перенести (10)

Переносы — следствие удаления двух файлов-двойников (`З9` → Б-5); тесты переезжают без изменения ассертов.

1. `…/learning/stories/hub.student-events.test.ts:63` → `…/learning/stories/hub.test.ts` — подписка идёт на FQN `stream.student.completed`, а не на legacy `student.completed`.
2. `…/streams/stories/inactivity.story.student.test.ts:118` → `…/inactivity.story.test.ts` — FQN-сторож трёх подписок `StudentEvents.*.name`, legacy-имён `student.*` нет (заменяет удаляемый `inactivity.story.test.ts:223`).
3. `…:152` → там же — `warning` без профиля и без `telegramId` у профиля: пропуск без исключения и без отправки (`test.each`, 2 кейса).
4. `…:198` → там же — `candidate`: поток недоступен → ментор неизвестен, отправки нет.
5. `…:204` → там же — `candidate`: у ментора нет `telegramId` → отправки нет.
6. `…:226` → там же — `abandoned`/`self`: ментору `notify` kind `info` «покинул учёбу … по собственному желанию».
7. `…:240` → там же — `abandoned`/`mentor`+`inactivity`: студенту `notify` kind `warn` «снят с учёбы … за бездействие».
8. `…:253` → там же — `abandoned`/`by_mentor`: студенту текста нет (Т6), кик есть.
9. `…:261` → там же — `abandoned`: поток недоступен → уведомление пропущено, исключения нет.
10. `…:268` → там же — `abandoned`: у студента нет `telegramId` → кика нет, уведомление невозможно.

## Остающиеся проверки `label`

Нет: в области (27 файлов) ни одного `expect(...label)` — ни отдельным `it`, ни одиночным ассертом внутри полезного теста (проверено `grep -rn "\.label"` по тестам области). Тексты отказов проверяются только как реплики пользователю (`toContain('уже не учится')` и т. п.), это поведение стори, а не `label` Def.

## Состав модуля

В боте нет паспортов Def (Б-7 в области — 0 случаев), поэтому «тест состава на модуль» здесь — только реестры контроллеров:

- `runners/u7-bot/src/controllers/learning/controller.test.ts:16` («стори имеют уникальные имена») — **остаётся**: дубль имени ломает маршрут по `path`, больше нигде не проверяется.
- `runners/u7-bot/src/controllers/learning/controller.test.ts:10`, `:24` и `runners/u7-bot/src/controllers/streams/controller.test.ts:56` — **удаляются**: падают при добавлении стори и ничего не защищают.
- FQN-сторожа подписок (`hub`: `:63`, `inactivity`: `:118` student-файла) — сохраняются переносом, это единственная защита от возврата к legacy-именам `student.*`.

Перечисления состава на уровне домена и модуля (`domain/src/stream/stream.module.student.test.ts:38,47,57`, `modules/stream/src/stream.module.map.test.ts:52,74`) этой таблицей не затрагиваются — они вне области бота и разбираются в срезах `stream-app`/`stream` (Б-7).

## Итог

**Всего строк в таблице: 112** — 99 кандидатов инвентаризации (из 102) + 13 строк пересмотра.

| действие | сколько |
|---|---|
| удалить | 90 |
| перенести | 10 |
| слить | 5 |
| переписать | 5 |
| отложить до course-dmg | 2 |

**Ожидаемое состояние области:** 238 объявлений / **252 кейса** (было 333 / 335). Арифметика:

- −90 кейсов: удаления (все — по одному кейсу на объявление);
- −5 объявлений / +7 кейсов: шаги 4–8 визарда (`create-stream.test.ts`) — 8 объявлений и 8 кейсов превращаются в 3 `test.each` по `OPTIONAL_FIELDS` (5 кейсов accept + 5 skip + 5 ввод = 15 кейсов);
- переносы и переписывания число кейсов не меняют (perенос `:152` — `test.each` с 2 кейсами уезжает целиком).

Из 252 кейсов **2 остаются красными** — `tests/e2e/student-dmg.e2e.test.ts:122`, `:251` (TR-57). Ожидаемый итог прогона: **250 pass, 2 fail**.

**Файлы, исчезающие целиком (2):** `runners/u7-bot/src/controllers/learning/stories/hub.student-events.test.ts`, `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts`. Остальные файлы после чистки живут: в `tests/e2e/stream-dmg.e2e.test.ts` остаётся `:84`, в `tests/mentor/mentor.integration.test.ts` — `:71`, в `tests/streams/catalog.integration.test.ts` — `:118`, в `tests/streams/view-stream.integration.test.ts` — 7 полезных.

**Кандидатов инвентаризации не вошло — 3:**

- `runners/u7-bot/src/controllers/learning/stories/nav-tree.test.ts:414` — оставлен: единственная проверка ветки стори `nav-tree.ts:131` (экран «Шаг или уровень не найден или недоступен»), резолвер её не покрывает.
- `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:755` — оставлен: единственная проверка guard-а `view-stream.story.ts:307` («⛔ Тела шагов недоступны»), он срабатывает до резолвера.
- `runners/u7-bot/tests/e2e/stream-dmg.e2e.test.ts:84` — оставлен по решению среза 2: после чистки это единственный e2e «шина → контроллер → sender» в файле.

**Оценка пересмотрена по 4 строкам:**

- `…/nav-tree.test.ts:414`, `…/view-stream.story.test.ts:755` — инвентаризация предлагала удалить, оставлено (обоснование выше).
- `tests/e2e/stream-dmg.e2e.test.ts:84` — инвентаризация предлагала удалить, оставлено (решение среза 2).
- `tests/e2e/student-dmg.e2e.test.ts:122` — не кандидат инвентаризации, но попадает в таблицу как `отложить до course-dmg` по решению среза 3 (вместе с кандидатом `:251`).

**Спорные строки:**

1. `…/nav-tree.test.ts:414` — если считать ветку `if (!navLevel)` недостижимой защитой, тест лишний; я исхожу из того, что прямой клик по заблокированному шагу — реальный вход пользователя.
2. `…/view-stream.story.test.ts:755` — тот же аргумент для guard-а `step`-уровня зрителя: текст отказа у стори свой, резолвер отдаёт только `null`.
3. `…/mentor/stories/create-stream.test.ts:297`/`:320`/`:426` — слияние в `test.each` даёт +7 кейсов: проверка таблицы `OPTIONAL_FIELDS` становится шире, объявлений меньше на 5.
4. `tests/mentor/mentor.integration.test.ts:71` — оставлен smoke, хотя `:85`/`:94` частично его дублируют (перечисление 4 статусов фикстур уходит в smoke только по смыслу, не по ассертам).
5. `…/streams/stories/inactivity.story.test.ts:223` — удаляется с заменой на перенесённый FQN-тест; если перенос отложат, файл останется без сторожа FQN в обеих версиях.

**Побочный эффект:** после чистки в `tests/e2e/student-dmg.e2e.test.ts` остаются только `:412` (идемпотентность Job) и два отложенных красных; после закрытия `course-dmg` их надо слить в `tests/e2e/user-notify.e2e.test.ts:186`, `:254` и удалить.
