# Инвентаризация тестов: домен `user` и `dossier`

Трек `tst-cleanup_20261105`, фаза Ф2, срез «домен `user` + `dossier`». Только чтение кода + прогоны
`bun test`; не изменено ничего, кроме этого файла. Файл `user-app.md` (прикладной слой `user`)
пишется параллельно, здесь его выводы не используются.

**Область.** `domain/src/user/**/*.test.ts` (5 файлов) и `domain/src/dossier/**/*.test.ts`
(2 файла). Прогоны (worktree `tst-cleanup`, ветка `tst-cleanup`):

| Команда | Итог |
|---|---|
| `cd domain && bun test src/user src/dossier` | **70 pass, 0 fail**, 113 `expect()` |
| по каждому файлу отдельно (`bun test <файл>`) | 1 + 2 + 12 + 38 + 3 + 10 + 4 = 70 |

**Как считал.** Объявление — строка `it(`/`test(`; `it.each`/`describe.each` в области нет, поэтому
объявлений ровно столько же, сколько кейсов `bun test`. Критерий оценки — тот же, что в
`peer-review-domain-delete.md` и инвентаризациях `wish`/`stream`/`questionnaire`:
**«какая реальная ошибка в коде модуля уронит этот тест и только его?»** Сомнение трактовалось в
пользу теста. Дополнительно применялась конвенция проекта по Policy: перечисление ролей живёт
**одной** строкой таблицы (`it.each` в `domain/src/stream/stream/stream.policy.test.ts:28`), а не
`it` на каждую роль; сочетание «ADMIN + другая роль» — отдельный класс входа (ловит `roles[0]` и
`roles.length === 1` в правилах).

**Базовая линия области: 70 объявлений / 38 полезны / 32 кандидата (46 %)** — 20 «сомнительных»
и 12 «пустых».

Модуль маленький и почти не мигрирован: `user` — внешний модуль (D-37) с одним `UcDef`
(`getTelegramAddresses`), один агрегат `UserAr` на legacy-схеме, `UserPolicy` — объект из
одиннадцати методов (6 предикатов ролей и 5 правил, из них тестами покрыты 6); `dossier` —
внешний модуль-паспорт без агрегатов, UC и ER, в домене только
схемы категорий и баллов. Поэтому закономерностей из прикладного слоя (Б-1…Б-5, Б-9, Б-10, Б-14…Б-16)
здесь нет — ни DQS/DCS, ни UC с загрузкой, ни событий, ни UI-текстов.

---

## 1. Сводка

| Файл | Объявлений | Полезен | Сомнителен | Пуст |
|---|---|---|---|---|
| `domain/src/user/contract.role.test.ts` | 1 | 1 | 0 | 0 |
| `domain/src/user/user.module.test.ts` | 2 | 1 | 0 | 1 |
| `domain/src/user/user/a-root.test.ts` | 12 | 8 | 3 | 1 |
| `domain/src/user/user/policy.test.ts` | 38 | 22 | 13 | 3 |
| `domain/src/user/user/uc/get-telegram-addresses.uc.test.ts` | 3 | 0 | 2 | 1 |
| `domain/src/dossier/categories.test.ts` | 10 | 2 | 2 | 6 |
| `domain/src/dossier/scores.test.ts` | 4 | 4 | 0 | 0 |
| **Итого (user 56 / dossier 14)** | **70** | **38** | **20** | **12** |

**Расклад кандидатов по закономерностям:** Б-6 — 16, Б-8 — 8, Б-11 — 6, Б-7 — 2 (сумма 32).
Новых Н-ID нет: все 32 случая сводятся к четырём уже описанным закономерностям; пограничный
случай (`updatedAt`) — в Б-11 с пояснением.

**Что в области не встретилось:** Б-1 и Б-2 (владелец правил — сам домен, копии живут **выше**, в
`modules/user`, см. «Открытые вопросы» №3), Б-3/Б-4/Б-5 (нет общих хелперов, UI и файлов-двойников),
Б-9/Б-10 (нет платформенных UC-цепочек, фейков и фикстур), Б-12 (нет `filter/map`),
Б-13 (мёртвые методы есть — `canRead`, `canEdit`, `isMentor`/`isSubscriber`/`isGuest`/`isStudent`,
и мёртвый модуль `dossier` целиком, но их тесты вошли в таблицу под своими основными
закономерностями; удаление **кода** — решение orchestrator'а, «Открытые вопросы» №1 и №2),
Б-14…Б-16 (нет экранов бота, имён «шире проверки»).

---

## 2. Закономерности

### Б-6. Копия соседнего теста без нового класса входа — 16 случаев

Тот же класс входа и та же ветка кода, что у соседнего теста: другое значение, которого код не
различает, или шаг уже покрытого цикла. Основной источник — `policy.test.ts`: 38 `test(` почти без
таблиц, по `it` на каждую комбинацию ролей, хотя тестируемых правил шесть.

**Признак поиска.** `grep -c "^    test(" domain/src/user/user/policy.test.ts` — 38 объявлений на
6 `describe`; `grep -c "it.each" domain/src/user/user/policy.test.ts` — 0 (в
`domain/src/stream/stream/stream.policy.test.ts` на 2 правила — 3 `it.each`).

**Примеры.** `domain/src/user/user/policy.test.ts:142` (STUDENT не может редактировать ADMIN —
та же ветка «не админ и uuid разные», что `:138`), `:199` (STUDENT добавляет STUDENT себе — та же
ветка «себе + STUDENT», что `:187`), `:87` (TEACHER не может создавать — та же ветка `isAdmin` =
false, что `:83`), `domain/src/user/user/a-root.test.ts:122` (полный цикл из уже покрытых
`addRole`-шагов), `:97` (регулярки `uuid`/`createdAt` для `register` — те же, что у `create`).

### Б-7. Ручной паспорт Def — дубль `arch:check` — 2 случая

**Признак поиска.** `grep -rn "normalize(\|ArchChecker" --include=*.test.ts domain/src/user
domain/src/dossier` — 2 вхождения в 2 файлах.

**Примеры.** `domain/src/user/user.module.test.ts:18` (`ArchChecker.defsOf([UserModuleDef])`) —
это и есть шаг `arch:check` из `bun run check` (`package.json:45`);
`domain/src/user/user/uc/get-telegram-addresses.uc.test.ts:9` (`normalize(...)` — `type`,
`aggregate`, `callers`, `errors`, `policy.op`).

**Не относится к Б-7:** `user.module.test.ts:7` — единственный тест **состава** модуля
(`external`, `dependsOn`, `aggregates`, `useCases`, `reactions`, `jobs`), по решению `peer-review`
такой тест на модуль остаётся.

### Б-8. Схема платформы: приём/отказ полей `F.uuid`, `picklist`, `variant` — 8 случаев

`testing.md` §3: приём и отказ полей платформы не тестируются. В `user` это схемы входа/выхода
`UcDef` (`F.uuid`, `F.int`), в `dossier` — `picklist`/`union` литералов и `variant` по полю
`category`, где собственная логика только одна: связь «категория ↔ подкатегория».

**Признак поиска.** `grep -rn "safeParse\|v\.parse(" --include=*.test.ts domain/src/user domain/src/dossier`.

**Примеры.** `domain/src/user/user/uc/get-telegram-addresses.uc.test.ts:20` (uuid входа: приём +
отказ `'x'`), `domain/src/dossier/categories.test.ts:63` («`weight` обязателен» — обязательность
поля `v.object`), `:21` (отказ `v.picklist`), `:42`/`:48` (`v.union` из трёх литералов).

### Б-11. Тавтология: константа против той же константы — 6 случаев

**Признак поиска.** `grep -rn "for (const .* of \[" --include=*.test.ts domain/src/user
domain/src/dossier` — перебор литералов, переписанных из источника;
`grep -rn "return true\|toBe(true)" domain/src/user/user/policy.ts`.

**Примеры.** `domain/src/dossier/categories.test.ts:11` и `:25` (циклы по тем же значениям, что
объявлены в `categories.ts:26-30` и `:4-23`), `domain/src/user/user/policy.test.ts:106`/`:112`/`:116`
(`canRead` — `return true` с неиспользуемыми аргументами, `policy.ts:37`), `a-root.test.ts:64`
(«не создаёт `updatedAt`»: необязательное поле, которое модуль только пишет —
`a-root.ts:63,75,88` — и нигде не читает; добавить его в `create` не сломает ничего, схема
разрешает — `entity.ts:25`).

---

## 3. Кандидаты

Только «сомнителен» и «пуст» — 32 строки. Пути — от корня репозитория; порядок строк — как в
файлах. Каждая ссылка «где покрыто» ведёт на конкретный `it`/`test`, который кандидатом не
является, либо на «нигде» с причиной.

### `user/user.module.test.ts` (1 из 2)

| путь:строка | тест | Б | оценка | где покрыто | что делать |
|---|---|---|---|---|---|
| `domain/src/user/user.module.test.ts:18` | ArchChecker — без нарушений | Б-7 | пуст | `node_modules/dmg-core/src/arch/def-checker.test.ts:229` (MAN-06 — UC/события/ошибки входят в модуль) и `:425` (ERR-04); это шаг `arch:check` в `package.json:45` | удалить |

### `user/user/uc/get-telegram-addresses.uc.test.ts` (3 из 3 — файл уходит целиком)

| путь:строка | тест | Б | оценка | где покрыто | что делать |
|---|---|---|---|---|---|
| `domain/src/user/user/uc/get-telegram-addresses.uc.test.ts:9` | query для других модулей над агрегатом пользователя, без ограничений и ошибок | Б-7 | пуст | `domain/src/user/user.module.test.ts:7` (UC объявлен в модуле) + `node_modules/dmg-core/src/arch/def-checker.test.ts:229` (MAN-06) | удалить |
| `…:20` | вход — uuid пользователей | Б-8 | сомнителен | `modules/wish/src/wish/er/invite-wishers.er.test.ts:256` (реальный вызов ровно с `{ userIds: [USER, OTHER_USER] }`) + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` (`INPUT_VALIDATION` с путём поля) | удалить |
| `…:26` | выход — пары userId/telegramId только для достижимых | Б-8 | сомнителен | `modules/wish/src/wish/er/invite-wishers.er.test.ts:256` (адреса из выхода в событии) + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` (`OUTPUT_VALIDATION`) | удалить |

### `user/user/a-root.test.ts` (4 из 12)

| путь:строка | тест | Б | оценка | где покрыто | что делать |
|---|---|---|---|---|---|
| `domain/src/user/user/a-root.test.ts:26` | нарушение инвариантов с несколькими ошибками | Б-6 | сомнителен | `domain/src/user/user/a-root.test.ts:20` (та же ветка: конструктор бросает при нарушении `UserSchema`; «несколько ошибок» — свойство valibot, не агрегата) | слить в `:20` — одна таблица невалидных входов (`uuid`, `name`, `telegramId`, `roles`) |
| `…:64` | не создаёт updatedAt при создании | Б-11 | пуст | нигде: `updatedAt` не читается ни одним файлом модуля (`grep -rn updatedAt domain/src/user modules/user/src`) — тест падает только от добавления поля, которое ничего не ломает | удалить |
| `…:97` | генерирует UUID и createdAt при регистрации | Б-6 | сомнителен | `domain/src/user/user/a-root.test.ts:39` (те же регулярки на том же `crypto.randomUUID`/`isoNow`) + `:75` (`uuid`, `createdAt` — `toBeString`) | удалить |
| `…:122` | добавляет несколько разных ролей последовательно | Б-6 | сомнителен | `domain/src/user/user/a-root.test.ts:110` (порядок уже в `toEqual`) + `:116` (дубль игнорируется) | удалить |

### `user/user/policy.test.ts` (16 из 38)

| путь:строка | тест | Б | оценка | где покрыто | что делать |
|---|---|---|---|---|---|
| `domain/src/user/user/policy.test.ts:63` | ADMIN без AUTHOR — false | Б-6 | сомнителен | `domain/src/user/user/policy.test.ts:59` (та же ветка `includes(AUTHOR)` = false) | слить в `:59` — `it.each` отказов (MENTOR, ADMIN, без ролей) |
| `…:72` | пользователь без ролей — false | Б-6 | сомнителен | `domain/src/user/user/policy.test.ts:59` (пустой `roles[]` для `includes` — свойство языка) | слить в `:59` |
| `…:87` | TEACHER не может создавать пользователей | Б-6 | сомнителен | `domain/src/user/user/policy.test.ts:83` (та же ветка `isAdmin` = false) | слить в `:83` — `it.each` отказов |
| `…:99` | пользователь без ролей не может создавать | Б-6 | сомнителен | `domain/src/user/user/policy.test.ts:83` | слить в `:83` |
| `…:106` | любой пользователь может читать любого другого пользователя | Б-11 / Б-13 | пуст | нигде: `canRead` — `return true` с неиспользуемыми `_actor`/`_target` (`domain/src/user/user/policy.ts:37`), потребителей нет | удалить (метод мёртв — «Открытые вопросы» №1) |
| `…:112` | можно читать самого себя | Б-11 / Б-13 | пуст | нигде: тот же `return true` | удалить |
| `…:116` | даже без ролей можно читать | Б-11 / Б-13 | пуст | нигде: тот же `return true` | удалить |
| `…:129` | ADMIN может редактировать себя | Б-6 | сомнителен | `domain/src/user/user/policy.test.ts:123` (ветка `isAdmin` → true; «себя» проверяет нетривиальный случай — `:133`) | удалить |
| `…:142` | STUDENT не может редактировать ADMIN | Б-6 | сомнителен | `domain/src/user/user/policy.test.ts:138` (та же ветка «не админ и uuid разные») | слить в `:138` — `it.each` отказов |
| `…:146` | TEACHER не может редактировать STUDENT | Б-6 | сомнителен | `domain/src/user/user/policy.test.ts:138` | слить в `:138` |
| `…:150` | TEACHER не может редактировать ADMIN | Б-6 | сомнителен | `domain/src/user/user/policy.test.ts:138` | слить в `:138` |
| `…:159` | пользователь без ролей не может редактировать другого | Б-6 | сомнителен | `domain/src/user/user/policy.test.ts:138` (роли в `canEdit` не участвуют — `policy.ts:42`) | удалить |
| `…:164` | пользователь без ролей может редактировать себя | Б-6 | сомнителен | `domain/src/user/user/policy.test.ts:133` (та же ветка `uuid` равенства) | удалить |
| `…:199` | STUDENT может добавить себе STUDENT (идемпотентно) | Б-6 | сомнителен | `domain/src/user/user/policy.test.ts:187` (та же ветка «себе + STUDENT»; роль актора в ней не участвует — `policy.ts:54`) | слить в `:187` |
| `…:203` | STUDENT НЕ может добавить STUDENT другому | Б-6 | сомнителен | `domain/src/user/user/policy.test.ts:195` (та же ветка «чужой → отказ», `policy.ts:53`) | слить в `:195` |
| `…:249` | ADMIN может удалить любую роль, включая у себя | Б-6 | сомнителен | `domain/src/user/user/policy.test.ts:223` (ветка `isAdmin` → true) | слить в `:223` |

**Отдельно про `canEdit`.** Все 10 тестов блока (`:123`…`:164`) держат метод без потребителей
(`grep -rn "UserPolicy.canEdit"` — только тест): Б-13. В таблице они помечены по своей основной
закономерности; если orchestrator решит удалить метод (как `hasParticipant` в `peer-review`),
уходят и три «полезных» строки блока — `:123`, `:133`, `:138`.

### `dossier/categories.test.ts` (8 из 10)

| путь:строка | тест | Б | оценка | где покрыто | что делать |
|---|---|---|---|---|---|
| `domain/src/dossier/categories.test.ts:11` | валидные категории проходят | Б-11 | пуст | нигде: три литерала, переписанные из `categories.ts:26-30`; приём `v.picklist` — платформа (`testing.md` §3) | удалить |
| `…:21` | неизвестная категория — ошибка | Б-8 | пуст | нигде: отказ `v.picklist` — платформа; отказ по собственной логике схемы — `categories.test.ts:80` | удалить |
| `…:25` | все допустимые подкатегории проходят | Б-11 | пуст | нигде: те же 10 значений из `categories.ts:4-23`, код их не разбирает | удалить |
| `…:42` | допустимые значения веса проходят | Б-8 | пуст | нигде: `v.union` из трёх литералов (`categories.ts:45`) — платформа; корректный вес уже внутри `categories.test.ts:54` | удалить |
| `…:48` | недопустимый вес — ошибка | Б-8 | пуст | нигде: тот же `v.union` литералов | удалить |
| `…:63` | weight обязателен — отсутствие ошибка | Б-8 | пуст | нигде: обязательность поля `v.object` — платформа; `variant` по `category` проверяет `categories.test.ts:80` | удалить |
| `…:71` | недопустимый вес — ошибка (в маппинге) | Б-8 | сомнителен | нигде: тот же `SkillWeightSchema` (`categories.ts:61`); дубль `categories.test.ts:48` — оба удаляются вместе | удалить |
| `…:89` | неизвестная категория — ошибка (в маппинге) | Б-8 | сомнителен | нигде: `v.variant` по неизвестной ветке — платформа; дубль `categories.test.ts:21` | удалить |

---

## 4. Полезные тесты

- `user/contract.role.test.ts` — 1 тест, полезен: значения `Role` совпадают со строками, которые
  лежат в данных (`data/fixtures/users/users.json:7` — `"GUEST"`); при смене значения `hasRole`/
  `isAdmin` в `a-root.ts:95` и `policy.ts:10` молча перестанут находить роль, `tsc` этого не видит.
- `user/user.module.test.ts` — 1 из 2 (`:7`): единственный тест состава модуля (`useCases`,
  `aggregates`, `dependsOn`, `reactions`, `jobs`, `external`); `arch:check` не видит «модуль
  объявил лишнюю зависимость» и «внешний модуль перестал быть внешним».
- `user/user/a-root.test.ts` — 8 из 12: `register` → роль `GUEST` и запись `nick` (`:75`, `:88`),
  `create` сохраняет поля и генерирует `uuid`/`createdAt` (`:39`, `:53`), идемпотентность `addRole`
  — добавление и отказ дублю (`:110`, `:116`), инварианты `UserSchema` (`:20`) и совместимость
  схемы с legacy-записью (`:15`) — единственная защита схемы, отдельного `*.state.test.ts` у
  модуля нет.
- `user/user/policy.test.ts` — 22 из 38: по строке на каждую ветку живых правил —
  `isAuthor`/`isAdmin` (роль даёт право, чужие роли нет, `AUTHOR + MENTOR`), `canCreate`,
  `canAddRole` и `canRemoveRole` (ADMIN всё, MENTOR + STUDENT, свой STUDENT себе, чужой — отказ,
  `SUBSCRIBER` только ADMIN, роль-аргумент `ADMIN`/`MENTOR` запрещена), сочетание ролей
  (ADMIN среди нескольких); правила вызываются из legacy-UC модуля (`add-role-to-user-uc.ts:38`,
  `remove-role-to-user-uc.ts:38`, `create-user-uc.ts:32`) и из policy курса
  (`domain/src/course/course/policy.ts:18`).
- `user/user/uc/get-telegram-addresses.uc.test.ts` — полезных нет: паспорт `UcDef` и схемы
  входа/выхода платформы; поведение UC живёт в wish (`modules/wish/src/wish/er/invite-wishers.er.ts:126`).
- `dossier/categories.test.ts` — 2 из 10: `:54` (корректный маппинг принимается — положительный
  контроль, без него таблица отказов проходит на схеме, отвергающей всё) и `:80`
  (подкатегория чужой категории отклоняется — единственная собственная логика `v.variant`).
- `dossier/scores.test.ts` — 4 из 4: обе границы балла `1..5` (`:15`, `:24`), связь
  категория↔подкатегория (`:33`), приём корректного балла (`:6`) — своя логика схемы, аналогов
  в модуле нет (репозитория и агрегата у `dossier` нет).

---

## 5. Открытые вопросы (решает orchestrator)

1. **Мёртвые правила `UserPolicy` (Б-13).** `canRead` (`policy.ts:37` — `return true`,
   аргументы не используются), `canEdit` (`:41`), `isMentor`/`isSubscriber`/`isGuest`/`isStudent`
   (`:13`–`:27`, вызовов вне `canAddRole`/`canRemoveRole` нет). Потребители есть только у
   `isAuthor`, `isAdmin`, `canCreate`, `canAddRole`, `canRemoveRole`. Удалять ли код — вне
   области чистки тестов: если да, из таблицы уходят ещё 3 строки `canRead` и 3 «полезных»
   `canEdit` (`:123`, `:133`, `:138`).
2. **Домен `dossier` — мёртвый модуль (Б-13 в масштабе модуля).** `SkillMappingSchema` и
   `SkillScoreSchema` не импортирует никто, кроме своих тестов (`grep` по репо: единственная
   ссылка — реэкспорт `modules/dossier/src/index.ts:1`, который сам никем не импортируется;
   в графе модуль нужен только паспортом — `scripts/domain-arch.ts:9`). Те же категории
   независимо переписаны в `domain/src/peer-review/peer-review-question-pool.ts:8`. Вопрос:
   удалить код вместе с оставшимися 6 полезными тестами отдельным срезом или оставить `dossier`
   как резерв модели данных (тогда 8 кандидатов §3 можно удалять, а 6 полезных — нет).
3. **Повтор правил в тестах legacy-UC `modules/user` (Б-1, вне этой области).** Домен — владелец,
   копии живут выше: `modules/user/src/api/user/add-role-to-user-uc.test.ts:69` ≙
   `a-root.test.ts:116`, `:101` ≙ `policy.test.ts:177`, `create-user-uc.test.ts:122` ≙
   `policy.test.ts:83`, `register-guest-uc.test.ts` ≙ `a-root.test.ts:75`. Кандидаты — копии в
   модуле (инвентаризация `user-app`); доменные строки в таблицу не попали.
4. **Пробелы покрытия `UserAr`, которые нельзя принять за покрытие.** У `removeRole` (правило
   «последняя роль → `GUEST`», `a-root.ts:77`), `setRole` и `hasRole` нет ни одного теста;
   `addRole` не проверяет `updatedAt`. Удаление 4 строк `a-root.test.ts` (§3) пробела не создаёт,
   но если в срезе правятся тесты Ar — стоит добавить один тест на «последняя роль → `GUEST`».
5. **Пирамида против Б-6 в `policy.test.ts`.** `testing.md` §3 требует «Policy — каждое правило:
   allowed и denied, роли, свой/чужой», а я пометил 13 строк как дубли ветки. Если приоритет у
   требования «по `it` на роль» — вернуть в полезные `:63`, `:87`, `:142`, `:146`, `:150`, `:203`
   (роль-специфичные отказы) и оставить в таблице только «себе + STUDENT»/«без ролей»/«ADMIN себя».
