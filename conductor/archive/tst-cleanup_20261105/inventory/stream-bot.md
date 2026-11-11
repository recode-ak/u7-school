# Инвентаризация тестов: бот `stream` (потоки, ментор, учёба)

Трек `tst-cleanup_20261105`, фаза 1. Только чтение + прогоны `bun test`. Ничего не удалено и не изменено, кроме этого файла.

**Область.** `runners/u7-bot/src/controllers/streams/**`, `.../mentor/**`, `.../learning/**` (тесты), `runners/u7-bot/tests/streams/*.test.ts`, `runners/u7-bot/tests/mentor/*.test.ts`, `runners/u7-bot/tests/e2e/{stream-dmg,student-dmg,mentor-management}.e2e.test.ts`. 27 файлов.

**Как считал.** «Объявление» — строка `it(`/`test(`/`it.each(`; «кейс» — то, что печатает `bun test` (`test.each` разворачивается). Оценка — по объявлению: один `test.each` с таблицей — один кандидат. Вопрос к каждому объявлению — «какая реальная ошибка в коде **этого** модуля уронит его и только его?»; при сомнении — «полезен».

**Прогоны (worktree `tst-cleanup`).**

| Команда | Итог |
|---|---|
| `bun test` по всей области (27 файлов) | 333 объявления / 335 кейсов: **333 pass, 2 fail** |
| `bun test runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts` | 6 pass, **2 fail** |

Оба красных — в `student-dmg.e2e.test.ts:122` («advanced на последнем модуле → 🎉 Курс завершён (7c)») и `:251` («advanced на модуле со следующим → уведомления нет»): `expect(received).toContain(expected)`, студенту не приходит ни 7c, ни 7a. Причина та же, что в `wish.md`: незавершённый `course-dmg` (TR-57) — `HubStory` не получает место модуля (`get-module-place`) и молчит. **Это не бесполезные тесты, а работающий сторож связки стори ↔ модуль курса**: кандидатами не считаются, удалять нельзя до закрытия TR-57.

---

## Сводка

| Файл | Объявлений | Полезен | Сомнителен |
|---|---|---|---|
| `src/controllers/streams/controller.test.ts` | 6 | 2 | 4 |
| `src/controllers/streams/controller.stream-group.test.ts` | 9 | 9 | 0 |
| `src/controllers/streams/stream-nav-resolver.test.ts` | 5 | 5 | 0 |
| `src/controllers/streams/stories/stream-catalog.story.test.ts` | 11 | 7 | 4 |
| `src/controllers/streams/stories/view-stream.story.test.ts` | 36 | 31 | 5 |
| `src/controllers/streams/stories/inactivity.story.test.ts` | 16 | 14 | 2 |
| `src/controllers/streams/stories/inactivity.story.student.test.ts` | 14 | 8 | 6 |
| `tests/streams/catalog.integration.test.ts` | 6 | 1 | 5 |
| `tests/streams/view-stream.integration.test.ts` | 18 | 7 | 11 |
| `src/controllers/mentor/stories/activate-stream.test.ts` | 6 | 3 | 3 |
| `src/controllers/mentor/stories/create-stream.test.ts` | 37 | 30 | 7 |
| `src/controllers/mentor/stories/monitor.test.ts` | 29 | 25 | 4 |
| `src/controllers/mentor/stories/my-streams.test.ts` | 10 | 7 | 3 |
| `src/controllers/mentor/stories/submenu.test.ts` | 7 | 5 | 2 |
| `src/controllers/mentor/stories/view-stream-mentor.test.ts` | 21 | 13 | 8 |
| `tests/mentor/mentor.integration.test.ts` | 8 | 1 | 7 |
| `src/controllers/learning/controller.test.ts` | 4 | 1 | 3 |
| `src/controllers/learning/step-message.test.ts` | 4 | 4 | 0 |
| `src/controllers/learning/student-nav-resolver.test.ts` | 6 | 6 | 0 |
| `src/controllers/learning/stories/hub.test.ts` | 16 | 15 | 1 |
| `src/controllers/learning/stories/hub.student-events.test.ts` | 6 | 1 | 5 |
| `src/controllers/learning/stories/nav-tree.test.ts` | 10 | 6 | 4 |
| `src/controllers/learning/stories/progress.test.ts` | 6 | 4 | 2 |
| `src/controllers/learning/stories/step-view.test.ts` | 22 | 17 | 5 |
| `tests/e2e/stream-dmg.e2e.test.ts` | 5 | 0 | 5 |
| `tests/e2e/student-dmg.e2e.test.ts` | 8 | 2 | 6 |
| `tests/e2e/mentor-management.e2e.test.ts` | 7 | 7 | 0 |
| **Итого** | **333** | **231** | **102** |

Пути в таблицах — от корня репозитория (`runners/u7-bot/…`).

---

## Закономерности

### Известные (З1–З8 из `wish.md`), кратко

**З1 (паспорт Def), З2 (схемы платформы), З7 (тавтология) — 0 случаев.** В боте нет тестов Def/схем: стори работают через `dispatch` и `dmgDispatch`-мок, паспорта лежат в `domain/` и `modules/`.

**З3. Тест константы и состава — 8 случаев** (6 в таблице кандидатов + 2 оставленных сторожа: FQN `…/stories/inactivity.story.student.test.ts:118`, уникальность имён `…/learning/controller.test.ts:16`).
`name`, `stories.length`, список имён стори, FQN подписки. Признак: `grep -rnE "имя контроллера|содержит [0-9]+ stor|все ожидаемые имена|на FQN Def" --include=*.test.ts runners/u7-bot`. Почему бесполезен: `name` читают и объявление, и маршрутизатор через ту же константу — опечатка поедет согласованно; `stories.length` падает при **добавлении** стори и ничего не защищает (маршрутизацию проверяют forward-тесты). Исключение — FQN-сторож против legacy-имени (`student.completed`), это реальная историческая регрессия, оставить один.
Примеры: `…/streams/controller.test.ts:51`, `:56`, `…/learning/controller.test.ts:10`, `:24`. Как появляется: «зафиксирую состав реестра» при переносе контроллера. Что делать: удалить, кроме одного FQN-теста на подписку.

**З5. Правило проверено уровнем ниже, наверху — копия — 10 случаев.**
Резолверы навигации (`stream-nav-resolver.ts`, `student-nav-resolver.ts`) — чистые функции со своими тестами; стори-тесты повторяют те же правила (крошки, `enterable`, `prev/next`, отказ на заблокированный шаг). Признак: `grep -rn "Назад к проектам\|След. ▶️\|заблокирован" --include=*.test.ts runners/u7-bot`. Почему бесполезен: ошибка в маппинге статусов/адресов падает в тесте резолвера; стори добавляет только сборку клавиатуры, и это уже покрыто одним сценарием на экран. Примеры: `…/stories/view-stream.story.test.ts:692`, `:722`, `:755` ↔ `…/stream-nav-resolver.test.ts:114`, `:236`; `…/nav-tree.test.ts:391`, `:414` ↔ `…/student-nav-resolver.test.ts:256`, `:277`. Сколько: 10 (`view-stream.story` 3, `view-stream-mentor` 5, `nav-tree` 2). Как появляется: правило уезжает в резолвер, сценарий копируется на уровень выше «чтобы не упало покрытие». Что делать: удалить копии, оставить один сквозной на экран.

**З6. Копия соседнего теста без нового класса входа — 6 случаев** (4 в таблице + 2 отмечены вместе с З8).
Тот же вызов с другим `it`, либо `it`-перебор параметра, который код не читает. Примеры: `…/create-stream.test.ts:405` — тот же переход шаг 8 → 9, что `:448` (отличается только кнопкой «Пропустить»); `…/step-view.test.ts:458` — тот же `level: 'stream'`, что `:422` (отличается только мусорным id в коде кнопки); `…/step-view.test.ts:531` — тот же guard `streamId`, что `:332` (обе ветки зовут одну проверку в `step-view.ts:196,202`); `…/inactivity.story.student.test.ts:214` — цикл по трём причинам ухода, а кик `inactivity.story.ts` не зависит от причины. Как появляется: копипаст соседнего `it` с заменой статуса; перебор значений payload «на всякий случай». Что делать: свернуть в один кейс, второй ассерт перенести в оставшийся.

**З8. Поведение платформы (дефолт `U7BotUiStory`/`BotUiStory`) — 31 случай в таблице кандидатов**, плюс два экрана оставлены владельцами правила `buttons.mainMenu()` (`…/step-view.test.ts:156`, `…/progress.test.ts:124`).
Четыре вида, все — копия одного теста ядра в каждом файле стори:
1. **`menuButtons` пусто** — 7: `…/stream-catalog.story.test.ts:31`, `…/activate-stream.test.ts:35`, `…/create-stream.test.ts:118`, `…/monitor.test.ts:219`, `…/my-streams.test.ts:63`, `…/view-stream-mentor.test.ts:147`, `…/streams/controller.test.ts:62`. Покрыто: `runners/u7-bot/src/core/u7-bot-ui-story.test.ts:294`, `runners/u7-bot/src/core/u7-bot-controller.test.ts:99`.
2. **«Неизвестная команда»** — 15 (в т.ч. `…/monitor.test.ts:800` — тот же дефолт, посчитан в З6): `…/stream-catalog.story.test.ts:213`, `…/view-stream.story.test.ts:324`, `…/activate-stream.test.ts:71`, `…/create-stream.test.ts:779`, `…/monitor.test.ts:790`, `:800`, `…/my-streams.test.ts:174`, `…/submenu.test.ts:93`, `…/view-stream-mentor.test.ts:567`, `…/inactivity.story.test.ts:534`, `…/hub.test.ts:264`, `…/step-view.test.ts:587`, `…/nav-tree.test.ts:460`, `…/progress.test.ts:171`, `…/streams/controller.test.ts:95`. Покрыто: `platform/core/src/ui/bot/bot-ui-story.test.ts:638`, `platform/core/src/ui/bot/bot-controller.test.ts:625`.
3. **`handleMessage` по умолчанию («сообщения не принимаются») + `release`** — 7: `…/stream-catalog.story.test.ts:220`, `…/activate-stream.test.ts:83`, `…/monitor.test.ts:806`, `…/my-streams.test.ts:184`, `…/submenu.test.ts:101`, `…/view-stream-mentor.test.ts:577`, `…/view-stream.story.test.ts:547`. Покрыто: `platform/core/src/ui/bot/bot-ui-story.test.ts:277`, транспортный гейт — `runners/u7-bot/src/infra/bot-transport.test.ts:918`.
4. **«↩️ Главное меню» последней строкой** — 3: `…/step-view.test.ts:156`, `:437`, `:458`. Кнопку добавляет хелпер `buttons.mainMenu()` (`…/step-view.ts:281,305,323,362`), правило покрыто первым тестом.
Как появляется: `dmg-core gen` генерирует заготовку стори вместе с тестом дефолтов — и она копируется в каждый файл. Что делать: оставить **один** тест на дефолт в `runners/u7-bot/src/core/u7-bot-ui-story.test.ts` (он уже есть), остальные удалить.

### Новые

### З9. Два файла тестов одной стори после переезда на DMG — 12 случаев

**Что это.** Логику стори перенесли на Def-события, рядом появился новый файл тестов (`*.story.student.test.ts`, `*.student-events.test.ts`), а старый блок в основном файле не удалили. Оба зелёные, оба проверяют один код.

**Признак поиска.**
```bash
ls runners/u7-bot/src/controllers/*/stories/ | grep -E "\.(student|student-events)\."
grep -rn "подписк" --include=*.test.ts runners/u7-bot/src/controllers
```
В `wish` эталон такого не оставил — там подписки в одном файле.

**Почему бесполезен.** Второй файл не добавляет класса входа: тот же `sub.handle(event)`, тот же мок `sender`, те же тексты. Падает он ровно там же, где первый; при расхождении текстов падают оба и правка нужна в одном месте кода.

**Примеры.**
- `…/stories/hub.student-events.test.ts:72` (7c «Курс завершён») ↔ `…/stories/hub.test.ts:392` — одинаковые ассерты (`notify` один, `kind: 'info'`, «Курс завершён»); так же `:86`↔`:432` (7d), `:96`↔`:334` (7a), `:104`↔`:364` (7b), `:112`↔`:412` (нет `telegramId`).
- `…/stories/inactivity.story.student.test.ts:136` (warning → invite) ↔ `…/stories/inactivity.story.test.ts:238`; `:166`↔`:279` (candidate → invite ментору), `:182`↔`:307` (`wasWarned`), `:190`↔`:320` (fallback имени).

**Сколько.** 12 (5 в `hub`-паре; 6 в `inactivity`-паре + FQN-тест `inactivity.story.test.ts:223`).

**Как появляется.** Срез `student`/`inactivity` переписывал подписку на `*Events.*.name`; новый файл создавали «чтобы не ломать старый», старый оставили.

**Что делать.** Один файл на стори. Для `hub`: оставить `hub.test.ts` (ассерты строже — коды и тексты кнопок), перенести туда единственный уникальный тест `hub.student-events.test.ts:63` (подписка идёт на FQN, а не на `student.completed`) и удалить файл. Для `inactivity`: в `inactivity.story.student.test.ts` **уникальны** уведомления по `abandoned` (`:226` ментору `info`, `:240` студенту `warn`, `:253` `by_mentor` без текста, `:261` поток недоступен, `:268` нет `telegramId`) и пропуск при отсутствии профиля (`:152`) — перенести их в `inactivity.story.test.ts`, затем удалить student-файл целиком.

### З10. Правило общего хелпера раздела проверяется в каждом файле стори — 4 случая

**Что это.** `getStudent()` + `notEnrolled()` живут в одном месте (`runners/u7-bot/src/controllers/learning/shared.ts:41-62`), но «студент не записан → экран „Вы не записаны“» проверяется по разу в каждой стори раздела.

**Признак поиска.** `grep -rn "не записаны" --include=*.test.ts runners/u7-bot/src/controllers`

**Почему бесполезен.** Все четыре теста идут в один `notEnrolled()`; ошибка в нём валит четыре теста разом, а ошибка в отдельной стори (забыла вызвать `getStudent`) — тоже валит все четыре, потому что остальные строки экрана не проверяются. Различить «хелпер сломан» и «стори не позвала хелпер» нельзя, значит тест не про стори.

**Примеры.** `…/learning/stories/hub.test.ts:113`, `…/learning/stories/step-view.test.ts:571`, `…/learning/stories/nav-tree.test.ts:444`, `…/learning/stories/progress.test.ts:155` (тело одинаковое: мок `get-student-by-user` бросает → `toContain('не записаны')`).

**Сколько.** 4.

**Как появляется.** Хелпер выделили из первой стори (`hub`), тесты-копии остались в каждой следующей.

**Что делать.** Оставить один (`hub.test.ts:113`) либо завести `learning/shared.test.ts` и удалить все четыре из стори-файлов.

### З11. Интеграционный/e2e-тест повторяет unit-тест с тем же именем и тем же ассертом — 30 случаев

**Что это.** `tests/streams/*.integration.test.ts` и `tests/e2e/*` гоняют тот же сценарий, что тест стори, но через реальный `createTestApp` + транспорт. Имя почти дословно совпадает, ассерты — те же строки экрана; нового класса входа нет.

**Признак поиска.**
```bash
grep -rn "показывает карточку\|открывает список\|кнопка «Назад" --include=*.test.ts runners/u7-bot/tests
diff <(grep -o "test('[^']*'" a.test.ts) <(grep -o "test('[^']*'" b.test.ts)
```

**Почему бесполезен.** Дрейф контракта стори ↔ модуль ловит `tsc` (стори строит команды типизированно через `*UcDef.command`), а данные репозитория — тесты `json-repo`. Остаётся только «сборка приложения поднялась», и это уже проверяет один сквозной сценарий в том же файле. 18 прогонов через реальный app ради этого — лишний вес (каждый поднимает `createTestApp` и пишет файлы).

**Примеры.** `tests/streams/view-stream.integration.test.ts:82` ↔ `…/stories/view-stream.story.test.ts:137`; `:146` ↔ `:285`; `:153` ↔ `:310` (одинаковое имя «details: кнопка «Назад к потоку»»); `tests/streams/catalog.integration.test.ts:66` ↔ `…/stories/stream-catalog.story.test.ts:37` (одинаковое имя «list: показывает enrollment и active потоки»); `tests/e2e/stream-dmg.e2e.test.ts:84` ↔ `…/streams/controller.stream-group.test.ts:183`; `tests/e2e/student-dmg.e2e.test.ts:122` ↔ `tests/e2e/user-notify.e2e.test.ts:186` (тот же поток «Алгоритмика — Финальный поток», те же ассерты).

**Сколько.** 30 (`catalog.integration` 5, `view-stream.integration` 11, `mentor.integration` 3 через e2e-wizard, `stream-dmg.e2e` 5, `student-dmg.e2e` 6; `student-dmg.e2e:122` — дубль **другого** e2e-файла вне области, поэтому оставлен).

**Как появляется.** Интеграционные файлы писали до появления стори-тестов (легаси-эпоха), потом не чистили; e2e дописывали копированием.

**Что делать.** На файл — один сквозной сценарий (в `view-stream.integration` он уже есть: `:162`), остальные удалить. Для `student-dmg.e2e` оставить один тест на «шину» (событие → ER → стори → sender) — `:122`, он же сейчас красный по TR-57.

### З12. Проверка фикстуры, а не кода — 5 случаев (4 в таблице, `:71` оставлен smoke-ом, см. «Полезные тесты»)

**Что это.** Тест берёт засеянный объект по известному id и проверяет его поля (`status`, `mentorId`, `canManage`, «список пуст»). Ветки кода в нём нет: ветку проверяет UC/Policy, а наличие и содержимое записи — `seed:fixtures`.

**Признак поиска.** `grep -rn "e0e0e0e0\|e1e1e1e1" --include=*.test.ts runners/u7-bot/tests`

**Почему бесполезен.** «Поток существует» ломается от правки фикстуры, а не от ошибки в коде; правило `canManage` покрыто `modules/stream/src/stream/uc/read-stream.uc.test.ts:88`, список потоков — `list-streams` UC, список модулей — `modules/course/src/module/uc/list-modules.uc.test.ts`.

**Примеры.** `tests/mentor/mentor.integration.test.ts:85`, `:94`, `:103`, `:114`, `:71` (частично: перечисление 4 статусов фикстур).

**Сколько.** 5 из 8 в файле.

**Как появляется.** Первый интеграционный тест «на всякий случай проверю, что стенд засеялся».

**Что делать.** Удалить; оставить `:71` как smoke «приложение поднялось и модуль `stream` отвечает» — и то можно слить с `:85`.

### З13. Строка таблицы конфигурации как отдельный `it` — 4 случая

**Что это.** Шаги 4–8 wizard-а создания потока — одна таблица `OPTIONAL_FIELDS` (`…/mentor/stories/create-stream.ts:74-95`) и **один** обработчик (`:209-214`): поле выбирается по `stepToField`, дальше общий `#handleOptionalFieldInput`. Тестов на эти шаги — семь: по одному `accept-*` и `skip-*` на каждое поле из пяти.

**Признак поиска.** `grep -n "accept-goal\|skip-goal\|accept-result\|skip-rules\|accept-targetAudience\|skip-additional" runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts`

**Почему бесполезен.** Добавили шестое необязательное поле — пять зелёных тестов ничего не заметят; сломали общий обработчик — упадут все семь, и это будет один и тот же баг. Тесты различают только данные таблицы.

**Примеры.** `…/create-stream.test.ts:342` (`accept-result`), `:363` (`skip-rules`), `:384` (`accept-targetAudience`), `:448` (`ввод шаг 8`).

**Сколько.** 4 (плюс `:297`, `:320`, `:426` — их оставить: три класса входа `accept` / `skip` / `ввод`).

**Как появляется.** TDD по шагам wizard-а: каждый шаг писался отдельным тестом до того, как шаги свернулись в таблицу.

**Что делать.** Оставить три: `accept-goal` (`:297`), `skip-goal` (`:320`), `ввод шаг 4` (`:426`); остальные удалить. Если хочется страховки на таблицу — один `test.each` по `OPTIONAL_FIELDS`.

---

## Кандидаты

Только «сомнителен» и «пуст». Пути — от корня репозитория. Оценка «полезен» — в разделе «Полезные тесты».

### Реестры контроллеров (З3, З8)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `runners/u7-bot/src/controllers/streams/controller.test.ts:51` | имя контроллера — stream | З3 | маршрут — `:70`, `:83` (тот же `name`) | удалить |
| `runners/u7-bot/src/controllers/streams/controller.test.ts:56` | содержит 3 stories (catalog + view-stream + inactivity) | З3 | `:70`, `:83` — forward реально требует наличия стори | удалить |
| `runners/u7-bot/src/controllers/streams/controller.test.ts:62` | menuButtons пуст | З8 | `runners/u7-bot/src/core/u7-bot-controller.test.ts:99` | удалить |
| `runners/u7-bot/src/controllers/streams/controller.test.ts:95` | handleCallback — неизвестный префикс | З8 | `platform/core/src/ui/bot/bot-controller.test.ts:625` | удалить |
| `runners/u7-bot/src/controllers/learning/controller.test.ts:5` | имя контроллера — learning | З3 | — (константа; маршрут держит `app-controller`) | удалить |
| `runners/u7-bot/src/controllers/learning/controller.test.ts:10` | содержит 4 стори | З3 | — (падает при добавлении стори, ничего не защищает) | удалить |
| `runners/u7-bot/src/controllers/learning/controller.test.ts:24` | все ожидаемые имена стори присутствуют | З3 | — (дубль `:10` другими словами) | удалить |

### Копия дефолта платформы (З8)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.test.ts:31` | menuButtons возвращает пустой массив | З8 | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts:294` | удалить |
| `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.test.ts:213` | неизвестная команда каталога | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` | удалить |
| `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.test.ts:220` | handleMessage — дефолт ядра | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:277`, `runners/u7-bot/src/infra/bot-transport.test.ts:918` | удалить |
| `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:324` | неизвестная команда | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` | удалить |
| `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:547` | ввод без awaitInput-контекста — реплика-отказ + release | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:277` | удалить |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts:534` | неизвестный action — «Неизвестная команда» | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/activate-stream.test.ts:35` | menuButtons: пусто | З8 | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts:294` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/activate-stream.test.ts:71` | неизвестная команда | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/activate-stream.test.ts:83` | handleMessage: дефолт ядра | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:277` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:118` | menuButtons: пусто | З8 | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts:294` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:779` | неизвестная кнопка — «Неизвестная команда» | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/monitor.test.ts:219` | menuButtons: пусто | З8 | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts:294` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/monitor.test.ts:790` | неизвестная команда | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/monitor.test.ts:800` | пустой action — «Неизвестная команда» | З8 (З6) | `:790` того же файла (та же ветка `default`) | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/monitor.test.ts:806` | handleMessage: дефолт ядра | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:277` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/my-streams.test.ts:63` | menuButtons: пусто | З8 | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts:294` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/my-streams.test.ts:174` | неизвестный action | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/my-streams.test.ts:184` | handleMessage: дефолт ядра | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:277` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/submenu.test.ts:93` | неизвестный action | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/submenu.test.ts:101` | handleMessage: реплика-отказ + release | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:277` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/view-stream-mentor.test.ts:147` | menuButtons: пусто | З8 | `runners/u7-bot/src/core/u7-bot-ui-story.test.ts:294` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/view-stream-mentor.test.ts:567` | неизвестная команда | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/view-stream-mentor.test.ts:577` | handleMessage: дефолт ядра | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:277` | удалить |
| `runners/u7-bot/src/controllers/learning/stories/hub.test.ts:264` | неизвестная команда — экран unknownCommand | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` | удалить |
| `runners/u7-bot/src/controllers/learning/stories/step-view.test.ts:587` | неизвестная команда | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` | удалить |
| `runners/u7-bot/src/controllers/learning/stories/nav-tree.test.ts:460` | неизвестная команда | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` | удалить |
| `runners/u7-bot/src/controllers/learning/stories/progress.test.ts:171` | неизвестная команда | З8 | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` | удалить |
| `runners/u7-bot/src/controllers/learning/stories/step-view.test.ts:458` | complete (level=stream) — «↩️ Главное меню» в конце | З8 (З6) | `:422` того же файла (тот же экран) + `:156` (правило футера) | объединить с `:422` |
| `runners/u7-bot/src/controllers/learning/stories/step-view.test.ts:437` | complete (level=lesson) — «↩️ Главное меню» в конце | З8 | `:156` (то же правило, другой экран) | оставить один на файл |

### Правило общего хелпера раздела (З10)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `runners/u7-bot/src/controllers/learning/stories/step-view.test.ts:571` | студент не записан — экран «не записаны» | З10 | `runners/u7-bot/src/controllers/learning/stories/hub.test.ts:113` (тот же `notEnrolled()`) | удалить |
| `runners/u7-bot/src/controllers/learning/stories/nav-tree.test.ts:444` | студент не записан — экран «не записаны» | З10 | `runners/u7-bot/src/controllers/learning/stories/hub.test.ts:113` | удалить |
| `runners/u7-bot/src/controllers/learning/stories/progress.test.ts:155` | студент не записан → экран «не записаны» | З10 | `runners/u7-bot/src/controllers/learning/stories/hub.test.ts:113` | удалить |

### Два файла одной стори (З9)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `runners/u7-bot/src/controllers/learning/stories/hub.student-events.test.ts:72` | advanced, место известно, модуль последний → notify «Курс завершён» (7c) | З9 | `…/learning/stories/hub.test.ts:392` | удалить файл (после переноса `:63`) |
| `runners/u7-bot/src/controllers/learning/stories/hub.student-events.test.ts:86` | advanced, место неизвестно → notify «Модуль завершён» (7d) | З9 | `…/learning/stories/hub.test.ts:432` | удалить |
| `runners/u7-bot/src/controllers/learning/stories/hub.student-events.test.ts:96` | advanced + есть следующий модуль → только invite 7a | З9 | `…/learning/stories/hub.test.ts:334` (строже: код кнопки) | удалить |
| `runners/u7-bot/src/controllers/learning/stories/hub.student-events.test.ts:104` | not_advanced → только invite 7b | З9 | `…/learning/stories/hub.test.ts:364` | удалить |
| `runners/u7-bot/src/controllers/learning/stories/hub.student-events.test.ts:112` | у пользователя нет telegramId → ни notify, ни invite | З9 | `…/learning/stories/hub.test.ts:412` | удалить |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts:223` | подписывается на три события бездействия и ухода | З3/З9 | `…/stories/inactivity.story.student.test.ts:118` (строже: FQN + нет legacy-имён) | удалить |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts:118` | три подписки на FQN Def, legacy-имён student.* нет | З9 | после слияния — единственный сторож FQN; сохраняет `:223`-содержание | перенести в `inactivity.story.test.ts` |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts:136` | студенту invite с «🚪 Покинуть учёбу»; дни из payload | З9 | `…/stories/inactivity.story.test.ts:238` | перенести/удалить (файл сливается) |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts:166` | ментору invite с «⚠️ Снять с учёбы» | З9 | `…/stories/inactivity.story.test.ts:279` | удалить |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts:182` | wasWarned → строка «Уведомления были ранее отправлены» | З9 | `…/stories/inactivity.story.test.ts:307` | удалить |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts:190` | имя студента не резолвится → первые 8 символов userId | З9 | `…/stories/inactivity.story.test.ts:320` | удалить |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts:214` | кик из группы потока при любом уходе (цикл по 3 причинам) | З6 | `…/stories/inactivity.story.test.ts:339` (кик от причины не зависит) | свернуть в один кейс |

### Копия правила нижнего уровня (З5)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:692` | project: карточка проекта — список уроков и листание проектов | З5 | `…/streams/stream-nav-resolver.test.ts:114` | удалить крошки/`prev`/`next`-ассерты, оставить только коды кнопок |
| `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:722` | lesson: карточка урока — заголовки шагов в тексте, кнопок шагов нет | З5 | `…/streams/stream-nav-resolver.test.ts:154`, `:236` | удалить, оставить один экран (`:659`) |
| `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:755` | step: зритель получает отказ доступа к телу шага | З5 | `…/streams/stream-nav-resolver.test.ts:236` (viewer: вход в step запрещён) | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/view-stream-mentor.test.ts:220` | program: карточка модуля (root) — без статусов, назад в view-stream-mentor | З5 | `…/streams/stream-nav-resolver.test.ts:82` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/view-stream-mentor.test.ts:245` | program: карточка проекта — список уроков | З5 | `…/streams/stream-nav-resolver.test.ts:114` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/view-stream-mentor.test.ts:263` | program: карточка урока — все шаги доступны для ментора | З5 | `…/streams/stream-nav-resolver.test.ts:154` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/view-stream-mentor.test.ts:295` | program: карточка шага — ментор видит тело (readOnly) | З5 | `…/streams/stream-nav-resolver.test.ts:201` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/view-stream-mentor.test.ts:350` | details: показывает заполненные поля | З5 | `…/streams/stories/view-stream.story.test.ts:285` (тот же рендер в родителе) | удалить |
| `runners/u7-bot/src/controllers/learning/stories/nav-tree.test.ts:391` | на текущем шаге «След. ▶️» исчезает, если следующий заблокирован | З5 | `…/learning/student-nav-resolver.test.ts:256` | удалить |
| `runners/u7-bot/src/controllers/learning/stories/nav-tree.test.ts:414` | прямой запрос заблокированного шага — отказ | З5 | `…/learning/student-nav-resolver.test.ts:277` | удалить |

### Копия соседнего теста внутри области (З6)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:405` | skip-additional → шаг 9 (Telegram-группа) | З6 | `:448` того же файла (тот же переход шаг 8 → 9, только через ввод) + `:471` (экран шага 9) | объединить с `:448` |
| `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:342` | accept-result → шаг 6 (Правила) | З13 | `:297` (общий `#handleOptionalFieldInput`, `OPTIONAL_FIELDS`) | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:363` | skip-rules → шаг 7 | З13 | `:320` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:384` | accept-targetAudience → шаг 8 | З13 | `:297` | удалить |
| `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts:448` | ввод шаг 8 — дополнительно → шаг 9 | З13 | `:426` | удалить |
| `runners/u7-bot/src/controllers/learning/stories/step-view.test.ts:531` | my-study:view — другой streamId → ошибка | З6 | `:332` того же файла (один guard — `step-view.ts:196,202`) | удалить |
| `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.test.ts:231` | тексты экрана: заголовок и легенда статусов | З6 | `:37` (тот же экран целиком) | объединить с `:37` |

### Интеграционные тесты (З11)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `runners/u7-bot/tests/streams/catalog.integration.test.ts:66` | list: показывает enrollment и active потоки | З11 | `…/stories/stream-catalog.story.test.ts:37` | удалить |
| `runners/u7-bot/tests/streams/catalog.integration.test.ts:78` | list: скрывает completed и archived по умолчанию | З11 | `…/stories/stream-catalog.story.test.ts:69` | удалить |
| `runners/u7-bot/tests/streams/catalog.integration.test.ts:89` | list-with-completed: показывает завершённые | З11 | `…/stories/stream-catalog.story.test.ts:105` | удалить |
| `runners/u7-bot/tests/streams/catalog.integration.test.ts:102` | handleStart: кнопка «📚 Потоки курсов» отсутствует в меню | З11 | `runners/u7-bot/tests/e2e/main-menu.e2e.test.ts:93` (состав меню гостя) | удалить |
| `runners/u7-bot/tests/streams/catalog.integration.test.ts:109` | легенда цветных кружков | З11 | `…/stories/stream-catalog.story.test.ts:231` | удалить |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts:82` | view: показывает карточку enrollment-потока | З11 | `…/stories/view-stream.story.test.ts:137` | удалить |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts:91` | view: кнопки Программа, Детали, Назад к списку | З11 | `…/stories/view-stream.story.test.ts:196` | удалить |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts:109` | view: нет менторских lifecycle-кнопок (ментор своего потока) | З11 | `…/stories/view-stream.story.test.ts:223` | удалить |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts:129` | program: показывает карточку программы модуля | З11 | `…/stories/view-stream.story.test.ts:241` | удалить |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts:137` | program: кнопка «Назад к потоку» | З11 | `…/stories/view-stream.story.test.ts:659` | удалить |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts:146` | details: показывает детали потока | З11 | `…/stories/view-stream.story.test.ts:285` | удалить |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts:153` | details: кнопка «Назад к потоку» | З11 | `…/stories/view-stream.story.test.ts:310` (одноимённый) | удалить |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts:233` | students: кнопка «👥 Студенты» в карточке потока | З11 | `…/stories/view-stream.story.test.ts:196` | удалить |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts:248` | students: кнопка студента ведёт в view-stream:student-detail | З11 | `…/stories/view-stream.story.test.ts:560` (одноимённый) | удалить |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts:266` | students: публичный режим НЕ содержит кнопок ⛔✅🔄 | З11 | `…/stories/view-stream.story.test.ts:367` | удалить |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts:276` | students: публичная карточка студента (student-detail) | З11 | `…/stories/view-stream.story.test.ts:381` | удалить |
| `runners/u7-bot/tests/mentor/mentor.integration.test.ts:175` | полный wizard: все шаги → поток создан | З11 | `tests/e2e/mentor-management.e2e.test.ts:299` (тот же сценарий через меню) | удалить |
| `runners/u7-bot/tests/mentor/mentor.integration.test.ts:270` | wizard: ввод ID группы и инвайт-ссылки → оба поля сохранены | З11 | `…/mentor/stories/create-stream.test.ts:550`, `:581` + `tests/e2e/mentor-management.e2e.test.ts:299` | удалить |
| `runners/u7-bot/tests/mentor/mentor.integration.test.ts:359` | wizard: отмена создания потока через /cancel | З11 | `…/mentor/stories/create-stream.test.ts:805` + `tests/e2e/mentor-management.e2e.test.ts:400` | удалить |

### Проверка фикстуры (З12)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `runners/u7-bot/tests/mentor/mentor.integration.test.ts:85` | enrollment поток существует и доступен | З12 | `modules/stream/src/stream/uc/read-stream.uc.test.ts:88` (`canManage` по Policy) | удалить |
| `runners/u7-bot/tests/mentor/mentor.integration.test.ts:94` | active поток — статус active | З12 | `modules/stream/src/stream/uc/read-stream.uc.test.ts:88` | удалить |
| `runners/u7-bot/tests/mentor/mentor.integration.test.ts:103` | список студентов enrollment-потока (пустой) | З12 | `modules/stream/src/stream/uc/stream-students.uc.test.ts` (ветка «нет студентов») | удалить |
| `runners/u7-bot/tests/mentor/mentor.integration.test.ts:114` | wizard: список модулей для создания потока | З12 | `modules/course/src/module/uc/list-modules.uc.test.ts` | удалить |

### e2e-копии (З11)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `runners/u7-bot/tests/e2e/stream-dmg.e2e.test.ts:84` | в группе потока ушёл активный студент → ментору «покинул группу» | З11 | `…/streams/controller.stream-group.test.ts:183` (+ `tests/e2e/inactivity.e2e.test.ts:282`) | удалить |
| `runners/u7-bot/tests/e2e/stream-dmg.e2e.test.ts:97` | createStream → желающий получает ровно одно приглашение | З11 | `tests/e2e/user-notify.e2e.test.ts:106` (тот же ассерт «ровно одно приглашение») | объединить с `user-notify` (файл вне области — вопрос вызывающему) |
| `runners/u7-bot/tests/e2e/stream-dmg.e2e.test.ts:135` | findStreamByTelegramGroup: поток по группе; чужая группа — пусто | З11 | `…/streams/controller.stream-group.test.ts:108`, `:124` | удалить |
| `runners/u7-bot/tests/e2e/stream-dmg.e2e.test.ts:160` | в группе нового потока вступил чужой → предупреждение | З11 | `…/streams/controller.stream-group.test.ts:136` | удалить |
| `runners/u7-bot/tests/e2e/stream-dmg.e2e.test.ts:175` | событие в чужой группе → никому ничего | З11 | `…/streams/controller.stream-group.test.ts:124` | удалить |
| `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts:184` | not_advanced → студенту «Пройти модуль снова» (7b) | З11 | `…/learning/stories/hub.test.ts:364` | удалить |
| `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts:251` | advanced на модуле со следующим → уведомления нет | З11 | `tests/e2e/user-notify.e2e.test.ts:254` + `…/learning/stories/hub.test.ts:334` | удалить (**сейчас красный — TR-57**) |
| `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts:290` | dropStudent → ментору «покинул учёбу …» + мягкий кик | З11 | `…/stories/inactivity.story.student.test.ts:226`, `:214` | удалить |
| `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts:324` | markAbandoned(inactivity) → студенту «снят с учёбы» + кик | З11 | `…/stories/inactivity.story.student.test.ts:240`, `:261` | удалить |
| `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts:359` | markAbandoned(by_mentor) → кик, студенту текста нет (Т6) | З11 | `…/stories/inactivity.story.student.test.ts:253` | удалить |
| `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts:393` | runJob(inactivitySweep): студенту «Учёба стоит», ментору «Кандидат…» | З11 | `tests/e2e/inactivity.e2e.test.ts:177`, `:198` (тот же job, те же тексты) | удалить |

---

## Полезные тесты

| Файл | Оценка |
|---|---|
| `runners/u7-bot/src/controllers/streams/controller.test.ts` | 2 из 6: forward по префиксам `catalog:list` (`:70`) и `view-stream:view` (`:83`) — маршрутизация контроллера, больше нигде. |
| `runners/u7-bot/src/controllers/streams/controller.stream-group.test.ts` | 9 из 9: весь `handleMessengerEvent` (`findStreamByTelegramGroup` строкой, чужая группа → pass, `member_joined` неизвестного, `abandoned`, `member_left` активного/выбывшего/неизвестного, исключение → stop) — владелец этой ветки. |
| `runners/u7-bot/src/controllers/streams/stream-nav-resolver.test.ts` | 5 из 5: правила резолвера (адреса, `meta`, `prev/next/back`, `enterable`, viewer-запрет входа в step) — сюда и должны переехать копии из `view-stream*`. |
| `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.test.ts` | 7 из 11: три режима фильтра (`:37`, `:69`, `:105`, `:136`) — параметры, которые код читает; две заглушки (`:162`, `:175`) и «Назад в школу» последней строкой (`:196`). |
| `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts` | 31 из 36: карточка и её кнопки по статусу/актору, program/details с заглушками, students и student-detail, ветки `enroll` (кодовое слово, попытки, исчерпание), экранирование блока кода (`:215`), `lagMarker` (`:560`), мост на peer-review (`:815`, `:834`, отказ `:851`, `:866`, `:881`) — ядро публичной части. |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts` | 14 из 16: action-часть стори (`drop-student`, `mark-abandoned` с confirm и отказами) + warning/candidate/abandoned с киком; после слияния получит уведомления по `abandoned` из student-файла. |
| `runners/u7-bot/src/controllers/streams/stories/inactivity.story.student.test.ts` | 8 из 14: **уникально** — пропуск `warning` без профиля (`:152`), `candidate` без потока (`:198`) и без `telegramId` у ментора (`:204`), notify ментору при `self` (`:226`), notify студенту при `inactivity` (`:240`), молчание при `by_mentor` (`:253`), поток недоступен (`:261`), нет `telegramId` у студента (`:268`). Остальное — дубли. |
| `runners/u7-bot/tests/streams/catalog.integration.test.ts` | 1 из 6: `:118` — переключатель «Вкл. завершённые» нажатием кнопки с экрана (штамп + реальный модуль); остальное — копии story-тестов. |
| `runners/u7-bot/tests/streams/view-stream.integration.test.ts` | 7 из 18: `:100` (гость без lifecycle-кнопок), `:118` (несуществующий поток), `:162` (сквозной каталог↔поток↔программа), `:190` (сжатие/разжатие UUID), `:240` (список студентов с метриками — в стори только пустой список `:353`), `:310` (реальная запись по кодовому слову — единственный вход через настоящий UC `enroll`), `:347` (порядок модулей). |
| `runners/u7-bot/src/controllers/mentor/stories/activate-stream.test.ts` | 3 из 6: успех с точной кнопкой (`:40`), отказ UC (`:62`), `activate` без `streamId` (`:77`) — свой guard. |
| `runners/u7-bot/src/controllers/mentor/stories/create-stream.test.ts` | 30 из 37: шаги 0–3 и 9–12, `confirm` с полным `cmd` и UTC-датой (`:672`), отказ UC (`:720`), два guard-а контекста (`:735`, `:748` — в коде это **две разные копии** текста, `create-stream.ts:204` и `:759`), неизвестный шаг (`:759`), не-message (`:769`), `/cancel` активной и неактивной (`:791`, `:805`). |
| `runners/u7-bot/src/controllers/mentor/stories/monitor.test.ts` | 25 из 29: фильтр «только активные» и сводка (`:287`), `students-all` (`:338`), маркеры отставания (`:431`) и `🔄/⛔/✅` по роли (`:445`, `:468`), fallback имени (`:483`), сортировки (`:495`, `:519`), detail (`:549`), `mark-abandoned` (`:589`–`:639`), `complete` (`:654`–`:767`), заглушка history (`:780`). |
| `runners/u7-bot/src/controllers/mentor/stories/my-streams.test.ts` | 7 из 10: три комбинации переключателей (`:102`, `:116`, `:130`), `listStreams` с `mentorId` актора (`:143`), пустой список (`:153`), ошибка API (`:164`). |
| `runners/u7-bot/src/controllers/mentor/stories/submenu.test.ts` | 5 из 7: `menuButtons` по ролям (`:30`, `:44`, `:49`) и отказ не-ментору (`:81`) — Policy видимости. |
| `runners/u7-bot/src/controllers/mentor/stories/view-stream-mentor.test.ts` | 13 из 21: lifecycle по статусам (`:154`, `:181`, `:200`), отказ не-ментору (`:323`), monitor-кнопки в students (`:369`, `:407`, `:430`), `complete`/`archive` с отказами (`:451`–`:549`). Program-часть — копия резолвера. |
| `runners/u7-bot/tests/mentor/mentor.integration.test.ts` | 1 из 8: `:71` smoke — приложение поднялось, модуль `stream` отвечает на `listStreams`. |
| `runners/u7-bot/src/controllers/learning/controller.test.ts` | 1 из 4: `:16` — уникальные имена стори (дубль имени ломает маршрут по `path`, больше нигде). |
| `runners/u7-bot/src/controllers/learning/step-message.test.ts` | 4 из 4: `formatStepMessage` по режимам `student`/`readOnly`/`code`/`study` (крошки, статус, экранирование) — владелец форматтера. |
| `runners/u7-bot/src/controllers/learning/student-nav-resolver.test.ts` | 6 из 6: правила студенческого дерева (статусы, `enterable`, `prev/next` только по доступным, `null` на заблокированный шаг). |
| `runners/u7-bot/src/controllers/learning/stories/hub.test.ts` | 15 из 16: хаб и его кнопки для active/advanced/issued (`:83`, `:130`, `:149`), `leave-confirm` (`:174`), `dropStudent` и отказ (`:195`, `:219`), `menuButtons` по ролям (`:240`, `:251`), `description` (`:256`). |
| `runners/u7-bot/src/controllers/learning/stories/hub.student-events.test.ts` | 1 из 6: `:63` — подписка идёт на FQN `stream.student.completed`, а не на legacy `student.completed` (перенести в `hub.test.ts`). |
| `runners/u7-bot/src/controllers/learning/stories/nav-tree.test.ts` | 6 из 10: экран root/project/lesson со своими кодами кнопок и маркерами (`:243`, `:270`, `:301`), locked-урок без кнопок (`:336`), карточка шага (`:360`), алиас `my-study:project:<index>` (`:430`). |
| `runners/u7-bot/src/controllers/learning/stories/progress.test.ts` | 4 из 6: экран прогресса и метрики (`:89`, `:107`), кнопки возврата (`:124`), несовпадение `streamId` (`:143`). |
| `runners/u7-bot/src/controllers/learning/stories/step-view.test.ts` | 17 из 22: экран шага и `newMessage` (`:127`, `:172`), edit на месте для просмотра (`:203`), экранирование блока кода (`:215`), идемпотентность `already_completed` (`:248`), финал потока (`:287`, `:311`), guard `streamId` (`:332`), формат кода кнопки (`:346`), три уровня завершения (`:368`, `:398`, `:422`), просмотр шага с навигацией (`:477`, `:507`), несуществующий шаг (`:543`), поздравление завершившему (`:557`). |
| `runners/u7-bot/tests/e2e/stream-dmg.e2e.test.ts` | Полезных нет: все 5 — копии unit-тестов (`controller.stream-group`, `user-notify`). |
| `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts` | 2 из 8: `:412` — повторный `runJob(inactivitySweep)` в тот же день ничего не шлёт (идемпотентность job через реальный app, больше нигде); `:122` — единственный сторож шины `completed` (**сейчас красный — TR-57**). |
| `runners/u7-bot/tests/e2e/mentor-management.e2e.test.ts` | 7 из 7: сквозные пути через реальное меню и штампы (студенты с ⛔✅, `mark-abandoned` и `complete` с подтверждением, карточка студента, полный wizard `:299` и его отмена `:400`) — владелец e2e-уровня ментора, `mentor.integration` его дублирует. |

---

## Что проверить перед удалением (риски и спорные)

1. **З11 против «пирамиды».** `testing.md` §5 (TST-08) оставляет вызывающему один сквозной сценарий, но интеграционные файлы `tests/streams`, `tests/mentor` существуют с легаси-эпохи и, возможно, задумывались как «страховка от мока»: стори-тесты работают на `dmgDispatch`-моке и не замечают, что реальный UC не зарегистрирован в приложении. Перед удалением 30 кандидатов З11 проверить, что регистрация модулей покрыта (`runners/u7-bot/tests/mentor/mentor.integration.test.ts:71` — приложение поднялось и модуль `stream` отвечает) и что хотя бы один сквозной сценарий на раздел остаётся. Решение «удалять интеграционный или story-тест» — в синтезе, а не в шаге удаления.
2. **`tests/e2e/stream-dmg.e2e.test.ts` после чистки пуст.** Это осознанно: ветки `handleMessengerEvent` держит `controller.stream-group.test.ts` (9 тестов, тот же код). Но тогда «шина → контроллер → sender» остаётся без e2e — если считаем это отдельным риском, оставить один тест (`:84`) вместо пяти.
3. **`student-dmg.e2e.test.ts:122` и `:251` красные по TR-57.** Удалять `:184`, `:290`, `:324`, `:359`, `:393` можно и сейчас, но `:122`/`:251` трогать нельзя до закрытия `course-dmg`: иначе нечем подтвердить, что 7a/7c/7d живы.
4. **`hub`-пара.** Перед удалением `hub.student-events.test.ts` убедиться, что FQN-сторож `:63` переехал: он единственный, кто ловит возврат к legacy-имени `student.completed` (в `inactivity` такой же сторож есть, в `hub` — нет).
5. **`inactivity`-пара.** В student-файле 8 уникальных тестов (уведомления по `abandoned`, пропуски при отсутствии профиля/потока). Удаление файла без переноса этих пяти веток `abandoned` оставит уведомления «ментору/студенту при уходе» без покрытия — в старом файле их нет вообще.
6. **`view-stream-mentor` program-часть (4 теста).** Удаление опирается на то, что `ViewStreamMentorStory` делегирует `program` родителю (`…/stories/view-stream-mentor.ts`) и что публичный экран (`view-stream.story.test.ts:659`) идёт по тому же `resolveStreamNavLevel`. Проверить, что режимы `mentor`/`viewer` действительно различаются только флагом `mode` в резолвере, иначе `:323` (отказ не-ментору) останется единственным сторожем доступа ментора.
7. **З13 (`OPTIONAL_FIELDS`).** Если таблица полей снова «расползётся» на отдельные `if`-ветки, тесты по полям снова станут нужны — тогда один `test.each` по таблице, а не пять `it`-ов.
