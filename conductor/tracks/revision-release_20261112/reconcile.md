# Сверка сценариев v0.2.6 ↔ текущая версия (ФР-2)

Строки — по [scenarios.md](./scenarios.md), тот же `ID`.

Статус: `=` совпадает · `≠ намеренно` (обязательна ссылка: трек, `D-NN` или `TR-<n>`) · `≠ регрессия` · `пропало`. Регрессии и «пропало» дублируются в [regressions.md](./regressions.md).

Столбец «e2e» — тест текущего бота `runners/u7-bot/tests/e2e/…`, проходящий путь, или «нет» (→ [e2e-gaps.md](./e2e-gaps.md), Ф4).

Бриф и отчёты сверщиков по порциям — [slices/reconcile.md](./slices/reconcile.md). Дубль (`дубль <основная>`) наследует статус и e2e основной строки. Номера строк «Сейчас» местами приблизительные (±5…20, см. отчёты).

## Итог (2026-11-12)

491 строка (483 П1–П8 + 8 П0):

| Статус | Строк |
|---|---|
| `=` | 356 |
| `≠ намеренно` | 61 |
| `≠ регрессия` | 2 (P3-27, P8-05) |
| `пропало` | 0 |
| `дубль` | 72 |

Перенесённый дефект v0.2.6 (статус `=`, код тот же): события групп (`chat_member`, `my_chat_member`) не подключены в `runners/u7-bot/src/main.ts:193-194` — P1-43…P1-48, P4-63…P4-68 (и дубли P3-75…P3-78, P5-40…P5-43); Q-01, Q-02 → [regressions.md](./regressions.md).

e2e: из 419 строк без дублей путь проходит e2e у 129, **нет — у 290** (вход `e2e-gaps.md`, Ф4). Без e2e целиком — пути админа, lifecycle потока ментором, отказные и граничные ветки, ступени Job (часами `createTestApp` не управляет, TR-50 (3)), служебные UC П0.

Ответы на вопросы Ф2 (`scenarios.md`): Q-01/Q-02 — дефект перенесён; Q-03 — отсев повторов новый (D-56, `update-replay.e2e.test.ts`); Q-04 — отказы ловят стори (warn / экран), `≠ намеренно`; Q-05, Q-06, Q-07, Q-08, Q-17 — код обеих версий совпадает, ui-spec приведён; Q-09 — legacy-callback'и каталога сохранены (→ решение Нурболата); Q-10, Q-11 — недостижимые маршруты, как в v0.2.6; Q-12 — админ без MENTOR видит «➕ Создать поток» и получает отказ, как в v0.2.6; Q-13 — снят (authoring удалён, TR-52 (3)); Q-14 — Likert-приглашения мертвы, как в v0.2.6 (TR-51, TR-46 Q5); Q-15 — `decline` слит в `abandoned(declined)` (TR-46 Q1); Q-16 — тексты отказов сохранены, проверки «поток не в наборе» нет в обеих версиях; Q-18 — не изменилось; Q-19 — UC удалён (P0-03).

## П1 — Гость, регистрация, меню, `school`, `app`, `user`, события мессенджера

| ID | Статус | Обоснование / различие | v0.2.6 | Сейчас | e2e |
|---|---|---|---|---|---|
| P1-01 | = | то же; регистрация через UC `register-guest` от `botAdminUuid` вместо фасада | ui-app:170-193; ensure-registered.ts:19-35 | runners/u7-bot/src/core/ui-app.ts:159-178; runners/u7-bot/src/ensure-registered.ts:26-53 | tests/e2e/guest-registration.e2e.test.ts:37; tests/e2e/main-menu.e2e.test.ts:150 |
| P1-02 | = | то же; идемпотентность — `USER_TELEGRAM_ID_TAKEN` = тихий успех (TR-61 Ф5) | ui-app:106,189-192 | ui-app.ts:159-178; ensure-registered.ts:49-52 | tests/e2e/guest-registration.e2e.test.ts:55; tests/e2e/main-menu.e2e.test.ts:161 |
| P1-03 | = | то же (hub 10, courses 12, help 100) | school-hub.story.ts:23-32; app-controller.ts:35-46 | controllers/school/stories/school-hub.story.ts:18; controllers/courses/stories/course-catalog.story.ts:70; controllers/app/app-controller.ts:36-45 | tests/e2e/main-menu.e2e.test.ts:93 |
| P1-04 | ≠ намеренно | «🎓 Моя учёба» теперь по живой записи студента (`get-active-student`), а не по роли STUDENT (роль удалена); «💬 Отзывы» — то же. TR-61 (Ф3, DEBT-48) | learning/stories/hub.ts:104-116; my-reviews.story.ts:68-85 | controllers/learning/stories/hub.ts:120-142; controllers/peer-review/stories/my-reviews.story.ts:96-111 | tests/e2e/main-menu.e2e.test.ts:317 (Моя учёба); tests/e2e/peer-review-hub.e2e.test.ts:84 (Отзывы) |
| P1-05 | = | то же (MENTOR или ADMIN, через `actor.user.isMentor()/isAdmin()`) | mentor/stories/submenu.ts:32-44 | controllers/mentor/stories/submenu.ts:31-44 | tests/e2e/mentor-management.e2e.test.ts:94 |
| P1-06 | = | то же | ui-app:109,142-151,252-272 | ui-app.ts:98-99,131-140,237-257 | tests/e2e/main-menu.e2e.test.ts:171; :185; :234 |
| P1-07 | = | то же | ui-app:147-149,153-167 | ui-app.ts:131-156; core/u7-bot-ui-story.ts (contextHelp) | нет |
| P1-08 | = | то же | ui-app:213-217 | ui-app.ts:198-202; shared/app-codes.ts | tests/e2e/main-menu.e2e.test.ts:200 |
| P1-09 | = | то же | ui-app:113-122 | ui-app.ts:103-111 | нет |
| P1-10 | = | то же | ui-app:113-129 | ui-app.ts:103-118; core/u7-bot-ui-story.ts | tests/e2e/wish-questionnaire.e2e.test.ts:339; tests/e2e/mentor-management.e2e.test.ts:415 |
| P1-11 | = | то же | ui-app:131-133 | ui-app.ts:120-122 | нет |
| P1-12 | = | то же (имена менторов теперь через `findUsers` = UC `get-users-by-ids`, сбой — тихо); «👥 Сообщество» и в v0.2.6 было `👥` | school-hub.story.ts:35-99 | controllers/school/stories/school-hub.story.ts:33-81 | tests/e2e/curious-showcase.e2e.test.ts:122 (проход через хаб; текст хаба не проверяется) |
| P1-13 | = | то же | school-hub.story.ts:41-43,92 | school-hub.story.ts (кнопка «📚 Потоки»); controllers/shared/routes.ts | tests/e2e/curious-showcase.e2e.test.ts:122; :232 |
| P1-14 | = | то же | school-info.story.ts:34-56 | controllers/school/stories/school-info.story.ts:20-53 | нет |
| P1-15 | = | то же | school-info.story.ts:36-38 | school-info.story.ts:20-53 | нет |
| P1-16 | = | то же; данные через UC `list-streams` + `list-scope-reviews` (фильтр `filter.direction`) | school-reviews.story.ts:36-108 | controllers/school/stories/school-reviews.story.ts:40-156 | нет |
| P1-17 | = | то же | school-reviews.story.ts:28-33,59-60 | school-reviews.story.ts:28-60 | нет |
| P1-18 | = | то же | school-reviews.story.ts:45-50,69-76 | school-reviews.story.ts:45-85 | нет |
| P1-19 | = | то же («неизвестно») | school-reviews.story.ts:92-96 | school-reviews.story.ts:100-156 | нет |
| P1-20 | = | то же | school-hub.story.ts:91; community.story.ts:21-48 | school-hub.story.ts; controllers/school/stories/community.story.ts:21-48 | нет |
| P1-21 | = | то же | shared/buttons.ts:23-30 | controllers/shared/buttons.ts:23-30; routes.ts | tests/e2e/main-menu.e2e.test.ts:200 |
| P1-22 | = | то же | school-hub.story.ts:46; school-info.story.ts:34-36 | school-hub.story.ts; school-info.story.ts; community.story.ts:38 | нет |
| P1-23 | = | то же | app-controller.ts:97-111 | controllers/app/app-controller.ts:100-115 | нет |
| P1-24 | = | то же | app-controller.ts:62-87 | controllers/app/app-controller.ts:53-79 | нет |
| P1-25 | = | то же | app-controller.ts:89-97 | app-controller.ts:81-96 | нет |
| P1-26 | = | то же | app-controller.ts:81-88 | app-controller.ts:81-88 | нет |
| P1-27 | = | то же | app-controller.ts:59-66,69-74 | app-controller.ts:58-70 | нет |
| P1-28 | = | транспорт не менялся (кроме обёртки `BotRequestContext`) | bt:263-269 | infra/bot-transport.ts:264; 55 | нет |
| P1-29 | = | то же | bt:271-279 | infra/bot-transport.ts:58; 256-290 | tests/e2e/main-menu.e2e.test.ts:249 (сырой код без штампа) |
| P1-30 | = | то же | bt:281-287 | infra/bot-transport.ts:60-62; 256-290 | нет |
| P1-31 | = | то же | bt.test:1559 | infra/bot-transport.ts:256-290 (тест bot-transport.test.ts) | нет |
| P1-32 | = | то же | bt:326-335 | infra/bot-transport.ts:66; 310-365 | нет |
| P1-33 | = | то же | bt:68-69,327-357 | infra/bot-transport.ts:70; 310-365 | нет |
| P1-34 | = | то же | bt:337-360 | infra/bot-transport.ts:310-365 | tests/e2e/wish-questionnaire.e2e.test.ts:327; tests/e2e/mentor-management.e2e.test.ts:340 |
| P1-35 | = | то же | bt:139-164,315-318 | infra/bot-transport.ts (разбор команды, handleMessage :310) | нет |
| P1-36 | = | то же | bt:223-241 | infra/bot-transport.ts:224-245; 570-690 (#retireScreen :681) | нет |
| P1-37 | = | то же | bt.test:881 | infra/bot-transport.ts (warn при ошибке API) | нет |
| P1-38 | = | то же; апдейт ставится в очередь внутри `BotRequestContext.run(update_id)` (сквозной след, TR-61 Ф4) | bt:196-199 | infra/bot-transport.ts:876-891 (#enqueueUpdate) | нет |
| P1-39 | = | то же | bt:36-49 | infra/bot-transport.ts:937; 972 | нет |
| P1-40 | = | то же (`transport.restore()` до старта, fail-fast) | main.ts:63-92 | runners/u7-bot/src/main.ts:89-114 | нет |
| P1-41 | = | то же | main.ts:140-153 | main.ts:168-180 | нет |
| P1-42 | = | то же: только `callback_query:data`, `message:text` | main.ts:137-167 | main.ts:165-194 | нет |
| P1-43 | = | Дефект v0.2.6 перенесён (Q-01, → regressions.md): Q-01: в текущей версии `handleChatMember`/`handleMyChatMember` тоже не подключены в `main.ts` (:193-194 — только callback и text; плюс фильтр privateBot). Код транспорта и контроллера school не менялся (логика через UC), но путь недостижим на проде — дефект v0.2.6 сохранён. Решение: чинить в релизе или принять | bt:366-398; sc:35-72 | main.ts:165-194 (нет подписки); infra/bot-transport.ts:367-403; ui-app.ts:62-72; controllers/school/controller.ts:158-194 | tests/e2e/guest-registration.e2e.test.ts:67 (напрямую `uiApp.handleMessengerEvent`, минуя main/транспорт) |
| P1-44 | = | Дефект v0.2.6 перенесён (Q-01, → regressions.md): Q-01: то же — путь недостижим из Telegram | bt:390-397; sc:62-71 | infra/bot-transport.ts:367-403; school/controller.ts:175-194 | tests/e2e/guest-registration.e2e.test.ts:79 (напрямую `uiApp`) |
| P1-45 | = | Дефект v0.2.6 перенесён (Q-01, → regressions.md): Q-01: то же — `my_chat_member` не подключён | bt:403-437; sc:41-60 | infra/bot-transport.ts:404-440; school/controller.ts:168-173 | нет |
| P1-46 | = | Дефект v0.2.6 перенесён (Q-01, → regressions.md): Q-01: то же | sc:41-60 | infra/bot-transport.ts:404-440; school/controller.ts:168-173 | нет |
| P1-47 | = | Дефект v0.2.6 перенесён (Q-01, → regressions.md): Q-01: то же (поведение чужой группы/смены прав в коде то же, но не достижимо) | sc:36-39; bt:384-397,422-436 | school/controller.ts:161-165; infra/bot-transport.ts:367-440 | нет |
| P1-48 | = | Дефект v0.2.6 перенесён (Q-01, → regressions.md): Q-01: код то же (warn + stop), но недостижим из Telegram | sc:73-80 | school/controller.ts:184-191 | нет |
| P1-49 | = | то же; достижимо через `kickFromGroup` из inactivity.story | bt:509-553 | infra/bot-transport.ts:510-560; controllers/streams/stories/inactivity.story.ts:157-163 | tests/e2e/inactivity.e2e.test.ts:217; :303; tests/learning/self-drop.e2e.test.ts:54 |
| P1-50 | ≠ намеренно | событие `user.notified`, UC `notify-user`, `UserController`/`NotifyStory` удалены (продюсеров нет); сами уведомления идут напрямую из stories через `proactiveSender.notify` (заголовки `NOTICE_HEADER` те же). TR-61 С3 | user/stories/notify.story.ts:23-77 | infra/bot-transport.ts:78-84,463-480 (доставка); нет NotifyStory | нет |
| P1-51 | ≠ намеренно | путь `user.notified` удалён (TR-61 С3); аналог «нет telegramId/профиля — warn, пропуск» есть в stories (review-notify, inactivity) | notify.story.ts:39-63 | controllers/peer-review/stories/review-notify.story.ts:47-56; streams/stories/inactivity.story.ts:#notify | нет |
| P1-52 | = | то же: битый markdown в доставке — fail-fast в транспорте | bt:469-470 | infra/bot-transport.ts:463-480 | нет |
| P1-53 | = | то же | bt.test:1227 | infra/bot-transport.ts:463-480 (тест bot-transport.test.ts) | нет |
| P1-54 | дубль P3-38 | — | — | — | — |
| P1-55 | = | то же; из UC в подписку на `StudentEvents.abandoned` (`who === 'self'`) | stream/api/student/drop-student-uc.ts:80-92 | controllers/streams/stories/inactivity.story.ts:166-190 | нет (self-drop.e2e.test.ts:54 не проверяет сообщение ментору) |
| P1-56 | дубль P3-74 | — | — | — | — |
| P1-57 | дубль P6-36…P6-38 | — | — | — | — |
| P1-58 | дубль P7-61 | — | — | — | — |
| P1-59 | = | то же | bt:475-504 | infra/bot-transport.ts:487-510 | нет |
| P1-60 | = | то же тексты; проверка через субъект `callers.resolve` (`isAdmin()`), ещё и в `createUiApp` | main.ts:123-135 | main.ts:145-162; create-ui-app.ts:406-410 | нет (unit: src/create-ui-app.test.ts:88) |
| P1-61 | = | то же | main.ts:103-121 | main.ts:125-143 | нет |
| P1-62 | = | то же (`ALLOWED_UPDATES`, webhook, graceful shutdown); сигнал останавливает `app.stop()` | main.ts:174-220,234-276 | main.ts:201-247; 261-303 | нет |
| P1-63 | = | то же; `scripts/dev-persona.ts` идентичен | main.ts:71-81,161-164,222-232 | main.ts:93-109,188-191,249-259; runners/u7-bot/scripts/dev-persona.ts | нет |

## П2 — Студент: каталог курсов

| ID | Статус | Обоснование / различие | v0.2.6 | Сейчас | e2e |
|---|---|---|---|---|---|
| P2-01 | = | то же; список курсов — `list-courses` от имени актора | CAT:29-53 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:92,208 (`#handleCourse`) | curious-showcase.e2e.test.ts:242 |
| P2-02 | ≠ намеренно | TR-59 (`course-dmg`): курс без этапов — «Модули курса:» сразу, один этап — «Этап 1/1» и «Модули этапа:»; ≥2 этапов как раньше | CAT:145-193 | runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:154-200 (`resolveCourseNavLevel` course) | curious-showcase.e2e.test.ts:184 |
| P2-03 | = | то же | CAT:149-156 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:208-232 | нет |
| P2-04 | = | то же; ошибка самого `list-courses` теперь показывает warn-реплику, а не «нет курсов» (ERR-06), подгрузка `get-course` по id сохранена | CAT:149-166 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:735-757 (`#loadCourses`), :208-262 | нет |
| P2-05 | = | то же | RES:136-146 | runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:154-230 | pagination.e2e.test.ts:198 (только «След. курс») |
| P2-06 | = | то же | RES:147-150 | runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:154-230 | curious-showcase.e2e.test.ts:208 |
| P2-07 | = | то же (`phases:` → карточка курса); legacy сохранён | CAT:56-58 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:97-99 | нет |
| P2-08 | = | то же для курса с ≥2 этапами; `phase:<id>:0` у курса из одного этапа по-прежнему открывает экран этапа (TR-59) | CAT:199-235 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:265-305, runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:231-278 | curious-showcase.e2e.test.ts:185 |
| P2-09 | = | то же | CAT:203-205 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:265-275 | нет |
| P2-10 | = | то же | CAT:210-212 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:265-285 | нет |
| P2-11 | = | то же (`course.stages[idx]` вместо `phases[idx]`) | CAT:214-216 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:282-290, runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:231-236 | нет |
| P2-12 | = | то же | RES:187-197 | runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:247-275 | нет |
| P2-13 | = | то же | RES:199-203 | runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:231-278 | curious-showcase.e2e.test.ts:204 |
| P2-14 | = | то же | CAT:61-63 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:107-109 | нет |
| P2-15 | ≠ намеренно | TR-59 (`course-dmg`): у курса без этапов крошка этапа не показывается; остальной состав карточки тот же | CAT:238-302 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:307-373, runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:280-350 | curious-showcase.e2e.test.ts:186 |
| P2-16 | = | то же | CAT:243-245 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:307-317 | нет |
| P2-17 | = | то же; `get-course-by-module` через `dispatchUc`, отказ — молча пропускается | CAT:247-264 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:322-335 | нет |
| P2-18 | = | то же; отказ `get-module-snapshot` → «Модуль не найден или недоступен» | CAT:266-273 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:337-344, runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:280-290 | нет |
| P2-19 | = | то же | CAT:295-297 | runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:287-292 | нет |
| P2-20 | = | то же | RES:236-248 | runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:310-340 | нет |
| P2-21 | ≠ намеренно | TR-59 (`course-dmg`): «⬅️ Назад к этапу» только при ≥2 этапах, иначе «⬅️ Назад к курсу» | RES:249-253 | runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:338-347 | curious-showcase.e2e.test.ts:200 |
| P2-22 | = | то же | CAT:66-71 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:110-134, :707-733 | нет |
| P2-23 | ≠ намеренно | TR-59 (`course-dmg`): у курса без этапов нет крошки этапа; остальное то же (форматы `prj:`/`project:` сохранены) | CAT:305-388 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:375-455, runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:352-426 | curious-showcase.e2e.test.ts:187 |
| P2-24 | = | то же | CAT:305-336 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:375-420 | нет |
| P2-25 | = | то же | CAT:342-349 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:409-419 | нет |
| P2-26 | = | то же | CAT:351-354 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:430-455 | нет |
| P2-27 | = | то же | RES:322-333 | runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:380-425 | pagination.e2e.test.ts:181 и :239 («След. проект»/«Пред. проект») |
| P2-28 | = | то же | RES:334-338 | runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:420-424 | curious-showcase.e2e.test.ts:196 |
| P2-29 | = | то же; legacy `lessons:` сохранён (Q-09) | CAT:84-90 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:135-170, :707-733 | нет |
| P2-30 | ≠ намеренно | TR-59 (`course-dmg`): крошка этапа у курса без этапов не показывается; остальное то же (форматы `les:`/`lesson:` сохранены) | CAT:391-512 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:457-573, runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:427-510 | curious-showcase.e2e.test.ts:188 |
| P2-31 | = | то же | CAT:452-454 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:495-515 | нет |
| P2-32 | = | то же | CAT:470-473 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:535-545 | нет |
| P2-33 | = | то же | CAT:475-478 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:545-560 | нет |
| P2-34 | = | то же | CAT:427-431 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:457-475 | нет |
| P2-35 | = | то же | RES:399-414 | runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:455-510 | нет |
| P2-36 | = | то же | RES:~415-422 | runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:500-510 | curious-showcase.e2e.test.ts:192 |
| P2-37 | = | то же; `get-steps-by-lessons` через `dispatchUc`, сбой → «Шаг N» | CAT:771-789 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:812-832, runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:455-500 | нет |
| P2-38 | = | то же | CAT:305-330 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:375-420 | нет |
| P2-39 | = | то же (один `list-user-wishes`; его отказ теперь warn-реплика) | CAT:161-185 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:234-260, runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:50-85 | wish-questionnaire.e2e.test.ts:185-208 (карточка курса с wish-рядом) |
| P2-40 | = | то же | RES:51-60 | runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:50-60 | нет |
| P2-41 | = | то же | RES:62-70 | runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:62-72 | нет |
| P2-42 | = | то же; `create-course-wish` через `dispatchUc` | CAT:515-540 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:575-596 | update-replay.e2e.test.ts:134 |
| P2-43 | = | то же | CAT:527-529 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:588-593 | wish-questionnaire.e2e.test.ts:250 |
| P2-44 | = | то же | CAT:541-557 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:600-614 | wish-questionnaire.e2e.test.ts:373 |
| P2-45 | = | то же | CAT:559-571 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:615-626 | нет |
| P2-46 | = | то же («Ты уже обучаешься» — как в v0.2.6, Q-07) | CAT:559-571 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:615-626 | нет |
| P2-47 | = | то же | CAT:515-518 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:575-582 | нет |
| P2-48 | = | то же по виду: warn-реплика (`ucErrorNotify` вместо `errorNotify`) | CAT:571-572 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:598-600 | нет |
| P2-49 | = | то же | CAT:114-123 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:177-186 | user-notify.e2e.test.ts:152 |
| P2-50 | = | то же | CAT:124-125 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:657-681 | user-notify.e2e.test.ts:157 |
| P2-51 | = | то же | CAT:616-622 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:671-678 | нет |
| P2-52 | = | то же | CAT:623 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:678 | нет |
| P2-53 | = | то же | CAT:574-596 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:173-174, :631-655 | нет |
| P2-54 | = | то же | CAT:587-592 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:646-652 | нет |
| P2-55 | = | то же | CAT:593 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:652 | нет |
| P2-56 | = | то же | CAT:126-135 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:189-198 | нет |
| P2-57 | = | то же | CAT:136-137 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:683-704 | нет |
| P2-58 | = | то же | CAT:645-650 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:697-704 | нет |
| P2-59 | = | то же | CAT:651 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:704 | нет |
| P2-60 | = | то же | CAT:138-139 | runners/u7-bot/src/controllers/courses/stories/course-catalog.story.ts:202 | нет |
| P2-61 | = | то же: каталог — карточки без `pagedScreen` | content-nav.md §5 | runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:154-510 | pagination.e2e.test.ts:198 |

## П3 — Студент: обучение, `streams` (студент)

| ID | Статус | Обоснование / различие | v0.2.6 | Сейчас | e2e |
|---|---|---|---|---|---|
| P3-01 | = | то же; кнопка теперь по живой записи студента (user-dmg_20261111, роли STUDENT нет), приоритет 20 | `apps/u7-bot/src/controllers/learning/stories/hub.ts:104`, `:122`; `apps/u7-bot/src/controllers/learning/ui-spec.md` S05 | `runners/u7-bot/src/controllers/learning/stories/hub.ts:120` | main-menu.e2e.test.ts:317 |
| P3-02 | = | то же: без живой записи кнопки нет (раньше — без роли STUDENT; user-dmg_20261111) | `apps/u7-bot/src/controllers/learning/stories/hub.ts:105-116` | `runners/u7-bot/src/controllers/learning/stories/hub.ts:120` | нет |
| P3-03 | = | то же | `apps/u7-bot/src/controllers/learning/stories/hub.ts:133-158` | `runners/u7-bot/src/controllers/learning/stories/hub.ts:155` | main-menu.e2e.test.ts:317 |
| P3-04 | = | то же | `apps/u7-bot/src/controllers/learning/stories/hub.ts:134-139` | `runners/u7-bot/src/controllers/learning/stories/hub.ts:155` | нет |
| P3-05 | = | то же (категория исхода из student.outcome) | `apps/u7-bot/src/controllers/learning/stories/hub.ts:127-130`, `:149-158` | `runners/u7-bot/src/controllers/learning/stories/hub.ts:155` | нет |
| P3-06 | = | то же | `apps/u7-bot/src/controllers/learning/shared.ts:20-41`; `apps/u7-bot/src/controllers/learning/stories/hub.ts:123-124` | `runners/u7-bot/src/controllers/learning/shared.ts:74` | нет |
| P3-07 | = | то же; расчёты прогресса через getStudentProgress | `apps/u7-bot/src/controllers/learning/stories/step-view.ts:62-104`, `:266-295`; `apps/u7-bot/src/controllers/learning/shared.ts:188` | `runners/u7-bot/src/controllers/learning/stories/step-view.ts:89` | main-menu.e2e.test.ts:328 |
| P3-08 | = | то же | `apps/u7-bot/src/controllers/learning/stories/step-view.ts:71-78` | `runners/u7-bot/src/controllers/learning/stories/step-view.ts:98` | нет |
| P3-09 | = | то же (module.completed >= total) | `apps/u7-bot/src/controllers/learning/stories/step-view.ts:86-96`, `:297-306` | `runners/u7-bot/src/controllers/learning/stories/step-view.ts:125` | нет |
| P3-10 | = | то же | `apps/u7-bot/src/controllers/learning/stories/step-view.ts:106-163`; `packages/stream/src/api/student/complete-step-uc.ts:49-73` | `runners/u7-bot/src/controllers/learning/stories/step-view.ts:136` | main-menu.e2e.test.ts:328 |
| P3-11 | = | то же; сумма шагов проекта — по дереву навигации | `apps/u7-bot/src/controllers/learning/stories/step-view.ts:143-160`, `:310-340`; `apps/u7-bot/src/controllers/learning/shared.ts:281-322` | `runners/u7-bot/src/controllers/learning/stories/step-view.ts:357` | нет |
| P3-12 | = | то же | `apps/u7-bot/src/controllers/learning/stories/step-view.ts:143-160`; `apps/u7-bot/src/controllers/learning/shared.ts:340-346` | `runners/u7-bot/src/controllers/learning/shared.ts:303` | нет |
| P3-13 | = | то же | `apps/u7-bot/src/controllers/learning/stories/step-view.ts:139-141`, `:297-306` | `runners/u7-bot/src/controllers/learning/stories/step-view.ts:357` | нет |
| P3-14 | = | то же | `apps/u7-bot/src/controllers/learning/stories/step-view.ts:134-137` | `runners/u7-bot/src/controllers/learning/stories/step-view.ts:166` | нет |
| P3-15 | = | то же | `apps/u7-bot/src/controllers/learning/stories/step-view.ts:117-121` | `runners/u7-bot/src/controllers/learning/stories/step-view.ts:149` | нет |
| P3-16 | = | то же | `apps/u7-bot/src/controllers/learning/stories/step-view.ts:107-110` | `runners/u7-bot/src/controllers/learning/stories/step-view.ts:140` | нет |
| P3-17 | = | то же; дерево — из getStudentProgress | `apps/u7-bot/src/controllers/learning/stories/nav-tree.ts:32-111`, `:117-127`; `apps/u7-bot/src/controllers/learning/student-nav-resolver.ts`; `apps/u7-bot/src/controllers/learning/ui-spec.md` S05b | `runners/u7-bot/src/controllers/learning/stories/nav-tree.ts:41` | main-menu.e2e.test.ts:362 |
| P3-18 | = | то же | `apps/u7-bot/src/controllers/learning/stories/nav-tree.ts:51-62`, `:129-145`; `apps/u7-bot/src/controllers/learning/student-nav-resolver.ts` | `runners/u7-bot/src/controllers/learning/stories/nav-tree.ts:41` | main-menu.e2e.test.ts:362 |
| P3-19 | = | то же | `apps/u7-bot/src/controllers/learning/stories/nav-tree.ts:63-71`; `apps/u7-bot/src/controllers/learning/student-nav-resolver.ts` | `runners/u7-bot/src/controllers/learning/stories/nav-tree.ts:41` | main-menu.e2e.test.ts:362 |
| P3-20 | = | то же | `apps/u7-bot/src/controllers/learning/stories/nav-tree.ts:72-92`; `apps/u7-bot/src/controllers/learning/student-nav-resolver.ts` | `runners/u7-bot/src/controllers/learning/stories/nav-tree.ts:41` | нет |
| P3-21 | = | то же (3200/3100) | `apps/u7-bot/src/controllers/learning/student-nav-resolver.ts:263-264` | `runners/u7-bot/src/controllers/learning/student-nav-resolver.ts:268` | нет |
| P3-22 | = | то же | `apps/u7-bot/src/controllers/learning/stories/nav-tree.ts:105-107` | `runners/u7-bot/src/controllers/learning/stories/nav-tree.ts:41` | нет |
| P3-23 | = | то же | `apps/u7-bot/src/controllers/learning/stories/nav-tree.ts:42-45`, `:165` | `runners/u7-bot/src/controllers/learning/stories/nav-tree.ts:41` | нет |
| P3-24 | = | то же | `apps/u7-bot/src/controllers/learning/stories/nav-tree.ts:37-40` | `runners/u7-bot/src/controllers/learning/stories/nav-tree.ts:41` | нет |
| P3-25 | = | то же | `apps/u7-bot/src/controllers/learning/stories/progress.ts:32-151`; `apps/u7-bot/src/controllers/learning/ui-spec.md` S06 | `runners/u7-bot/src/controllers/learning/stories/progress.ts:35` | main-menu.e2e.test.ts:393 |
| P3-26 | = | то же | `apps/u7-bot/src/controllers/learning/stories/progress.ts:38-42` | `runners/u7-bot/src/controllers/learning/stories/progress.ts:44` | нет |
| P3-27 | ≠ регрессия | v0.2.6: «⚠️ Программа потока не найдена.» при пустом contentSnapshot; сейчас снапшот в контракте всегда есть (пустой даёт нулевой прогресс), при отсутствии потока — warn из ucErrorNotify, при пустом progress — warn «Поток не найден». Текст и случай «нет снапшота» пропали; ссылки на решение нет | `apps/u7-bot/src/controllers/learning/stories/progress.ts:51-53` | `runners/u7-bot/src/controllers/learning/stories/progress.ts:56-66` | нет |
| P3-28 | = | то же | `apps/u7-bot/src/controllers/learning/stories/progress.ts:33-34` | `runners/u7-bot/src/controllers/learning/shared.ts:55` | нет |
| P3-29 | = | то же | `apps/u7-bot/src/controllers/learning/stories/hub.ts:165-178` | `runners/u7-bot/src/controllers/learning/stories/hub.ts:196` | нет |
| P3-30 | = | то же | `apps/u7-bot/src/controllers/learning/stories/hub.ts:174` | `runners/u7-bot/src/controllers/learning/stories/hub.ts:196` | нет |
| P3-31 | = | UC dropStudent не шлёт уведомление и не снимает роль: ментору текст шлёт InactivityStory по student.abandoned (тот же текст), кик — там же; роли STUDENT нет — user-dmg_20261111 (роль STUDENT снята; кнопка по живой записи студента) | `apps/u7-bot/src/controllers/learning/stories/hub.ts:180-200`; `packages/stream/src/api/student/drop-student-uc.ts:133-193`; `apps/u7-bot/src/controllers/streams/stories/inactivity.story.ts:128-133`, `:308-320` | `runners/u7-bot/src/controllers/learning/stories/hub.ts:211; runners/u7-bot/src/controllers/streams/stories/inactivity.story.ts:159` | нет |
| P3-32 | ≠ намеренно | тот же текст «Вы не можете выйти из чужого потока» (StudentPolicy.isSelf), но реплика warn вместо экрана ошибки: stream-dmg_20261103 (TR-41: отказ UC — ucErrorNotify, реплика warn вместо экрана ошибки; текст тот же) | `packages/stream/src/api/student/drop-student-uc.ts:148-151`; `apps/u7-bot/src/controllers/learning/stories/hub.ts:192-194` | `runners/u7-bot/src/controllers/learning/stories/hub.ts:211` | нет |
| P3-33 | ≠ намеренно | «Студент не найден» (StudentErrors.NOT_FOUND) реплика warn вместо экрана; stream-dmg_20261103 (TR-41: отказ UC — ucErrorNotify, реплика warn вместо экрана ошибки; текст тот же) | `packages/stream/src/api/student/drop-student-uc.ts:137-146` | `runners/u7-bot/src/controllers/learning/stories/hub.ts:211` | нет |
| P3-34 | ≠ намеренно | отказ StudentErrors.NOT_STUDYING («Нельзя снять студента с учёбы: он уже не учится.») реплика warn вместо экрана; stream-dmg_20261103 (TR-41: отказ UC — ucErrorNotify, реплика warn вместо экрана ошибки; текст тот же) | `packages/stream/src/api/student/drop-student-uc.ts:153-155`; `apps/u7-bot/src/controllers/learning/stories/hub.ts:192-194` | `runners/u7-bot/src/controllers/learning/stories/hub.ts:211` | нет |
| P3-35 | = | то же (подписка на StudentEvents.completed) | `apps/u7-bot/src/controllers/learning/stories/hub.ts:34-40` | `runners/u7-bot/src/controllers/learning/stories/hub.ts:43` | нет |
| P3-36 | = | то же | `apps/u7-bot/src/controllers/learning/stories/hub.ts:62-71` | `runners/u7-bot/src/controllers/learning/stories/hub.ts:70` | нет |
| P3-37 | = | то же | `apps/u7-bot/src/controllers/learning/stories/hub.ts:73-79` | `runners/u7-bot/src/controllers/learning/stories/hub.ts:80` | нет (user-notify.e2e.test.ts:247 — только отрицательный: уведомления нет) |
| P3-38 | = | то же; текст «Курс завершён»/«Модуль завершён» теперь шлёт HubStory (proactiveSender.notify), не UC | `apps/u7-bot/src/controllers/learning/stories/hub.ts:52-55`, `:80`; `packages/stream/src/api/student/complete-student-uc.ts:81-109` | `runners/u7-bot/src/controllers/learning/stories/hub.ts:90` | user-notify.e2e.test.ts:179 |
| P3-39 | = | то же | `apps/u7-bot/src/controllers/streams/stories/stream-catalog.story.ts:37-138` | `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.ts:34` | curious-showcase.e2e.test.ts:232 |
| P3-40 | = | то же | `apps/u7-bot/src/controllers/streams/stories/stream-catalog.story.ts:42-47`, `:72-79`, `:110-132` | `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.ts:34` | нет |
| P3-41 | = | то же | `apps/u7-bot/src/controllers/streams/stories/stream-catalog.story.ts:82-97` | `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.ts:96` | нет |
| P3-42 | = | то же | `apps/u7-bot/src/controllers/streams/stories/stream-catalog.story.ts:99` | `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.ts:99` | нет |
| P3-43 | = | то же | `apps/u7-bot/src/controllers/streams/stories/stream-catalog.story.ts:45-47` | `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.ts:34` | нет |
| P3-44 | = | то же; «Записаться» — по отсутствию живой записи студента (user-dmg_20261111) и canManage вместо роли | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:161-218`, `:412-463` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:123, :430` | curious-showcase.e2e.test.ts:122 |
| P3-45 | = | то же | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:168-190`, `:220-233` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:228` | нет (peer-review-view.e2e.test.ts:163 — только случай с отзывами) |
| P3-46 | = | то же | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:239-372`; `apps/u7-bot/src/controllers/streams/stream-nav-resolver.ts` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:250` | pagination.e2e.test.ts:161 |
| P3-47 | = | то же | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:276-288` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:290` | нет |
| P3-48 | = | то же | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:297-299` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:310` | нет |
| P3-49 | ≠ намеренно | «❌ Уровень программы не найден.» то же; «Поток не найден» теперь реплика warn из ucErrorNotify вместо экрана: stream-dmg_20261103 (TR-41: отказ UC — ucErrorNotify, реплика warn вместо экрана ошибки; текст тот же) | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:272-274`, `:366-368` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:250, :378` | нет (curious-showcase.e2e.test.ts:215 — поток не найден на карточке, не в программе) |
| P3-50 | = | то же | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:374-410` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:385` | нет |
| P3-51 | = | то же | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:395-397` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:414` | нет |
| P3-52 | = | то же; отставание — из roster getStreamMembers, строки — через getStudentProgress | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:467-654` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:485` | curious-showcase.e2e.test.ts:122 |
| P3-53 | = | то же; подписи исхода — shared/student-rows.ts | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:661-813`, `:815-861` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:656` | нет |
| P3-54 | ≠ намеренно | «Поток не найден» теперь реплика warn из ucErrorNotify вместо экрана: stream-dmg_20261103 (TR-41: отказ UC — ucErrorNotify, реплика warn вместо экрана ошибки; текст тот же) | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:481-483`, `:685-687` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:485, :656` | нет |
| P3-55 | = | то же; зачисление без выдачи роли STUDENT (user-dmg_20261111), текст и переход в меню те же | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:889-977`; `packages/stream/src/api/student/enroll-student-uc.ts:33-100` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:876` | нет (user-notify.e2e.test.ts:99 зачисляет через UC, не через кнопку) |
| P3-56 | = | то же; ключ боту не отдаётся (requiresEnrollmentKey, TR-41 С1), проверяет UC | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:898-915` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:806` | нет |
| P3-57 | = | то же; слово проверяет UC enrollStudent | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:155-156` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:97, :876` | нет |
| P3-58 | = | то же (счётчик попыток в story) | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:123-152` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:846` | нет |
| P3-59 | = | то же | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:124-140` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:846` | нет |
| P3-60 | = | то же | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:921-928` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:837` | нет |
| P3-61 | = | то же | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:110-119` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:111` | нет |
| P3-62 | = | то же | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:106-108` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:103` | нет |
| P3-63 | = | то же: тексты сохранены в StudentErrors/StreamErrors (WRONG_ENROLLMENT_KEY, ALREADY_STUDYING, «Сначала пройдите модуль «…»», NO_STEPS, «Поток не найден»), warn как и раньше. Проверки «поток не в наборе» нет ни там, ни там (скрыта кнопка) | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:937-957`; `packages/stream/src/api/student/enroll-student-uc.ts:52-80` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:876` | нет |
| P3-64 | = | то же (canManage + статус enrollment) | `apps/u7-bot/src/controllers/streams/stories/view-stream.story.ts:447-457` | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:430` | нет |
| P3-65 | дубль P8-01 | — | — | — | — |
| P3-66 | дубль P8-02 | — | — | — | — |
| P3-67 | дубль P8-07 | — | — | — | — |
| P3-68 | дубль P8-08 | — | — | — | — |
| P3-69 | дубль P8-09 | — | — | — | — |
| P3-70 | дубль P8-03 | — | — | — | — |
| P3-71 | дубль P8-05 | — | — | — | — |
| P3-72 | дубль P8-06 | — | — | — | — |
| P3-73 | дубль P8-15 | — | — | — | — |
| P3-74 | = | то же текст; шлёт InactivityStory (не UC), только при cause=inactivity (раньше текст «за бездействие» уходил и при by_mentor) | `packages/stream/src/api/student/mark-abandoned-uc.ts:34-91` | `runners/u7-bot/src/controllers/streams/stories/inactivity.story.ts:159` | inactivity.e2e.test.ts:303 |
| P3-75 | дубль P4-63 | — | — | — | — |
| P3-76 | дубль P4-65 | — | — | — | — |
| P3-77 | дубль P4-67 | — | — | — | — |
| P3-78 | дубль P4-68 | — | — | — | — |

## П4 — Ментор: потоки, мониторинг, inactivity

| ID | Статус | Обоснование / различие | v0.2.6 | Сейчас | e2e |
|---|---|---|---|---|---|
| P4-01 | = | то же (проверка роли через `user.isMentor()/isAdmin()`) | M/submenu.ts:25-65 | runners/u7-bot/src/controllers/mentor/stories/submenu.ts:31-50 | mentor-management.e2e.test.ts:116 |
| P4-02 | = | то же | M/submenu.ts:32-46 | mentor/stories/submenu.ts:31-50 | нет |
| P4-03 | = | то же | M/submenu.ts:21-23 | mentor/stories/submenu.ts:21 | нет |
| P4-04 | = | то же; фильтр `mentorId` теперь в `ListStreamsUcDef`, а не в story | M/my-streams.ts:116-204 | mentor/stories/my-streams.ts:47-130 | mentor-management.e2e.test.ts:116 |
| P4-05 | = | то же | M/my-streams.ts:131-168 | mentor/stories/my-streams.ts:64-100 | нет |
| P4-06 | = | то же | M/my-streams.ts:175-186 | mentor/stories/my-streams.ts:102-114 | нет |
| P4-07 | ≠ намеренно | отказ UC (`!ok`) теперь `ucErrorNotify` (warn), «Не удалось загрузить…» остался только для исключения; `stream-dmg_20261103` (slices/stream.md, п.14), `dmg-cleanup_20261028` ФР-5 | M/my-streams.ts:201-203 | mentor/stories/my-streams.ts:59,131-133 | нет |
| P4-08 | = | то же (счётчик из `getStreamMembers`, дата из timestamp) | M/view-stream-mentor.ts:73-141; SS/view-stream.story.ts:161-217 | streams/stories/view-stream.story.ts:123-197; mentor/stories/view-stream-mentor.ts:75-148 | mentor-management.e2e.test.ts:116 |
| P4-09 | = | то же; выдача первого шага и активация — DCS в UoW (TR-41 С2) | M/activate-stream.ts:18-36 | mentor/stories/activate-stream.ts:17-45; domain/src/stream/stream/uc/activate-stream.uc.ts | нет |
| P4-10 | = | то же | M/view-stream-mentor.ts:55-57,231-247 | mentor/stories/view-stream-mentor.ts:57-59,236-252 | нет |
| P4-11 | ≠ намеренно | видимое то же; событие `stream.completed` больше не публикуется («подписчиков не было», `domain/src/stream/stream/stream.events.ts:5`, `stream-dmg_20261103`) | M/view-stream-mentor.ts:269-280 | mentor/stories/view-stream-mentor.ts:273-300; domain/src/stream/stream/uc/complete-stream.uc.ts | нет |
| P4-12 | ≠ намеренно | тот же текст «Нельзя завершить поток: N студентов ещё учатся…», но теперь явно ловится в story и идёт как warn-реплика (раньше — общий обработчик с экраном); `stream-dmg_20261103` (TR-44), `dmg-cleanup_20261028` ФР-5 | packages/stream/src/domain/stream-ds.ts:37-50; M/view-stream-mentor.ts:269-273 | mentor/stories/view-stream-mentor.ts:283-296; domain/src/stream/stream/stream.errors.ts:36 | нет |
| P4-13 | = | то же | M/view-stream-mentor.ts:63-65,249-265 | mentor/stories/view-stream-mentor.ts:61-67,254-271 | нет |
| P4-14 | = | то же | M/view-stream-mentor.ts:282-290 | mentor/stories/view-stream-mentor.ts:302-320; domain/src/stream/stream/uc/archive-stream.uc.ts | нет |
| P4-15 | ≠ намеренно | тексты отказов статичные, без «в статусе '…'» (`NOT_ENROLLING`/`NOT_ACTIVE`/`NOT_COMPLETED`/`ALREADY_ARCHIVED`), показ — `ucErrorNotify` (warn); `stream-dmg_20261103`, `dmg-cleanup_20261028` ФР-5 | packages/stream/src/domain/stream/a-root.ts:72-122 | domain/src/stream/stream/stream.errors.ts:10-35; mentor/stories/activate-stream.ts:32 | нет |
| P4-16 | = | то же: `canManage` в карточке; UC — policy `canManage` → access-denied | M/view-stream-mentor.ts:77,100 | mentor/stories/view-stream-mentor.ts:79; domain/src/stream/stream/uc/activate-stream.uc.ts:19; stream.policy.ts:45 | нет |
| P4-17 | = | то же (лимит 3200 в nav-resolver) | M/view-stream-mentor.ts:42-44; SS/view-stream.story.ts:239-371 | streams/stories/view-stream.story.ts:250-383; streams/stream-nav-resolver.ts:275 | нет |
| P4-18 | = | то же | SS/view-stream.story.ts:276-288 | streams/stories/view-stream.story.ts:287-299 | нет |
| P4-19 | = | то же | SS/view-stream.story.ts:291-293 | streams/stories/view-stream.story.ts:303-305 | нет |
| P4-20 | ≠ намеренно | вместо экрана «❌ Поток не найден.» — warn «Поток не найден» (`ucErrorNotify`); `stream-dmg_20261103` (slices/stream.md:238) | SS/view-stream.story.ts:272-274 | streams/stories/view-stream.story.ts:279 | нет |
| P4-21 | = | то же | SS/view-stream.story.ts:374-406 | streams/stories/view-stream.story.ts:385-427 | нет |
| P4-22 | = | то же (прогресс/отставание через `loadStudentRows`, `shared/student-rows.ts`) | M/monitor.ts:93-333 | mentor/stories/monitor.ts:88-295 | mentor-management.e2e.test.ts:116 |
| P4-23 | = | то же | M/monitor.ts:425-556 | mentor/stories/monitor.ts:362-478 | mentor-management.e2e.test.ts:265 |
| P4-24 | = | то же | M/monitor.ts:78-85,106-292 | mentor/stories/monitor.ts:79-85,88-295 | mentor-management.e2e.test.ts:229 |
| P4-25 | = | то же | M/monitor.ts:54-57,562-593 | mentor/stories/monitor.ts:55-58,481-497 | mentor-management.e2e.test.ts:180 |
| P4-26 | ≠ намеренно | текст студенту и кик — те же, но уведомление теперь шлёт story по `student.abandoned` (только при cause=inactivity), роль STUDENT не снимается (роли больше нет); `stream-dmg_20261103` (slices/student.md, Т6), `user-dmg_20261111` | M/monitor.ts:595-627; packages/stream/src/api/student/mark-abandoned-uc.ts:34-90 | mentor/stories/monitor.ts:499-526; streams/stories/inactivity.story.ts:159-200; modules/stream/src/student/uc/mark-abandoned.uc.ts | mentor-management.e2e.test.ts:210; inactivity.e2e.test.ts:303 |
| P4-27 | ≠ намеренно | `handleError` → `ucErrorNotify` (warn вместо экрана ошибки); `dmg-cleanup_20261028` ФР-5, TR-65 | M/monitor.ts:617-619 | mentor/stories/monitor.ts:515 | нет |
| P4-28 | = | то же (тексты кнопок «окончил / окончил, не прошёл / забросил» — как в коде v0.2.6) | M/monitor.ts:629-657; M/view-stream-mentor.ts:207-221 | mentor/stories/monitor.ts:528-554; mentor/stories/view-stream-mentor.ts:212-227 | mentor-management.e2e.test.ts:229 |
| P4-29 | = | то же | M/monitor.ts:659-701 | mentor/stories/monitor.ts:556-588 | mentor-management.e2e.test.ts:229 |
| P4-30 | = | то же по видимому; «забросил» теперь `markAbandoned(by_mentor)`, остальные исходы — `completeStudent` (`stream-dmg_20261103`, slices/student.md п.2/6) | M/monitor.ts:703-758 | mentor/stories/monitor.ts:590-640 | mentor-management.e2e.test.ts:229 |
| P4-31 | = | то же | M/monitor.ts:712-719 | mentor/stories/monitor.ts:603 | нет |
| P4-32 | ≠ намеренно | `handleError` → `ucErrorNotify`; `dmg-cleanup_20261028` ФР-5, TR-65 | M/monitor.ts:748-750 | mentor/stories/monitor.ts:632-634 | нет |
| P4-33 | = | то же: заглушка, из UI недостижима (Q-11) | M/monitor.ts:47-52 | mentor/stories/monitor.ts:43-48 | нет |
| P4-34 | ≠ намеренно | вместо экрана «⚠️ Поток не найден» — warn `ucErrorNotify` («Поток не найден»); `stream-dmg_20261103` (slices/stream.md:238) | M/monitor.ts:106-109 | mentor/stories/monitor.ts:93-99 | нет |
| P4-35 | = | то же (fallback `userId.slice(0,8)`) | M/monitor.ts:142-148 | mentor/stories/monitor.ts:323-330; shared/student-rows.ts | нет |
| P4-36 | = | то же | M/monitor.ts:265-280; M/view-stream-mentor.ts:136-138 | mentor/stories/monitor.ts:264-280; mentor/stories/view-stream-mentor.ts:138-146 | mentor-management.e2e.test.ts:180 |
| P4-37 | = | то же; список — `ListModulesUcDef(status: published)` | M/create-stream.ts:131-134,270-297 | mentor/stories/create-stream.ts:131-134,272-297 | mentor-management.e2e.test.ts:299 |
| P4-38 | = | то же (отказ `listModules` — отдельная warn-ветка, новая) | M/create-stream.ts:279-291 | mentor/stories/create-stream.ts:282-296 | нет |
| P4-39 | = | то же (модуль не найден/отказ — поля пустые) | M/create-stream.ts:299-345 | mentor/stories/create-stream.ts:299-340 | mentor-management.e2e.test.ts:299 |
| P4-40 | = | то же | M/create-stream.ts:359-410,546-557 | mentor/stories/create-stream.ts:359-415 | mentor-management.e2e.test.ts:299 |
| P4-41 | = | то же на шаге (`T00:00`); дата теперь `new Date(...Z).getTime()`, неверный формат → NaN → отказ валидации при создании (Q-16) | M/create-stream.ts:405-420,426-440 | mentor/stories/create-stream.ts:405-445,778-783 | mentor-management.e2e.test.ts:299 |
| P4-42 | = | то же | M/create-stream.ts:213-217,450-545 | mentor/stories/create-stream.ts:213-217,455-550 | mentor-management.e2e.test.ts:299 |
| P4-43 | = | то же | M/create-stream.ts:595-650 | mentor/stories/create-stream.ts:575-655 | mentor-management.e2e.test.ts:299 |
| P4-44 | = | то же | M/create-stream.ts:626-680 | mentor/stories/create-stream.ts:626-685 | mentor-management.e2e.test.ts:299 |
| P4-45 | = | то же | M/create-stream.ts:683-712 | mentor/stories/create-stream.ts:683-715 | mentor-management.e2e.test.ts:299 |
| P4-46 | = | то же | M/create-stream.ts:714-760,242-245 | mentor/stories/create-stream.ts:716-762,242-245 | mentor-management.e2e.test.ts:299 |
| P4-47 | = | то же; `stream.created` → подписка `invite-wishers` (TR-20) | M/create-stream.ts:762-805; packages/stream/src/api/stream/create-stream-uc.ts:27-44 | mentor/stories/create-stream.ts:764-810; domain/src/stream/stream/uc/create-stream.uc.ts:45 | mentor-management.e2e.test.ts:299 |
| P4-48 | ≠ намеренно | `handleError` → `ucErrorNotify` (warn вместо экрана); `dmg-cleanup_20261028` ФР-5 | M/create-stream.ts:796-798 | mentor/stories/create-stream.ts:797-802 | нет |
| P4-49 | = | то же | M/create-stream.ts:195-200 | mentor/stories/create-stream.ts:195-202 | нет |
| P4-50 | = | то же | M/create-stream.ts:203-209,775-781,826-831 | mentor/stories/create-stream.ts:203-210,773,815 | нет |
| P4-51 | = | то же | M/create-stream.ts:248-263 | mentor/stories/create-stream.ts:247-265 | mentor-management.e2e.test.ts:400 |
| P4-52 | = | то же | M/create-stream.ts:249,262 | mentor/stories/create-stream.ts:253-265 | нет |
| P4-53 | дубль P8-02 | — | — | — | — |
| P4-54 | дубль P8-07 | — | — | — | — |
| P4-55 | дубль P8-08 | — | — | — | — |
| P4-56 | дубль P8-09 | — | — | — | — |
| P4-57 | дубль P8-10 | — | — | — | — |
| P4-58 | дубль P8-03 | — | — | — | — |
| P4-59 | дубль P8-11 | — | — | — | — |
| P4-60 | дубль P8-13 | — | — | — | — |
| P4-61 | дубль P8-12, P8-14 | — | — | — | — |
| P4-62 | дубль P8-15 | — | — | — | — |
| P4-63 | = | то же по коду; в v0.2.6 и сейчас `chat_member` в `main.ts` не подключён (Q-02), путь из Telegram не доходит в обеих версиях | S/controller.ts:59-90 | streams/controller.ts:43-90 | нет |
| P4-64 | = | то же (см. P4-63) | S/controller.ts:68-89 | streams/controller.ts:63-90 | нет |
| P4-65 | = | то же (см. P4-63) | S/controller.ts:92-117 | streams/controller.ts:92-108 | stream-dmg.e2e.test.ts:54; inactivity.e2e.test.ts:277 |
| P4-66 | = | то же | S/controller.ts:93-116 | streams/controller.ts:92-108 | inactivity.e2e.test.ts:344 |
| P4-67 | = | то же (`findStreamByTelegramGroup` → `undefined` → `pass`) | S/controller.ts:55-57 | streams/controller.ts:52-56 | нет |
| P4-68 | = | то же | S/controller.ts:120-127 | streams/controller.ts:108-111 | нет |
| P4-69 | = | то же (Q-12) | M/view-stream-mentor.ts:77; M/my-streams.ts:127-129 | mentor/stories/view-stream-mentor.ts:79; mentor/stories/my-streams.ts:54 | нет |
| P4-70 | = | то же: «💬 Отзывы» в менторской карточке нет; ui-spec приведён к коду (Q-05) | M/view-stream-mentor.ts:73-141 | mentor/stories/view-stream-mentor.ts:75-148 | нет |

## П5 — Админ: курсы, роли, менторы

| ID | Статус | Обоснование / различие | v0.2.6 | Сейчас | e2e |
|---|---|---|---|---|---|
| P5-01 | дубль P1-24 | — | — | — | — |
| P5-02 | дубль P1-25 | — | — | — | — |
| P5-03 | дубль P1-26 | — | — | — | — |
| P5-04 | дубль P1-27 | — | — | — | — |
| P5-05 | дубль P4-01 | — | — | — | — |
| P5-06 | дубль P4-02 | — | — | — | — |
| P5-07 | дубль P4-03 | — | — | — | — |
| P5-08 | = | то же: `ListStreamsUcDef` с `mentorId = actor.user.uuid` | apps/u7-bot/src/controllers/mentor/stories/my-streams.ts:56-62 | runners/u7-bot/src/controllers/mentor/stories/my-streams.ts:55-62 | нет |
| P5-09 | = | то же: `canEdit` = `stream.canManage` (ментор потока или ADMIN, `StreamPolicy.canManage`) | mentor/stories/view-stream-mentor.ts:77,99-125; stream/policy.ts:18-20 | runners/u7-bot/src/controllers/mentor/stories/view-stream-mentor.ts:79,102; domain/src/stream/stream/stream.policy.ts:41-55 | нет |
| P5-10 | = | то же: режим mentor при `canManage`, иначе viewer; `view-stream-mentor` не-владельцу — «⛔ нет прав» | streams/stories/view-stream.story.ts:290-295,418 | runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:302-307 | нет |
| P5-11 | = | то же (кнопки ⛔/✅/🔄, фильтр выбывших); права — `canManage` | mentor/stories/monitor.ts | runners/u7-bot/src/controllers/mentor/stories/monitor.ts | нет |
| P5-12 | = | то же: визард виден, `StreamPolicy.canCreate` = только MENTOR, админ без MENTOR получает отказ (Q-12) | mentor/stories/create-stream.ts:781; stream/policy.ts:9-11 | runners/u7-bot/src/controllers/mentor/stories/create-stream.ts; domain/src/stream/stream/stream.policy.ts:11-16 | нет |
| P5-13 | = | то же: `ModuleAr.viewFor(canSeeUnpublished)`, ADMIN видит полное состояние модуля (`ModulePolicy.canSeeUnpublished` = админ или автор модуля); `getModuleSnapshot` как и в v0.2.6 отдаёт только published | course/domain/module/a-root.ts:117-127; policy.ts:17-27 | domain/src/course/module/module.ar.ts:96-110; module.policy.ts:36-44; modules/course/src/module/uc/get-module.uc.ts:46 | нет |
| P5-14 | ≠ намеренно | UC `resolve-content-path` удалён без вызывающих (бот его не звал) — TR-52 (3) | course/api/content-path/resolve-content-path-uc.ts:58,108,289-302 | — (UC удалён; шаги в каталоге — `GetStepsByLessonsUc`, видимость по `ModulePolicy.canSeeUnpublished`: modules/course/src/step/uc/get-steps-by-lessons.uc.ts:75) | нет |
| P5-15 | = | то же: wish-кнопки одинаковы для всех ролей; отдельных админских нет | courses/course-nav-resolver.ts:49-133 | runners/u7-bot/src/controllers/courses/course-nav-resolver.ts:55-80; courses/stories/course-catalog.story.ts:607-623 | нет |
| P5-16 | ≠ намеренно | UC `create-course` удалён (authoring-UC без вызывающих кроме тестов) — TR-52 (3); у `CourseAr` мутаций нет; операции автора — трек «История модулей курса» (отложен) | packages/course/src/api/…/create-course-uc.ts | — (UC удалён; `modules/course/src/*/uc/` содержит только query-UC) | нет |
| P5-17 | ≠ намеренно | UC `create-course` удалён (authoring-UC без вызывающих кроме тестов) — TR-52 (3); у `CourseAr` мутаций нет; операции автора — трек «История модулей курса» (отложен) | packages/course/src/api/…/create-course-uc.ts | — (UC удалён; `modules/course/src/*/uc/` содержит только query-UC) | нет |
| P5-18 | ≠ намеренно | UC `add-phase-to-course` удалён (authoring-UC без вызывающих кроме тестов) — TR-52 (3); у `CourseAr` мутаций нет; операции автора — трек «История модулей курса» (отложен) | packages/course/src/api/…/add-phase-to-course-uc.ts | — (UC удалён; `modules/course/src/*/uc/` содержит только query-UC) | нет |
| P5-19 | ≠ намеренно | UC `add-phase-to-course` удалён (authoring-UC без вызывающих кроме тестов) — TR-52 (3); у `CourseAr` мутаций нет; операции автора — трек «История модулей курса» (отложен) | packages/course/src/api/…/add-phase-to-course-uc.ts | — (UC удалён; `modules/course/src/*/uc/` содержит только query-UC) | нет |
| P5-20 | ≠ намеренно | UC `add-module-to-course` удалён (authoring-UC без вызывающих кроме тестов) — TR-52 (3); у `CourseAr` мутаций нет; операции автора — трек «История модулей курса» (отложен) | packages/course/src/api/…/add-module-to-course-uc.ts | — (UC удалён; `modules/course/src/*/uc/` содержит только query-UC) | нет |
| P5-21 | ≠ намеренно | UC `add-module-to-course` удалён (authoring-UC без вызывающих кроме тестов) — TR-52 (3); у `CourseAr` мутаций нет; операции автора — трек «История модулей курса» (отложен) | packages/course/src/api/…/add-module-to-course-uc.ts | — (UC удалён; `modules/course/src/*/uc/` содержит только query-UC) | нет |
| P5-22 | ≠ намеренно | UC `create-module` удалён (authoring-UC без вызывающих кроме тестов) — TR-52 (3); у `CourseAr` мутаций нет; операции автора — трек «История модулей курса» (отложен) | packages/course/src/api/…/create-module-uc.ts | — (UC удалён; `modules/course/src/*/uc/` содержит только query-UC) | нет |
| P5-23 | ≠ намеренно | UC `create-module` удалён (authoring-UC без вызывающих кроме тестов) — TR-52 (3); у `CourseAr` мутаций нет; операции автора — трек «История модулей курса» (отложен) | packages/course/src/api/…/create-module-uc.ts | — (UC удалён; `modules/course/src/*/uc/` содержит только query-UC) | нет |
| P5-24 | ≠ намеренно | UC `enrich-module` удалён (authoring-UC без вызывающих кроме тестов) — TR-52 (3); у `CourseAr` мутаций нет; операции автора — трек «История модулей курса» (отложен) | packages/course/src/api/…/enrich-module-uc.ts | — (UC удалён; `modules/course/src/*/uc/` содержит только query-UC) | нет |
| P5-25 | ≠ намеренно | UC `enrich-module` удалён (authoring-UC без вызывающих кроме тестов) — TR-52 (3); у `CourseAr` мутаций нет; операции автора — трек «История модулей курса» (отложен) | packages/course/src/api/…/enrich-module-uc.ts | — (UC удалён; `modules/course/src/*/uc/` содержит только query-UC) | нет |
| P5-26 | ≠ намеренно | UC `add-project` удалён (authoring-UC без вызывающих кроме тестов) — TR-52 (3); у `CourseAr` мутаций нет; операции автора — трек «История модулей курса» (отложен) | packages/course/src/api/…/add-project-uc.ts | — (UC удалён; `modules/course/src/*/uc/` содержит только query-UC) | нет |
| P5-27 | ≠ намеренно | UC `add-project` удалён (authoring-UC без вызывающих кроме тестов) — TR-52 (3); у `CourseAr` мутаций нет; операции автора — трек «История модулей курса» (отложен) | packages/course/src/api/…/add-project-uc.ts | — (UC удалён; `modules/course/src/*/uc/` содержит только query-UC) | нет |
| P5-28 | ≠ намеренно | UC `publish-module` удалён (authoring-UC без вызывающих кроме тестов) — TR-52 (3); у `CourseAr` мутаций нет; операции автора — трек «История модулей курса» (отложен) | packages/course/src/api/…/publish-module-uc.ts | — (UC удалён; `modules/course/src/*/uc/` содержит только query-UC) | нет |
| P5-29 | ≠ намеренно | UC `publish-module` удалён (authoring-UC без вызывающих кроме тестов) — TR-52 (3); у `CourseAr` мутаций нет; операции автора — трек «История модулей курса» (отложен) | packages/course/src/api/…/publish-module-uc.ts | — (UC удалён; `modules/course/src/*/uc/` содержит только query-UC) | нет |
| P5-30 | ≠ намеренно | UC `create-lesson` удалён (authoring-UC без вызывающих кроме тестов) — TR-52 (3); у `CourseAr` мутаций нет; операции автора — трек «История модулей курса» (отложен) | packages/course/src/api/…/create-lesson-uc.ts | — (UC удалён; `modules/course/src/*/uc/` содержит только query-UC) | нет |
| P5-31 | ≠ намеренно | UC `create-lesson` удалён (authoring-UC без вызывающих кроме тестов) — TR-52 (3); у `CourseAr` мутаций нет; операции автора — трек «История модулей курса» (отложен) | packages/course/src/api/…/create-lesson-uc.ts | — (UC удалён; `modules/course/src/*/uc/` содержит только query-UC) | нет |
| P5-32 | ≠ намеренно | UC `create-step` удалён (authoring-UC без вызывающих кроме тестов) — TR-52 (3); у `CourseAr` мутаций нет; операции автора — трек «История модулей курса» (отложен) | packages/course/src/api/…/create-step-uc.ts | — (UC удалён; `modules/course/src/*/uc/` содержит только query-UC) | нет |
| P5-33 | ≠ намеренно | UC `create-step` удалён (authoring-UC без вызывающих кроме тестов) — TR-52 (3); у `CourseAr` мутаций нет; операции автора — трек «История модулей курса» (отложен) | packages/course/src/api/…/create-step-uc.ts | — (UC удалён; `modules/course/src/*/uc/` содержит только query-UC) | нет |
| P5-34 | = | то же: ADMIN выдаёт любую роль, повтор идемпотентен | user/api/user/add-role-to-user-uc.ts; policy.ts:canAddRole; a-root.ts:60-65 | modules/user/src/user/uc/add-role-to-user.uc.ts:32-37; domain/src/user/user/user.policy.ts:canManageRoles; user.ar.ts:90-96 | нет |
| P5-35 | ≠ намеренно | исключение «MENTOR выдаёт STUDENT» снято вместе с ролью `STUDENT`; управляет ролями только ADMIN — TR-61 (Ф3, DEBT-48) | user/domain/user/policy.ts:canAddRole | domain/src/user/user/user.policy.ts:canManageRoles | нет |
| P5-36 | ≠ намеренно | исключение «себе STUDENT» снято, роль `STUDENT` удалена; всем кроме ADMIN отказ «Недостаточно прав для выполнения действия» — TR-61 (Ф3, DEBT-48) | user/api/user/add-role-to-user-uc.ts; policy.ts:canAddRole | domain/src/user/user/user.policy.ts:canManageRoles | нет |
| P5-37 | = | то же: `USER_NOT_FOUND` до проверки права | user/api/user/add-role-to-user-uc.ts | modules/user/src/user/uc/add-role-to-user.uc.ts:26-30 | нет |
| P5-38 | = | то же: любая роль у любого, при пустом списке — GUEST; UC переименован в `removeRoleFromUser` | user/api/user/remove-role-to-user-uc.ts; a-root.ts:71-81 | modules/user/src/user/uc/remove-role-from-user.uc.ts; domain/src/user/user/user.ar.ts:102-109 | нет |
| P5-39 | ≠ намеренно | исключения STUDENT (ментор/сам) сняты вместе с ролью — TR-61 (Ф3, DEBT-48); `USER_NOT_FOUND` как раньше | user/api/user/remove-role-to-user-uc.ts; policy.ts:canRemoveRole | modules/user/src/user/uc/remove-role-from-user.uc.ts; user.policy.ts:canManageRoles | нет |
| P5-40 | дубль P1-45 | — | — | — | — |
| P5-41 | дубль P1-43 | — | — | — | — |
| P5-42 | дубль P1-44 | — | — | — | — |
| P5-43 | дубль P1-48 | — | — | — | — |
| P5-44 | ≠ намеренно | роль `STUDENT` удалена, зачисление ролей не меняет — TR-61 (Ф3, DEBT-48) | stream/api/student/enroll-student-uc.ts:94 | modules/stream/src/student/uc/enroll-student.uc.ts (вызова AddRoleToUser нет) | нет |
| P5-45 | ≠ намеренно | роль `STUDENT` удалена, при завершении/исключении/«выбыл» роль не снимается — TR-61 (Ф3, DEBT-48) | stream/api/student/complete-student-uc.ts:71, drop-student-uc.ts:60, mark-abandoned-uc.ts:63 | modules/stream/src/student/uc/{complete-student,drop-student,mark-abandoned}.uc.ts (вызовов RemoveRole нет) | нет |

## П6 — `peer-review`

| ID | Статус | Обоснование / различие | v0.2.6 | Сейчас | e2e |
|---|---|---|---|---|---|
| P6-01 | = | событие переименовано в `peer-review.review-campaign.created`; исход, окно 7 дн, mentorId те же | PR/api/er/create-student-campaign-er.ts:295-335 | modules/peer-review/src/review-campaign/er/create-student-campaign.er.ts:45-100; domain/src/peer-review/review-campaign/review-campaign.ar.ts:112-131 | peer-review-smoke.e2e.test.ts:72 |
| P6-02 | = | то же: завершившие и учащиеся без субъекта и abandoned (Q-18: участники на момент события) | PR/api/er/create-student-campaign-er.ts:342-351 | domain/src/peer-review/review-campaign/student-fate.dqs.ts:23-37 | peer-review-campaign.e2e.test.ts:265 |
| P6-03 | = | то же: participants пуст, never_started по neverStarted | PR/api/er/create-student-campaign-er.ts:347,366 | domain/src/peer-review/review-campaign/student-fate.dqs.ts:45-55 | peer-review-campaign.e2e.test.ts:322 |
| P6-04 | = | то же: правило unique, успех без записи | PR/api/er/create-student-campaign-er.ts:302-306 | modules/peer-review/src/review-campaign/er/create-student-campaign.er.ts:50-60 | нет |
| P6-05 | = | то же: warn и выход без кампании | PR/api/er/create-student-campaign-er.ts:309-317 | modules/peer-review/src/review-campaign/er/create-student-campaign.er.ts:66-73 | нет |
| P6-06 | = | то же | CR/stories/invite.story.ts:68-73,95-102 | runners/u7-bot/src/controllers/peer-review/stories/invite.story.ts:50-110; runners/u7-bot/src/controllers/shared/routes.ts:67-70 | peer-review-campaign.e2e.test.ts:73 |
| P6-07 | = | то же | CR/stories/invite.story.ts:97-98 | runners/u7-bot/src/controllers/peer-review/stories/invite.story.ts | peer-review-campaign.e2e.test.ts:322 |
| P6-08 | = | то же | CR/stories/invite.story.ts:99-100 | runners/u7-bot/src/controllers/peer-review/stories/invite.story.ts | нет |
| P6-09 | = | то же | CR/stories/invite.story.ts:75-80,112,115 | runners/u7-bot/src/controllers/peer-review/stories/invite.story.ts | peer-review-campaign.e2e.test.ts:73 |
| P6-10 | = | то же | CR/stories/invite.story.ts:111-114 | runners/u7-bot/src/controllers/peer-review/stories/invite.story.ts | нет |
| P6-11 | = | то же (тесты рядом: invite.story.test.ts) | CR/stories/invite.story.ts:64-80,125-138 | runners/u7-bot/src/controllers/peer-review/stories/invite.story.ts:110-140 | нет |
| P6-12 | = | get-stream не ok — молчаливый пропуск (раньше через исключение) | CR/stories/invite.story.ts:53-62 | runners/u7-bot/src/controllers/peer-review/stories/invite.story.ts:62-72 | нет |
| P6-13 | = | то же | CR/stories/my-reviews.story.ts:65-84 | runners/u7-bot/src/controllers/peer-review/stories/my-reviews.story.ts:96-115 | peer-review-reviews-for-me.e2e.test.ts:159 |
| P6-14 | = | то же | CR/stories/my-reviews.story.ts:88-182 | runners/u7-bot/src/controllers/peer-review/stories/my-reviews.story.ts:117-290 | peer-review-hub.e2e.test.ts:78 |
| P6-15 | = | то же | CR/stories/my-reviews.story.ts:140-162 | runners/u7-bot/src/controllers/peer-review/stories/my-reviews.story.ts | peer-review-hub.e2e.test.ts:110 |
| P6-16 | = | то же | CR/stories/my-reviews.story.ts:159-161,244-248 | runners/u7-bot/src/controllers/peer-review/stories/my-reviews.story.ts | peer-review-campaign.e2e.test.ts:322 |
| P6-17 | = | то же (тесты рядом: my-reviews.story.test.ts) | CR/stories/my-reviews.story.ts:93-182 | runners/u7-bot/src/controllers/peer-review/stories/my-reviews.story.ts | нет |
| P6-18 | = | то же | CR/stories/my-reviews.story.ts:130-139,193-206 | runners/u7-bot/src/controllers/peer-review/stories/my-reviews.story.ts | нет |
| P6-19 | = | то же | CR/stories/campaign.story.ts:146-215 | runners/u7-bot/src/controllers/peer-review/stories/campaign.story.ts:160-230 | peer-review-campaign.e2e.test.ts:265 |
| P6-20 | = | то же | CR/stories/campaign.story.ts:170-175 | runners/u7-bot/src/controllers/peer-review/stories/campaign.story.ts | peer-review-campaign.e2e.test.ts:322 |
| P6-21 | = | то же | CR/stories/campaign.story.ts:161-169 | runners/u7-bot/src/controllers/peer-review/stories/campaign.story.ts:#recipientsFailure | peer-review-hub.e2e.test.ts:155 |
| P6-22 | ≠ намеренно | раньше ошибка UC шла в общий обработчик; теперь явный экран «⚠️ Кампания не найдена.» + `↩️ Мои отзывы` (Q-04); введено в `peer-review-dmg_20261029` (коммит `2d03728b`, `slices/review-campaign.md`) | PR/api/review-campaign/get-campaign-recipients-uc.ts | runners/u7-bot/src/controllers/peer-review/stories/campaign.story.ts:#recipientsFailure (~403-411) | нет |
| P6-23 | = | то же | CR/stories/campaign.story.ts:219-270 | runners/u7-bot/src/controllers/peer-review/stories/campaign.story.ts:233-285 | peer-review-hub.e2e.test.ts:110 |
| P6-24 | = | то же | CR/stories/campaign.story.ts:272-301 | runners/u7-bot/src/controllers/peer-review/stories/campaign.story.ts:284-320 | peer-review-campaign.e2e.test.ts:73 |
| P6-25 | = | то же | CR/stories/campaign.story.ts:278-285 | runners/u7-bot/src/controllers/peer-review/stories/campaign.story.ts | нет |
| P6-26 | = | то же | CR/stories/campaign.story.ts:230-236 | runners/u7-bot/src/controllers/peer-review/stories/campaign.story.ts | нет |
| P6-27 | = | то же | CR/stories/campaign.story.ts:473-509 | runners/u7-bot/src/controllers/peer-review/stories/campaign.story.ts | peer-review-campaign.e2e.test.ts:73 |
| P6-28 | = | то же | CR/stories/campaign.story.ts:55 | runners/u7-bot/src/controllers/peer-review/stories/campaign.story.ts | нет |
| P6-29 | = | то же | CR/stories/campaign.story.ts:70-74 | runners/u7-bot/src/controllers/peer-review/stories/campaign.story.ts | peer-review-campaign.e2e.test.ts:73 |
| P6-30 | = | то же | CR/stories/campaign.story.ts:75-79 | runners/u7-bot/src/controllers/peer-review/stories/campaign.story.ts | нет |
| P6-31 | = | то же | CR/stories/campaign.story.ts:80-116 | runners/u7-bot/src/controllers/peer-review/stories/campaign.story.ts:96-160 | peer-review-campaign.e2e.test.ts:265 |
| P6-32 | = | то же | CR/stories/campaign.story.ts:105-116 | runners/u7-bot/src/controllers/peer-review/stories/campaign.story.ts; modules/peer-review/src/review/uc/create-review.uc.ts:75-96 | peer-review-campaign.e2e.test.ts:73 |
| P6-33 | = | то же | CR/stories/campaign.story.ts:63-68 | runners/u7-bot/src/controllers/peer-review/stories/campaign.story.ts | нет |
| P6-34 | = | то же; отказ теперь Result (ReviewErrors.WINDOW_CLOSED), текст тот же | CR/stories/campaign.story.ts:121-137 | runners/u7-bot/src/controllers/peer-review/stories/campaign.story.ts:114-135 | нет |
| P6-35 | = | то же; ucErrorNotify | CR/stories/campaign.story.ts:139-140 | runners/u7-bot/src/controllers/peer-review/stories/campaign.story.ts:135 | нет |
| P6-36 | = | вместо ER — стори review-notify на `peer-review.review.created`, доставка notify; текст тот же | PR/api/er/notify-review-recipient-er.ts:548-579 | runners/u7-bot/src/controllers/peer-review/stories/review-notify.story.ts:35-75 | peer-review-notify.e2e.test.ts:57 |
| P6-37 | = | то же | PR/api/er/notify-review-recipient-er.ts:574-577 | runners/u7-bot/src/controllers/peer-review/stories/review-notify.story.ts:60-70 | peer-review-notify.e2e.test.ts:57 |
| P6-38 | = | то же | PR/api/er/notify-review-recipient-er.ts:578 | runners/u7-bot/src/controllers/peer-review/stories/review-notify.story.ts:60-70 | нет |
| P6-39 | = | то же: warn в лог | PR/api/er/notify-review-recipient-er.ts:551-562 | runners/u7-bot/src/controllers/peer-review/stories/review-notify.story.ts:45-58 | нет |
| P6-40 | = | то же: событие только в ReviewAr.create | PR/domain/review/a-root.ts:110-113 | domain/src/peer-review/review/review.ar.ts:58-80 | peer-review-notify.e2e.test.ts:57 |
| P6-41 | = | то же; дата из мс (UTC), формат тот же | CR/stories/reviews-for-me.story.ts:26-107 | runners/u7-bot/src/controllers/peer-review/stories/reviews-for-me.story.ts | peer-review-reviews-for-me.e2e.test.ts:98 |
| P6-42 | = | то же | CR/stories/reviews-for-me.story.ts:90-99 | runners/u7-bot/src/controllers/peer-review/stories/reviews-for-me.story.ts | нет |
| P6-43 | = | то же | CR/stories/reviews-for-me.story.ts:74-77,110-130 | runners/u7-bot/src/controllers/peer-review/stories/reviews-for-me.story.ts:129-140 | нет |
| P6-44 | = | то же | CR/stories/my-reviews.story.ts:196,247-252 | runners/u7-bot/src/controllers/peer-review/stories/my-reviews.story.ts | peer-review-hub.e2e.test.ts:78 |
| P6-45 | = | то же | VS:180,220-233,432-442 | runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts:227-240,450-462 | peer-review-view.e2e.test.ts:163 |
| P6-46 | = | то же | CR/stories/scope-reviews.story.ts:173-243 | runners/u7-bot/src/controllers/peer-review/stories/scope-reviews.story.ts | peer-review-view.e2e.test.ts:277 |
| P6-47 | = | то же | CR/stories/scope-reviews.story.ts:202-206 | runners/u7-bot/src/controllers/peer-review/stories/scope-reviews.story.ts | нет |
| P6-48 | = | то же | CR/stories/scope-reviews.story.ts:260-263 | runners/u7-bot/src/controllers/peer-review/stories/scope-reviews.story.ts | peer-review-view.e2e.test.ts:185 |
| P6-49 | = | то же | CR/stories/my-reviews.story.ts:101 | runners/u7-bot/src/controllers/peer-review/stories/my-reviews.story.ts; review-notify.story.ts handleCallback | нет |
| P6-50 | дубль P1-16…P1-18 | — | — | — | — |

## П7 — `questionnaire` + `wish`, Job `sweep-abandoned`

| ID | Статус | Обоснование / различие | v0.2.6 | Сейчас | e2e |
|---|---|---|---|---|---|
| P7-01 | дубль P2-43 | — | — | — | — |
| P7-02 | дубль P2-42 | — | — | — | — |
| P7-03 | = | То же: кнопка «▶️ Заполнить анкету» (`fill:resume`); адрес теперь по профилю респондента, а не из payload | FILL:69-86 | runners/u7-bot/src/controllers/questionnaire/stories/fill.story.ts:74-94 | wish-questionnaire.e2e.test.ts:250; questionnaire-events.e2e.test.ts:184 |
| P7-04 | = | То же: notify «откройте её через /start» без кнопок | FILL:73-78 | fill.story.ts:81-86 | нет |
| P7-05 | = | То же: активная standard in_progress по courseId, вопрос + awaitInput | FILL:172-175, 311-363 | fill.story.ts:188-191, 311-355 | wish-questionnaire.e2e.test.ts:250 |
| P7-06 | = | То же: «Анкета не найдена или уже завершена.» + меню, без ⚠️ | FILL:333-338 | fill.story.ts:329-334 | нет |
| P7-07 | = | Тот же экран ошибки; теперь `ucErrorScreen` («⬅️ Меню», тексты как были; внутренняя — тот же текст) вместо `handleError` — TR-50 (1) | FILL:341-343 | fill.story.ts:320; render.ts:464-499 | нет |
| P7-08 | дубль P2-44 | — | — | — | — |
| P7-09 | дубль P2-45/P2-46 | — | — | — | — |
| P7-10 | дубль P2-48 | — | — | — | — |
| P7-11 | дубль P2-47 | — | — | — | — |
| P7-12 | дубль P2-53 | — | — | — | — |
| P7-13 | дубль P2-54 | — | — | — | — |
| P7-14 | дубль P2-55 | — | — | — | — |
| P7-15 | дубль P2-39…P2-41 | — | — | — | — |
| P7-16 | дубль P2-50 | — | — | — | — |
| P7-17 | дубль P2-51 | — | — | — | — |
| P7-18 | дубль P2-57 | — | — | — | — |
| P7-19 | дубль P2-58 | — | — | — | — |
| P7-20 | = | То же: S01 с кнопками start/why(если whyText)/decline; тексты теперь берутся через `getCurrent` респондента (при отказе — текст по умолчанию без «Зачем», TR-50 (2)); путь мёртвый на проде (Q-14) | INV:43-63 | runners/u7-bot/src/controllers/questionnaire/stories/invite.story.ts:54-103 | questionnaire-events.e2e.test.ts:209 |
| P7-21 | = | То же: `start-by-invite` → delegate `fill:current` | INV:74-86 | invite.story.ts:114-123 | нет |
| P7-22 | = | То же: экран ошибки с выходом в меню (`ucErrorScreen`, TR-50 (1)); коды NOT_FOUND/ACCESS_DENIED те же | INV:80-85 | invite.story.ts:121; render.ts:464 | нет |
| P7-23 | = | То же: whyText (дефолт «Нет дополнительной информации.») + «✅ Хорошо» | INV:88-90, 117-134 | invite.story.ts:154-168 | нет |
| P7-24 | = | То же: повторный показ S01 | INV:94-96, 136-155 | invite.story.ts:170-186 | нет |
| P7-25 | = | То же: confirm S06a «✅ Да, пропустить» / «❌ Нет, вернуться» | INV:100-102, 157-185 | invite.story.ts:188-213 | нет |
| P7-26 | = | То же: экран «Анкета пропущена.» + меню + release; событие `declined` слито в `abandoned(reason: declined)` (TR-46), подписчиков по-прежнему нет видимых (Q-15) | INV:106-108, 186-207 | invite.story.ts:215-230 | нет |
| P7-27 | = | То же: общий экран ошибки (`ucErrorScreen`, TR-50 (1)) | INV:~182, ~204 | invite.story.ts:197, 224 | нет |
| P7-28 | = | То же: «⚠️ Неизвестная команда» для неизвестных `invite:*`/`fill:*` и `answer`/`next` без `:` | INV:112; FILL:199,219,234 | invite.story.ts:149; fill.story.ts:215, 226, 232 | нет |
| P7-29 | = | То же: callback `fill:answer` → UC `handle-action`, маркер `(x)`, finalize, следующий вопрос | FILL:196-213; REN:85-102 | fill.story.ts:211-220, 262-275; render.ts:325-342, 381-421 | wish-questionnaire.e2e.test.ts:309 |
| P7-30 | = | То же: тоггл `[x]`/`[ ]` на месте, «Далее -->» только при ≥1 выборе | FILL; REN:60-74, 197-217 | render.ts:300-314, 437-457 | wish-questionnaire.e2e.test.ts:411 |
| P7-31 | = | То же: «Далее -->» (`fill:next`) → финальные маркеры, следующий вопрос/завершение | FILL:216-232 | fill.story.ts:222-230 | wish-questionnaire.e2e.test.ts:411 |
| P7-32 | = | То же: текстовый ответ через `handle-action` (type text), подсказка «Введите ваш ответ текстом...» | FILL:239-270; REN:159-164 | fill.story.ts:237-275; render.ts:399-404 | wish-questionnaire.e2e.test.ts:309 |
| P7-33 | = | То же: подсказка /cancel только на первом вопросе | REN:90, 155-157 | render.ts:330, 395-397 | wish-questionnaire.e2e.test.ts:250 (есть на Q1); :309 (нет на Q2) |
| P7-34 | = | То же: «Вопрос N из M» по активной ветке (прогресс приходит из UC) | REN:151-153, 183-195 | render.ts:391-393, 424-435 | wish-questionnaire.e2e.test.ts:309 |
| P7-35 | = | То же: finalize + «✅ Анкета завершена» + completionText + меню + release; `completed` → ER confirm-wish | REN:104-123 | render.ts:344-363 | wish-questionnaire.e2e.test.ts:411 |
| P7-36 | = | То же: warn «⚠️ Эта кнопка относится к предыдущему вопросу.», warn в лог | REN:76-83; FILL:416-423 | render.ts:316-323; fill.story.ts:414-423 | нет |
| P7-37 | = | То же: «⚠️ Сначала выбери хотя бы один вариант.» | REN:80-82 | render.ts:316-323 | нет |
| P7-38 | ≠ намеренно | Текст отказа получил приставку «Ошибка валидации» (`ucErrorNotify`): было «Ожидался ответ с выбором (нажатием кнопки)», стало «*Ошибка валидации* + тот же текст»; экран и ввод не меняются — TR-50 (1), решение Нурболата 2026-11-05 | FILL:260-269 | fill.story.ts:273; platform/core/src/ui/bot/bot-ui-story.ts:318-325 | нет |
| P7-39 | = | То же: «Произошла ошибка. Попробуйте ещё раз…» без деталей, ввод живёт | FILL:210-212, 267-269 | fill.story.ts:273; bot-ui-story.ts:339-346 | нет |
| P7-40 | = | То же: warn «Пожалуйста, введите ваш ответ текстом.» | FILL:244-247 | fill.story.ts:242-245 | нет |
| P7-41 | = | То же: warn «Анкета не найдена — начните с /start.», release, warn в лог | FILL:249-258 | fill.story.ts:247-256 | нет |
| P7-42 | = | То же: `/cancel` → confirm S05a (+cancelWarning), abandon не вызывается до подтверждения | FILL:274-299, 366-389 | fill.story.ts:279-299, 362-388 | wish-questionnaire.e2e.test.ts:339 |
| P7-43 | = | То же: notify «Отменено. Наберите /start» при отказе `get-current` или без qId (отказ теперь по `Result`, не `catch`) | FILL:282-298 | fill.story.ts:286-298 | нет |
| P7-44 | = | То же: pass в `super.handleCommand` | FILL:301 | fill.story.ts:301 | нет |
| P7-45 | = | То же: abandon(by_user), «Анкета прервана.» + меню + release; `abandoned` → ER abandon-wish: pending → abandoned | FILL:178-181, 392-406 | fill.story.ts:194-197, 391-406; modules/wish/src/wish/er/abandon-wish.er.ts:25 | wish-questionnaire.e2e.test.ts:339 |
| P7-46 | = | То же: «❌ Нет, продолжить» (`fill:current`) → текущий вопрос с захватом ввода | FILL:190-193, 347-363 | fill.story.ts:206-209, 340-355, 385 | нет |
| P7-47 | = | То же: общий экран ошибки (`ucErrorScreen`, TR-50 (1)) | FILL:360-362, 403-405 | fill.story.ts:346, 400 | нет |
| P7-48 | = | То же: «⏭️ Прервать» (`fill:cancel`) → confirm S05a. Изменилась лишь ветка сбоя `get-current`: теперь экран ошибки (`ucErrorScreen`), в v0.2.6 исключение уходило в общий обработчик | FILL:158-160, 183-187 | fill.story.ts:174-176, 199-203, 362-372 | нет (кнопка видна в questionnaire-ux.e2e.test.ts:211, но не нажимается) |
| P7-49 | = | То же: ступень 3 ч, метка `continueInvitedAt`, событие → проактив «Вы начали заполнять анкету — продолжим?» + «▶️ Продолжить анкету» (при courseId) + «⏭️ Прервать»; Job теперь на Def: выбор ступени — `QuestionnaireAr.sweepIdle`, события из UoW без адреса (D-63) | sweep-abandoned-job.ts:69-126 | domain/src/questionnaire/questionnaire/questionnaire.ar.ts:349-370; modules/questionnaire/src/questionnaire/job/sweep-abandoned-questionnaires.job.ts:34-49; fill.story.ts:124-141 | нет (событие публикуется вручную: questionnaire-ux.e2e.test.ts:211; Job в e2e не запускается) |
| P7-50 | = | То же: ступень 6 ч, `warnedAt`, «⏳ Анкета приостановлена…» + «▶️ Продолжить»/«⏭️ Прервать», один раз | sweep-abandoned-job.ts:84-87, 128-151 | questionnaire.ar.ts:355-362; fill.story.ts:101-118 | нет |
| P7-51 | = | То же: ступень 9 ч → `abandon(timeout)`, notify «⏱ Анкета была закрыта…», ER abandon-wish бросает pending | sweep-abandoned-job.ts:82-83, 153-168 | questionnaire.ar.ts:353; fill.story.ts:148-160 | нет |
| P7-52 | = | То же: при `by_user` ничего не шлётся; без профиля респондента — тоже тишина (теперь с warn в лог) | FILL:136-139 | fill.story.ts:150-152; questionnaire-story.ts:17-44 | нет |
| P7-53 | = | То же по видимому эффекту: ошибка одной анкеты не прерывает обход (`job.forEach`, API-06); при отсутствии профиля метка ставится, событие публикуется всегда, но story молча пропускает (warn) | sweep-abandoned-job.ts:91-96, 159-167 | sweep-abandoned-questionnaires.job.ts:34-49; questionnaire-story.ts:17-44 | questionnaire-events.e2e.test.ts:243 (нет профиля — тишина, обход идёт дальше; Job не запускается) |
| P7-54 | = | То же: активность респондента сбрасывает `updatedAt` и метки ступеней | sweep-abandoned-job.ts:50-52 | questionnaire.ar.ts:309, 467-476 | нет |
| P7-55 | = | То же: `completed` → ER confirm-wish: pending → confirmed, `wish.confirmed`; идемпотентно | confirm-wish-er.ts:34-65 | modules/wish/src/wish/er/confirm-wish.er.ts:25-41; domain/src/wish/wish/wish.ar.ts:392 | wish-questionnaire.e2e.test.ts:411 |
| P7-56 | = | То же: notify менторам курса, автор и без telegramId пропускаются, сбои — молчаливый пропуск | wish-confirmed.story.ts:34-57 | runners/u7-bot/src/controllers/courses/stories/wish-confirmed.story.ts:55-72 | нет |
| P7-57 | = | То же: pending → abandoned, остальные статусы не трогаются | abandon-wish-er.ts:27-48 | modules/wish/src/wish/er/abandon-wish.er.ts:25-38; wish.ar.ts:397 | wish-questionnaire.e2e.test.ts:339 |
| P7-58 | = | То же: expressed/confirmed → fulfilled по курсам/модулям (логика вынесена в `WishFulfillmentDcs`, модули — батчем `getSameModules` вместо цикла `isSameModule`, TR-18 (1)) | fulfill-wish-er.ts:30-84 | modules/wish/src/wish/er/fulfill-wish.er.ts:33-50; domain/src/wish/wish-fulfillment.dcs.ts:24-60 | нет |
| P7-59 | ≠ намеренно | Повторное `stream.created` больше не шлёт приглашение повторно (`invitedStreamIds`, `WishAr.wasInvitedTo`): в v0.2.6 каждое событие порождало новое приглашение — DEBT-35, трек `stream-dmg_20261103`; остальное то же (первый модуль курса, module-ветка по «тому же» модулю) | invite-wishers-er.ts:37-91, 94-124 | modules/wish/src/wish/er/invite-wishers.er.ts:38-70; domain/src/wish/wish-invitation.dcs.ts; wish.ar.ts:371, 459-467 | user-notify.e2e.test.ts:96 (course-ветка, первый модуль) |
| P7-60 | = | То же: без telegramId — warn и пропуск (теперь один warn на пользователя, TR-20 (4)), нет потока — никого, модуль вне программ — course-ветка молчит | invite-wishers-er.ts:42-45, 95-105 | invite-wishers.er.ts:58-64; wish-invitation.dcs.ts (invite) | нет |
| P7-61 | = | То же: карточка S11 «📣 Открылся набор!», поток, старт, ментор, подсказка записи, кнопки «📝 Записаться» / «🗑️ Отменить желание» (признак ключа теперь `requiresEnrollmentKey` вместо `enrollmentKey`) | wish-invite.story.ts:37-140 | runners/u7-bot/src/controllers/courses/stories/wish-invite.story.ts:55-117 | user-notify.e2e.test.ts:96 |
| P7-62 | = | То же: молчаливый пропуск при недоступном потоке или цели | wish-invite.story.ts:50-72 | wish-invite.story.ts:66-90 | нет |
| P7-63 | = | То же: все желания пользователя, только свои (`allowAll`, `userId` из субъекта) | list-user-wishes-uc.ts:35-37 | modules/wish/src/wish/uc/list-user-wishes.uc.ts; domain/src/wish/wish/uc/list-user-wishes.uc.ts | нет (вызывается при открытии карточки курса, результат не проверяется; см. P2-39…P2-41) |
| P7-64 | = | То же: UC `send-likert-invite` есть (`callers: system`), из бота и модулей не вызывается; фасад удалён (TR-51) — Q-14 | send-likert-invite-uc.ts | domain/src/questionnaire/questionnaire/uc/send-likert-invite.uc.ts:16; modules/questionnaire/src/questionnaire/uc/send-likert-invite.uc.ts | нет |
| P7-65 | = | То же: `get-questionnaires-by-user` — внутренний вызов `fill:resume`; ACCESS_DENIED «Нет доступа к списку анкет пользователя» (Policy `isSelf` или админ); `get-questionnaire` из бота не вызывается | get-questionnaires-by-user-uc.ts; QP/questionnaire-uc.ts:79-90 | domain/src/questionnaire/questionnaire/questionnaire.policy.ts:38-41, 71; fill.story.ts:315-320 | wish-questionnaire.e2e.test.ts:250 (внутренний вызов resume); отказ — нет |
| P7-66 | = | То же: экранирование MarkdownV2 во всех текстах анкеты | REN:149, 109 | render.ts:349, 389-418 | wish-questionnaire.e2e.test.ts:309 |

## П8 — Сквозное: Job `inactivity-sweep`, планировщик, транспорт, ошибки, пагинация

| ID | Статус | Обоснование / различие | v0.2.6 | Сейчас | e2e |
|---|---|---|---|---|---|
| P8-01 | = | То же: пороги 5/7, active+enrolled, от последнего шага или зачисления; логика в `StudentAr`, Job лишь отбирает записи | `inactivity-sweep-job.ts:51-83,134-137` | `domain/src/stream/student/job/inactivity-sweep.job.ts:10`; `modules/stream/src/student/job/inactivity-sweep.job.ts:27`; `domain/src/stream/student/student.ar.ts:429-503`; `modules/stream/src/infra/student.json-repo.ts:42` | `student-dmg.e2e.test.ts:82` (прогон Job; только повтор в тот же день) |
| P8-02 | = | Тот же текст и кнопка, канал invite; telegramId теперь резолвит стори по профилю, а не событие | `inactivity-sweep-job.ts:92-111`; `S:59-82` | `runners/u7-bot/src/controllers/streams/stories/inactivity.story.ts:69-101` | `inactivity.e2e.test.ts:172` |
| P8-03 | = | Тот же текст, кнопка, строка «ранее отправлены», fallback 8 символов id; поток и telegramId ментора резолвит стори | `inactivity-sweep-job.ts:114-122,157-185`; `S:84-126` | `inactivity.story.ts:104-152` | `inactivity.e2e.test.ts:193` |
| P8-04 | = | Те же цепочки (студенту 5,7,9…; ментору 7,9,11…, период 2 дня, независимые маркеры); сброс при activate и completeStep (`notices = []`); маркер теперь с точностью до минуты | `inactivity-sweep-job.ts:22-23,139-154` | `student.ar.ts:320,409,429-459,482-488,491-505` | нет (`student-dmg.e2e.test.ts:82` — только тишина при повторе в тот же день; повторы по дням — unit `domain/src/stream/student/job/inactivity-sweep.job.test.ts`, `modules/stream/src/student/job/inactivity-sweep.job.test.ts`) |
| P8-05 | ≠ регрессия | В v0.2.6 без telegramId студента/ментора (или без потока) маркер не ставился, попытка повторялась в следующий прогон. Сейчас `StudentAr.noticeInactivity` ставит маркер и публикует событие до проверки адреса, стори лишь пишет warn и выходит — уведомление теряется до следующего окна (2 дня). Ссылки на решение нет (событие «адреса не несёт» — проектное решение трека stream-dmg, но последствие для маркера нигде не описано); тяжесть низкая | `inactivity-sweep-job.ts:93-95,163-167` | `student.ar.ts:429-458`; `inactivity.story.ts:74-82,109-129` | нет (unit `inactivity.story.test.ts:372,383,426`) |
| P8-06 | ≠ намеренно | Обход продолжается, сбой одной записи не прерывает остальных, но лог другой: error «Непредвиденный сбой» / «Отказ: <код>» из `runLogged` вместо warn «Не удалось обработать студента …»; в отчёте Job — счётчик `failed`. Основание: Job на `dmg-core` (`job.forEach`, своя UoW на запись, API-06), трек `stream-dmg_20261103` | `inactivity-sweep-job.ts:67-76` | `modules/stream/src/student/job/inactivity-sweep.job.ts:29`; `node_modules/dmg-core/src/app/job/job-from-def.ts:67-81`; `.../system/run-logged.ts:12-27` | нет |
| P8-07 | = | Тот же confirm-экран и кнопки | `S:149-160` | `inactivity.story.ts:236-247` | `inactivity.e2e.test.ts:230` |
| P8-08 | = | UC `dropStudent` + тот же экран прощания «⬅️ В меню» | `S:161-163,193-215` | `inactivity.story.ts:248-250,280-300` | нет (unit `inactivity.story.test.ts:563`) |
| P8-09 | = | Тот же экран «⚠️ Запись студента не найдена» | `S:194-198` | `inactivity.story.ts:284-287,331-345` | нет (unit `inactivity.story.test.ts:618`) |
| P8-10 | ≠ намеренно | Отказ UC теперь warn-реплика поверх диалога (`ucErrorNotify`), а не экран «⚠️ …» через `handleError`. Основание: TR-65 (`handleError` — только internal), `dmg-cleanup_20261028` ФР-5 | `S:200-207` | `inactivity.story.ts:294`; `platform/core/src/ui/bot/bot-ui-story.ts:313-345` | нет |
| P8-11 | = | Тот же confirm-экран и кнопки «⚠️ Да, снять с учёбы» / «❌ Отмена» | `S:165-181` | `inactivity.story.ts:253-269` | нет (unit `inactivity.story.test.ts:586`) |
| P8-12 | = | Тот же экран «Запись студента не найдена» | `S:167-170` | `inactivity.story.ts:254-257` | нет (unit `inactivity.story.test.ts:618`) |
| P8-13 | = | UC `markAbandoned` cause=inactivity, тот же экран результата. Дополнительно (вне строки, см. P4-26): студент получает warn-уведомление о снятии, роль STUDENT не снимается — `stream-dmg_20261103` | `S:183-185,217-251` | `inactivity.story.ts:270-272,303-328` | `inactivity.e2e.test.ts:303` (частично: UC вызван напрямую, без нажатия кнопки) |
| P8-14 | ≠ намеренно | «Запись не найдена» — то же; отказ UC — warn-реплика (`ucErrorNotify`) вместо экрана ошибки. Основание: TR-65, `dmg-cleanup_20261028` ФР-5 | `S:217-236` | `inactivity.story.ts:307-321` | нет |
| P8-15 | = | Тот же мягкий кик (ban 60 с + unban) при самовыходе и снятии; нет группы / telegramId — пропуск; ошибка кика — warn. Сейчас ещё шлёт тексты (ментору при self, студенту при inactivity) — см. P4-26 | `S:128-133,308-322`; `A:509-530` | `inactivity.story.ts:159-199`; `runners/u7-bot/src/infra/bot-transport.ts:~510-531` | `inactivity.e2e.test.ts:217` |
| P8-16 | = | Тот же экран «⚠️ Неизвестная команда» и warn «Кнопка без обработчика» | `S:253-256`; `bot-ui-story.ts:261-272` | `inactivity.story.ts:274`; `platform/core/src/ui/bot/bot-ui-story.ts:254-266` | нет |
| P8-17 | = | Тот же планировщик (теперь `InProcJobScheduler` из `dmg-core`, D-71): тот же текст «Зарегистрирован job …» и исключение «Планировщик уже запущен»; 2 Job; в логе имя Job — `def.name` (`inactivitySweep`, `sweepAbandonedQuestionnaires`), ключи `last-runs.json` по нему (`debt.md:707`) | `main.ts:99-101`; `in-proc-job-scheduler.ts:45-98` | `runners/u7-bot/src/main.ts:119-123`; `platform/app/src/u7-app.ts:107-113,150-152`; `node_modules/dmg-core/src/app/job/in-proc-job-scheduler.ts:53-84` | нет (unit `in-proc-job-scheduler.test.ts` в `dmg-core`) |
| P8-18 | = | То же: один догоняющий прогон через стартовую задержку (3 мин), иначе ждёт окно; история — `JobRunJsonRepo` | `scheduled-job-runner.ts:57-82` | `node_modules/dmg-core/src/app/job/scheduled-job-runner.ts:49-73`; `platform/app/src/u7-app.ts:112` | нет |
| P8-19 | = | То же: `runAtStart` без истории — через задержку; `dailyAt` без истории — ближайшее окно | `scheduled-job-runner.ts:65-69,93-96` | `scheduled-job-runner.ts:56-71` (`dmg-core`) | нет |
| P8-20 | = | То же: ошибка — warn, `lastRunAt` фиксируется всегда, идущий прогон не стартует повторно, `stop()` снимает таймер | `scheduled-job-runner.ts:84-91,104-130` | `scheduled-job-runner.ts:76-132` (`dmg-core`) | нет |
| P8-21 | дубль P1-28 | — | — | — | — |
| P8-22 | дубль P1-29 | — | — | — | — |
| P8-23 | дубль P1-30 | — | — | — | — |
| P8-24 | = | Тот же экран «⚠️ Неизвестная команда» + warn «Кнопка без обработчика» | `bot-controller.ts:147-156,282-293` | `platform/core/src/ui/bot/bot-controller.ts:~271-283` | нет |
| P8-25 | дубль P1-32 | — | — | — | — |
| P8-26 | дубль P1-33 | — | — | — | — |
| P8-27 | дубль P1-01/P1-02 | — | — | — | — |
| P8-28 | дубль P1-06/P1-07 | — | — | — | — |
| P8-29 | дубль P1-09/P1-10 | — | — | — | — |
| P8-30 | дубль P1-11 | — | — | — | — |
| P8-31 | = | То же: слэш-текст, не разбираемый как команда, молча игнорируется | `A:223-229` | `runners/u7-bot/src/infra/bot-transport.ts:223-229` | нет |
| P8-32 | = | То же: исключение в стори → `stop` с экраном ошибки через `handleError`; `continue`-notice склеиваются над `stop`. Нюанс — см. P8-33…35: `handleError` теперь только internal | `bot-controller.ts:186-216,231-244` | `platform/core/src/ui/bot/bot-controller.ts:175-215,~220-235` | нет |
| P8-33 | ≠ намеренно | Ошибка валидации UC теперь warn-реплика `*Ошибка валидации* • поле: сообщение` без экрана и без подсказки «нажмите /start» (по `Err`, `ucErrorNotify`); исключение валидации в контроллере — уже общий internal-экран, ветки «Некорректные данные» нет. Основание: TR-65, `dmg-cleanup_20261028` ФР-5 | `bot-ui-story.ts:303-335`; `bot-controller.ts:354-386` | `platform/core/src/ui/bot/bot-ui-story.ts:313-330` (`ucErrorNotify`); `bot-controller.ts:~340-358` | нет |
| P8-34 | ≠ намеренно | not-found / conflict / access → warn-реплика (`label` из Def или `denyMessage`) вместо экрана «⚠️ {сообщение}» с кнопкой выхода (`errorExitRows`); ветки `AppException` удалены. Основание: TR-65, ФР-5 `dmg-cleanup_20261028` | `bot-ui-story.ts:337-341`; `bot-controller.ts:388-392` | `platform/core/src/ui/bot/bot-ui-story.ts:331-337` | нет |
| P8-35 | ≠ намеренно | Исключение — то же (лог error + экран «⚠️ Произошла внутренняя ошибка…»); отказ UC kind internal/unauthorized — warn-реплика «Произошла ошибка. Попробуйте ещё раз…», error в лог. Основание: TR-65 | `bot-ui-story.ts:343-353`; `bot-controller.ts:394-405` | `bot-ui-story.ts:296-312,338-345`; `bot-controller.ts:~343-358` | нет |
| P8-36 | ≠ намеренно | `errorNotify` теперь только internal (любое исключение → общая warn-реплика); доменные отказы — `ucErrorNotify`. Поведение «реплика без перерисовки, awaitInput сохраняется» то же. Основание: TR-65 | `bot-ui-story.ts:358-376+` | `platform/core/src/ui/bot/bot-ui-story.ts:~346-368` | нет |
| P8-37 | дубль P1-41 | — | — | — | — |
| P8-38 | дубль P1-38 | — | — | — | — |
| P8-39 | дубль P1-40 | — | — | — | — |
| P8-40 | дубль P1-40 | — | — | — | — |
| P8-41 | дубль P1-39 | — | — | — | — |
| P8-42 | = | Страницы/шапка «· Стр. N/M»/edit на месте/кеш — код `page-nav.ts` и `dialog-cache.ts` идентичен | `u7-bot-ui-story.ts:157-197`; `page-nav.ts:20-77`; `scope-reviews.story.ts:50-61` | `runners/u7-bot/src/core/u7-bot-ui-story.ts:258-300`; `platform/core/src/ui/bot/page-nav.ts`; `controllers/peer-review/stories/scope-reviews.story.ts:58` | `peer-review-view.e2e.test.ts:277` |
| P8-43 | = | Тот же вызов `emptyScreen` («💬 Отзывов по потоку пока нет.») | `u7-bot-ui-story.ts:178-181`; `scope-reviews.story.ts:52-57` | `u7-bot-ui-story.ts:258-300`; `scope-reviews.story.ts:60` | нет |
| P8-44 | = | `dialog-cache.ts` не менялся (чужая эпоха — промах, без диалога — no-op) | `dialog-cache.ts:3-41` | `platform/core/src/ui/bot/dialog-cache.ts:3-41` | нет (`peer-review-view.e2e.test.ts:277` проверяет попадание в кеш, не промах при смене диалога) |
| P8-45 | = | `cardPagedScreen` не менялся: 1/N только при N>1, индекс зажимается, пусто — `emptyScreen`. `my-reviews` и в v0.2.6 использует `pagedScreen` (блоки), не карточный | `u7-bot-ui-story.ts:205-249`; `school-reviews.story.ts:43-53`; `reviews-for-me.story.ts:45-51`; `my-reviews.story.ts:178` | `runners/u7-bot/src/core/u7-bot-ui-story.ts:306-360`; `school/stories/school-reviews.story.ts:50`; `peer-review/stories/reviews-for-me.story.ts:53`; `peer-review/stories/my-reviews.story.ts:142` | `peer-review-reviews-for-me.e2e.test.ts:98` (только «отзывы для меня»; школа и «мои отзывы» — нет) |
| P8-46 | дубль P2-02 | — | — | — | — |
| P8-47 | дубль P1-36 | — | — | — | — |
| P8-48 | дубль P1-50/P1-59 | — | — | — | — |
| P8-49 | дубль P1-60 | — | — | — | — |
| P8-50 | дубль P1-62 | — | — | — | — |

## П0 — служебные UC без пути из бота (оркестратор)

| ID | Статус | Обоснование / различие | v0.2.6 | Сейчас | e2e |
|---|---|---|---|---|---|
| P0-01 | ≠ намеренно | Удалён: `create-user` удалён — вызывающих нет (TR-61 С2); следствие — DEBT-52 (нечем завести первого ADMIN новой школы) | `packages/user/src/api/user/create-user-uc.ts:19` | — | нет (служебный) |
| P0-02 | = | `listUsers` перенесён (TR-61 С2); единственный вызывающий v0.2.6 — `u7-cli` — удалён, теперь вызывающих нет | `packages/user/src/api/user/list-users-uc.ts:19` | `domain/src/user/user/uc/list-users.uc.ts:16` | нет (служебный) |
| P0-03 | ≠ намеренно | Удалён: `set-next-preference` удалён — вызывающих нет (трек `stream-dmg_20261103`, spec п.1; TR-43); закрывает Q-19 | `packages/stream/src/api/student/set-next-preference-uc.ts:18` | — | нет (служебный) |
| P0-04 | ≠ намеренно | Удалён: `get-course-program` удалён — прод-вызывающих нет (TR-52 (3)); ER `wish` обходятся `getCoursesIncludingModule` + `getSameModules` | `packages/course/src/infra/course-in-proc-facade.ts:100` | — | нет (служебный) |
| P0-05 | = | Переименован в `getCoursesIncludingModule`; вызывает ER `fulfill-wish` | `packages/course/src/infra/course-in-proc-facade.ts:36` | `domain/src/course/course/uc/get-courses-including-module.uc.ts:15`; `modules/wish/src/wish/er/fulfill-wish.er.ts:65` | нет (служебный) |
| P0-06 | = | То же: `getLesson` вызывают скрипты через `_course-client` | `scripts/distribute-lesson.ts:401,478` | `domain/src/course/lesson/uc/get-lesson.uc.ts:13`; `scripts/_course-client.ts:105` | нет (служебный) |
| P0-07 | = | То же: вызывающих нет ни тогда, ни сейчас | `packages/questionnaire/src/api/questionnaire/get-questionnaire-uc.ts:12` | `domain/src/questionnaire/questionnaire/uc/get-questionnaire.uc.ts:10` | нет (служебный) |
| P0-08 | ≠ намеренно | Удалён: `resolve-content-path` удалён — прод-вызывающих нет (TR-52 (3), `course-dmg_20261105`) | `packages/course/src/api/content-path/resolve-content-path-uc.ts:65` | — | нет (служебный) |
