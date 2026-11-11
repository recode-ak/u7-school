# Инвентаризация тестов: `modules/stream` (потоки и студенты)

Трек: `tst-cleanup_20261105`. Область: `modules/stream/src/**/*.test.ts` (17 файлов).
Что читал: сами тесты, код модуля (`infra/*`, `stream/uc/*`, `student/uc/*`, `student/job/*`, `stream.module*`),
доменные тесты `domain/src/stream/**` (главный адресат «где покрыто») и тесты платформы
`node_modules/dmg-core/src/app/{use-case,job,uow,facade,module}/**` (что уже гарантирует DMG).

Прогон: `bun test modules/stream/src` → **226 pass, 0 fail**, 17 файлов, 152 ms.
Рабочее дерево не менял (`git status` чистый), код и тесты не правил.

---

## 1. Сводка

| Файл | объявлений | выполняется | полезен | кандидат |
|---|---|---|---|---|
| `infra/stream.json-repo.test.ts` | 13 | 13 | 10 | 3 |
| `infra/student.json-repo.test.ts` | 14 | 14 | 9 | 5 |
| `stream.module.test.ts` | 2 | 2 | 0 | 2 |
| `stream.module.map.test.ts` | 2 | 2 | 0 | 2 |
| `stream/uc/create-stream.uc.test.ts` | 9 | 11 | 4 | 5 |
| `stream/uc/manage-stream.uc.test.ts` | 16 | 39 | 4 | 12 |
| `stream/uc/read-stream.uc.test.ts` | 19 | 23 | 6 | 13 |
| `stream/uc/stream-students.uc.test.ts` | 15 | 16 | 4 | 11 |
| `student/job/inactivity-sweep.job.test.ts` | 11 | 11 | 2 | 9 |
| `student/uc/complete-step.uc.test.ts` | 11 | 12 | 4 | 7 |
| `student/uc/complete-student.uc.test.ts` | 9 | 12 | 3 | 6 |
| `student/uc/drop-student.uc.test.ts` | 6 | 11 | 2 | 4 |
| `student/uc/enroll-student.uc.test.ts` | 22 | 28 | 7 | 15 |
| `student/uc/get-active-student.uc.test.ts` | 5 | 7 | 2 | 3 |
| `student/uc/get-student-by-user.uc.test.ts` | 6 | 6 | 3 | 3 |
| `student/uc/get-student-progress.uc.test.ts` | 7 | 7 | 4 | 3 |
| `student/uc/mark-abandoned.uc.test.ts` | 8 | 12 | 2 | 6 |
| **Итого** | **175** | **226** | **66** (76 выполнений) | **109** (150 выполнений) |

**Оценка.** Модуль — тонкий прикладной слой: UC делают `load`/`fetch`/`execute` и регистрируют
изменения в UoW, вся предметная логика лежит в домене (`StreamAr`, `StudentAr`, DCS/DQS, rules,
Policy), и домен покрыт плотно (`student.ar.test.ts` — 43 объявления, `student-progress.dqs.test.ts` —
29, `step-completion.dcs.test.ts` — 11, `stream.rules/stream.policy/student.rules/student.policy` — 14+11+13+11).
Поэтому основная масса тестов модуля — второй экземпляр уже проверенного правила либо проверка
платформы (`UseCaseFromDef`, `JobFromDef`, `VersionedRepository`, `ModuleMap`).

Сильная сторона файлов модуля — своя ответственность UC: `load` (нет записи → `*_NOT_FOUND`
с payload), `fetch` (зов чужого фасада с нужным входом), `execute` (какой метод агрегата вызван,
что попало в UoW) и по одному сквозному сценарию успеха. Это в инвентаре оставлено.

Предварительный итог чистки: ~62% объявлений (66% выполнений) уходят или сливаются.
Файлы модуля сжимаются до 2–4 тестов на UC (`stream.module*.test.ts` — 0, job — 2), а
`manage-stream.uc.test.ts` (39 выполнений) — до ~8.

---

## 2. Закономерности

### Известные (З1–З8 из `inventory/wish.md`)

| ID | Случаев | Где видно |
|---|---|---|
| З1 — ручной паспорт Def | **0** | В модуле нет ни `normalize`, ни `ArchChecker`: паспорта Def и `serves` живут в домене (`domain/src/stream/**/uc/*.uc-defs.test.ts`), вне области. |
| З2 — схема/парсер платформы | **1** | `stream/uc/create-stream.uc.test.ts:161` — «ввод вне схемы (пустой заголовок) — INPUT_VALIDATION». Схема — в `StreamArDef.state`, уже проверена `domain/src/stream/stream/stream.state.test.ts:98`; сам отказ платформы — `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:130`. Вывод: не проверять схему через UC. |
| З3 — константа/состав контракта | **2** + ~18 ассертов `label` внутри других тестов | `stream.module.map.test.ts:51` (список 17 имён UC), `student/job/inactivity-sweep.job.test.ts:48` (три константы). Плюс почти каждый отказ проверяет `error.label`/`denyMessage` — эти тексты закреплены `domain/src/stream/stream/stream.errors.test.ts:31` и `domain/src/stream/student/student.errors.test.ts:33`, а `denyMessage` — в `stream.policy.test.ts:64`, `student.policy.test.ts:71`. Вывод: тест константы — не защита, а второй экземпляр объявления; падает при любой правке текста и ничего не ловит в коде. |
| З4 — чужой контракт по форме | **0** | Единственный внешний контракт (`CourseModuleDef` в `create-stream`/`enroll-student`) замокан через `StubFacade`, но тесты проверяют своё поведение (что передали, что вернули), а не форму чужого ответа. |
| З5 — правило проверено ниже, копия наверху | **53** | Самая массовая: UC-тест повторяет сценарий Ar/DCS/DQS/rules/Policy. Примеры: `manage-stream.uc.test.ts:204` ↔ `stream.ar.test.ts:180`; `mark-abandoned.uc.test.ts:76` ↔ `student.ar.test.ts:176`; `enroll-student.uc.test.ts:209` ↔ `student.rules.test.ts:138`; `complete-step.uc.test.ts:59` ↔ `step-completion.dcs.test.ts:90`. Вывод (TST-08): сценарий остаётся в тесте владельца правила, у UC — один сквозной успех. |
| З6 — копия соседнего теста с другими данными | **16** | `stream.json-repo.test.ts:289` ↔ `:262` (та же проверка схемы массива); `read-stream.uc.test.ts:137` и `:145` ↔ `:117` (тот же вызов, другой фильтр); `complete-student.uc.test.ts:113` ↔ `mark-abandoned.uc.test.ts:104` ↔ `drop-student.uc.test.ts:91` (одна ветка «чужой поток» в трёх файлах). Вывод: слить в один `it.each` либо оставить один кейс. |
| З7 — тавтология | **0** | Чистых «проверяем значение фикстуры» в модуле нет (единственный близкий случай — З10, вынесен отдельно). |
| З8 — поведение платформы `dmg-core` | **15** | `UNAUTHORIZED`/`allowAll` по `callers` (12 объявлений: `create-stream.uc.test.ts:110`, `manage-stream.uc.test.ts:80`, `read-stream.uc.test.ts:58,62,213`, `complete-step.uc.test.ts:148`, `complete-student.uc.test.ts:135`, `drop-student.uc.test.ts:113`, `enroll-student.uc.test.ts:117`, `get-active-student.uc.test.ts:87`, `get-student-progress.uc.test.ts:102`, `mark-abandoned.uc.test.ts:129`); `VersionConflict` на новом агрегате (`stream.json-repo.test.ts:134`); обход Job с `failed`/логом (`inactivity-sweep.job.test.ts:180`); `serves` по карте (`stream.module.map.test.ts:77`). Всё это закреплено тестами платформы (`use-case-from-def.test.ts:123,179,453`, `repository.test.ts:46`, `job-from-def.test.ts:119`, `module-facade.test.ts:69`) и типом `ModuleMap`, а `callers` каждого UC — тестами паспортов в домене (`domain/src/stream/stream/uc/stream.uc-defs.test.ts:156` и соседние). |

### Новые

#### З9. Тест стаба: проверяется фильтр фикстуры, а не код модуля

**Признак.** Стенд сеет запись с «чужим» полем (`streamId: OTHER_STREAM`, `userId` другого
пользователя), затем ожидается «ничего не произошло». Ветки в тестируемом коде нет: UC передаёт
поле в репозиторий, а фильтрацию делает фейк (и настоящий репозиторий — своим `findByStream`/
`findByUser`). Сломанный UC (передал не то поле) такой тест не поймает: чужие записи просто не
придут в выборку.

**Почему бесполезен.** Настоящая ошибка «фильтр не работает» живёт в `modules/stream/src/infra/*.ts`
и уже проверена там: `student.json-repo.test.ts:266` (`findByStream / findByUser фильтруют по полю`),
`:285` (`findStudying возвращает только active и enrolled`). Тест UC ничего не добавляет, но
создаёт видимость проверки «изоляции данных».

**Примеры.**
- `stream/uc/stream-students.uc.test.ts:78` — «студенты другого потока не затронуты»
- `stream/uc/stream-students.uc.test.ts:145` — «студенты других потоков не блокируют»
- `student/uc/get-student-by-user.uc.test.ts:83` — «записи другого пользователя не возвращаются»
- `student/job/inactivity-sweep.job.test.ts:155` — «терминальные и чужие по статусу записи не обходятся (`findStudying`)»
- `student/uc/enroll-student.uc.test.ts:290` — «записи другого пользователя не учитываются»

**Случаев: 5.** Появляется при переносе: в legacy фильтрация жила в контроллере, при переезде в
репозиторий тест переехал «как был», только фикстура стала другой.
**Что делать:** удалить; изоляцию выборки держать в тестах репозитория (там уже есть).

#### З10. Ожидание посчитано тем же продовым кодом, что проверяется

**Признак.** В тесте `const expected = <вызов продового класса>` и затем
`expect(result.x).toBe(expected.x)`: тест доказывает, что код равен сам себе.

**Почему бесполезен.** Если в `StreamMembersDqs` ошибка в `lagLevel`/`hoursSinceLastActivity`,
обе стороны посчитаются одинаково неверно и тест останется зелёным. Значения этих полей уже
закреплены константами в `domain/src/stream/stream-members.dqs.test.ts:86` (`roster`) и `:109`
(`lagging`).

**Пример.** `student/uc/get-student-progress.uc.test.ts:133` — «lagLevel и hoursSinceLastActivity
совпадают с roster состава потока» (ожидание строится вызовом `StreamMembersDqs` на том же стенде).

**Случаев: 1.** Появляется как «удобный» способ не писать числа в тесте.
**Что делать:** переписать на литералы (`lagLevel: 'lagging'`, `hoursSinceLastActivity: 100`)
или удалить — проверка отставания остаётся в DQS.

#### З11. «Отсутствие побочного эффекта» отдельным `it`

**Признак.** Тело — успешный вызов плюс `expect(env.ctx.published).toEqual([])` /
`expect(env.students.saved).toEqual([])`, иногда без других содержательных ожиданий
(`expectOk(...)` уже покрыт соседним тестом).

**Почему бесполезен.** У команды нет ни одной строки, которая могла бы опубликовать событие:
агрегаты этих операций событий не поднимают, а это закреплено на уровне Ar
(`domain/src/stream/stream/stream.ar.test.ts:149` — «active → completed, событий нет»,
`domain/src/stream/student/student.ar.test.ts:260` — завершение шага, `:118` — выход).
Публикация в шину — работа UoW: упавшая операция вообще не доходит до `register`
(`use-case-from-def.test.ts:224`) — значит пустая шина проверяется платформой.
У запросов (`getStudentByUser`, `getStudentProgress`, `streamStudents`) писать некуда: в `execute`
нет ни `save`, ни `register`.

**Примеры.** `stream/uc/manage-stream.uc.test.ts:102`, `:174`; `stream/uc/stream-students.uc.test.ts:101`, `:222`;
`student/uc/complete-step.uc.test.ts:94`; `student/uc/get-student-by-user.uc.test.ts:91`;
`student/uc/get-student-progress.uc.test.ts:121`.

**Случаев: 7.** Появляется из привычки «на каждый UC — тест на отсутствие событий», после того как
события переехали в Ar.
**Что делать:** удалить; там, где отсутствие записи — часть ветки (например `:73` в
`complete-step` — «повтор завершённого, запись не пишется»), оставить одной строкой внутри
содержательного теста.

#### З12. Один сценарий UC в двух файлах (след исторического переноса)

**Признак.** Один и тот же вызов и одинаковые ожидания встречаются в двух файлах модуля:
команды потока разложены на `manage-stream` и `stream-students`, чтение — на `read-stream` и
`stream.module.test.ts`.

**Почему бесполезен.** Второй экземпляр не добавляет ни входа, ни ветки; при правке правила надо
помнить о двух местах, а падает он или оба сразу, или ни один.

**Примеры (пары).**
- `manage-stream.uc.test.ts:119` ↔ `stream-students.uc.test.ts:84` (нет первого шага)
- `manage-stream.uc.test.ts:156` ↔ `stream-students.uc.test.ts:125` (студентов нет — завершён)
- `manage-stream.uc.test.ts:128` ↔ `stream-students.uc.test.ts:94` (`STREAM_NOT_ENROLLING`)
- `read-stream.uc.test.ts:207` ↔ `stream-students.uc.test.ts:161` (потока нет — `Ok(undefined)`)
- `stream.module.test.ts:33`/`:39` ↔ `read-stream.uc.test.ts:224`/`:234` (`exists`)

**Случаев: 9** (вторая сторона пары в таблице кандидатов).
**Что делать:** оставить по одному месту на сценарий: `manage-stream` — команды, `stream-students` —
`streamStudents`, `stream.module.*` — ничего (см. ниже), `presence` — в `read-stream`.

---

## 3. Кандидаты

Только «сомнителен» и «пуст». Колонка «где покрыто» — конкретный `it` (дальше поддерживать его,
не копию). «×N» — сколько раз выполняется объявление через `it.each`/`describe.each`.

### `infra/stream.json-repo.test.ts`

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:100` | переход статуса сохраняется, версия растёт | З6 | `infra/stream.json-repo.test.ts:82` (round-trip) + `:117` (версия и конфликт) | удалить |
| `:134` | create с занятым uuid — VersionConflict, файл не изменён | З8 | `node_modules/dmg-core/src/app/uow/repository.test.ts:46` + `infra/stream.json-repo.test.ts:117` | удалить (оставить один VersionConflict на репозиторий) |
| `:289` | корень файла не массив — ValiError, файл не изменён | З6 | `infra/stream.json-repo.test.ts:262` (та же проверка схемы записи) | удалить |

### `infra/student.json-repo.test.ts`

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:83` | переход сохраняется, версия растёт | З6 | `infra/student.json-repo.test.ts:64` (round-trip) + `:98` (устаревшая версия) | удалить |
| `:152` | sentAt до минуты и completionDetails читаются | З5 | `domain/src/stream/student/student.state.test.ts:54`, `:89` | слить в `:133` (по одному полю хватит) |
| `:197` | ISO-записи без version и числовые с version читаются целиком, round-trip корректен | З6 | `infra/student.json-repo.test.ts:133` + `:172` | слить в `:172` |
| `:300` | findStudying: учащихся нет — пусто | З6 | `infra/student.json-repo.test.ts:285` | слить в `:285` |
| `:336` | корень файла не массив — ValiError, файл не изменён | З6 | `infra/student.json-repo.test.ts:309` | удалить |

### `stream.module.test.ts`

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:33` | поток есть — exists: true | З12 | `stream/uc/read-stream.uc.test.ts:224` (presence через UC) | удалить файл целиком |
| `:39` | потока нет — exists: false, без ошибки | З12 | `stream/uc/read-stream.uc.test.ts:234` | удалить файл целиком |

### `stream.module.map.test.ts`

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:51` | карта содержит 17 UC (поток и студент) и Job бездействия, ER нет | З3 | тип `ModuleMap` (`node_modules/dmg-core/src/app/module/module-from-def.ts:47`): пропуск, лишний ключ и чужой Def — ошибка компиляции | переписать без списка имён: сравнивать ключи с `StreamModuleDef.useCases`/`.jobs` |
| `:77` | фасад обслуживает все 17 UC | З8 | тот же тип + регистрация `this.useCases.set(uc.def.name, uc)` (`module-from-def.ts:135`); сам `serves` — `node_modules/dmg-core/src/app/facade/module-facade.test.ts:69` | удалить |

### `stream/uc/create-stream.uc.test.ts`

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:91` | без enrollmentKey ключа в записи нет | З5 | `domain/src/stream/stream/stream.ar.test.ts:94` + `stream.state.test.ts:85` | удалить |
| `:97` | публикует `stream.stream.created { streamId, moduleId }` после записи | З5 | `domain/src/stream/stream/stream.ar.test.ts:69` (событие создаётся в `StreamAr.create`) | удалить |
| `:110` | вызывающий guest — UNAUTHORIZED, ничего не записано и не опубликовано | З8 | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` | удалить |
| `:120` ×3 | %s — ACCESS_DENIED «Недостаточно прав для создания потока» | З5 | `domain/src/stream/stream/stream.policy.test.ts:31` + `domain/src/stream/stream/uc/stream.uc-defs.test.ts:35` (Policy `canCreate` в Def) | удалить |
| `:161` | ввод вне схемы (пустой заголовок) — INPUT_VALIDATION, ничего не записано | З2 | `use-case-from-def.test.ts:130` + `domain/src/stream/stream/stream.state.test.ts:98` | удалить |

### `stream/uc/manage-stream.uc.test.ts`

Общий каркас (`describe.each` по трём командам: activate/complete/archive):

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:57` ×3 | ментор потока — Ok | З6 | успех своей команды: `:110`, `:156`, `:182` | удалить |
| `:61` ×3 | админ, не ментор потока — Ok | З5 | `domain/src/stream/stream/stream.policy.test.ts:58` | удалить |
| `:65` ×3 (9 выполнений) | %s — ACCESS_DENIED, статус не меняется | З5 | `stream.policy.test.ts:64`, `:72`, `:78` | удалить |
| `:80` ×3 | вызывающий guest — UNAUTHORIZED | З8 | `use-case-from-def.test.ts:123` | удалить |
| `:102` ×3 | событий в шину нет | З11 | `domain/src/stream/stream/stream.ar.test.ts:149` | удалить |

Команда activate:

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:119` | первого шага нет — поток активен, студенты не тронуты | З12 | `stream/uc/stream-students.uc.test.ts:84` + `domain/src/stream/stream/stream-launch.dcs.test.ts:87` | удалить |
| `:128` ×3 | из %s — STREAM_NOT_ENROLLING, студенты не тронуты, ничего не записано | З5 | `domain/src/stream/stream/stream.ar.test.ts:137` | свести к одному кейсу (сама ветка запуска — в `stream-launch.dcs.test.ts:33`) |
| `:141` | чужой ментор — студенты не тронуты | З6 | `:65` (тот же отказ) | удалить |

Команда complete:

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:162` ×3 | из %s — STREAM_NOT_ACTIVE, ничего не записано | З5 | `domain/src/stream/stream/stream.ar.test.ts:156` | свести к одному кейсу |
| `:174` | `stream.completed` в шину не уходит | З11 | `:102` + `stream.ar.test.ts:149` | удалить |

Команда archive:

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:190` ×2 | из %s — STREAM_NOT_COMPLETED «В архив можно отправить только завершённый поток.» | З5 | `domain/src/stream/stream/stream.ar.test.ts:173` | свести к одному кейсу |
| `:204` | из archived — STREAM_ALREADY_ARCHIVED «Поток уже находится в архиве.» | З5 | `stream.ar.test.ts:180` | удалить |

### `stream/uc/read-stream.uc.test.ts`

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:43` | возвращает поток по streamId (даты — числа) | З5 | `domain/src/stream/stream/stream.ar.test.ts:263` (+ `:82` — успешное чтение с `canManage`) | удалить |
| `:58` | гость читает без ограничений | З8 | `use-case-from-def.test.ts:179` (allowAll) + `domain/src/stream/stream/uc/stream.uc-defs.test.ts:156` (`callers`) | удалить |
| `:62` | вызывающий system не допущен (callers: user, guest) — UNAUTHORIZED | З8 | `use-case-from-def.test.ts:453` + `stream.uc-defs.test.ts:156` | удалить |
| `:94` | кодовое слово не отдаётся: requiresEnrollmentKey вместо enrollmentKey (С1) | З5 | `domain/src/stream/stream/stream.ar.test.ts:251` | удалить |
| `:105` | без ключа requiresEnrollmentKey = false | З5 | `stream.ar.test.ts:257` | удалить |
| `:137` | только schoolId — фильтр `{ schoolId }` | З6 | `:117` (тот же вызов, тот же `findAll`) | слить в `:117` через `it.each` |
| `:145` | без фильтра — все потоки; гость допущен | З6 | `:117` | слить в `:117` |
| `:153` | кодовое слово не отдаётся (list) | З5 | `stream.ar.test.ts:251` + `:94` | удалить |
| `:162` | пусто — пустой список | З6 | `:117` (map по пустому входу) | удалить |
| `:191` | кодовое слово не отдаётся (find) | З5 | `stream.ar.test.ts:251` | удалить |
| `:213` | пользователь и гость тоже читают состав | З8 | `use-case-from-def.test.ts:179` | удалить |
| `:224` | поток есть — exists: true | З12 | пара — `stream.module.test.ts:33` (удаляется) | оставить здесь (это единственное место) |
| `:234` | потока нет — exists: false без ошибки | З12 | пара — `stream.module.test.ts:39` | оставить здесь |

### `stream/uc/stream-students.uc.test.ts`

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:64` | студент с шагами не меняется и не пишется | З5 | `domain/src/stream/stream-launch.dcs.test.ts:59` | удалить |
| `:70` | ушедший без шагов получает первый шаг (статус не учитывается) | З5 | `stream-launch.dcs.test.ts:66` | удалить |
| `:78` | студенты другого потока не затронуты | З9 | `infra/student.json-repo.test.ts:266` (`findByStream`) | удалить |
| `:84` | первого шага нет — поток активен, студенты не меняются | З12 | `stream-launch.dcs.test.ts:87` + `stream/uc/manage-stream.uc.test.ts:119` | удалить |
| `:94` | поток не в наборе — STREAM_NOT_ENROLLING, студенты не тронуты | З12 | `stream-launch.dcs.test.ts:33` + `manage-stream.uc.test.ts:128` | удалить |
| `:101` | событий в шину нет | З11 | `domain/src/stream/stream-launch.dcs.test.ts:27` | удалить |
| `:125` | студентов нет — завершён | З12 | `stream/uc/manage-stream.uc.test.ts:156` | удалить |
| `:130` ×2 | студент %s блокирует: STREAM_STUDENTS_IN_PROGRESS со списком | З5 | `domain/src/stream/stream/stream.rules.test.ts:51`, `:64` | свести к одному кейсу |
| `:145` | студенты других потоков не блокируют | З9 | `infra/student.json-repo.test.ts:266` | удалить |
| `:161` | потока нет — пусто, не ошибка | З12 | `stream/uc/read-stream.uc.test.ts:207` | удалить |
| `:222` | чтение не пишет и не публикует | З11 | `:167` (у запроса нет записи) | удалить |

### `student/job/inactivity-sweep.job.test.ts`

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:48` | константы: WARN=5, REMOVE=7, NOTICE_EVERY=2 | З3 | поведение порогов — `domain/src/stream/student/student.ar.test.ts:445`, `:451`, `:465`; сквозной сценарий расписания — `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts:393` | удалить |
| `:54` | 4 дня — тихо | З5 | `student.ar.test.ts:445` | удалить |
| `:77` | 7 дней впервые: студенту и ментору, wasWarned = false | З5 | `student.ar.test.ts:465` | удалить |
| `:95` | wasWarned = true, если предупреждение уходило раньше | З5 | `student.ar.test.ts:492` | удалить |
| `:131` | повторный прогон в тот же момент ничего не публикует и не пишет | З5 | `student.ar.test.ts:586` (маркер) + `:114` (расписание) | удалить |
| `:145` | дни считаются от последней активности по шагам | З5 | `student.ar.test.ts:548` | удалить |
| `:155` | терминальные и чужие по статусу записи не обходятся (`findStudying`) | З9 | `infra/student.json-repo.test.ts:285` | удалить |
| `:165` | возобновление учёбы сбрасывает цепочку | З5 | `student.ar.test.ts:571` (activate) + `:297` (completeStep) | удалить |
| `:180` | сбой записи одной записи — остальные обработаны, failed: 1, сбой в логе | З8 | `node_modules/dmg-core/src/app/job/job-from-def.test.ts:119` | удалить (изоляцию сбоев держит платформа) |

### `student/uc/complete-step.uc.test.ts`

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:59` | последний шаг потока — level stream, статус студента не меняется | З5 | `domain/src/stream/step-completion.dcs.test.ts:90` | удалить |
| `:86` | сбрасывает notices (возобновление учёбы) | З5 | `domain/src/stream/student/student.ar.test.ts:297` | удалить |
| `:94` | событий в шину нет | З11 | `student.ar.test.ts:260` | удалить |
| `:123` | шага нет в потоке — STUDENT_STEP_NOT_IN_STREAM | З5 | `step-completion.dcs.test.ts:101` | удалить |
| `:131` | шаг не выдан студенту — STUDENT_STEP_NOT_ISSUED | З5 | `step-completion.dcs.test.ts:111` | удалить |
| `:139` ×2 | %s — ACCESS_DENIED, запись не меняется | З5 | `domain/src/stream/student/student.policy.test.ts:38` | удалить |
| `:148` | вызывающий guest — UNAUTHORIZED | З8 | `use-case-from-def.test.ts:123` | удалить |

### `student/uc/complete-student.uc.test.ts`

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:69` | смена исхода: advanced ↔ not_advanced разрешена | З5 | `domain/src/stream/student/student.ar.test.ts:187` | удалить |
| `:75` | админ, не ментор потока — Ok | З5 | `domain/src/stream/student/student.policy.test.ts:67` | удалить |
| `:79` ×2 | студент в статусе %s — STUDENT_NOT_COMPLETABLE «Нельзя завершить студента: он не учится.» | З5 | `student.ar.test.ts:215` | удалить |
| `:113` | студент из другого потока (не streamId входа) — STUDENT_NOT_FOUND (Т8) | З6 | `student/uc/mark-abandoned.uc.test.ts:104` (одна ветка на три файла) + `student.ar.test.ts:308` (`belongsToStream`) | одна проверка на модуль |
| `:121` ×2 | %s — ACCESS_DENIED «Недостаточно прав для завершения студента» | З5 | `student.policy.test.ts:67`, `:71`, `:77` | удалить |
| `:135` | вызывающий guest — UNAUTHORIZED | З8 | `use-case-from-def.test.ts:123` | удалить |

### `student/uc/drop-student.uc.test.ts`

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:67` ×3 | из %s — STUDENT_NOT_STUDYING «Нельзя снять студента с учёбы: он уже не учится.» | З5 | `domain/src/stream/student/student.ar.test.ts:140` | удалить |
| `:91` | студент из другого потока (не streamId входа) — STUDENT_NOT_FOUND (Т8) | З6 | `student/uc/mark-abandoned.uc.test.ts:104` | одна проверка на модуль |
| `:98` ×3 | %s — ACCESS_DENIED «Вы не можете выйти из чужого потока» | З5 | `student.policy.test.ts:38`, `:50` | удалить |
| `:113` | вызывающий guest — UNAUTHORIZED | З8 | `use-case-from-def.test.ts:123` | удалить |

### `student/uc/enroll-student.uc.test.ts`

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:81` ×4 | статус потока %s зачислению не мешает (как в legacy) | З6 | UC статус потока не читает; четыре кейса идентичны | оставить один кейс (сторож «не начал проверять статус») |
| `:89` | верное кодовое слово — Ok | З5 | `domain/src/stream/student/student.rules.test.ts:65` | удалить |
| `:94` | ушедшие и завершённые записи не мешают | З5 | `student.rules.test.ts:96` | удалить |
| `:117` | вызывающий guest — UNAUTHORIZED | З8 | `use-case-from-def.test.ts:123` | удалить |
| `:131` ×3 | ключ задан, введено %p — STUDENT_WRONG_ENROLLMENT_KEY «Неверное кодовое слово» | З5 | `student.rules.test.ts:75` | удалить |
| `:145` ×2 | живая запись %s в другом потоке — STUDENT_ALREADY_STUDYING | З5 | `student.rules.test.ts:108` | удалить |
| `:159` | живая запись в этом же потоке — тоже STUDENT_ALREADY_STUDYING | З5 | `student.rules.test.ts:122` | удалить |
| `:164` | в потоке нет шагов — STUDENT_NO_STEPS | З5 | `student.rules.test.ts:171` | удалить |
| `:204` | admitted (курса нет или модуль входной) — Ok | З5 | `student.rules.test.ts:134` | удалить |
| `:209` | closed — STUDENT_PREREQUISITE_NOT_PASSED с «предыдущий» | З5 | `student.rules.test.ts:138` | слить с `:215` |
| `:215` | previous-not-passed — отказ с названием модуля из вердикта | З5 | `student.rules.test.ts:149` | оставить один из `:209`/`:215` |
| `:248` | not_advanced не «прошёл» — passedModuleIds пуст, отказ | З5 | `domain/src/stream/passed-modules.dqs.test.ts:39` | удалить |
| `:265` | прошёл другой модуль — в passedModuleIds только он | З5 | `passed-modules.dqs.test.ts:60` | удалить |
| `:282` | записей нет — passedModuleIds пуст, отказ | З5 | `passed-modules.dqs.test.ts:69` | удалить |
| `:290` | записи другого пользователя не учитываются | З9 | `infra/student.json-repo.test.ts:266` (`findByUser`) | удалить |

### `student/uc/get-active-student.uc.test.ts`

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:66` | поток без кодового слова в виде: только requiresEnrollmentKey | З5 | `domain/src/stream/stream/stream.ar.test.ts:251` | удалить |
| `:76` ×2 | %s — пустой ответ, без ошибки | З6 | кейс «только терминальные» — `:57` | оставить один кейс («записей нет») |
| `:87` | доступен гостю (allowAll): ответ тот же | З8 | `use-case-from-def.test.ts:179` | удалить |

### `student/uc/get-student-by-user.uc.test.ts`

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:61` | вид без notices, с исходом и признаками | З5 | `domain/src/stream/student/student.ar.test.ts:421` (+ `:397`) | удалить |
| `:83` | записи другого пользователя не возвращаются | З9 | `infra/student.json-repo.test.ts:266` | удалить |
| `:91` | событий и записи нет | З11 | `:34`/`:49` (запрос ничего не пишет) | удалить |

### `student/uc/get-student-progress.uc.test.ts`

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:102` | прогресс виден любому: чужой студент, ментор, гость | З8 | `use-case-from-def.test.ts:179` | удалить |
| `:121` | чтение не пишет и не публикует | З11 | `:53` | удалить |
| `:133` | lagLevel и hoursSinceLastActivity совпадают с roster состава потока | З10 | `domain/src/stream/stream-members.dqs.test.ts:86`, `:109` | переписать на литералы (или удалить) |

### `student/uc/mark-abandoned.uc.test.ts`

| Путь:строка | Тест | Закономерность | Где покрыто | Что делать |
|---|---|---|---|---|
| `:66` | enrolled тоже снимается | З5 | `domain/src/stream/student/student.ar.test.ts:152` | удалить |
| `:72` | админ, не ментор потока — Ok | З5 | `student.policy.test.ts:67` | удалить |
| `:76` ×3 | студент в статусе %s — STUDENT_NOT_STUDYING | З5 | `student.ar.test.ts:176` | удалить |
| `:104` | студент из другого потока — STUDENT_NOT_FOUND (Т8) | З6 | `student/uc/complete-student.uc.test.ts:113` | одна проверка на модуль |
| `:115` ×2 | %s — ACCESS_DENIED «Недостаточно прав для снятия студента с учёбы» | З5 | `student.policy.test.ts:71`, `:77` | удалить |
| `:129` | вызывающий guest — UNAUTHORIZED | З8 | `use-case-from-def.test.ts:123` | удалить |

---

## 4. Полезные тесты — что в файлах остаётся

- `infra/stream.json-repo.test.ts` — round-trip состояния, «нет записи — `undefined`, файл не создаётся», устаревшая версия, чтение legacy ISO через схему, перезапись файла с сохранением соседей, `findAll` по `schoolId`/`status`/`mentorId`, `findByTelegramGroup`, битая запись и битый JSON. Это контракт собственного репозитория (схема + версия + запись файла), платформа его не покрывает.
- `infra/student.json-repo.test.ts` — то же плюс ISO→числа для `enrolledAt` и шагов, `findByStream`/`findByUser`, `findStudying`.
- `stream/uc/create-stream.uc.test.ts` — успех (`enrollment`, `mentorId` из субъекта, `schoolId`, снимок), что вход фасада курса несёт `moduleId` от имени операции, копирование необязательных полей, `MODULE_NOT_FOUND` как есть.
- `stream/uc/manage-stream.uc.test.ts` — по одному успеху на команду (`:110` activate, `:156` complete без студентов, `:182` archive) и `STREAM_NOT_FOUND` (`:88`).
- `stream/uc/read-stream.uc.test.ts` — `STREAM_NOT_FOUND` (`:70`), `canManage` по пяти вызывающим (`:82` — единственное место, где видна склейка Policy → view), фильтр как есть (`:117`), `findStreamByTelegramGroup` найдено/не найдено (`:172`, `:183`), состав (`:207`), `presence` (`:224`, `:234`).
- `stream/uc/stream-students.uc.test.ts` — успех запуска с сохранением потока и студентов (`:46`), завершение, когда все с исходом (`:114`), ответ ментора с фактами без `settled` (`:167`), `roster` на момент `this.now()` (`:194`).
- `student/job/inactivity-sweep.job.test.ts` — предупреждение на 5-й день через Job с записью маркера (`:61`) и расписание 5/7/9 (`:114`): единственные места, где работа Job видна целиком (порог из Ar + `register` + публикация).
- `student/uc/complete-step.uc.test.ts` — успех с записью (`:45`), `already_completed` без записи (`:73` — единственная ветка «не регистрировать»), `STUDENT_NOT_FOUND` (`:99`), `STREAM_NOT_FOUND` (`:116`).
- `student/uc/complete-student.uc.test.ts` — исход с `moduleId` из потока в событии (`:45`), `STUDENT_NOT_FOUND` (`:90`), `STREAM_NOT_FOUND` (`:106`).
- `student/uc/drop-student.uc.test.ts` — переход `enrolled`/`active` → `abandoned` с деталями и событием (`:41`), `STUDENT_NOT_FOUND` (`:80`).
- `student/uc/enroll-student.uc.test.ts` — создание записи с `currentStepId` первого шага (`:48`), событие `enrolled` с `moduleId` потока (`:62`), вход фасада курса `moduleId` + `passedModuleIds` (`:73`), чужой `userId` во входе игнорируется (`:102`, С3), `STREAM_NOT_FOUND` (`:123`), порядок правил (`:170` — проверяет поведение, а не текст), сквозной `advanced` в потоке предыдущего модуля (`:232`).
- `student/uc/get-active-student.uc.test.ts` — живая запись `enrolled`/`active` через UC (`:41`), первая живая при терминальных раньше (`:57`).
- `student/uc/get-student-by-user.uc.test.ts` — живая запись даже при терминальной раньше (`:34`), первая терминальная, если живой нет (`:49`), `STUDENT_NOT_FOUND` (`:77`).
- `student/uc/get-student-progress.uc.test.ts` — сборка ответа «студент + прогресс по снимку» (`:53`), `step`/`lesson` только при переданных id (`:75`), нет потока — нет `progress` (`:91`), `STUDENT_NOT_FOUND` (`:108`).
- `student/uc/mark-abandoned.uc.test.ts` — обе причины со деталями и событием (`:44`), `STUDENT_NOT_FOUND` и `STREAM_NOT_FOUND` (`:85`).

---

## 5. Что проверить перед удалением

1. **Домен не переписывается параллельно.** Почти все кандидаты З5 опираются на доменные тесты; если в
   том же треке домен правится, сначала перенести сценарий в тест владельца, потом удалять копию.
2. **`manage-stream`/`stream-students` — один прогон после слияния пар** (З12): после удаления
   второй стороны должен остаться хотя бы один тест на `activate` без первого шага и на
   `complete` без студентов.
3. **Job после чистки:** остаются `:61`, `:114` — не удалять оба, иначе у Job не будет ни одного
   сквозного сценария (порог → регистрация → публикация).
4. **`presence` живёт только в `read-stream`** после удаления `stream.module.test.ts`; `serves`/карта —
   в типах и `stream.module.map.test.ts` (переписанном без списка имён).
5. Число выполнений модуля после чистки по оценке ≈ 76 (при 226 сейчас): уменьшение защиты
   ожидаемо только там, где сценарий уже есть в домене, — прогонять `bun run check` целиком,
   а не только каталог модуля (состав модуля закрепляют и тесты вне него).
