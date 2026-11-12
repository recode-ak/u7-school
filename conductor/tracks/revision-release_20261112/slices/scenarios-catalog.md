# Бриф: каталог сценариев v0.2.6 (Ф1, ФР-1)

## Задача

Выписать пользовательские сценарии бота `v0.2.6` по порции. Только чтение: worktree `../u7-school-v0.2.6` не запускать, ничего не писать — ни в него, ни в текущий репозиторий. Результат — таблица в отчёте агента; в `scenarios.md` сводит оркестратор.

## Источники в `../u7-school-v0.2.6`

- `apps/u7-bot/src/controllers/<c>/ui-spec.md` — экраны и переходы (главный источник для UI-путей).
- `apps/u7-bot/src/controllers/<c>/stories/*.story.ts` — сценарии контроллера; `controller.ts` — маршруты и кнопки; `controllers/shared/routes.ts`, `buttons.ts`.
- `apps/u7-bot/src/bot.ts`, `main.ts`, `ensure-registered.ts`, `infra/bot-transport.ts` — команды, регистрация, события мессенджера.
- `packages/<m>/src/api/**/*-uc.ts` — UC (всего 71: user 10, course 23, stream 16, peer-review 7, questionnaire 10, wish 5); `*-job.ts` — Job (`stream/.../inactivity-sweep-job.ts`, `questionnaire/.../sweep-abandoned-job.ts`); ER (6) — подписчики событий в `peer-review` (2) и `wish` (4); `api/module.ts` — регистрация.
- `apps/u7-bot/tests/e2e/*.e2e.test.ts` — пути, проверенные e2e.

## Формат строки

| ID | Роль | Вход (команда, кнопка, событие, Job) | Ожидание | v0.2.6 |
|---|---|---|---|---|

- `ID` — `P<n>-<nn>` (номер порции, сквозной номер с 01).
- Роль — гость / студент / ментор / админ / проактив / мессенджер.
- Вход — что делает пользователь или что запускает путь (команда, текст кнопки, callback-маршрут, событие, Job).
- Ожидание — видимый результат: экран/текст/кнопки, сообщение другим, изменение состояния. Кратко, одной фразой; ветки (ошибка, нет прав, пусто) — отдельными строками.
- v0.2.6 — `файл:строка` (путь от корня worktree), лучше всего — место в story/контроллере, где путь реализован.

Гранулярность: один путь пользователя = одна строка; ошибочные и пустые ветки, видимые пользователю, — отдельные строки.

## Отчёт

1. Таблица строк порции.
2. Покрытие: список UC / Job / ER / story-файлов порции и ID строк, которые их покрывают. Не покрытые ни одной строкой — отдельным списком с причиной (служебный, не вызывается из бота и т. п.; такие тоже дай строкой с ролью «проактив» или «служебный», если путь достижим).
3. Неясности — списком (не угадывать).

## Порции

| Порция | Охват |
|---|---|
| П1 | гость, регистрация (`/start`, `ensure-registered`), главное меню, контроллеры `school`, `app`, `user` (notify), события мессенджера (`bot-transport`, `main.ts`); UC `user` |
| П2 | студент: каталог курсов — контроллер `courses` (студенческие пути, `content-nav.md`); UC `course` чтения |
| П3 | студент: обучение — контроллер `learning`; `streams` в части студента; UC `stream/student` |
| П4 | ментор: контроллер `mentor`, `streams` в части ментора, inactivity (`inactivity.story.ts`); UC `stream/stream` |
| П5 | админ: курсы (правка, публикация), роли, назначение менторов — `courses` (админские пути), `mentor` (управление менторами), UC `course` записи и `user` ролей |
| П6 | `peer-review`: контроллер, UC, ER |
| П7 | `questionnaire` + `wish`: контроллер `questionnaire`, UC, ER `wish`, Job `sweep-abandoned` |
| П8 | сквозное: Job `inactivity-sweep`, планировщик Job, отсев повторов, сессии бота, пагинация, обработка ошибок и неизвестных команд |

Пересечения порций допустимы — оркестратор уберёт дубли при сведении.

## Отчёты агентов

Таблицы строк — в [scenarios.md](../scenarios.md); ниже — покрытие и неясности каждой порции.

### Отчёт П1 (dmg-test-designer, Sonnet, 2026-11-12)

Отчёт П1 (worktree /home/nur/dev/kalki/u7-school-v0.2.6, только чтение). Пути в колонке v0.2.6 — от корня worktree. Сокращения: ui-app = apps/u7-bot/src/core/ui-app.ts, bt = apps/u7-bot/src/infra/bot-transport.ts, hub = apps/u7-bot/src/controllers/school/stories/school-hub.story.ts, sc = apps/u7-bot/src/controllers/school/controller.ts.

#### 2. Покрытие

Каждый из UC user, Job и ER в П1 охвачен строками ниже. Разбор по виду.

**UC `user`** — в `packages/user/src/api/module.ts` зарегистрировано 9 (не 10, см. неясность 1):
- `register-guest` — P1-01, P1-43..P1-45 (через ensureRegisteredGuest; актор бот-админ, UC требует ADMIN: register-guest-uc.ts:29).
- `get-user-by-telegram-id` — те же строки (проверка существования); читается и в actorResolver.
- `get-user` — P1-50, P1-51 (NotifyStory); `get-users-by-ids` — P1-12, P1-16, P1-19.
- `add-role-to-user` — P1-43, P1-45; `remove-role-to-user` — P1-44.
- `notify-user` (публикует `user.notified`) — P1-50..P1-57.
- Без строки в П1: `create-user` (поиск вызовов в apps/u7-bot/src — только ensure-registered.ts и нотификации, `create-user` не вызывается из бота; используется скриптами и CLI `apps/u7-cli`), `list-users` (аналогично — вызовы из бота не найдены, вероятно CLI и П5). Строки ролей-админа для них — на П5.
- Ветки отказов UC (USER_NOT_FOUND, ACCESS_DENIED, TELEGRAM_ID_TAKEN) видимого пользователю пути не имеют — только unit-тесты `packages/user/src/api/user/*-uc.test.ts`.

**Job** — в `user` нет (`module.ts`: `jobs = []`). Job'ы inactivity-sweep и sweep-abandoned — П8 и П7.

**ER** — в `user` нет (`reactions = []`). Подписчик `user.notified` — стори NotifyStory (P1-50..P1-53), а не ER. ER чужих модулей, шлющие уведомления (peer-review: P1-57, wish: P1-58), — основной разбор в П6 и П7.

**Story-файлы и тесты**: `school/stories/school-hub` P1-12, 13, 20, 22; `school-info` P1-14, 15, 22; `school-reviews` P1-16..19; `community` P1-20, 22; `school/controller.ts` P1-43..48; `app/app-controller.ts` P1-03, 23..27; `user/stories/notify` P1-50..53; `core/ui-app.ts` P1-01, 02, 06..11; `infra/bot-transport.ts` P1-28..39, 49, 59; `main.ts` P1-40..42, 60..63.
E2E: `main-menu.e2e.test.ts` — P1-01..08 (остальной файл про студента — П3); `user-notify.e2e.test.ts` — P1-54, 58; `pagination.e2e.test.ts` — в П8, для П1 только P1-17 (не открывал, ссылка по теме).

**Не покрыто строкой**: нет. Служебные пути выделены как «сервис» (P1-60..63) и «мессенджер» (P1-36..40).

#### 3. Неясности

1. В брифе «user 10 UC», в `packages/user/src/api/module.ts` — 9 (create-user, get-user, get-users-by-ids, list-users, get-user-by-telegram-id, register-guest, add-role, remove-role, notify). Файл `user-uc.ts` — абстрактный базовый класс, не UC. Десятого не нашёл; если брифовая цифра включает базовый класс, это ошибка подсчёта.
2. `handleChatMember` и `handleMyChatMember` в `bt:366-437` реализованы, но в `main.ts:166-167` не подключены: регистрируются только `callback_query:data` и `message:text` (grep по `src` без тестов: других мест нет). Хотя `chat_member` и `my_chat_member` включены в `allowed_updates` (main.ts:177-182). Значит, P1-43..P1-47 в реальной эксплуатации v0.2.6 события не получают: роль SUBSCRIBER по входу/выходу из группы не выдаётся и не снимается, если обработчик не навешан где-то ещё. Строки описывают намеренное поведение по коду и тестам, а не подтверждённый рабочий путь. Нужна проверка при сверке: подключён ли обработчик (в тестовом стенде transport он вызывается напрямую) или это дефект v0.2.6.
3. P1-12: в ui-spec.md (SH01) кнопка называется «💬 Сообщество», в коде — «👥 Сообщество». Взял код.
4. P1-20: ui-spec.md SH04 говорит «Стори CommunityStory»; её callback только unknownCommand, сообщение — «⚠️ Неизвестное сообщение», сам переход — URL-кнопка на группу.
5. P1-60..63 — служебные пути запуска (не пользовательские сценарии бота); оставляю на усмотрение оркестратора, переносить ли их в `scenarios.md`.
6. P1-04: условие «💬 Отзывы» (≥1 кампании или входящих отзывов) зависит от `get-my-campaigns`/`list-my-reviews` — разбор в П6; в П1 только как часть состава меню.
7. `kick_member` P1-49 запускается из снятия с учёбы (stream/mentor) — основной сценарий в П4/П8, здесь только механика транспорта.

### Отчёт П2 (dmg-test-designer, Sonnet, 2026-11-12)

Отчёт П2 (студент: каталог курсов, `courses`, UC `course` чтения). Только чтение, ничего не запускал и не писал.

Пути ниже даны от `/home/nur/dev/kalki/u7-school-v0.2.6`. Сокращения:
- `CAT` = `apps/u7-bot/src/controllers/courses/stories/course-catalog.story.ts`
- `RES` = `apps/u7-bot/src/controllers/courses/course-nav-resolver.ts`
- `SPEC` = `apps/u7-bot/src/controllers/courses/ui-spec.md`

Каталог доступен всем ролям, включая гостя. Все query-UC курса имеют `requiresAuth=false`, `list-courses` без actor отдаёт только PUBLISHED. Роль в таблице — «гость/студент», путь одинаков. Callback-префикс — `course:course-catalog:*`.

#### 2. Покрытие

Контроллер `courses`: `controller.ts` — реестр из 3 story (`CourseCatalogStory`, `WishInviteStory`, `WishConfirmedStory`); `course-nav-resolver.ts`.

Story:
- `course-catalog.story.ts` — P2-01…P2-61.
- `wish-invite.story.ts` и `wish-confirmed.story.ts` — не покрыты в П2 (проактив на события `wish.invited` / `wish.confirmed`, рассылка приглашений и уведомлений менторам). Строк не писал, оставил П7 («ER wish»). Часть этого вне П2 по таблице порций; отмена из приглашения (P2-49…P2-59) всё же описана.

UC `course` чтения и их использование ботом (все 13 относятся к «чтениям»):
- `list-courses` — P2-01, P2-02, P2-03, P2-05 (`CAT:678`).
- `get-course` — P2-04 (подгрузка курса по id).
- `get-course-by-module` — P2-17, P2-24 (fallback), также `wish-confirmed`.
- `get-module` — P2-08, P2-15 (названия, fallback «Модуль xxxxxxxx»).
- `get-module-snapshot` — P2-08, P2-15, P2-18, P2-23, P2-30, P2-29.
- `get-steps-by-lessons` — P2-23, P2-30, P2-37.
- `list-user-wishes`, `create-course-wish`, `create-module-wish`, `cancel-wish` — не `course`; вызывает контроллер (П7 / wish).

Не покрыты ни одной строкой П2 (не вызываются из каталога бота):
- `get-lesson`, `get-step` (`step-view`/`nav-tree` в learning, `view-stream.story` — П3/П4), `get-course-program`, `get-module-place` (`learning/stories/hub.ts` — П3), `which-courses-include-module`, `resolve-content-path` (не вызывается нигде в `apps` — служебный/для API и CLI), `list-modules` (`mentor/stories/create-stream.ts` — П4). `get-course-program` и `which-courses-include-module` вызываются только фасадом `packages/course/src/infra/course-in-proc-facade.ts` (служебные, для межмодульных связей `wish`/`stream`).
- Эти UC (`get-course`, `get-course-by-module`, `get-module-snapshot`, `get-module`, `list-courses`, `get-steps-by-lessons`) в «чтениях» П2 входят, остальные — в других порциях.
- `create-*`, `add-*`, `enrich-module`, `publish-module` — П5 (запись).
- Job и ER: в П2 нет (`CourseApiModule.reactions = []`, `jobs = []`).

#### 3. Неясности

1. Смысл статуса `confirmed` при повторном apply: код показывает «📚 Ты уже обучаешься на этом курсе» для `confirmed`, а «📝 Ты уже выразил желание» для остальных (`expressed`); в SPEC:W04 «обучается» относится к `fulfilled`/обучению, `confirmed` — «желание подтверждено после анкеты». Это расхождение текста и статуса — оставлено как есть (P2-46), ревизору проверить.
2. SPEC:W01 для `fulfilled` обещает клик → W04 «уже обучаешься»; в коде карточка при `fulfilled` показывает «🎓 Хочу пройти курс» (P2-39, `RES:72-85`), а `create-course-wish` в этом случае возвращает conflict со статусом — какой именно статус (и текст) придёт, из story не видно. Нужно сверить с UC `create-course-wish` (П7).
3. Ветка ids-форматов `lessons`/`project` с несколькими старыми форматами колбэков (legacy) — оставлена в одной строке на формат только там, где есть различия в поведении; нужны ли старые форматы в новой версии — решение оркестратора.
4. `get-module-snapshot`/`get-module`/`list-courses` в каталоге вызываются без actor (анонимная видимость): студент и ментор видят те же PUBLISHED-материалы, что и гость. В SPEC («Кому: всем ролям») подтверждено; отдельных строк для ментора/админа не писал.
5. В P2-61 e2e `pagination.e2e.test.ts:254` проверяет только вход через «Курсы» — что именно проверяется кроме этого, не вникал.
6. Номера строк в RES для кнопки «⬅️ Назад к проекту» (P2-36) даны приблизительно (`~415-422`, файл читал до ~420 строки).

### Отчёт П3 (dmg-test-designer, Sonnet, 2026-11-12)

Отчёт П3 (студент: обучение, `learning`, `streams` в части студента, UC `stream/student`). Только чтение, ничего не запускал и не писал.

Сокращения путей в колонке v0.2.6 (все от корня worktree `../u7-school-v0.2.6`):
- `L` = `apps/u7-bot/src/controllers/learning`
- `S` = `apps/u7-bot/src/controllers/streams`
- `U` = `packages/stream/src/api/student`

#### 2. Покрытие

**Story-файлы порции:**
- `L/stories/hub.ts` — P3-01..06, 29..38.
- `L/stories/step-view.ts` — P3-07..16.
- `L/stories/nav-tree.ts` — P3-17..24.
- `L/stories/progress.ts` — P3-25..28.
- `S/stories/stream-catalog.story.ts` — P3-39..43.
- `S/stories/view-stream.story.ts` — P3-44..64.
- `S/stories/inactivity.story.ts` — P3-66..69, 73 (SIN-M для ментора — П4, источник дан в P3-70).
- `S/controller.ts` (события мессенджера) — P3-75..78.

**UC `stream/student` (9) и Job:**
- `enroll-student` — P3-55..63.
- `complete-step` — P3-10..16.
- `get-student-by-user` — служебный вызов из `getStudent` (P3-01..06, 28 и др.).
- `get-student-progress` — P3-11, 12 (перезагрузка студента), P3-53.
- `drop-student` — P3-31..34, 68.
- `mark-abandoned` — P3-74 (сторона студента; действие ментора — П4).
- `complete-student` — P3-38 (уведомление студенту); сам вызов ментором — П4.
- `inactivity-sweep-job` — P3-65, 70..72.
- `set-next-preference` — не вызывается ботом ни одной строкой (grep по `apps/u7-bot/src`: вызовов нет), поэтому не покрыт.

**ER порции:** `student.completed`, `student.inactivity-warning`, `student.abandoned` обрабатываются сториями (подписки), покрыты P3-35..38, 66, 73. ER из `peer-review` и `wish` — другие порции.

**Не покрыто строками:**
- `set-next-preference` — нет вызова из бота (возможно мёртвый код, но не проверял глубже).
- Маршрут `my-study:view:{streamId}:{stepId}` (`#showStepView`, `L/stories/step-view.ts:168-262`: просмотр пройденного шага с кнопками «◀️ Назад»/«▶️ Вперёд», «✅ Выполнено» для текущего) недостижим: в `src` нет кнопок, которые его порождают, кроме самого этого экрана. Устаревший путь после появления drill-down (P3-20); в таблицу не включён.

#### 3. Неясности и расхождения

1. `my-study:view` (см. выше): достижим ли он вообще (legacy-алиасы в транспорте, deeplink)? Решение: включать ли как отдельную строку.
2. Расхождение `ui-spec` и кода:
   - В спеке «Поздравляем» в экране завершения потока, в коде «Поздравляю» (`step-view.ts:301`).
   - Экран «🎉 Поздравляю! Вы завершили обучение в потоке!» (P3-08, `step-view.ts:75`) в спеке отсутствует.
   - Спека S05b описывает кнопки `◀️ Пред. шаг` / `След. шаг ▶️`. Что реально рисует резолвер, надо проверить в `student-nav-resolver.ts` и `@u7-scl/core/ui` (`presentNavLevel`) — детально не читал, формулировка в P3-20 взята из спеки.
3. P3-63: точные коды и тексты отказов `enroll-student` (неверный ключ, активная запись, gate, поток не в наборе) лежат в `StreamAr.enroll()` (`packages/stream/src/domain`), я их не раскрывал; в таблице — общая формулировка. В П4/сверку лучше добавить отдельные строки по каждому отказу после чтения домена.
4. P3-39..54 (каталог, карточка, программа, студенты) доступны всем ролям, включая ментора и админа; режим ментора (S02m, lifecycle-кнопки, student-actions) — П4. Дубли с П1 (`🏫 Школа → 📚 Потоки`) и П4 уберёт оркестратор.
5. P3-75/76 (`handleMessengerEvent` в `streams`) пересекаются с П1 («события мессенджера») — я взял только ветки stream-контроллера.
6. `hub.ts:36-80` помечен как «временное исключение И3 до tasks-system» (invite-проактив) — в сверке с текущей реализацией стоит проверить, что поведение сохранено.
7. Не смотрел `apps/u7-bot/tests/e2e/*` на предмет проверки путей этой порции (в брифе они среди источников): в файлах нет явных learning-сценариев по имени. Проверить `inactivity.e2e.test.ts` и `main-menu.e2e.test.ts` стоит на этапе сводки.

### Отчёт П4 (dmg-test-designer, Sonnet, 2026-11-12)

Отчёт по П4 (ментор: `mentor`, `streams` в части ментора, inactivity, UC `stream/stream`). Файлы читал только в worktree v0.2.6, ничего не запускал и не писал. Пути в колонке v0.2.6 даны от корня worktree, сокращение: `M/` = `apps/u7-bot/src/controllers/mentor/stories/`, `S/` = `apps/u7-bot/src/controllers/streams/`, `SS/` = `apps/u7-bot/src/controllers/streams/stories/`.

#### 2. Покрытие

UC `stream/stream` (7 штук):
- `create-stream` → P4-47, P4-48.
- `activate-stream` → P4-09, P4-15, P4-16.
- `complete-stream` → P4-11, P4-12, P4-16.
- `archive-stream` → P4-14, P4-15, P4-16.
- `get-stream` → P4-08, P4-17..P4-21, P4-34 (служебный, вызывается карточками, wizard не вызывает).
- `list-streams` → P4-04..P4-07, P4-63..P4-68.
- `list-stream-students` → P4-22, P4-24, P4-63..P4-66.

Сопутствующие UC, которые зовёт ментор (кроме `stream/stream`, их владелец порции П3, дубли уберёт оркестратор):
- `mark-abandoned` → P4-26, P4-60.
- `complete-student` → P4-30.
- `get-student-progress` → P4-23, P4-25..P4-30.
- `drop-student` → P4-55.
- `get-user`, `list-modules`, `get-module` — чужие модули, используются как справочные в P4-37..P4-39.

Job: `inactivity-sweep` (19:00 UTC) покрыт как источник событий строками P4-53 и P4-58. Тело обхода (пороги 5 и 7 дней, повторы раз в 2 дня, маркер `notices`, сброс при `activate` / `completeStep`) — в П8, здесь только реакция.

ER порции: нет. В `StreamApiModule.reactions` пусто. Реакции на `stream.created` (`invite-wishers`) и `stream.completed` — в `wish` и `peer-review` (П6/П7).

Story-файлы порции:
- `mentor/stories/submenu.ts` → P4-01..P4-03.
- `my-streams.ts` → P4-04..P4-07.
- `view-stream-mentor.ts` → P4-08, P4-10..P4-16, P4-69, P4-70.
- `activate-stream.ts` → P4-09.
- `monitor.ts` → P4-22..P4-36.
- `create-stream.ts` → P4-37..P4-52.
- `streams/stories/inactivity.story.ts` → P4-53..P4-62.
- `streams/controller.ts` (события группы) → P4-63..P4-68.
- `streams/stories/view-stream.story.ts` (общая база) → P4-17..P4-23 (менторская часть); публичная часть, запись по кодовому слову (S10) и публичный список студентов — в П3.
- `streams/stories/stream-catalog.story.ts` — публичный каталог S01, в П4 не покрыт, отдаю П3 / П2 (в моей порции его нет).

Не покрыто, причина:
- `monitor:history` — P4-33 есть, но путь из UI недостижим (кнопок нет).
- `stream-nav-resolver.ts` в `streams/` (навигация) — служебный, в таблицу не включал; если им пользуются callback-ссылки, это П8.
- Публичный путь «👥 Студенты» (`view-stream:students`, `student-detail`) — П3 (там студент и гость).
- e2e `tests/e2e/mentor-management.e2e.test.ts` покрывает: P4-22 (список с ⛔✅), P4-25, P4-26, P4-28..P4-30, P4-23, P4-37..P4-47, P4-51. `tests/e2e/inactivity.e2e.test.ts` — P4-53, P4-58, P4-62, P4-54, P4-65, P4-66, P4-26.

#### 3. Неясности

1. Как показывается ошибка в lifecycle-кнопках (`#handleComplete`, `#handleArchive`, `activate-stream`): `try/catch` нет, `appApi.execute` может бросить `STREAM_CONFLICT` / `BadRequest` (P4-12, P4-15). Что видит пользователь, определяет общий обработчик ошибок диспетчера (П8). Не проверял.
2. `P4-70`: ui-spec утверждает, что в S02m есть «💬 Отзывы», а в `buildKeyboard` менторской карточки её нет. Баг v0.2.6 или осознанно? Нужно решить, что считать эталоном для регрессий.
3. Тексты кнопок исхода студента: код — «✅ окончил / ↩️ окончил, не прошёл / 🔴 забросил», ui-spec — «✅ Прошёл / ↩️ Не прошёл / 🔴 Выбыл». Взял код.
4. Возврат после снятия/завершения студента: ui-spec говорит «возврат к списку», код делает notify + `go(monitor:students:{streamId})` (список в режиме «только активные»). Взял код.
5. P4-69: админ не видит чужие потоки в «Мои потоки» (фильтр по `mentorId`), но может открыть их другим путём (каталог S01 → карточка публичная, менторский режим только через «Мои потоки»). Нужен ли отдельный путь для админа — выяснить в П5.
6. P4-41: дата вводится без валидации на шаге, проверка только в UC/схеме. Где точно отказ и какой текст — проверить в `CreateStreamCmdSchema`, в порцию не вошло.
7. P4-02/P4-03: роли «ментор» в брифе нет отдельным значением, использовал «студент/гость» для отрицательной ветки (Role MENTOR/ADMIN проверяется напрямую).
8. `SubmenuStory` пускает ADMIN и MENTOR; в P4-69 не проверял, может ли админ создать поток (`StreamPolicy.canCreate` = `UserPolicy.isMentor`; без проверки, включает ли `isMentor` админа).

### Отчёт П5 (dmg-test-designer, Sonnet, 2026-11-12)

Отчёт П5 (админ: курсы, роли, назначение менторов). Только чтение worktree `/home/nur/dev/kalki/u7-school-v0.2.6`, ничего не запускал и не писал.

**Главный вывод.** В v0.2.6 у админа нет UI-путей управления курсами, ролями и менторами. Контроллеры `courses` и `mentor` содержат только студенческие и менторские экраны. Единственное админское поведение, достижимое из бота:
- `/log_level` (по `ADMIN_TELEGRAM_IDS`, а не по роли);
- расширенный доступ роли ADMIN в экранах ментора;
- полный доступ к содержимому шагов.

Запись курсов, модулей, уроков и шагов выполняется только вызовами UC. Роли меняются автоматически: подписка на школьную группу и зачисление или снятие студента. Роли MENTOR, ADMIN и AUTHOR выдаются только вручную через UC. Поэтому строки ниже честно делятся на «из бота» и «служебные», UC вызывается через `scripts/call-uc.ts`. Ручной вызов роли в UI не обёрнут.

Пути указаны от корня worktree. Для `*-uc.ts` и policy даю строки с `execute`/`canX`.

#### 2. Покрытие

UC `course` записи: `create-course` P5-16/17; `add-phase-to-course` P5-18/19; `add-module-to-course` P5-20/21; `create-module` P5-22/23; `enrich-module` P5-24/25; `add-project` P5-26/27; `publish-module` P5-28/29; `create-lesson` P5-30/31; `create-step` P5-32/33.
UC `user` ролей: `add-role-to-user` P5-34..37, P5-40..41, P5-44; `remove-role-to-user` P5-38/39, P5-42, P5-45.
Контроллер `mentor` (админская часть): `submenu.ts` P5-05..07; `my-streams.ts` P5-08; `view-stream-mentor.ts` P5-09; `monitor.ts` P5-11; `create-stream.ts` P5-12.
Контроллер `courses` (админская часть): ui-spec/story — отдельных админских путей нет; P5-13..15.
Прочее: `app-controller.ts` — P5-01..04.

Не покрыты строками UC из «записи» курса и «ролей», которых нет в таблице: нет, все 11 покрыты. Из 23 UC `course` остальные 12 — чтения (`get-course`, `list-courses`, `get-course-program`, `get-module-place`, `get-course-by-module`, `which-courses-include-module`, `get-module`, `get-module-snapshot`, `list-modules`, `get-lesson`, `get-step`, `get-steps-by-lessons`, `resolve-content-path`), их покрывает П2; `resolve-content-path` частично — P5-14.
Story-файлы (`course-catalog`, `wish-confirmed`, `wish-invite`) — студенческие, в П2/П7, админских различий в них нет. Job и ER в П5 нет.
Не вызываются из бота: все UC P5-16..39 (только `scripts/call-uc.ts` или фасад; `add-role-to-user`/`remove-role-to-user` ещё вызываются из `school/controller.ts` и UC зачисления/снятия студента, см. P5-40..45).
Сценариев, проверенных в e2e, для админа нет: в `apps/u7-bot/tests/e2e/` ADMIN-пути не тестируются (`admin` tgId 1005 используется только в анкетных e2e как обычный пользователь). Админский `/log_level` — по `app-controller` (юнит-тесты в `apps/u7-bot/src/controllers/app/*.test.ts`, мельком не проверял содержимое).

#### 3. Неясности

1. Бриф говорит «назначение менторов» (mentor) — такого экрана или UC нет. Роль MENTOR выдаётся только вручную через `add-role-to-user` (`scripts/call-uc.ts`). Админ не может назначать менторов из бота. Назначение ментора на поток — это `mentorId` создателя потока (`create-stream.ts:781`), смены ментора нет. Подтвердить: это ожидаемое поведение v0.2.6 или отдельная фича?
2. `create-course`, `create-module`, `create-lesson`, `create-step` требуют роль AUTHOR; ADMIN сам по себе создавать не может (в `call-uc.ts` по умолчанию актор — «Nur (ADMIN + MENTOR)»; AUTHOR у него либо есть, либо нет — не проверял по данным, это живые данные). Для `LessonPolicy.canCreate` и `StepPolicy.canCreate` файлы policy не открывал; в таблице написано «без AUTHOR» по аналогии. Нужна проверка при сверке.
3. P5-09/10: открывать карточку чужого потока админ может только через публичные списки (`streams`/`view-stream`) или прямой callback, а не через «Мои потоки» (там только свои). Какой реальный путь админа к чужому потоку в UI — не прояснил (П4 охватывает `streams`).
4. P5-12: возможное расхождение — «Создать поток» в меню админа есть, но UC `create-stream` разрешён только роли MENTOR (`StreamPolicy.canCreate`). Проверить, что именно видит админ без MENTOR (текст отказа не выписывал, оставил как «отказ UC»).
5. Публикации курса как отдельного UC нет (только `publish-module`, статус модуля); публикация проектов (`publishProject` в `ModuleAr`) через UC не вызывается — это неподключённый метод домена. Для сверки с новой версией: решить, считать ли это сценарием.
6. P5-04: поведение «тишина» для не-админа проверяется по `adminTelegramIds` из конфигурации, а не по роли ADMIN пользователя: админ по роли, но не в `ADMIN_TELEGRAM_IDS`, тоже получит тишину.

### Отчёт П6 (dmg-test-designer, Sonnet, 2026-11-12)

Отчёт по П6 (`peer-review`: контроллер, UC, ER). Всё прочитано в worktree v0.2.6, ничего не запускал и не писал.

Сокращения путей: `CR` = `apps/u7-bot/src/controllers/peer-review`, `PR` = `packages/peer-review/src`, `VS` = `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts`.

#### 2. Покрытие

**UC (7 из 7).**
- `get-my-campaigns` (`PR/api/review-campaign/get-my-campaigns-uc.ts`): P6-13..18, P6-21, P6-31. Берёт активные кампании как субъекта и как ментора; `onlyLives` отсекает истёкшие.
- `get-campaign-recipients` (`PR/api/review-campaign/get-campaign-recipients-uc.ts`): P6-19..22, P6-26, P6-31.
- `create-review` (`PR/api/review/create-review-uc.ts`): P6-31..35, P6-40. Ошибки домена: `PEER_REVIEW_CAMPAIGN_NOT_FOUND`, `PEER_REVIEW_NOT_PARTICIPANT`, `PEER_REVIEW_RECIPIENT_NOT_ALLOWED`, `REVIEW_WINDOW_CLOSED`, `REVIEW_TEXT_INVALID` (10–3500).
- `get-my-review` (`PR/api/review/get-my-review-uc.ts`): P6-24, P6-25, P6-31, P6-32.
- `list-my-reviews` (`PR/api/review/list-my-reviews-uc.ts`): P6-13, P6-14, P6-18, P6-41..44.
- `list-scope-reviews` (`PR/api/review/list-scope-reviews-uc.ts`): P6-46, P6-47, P6-50.
- `list-scope-facts` (`PR/api/review/list-scope-facts-uc.ts`): P6-45.

**ER (2 из 2).**
- `create-student-campaign`: P6-01..05.
- `notify-review-recipient`: P6-36..40.

**Job.** В peer-review их нет (`jobs = []`, `PR/api/module.ts:36`).

**Story и контроллер (`CR`).**
- `controller.ts`, регистрация пяти story: P6-49.
- `invite.story.ts`: P6-06..12.
- `my-reviews.story.ts`: P6-13..18, P6-44.
- `campaign.story.ts`: P6-19..35.
- `reviews-for-me.story.ts`: P6-41..43.
- `scope-reviews.story.ts`: P6-46..48.
- `review-render.ts` и `campaign-profiles.ts` — рендер и тексты, отдельных путей не дают.
- Смежное: `VS` (кнопка в карточке потока, P6-45) и `school-reviews.story.ts` (P6-50, дубль с П1). Входят в П6 только в части peer-review.

**E2E (`apps/u7-bot/tests/e2e/peer-review-*.e2e.test.ts`).**
- `-smoke`: P6-01, P6-06, P6-09 (приглашения на реальной шине).
- `-hub`: P6-13..15, P6-21, P6-34.
- `-campaign`: P6-19..20, P6-23, P6-24, P6-31, P6-32.
- `-reviews-for-me`: P6-41, P6-44, P6-18.
- `-view`: P6-45..48.

**Не покрыто строкой:** ничего служебного не осталось. Всё, что достижимо из бота, дано строками.

**Не вынесено отдельными строками:**
- Валидация входа UC (формат UUID, пустой текст `nonEmpty`) из бота недостижима: ввод режется раньше (длина) и UUID приходят из кода кнопок.
- Внутренние события домена как контракт (`ReviewCreatedEvent`, `student-campaign.created`) вошли в строки P6-01, P6-36 и P6-40.

#### 3. Неясности

- **Н1.** В `campaign.story.ts` `#showRecipients` и `#askReview` не перехватывают `PEER_REVIEW_CAMPAIGN_NOT_FOUND` из `get-campaign-recipients`. Кнопка «Кампания не найдена» (P6-21) срабатывает, только если кампания есть в БД, но не вернулась в `get-my-campaigns` (истекла или чужая). Если кампании нет вообще, видимый результат определяет общий обработчик ошибок (П8), а не стори. Строка P6-22 фиксирует именно этот пробел.
- **Н2.** В `get-my-campaigns` вызывается `findActiveBySubject` / `findActiveByMentor`. Не проверял, что именно считает «активной» репозиторий (до истечения окна или с запасом), а значит и когда `onlyLives: false` реально вернёт истёкшую. Для UI-путей это не влияет: везде передаётся `onlyLives`, кроме `#showRecipients` / `#streamTitleOf` в `campaign.story.ts`, где фильтра нет и нужна именно «моя» кампания. Из этого следует поведение P6-21 (истёкшее окно → «Кампания не найдена»), которое подтверждает e2e `peer-review-hub.e2e.test.ts:182`.
- **Н3.** Кто попадает в `participants` при исходе «завершил»: все не-`abandoned` соученики на момент события (P6-02). Опоздавшие, кто завершит позже, в этой кампании не окажутся. Спека этого не фиксирует. Прокомментировано только в коде ER.
- **Н4.** Кто видит кнопку `💬 Отзывы` в карточке потока (P6-45): код (`VS:432-442`) зависит от `hasReviews` и `buildKeyboard`. Какие роли реально видят карточку потока, определяет П3/П4. Роли в P6-45..48 указал по спеке («всем и всегда»), права доступа к `list-scope-reviews` в UC не проверял.
- **Н5.** Строка P6-50 (`school:reviews:list`) относится к П1 (контроллер `school`). Дал как пересечение, оркестратору решать, оставлять ли в П6.

### Отчёт П7 (dmg-test-designer, Sonnet, 2026-11-12)

Отчёт П7 (questionnaire + wish). Только чтение, ничего не запускал и не писал. Все пути — от корня worktree `/home/nur/dev/kalki/u7-school-v0.2.6`.

Сокращения путей (в колонке v0.2.6):
- Q = `apps/u7-bot/src/controllers/questionnaire`
- FILL = `Q/stories/fill.story.ts`
- INV = `Q/stories/invite.story.ts`
- REN = `Q/stories/render.ts`
- CAT = `apps/u7-bot/src/controllers/courses/stories/course-catalog.story.ts`
- WP = `packages/wish/src/api`
- QP = `packages/questionnaire/src/api`

#### 2. Покрытие

UC questionnaire (9 из 10 в таблице модуля; регистрация `QP/module.ts`): 
- `start` — P7-03 (вызывается из `create-course-wish` через фасад, запускает P7-01)
- `send-likert-invite` — P7-20, P7-64
- `start-by-invite` — P7-21, P7-22
- `decline-invite` — P7-25–P7-27
- `handle-action` — P7-29–P7-32, P7-36–P7-39
- `abandon` — P7-45
- `get-current` — P7-05, P7-23, P7-24, P7-25, P7-42, P7-46
- `get-questionnaires-by-user` — P7-05, P7-65
- `get-questionnaire` — только P7-65 (из бота не вызывается)

(в `module.ts` зарегистрировано ровно 9 UC; по брифу «questionnaire 10» — расхождение, см. неясности п.1.)

UC wish (5 по брифу; в коде 4 файла `*-uc.ts`):
- `create-course-wish` — P7-01, P7-02, P7-08–P7-11
- `create-module-wish` — P7-12–P7-14
- `cancel-wish` — P7-16–P7-19
- `list-user-wishes` — P7-15, P7-63

Job: `sweep-abandoned-questionnaires` — P7-49–P7-54.

ER wish (4): `confirm-wish` — P7-55; `abandon-wish` — P7-57; `fulfill-wish` — P7-58; `invite-wishers` — P7-59, P7-60. Их UI-подписчики: `wish.confirmed` — P7-56; `wish.invited` — P7-61, P7-62.

Story-файлы порции:
- `fill.story.ts` — P7-03–P7-07, P7-28–P7-52 (кроме P7-54)
- `invite.story.ts` — P7-20–P7-28
- `render.ts` — P7-29–P7-37, P7-66
- `controller.ts` — только регистрация двух сторей (отдельной строки нет)
- тесты (`fill.dialog.test.ts`, `fill.story.continue-invite.test.ts`, `fill.story.warning.test.ts`, `inventory.test.ts`, `invite.dialog.test.ts`) и e2e (`questionnaire-ux.e2e.test.ts`, `wish-questionnaire.e2e.test.ts`) сослался в соответствующих строках

Не покрыто строкой-путём пользователя (служебные):
- `send-likert-invite` (P7-64) и `get-questionnaire` (P7-65): из бота не достижимы, в P7-64 только запись «служебный»
- `list-user-wishes` — P7-63 как служебная строка поверх P7-15
- события `questionnaire:decline`, `questionnaire:complete` на UI-уровне подписчиков в `questionnaire`-контроллере нет (на `complete` подписан ER `confirm-wish`, P7-55); подписчик `questionnaire:decline` не найден ни в `wish`, ни в UI — см. неясности п.2

#### 3. Неясности

1. Расхождение по счёту UC: бриф даёт «questionnaire 10, wish 5», в коде `QP/module.ts` зарегистрировано 9 UC, в `packages/wish/src/api/wish/` — 4 `*-uc.ts`. Недостающих (10-го questionnaire и 5-го wish) файлов `*-uc.ts` не нашёл (возможно, счёт включал Job или считал facade-методы иначе). Требует уточнения оркестратора.
2. Событие `questionnaire:decline` (отказ от приглашения, P7-26) публикуется UC `decline-invite` (`this.publishEvents(ar)`), но подписчиков в wish-ER и в UI-сторях я не нашёл. Для likert-анкет это нормально (желания нет). Нужно ли считать это пробелом — решать при сверке.
3. Откуда в реальности вызывается likert-приглашение (`send-likert-invite`, P7-20): в коде нет ни одного места вызова фасада `sendLikertInvite`, кроме самой реализации (`peer-review/ui-spec.md:518` обозначает как бэклог). Строки P7-20..P7-27 описывают только UI-реакцию на событие `questionnaire:invite`; путь «гость/студент получает likert-приглашение» достижим лишь при ручном вызове UC (`scripts/call-uc.ts`) — по сути, мёртвый на проде. Прошу решить: брать в регрессии или отложить.
4. P7-53: у timeout-ветки при отсутствии `telegramId` публикуется событие с `telegramId=undefined`, ER `abandon-wish` всё равно бросает желание, а S08 не уходит. Проверено по коду, но e2e/тестом отдельно не подтверждено.
5. Строки CAT:512-531 и CAT:596-648 привязаны к диапазонам из вывода `sed` (`#handleApply`, `#handleWishModule`, `#handleCancelConfirm`, `#handleCancelModConfirm`), маршруты кнопок на карточке курса (`courses:apply:…`) я не сверял с `controllers/shared/routes.ts` — для точных callback-строк в сведении стоит добавить П2/П3. Строки `INV:~182, ~204` в P7-27 — приблизительные (блоки `catch` внутри `#handleDeclineConfirm` и `#handleDeclineConfirmed`).
6. Строки P7-33, P7-34, P7-36–P7-38 опираются на `ui-spec.md` + `render.ts` + unit-тесты; в e2e (`questionnaire-ux.e2e.test.ts`) явно проверены только P7-29, P7-30, P7-31 и прохождение анкеты целиком; остальные ветки (stale, empty_selection) в e2e не найдены.
7. Кандидат в чистку тестов: не искал специально (задача только чтение).

### Отчёт П8 (dmg-test-designer, Sonnet, 2026-11-12)

Отчёт П8 (сквозное). Только чтение, ничего не запускал и не писал. Пути от корня worktree `/home/nur/dev/kalki/u7-school-v0.2.6`. Строки `bot-transport.ts` и `inactivity.story.ts` (стори) даны по именам файлов без полного пути: `A` = `apps/u7-bot/src/infra/bot-transport.ts`, `S` = `apps/u7-bot/src/controllers/streams/stories/inactivity.story.ts`.

#### 2. Покрытие

- Job `inactivity-sweep`: P8-01…P8-06.
- Job `sweep-abandoned` (questionnaire): сам Job — П7, здесь только планировщик (P8-17…P8-20).
- ER (подписчики событий): для П8 нет. UI-подписки стори `inactivity` на события Job и Student (`student.inactivity-warning`, `student.inactivity-remove-candidate`, `student.abandoned`): P8-02, P8-03, P8-15.
- UC порции П8: `get-student-progress`, `drop-student`, `mark-abandoned` (stream/student) вызываются из `inactivity.story.ts`. `drop-student` и `mark-abandoned` — P8-08, P8-13, P8-14 (пересечение с П3/П4). `get-student-progress` — служебно, как вспомогательный вызов P8-09/P8-12.
- Story-файл `inactivity.story.ts`: P8-02…P8-16 (e2e: `inactivity.e2e.test.ts`, строки 175, 196, 220, 233, 280, 303, 334 — `chat_member left` относится к П1/П4, здесь не разбирается).
- Сквозная часть (транспорт, ядро): `bot-transport.ts`, `ui-app.ts`, `bot-controller.ts`, `bot-ui-story.ts`, `u7-bot-ui-story.ts`, `main.ts` — P8-17…P8-50.
- Не покрыты строками П8 (причина):
  - `handleChatMember` и `handleMyChatMember` (`A:366-440`) — события мессенджера, это П1.
  - `ensure-registered` — П1.
  - Dev-режим (`scripts/dev-persona.ts`, `/persona`) — служебный, не прод-путь (`main.ts:71-81,164`).
  - `kickFromGroup` (`@deprecated`, `A:546+`) — старый вход, замещён `execute({kind:'kick_member'})`.
  - Действия мессенджера `restrict_member`, `pin_message`, `approve_join` — «зарезервировано», пустые ветки (`A:531-536`).
  - `TelegramLogger` — служебный лог для админов (`main.ts:103-121`).
  - `/log_level` — app-контроллер, П1.

#### 3. Неясности

1. **Отсев повторов команд** в `v0.2.6` не найден. Поиск `replay` / `dedup` / `duplicate` в `apps/u7-bot/src` и `packages/core/src` ничего не дал. Есть только `update_id` в логе ошибок и per-chat очередь. Похоже, механизм `data/replay` (D-56 пакета `dmg-core`) в `v0.2.6` ещё не существует. Это не баг, а значит, в `v0.2.6` повторы не отсеиваются: Telegram-ретрай `update_id` обработается дважды. Нужно решение оркестратора: строк «отсев повторов» нет.
2. Номера строк e2e и `bot-transport.test.ts` брал выборочно; полный список тестов `bot-transport.test.ts` и `bot-transport-persist.test.ts` не разбирал.
3. P8-46 (каталог) помечен как пересечение с П2/П3. Если оркестратор не хочет дублей, строку можно убрать.
4. P8-41: точные номера строк `shrink`, `expandAction` и `splitStamp` внутри `bot-transport.ts` не выписаны: я смотрел только начало и конец файла, шапка `#stamp` — около `A:891`.
5. Пользовательский сценарий «ввод недоступного студента» в `inactivity.story` отдельной кнопки в e2e не имеет (проверяется только ветка отмены, `inactivity.e2e.test.ts:233`). Ветки подтверждения самовыхода покрыты только юнит-тестами `inactivity.story.test.ts`.
6. Строки P8-16 и P8-24 различаются местом, где срабатывает «Неизвестная команда» (стори против контроллера); оркестратор может склеить.

Кандидатов в чистку тестов вне задачи не заметил.

