# Что удаляем: тесты домена `user` + `dossier`

Трек `tst-cleanup_20261105`, фаза Ф2, срез «домен `user` + `dossier`». Только чтение кода +
прогоны `bun test`; не изменено ничего, кроме этого файла.

**Область.** `domain/src/user/**/*.test.ts` (5 файлов) и `domain/src/dossier/**/*.test.ts`
(2 файла). База — `cd domain && bun test src/user src/dossier`: **70 pass / 0 fail**, 113 `expect()`,
7 файлов (worktree `tst-cleanup`). Основание — `inventory/user-dossier-domain.md` (§1 сводка,
§3 кандидаты), закономерности — `conductor/roadmap/test-bloat.md` §2 (Б-1…Б-16), правила —
`node_modules/dmg-core/docs/reference/testing.md` §3, §5, §5.1 (TST-08, TST-09), решения трека
`spec.md` «Решения».

**Решения, которые применены ко всей таблице.**

- **Схемы (Б-8).** Приём/отказ полей платформы (`F.uuid`, `F.int`, `picklist`, `variant`, обязательность
  `v.object`) удаляются: владелец — `dmg-core` (`fields.test.ts`, `use-case-from-def.test.ts:130/264`).
  Остаётся своя логика схемы: в `dossier` это связь «категория ↔ подкатегория» (`v.variant`,
  `categories.ts:57`), в `dossier/scores` — границы балла и та же связь.
- **Паспорта Def (Б-7).** Удаляются все. Состав модуля держит **один** тест —
  `domain/src/user/user.module.test.ts:7` (UC, `dependsOn`, `external`); остальное
  (`errors`/`emits`/`calls`, FQN, реэкспорт ключами) — `bun run arch:check` и
  `node_modules/dmg-core/src/arch/def-checker.test.ts`.
- **Тексты `label`/`denyMessage` (TST-09).** В области их не проверяет ни один `expect`
  (у `UserPolicy` — `boolean`, а не `Decision`; `errors.ts` модуля пуст) — раздел 3.
- **Одно правило на двух уровнях (Б-1).** Домен здесь — владелец правил; копии живут **выше**
  (`modules/user`), их удаляет таблица `user-app-delete.md`. Доменные тесты правил остаются.
- **Policy (`testing.md` §3).** У каждого живого правила (`isAuthor`, `canCreate`, `canAddRole`,
  `canRemoveRole`) остаются allowed и denied. Дополнительная роль в ветке, которую код не различает
  (`policy.ts:53`, `:54`, `:30`, `:34`, `:62`), — `удалить`; не `слить` в `it.each` — число кейсов
  должно сократиться.
- **Мёртвый код (Б-13).** `canRead` (`policy.ts:37`), `canEdit` (`:41`), `isSubscriber` (`:17`),
  `isGuest` (`:21`), `isStudent` (`:25`) удаляет orchestrator вместе с кодом; их тесты —
  `отложить: удалить с кодом`, сейчас не трогаем.
- **`dossier`** — запланированная заготовка модуля (`conductor/roadmap.md`, Релиз 4): **код
  остаётся**, поэтому Б-8/Б-11 кандидаты `categories.test.ts` удаляются как «нигде» (платформа /
  литералы источника), а `:54`, `:80` и весь `scores.test.ts` остаются — единственная защита
  собственной логики схем.

Пути — от корня репозитория, номера строк — по текущему коду worktree. Порядок строк — порядок
объявлений в файле. Каждая ссылка «где покрыто» ведёт на `it`/`test`, который **этой же таблицей
не удаляется** (проверено скриптом: файл есть, на строке начинается `it(`/`test(`).

---

## 1. Таблица

| файл | строка | имя теста | Б | действие | где покрыто |
|---|---|---|---|---|---|
| `domain/src/user/user.module.test.ts` | 18 | ArchChecker — без нарушений | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06) и `:426` (ERR-04) — это `bun run arch:check` (`package.json:45`) |
| `domain/src/user/user/uc/get-telegram-addresses.uc.test.ts` | 9 | query для других модулей над агрегатом пользователя, без ограничений и ошибок | Б-7 | удалить | `domain/src/user/user.module.test.ts:7` (UC в составе модуля, `dependsOn`); `callers: ['system']` и `allowAll` держит реальный вызов `modules/wish/src/wish/er/invite-wishers.er.test.ts:156`; MAN-06 — `node_modules/dmg-core/src/arch/def-checker.test.ts:230` |
| | 20 | вход — uuid пользователей | Б-8 | удалить | `modules/wish/src/wish/er/invite-wishers.er.test.ts:256` (реальный вызов ровно с `{ userIds: [USER, OTHER_USER] }`) + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130` (`INPUT_VALIDATION` с путём поля) |
| | 26 | выход — пары userId/telegramId только для достижимых | Б-8 | удалить | `modules/user/src/user.module.test.ts:65` (профиля нет — пользователя нет в ответе) и `:72` (нет `telegramId` — нет пары) + `modules/wish/src/wish/er/invite-wishers.er.test.ts:156` (пара `userId`/`telegramId` уходит в payload события) + `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` (`OUTPUT_VALIDATION`) |
| `domain/src/user/user/a-root.test.ts` | 26 | нарушение инвариантов с несколькими ошибками | Б-6 | слить в `domain/src/user/user/a-root.test.ts:20` | — приёмник `:20` (та же ветка конструктора: `UserSchema` отклоняет любой невалидный вход; «несколько ошибок сразу» — свойство valibot, не агрегата) |
| | 64 | не создаёт updatedAt при создании | Б-11 | удалить | нигде: `updatedAt` только пишут (`a-root.ts:63,75,88`), не читает ни один файл модуля; тест падает лишь от добавления необязательного поля (`entity.ts:25`), которое ничего не ломает |
| | 97 | генерирует UUID и createdAt при регистрации | Б-6 | удалить | `domain/src/user/user/a-root.test.ts:39` (те же регулярки на том же `crypto.randomUUID`/`isoNow`) + `:75` (register: `uuid`/`createdAt` — строки; формат гарантирует `UserSchema` в конструкторе, `a-root.ts:18`) |
| | 122 | добавляет несколько разных ролей последовательно | Б-6 | удалить | `domain/src/user/user/a-root.test.ts:110` (порядок ролей в `toEqual`) + `:116` (дубль игнорируется — та же ветка `hasRole`, `a-root.ts:61`) |
| `domain/src/user/user/policy.test.ts` | 63 | ADMIN без AUTHOR — false | Б-6 | удалить | `domain/src/user/user/policy.test.ts:59` — `roles.includes(AUTHOR)` (`policy.ts:30`) роль актора не различает |
| | 72 | пользователь без ролей — false | Б-6 | удалить | `domain/src/user/user/policy.test.ts:59` — пустой массив в `includes` (`policy.ts:30`) — свойство языка, ветки нет |
| | 87 | TEACHER не может создавать пользователей | Б-6 | удалить | `domain/src/user/user/policy.test.ts:83` — та же ветка `isAdmin` = false (`policy.ts:34`) |
| | 99 | пользователь без ролей не может создавать | Б-6 | удалить | `domain/src/user/user/policy.test.ts:83` (`policy.ts:34`) |
| | 106 | любой пользователь может читать любого другого пользователя | Б-13 | отложить: удалить с кодом | — `canRead` (`policy.ts:37`) — `return true` с неиспользуемыми аргументами, потребителей нет (`grep` по `domain`, `modules`, `runners`, `platform`) |
| | 112 | можно читать самого себя | Б-13 | отложить: удалить с кодом | — тот же `canRead` (`policy.ts:37`) |
| | 116 | даже без ролей можно читать | Б-13 | отложить: удалить с кодом | — тот же `canRead` (`policy.ts:37`) |
| | 123 | ADMIN может редактировать любого пользователя | Б-13 | отложить: удалить с кодом | — `canEdit` (`policy.ts:41`) без потребителей: в проде его не зовёт никто, только этот тест |
| | 129 | ADMIN может редактировать себя | Б-13 | отложить: удалить с кодом | — `canEdit` (`policy.ts:41`) |
| | 133 | пользователь может редактировать себя | Б-13 | отложить: удалить с кодом | — `canEdit` (`policy.ts:41`) |
| | 138 | STUDENT не может редактировать другого STUDENT | Б-13 | отложить: удалить с кодом | — `canEdit` (`policy.ts:41`) |
| | 142 | STUDENT не может редактировать ADMIN | Б-13 | отложить: удалить с кодом | — `canEdit` (`policy.ts:41`) |
| | 146 | TEACHER не может редактировать STUDENT | Б-13 | отложить: удалить с кодом | — `canEdit` (`policy.ts:41`) |
| | 150 | TEACHER не может редактировать ADMIN | Б-13 | отложить: удалить с кодом | — `canEdit` (`policy.ts:41`) |
| | 154 | пользователь с несколькими ролями включая ADMIN может редактировать | Б-13 | отложить: удалить с кодом | — `canEdit` (`policy.ts:41`) |
| | 159 | пользователь без ролей не может редактировать другого | Б-13 | отложить: удалить с кодом | — `canEdit` (`policy.ts:41`) |
| | 164 | пользователь без ролей может редактировать себя | Б-13 | отложить: удалить с кодом | — `canEdit` (`policy.ts:41`) |
| | 191 | GUEST НЕ может добавить себе роль ADMIN | Б-6 | удалить | `domain/src/user/user/policy.test.ts:177` (первый ассерт: `guest` → `guest`, роль-аргумент не `STUDENT`) — та же ветка `policy.ts:54`, `ADMIN` и `SUBSCRIBER` код не различает |
| | 199 | STUDENT может добавить себе STUDENT (идемпотентно) | Б-6 | удалить | `domain/src/user/user/policy.test.ts:187` — та же ветка `policy.ts:54`: роль актора в ней не участвует, «себе» уже проверено |
| | 203 | STUDENT НЕ может добавить STUDENT другому | Б-6 | удалить | `domain/src/user/user/policy.test.ts:195` — та же ветка «чужой → отказ» (`policy.ts:53`) |
| | 249 | ADMIN может удалить любую роль, включая у себя | Б-6 | удалить | `domain/src/user/user/policy.test.ts:223` — та же ветка `isAdmin` → true (`policy.ts:62`), «у себя» роли не меняет |
| `domain/src/dossier/categories.test.ts` | 11 | валидные категории проходят | Б-11 | удалить | нигде: три литерала, переписанные из `categories.ts:26-30`; приём `v.picklist` (`categories.ts:33`) — платформа (`testing.md` §3). Положительный контроль схемы маппинга — `domain/src/dossier/categories.test.ts:54` |
| | 21 | неизвестная категория — ошибка | Б-8 | удалить | нигде: отказ `v.picklist` — платформа; отказ по собственной логике схемы — `domain/src/dossier/categories.test.ts:80` |
| | 25 | все допустимые подкатегории проходят | Б-11 | удалить | нигде: те же 10 значений из `categories.ts:4-23`; `v.picklist` их не разбирает, читающего кода нет |
| | 42 | допустимые значения веса проходят | Б-8 | удалить | нигде: `v.union` трёх литералов (`categories.ts:45`) — платформа; положительный контроль веса — `domain/src/dossier/categories.test.ts:54` |
| | 48 | недопустимый вес — ошибка | Б-8 | удалить | нигде: тот же `v.union` литералов (`categories.ts:45`) |
| | 63 | weight обязателен — отсутствие ошибка | Б-8 | удалить | нигде: обязательность поля `v.object` — платформа; `v.variant` по `category` держит `domain/src/dossier/categories.test.ts:80` |
| | 71 | недопустимый вес — ошибка | Б-8 | удалить | нигде: тот же вес в `SkillMappingSchema` (`categories.ts:61`) — `v.union` трёх литералов, платформа; положительный контроль веса — `domain/src/dossier/categories.test.ts:54` |
| | 89 | неизвестная категория — ошибка | Б-8 | удалить | нигде: неизвестная ветка `v.variant` (`categories.ts:57`) — платформа; отказ по собственной логике схемы держит `domain/src/dossier/categories.test.ts:80` |

**Остаются без изменений — 33 теста** (проверены по §4 инвентаризации и правилам уровня):

- `domain/src/user/contract.role.test.ts:7` — значения `Role` против строк в данных
  (`data/fixtures/users/users.json:7` — `"GUEST"`): `tsc` смену значения не видит.
- `domain/src/user/user.module.test.ts:7` — единственный тест состава модуля (UC, `dependsOn`,
  `external`); переписывать нечего — UC и `dependsOn` в нём уже есть.
- `domain/src/user/user/a-root.test.ts:15` (схема совместима с legacy-записью), `:20` (инварианты
  `UserSchema`, приёмник слияния), `:39` (`create` генерирует `uuid`/`createdAt`), `:53` (поля
  `create`), `:75` (`register` → `GUEST`, `uuid`/`createdAt`/`updatedAt`), `:88` (`nick`),
  `:110` (добавление роли), `:116` (дубль не добавляется — опора таблицы `user-app`).
- `domain/src/user/user/policy.test.ts:55` (`isAuthor` allowed), `:59` (denied), `:67`
  (`AUTHOR + MENTOR`), `:79` (`canCreate` allowed), `:83` (denied), `:91` (ADMIN среди нескольких
  ролей), `:171` (`canAddRole` allowed для ADMIN), `:177` (denied: SUBSCRIBER, три актора),
  `:187` (себе STUDENT — allowed), `:195` (чужому — denied), `:209` (MENTOR: STUDENT можно, иное
  нет), `:214` (ADMIN + другая роль), `:223` (`canRemoveRole` allowed), `:231` (denied),
  `:243` (себе STUDENT), `:253` (чужому — denied), `:259` (MENTOR).
- `domain/src/dossier/categories.test.ts:54` (положительный контроль маппинга), `:80`
  (подкатегория чужой категории — единственная собственная логика `v.variant`).
- `domain/src/dossier/scores.test.ts:6` (приём балла), `:15` и `:24` (границы `1..5`), `:33`
  (связь категория↔подкатегория в балле).

---

## 2. Переписать, слить, перенести

**Переписать:** нет. Тест состава модуля (`domain/src/user/user.module.test.ts:7`) уже держит UC и
`dependsOn` — дописывать нечего; таблицы схем (`domain/src/dossier/categories.test.ts:54` + `:80`) уже
разделены на «валидно» и «невалидно», объединение в один `it` сократило бы файл, но не проверки.

**Слить:**

- `domain/src/user/user/a-root.test.ts:26` → `:20`: невалидные входы — одной таблицей приёмника
  (`uuid`, `name`, `telegramId`, `roles`, «всё сразу»); отдельный `it` на «несколько ошибок»
  ничего не добавляет — конструктор бросает на первой же проверке схемы.

**Перенести:** нет. Срез — чистка домена; сценарии, которые стоит удержать, держит владелец на
своём уровне (домен), а поведение UC `getTelegramAddresses` живёт в вызывающих
(`modules/wish/src/wish/er/invite-wishers.er.ts:126`) и в таблице `user-app` — переносить между
уровнями нечего.

---

## 3. Остающиеся проверки `label`

Нет ни одной: в области нет `expect` на `label`/`denyMessage` (`grep "label\|denyMessage"` по
`domain/src/user` и `domain/src/dossier` находит только объявления `label` в исходниках,
`user.module.ts:11`, `entity.ts:40`, `get-telegram-addresses.uc.ts:16`, `user.ar.ts:11`,
`dossier.module.ts:10`). Причина — `UserPolicy` возвращает `boolean`, а не `Decision` с
`denyMessage`; `UserModuleMeta.errors` — `never`, файл `user/user/errors.ts` пуст. Снимать в этом
срезе нечего.

---

## 4. Итог

| действие | объявлений | остаётся кейсов `bun test` |
|---|---|---|
| удалить | 23 | 0 |
| слить (в приёмник) | 1 | 0 (кейс уходит в `a-root.test.ts:20`) |
| переписать | 0 | — |
| перенести | 0 | — |
| отложить: удалить с кодом | 13 | 13 (уходят, когда orchestrator удалит `canRead`/`canEdit`) |
| отложить до `course-dmg` | 0 | — |
| **строк в таблице** | **37** | |

**Ожидаемо после среза: 46 pass, 0 fail в 6 файлах** (было 70 в 7). Уходит файл целиком:
`domain/src/user/user/uc/get-telegram-addresses.uc.test.ts`. По файлам: `contract.role` 1,
`user.module` 1, `a-root` 8, `policy` 30 (17 живых + 13 отложенных), `categories` 2, `scores` 4.
После удаления мёртвых правил (`canRead`/`canEdit`) станет **33**.

**Отложенного до `course-dmg` нет:** в области домена нет тестов бота и нет ничего, что краснеет
из-за TR-57 (все 70 зелёные).

**Пробелы покрытия, которые таблица не закрывает** (тестов не добавляем — решение среза): у
`UserAr.removeRole` («последняя роль → `GUEST`», `a-root.ts:77`), `setRole` (`:86`) и `hasRole`
(`:94`) нет ни одного теста; `addRole` не проверяет `updatedAt` (`:63`); правило «без субъекта —
denied» для `UserPolicy` не проверить — правила принимают готового актора, `undefined` не
допускает тип.

**Кандидатов инвентаризации не вошло в таблицу: 0** — все 32 строки §3 `user-dossier-domain.md`
есть в таблице: 22 `удалить`, 1 `слить` (`a-root.test.ts:26`) и 9 `отложить: удалить с кодом`
(`policy.test.ts:106`, `:112`, `:116`, `:129`, `:142`, `:146`, `:150`, `:159`, `:164`).
Остальные 5 строк таблицы кандидатами не были: `policy.test.ts:123`, `:133`, `:138`, `:154`
(инвентаризация считала их полезными — срез отложил вместе с мёртвым `canEdit`) и
`policy.test.ts:191` (добавлена сверх §3, см. расхождение 1).

**Расхождения с `user-dossier-domain.md`** (в пользу решений среза):

1. `domain/src/user/user/policy.test.ts:191` («GUEST НЕ может добавить себе ADMIN») инвентаризация относила к полезным
   (§4: «роль-аргумент ADMIN запрещена»). Срез удаляет: `policy.ts:54` различает только
   `role === STUDENT`, а отказ для не-`STUDENT` уже проверен первым ассертом `:177`. **Следствие
   для параллельной таблицы:** ссылку `user-app` `modules/user/src/api/user/add-role-to-user-uc.test.ts:113`
   нужно перевести с `domain/src/user/user/policy.test.ts:191` на `policy.test.ts:177` (UC-отказ
   `add-role-to-user-uc.test.ts:101` остаётся). Ответ на вопрос 1 `user-app.md` §5: `a-root.test.ts:116`
   в таблице не удаляется, `domain/src/user/user/policy.test.ts:191` — удаляется.
2. `domain/src/user/user/policy.test.ts:199` и `:203` инвентаризация предлагала «слить» — срез удаляет (решение 5:
   дополнительная роль в неразличаемой ветке, число кейсов должно сократиться).
3. `domain/src/dossier/categories.test.ts:71` и `:89` инвентаризация помечала «сомнителен» и
   предлагала удалить — подтверждено, «нигде» с фразой (платформа) допустимо по решению 2.

**Спорные строки (5).**

1. `domain/src/user/user/policy.test.ts:191` — удаление «GUEST не выдаёт себе ADMIN» экономит один кейс, но это
   единственный видимый тест на эскалацию до `ADMIN`; если нужна наглядность — вернуть (ветка та
   же, покрытие от этого не меняется) и вернуть ссылку `user-app:113` на него.
2. `domain/src/user/user/a-root.test.ts:97` — формат `uuid`/`createdAt` у `register` держит
   `UserSchema` в конструкторе, а не отдельный тест; если решат, что фабрики тестируются отдельно
   от схемы, строка возвращается.
3. `domain/src/dossier/categories.test.ts:42`/`:48` — «нигде» по Б-8: если `SkillWeightSchema`
   сочтут собственной логикой модели данных (`0.75/1/1.25` — не платформенный `F.*`), пара
   возвращается как «валидно/невалидно» веса.
4. `domain/src/user/user/policy.test.ts:106`/`:112`/`:116` и весь блок `canEdit` (`:123`…`:164`) — `отложить: удалить с
   кодом`; пока код жив, это 13 зелёных тестов, после удаления правил — 33 в области.
5. `domain/src/user/user/policy.test.ts:59` и `:83` — оставлены как единственные denied-кейсы правил `isAuthor` и
   `canCreate`; все остальные отказы этих правил (`:63`, `:72`, `:87`, `:99`) удалены как копии
   ветки `policy.ts:30`/`:34`.

**Заметка автору удаления:** вместе с блоком `describe('canRead')`/`describe('canEdit')`
(`domain/src/user/user/policy.test.ts:105`–`:168`) уйдёт и фикстура `anotherStudent` (`domain/src/user/user/policy.test.ts:37`) — других
использований у неё не остаётся; `admin`, `student`, `teacher`, `guest`, `author` нужны
оставшимся тестам.
