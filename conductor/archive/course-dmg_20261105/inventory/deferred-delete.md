# Таблица удаления: отложенное до `course-dmg`

Трек `course-dmg_20261105`, фаза 7 (после слияния `tst-cleanup`). Основание — строки «отложить до course-dmg» в принятых таблицах трека `tst-cleanup_20261105`: [`wish-delete.md:119`](../../tst-cleanup_20261105/inventory/wish-delete.md), [`stream-bot-delete.md:97`, `:99`](../../tst-cleanup_20261105/inventory/stream-bot-delete.md), [`questionnaire-bot-delete.md:92–96`, раздел «После `course-dmg`»](../../tst-cleanup_20261105/inventory/questionnaire-bot-delete.md), [`questionnaire-app-delete.md:25`](../../tst-cleanup_20261105/inventory/questionnaire-app-delete.md). Закономерности — [`test-bloat.md` §2](../../../roadmap/test-bloat.md).

База на `main` (проверено): `bun run test:bot` → **939 pass, 0 fail (94 файла)**; `CI=true bun test` → 3610. Номера строк — текущие, после Ф4–Ф5 (`eee83a10`, UI курса на `dispatchUc`) и слияния `tst-cleanup` (`4e7e1d3a`).

Каждая ссылка «где покрыто» проверена скриптом (файл существует, на строке начинается `it(`/`test(`/`test.each`) и чтением (тест проверяет то же). Ссылки ведут только на тесты, которые эта таблица не удаляет.

## Таблица

| файл | строка | имя теста | Б-ID | действие | где покрыто |
|---|---|---|---|---|---|
| `runners/u7-bot/tests/e2e/wish-questionnaire.e2e.test.ts` | 442 | confirmed → на карточке кнопка «Отменить желание»; отмена → cancelled | Б-4 | удалить | `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:960` (карточка confirmed-желания — «🗑️ Отменить желание», без «Хочу пройти курс»), `:1222` (cancel-confirm → `cancel-wish`, «отменено»), `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:77` (отмена из `confirmed` разрешена), реальный confirmed (не через репозиторий) — `runners/u7-bot/tests/e2e/wish-questionnaire.e2e.test.ts:399` |
| `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts` | 96 | advanced на последнем модуле → «🎉 Курс завершён!» (7c) | Б-4 | удалить | `runners/u7-bot/tests/e2e/user-notify.e2e.test.ts:186` — тот же путь (createStream по `LAST_MODULE` → enroll → activate → complete `advanced`) и те же тексты «Курс завершён» + «Поздравляем» |
| `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts` | 158 | advanced на модуле со следующим → студенту уведомления нет | Б-4 | удалить | `runners/u7-bot/tests/e2e/user-notify.e2e.test.ts:254` (те же три ассерта: invite «записаться на следующий» есть, «Курс завершён» нет) + кнопочный invite — `runners/u7-bot/src/controllers/learning/stories/hub.test.ts:345` |
| `runners/u7-bot/tests/e2e/questionnaire-ux.e2e.test.ts` | 200 | radio: выбор → финализация Q1 с маркером (x) и БЕЗ клавиатуры → новый вопрос новым сообщением | Б-4 | удалить | `runners/u7-bot/src/controllers/questionnaire/stories/fill.dialog.test.ts:75` (`finalize` с `(x)`/`( )` + новый экран), `runners/u7-bot/src/infra/bot-transport.test.ts:663` (finalize — edit без клавиатуры, затем send нового), `:634` (edit на месте, тот же `messageId`) |
| `runners/u7-bot/tests/e2e/questionnaire-ux.e2e.test.ts` | 228 | multiple: тоггл редактирует на месте (клавиатура жива), «Далее» появляется/исчезает | Б-4 | удалить | `.../fill.dialog.test.ts:213` (`wait_next` — только screen, edit-in-place, клавиатура жива), `:438` («Далее -->» исчезает при пустом драфте) + «Далее -->» появляется — `.../inventory.test.ts:98`, edit на месте — `.../infra/bot-transport.test.ts:634` |
| `runners/u7-bot/tests/e2e/questionnaire-ux.e2e.test.ts` | 276 | «Далее» → финализация Q3 с финальными маркерами без клавиатуры + completed новым сообщением | Б-4 | удалить | `.../fill.dialog.test.ts:119` (`finalize` мультивыбора с `[x]`), `:152` (`completed`: finalize + `completionText` + `release`), `.../infra/bot-transport.test.ts:663` (finalize → edit без клавиатуры + send нового), `:691` (новый экран — новым сообщением, прежний погашен) |
| `runners/u7-bot/tests/e2e/questionnaire-ux.e2e.test.ts` | 339 | при чужом активном флоу: приглашение без предупреждения → «Продолжить анкету» переключает диалог | — | оставить | — (единственная проверка «мост открывает анкету поверх чужого флоу» на уровне транспорта) |
| `runners/u7-bot/tests/e2e/questionnaire-ux.e2e.test.ts` | 420 | без сессии (якорь app/invite): приглашение живо, кнопка открывает анкету | Б-4 | удалить | `runners/u7-bot/src/infra/bot-transport.test.ts:1376` (проактив без открытого диалога: кнопки штампуются якорем `seq=1` — приглашение не умирает) + переключение диалога мостом — `runners/u7-bot/tests/e2e/questionnaire-ux.e2e.test.ts:339` |
| `modules/questionnaire/src/questionnaire.module.test.ts` | 143 | запуск через фасад создаёт анкету за субъекта, ownerInfo сохранён | Б-9 | удалить | `runners/u7-bot/tests/e2e/wish-questionnaire.e2e.test.ts:253` (модуль-потребитель вызывает `startQuestionnaire` фасадом: анкета создана, Q1 показан, желание `pending`), `:399` (`ownerInfo` разобран обратно — `confirm-wish` ER подтверждает желание) |
| `runners/u7-bot/src/controllers/questionnaire/stories/inventory.test.ts` | 160 | invite:why:{qId}: кнопка «✅ Хорошо» → invite:invite | TST-09 | оставить | — (подпись `✅ Хорошо` держит только этот тест, поведенческого дубля нет) |
| `runners/u7-bot/src/controllers/questionnaire/stories/inventory.test.ts` | 173 | invite:invite:{qId}: кнопки start/why/decline | TST-09 | оставить | — (подписи callback-рендера `render.ts` `inviteKeyboard`: `❔ Зачем это нужно?` в `questionnaire-events.e2e.test.ts:209` проверяется на проактивной ветке (`invite.story.ts:82–92`), это другой код; `▶️ Начать заполнение`/`⏭️ Пропустить` там же) |
| `runners/u7-bot/src/controllers/questionnaire/stories/inventory.test.ts` | 194 | invite:decline:{qId} (S06a): confirm-кнопки пропуска | TST-09 | оставить | — (подписи `✅ Да, пропустить` / `❌ Нет, вернуться` нигде больше не проверяются) |
| `runners/u7-bot/src/controllers/questionnaire/stories/render.ts` | 46 | функция `inviteKeyboard` (код, не тест) | Б-13 | оставить | — (`export` уже удалён в `329d73c4`; локальная функция жива: `render.ts:139` в ветке `invited`, вызов — `invite.story.ts:172`; имя вне файла встречается только как фикстура `bot-transport.test.ts:1352`) |

## Слияния и переписывания

Не осталось: строк «слить» и «переписать» в таблице нет. Причины:

- **`wish-questionnaire.e2e.test.ts:442`** — приёмник из таблицы ветки (`wish-flow.integration.test.ts:251`, тест «confirmed-желание → W04 «обучаешься»; отмена из confirmed → cancelled») **удалён в Ф4–Ф5 осознанно**: `eee83a10` сузил `runners/u7-bot/tests/courses/wish-flow.integration.test.ts` до одного самого длинного пути (`:151` cancel из expressed, `:168` markdown-safe), а шапка файла (`:30–34`) прямо переводит ветки `confirmed` в `course-catalog.story.test.ts`. Покрытие там и держится (`:960`, `:1222`), поэтому вместо слияния — удаление.
- **`inventory.test.ts:160/173/194`** — снятие подписей кнопок («тогда же» в таблице ветки) отменяется: после чистки подписей экранов S01, `why:` и `decline:` поведенческих дублей не осталось (поведенческие тесты держат коды: `invite.story.dmg.test.ts:222`, `:248`).
- **Слияние `questionnaire-ux.e2e.test.ts` ↔ `wish-questionnaire.e2e.test.ts`** (вопрос orchestrator из `questionnaire-bot-delete.md`) — снимается: пересечение было на `:200/:228/:276/:420`, а они удаляются; остающийся `:339` (мост поверх чужого флоу) не пересекается с тестами `wish-questionnaire.e2e.test.ts` (`:253`, `:334`, `:366`, `:399`, `:442`).
- **`inviteKeyboard` (Б-13)** — удалять нечего: экспорт снят в `329d73c4`, функция используется живой веткой `invited`.

## Удаляемое вместе с тестами

- `modules/questionnaire/src/questionnaire.module.test.ts`: `probe`-модуль — `ProbeArDef`, `probeSpec`, `ProbeUcDef`, `ProbeModuleDef`, класс `ProbeUc` (строки 59–115) и блок `describe('модуль анкет через фасад потребителя (D-43)')` с фабрикой `probe()` (132–158); осиротевшие импорты — `AggregateDef`, `allowAll`, `BaseEntityFields`, `Caller`, `ModuleDef`, `ModuleDeps`, `ParsedInputOf`, `UnitOfWork`, `UseCaseDef`, `UseCaseFromDef`, `ModuleFacade`, `QuestionnaireModuleDef`, `v` (valibot), `ok`, тип `QuestionnaireUser`. Остаётся smoke `:164` (реальный `QuestionnaireJsonRepo` в `mkdtemp`).

## Сдвиги номеров относительно таблиц ветки

| было (таблица ветки) | стало (сейчас) |
|---|---|
| `wish-questionnaire.e2e.test.ts:460` | `:442` (приёмник `wish-flow.integration.test.ts:251` отсутствует) |
| `student-dmg.e2e.test.ts:122` | `:96` |
| `student-dmg.e2e.test.ts:251` | `:158` |
| `questionnaire.module.test.ts:169` | `:143` (probe — 59–115, было 52–122) |
| `hub.test.ts:334` | `:345` |
| `inventory.test.ts:357/371/393` | `:160/:173/:194` |
| `questionnaire-ux.e2e.test.ts:200/228/276/339/420` | без сдвига |
| `fill.dialog.test.ts:76/189/249` | `:75/:152/:213` |
| `bot-transport.test.ts:663/1376` | без сдвига |

## Итог

| действие | сколько |
|---|---|
| удалить | 8 |
| слить | 0 |
| переписать | 0 |
| оставить | 4 (+1 строка кода: `inviteKeyboard`) |

Все восемь удалений — по одному объявлению и одному кейсу (ни одно не `test.each`), файлы после удалений не пустеют (`questionnaire-ux.e2e.test.ts` — 1 тест, `student-dmg.e2e.test.ts` — 1, `wish-questionnaire.e2e.test.ts` — 5, `questionnaire.module.test.ts` — 1).

- `bun run test:bot`: **939 → 931** (−8), файлов 94 → 94.
- `CI=true bun test`: **3610 → 3602** (−8).

## Спорные строки

1. `wish-questionnaire.e2e.test.ts:442` — таблица ветки требовала «слить», я ставлю «удалить»: приёмник удалён в Ф4–Ф5, а сценарий держат три уровня (`course-catalog.story.test.ts:960`, `:1222`, `cancel-wish.uc.test.ts:77`) плюс реальный `confirmed` в `:399`. Альтернатива, если нужен именно сквозной e2e — слить в `:399` (тогда `:399` обрастает шагом «карточка → отмена»).
2. `inventory.test.ts:160/173/194` — таблица ветки требовала снять подписи кнопок; я оставляю: после чистки это единственные проверки подписей экранов S01/`why:`/`decline:` (коды держат `invite.story.dmg.test.ts:222`, `:248`, подписи — только проактив в `questionnaire-events.e2e.test.ts:209`, другая ветка кода).
3. `questionnaire-ux.e2e.test.ts:420` — удаление опирается на два теста «по частям» (`bot-transport.test.ts:1376` — якорь + `:339` — мост); отдельной проверки «клик по кнопке проактива открывает анкету без /start» после удаления не останется. Если она нужна — строку `:420` оставить.
4. `modules/questionnaire/src/questionnaire.module.test.ts:143` — единственный тест D-43 «потребитель вызвал чужой UC через `this.call`»; e2e `:253` держит это поведение косвенно (через `pending`-желание и `:399` с разбором `ownerInfo`), но не проверяет субъекта явно. Удаление принято таблицей ветки — при сомнении оставить как единственный unit-сторож D-43.
5. `inviteKeyboard` (Б-13) — таблицы ветки требовали «удалить с кодом»; считать закрытым в `329d73c4` (экспорт удалён, функция жива). Если решено снимать и локальную функцию — это перепроектирование ветки `invited` в `renderActionResponse` (`invite.story.ts:172`), а не чистка тестов.

## Приёмка (Opus, 2026-11-11)

Принята целиком: ссылки «где покрыто» сверены выборочно (13 из 13 — на начало `it`/`test`). Спорные строки 1–5 — как предложено: `:442` удалить (приёмник снят в `eee83a10`, сценарий держат `course-catalog.story.test.ts` и `cancel-wish.uc.test.ts`); подписи `inventory.test.ts:160/173/194` и `inviteKeyboard` оставить; `questionnaire-ux.e2e.test.ts:420` и `questionnaire.module.test.ts:143` удалить по решению таблиц ветки (механику `this.call` держит платформа, связку — e2e `:253`, `:399`).
