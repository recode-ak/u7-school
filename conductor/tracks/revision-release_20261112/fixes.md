# Исправления Фазы 5 (ФР-6)

Вход: [e2e-gaps.md](./e2e-gaps.md), [regressions.md](./regressions.md), группа «погасить» [triage.md](./triage.md), исполнение решений [cards.md](./cards.md).

Колонки: **Источник** — откуда строка; **Размер** — S / M / L; **Срез** — подфаза Ф5.N (дописывается в план), `решение` — ждёт Нурболата (задача «разбор `cards.md` и `fixes.md`»), `[?]` — кандидат в `tracks.md`, `док` — без кода (задача «Оставить» или Ф6). Закрытие — SHA в столбце «Коммит».

## Предлагаемые срезы

| Срез | Состав | Исполнитель | Зависит от |
|---|---|---|---|
| Ф5.1 Харнес e2e | F-01…F-04 | `dmg-test-designer` (Opus — инфраструктура тестов) | — |
| Ф5.2 Недостающие e2e | F-10…F-34 | `dmg-test-designer` (Sonnet, порциями по файлам) | Ф5.1 |
| Ф5.3 Бот-раннер | F-40…F-4A, F-91 | `dmg-api-author` / Opus по месту | Ф5.2 (red-тесты) |
| Ф5.4 Линт и правила | F-50…F-52 | orchestrator + `dmg-api-author` | — |
| Ф5.5 Платформа `dmg-core` | F-60…F-63 | Opus (платформа) | — |
| Ф5.6 Домен и модули | F-70…F-74 | `dmg-domain-author` / `dmg-api-author` (Sonnet) | Ф5.4 (линт видит `modules/**`) |
| Ф5.7 Скрипты снимков | F-80 | `dmg-api-author` + `dmg-data-keeper` | — |

Порядок: Ф5.1 → Ф5.2 (red на регрессиях и C-01/C-13 — до правок Ф5.3); Ф5.4 и Ф5.5 независимы, можно раньше.

## Ф5.1 Харнес e2e

| ID | Источник | Что | Размер | Срез | Коммит |
|---|---|---|---|---|---|
| F-01 | e2e-gaps, TR-50 (3) | Управляемые часы в `createTestApp` — блокер P8-04, P8-05, P7-49…P7-51, P7-54 | M | Ф5.1 | af4593e9 |
| F-02 | e2e-gaps (Q-01/Q-02) | Хелпер событий групп `chat_member` / `my_chat_member` в `TestBotTransport` **через транспорт**, не `uiApp.handleMessengerEvent` | S | Ф5.1 | af4593e9 |
| F-03 | e2e-gaps, `transport` | Хелперы транспорта: нажатие до `/start`, неизвестный shortId (`dropSession`), дубль-тап, текст без `/`, сбой `RecordingBotApi`, параллельные апдейты | M | Ф5.1 | af4593e9 |
| F-04 | TR-57 | Хеш кеша миров не видит правку `builder.ts` — `runners/u7-bot/tests/worlds/materializer.ts:63` (`computeSourceHash`) | S | Ф5.1 | af4593e9 |
| F-05 | C-13 (попутно) | Мир `core-education`: у Андрея уже есть кампания `c1a11111…` по Потоку 2 — ER `createStudentCampaign` выходит по `unique`; убрать, чтобы приглашение на отзыв проверялось вручную. **Итог:** мир не меняется (кампания нужна 4 тестам), приглашение — e2e `peer-review-campaign` и ручная проверка на Марине | S | Ф5.1 | af4593e9 |

## Ф5.2 Недостающие e2e (247 строк в 25 файлов)

Тест, падающий на текущем коде, — строка в `regressions.md` (не чинить в Ф5.2). Состав строк — раздел файла в `e2e-gaps.md`.

| ID | Файл `runners/u7-bot/tests/e2e/` | Строк | Размер | Блокер |
|---|---|---|---|---|
| F-10 | `main-menu.e2e.test.ts` | 8 | S | |
| F-11 | `school.e2e.test.ts` (новый) | 8 | S | |
| F-12 | `transport.e2e.test.ts` (новый) | 15 | M | F-03 |
| F-13 | `group-events.e2e.test.ts` (новый) | 8 | S | F-02 |
| F-14 | `user-notify.e2e.test.ts` | 5 | S | |
| F-15 | `inactivity.e2e.test.ts` | 11 | M | F-01 |
| F-16 | `course-catalog.e2e.test.ts` (новый) | 26 | M | |
| F-17 | `wish-questionnaire.e2e.test.ts` | 20 | M | F-01 (P7-49…P7-54) |
| F-18 | `learning.e2e.test.ts` (новый) | 26 | M | |
| F-19 | `curious-showcase.e2e.test.ts` | 13 | S | |
| F-20 | `stream-enroll.e2e.test.ts` (новый) | 9 | S | |
| F-21 | `mentor-management.e2e.test.ts` | 15 | M | |
| F-22 | `stream-lifecycle.e2e.test.ts` (новый) | 9 | S | |
| F-23 | `mentor-monitor.e2e.test.ts` (новый) | 6 | S | |
| F-24 | `admin.e2e.test.ts` (новый) | 8 | S | |
| F-25 | `student-dmg.e2e.test.ts` | 2 | S | |
| F-26 | `peer-review-campaign.e2e.test.ts` | 14 | M | |
| F-27 | `peer-review-hub.e2e.test.ts` | 3 | S | |
| F-28 | `peer-review-notify.e2e.test.ts` | 2 | S | |
| F-29 | `peer-review-reviews-for-me.e2e.test.ts` | 2 | S | |
| F-30 | `peer-review-view.e2e.test.ts` | 2 | S | |
| F-31 | `questionnaire-ux.e2e.test.ts` | 22 | M | |
| F-32 | `questionnaire-events.e2e.test.ts` | 5 | S | |
| F-33 | `ui-errors.e2e.test.ts` (новый) | 6 | S | |
| F-34 | `pagination.e2e.test.ts` | 2 | S | |

## Ф5.3 Бот-раннер

| ID | Источник | Что | Размер | Срез | Коммит |
|---|---|---|---|---|---|
| F-40 | C-01 (TR-68) | Гость без `/start`: резолвер `create-ui-app.ts:94-104` → `U7BotActor \| null`, `ui-app` на `null` отвечает «Нажмите /start» (≈5 мест); сначала e2e на нынешнее поведение и сверка с v0.2.6 | S–M | Ф5.3 | |
| F-41 | C-13 | `answerCallbackQuery` сразу (до обработки; отказы с `show_alert` — как сейчас), снятие кнопок старого экрана — параллельно с отправкой нового (`infra/bot-transport.ts:296-302`) | S | Ф5.3 | |
| F-42 | regressions Q-01/Q-02 | Зарегистрировать `chat_member` / `my_chat_member` → `transport.handleChatMember/handleMyChatMember` в `main.ts:193-194` (на `bot`, не `privateBot`); red — F-13 | S | Ф5.3 | |
| F-43 | C-03 (исполнение) | Ветвление stories по полям view (`view-stream-mentor.ts:105-123`, `my-streams.ts:65-70`, `stream-catalog.story.ts:57-66`, `view-stream.story.ts:184, 467`, `fill.story.ts:325`) → признаки в готовом ответе UC (D-72) | M | Ф5.3 | |
| F-44 | C-04 (TR-50 (6)) | Алиасы `questionnaire-events.ts` → в `fill.story.ts`, `invite.story.ts`; файл удалить; попутно проверить TR-50 (9) correlation | S | Ф5.3 | |
| F-45 | TR-68 | `NOT_FOUND` в `scope-reviews.story.ts:92` — штатный отказ вместо `throw` | S | Ф5.3 | |
| F-46 | TR-68 | Имя по умолчанию в `ensure-registered.ts:57` | S | Ф5.3 | |
| F-47 | TR-59 | `controllers/courses/ui-spec.md:25-27` — курс без этапов / с одним этапом: спеку под код | S | Ф5.3 | |
| F-48 | ревью Ф5.1 | `Date.now()` в `controllers/learning/stories/progress.ts:144` — мимо `now()` из `@u7-scl/core/shared`, тестовые часы его не видят | S | Ф5.3 | |
| F-49 | regressions P1-26 | `/log_level <неизвестный>` — экранирование MarkdownV2 в `app-controller.ts`, снять `skip` в `main-menu.e2e` | S | Ф5.3 | |
| F-4A | Ф5.2 порция 2 | P4-68: unit-тест ветки «сбой `FindStreamByTelegramGroup`/`getStreamMembers`/`getUser` → warn и стоп» у контроллера событий группы (e2e не инъецирует сбой) | S | Ф5.3 | |

## Ф5.4 Линт и правила

| ID | Источник | Что | Размер | Срез | Коммит |
|---|---|---|---|---|---|
| F-50 | C-02 (TR-68) | `includes` ERR-01 и API-02 в `biome.json` → `modules/**/*.{uc,er,facade,job}.ts`; 2 недостижимых `throw` (`activate-stream.uc.ts:54`, `enroll-student.uc.ts:91`) — `biome-ignore` «ERR-01: недостижимо — <правило>»; прочие находки — новыми строками сюда | S | Ф5.4 | afc1b8f1 |
| F-51 | C-02 | Исключение «недостижимый `throw` с `biome-ignore`» — в текст ERR-01 (`dmg-core`, `docs/reference/rules.md`) | S | Ф5.4 | afc1b8f1 |
| F-52 | C-03 (1) | Снять оговорку «до миграции UI» в `conductor/architecture/rules.md:15` | S | Ф5.4 | afc1b8f1 |

## Ф5.5 Платформа `dmg-core`

| ID | Источник | Что | Размер | Срез | Коммит |
|---|---|---|---|---|---|
| F-60 | C-12 | Лог операций: `writes` (`[{ aggregate, uuid, version: from → to }]` из UoW), выход query — `{ ok, size }`, команд — целиком, `durationMs` до 0,1 мс (`operation-run.ts`, `operation-record.ts`); D-NN пакета — уточнение D-43 | S–M | Ф5.5 | |
| F-61 | TR-14 | Порог размера `events`/`payload` в `jsonl-operation-log.ts:6`; grit на поля-стрелки шагов. Пересечение с F-60 — делать вместе | M | Ф5.5 | |
| F-62 | TR-25 | `module?` → обязательное в `unit-of-work.ts:34` (ломающее API пакета; правка вызовов u7-school) | M | Ф5.5 | |
| F-63 | C-05 | JSDoc «Кто / Зачем» обязателен только для Ar/Policy/DQS в контракте — правка D-69/D-45 | S | Ф5.5 | |

## Ф5.6 Домен и модули

| ID | Источник | Что | Размер | Срез | Коммит |
|---|---|---|---|---|---|
| F-70 | TR-7 | Выбор «текущего» желания — из репозитория в Ar/правило (`wish.repo.ts:20`, `wish.json-repo.ts:54`, API-03) | M | Ф5.6 | |
| F-71 | TR-58 | Общая `versionOut` для 4 Ar `course` — в один файл | S | Ф5.6 | |
| F-72 | TR-41 | Устаревшая ссылка `StreamStudents` в `stream.types.ts:4` | S | Ф5.6 | |
| F-73 | TR-68 | `VERSION_CONFLICT` в `peer-review/src/infra/{review,review-campaign}.json-repo.ts` | S | Ф5.6 | |
| F-74 | C-05 | Шапки контрактов `wish`, `peer-review`, `course` под D-69; JSDoc у Ar/Policy/DQS в контрактах; `ReviewState` убрать из контракта `peer-review`, если клиентов вне модуля нет | S | Ф5.6 | |

## Ф5.7 Скрипты снимков

| ID | Источник | Что | Размер | Срез | Коммит |
|---|---|---|---|---|---|
| F-80 | TR-45 | `scripts/update-stream-snapshot.ts:239`, `scripts/stream-snapshot-sync.ts:38` пишут сырой JSON без `version` → через репозитории и UoW; тест на временном каталоге; `dmg-data-keeper` — совместимость снимков | M | Ф5.7 | |

## Решения Нурболата (до подфаз)

Все рекомендации приняты (Нурболат, 2026-11-13).

| ID | Источник | Вопрос | Рекомендация |
|---|---|---|---|
| F-90 | regressions P3-27 | Пустая программа потока: экран «⚠️ Программа потока не найдена.» (v0.2.6) против нулевого прогресса | намеренно — снимок в контракте всегда есть, пустая программа = нулевой прогресс; e2e на нынешнее поведение |
| F-91 | regressions P8-05 (red: `skip` в `inactivity.e2e`, нужен производный мир без `telegramId`) | `inactivity-sweep` без `telegramId`: маркер ставится, уведомление теряется до следующего окна | исправить (S): маркер — после резолва адреса; red — F-15 |
| F-92 | regressions Q-01/Q-02 | События групп на проде не работают (дефект v0.2.6) | исправить в релизе — F-42 (S) |
| F-93 | e2e-gaps g-25 ([C-14](./cards.md#c-14)) | Проводка `main.ts` (6 строк) | без e2e; F-42 закрывается e2e через `TestBotTransport` (F-13) |
| F-94 | e2e-gaps g-26 | Планировщик `dmg-core` (4) | без e2e — unit-тесты пакета |
| F-95 | e2e-gaps g-27 | UC удалён (22) | без e2e — путь удалён намеренно |
| F-96 | e2e-gaps g-28 | Служебный UC без UI (11) | без e2e — тесты модуля |

## Без кода

| ID | Источник | Что | Где | Задача |
|---|---|---|---|---|
| F-100 | TR-3 | Правило «отказ перехода = `conflict`» | `decisions.md` | «Оставить» |
| F-101 | TR-30 | ALS-контекст запроса | `decisions.md` | «Оставить» |
| F-102 | TR-38 | «Коммит = red + реализация» | `conductor/workflow.md` | «Оставить» |
| F-103 | C-06 (TR-20) | Повторное приглашение по желанию — как в v0.2.6, отсев — `Inbox` | `decisions.md` | «Оставить» |
| F-104 | C-07 (TR-39) | `peer-review-question-pool` — где лежит и зачем, рядом с likert-кампаниями | `roadmap.md` | «Оставить» |
| F-105 | C-09 (DEBT-43) | Цепочка зоны: пользователь → школа → UTC+5 | `debt.md`, `roadmap/schools-system.md` | «Оставить» |
| F-106 | C-10 (DEBT-46) | «Погашает» — «не запланировано, `roadmap.md`» | `debt.md` | «Оставить» |
| F-107 | C-11 (DEBT-49) | Расширение проектное: закрыть DEBT-49, ограничение — в `agents.md` | `debt.md`, `agents.md` | «Оставить» |
| F-108 | C-08 (TR-66), TR-8, TR-49 (7) | Ключи `last-runs.json` без миграции; разбор `wishes.json` на prod; бэкап | `rollout.md` | Ф6 |

## Кандидаты `[?]`

| ID | Источник | Что | Размер |
|---|---|---|---|
| F-110 | C-03 Б | Домен на фронте для `stream`: контракт отдаёт `StudentAr`/DQS, UI считает вопросами `ReadonlyAr` | L |
| F-111 | C-12 | Патч изменённых полей state в логе операций («было → стало», персональные данные) | M |
