# Инвентаризация тестов: модуль `wish`

Трек `tst-cleanup_20261105`, фаза 1. Только чтение + прогоны `bun test`. Ничего не удалено и не изменено, кроме этого файла.

**Как считал.** «Объявлений» — строки `it(`/`test(`/`it.each(`; «выполнено» — кейсы, которые печатает `bun test` (разворачивает `it.each`). Оценка — по объявлению; один `it.each` с таблицей — один кандидат, даже если он делает 3–6 кейсов.

**Прогоны (на этом worktree, `git status` чист).**

| Команда | Итог |
|---|---|
| `bun test domain/src/wish modules/wish/src` | 348 pass, 0 fail (29 файлов) |
| `bun test runners/u7-bot/{...wish...}` (5 файлов области) | 20 pass, **8 fail** |

8 красных тестов бота (`wish-flow.integration.test.ts:194,281`; `e2e/wish-questionnaire.e2e.test.ts` — 6 из 7) падают **не из-за `wish`**: экран каталога перестал рендерить карточку/кнопку курса («⚠️ Курс не найден или недоступен», «Кнопка «Хочу пройти курс» не найдена»). Это незавершённый `course-dmg` в этом worktree (spec трека: `course` меняет другой трек). К чистке `wish` отношения не имеет; на оценку тестов бота влияет так: эти тесты **поймали реальную регрессию связки стори ↔ модуль курса**, то есть работают. Базовая линия числа тестов `wish` снимается по домену и модулю (348), тесты бота — отдельной строкой с пометкой «красные по чужой причине».

---

## Сводка

### Домен — `domain/src/wish/` — 151 объявление / 213 кейсов / 77 кандидатов

| Файл | Объявлений | Выполнено | Полезен | Сомнителен / пуст |
|---|---|---|---|---|
| `wish/wish.ar.test.ts` | 50 | 98 | 34 | 16 |
| `wish/wish.rules.test.ts` | 18 | 24 | 14 | 4 |
| `wish/wish.state.test.ts` | 12 | 17 | 4 | 8 |
| `wish/wish.invited.test.ts` | 10 | 10 | 4 | 6 |
| `wish/wish.events.test.ts` | 6 | 6 | 0 | 6 |
| `wish/wish.errors.test.ts` | 5 | 5 | 0 | 5 |
| `wish/wish.module.test.ts` | 2 | 2 | 0 | 2 |
| `wish/wish.policy.test.ts` | 3 | 3 | 3 | 0 |
| `wish/pools/course-pool.test.ts` | 2 | 2 | 2 | 0 |
| `wish/wish-fulfillment.dcs.test.ts` | 8 | 8 | 7 | 1 |
| `wish/wish-invitation.dcs.test.ts` | 9 | 9 | 7 | 2 |
| `wish/er/abandon-wish.er.test.ts` | 3 | 5 | 0 | 3 |
| `wish/er/confirm-wish.er.test.ts` | 2 | 2 | 0 | 2 |
| `wish/er/fulfill-wish.er.test.ts` | 1 | 1 | 0 | 1 |
| `wish/er/invite-wishers.er.test.ts` | 1 | 1 | 0 | 1 |
| `wish/uc/create-course-wish.uc.test.ts` | 6 | 7 | 0 | 6 |
| `wish/uc/create-module-wish.uc.test.ts` | 5 | 5 | 0 | 5 |
| `wish/uc/cancel-wish.uc.test.ts` | 6 | 6 | 0 | 6 |
| `wish/uc/list-user-wishes.uc.test.ts` | 2 | 2 | 0 | 2 |

### Модуль — `modules/wish/src/` — 121 объявление / 135 кейсов / 25 кандидатов

| Файл | Объявлений | Выполнено | Полезен | Сомнителен / пуст |
|---|---|---|---|---|
| `infra/wish.json-repo.test.ts` | 25 | 25 | 23 | 2 |
| `wish/er/invite-wishers.er.test.ts` | 19 | 19 | 15 | 4 |
| `wish/er/abandon-wish.er.test.ts` | 13 | 15 | 7 | 6 |
| `wish/er/confirm-wish.er.test.ts` | 11 | 11 | 8 | 3 |
| `wish/er/fulfill-wish.er.test.ts` | 14 | 14 | 11 | 3 |
| `wish/uc/create-course-wish.uc.test.ts` | 13 | 17 | 11 | 2 |
| `wish/uc/create-module-wish.uc.test.ts` | 9 | 13 | 7 | 2 |
| `wish/uc/cancel-wish.uc.test.ts` | 10 | 14 | 8 | 2 |
| `wish/uc/list-user-wishes.uc.test.ts` | 5 | 5 | 5 | 0 |
| `wish.module.test.ts` | 2 | 2 | 1 | 1 |

### Бот — `runners/u7-bot/` — 28 объявление / 28 кейсов / 2 кандидата

| Файл | Объявлений | Выполнено | Полезен | Сомнителен / пуст |
|---|---|---|---|---|
| `src/controllers/courses/stories/wish-confirmed.story.test.ts` | 4 | 4 | 4 | 0 |
| `src/controllers/courses/stories/wish-invite.story.test.ts` | 8 | 8 | 8 | 0 |
| `tests/courses/wish-flow.integration.test.ts` | 7 | 7 | 7 | 0 |
| `tests/courses/wish-legacy-records.integration.test.ts` | 2 | 2 | 2 | 0 |
| `tests/e2e/wish-questionnaire.e2e.test.ts` | 7 | 7 | 5 | 2 |

**Итого: 300 объявлений / 376 кейсов / 104 кандидата (35 % объявлений).**

Для сравнения — образец пакета (`node_modules/dmg-core/src/testing/example`): в `app/todo/task/uc/*.test.ts` и `todo/todo.module.test.ts` **нет ни одного** паспортного теста (`normalize`) и ни одного `ArchChecker` — только поведение и smoke. Это главный ориентир при чтении таблиц ниже.

---

## Закономерности

### З1. Ручной паспорт Def вместо автопроверки ArchChecker — 17 случаев `[П]`

**Что это.** Тест берёт `normalize(CreateCourseWishUcDef)` (или `WishModuleDef`, `ErDef`) и сравнивает с руками собранным `{ kind, errors, emits, calls, touches, aggregate, useCases, dependsOn }`, либо гоняет `ArchChecker` по Def.

**Признак поиска.**
```bash
grep -rn "нормализуется\|по карте Def\|ArchChecker" --include=*.test.ts domain/src modules
```
`нормализуется` встречается **только в `wish`** (4 файла) — то есть эталон проекта задал образец, остальные модули его частично скопировали (`ArchChecker` есть во всех 7 доменных модулях: 10 файлов).

**Почему бесполезен.** Состав Def — это ровно то, что проверяет `arch:check`, а он входит в `bun run check` (`package.json:45`): MAN-05 (`calls`/`touches`), MAN-06 (связность событий, «ошибка не входит ни в один модуль»), ERR-02 (ошибка правила объявлена в `errors` UC), ARC-04/05 (`dependsOn`, DAG), MAN-01/02/03 (описания, JSON Schema). Пиармида `node_modules/dmg-core/docs/reference/testing.md` §3 прямо относит это к уровню «Контрактные — **автоматически**». Тест дублирует проверку вручную: при добавлении ошибки/события он падает и требует правки теста, ничего не защищая (сравнение с самим объявлением).

**Примеры.** `domain/src/wish/wish/uc/create-course-wish.uc.test.ts:12`, `domain/src/wish/wish.module.test.ts:7`, `domain/src/wish/wish/wish.ar.test.ts:55`, `modules/wish/src/wish/er/abandon-wish.er.test.ts:117`.

**Как появляется.** При разборе legacy на Def и при написании нового UC/ER: «зафиксирую, что UC объявляет ошибки/вызовы» — руками, потому что `arch:check` не подсказывает, что именно ты забыл. Скопировано из `wish` (эталон) в остальные модули.

**Что делать.** Удалить. Оставить **один** тест состава на модуль (список UC + `dependsOn`) — и только если нужен явный маркер при добавлении UC; `ArchChecker`-тест удалить везде (`arch:check` уже в `check`).

### З2. Проверка схемы платформы, а не модуля — 24 случая `[П]`

**Что это.** `v.safeParse`/`v.parse` на `F.uuid`, `F.picklist`, `F.expectedVersion`, `F.variant`: «принимает валидное», «отклоняет не-uuid / неизвестный kind / пустой объект», «даты-строки → числа».

**Признак поиска.**
```bash
grep -rn "safeParse\|F.uuid\|v.object({})\|expect(valid(" --include=*.test.ts domain/src/wish
```

**Почему бесполезен.** Реальная ошибка здесь — «поле схемы объявлено не так». Она либо (а) ломает настоящий вызов и ловится вызывающим уровнем (бот-стори шлёт `{ kind: 'course', courseId, expectedVersion }` через реальный UC — `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:1050`), либо (б) ломает чтение файла и ловится контрактом репозитория (`modules/wish/src/infra/wish.json-repo.test.ts:165,233`). Сами по себе приём/отказ `F.uuid` — поведение `dmg-core` (валибот), оно покрыто в пакете. Отдельно стоит «выход — пустой объект» (`v.object({})`) и «`expectedVersion` сохраняется в разобранном входе» — это тавтология парсера.

**Примеры.** `domain/src/wish/wish/uc/cancel-wish.uc.test.ts:42` (`expectedVersion: необязателен…`), `:63` (сохраняется в разобранном входе), `wish.state.test.ts:76` (`WishStatus` принимает все 6 значений), `wish.events.test.ts:60` (`courseId: 'x'` → отказ).

**Как появляется.** Первый шаг TDD на Def: схема пишется вместе с тестом на неё; потом тест остаётся как «контракт», хотя контракт проверяют потребители.

**Что делать.** `wish.state.test.ts` — переписать: одна таблица «валидное/невалидное» на схему состояния (это единственная схема, которая парсит файл на каждом чтении, D-36) и одна на `WishTargetVo`; остальное — удалить. Исключение: `wish.state.test.ts:116` (legacy `courseId` вместо `target` отклоняется) — оставить, это защита от «расширили схему и тихо приняли старую запись».

### З3. Тест константы и состава контракта — 5 случаев `[П]`

**Что это.** `expect(WishEvents.invited.name).toBe('wish.wish.invited')`, список кодов ошибок, список статусов и переходов, `picklist` статусов.

**Признак поиска.** `grep -rn "FQN\|\.name).toBe(\|шесть статусов" --include=*.test.ts domain/src/wish`

**Почему бесполезен.** FQN читают через тот же `Def.name` и подписчик (`wish-invite.story.ts` → проверено `wish-invite.story.test.ts:158`), и публикатор (`WishEvents.invited.of`): опечатка поедет в обе стороны согласованно, упасть нечему. Список статусов/переходов защищают поведенческие тесты каждой ветки (`wish.ar.test.ts:236–308`) и платформенный `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:179` («Def несёт статусы, переходы»), `:215` («переход объявляет отказ для каждого статуса вне `from`»).

**Примеры.** `domain/src/wish/wish/wish.events.test.ts:30`, `:51`, `domain/src/wish/wish/wish.ar.test.ts:38`, `domain/src/wish/wish/wish.errors.test.ts:13`, `domain/src/wish/wish/wish.state.test.ts:76`.

**Как появляется.** «Зафиксирую контракт текстом» при объявлении события/ошибки; при копировании блока событий из соседнего модуля.

**Что делать.** FQN — удалить (согласованность обеспечена константой), **кроме** случая, когда FQN читает внешняя сторона литералом: проверить `grep -rn "wish.wish" --include=*.ts runners platform modules` — если литералов нет, удалять безопасно. Состав ошибок — один тест на модуль (`errors` с `code/kind/label`), а не по одной ошибке на `it`.

### З4. Проверка того, что уже проверено ArchChecker или владельцем контракта — 10 случаев `[П]`

**Что это.** Три вида:
1. **Чужой контракт.** ER `wish` разбирает payload событий `questionnaire` (`ownerInfo`, `kind`, `reason`) — и тестирует его валидацию у себя.
2. **Описания полей.** `expect(v.description)` на полях состояния/события (MAN-02).
3. **Ссылка правило → ошибка.** `expect(unique.error.code).toBe('WISH_ALREADY_EXISTS')` и `dmg === 'domainRule'` (ERR-02/DOM-16).

**Признак поиска.** `grep -rn "ownerInfo\|description').toBe\|error.code).toBe('WISH" --include=*.test.ts domain/src/wish`

**Почему бесполезен.** (1) Контракт события — собственность `questionnaire`: его схема покрыта `domain/src/questionnaire/questionnaire/questionnaire.events.test.ts:74,88,129,135`. (2) MAN-02 («поле без description») — `node_modules/dmg-core/src/arch/def-checker.test.ts:192`, входит в `arch:check`. (3) ERR-02 (ошибка правила не объявлена в `errors` UC) — `def-checker.test.ts:654`: если правило переключить на другую ошибку, `arch:check` упадёт без ручного теста.

**Примеры.** `domain/src/wish/wish/er/abandon-wish.er.test.ts:28`, `:35`, `domain/src/wish/wish/wish.rules.test.ts:33`, `domain/src/wish/wish/wish.state.test.ts:122`, `domain/src/wish/wish/wish.invited.test.ts:46`.

**Как появляется.** При переносе случаев legacy на ER по Def (комментарий в шапке `modules/wish/src/wish/er/*.test.ts`: «Перенос случаев legacy … на ER по Def») сценарий переносится целиком, вместе с проверками чужого контракта.

**Что делать.** Удалить. Если нужен сторож «ER читает только `{ respondentId, ownerInfo }`» — он уже есть и работает по делу (`modules/wish/src/wish/er/abandon-wish.er.test.ts:189`: чужой `ownerInfo` → ничего не загружено).

### З5. Правило проверено уровнем ниже, на верхнем — копия — 21 случай `[П]`

**Что это.** Известный случай TST-08, но в `wish` он маскируется: `UC`/`ER` проверяет ошибку правила/предиката Ar (`WISH_ALREADY_EXISTS`, `WISH_NOT_FOUND`, `canCancel`, `isActive`, `current()`), хотя само правило и его payload покрыты тестом правила/Ar, а подключение — паспортом (З1) и поведением соседнего теста.

**Признак поиска.**
```bash
grep -rn "WISH_ALREADY_EXISTS\|WISH_NOT_FOUND\|неактивное\|не pending\|неактивн" --include=*.test.ts modules/wish
```
Плюс обратный признак: в тесте правила тот же payload (`domain/src/wish/wish/wish.rules.test.ts:47,63,193,205` через `active.alreadyExists()` / `wish.notFound()`).

**Почему бесполезен.** У `WishAr.cancel`/`confirm` свой отказ для статуса вне `from` (`wish.ar.test.ts:275–308`), поэтому «UC вернул NOT_FOUND на неактивное желание» одинаково верно и с правилом, и без него — тест не различает наличие правила. Payload собирает Ar (`wish.ar.test.ts:455–501`, `wish.rules.test.ts:47–63`). Остаётся один сценарий у вызывающего — «вызов дошёл до нижнего уровня», он в файле уже есть.

**Примеры.** `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:98`, `modules/wish/src/wish/uc/create-module-wish.uc.test.ts:150`, `domain/src/wish/wish/wish.ar.test.ts:438`, `:631`, `modules/wish/src/wish/er/fulfill-wish.er.test.ts:234`.

**Как появляется.** Логика уезжает вниз (Ar/правило/репозиторий), сценарий **копируется** на верхний уровень вместо переноса, чтобы «не упало покрытие».

**Что делать.** Удалить; в отчёте о чистке — строка «удалён → где покрыт» (TST-08). Для каждой пары оставить один тест: у правила — саммари правила, у UC — успех + одна собственная ошибка (нет сущности, нет прав).

### З6. Копия соседнего теста без нового класса входа — 18 случаев `[П]`

**Что это.** Тот же сценарий с другим статусом/видом цели/событием, либо повтор уже покрытого «повторное событие/ничего не меняет», либо один и тот же текст ошибки в двух модулях. Часто — `it.each`, навешенный на параметр, который код **не читает**.

**Признак поиска.**
```bash
grep -rn "повторное событие\|ничего не меняет\|игнор\|текст прежний\|тоже приглашается" --include=*.test.ts modules/wish domain/src/wish
```
```bash
grep -rn "it.each(\['timeout', 'by_user', 'declined'\]" --include=*.test.ts modules/wish
```

**Почему бесполезен.** Входные данные различаются, ветка кода — нет. Сильнее всего видно на разборе `reason`: `modules/wish/src/wish/er/abandon-wish.er.test.ts:213` перебирает три причины, но ER читает из payload только `respondentId` и `ownerInfo` (`const { respondentId: userId, ownerInfo } = event.payload`) — параметр ни на что не влияет, три кейса идентичны. Там же `:227` («declined для выданной анкеты») — тот же сценарий третьим файлом.

**Примеры.** `modules/wish/src/wish/er/abandon-wish.er.test.ts:213`, `:243`, `modules/wish/src/wish/er/invite-wishers.er.test.ts:216`, `domain/src/wish/wish/wish-invitation.dcs.test.ts:173`, `modules/wish/src/wish/uc/create-module-wish.uc.test.ts:140` (`label` совпадает с `create-course-wish.uc.test.ts:201` и `wish.errors.test.ts:13`).

**Как появляется.** Копипаст соседнего `it` с заменой статуса; либо `it.each` «на всякий случай» по всем значениям пейлоада, включая неиспользуемые. Плюс обязательный по конвенции копи-тест «повторное событие» в каждом ER (D-47) — но там уже есть хелпер `expectIdempotentReaction`.

**Что делать.** Удалить `it.each` по нечитаемым параметрам (оставить один кейс), слить пары «не совпало / другой вид цели» в одну таблицу, константный текст — один тест на ошибку.

### З7. Тавтология, однострочный геттер, недостижимое состояние — 6 случаев `[П]`

**Что это.** Тест проверяет значение, которое сам вложил (`questionnaireTarget({ courseId })` → тот же `courseId`; «согласован с `questionnaire()`» — обе функции написаны одним автором в одном файле); либо геттер без ветки (`addresseeId()`, `isOwnedBy()`); либо `ErrorDef.make` — платформа + те же константы.

**Признак поиска.**
```bash
grep -rn "round trip\|согласован\|разбирается в\|— только пользователь-желающий\|make — код" --include=*.test.ts domain/src/wish
```

**Почему бесполезен.** Нет входного класса, на котором код может ошибиться: значение прошло through-and-through без преобразования. Ошибку в `addresseeId` поймает DCS, которая им пользуется (`domain/src/wish/wish-invitation.dcs.test.ts:81` — адреса без повторов).

**Примеры.** `domain/src/wish/wish/wish.ar.test.ts:372`, `:570`, `:578`, `domain/src/wish/wish/uc/cancel-wish.uc.test.ts:63`, `domain/src/wish/wish/wish.errors.test.ts:106`, `domain/src/wish/wish/wish.invited.test.ts:74`.

**Как появляется.** Гонка за покрытием строк (TDD «на 100 %») и перенос round-trip-привычки из тестов схем.

**Что делать.** Удалить. Оставить только «злые» входы, где код реально может ошибиться (`wish.ar.test.ts:590` — `questionnaireTarget` на мусоре от чужого модуля).

### З8. Поведение платформы — 3 случая `[П]`

**Что это.** `restore(snapshot())` round trip; `VersionedRepository` (после перехода версия 1); `ModuleFromDef.define` (`def.name`).

**Признак поиска.** `grep -rn "round trip\|по карте Def\|version 1" --include=*.test.ts domain/src/wish modules/wish`

**Почему бесполезен.** Покрыто пакетом: `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:251` («восстанавливает без событий»), `:264` («snapshot() — копия»); сборка модуля — `node_modules/dmg-core/src/domain/contracts/module-def.test.ts` + сборка приложения `platform/app/tests/u7-app.test.ts:145` (в приложении есть `WishModuleDef`). Свой слой (`WishJsonRepo`) при этом покрыт отдельно и по делу.

**Примеры.** `domain/src/wish/wish/wish.ar.test.ts:212`, `modules/wish/src/infra/wish.json-repo.test.ts:209`, `modules/wish/src/wish.module.test.ts:53`.

**Что делать.** Удалить.

---

## Кандидаты

Только «сомнителен» и «пуст». Пути — от корня репозитория. Оценка «полезен» — в разделе «Полезные тесты».

Легенда: **[П]** — объявление `it.each`, кейсов больше, чем строк в таблице.

### Домен: паспорта Def (З1)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `domain/src/wish/wish/er/abandon-wish.er.test.ts:17` | на прерывание анкеты меняет желания, событий не публикует, чужих модулей не вызывает | З1 | `node_modules/dmg-core/src/arch/def-checker.test.ts:229` (MAN-06), `:379` (MAN-05) | удалить |
| `domain/src/wish/wish/er/confirm-wish.er.test.ts:15` | на завершение анкеты меняет желания, публикует confirmed… | З1 | `node_modules/dmg-core/src/arch/def-checker.test.ts:229` | удалить |
| `domain/src/wish/wish/er/fulfill-wish.er.test.ts:6` | на зачисление студента меняет желания и спрашивает курс… | З1 | `node_modules/dmg-core/src/arch/def-checker.test.ts:229` | удалить |
| `domain/src/wish/wish/er/invite-wishers.er.test.ts:6` | на создание потока: касается желаний, зовёт курсы, потоки… | З1 | `node_modules/dmg-core/src/arch/def-checker.test.ts:229` | удалить |
| `domain/src/wish/wish/uc/create-course-wish.uc.test.ts:12` | нормализуется: command пользователя, без событий, ошибки курса и дубля | З1 | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` (ERR-02), `:379` | удалить |
| `domain/src/wish/wish/uc/create-course-wish.uc.test.ts:23` | правила: сначала курс открыт для записи, затем уникальность | З1 | `modules/wish/src/wish/uc/create-course-wish.uc.test.ts:262` (порядок поведения) | удалить |
| `domain/src/wish/wish/uc/create-course-wish.uc.test.ts:30` | calls — запись на курс и запуск анкеты (D-42) | З1 | `modules/wish/src/wish/uc/create-course-wish.uc.test.ts:316` (тот же массив) | удалить (оставить модульный) |
| `domain/src/wish/wish/uc/create-module-wish.uc.test.ts:11` | нормализуется: command пользователя, без событий, ошибки модуля и дубля | З1 | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` | удалить |
| `domain/src/wish/wish/uc/create-module-wish.uc.test.ts:23` | правила: сначала модуль доступен, затем уникальность | З1 | `modules/wish/src/wish/uc/create-module-wish.uc.test.ts:161` | удалить |
| `domain/src/wish/wish/uc/create-module-wish.uc.test.ts:30` | calls — запись на модуль | З1 | `node_modules/dmg-core/src/arch/def-checker.test.ts:379` (MAN-05) | удалить |
| `domain/src/wish/wish/uc/cancel-wish.uc.test.ts:12` | нормализуется: command пользователя, без событий, ошибка NOT_FOUND | З1 | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` | удалить |
| `domain/src/wish/wish/uc/cancel-wish.uc.test.ts:23` | Policy — только автор (canCancel), правило — cancellable | З1 | поведение: `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:143` | удалить |
| `domain/src/wish/wish/uc/list-user-wishes.uc.test.ts:8` | нормализуется как query без событий и ошибок | З1 | `node_modules/dmg-core/src/arch/def-checker.test.ts:379` | удалить |
| `domain/src/wish/wish.module.test.ts:7` | паспорт: зависимости, агрегат, UC | З1 | `platform/app/tests/u7-app.test.ts:145` (модуль в сборке) + `arch:check` | удалить |
| `domain/src/wish/wish.module.test.ts:23` | ArchChecker — без нарушений | З1 | `arch:check` — проверка покрыта `node_modules/dmg-core/src/arch/def-checker.test.ts:229` | удалить |
| `domain/src/wish/wish/wish.ar.test.ts:55` | ArchChecker с зависимостями — без нарушений | З1 | `arch:check` + `domain/src/wish/wish.module.test.ts:23` (тот же объект) | удалить |
| `modules/wish/src/wish.module.test.ts:53` | собирает модуль по карте Def | З8 | `node_modules/dmg-core/src/domain/contracts/module-def.test.ts` + `platform/app/tests/u7-app.test.ts:145` | удалить |

### Домен: схемы платформы (З2)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `domain/src/wish/wish/uc/create-course-wish.uc.test.ts:37` | вход — { courseId } uuid | З2 | `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:887` (реальный вызов) | удалить |
| `domain/src/wish/wish/uc/create-course-wish.uc.test.ts:46` `[П]` | outcome instant / questionnaire разбирается | З2 | `modules/wish/src/wish/uc/create-course-wish.uc.test.ts:119,139` | удалить |
| `domain/src/wish/wish/uc/create-course-wish.uc.test.ts:55` | выход — иной outcome отклоняется | З2 | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` (OUTPUT_VALIDATION) | объединить с `:46` → одна таблица |
| `domain/src/wish/wish/uc/create-module-wish.uc.test.ts:34` | вход — { moduleId } uuid | З2 | `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:1148` | удалить |
| `domain/src/wish/wish/uc/create-module-wish.uc.test.ts:40` | выход — пустой объект | З2 | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` | удалить |
| `domain/src/wish/wish/uc/cancel-wish.uc.test.ts:28` | вход — цель желания: курс или модуль по kind | З2 | `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:90` (module-вариант) | удалить |
| `domain/src/wish/wish/uc/cancel-wish.uc.test.ts:42` | expectedVersion: необязателен, неотрицательное целое | З2 | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:302` (версии) | удалить |
| `domain/src/wish/wish/uc/cancel-wish.uc.test.ts:72` | выход — пустой объект | З2 | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` | удалить |
| `domain/src/wish/wish/uc/list-user-wishes.uc.test.ts:16` | вход — пустой объект, выход — массив state желания | З2 | `modules/wish/src/wish/uc/list-user-wishes.uc.test.ts:51` | удалить |
| `domain/src/wish/wish/wish.errors.test.ts:59` | ALREADY_EXISTS: цель и статус существующего желания | З2 | `domain/src/wish/wish/wish.rules.test.ts:47` (payload из кода) | объединить 59/82/93 → одна таблица payload |
| `domain/src/wish/wish/wish.errors.test.ts:82` | NOT_FOUND: пользователь и цель | З2 | `domain/src/wish/wish/wish.rules.test.ts:193` | туда же |
| `domain/src/wish/wish/wish.errors.test.ts:93` | COURSE_NOT_FOUND / MODULE_NOT_FOUND: идентификатор цели | З2 | `domain/src/wish/wish/wish.rules.test.ts:138,168` | туда же |
| `domain/src/wish/wish/wish.events.test.ts:34` | payload курса и модуля — допустим | З2 | `runners/u7-bot/src/controllers/courses/stories/wish-invite.story.test.ts:252` (реальное чтение payload) | объединить с `:39` |
| `domain/src/wish/wish/wish.events.test.ts:39` | payload без адресата или с целью не своей ветки — недопустим | З2 | `runners/u7-bot/src/controllers/courses/stories/wish-invite.story.test.ts:271` | объединить с `:34` |
| `domain/src/wish/wish/wish.events.test.ts:55` | payload { userId, courseId } — допустим | З2 | `modules/wish/src/wish/er/confirm-wish.er.test.ts:125` | объединить с `:60` |
| `domain/src/wish/wish/wish.events.test.ts:60` | payload без курса или с невалидным uuid — недопустим | З2 | `node_modules/dmg-core/src/domain/events/event-def.test.ts` (схема события) | объединить с `:55` |
| `domain/src/wish/wish/wish.invited.test.ts:33` | необязательное поле: старая запись без него валидна | З2 | `modules/wish/src/infra/wish.json-repo.test.ts:165` (старая строка без поля) | удалить |
| `domain/src/wish/wish/wish.invited.test.ts:37` | список uuid потоков валиден, не-uuid отклоняется | З2 | `modules/wish/src/infra/wish.json-repo.test.ts:233` (невалидная строка → ValiError) | удалить |
| `domain/src/wish/wish/wish.state.test.ts:24` | отклоняет module-цель с некорректным moduleId | З2 | `modules/wish/src/infra/wish.json-repo.test.ts:233` | удалить |
| `domain/src/wish/wish/wish.state.test.ts:42` | отклоняет неизвестный kind цели | З2 | `modules/wish/src/infra/wish.json-repo.test.ts:233` | переписать → одна таблица `WishTargetVo` |
| `domain/src/wish/wish/wish.state.test.ts:51` | отклоняет цель course без courseId | З2 | `modules/wish/src/infra/wish.json-repo.test.ts:233` | туда же |
| `domain/src/wish/wish/wish.state.test.ts:57` | отклоняет цель с невалидным форматом courseId | З2 | `modules/wish/src/infra/wish.json-repo.test.ts:233` | туда же |
| `domain/src/wish/wish/wish.state.test.ts:87` | отклоняет неизвестный статус | З2 | `domain/src/wish/wish/wish.ar.test.ts:254` (статус вне `from` → отказ) | удалить |
| `modules/wish/src/infra/wish.json-repo.test.ts:262` | корень файла не массив — ValiError, файл не изменён | З2 | `modules/wish/src/infra/wish.json-repo.test.ts:233` (та же проверка схемы) | удалить |

### Домен: константы и состав (З3)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `domain/src/wish/wish/wish.ar.test.ts:38` | шесть статусов и четыре перехода | З3 | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:179,215` + поведение `wish.ar.test.ts:236–308` | удалить |
| `domain/src/wish/wish/wish.errors.test.ts:13` | отказы переходов и ошибки UC | З3 | `domain/src/wish/wish/wish.rules.test.ts:33,124,154,184` (по ошибке) | переписать → один тест состава на модуль |
| `domain/src/wish/wish/wish.events.test.ts:30` | FQN — wish.wish.invited | З3 | `runners/u7-bot/src/controllers/courses/stories/wish-invite.story.test.ts:158` (та же константа) | удалить (проверив, что FQN нигде не литерал) |
| `domain/src/wish/wish/wish.events.test.ts:51` | FQN — wish.wish.confirmed | З3 | `runners/u7-bot/src/controllers/courses/stories/wish-confirmed.story.test.ts:128` | удалить |
| `domain/src/wish/wish/wish.state.test.ts:76` `[П]` | WishStatus принимает все 6 значений | З3 | `domain/src/wish/wish/wish.ar.test.ts:254` | удалить |

### Домен: чужой контракт и автопроверки (З4)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `domain/src/wish/wish/er/abandon-wish.er.test.ts:28` `[П]` | reason timeout/by_user/declined разбирается | З4 | `domain/src/questionnaire/questionnaire/questionnaire.events.test.ts:129` + `modules/wish/src/wish/er/abandon-wish.er.test.ts:213` | удалить |
| `domain/src/wish/wish/er/abandon-wish.er.test.ts:35` | прежнее поле owner и событие без reason не принимаются | З4 | `domain/src/questionnaire/questionnaire/questionnaire.events.test.ts:88,135` | удалить |
| `domain/src/wish/wish/er/confirm-wish.er.test.ts:26` | слушает событие с payload { ownerInfo, kind }: прежнее поле owner не принимается | З4 | `domain/src/questionnaire/questionnaire/questionnaire.events.test.ts:74,88` | удалить |
| `domain/src/wish/wish/wish.invited.test.ts:46` | у поля есть описание | З4 | `node_modules/dmg-core/src/arch/def-checker.test.ts:192` (MAN-02) | удалить |
| `domain/src/wish/wish/wish.state.test.ts:66` | у полей обеих веток есть описание | З4 | `node_modules/dmg-core/src/arch/def-checker.test.ts:192` | удалить |
| `domain/src/wish/wish/wish.state.test.ts:122` | у каждого поля есть описание | З4 | `node_modules/dmg-core/src/arch/def-checker.test.ts:192` | удалить |
| `domain/src/wish/wish/wish.rules.test.ts:33` | описание правила ссылается на WISH_ALREADY_EXISTS | З4 | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` (ERR-02) | удалить |
| `domain/src/wish/wish/wish.rules.test.ts:124` | описание правила ссылается на WISH_COURSE_NOT_FOUND | З4 | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` | удалить |
| `domain/src/wish/wish/wish.rules.test.ts:154` | описание правила ссылается на WISH_MODULE_NOT_FOUND | З4 | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` | удалить |
| `domain/src/wish/wish/wish.rules.test.ts:184` | описание правила ссылается на WISH_NOT_FOUND | З4 | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` | удалить |

### Домен: правило проверено уровнем ниже (З5)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `domain/src/wish/wish/wish.ar.test.ts:200` | legacy-запись: ISO без зоны, без updatedAt и version | З5 | `modules/wish/src/infra/wish.json-repo.test.ts:165` | удалить |
| `domain/src/wish/wish/wish.ar.test.ts:438` | isActive (таблица статусов) | З5 | `domain/src/wish/wish/wish.rules.test.ts:42,47` + `modules/wish/src/infra/wish.json-repo.test.ts:299` | удалить |
| `domain/src/wish/wish/wish.ar.test.ts:449` | isOwnedBy — только пользователь-желающий | З5 | `domain/src/wish/wish/wish.rules.test.ts:79` | удалить |
| `domain/src/wish/wish/wish.ar.test.ts:455` | alreadyExists — WISH_ALREADY_EXISTS с courseId и статусом | З5 | `domain/src/wish/wish/wish.rules.test.ts:47` | удалить |
| `domain/src/wish/wish/wish.ar.test.ts:466` | alreadyExists — цель-модуль даёт moduleId | З5 | `domain/src/wish/wish/wish.rules.test.ts:63` | удалить |
| `domain/src/wish/wish/wish.ar.test.ts:479` | notFound — WISH_NOT_FOUND с userId и courseId цели | З5 | `domain/src/wish/wish/wish.rules.test.ts:193` | удалить |
| `domain/src/wish/wish/wish.ar.test.ts:486` | notFound — цель-модуль даёт moduleId | З5 | `domain/src/wish/wish/wish.rules.test.ts:205` | удалить |
| `domain/src/wish/wish/wish.ar.test.ts:495` | notFoundFor — ошибка от цели-курса без экземпляра | З5 | `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:125` | удалить |
| `domain/src/wish/wish/wish.ar.test.ts:626` | только завершённые — нет текущего | З5 | `domain/src/wish/wish/wish.rules.test.ts:42` + `modules/wish/src/wish/er/confirm-wish.er.test.ts:139` | удалить |
| `domain/src/wish/wish/wish.ar.test.ts:631` | не доверяет фильтру вызывающего: чужой пользователь и чужая цель игнорируются | З5 | `domain/src/wish/wish/wish.rules.test.ts:79,89` + `modules/wish/src/infra/wish.json-repo.test.ts:403,418` | удалить |
| `domain/src/wish/wish/wish.invited.test.ts:54` | приглашение дописывает streamId в state | З5 | `domain/src/wish/wish/wish.ar.test.ts:323` (snapshot после invite) | удалить |
| `domain/src/wish/wish/wish.state.test.ts:101` | принимает желание с target; ISO-даты (в т. ч. без зоны) — числа | З5 | `modules/wish/src/infra/wish.json-repo.test.ts:165` | удалить |
| `domain/src/wish/wish/wish-invitation.dcs.test.ts:185` | неприглашаемые желания не трогает даже при совпадении цели | З5 | `domain/src/wish/wish/wish.ar.test.ts:398` (неприглашаемое → нет целей) + `wish-invitation.dcs.test.ts:34` | удалить |
| `modules/wish/src/wish/er/abandon-wish.er.test.ts:157` | желания другого курса и другого пользователя не затрагиваются | З5 | `modules/wish/src/infra/wish.json-repo.test.ts:403,418` + `domain/src/wish/wish/wish.ar.test.ts:631` | удалить |
| `modules/wish/src/wish/er/confirm-wish.er.test.ts:171` | желания другого курса и другого пользователя не затрагиваются | З5 | `modules/wish/src/infra/wish.json-repo.test.ts:403,418` | удалить |
| `modules/wish/src/wish/er/fulfill-wish.er.test.ts:234` | fulfilled/cancelled/pending/abandoned — курс не спрашивается | З5 | `domain/src/wish/wish-fulfillment.dcs.test.ts:31` + `domain/src/wish/wish/wish.ar.test.ts:302,308` | удалить |
| `modules/wish/src/wish/er/invite-wishers.er.test.ts:286` | pending/cancelled/fulfilled/abandoned не приглашаются и не записываются | З5 | `domain/src/wish/wish/wish.ar.test.ts:360` + `wish-invitation.dcs.test.ts:34` | удалить |
| `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:98` `[П]` | pending/cancelled/abandoned/fulfilled → WISH_NOT_FOUND | З5 | `domain/src/wish/wish/wish.rules.test.ts:193` + `wish.ar.test.ts:293` | удалить |
| `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:113` | module-вариант: неактивное желание — WISH_NOT_FOUND | З5 | `domain/src/wish/wish/wish.rules.test.ts:205` + `wish.ar.test.ts:308` | удалить |
| `modules/wish/src/wish/uc/create-course-wish.uc.test.ts:215` `[П]` | cancelled/fulfilled/abandoned — желание создаётся | З5 | `domain/src/wish/wish/wish.rules.test.ts:42` | удалить |
| `modules/wish/src/wish/uc/create-module-wish.uc.test.ts:150` `[П]` | cancelled/fulfilled/abandoned — желание создаётся | З5 | `domain/src/wish/wish/wish.rules.test.ts:42` | удалить |

### Домен: копии и тавтологии (З6, З7)

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `domain/src/wish/wish/wish.invited.test.ts:98` | уже приглашённое — invite без приглашённых, без событий | З6 | `domain/src/wish/wish/wish.invited.test.ts:93` (та же причина) | объединить с `:93` |
| `domain/src/wish/wish/wish-fulfillment.dcs.test.ts:126` | повторное событие — ничего не меняет | З6 | `wish-fulfillment.dcs.test.ts:112` (нереализуемые не меняются) + `:31` | удалить |
| `domain/src/wish/wish/wish-invitation.dcs.test.ts:173` | нет совпавших или ответов раунда 2 — пустой итог | З6 | `wish-invitation.dcs.test.ts:70` + `:164` | удалить |
| `domain/src/wish/wish/wish.ar.test.ts:212` | snapshot — round trip | З8 | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:251,264` | удалить |
| `domain/src/wish/wish/wish.ar.test.ts:372` | пользователь-желающий (addresseeId) | З7 | `domain/src/wish/wish-invitation.dcs.test.ts:81` | удалить |
| `domain/src/wish/wish/wish.ar.test.ts:570` | owner из questionnaire() разбирается в цель-курс | З7 | `domain/src/wish/wish/wish.ar.test.ts:590` (злые входы) | удалить |
| `domain/src/wish/wish/wish.ar.test.ts:578` | согласован с questionnaire(): owner желания разбирается в его цель | З7 | `domain/src/wish/wish/wish.ar.test.ts:590` | удалить |
| `domain/src/wish/wish/uc/cancel-wish.uc.test.ts:63` | expectedVersion сохраняется в разобранном входе | З7 | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:302` | удалить |
| `domain/src/wish/wish/wish.errors.test.ts:106` | make — код, kind, label и payload в значении ошибки | З7 | `node_modules/dmg-core/src/domain/…/error-def` (свой тест пакета) + `wish.errors.test.ts:13` | удалить |
| `domain/src/wish/wish/wish.invited.test.ts:74` | wasInvitedTo: да/нет/без списка | З7 | `domain/src/wish/wish/wish.invited.test.ts:66,93` (им пользуются) | удалить |

### Модуль

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `modules/wish/src/infra/wish.json-repo.test.ts:209` | legacy-запись после перехода сохраняется с version 1 | З8 | `modules/wish/src/infra/wish.json-repo.test.ts:184` + `:112` | удалить |
| `modules/wish/src/wish/er/abandon-wish.er.test.ts:117` | ничего не публикует (emits: []) | З1 | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:231` (незаявленное событие → SERVER_INTERNAL) | удалить |
| `modules/wish/src/wish/er/abandon-wish.er.test.ts:176` | повторное событие ничего не меняет | З6 | `modules/wish/src/wish/er/abandon-wish.er.test.ts:275` (D-47-хелпер) | удалить |
| `modules/wish/src/wish/er/abandon-wish.er.test.ts:213` `[П]` | reason timeout/by_user/declined | З6 | `modules/wish/src/wish/er/abandon-wish.er.test.ts:103` (единственная ветка) | переписать → один кейс или удалить (ER `reason` не читает) |
| `modules/wish/src/wish/er/abandon-wish.er.test.ts:227` | declined для выданной, но не начатой анкеты | З6 | `modules/wish/src/wish/er/abandon-wish.er.test.ts:103` | удалить |
| `modules/wish/src/wish/er/abandon-wish.er.test.ts:243` | abandoned с kind: likert и чужим ownerInfo не трогает желания | З6 | `modules/wish/src/wish/er/abandon-wish.er.test.ts:189` | удалить |
| `modules/wish/src/wish/er/confirm-wish.er.test.ts:190` | повторное событие ничего не меняет | З6 | `modules/wish/src/wish/er/confirm-wish.er.test.ts:259` | удалить |
| `modules/wish/src/wish/er/confirm-wish.er.test.ts:227` | completed с kind: likert и чужим ownerInfo | З6 | `modules/wish/src/wish/er/confirm-wish.er.test.ts:203` | удалить |
| `modules/wish/src/wish/er/fulfill-wish.er.test.ts:143` | confirmed → fulfilled | З6 | `modules/wish/src/wish/er/fulfill-wish.er.test.ts:128` + `domain/src/wish/wish/wish.ar.test.ts:302` | объединить с `:128` (`it.each` по двум статусам) |
| `modules/wish/src/wish/er/fulfill-wish.er.test.ts:250` | повторное событие ничего не меняет | З6 | `modules/wish/src/wish/er/fulfill-wish.er.test.ts:330` + `domain/src/wish/wish-fulfillment.dcs.test.ts:126` | удалить |
| `modules/wish/src/wish/er/invite-wishers.er.test.ts:177` | confirmed тоже приглашается; статус не меняется | З6 | `domain/src/wish/wish/wish.ar.test.ts:323` (`it.each` expressed/confirmed) + `modules/…/invite-wishers.er.test.ts:156` | удалить |
| `modules/wish/src/wish/er/invite-wishers.er.test.ts:216` | не совпавшее с программой желание не зовётся | З6 | `modules/wish/src/wish/er/invite-wishers.er.test.ts:192` | объединить с `:192` |
| `modules/wish/src/wish/er/invite-wishers.er.test.ts:251` | другой модуль — желание не зовётся | З6 | `modules/wish/src/wish/er/invite-wishers.er.test.ts:192` | туда же |
| `modules/wish/src/wish/uc/create-course-wish.uc.test.ts:201` | дубль — текст прежний | З6 | `domain/src/wish/wish/wish.errors.test.ts:13` (label) | удалить |
| `modules/wish/src/wish/uc/create-module-wish.uc.test.ts:140` | дубль — текст прежний | З6 | `modules/wish/src/wish/uc/create-course-wish.uc.test.ts:201` (тот же label) | удалить |

### Бот

| Тест | Имя | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `runners/u7-bot/tests/e2e/wish-questionnaire.e2e.test.ts:399` | resume без активной анкеты → «не найдена» без ⚠️ | З6 | `runners/u7-bot/src/controllers/questionnaire/stories/fill.story.dmg.test.ts:359` (тот же экран) | удалить |
| `runners/u7-bot/tests/e2e/wish-questionnaire.e2e.test.ts:460` | confirmed → на карточке «Отменить желание»; отмена → cancelled | З6 | `runners/u7-bot/tests/courses/wish-flow.integration.test.ts:251` + `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:809` | объединить с `wish-flow…:251` (отмена confirmed уже там) |

---

## Полезные тесты

| Файл | Оценка |
|---|---|
| `domain/src/wish/wish/wish.ar.test.ts` | 34 из 50 объявлений (после кандидатов): ветки `Ok`/`Err` каждого перехода, `questionnaire()`/`fulfillmentTargets`/`invitationTargets`, `current()`, D-39 (`:507`) — ядро домена. |
| `domain/src/wish/wish/wish.rules.test.ts` | 14 полезны: три правила, все отказы с payload, самодекларируемое «чужое/другая цель не мешает» (`:79,89,103`). |
| `domain/src/wish/wish/wish.state.test.ts` | 4 полезны: приём валидных целей (`:11,33`), отказ legacy-поля `courseId` (`:116`) — после объединения схемных тестов в одну таблицу станет 3. |
| `domain/src/wish/wish/wish.invited.test.ts` | 4 полезны: `ALREADY_INVITED` (`:66`), дописывание второго потока (`:60`), DCS по приглашённому (`:93`), приглашение на другой поток (`:105`). |
| `domain/src/wish/wish/wish.events.test.ts` | Полезных нет: 6 из 6 — константы и схемы построенных payload; защита события идёт через ER-тесты и стори. |
| `domain/src/wish/wish/wish.errors.test.ts` | Полезных нет: состав из 5 тестов перекрывается правилами (payload) и `arch:check` (коды в модуле). |
| `domain/src/wish/wish/wish.module.test.ts` | Полезных нет: паспорт + `ArchChecker`; сборку модуля держит `arch:check` и тест сборки приложения. |
| `domain/src/wish/wish/wish.policy.test.ts` | 3 из 3: владелец/чужой/без субъекта — каждое правило Policy. |
| `domain/src/wish/wish/pools/course-pool.test.ts` | 2 из 2: валидность пула для всех `course.json` и `undefined` для курса без пула. |
| `domain/src/wish/wish-fulfillment.dcs.test.ts` | 7 из 8: батчи по видам цели, ответ DCS, идемпотентность через статус. |
| `domain/src/wish/wish-invitation.dcs.test.ts` | 7 из 9: матчинг, батч потоков, адреса без повторов, недостижимые, «потока нет». |
| `domain/src/wish/wish/er/*.er.test.ts` (4 файла) | Полезных нет: 7 из 7 — паспорта ER (`normalize`) и payload чужого контракта. |
| `domain/src/wish/wish/uc/*.uc.test.ts` (4 файла) | Полезных нет: 19 из 19 — паспорта UC, схемы входа/выхода, тавтологии. Поведение UC покрыто модульными тестами ниже. |
| `modules/wish/src/infra/wish.json-repo.test.ts` | 23 из 25: контракт `VersionedRepository` (конфликты версий, параллельные записи), legacy-строки, все выборки и фильтры, битые файлы. |
| `modules/wish/src/wish/er/abandon-wish.er.test.ts` | 7 из 13: успех с часами приложения, игноры, выбор активного среди завершённых, чужой `ownerInfo`, шина, D-47. |
| `modules/wish/src/wish/er/confirm-wish.er.test.ts` | 8 из 11: успех, **публикация `wish.confirmed` с payload**, игноры, чужой `ownerInfo`, шина, D-47. |
| `modules/wish/src/wish/er/fulfill-wish.er.test.ts` | 11 из 14: батч-вопрос курса, ответ по видам цели, отказы/исключения фасада с логом и oplog, шина, D-47. |
| `modules/wish/src/wish/er/invite-wishers.er.test.ts` | 15 из 19: матчинг курса/модуля, форк курса, приглашение нескольким, недостижимый адресат и дедупликация предупреждений, три разных места отказа фасадов, шина, D-47. |
| `modules/wish/src/wish.module.test.ts` | 1 из 2: smoke `createCourseWish` через модуль на реальном репозитории. |
| `modules/wish/src/wish/uc/create-course-wish.uc.test.ts` | 11 из 13: instant / анкета / сбой анкеты (D-41), дубль с payload статуса (D-39), порядок правил, фасад от имени UC, отказ фасада, guest → `UNAUTHORIZED`. |
| `modules/wish/src/wish/uc/create-module-wish.uc.test.ts` | 7 из 9: создание, недоступный модуль, дубль, порядок правил, фасад, guest. |
| `modules/wish/src/wish/uc/cancel-wish.uc.test.ts` | 8 из 10: отмена expressed/confirmed и module-варианта, нет желания / другая цель, `ACCESS_DENIED` по Policy, guest, D-57 (`expectedVersion`). |
| `modules/wish/src/wish/uc/list-user-wishes.uc.test.ts` | 5 из 5: батч для каталога, отсечение чужих, пустой список, guest, query не пишет. |
| `runners/u7-bot/src/controllers/courses/stories/wish-confirmed.story.test.ts` | 4 из 4: подписка на FQN, рассылка менторам с дедупликацией и фильтрами, недоступный курс/пользователь. |
| `runners/u7-bot/src/controllers/courses/stories/wish-invite.story.test.ts` | 8 из 8: подписка, карточка приглашения, ключ набора, три ветки строки ментора, module-приглашение, «поток не найден». |
| `runners/u7-bot/tests/courses/wish-flow.integration.test.ts` | 7 из 7: связка стори ↔ реальный модуль ↔ файл (статусы в репо, штампы экрана, мягкий `WISH_NOT_FOUND`, markdown-safe курс с опасным названием). **Сейчас 2 из 7 красные — поймали регрессию стори курса (`course-dmg`), это аргумент за, а не против.** |
| `runners/u7-bot/tests/courses/wish-legacy-records.integration.test.ts` | 2 из 2: D-36 на реальном файле через приложение — legacy-строка читается и переживает перезапись соседа. |
| `runners/u7-bot/tests/e2e/wish-questionnaire.e2e.test.ts` | 5 из 7: анкетная ветка (приглашение варианта A + захват ввода + pending), `/cancel` → `abandoned` через ER, полное прохождение → `confirmed` через ER, «/cancel только на Q1» и markdown-safe свободный ответ, повторный apply → W04 → resume. |

---

## Что проверить перед удалением (риски и спорные)

1. **З1 против `testing.md`.** §3 пирамиды относит контрактные проверки к «автоматически», но `dmg-core gen` заготовок таких тестов не создаёт; удаление паспортов — это смена конвенции проекта, а не только чистка. Решение — в синтезе (правило в `conductor/roadmap/test-bloat.md` §2 или `node_modules/dmg-core/docs/reference/testing.md`), не в шаге удаления.
2. **З2 против §3 «Схемы — все поля».** Предложение «одна таблица валид/невалид на схему» вместо 24 тестов меняет объём уровня «Схемы»; если правило оставляем как есть, кандидаты З2 удалять нельзя — только сливать.
3. **FQN (З3).** Перед удалением `wish.events.test.ts:30,51` проверить, что FQN нигде не сравнивается литералом: `grep -rn "wish\.wish\.\(invited\|confirmed\)" --include=*.ts --exclude-dir=node_modules .` Если литерал есть (реплей/oplog/легаси-подписчик) — оставить один FQN-тест.
4. **З5 `create-course-wish.uc.test.ts:215` / `create-module:150`.** Удаление опирается на то, что `WishAr.create` разрешает создание при неактивном желании; если правило `unique` когда-нибудь начнёт блокировать и неактивные, упадёт тест правила (`wish.rules.test.ts:42`) — проверить, что он остаётся.
5. **Тесты бота.** Базовая линия `wish` в боте сейчас красная не по своей причине; удаление `e2e:460` не должно делаться до того, как `course-dmg` закроется и 8 тестов позеленеют, — иначе нечем подтвердить, что сценарий остался покрыт.
6. **`wish-flow.integration.test.ts:194`** выглядит как «повтор стори-теста», но падает именно из-за связки слоёв — не кандидат. Похожие «повторы стори» в этом файле (`:180,251`) тоже оставлены по этой причине.
