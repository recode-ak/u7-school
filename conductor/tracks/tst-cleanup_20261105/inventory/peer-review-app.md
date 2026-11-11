# Инвентаризация тестов: прикладной слой `peer-review`

Трек `tst-cleanup_20261105`, фаза 2. Основание — закономерности [`test-bloat.md` §2](../../../roadmap/test-bloat.md) (Б-1…Б-14), правила `node_modules/dmg-core/docs/reference/testing.md` §3, §5, §5.1 (TST-08, TST-09), [`bot-test.md` §2 п. 5](../../../../architecture/ui/bot-test.md), решения трека [`spec.md`](../spec.md) «Решения»; уровень оценок — принятая таблица [`questionnaire-app-delete.md`](./questionnaire-app-delete.md).

Область — `modules/peer-review/src/**/*.test.ts` (11 файлов). База: `cd modules/peer-review && bun test` → **141 pass, 0 fail** (проверено в worktree `tst-cleanup`; фикстуры `data/fixtures/peer-review` читаются, seed не запускался).

Домен (`domain/src/peer-review/**`) в эту инвентаризацию не входит и разбирается параллельно; ссылки на доменные тесты приводятся только как «где покрыто» и помечены префиксом `domain/`. Ссылки на платформу — `node_modules/dmg-core/src` и помечены `dmg-core`.

Что важно для чтения таблицы: **правила (`windowOpen`, `recipientAllowed`, `validText`) и Policy исполняет платформа** до `execute` (`node_modules/dmg-core/src/app/use-case/use-case-from-def.ts:150-165`, тесты — `use-case-from-def.test.ts:621` «Policy отказала → правила не вызваны», `:627` «правило отказало → его ошибка, execute не вызван»). Поэтому UC-код модуля содержит только: `load` (кампания/отзыв, субъект), выбор ветки `create`/`overwrite`, `uow.register`, форму ответа. Всё остальное в UC-тестах — повтор правил нижних уровней (Б-1) или платформы (Б-9).

---

## 1. Сводка

| файл | всего | полезен | сомнителен | пуст |
|---|---|---|---|---|
| `modules/peer-review/src/infra/review.json-repo.test.ts` | 33 | 14 | 19 | 0 |
| `modules/peer-review/src/infra/review-campaign.json-repo.test.ts` | 20 | 11 | 9 | 0 |
| `modules/peer-review/src/review-campaign/uc/get-campaign-recipients.uc.test.ts` | 7 | 4 | 3 | 0 |
| `modules/peer-review/src/review-campaign/uc/get-my-campaigns.uc.test.ts` | 9 | 5 | 3 | 1 |
| `modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts` | 13 | 8 | 5 | 0 |
| `modules/peer-review/src/review/uc/create-review.uc.test.ts` | 26 | 5 | 21 | 0 |
| `modules/peer-review/src/review/uc/get-my-review.uc.test.ts` | 4 | 3 | 1 | 0 |
| `modules/peer-review/src/review/uc/list-my-reviews.uc.test.ts` | 11 | 5 | 4 | 2 |
| `modules/peer-review/src/review/uc/list-scope-facts.uc.test.ts` | 3 | 3 | 0 | 0 |
| `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts` | 10 | 2 | 6 | 2 |
| `modules/peer-review/src/peer-review.module.test.ts` | 5 | 2 | 2 | 1 |
| **итого** | **141** | **62** | **73** | **6** |

Кандидатов — **79 выполнений** (71 объявление: `it.each` разворачивается в 4 и 2 строки в `create-review.uc.test.ts:217`, `:241`, `test.each` — в 5 строк в `review.json-repo.test.ts:162`), это 56% области — верхняя граница диапазона 31–62%, как в `questionnaire`.

---

## 2. Закономерности

### Б-1 — правило проверено уровнем ниже и повторено выше (36 случаев)

Основная масса: UC-тесты повторяют доменные правила/Ar/Policy/DQS. Признак из `test-blob.md` совпал буквально — «`it` UC без загрузки, Policy, своей ошибки, записи в UoW».

Примеры:
- `modules/peer-review/src/review/uc/create-review.uc.test.ts:217` — `it.each` четырёх отказов `recipientAllowed` — дословный повтор `domain/src/peer-review/review/review.rules.test.ts:73` (те же 4 пары, тот же `payload`).
- `modules/peer-review/src/review/uc/create-review.uc.test.ts:206` — граница окна (`expiresAt` нельзя, `-1 мс` можно) — `domain/src/peer-review/review/review.rules.test.ts:37` и `:42`.
- `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:93` — группировка по адресатам со снимками ролей и исходов — `domain/src/peer-review/review/scope-reviews.dqs.test.ts:34` (там же порядок групп и снимок без `authorOutcome`).
- `modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts:168` — `participants = [LIVE, DONE]` — `domain/src/peer-review/review-campaign/student-fate.dqs.test.ts:51` (тот же состав и порядок).
- `modules/peer-review/src/review-campaign/uc/get-my-campaigns.uc.test.ts:68` — ментор видит кампанию со своей ролью — `:145` того же файла (субъект и ментор вместе) + `domain/.../campaign-facts.dqs.test.ts:43`.

### Б-6 — копия соседнего теста без нового класса входа (17 случаев)

Признак по файлам: «новое поле/легаси-запись — отдельным `it`» и «строка таблицы — отдельным `test`».

Примеры:
- `modules/peer-review/src/infra/review.json-repo.test.ts:335`, `:343`, `:352` — три теста на тот же путь `v.parse(Rows, …)` в `review.json-repo.ts:115`: «текст короче 10», «невалидный JSON», «корень не массив». Класс входа один — сбой разбора; содержимое разное.
- `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:223` (legacy-запись после save соседней) ↔ `:351` (save поверх копии фикстуры не теряет существующие) — одна и та же проверка `write()` на другом наборе данных.
- `modules/peer-review/src/peer-review.module.test.ts:198` — тело дословно равно `:103` (тот же `toEqual` двух списков `peerReviewMap`), нового класса входа нет.

### Б-7 — ручной паспорт Def / паспорт состава (5 случаев)

Признаки: `Object.keys(peerReviewMap…)`, `expect(error.label)`, «список UC и ER».

Примеры:
- `modules/peer-review/src/peer-review.module.test.ts:103` и `:198` — состав модуля руками (`7 UC`, `1 ER`, `external` пусто) — дубль `domain/src/peer-review/peer-review.module.test.ts:8` (там же `dependsOn`).
- `modules/peer-review/src/review/uc/create-review.uc.test.ts:291`, `:298`, `:305` — порядок правил `окно → адресат → текст` — паспорт `CreateReviewUcDef.rules` в `domain/src/peer-review/review/uc/create-review.uc.test.ts:34`.
- `modules/peer-review/src/review-campaign/uc/get-campaign-recipients.uc.test.ts:137` — проверяет `kind` и `label` ошибки (`«Кампания отзывов не найдена»`): паспорт ошибки + TST-09 (тексты не тестируются).

### Б-8 — схема платформы (5 случаев)

Легаси-ISO → число, `updatedAt`/`version`, допустимый `participants: []` — это `ReviewArDef.state` / `ReviewCampaignArDef.state`, не код репозитория (`review.json-repo.ts:115` — единственная строка `v.parse`).

Примеры:
- `modules/peer-review/src/infra/review.json-repo.test.ts:241` — дословно `domain/src/peer-review/review/review.state.test.ts:58`.
- `modules/peer-review/src/infra/review.json-repo.test.ts:250` — `review.state.test.ts:67`; `:258` — `review.state.test.ts:75`.
- `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:212` — `participants: []` — `domain/src/peer-review/review-campaign/review-campaign.state.test.ts:63`.

### Б-9 — поведение платформы (8 случаев)

Признаки: `VersionConflict`, «параллельные записи», `UNAUTHORIZED`, «Policy раньше правил».

Примеры:
- `modules/peer-review/src/infra/review.json-repo.test.ts:210` — «create с занятым uuid — VersionConflict» — `dmg-core/src/app/uow/repository.test.ts:46`; `:222` — `:56`; `:230` (замок при параллельных `save`) — `:91` «save по одному: чтение → сверка → запись не перемежаются».
- `modules/peer-review/src/review-campaign/uc/get-my-campaigns.uc.test.ts:178` — guest → `UNAUTHORIZED` — `dmg-core/src/app/use-case/use-case-from-def.test.ts:123`.
- `modules/peer-review/src/review/uc/create-review.uc.test.ts:273` — «посторонний при истёкшем окне — ACCESS_DENIED, а не WINDOW_CLOSED» — порядок «Policy раньше правил» держит платформа, `use-case-from-def.test.ts:621`.

### Б-12 — пустой вход → пустой результат (6 случаев)

Примеры:
- `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:48` (пустой скоуп), `:55` (`scopeIds: []`), `:209` (фильтр без совпадений: `groupByRecipient([])` после фильтра).
- `modules/peer-review/src/review/uc/list-my-reviews.uc.test.ts:62` — «отзывов нет — пустой список» (`map` по пустому массиву).
- `modules/peer-review/src/infra/review.json-repo.test.ts:152` (строка `expect(await repo.findByScopes([])).toEqual([])`), `:190` (`findByRecipient(IDS.carol)` → `[]`) — пустые плечи внутри полезных контрактных тестов.

### Н1 — тест входного параметра, который реализация не читает

**Признак.** Имя теста и вход UC содержат опцию, которой в `execute` нет; оба плеча теста дают одинаковый результат и проверяют одно и то же.

**Почему бесполезен.** Тест не может упасть от изменения поведения — он не различает ветки; при этом маскирует мёртвый вход контракта (Б-13 — родственник, но там мёртвый *экспорт*, здесь — мёртвое *поле входа*).

**Случай:** `modules/peer-review/src/review-campaign/uc/get-my-campaigns.uc.test.ts:103` — «onlyLives отсекает истекшие окна; без флага истекшие не возвращаются репозиторием». `execute` читает только `{ filter }` (`get-my-campaigns.uc.ts:35`); `onlyLives` объявлен в Def (`domain/src/peer-review/review-campaign/uc/get-my-campaigns.uc.ts:49`) и не читается нигде в модуле. Оба `expect` в тесте проходят при любом значении флага — второе плечо дословно проверяет то же, что первое.

**Что делать.** Тест — в кандидаты; сам мёртвый `onlyLives` — в открытые вопросы (правка контракта домена вне границ среза).

### Н2 — имя теста шире проверки

**Признак.** В имени заявлены две ветки/события, в теле проверяется одна; поломка второй ветки тест не роняет.

**Почему бесполезен.** Тест читается как защита обеих веток и отменяет необходимость писать тест на вторую; фактически вторая не покрыта, а имя создаёт ложное ощущение покрытия (в отличие от Б-6, где имя честное, а вход дублирующий).

**Случай:** `modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts:279` — «реагирует на student.completed и student.abandoned из шины», а публикуется только `completed()` (строка `:291`), `abandoned()` в теле не вызывается.

**Что делать.** Либо переписать (проверить оба события), либо убрать как дубль `modules/peer-review/src/peer-review.module.test.ts:123` (вертикаль через `module.subscribe()` и шину).

---

## 3. Кандидаты

Действия: `удалить` / `слить в <файл>:<строка>` / `переписать` / `перенести`. Ссылка «где покрыто» ведёт на конкретный `it`/`test`, который сам в этой таблице не значится. `нигде` — с причиной.

| путь:строка | имя теста | Б-ID | где покрыто | что делать |
|---|---|---|---|---|
| `modules/peer-review/src/infra/review.json-repo.test.ts:152` | по списку скоупов без фильтра | Б-12 | `modules/peer-review/src/infra/review.json-repo.test.ts:183` (та же выборка `findByScopes` с фильтром по И: пустая выдача там не «по построению», а результат фильтра) | переписать: убрать `expect(await repo.findByScopes([])).toEqual([])` (`:159`), оставить проверку списка скоупов |
| `modules/peer-review/src/infra/review.json-repo.test.ts:162` | фильтр %s (×5: direction, recipientId, campaignId, три условия, пустой фильтр) | Б-6 | `modules/peer-review/src/infra/review.json-repo.test.ts:183` (условия фильтра по И на `findByScopes`) | переписать: убрать строку «пустой фильтр» (параметр, который не сужает) |
| `modules/peer-review/src/infra/review.json-repo.test.ts:190` | findByRecipient без фильтра: все отзывы адресату, где бы он ни был адресатом | Б-12 | `modules/peer-review/src/infra/review.json-repo.test.ts:196` (та же выборка с фильтрами, включая «чужой recipientId — пусто (И)») | переписать: убрать `findByRecipient(IDS.carol)` (`:193`) |
| `modules/peer-review/src/infra/review.json-repo.test.ts:210` | create с занятым uuid — VersionConflict, файл не изменён | Б-9 | `dmg-core/src/app/uow/repository.test.ts:46` (новый агрегат при существующей записи → `VersionConflict`); проводка `stored()` модуля — `modules/peer-review/src/infra/review.json-repo.test.ts:79` (второй `save` сверяет версию) | удалить |
| `modules/peer-review/src/infra/review.json-repo.test.ts:222` | восстановленный агрегат, записи нет — VersionConflict, файл не создан | Б-9 | `dmg-core/src/app/uow/repository.test.ts:56` (восстановленный без записи → `VersionConflict`; «не записан» — `:81`) | удалить |
| `modules/peer-review/src/infra/review.json-repo.test.ts:230` | параллельные записи разных пар не теряют друг друга | Б-9 | `dmg-core/src/app/uow/repository.test.ts:91` (замок `save`: чтение → сверка → запись не перемежаются) | удалить |
| `modules/peer-review/src/infra/review.json-repo.test.ts:241` | ISO без зоны → число UTC, updatedAt = createdAt, version = 0 | Б-8 | `domain/src/peer-review/review/review.state.test.ts:58` (та же схема, тот же legacy-вход); проводка схемы в репозиторий — `modules/peer-review/src/infra/review.json-repo.test.ts:383` | удалить |
| `modules/peer-review/src/infra/review.json-repo.test.ts:250` | updatedAt из записи (ISO) читается числом | Б-8 | `domain/src/peer-review/review/review.state.test.ts:67` | удалить |
| `modules/peer-review/src/infra/review.json-repo.test.ts:258` | запись ментора без authorOutcome читается | Б-8 | `domain/src/peer-review/review/review.state.test.ts:75` | удалить |
| `modules/peer-review/src/infra/review.json-repo.test.ts:270` | legacy читается после save соседней; файл переписан в новом формате | Б-6 | `modules/peer-review/src/infra/review.json-repo.test.ts:394` (save новой записи поверх набора не теряет существующие) + `:383` (legacy-запись читается схемой) | удалить |
| `modules/peer-review/src/infra/review.json-repo.test.ts:286` | повторный save legacy-записи без изменений: version 0, запись одна | Б-6 | `modules/peer-review/src/infra/review.json-repo.test.ts:79` (повторный `save` того же uuid: дубля нет) + `:383` (version 0 у legacy) | удалить |
| `modules/peer-review/src/infra/review.json-repo.test.ts:298` | legacy-перезапись: version 1, uuid и createdAt прежние | Б-6 | `modules/peer-review/src/infra/review.json-repo.test.ts:79` (перезапись: `version` 1, `updatedAt` сдвинут, дубля нет) + `:383` | удалить |
| `modules/peer-review/src/infra/review.json-repo.test.ts:335` | текст короче 10 символов в файле — ValiError | Б-6 | `modules/peer-review/src/infra/review.json-repo.test.ts:320` (сбой разбора строки → `ValiError` на чтении и записи, файл не изменён — тот же путь `rows()`) | удалить |
| `modules/peer-review/src/infra/review.json-repo.test.ts:343` | невалидный JSON — исключение, файл не изменён | Б-6 | `modules/peer-review/src/infra/review.json-repo.test.ts:320` (тот же путь `v.parse(Rows, await file.json())`, «файл не перезаписан при сбое чтения») | удалить |
| `modules/peer-review/src/infra/review.json-repo.test.ts:352` | корень файла не массив — ValiError, файл не изменён | Б-6 | `modules/peer-review/src/infra/review.json-repo.test.ts:320` | удалить |
| `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:167` | create с занятым uuid — VersionConflict, запись не изменена | Б-9 | `dmg-core/src/app/uow/repository.test.ts:46`; проводка `stored()` — `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:241` (повторный `save` сверяет версию) | удалить |
| `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:180` | восстановленный агрегат, записи нет — VersionConflict, файл не создан | Б-9 | `dmg-core/src/app/uow/repository.test.ts:56` | удалить |
| `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:188` | параллельные записи разных кампаний не теряют друг друга | Б-9 | `dmg-core/src/app/uow/repository.test.ts:91` | удалить |
| `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:200` | ISO без зоны → число UTC, updatedAt = createdAt, version = 0 | Б-8 | `domain/src/peer-review/review-campaign/review-campaign.state.test.ts:33` (та же схема, тот же legacy-вход); проводка — `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:338` | удалить |
| `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:212` | participants: [] читается | Б-8 | `domain/src/peer-review/review-campaign/review-campaign.state.test.ts:63` | удалить |
| `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:223` | legacy-запись читается после save соседней (файл переписан в новом формате) | Б-6 | `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:351` (save поверх набора не теряет существующие) + `:338` (legacy в схеме) | удалить |
| `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:257` | legacy-окно (ISO без зоны = UTC): граница expiresAt включительно | Б-6 | `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:147` (граница «активна» по `at` включительно) + `domain/src/peer-review/review-campaign/review-campaign.state.test.ts:33` (ISO → UTC) | удалить |
| `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:292` | невалидный JSON — исключение, файл не изменён | Б-6 | `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:271` (сбой разбора: `ValiError` на чтении и записи, файл не изменён) | удалить |
| `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:303` | корень файла не массив — ValiError, файл не изменён | Б-6 | `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:271` | удалить |
| `modules/peer-review/src/review-campaign/uc/get-campaign-recipients.uc.test.ts:73` | ментор: единственный адресат — субъект; subjectOutcome — исход подопечного | Б-1 | `modules/peer-review/src/review-campaign/uc/get-campaign-recipients.uc.test.ts:47` (та же сборка ответа: роль, `subjectOutcome`, адресаты через DQS) + `domain/src/peer-review/review-campaign/campaign-facts.dqs.test.ts:72` (у ментора единственный адресат — субъект) | удалить |
| `modules/peer-review/src/review-campaign/uc/get-campaign-recipients.uc.test.ts:86` | субъект dropped (пустой participants): только ментор, исход dropped | Б-1 | `domain/src/peer-review/review-campaign/review-campaign.ar.test.ts:232` (`targetIdsFor` при пустом `participants` — только ментор) | удалить |
| `modules/peer-review/src/review-campaign/uc/get-campaign-recipients.uc.test.ts:137` | кампания не найдена — REVIEW_CAMPAIGN_NOT_FOUND «Кампания отзывов не найдена» | Б-7 | — (оставить `expectErr(res, 'REVIEW_CAMPAIGN_NOT_FOUND')` и `payload` как единственную проверку своего `load`; `kind` — паспорт ошибки, `label` — TST-09) | переписать |
| `modules/peer-review/src/review-campaign/uc/get-my-campaigns.uc.test.ts:68` | ментор видит кампанию субъекта со своей ролью | Б-1 | `modules/peer-review/src/review-campaign/uc/get-my-campaigns.uc.test.ts:145` (субъектная и менторская кампании одного пользователя — роли, порядок) | удалить |
| `modules/peer-review/src/review-campaign/uc/get-my-campaigns.uc.test.ts:77` | соученик (участник) и посторонний кампаний не видят | Б-1 | `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:107` (`findActiveBySubject` не отдаёт кампании, где пользователь — ментор/сквозной сосед) + `:127` и `modules/peer-review/src/review-campaign/uc/get-my-campaigns.uc.test.ts:49` (выборка только своя) | удалить |
| `modules/peer-review/src/review-campaign/uc/get-my-campaigns.uc.test.ts:103` | onlyLives отсекает истекшие окна; без флага истекшие не возвращаются репозиторием как активные | Н1 | `modules/peer-review/src/review-campaign/uc/get-my-campaigns.uc.test.ts:163` (граница окна: ровно в `expiresAt` кампания не активна) + `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:107` (истёкшая не возвращается) | удалить |
| `modules/peer-review/src/review-campaign/uc/get-my-campaigns.uc.test.ts:178` | вызывающий guest — UNAUTHORIZED | Б-9 | `dmg-core/src/app/use-case/use-case-from-def.test.ts:123` (вид вызывающего не в `callers` → `UNAUTHORIZED`) | удалить |
| `modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts:148` | student.abandoned → кампания создаётся так же | Б-1 | `modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts:180` (abandoned-ветка: кампания создаётся, исход из `StudentFateDqs`) | удалить |
| `modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts:154` | payload: mentorId из состава, исход — 4-значная проекция | Б-1 | `modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts:197` (payload события: `mentorId`, `subjectOutcome` — та же проводка) + `domain/src/peer-review/review-campaign/student-fate.dqs.test.ts:36` (проекция исхода) | удалить |
| `modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts:168` | participants при «завершил»: завершившиеся и ещё учащиеся, без субъекта и abandoned | Б-1 | `domain/src/peer-review/review-campaign/student-fate.dqs.test.ts:51` (тот же состав `[LIVE, DONE]` и порядок, без субъекта и `abandoned`) | удалить |
| `modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts:173` | «забросил»: пустой participants, исход dropped | Б-1 | `domain/src/peer-review/review-campaign/student-fate.dqs.test.ts:70` (`participants` всегда пуст) и `:84` (иначе → `dropped`) | удалить |
| `modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts:279` | реагирует на student.completed и student.abandoned из шины | Н2 | `modules/peer-review/src/peer-review.module.test.ts:123` (вертикаль `module.subscribe()` → шина → кампания) | переписать (проверить оба события) или удалить |
| `modules/peer-review/src/review/uc/create-review.uc.test.ts:99` | ментор пишет субъекту: mentor_student, authorOutcome не пишется | Б-1 | `domain/src/peer-review/review/review-draft.dqs.test.ts:32` (направление и отсутствие исхода автора) | удалить |
| `modules/peer-review/src/review/uc/create-review.uc.test.ts:110` | субъект пишет соученику: student_student + снимок исхода | Б-1 | `domain/src/peer-review/review/review-draft.dqs.test.ts:45` | удалить |
| `modules/peer-review/src/review/uc/create-review.uc.test.ts:118` | границы текста: ровно 10 и ровно 3500 символов принимаются | Б-1 | `domain/src/peer-review/review/review.rules.test.ts:112` (те же две границы — `Ok`) | удалить |
| `modules/peer-review/src/review/uc/create-review.uc.test.ts:124` | событие peer-review.review.created публикуется один раз с payload | Б-1 | `domain/src/peer-review/review/review.ar.test.ts:92` (payload и «выдаётся единожды») + `modules/peer-review/src/peer-review.module.test.ts:216` (публикация через `dispatch`) | удалить |
| `modules/peer-review/src/review/uc/create-review.uc.test.ts:168` | события нет (без повторного уведомления) | Б-1 | `domain/src/peer-review/review/review.ar.test.ts:148` (перезапись события не создаёт) | удалить |
| `modules/peer-review/src/review/uc/create-review.uc.test.ts:173` | короткий текст при перезаписи — REVIEW_TEXT_INVALID, прежний текст цел | Б-1 | `domain/src/peer-review/review/review.rules.test.ts:117` (тот же отказ с `payload`); «ничего не записано при отказе» — `dmg-core/src/app/use-case/use-case-from-def.test.ts:224` | удалить |
| `modules/peer-review/src/review/uc/create-review.uc.test.ts:182` | окно закрыто — перезапись отказана | Б-1 | `domain/src/peer-review/review/review.rules.test.ts:42` (закрытое окно → `REVIEW_WINDOW_CLOSED` с `payload`) | удалить |
| `modules/peer-review/src/review/uc/create-review.uc.test.ts:192` | истёкшее окно — REVIEW_WINDOW_CLOSED (conflict), expiresAt — число | Б-1 | `domain/src/peer-review/review/review.rules.test.ts:42` (`kind: conflict`, `payload { campaignId, expiresAt }`); «без записи и события» — `dmg-core/src/app/use-case/use-case-from-def.test.ts:224` | удалить |
| `modules/peer-review/src/review/uc/create-review.uc.test.ts:206` | граница: в момент expiresAt нельзя, за 1 мс до — можно | Б-1 | `domain/src/peer-review/review/review.rules.test.ts:37` (за 1 мс — `Ok`) и `:42` (в момент `expiresAt` — закрыто) | удалить |
| `modules/peer-review/src/review/uc/create-review.uc.test.ts:217` | %s — REVIEW_RECIPIENT_NOT_ALLOWED (conflict) с payload (×4: вне списка, о себе, не участник, ментор→соученик) | Б-1 | `domain/src/peer-review/review/review.rules.test.ts:73` (те же четыре пары, тот же `kind` и `payload`) | удалить |
| `modules/peer-review/src/review/uc/create-review.uc.test.ts:241` | %s — REVIEW_TEXT_INVALID (validation) с payload (×2: короче минимума, длиннее максимума) | Б-1 | `domain/src/peer-review/review/review.rules.test.ts:117` (те же два входа, тот же `payload { min, max, length }`) | удалить |
| `modules/peer-review/src/review/uc/create-review.uc.test.ts:273` | посторонний при истёкшем окне — ACCESS_DENIED, а не WINDOW_CLOSED | Б-9 | `dmg-core/src/app/use-case/use-case-from-def.test.ts:621` (Policy отказала → правила не вызваны) + `modules/peer-review/src/review/uc/create-review.uc.test.ts:260` (единственный Policy-отказ модуля) | удалить |
| `modules/peer-review/src/review/uc/create-review.uc.test.ts:281` | соученик при истёкшем окне — ACCESS_DENIED | Б-1 | `modules/peer-review/src/review/uc/create-review.uc.test.ts:260` (тот же отказ `isCampaignAuthor` для соседа-автора) + `domain/src/peer-review/review/review.policy.test.ts:37` | удалить |
| `modules/peer-review/src/review/uc/create-review.uc.test.ts:285` | посторонний с коротким текстом и чужим адресатом — ACCESS_DENIED | Б-1 | `modules/peer-review/src/review/uc/create-review.uc.test.ts:260` + `domain/src/peer-review/review/review.policy.test.ts:48` (посторонний — denied) | удалить |
| `modules/peer-review/src/review/uc/create-review.uc.test.ts:291` | окно закрыто и адресат недопустим — WINDOW_CLOSED | Б-7 | `domain/src/peer-review/review/uc/create-review.uc.test.ts:34` (порядок `rules`: окно → адресат → текст) — см. открытый вопрос 3 | удалить |
| `modules/peer-review/src/review/uc/create-review.uc.test.ts:298` | окно закрыто и текст короткий — WINDOW_CLOSED | Б-7 | `domain/src/peer-review/review/uc/create-review.uc.test.ts:34` | удалить |
| `modules/peer-review/src/review/uc/create-review.uc.test.ts:305` | адресат недопустим и текст короткий — RECIPIENT_NOT_ALLOWED | Б-7 | `domain/src/peer-review/review/uc/create-review.uc.test.ts:34` | удалить |
| `modules/peer-review/src/review/uc/get-my-review.uc.test.ts:56` | чужой отзыв не виден: автор — субъект вызова | Б-1 | `modules/peer-review/src/review/uc/get-my-review.uc.test.ts:47` (автор берётся из субъекта: отзыв alice виден alice; подмена автора сломала бы и его) | удалить |
| `modules/peer-review/src/review/uc/list-my-reviews.uc.test.ts:62` | отзывов нет — пустой список | Б-12 | нигде: `map`/`sort` по пустой выдаче репозитория пусты по построению; отсутствие записей в хранилище — `modules/peer-review/src/infra/review.json-repo.test.ts:360` | удалить |
| `modules/peer-review/src/review/uc/list-my-reviews.uc.test.ts:123` | direction | Б-1 | `modules/peer-review/src/infra/review.json-repo.test.ts:196` (строка «direction» того же `matches()` в том же методе `findByRecipient`) | удалить |
| `modules/peer-review/src/review/uc/list-my-reviews.uc.test.ts:131` | campaignId | Б-1 | `modules/peer-review/src/infra/review.json-repo.test.ts:196` (строка «campaignId») | удалить |
| `modules/peer-review/src/review/uc/list-my-reviews.uc.test.ts:139` | recipientId = я — все мои; чужой recipientId — пусто (фильтры по И) | Б-1 | `modules/peer-review/src/infra/review.json-repo.test.ts:196` (строки «recipientId тот же» и «recipientId другой — пусто (И)») | удалить |
| `modules/peer-review/src/review/uc/list-my-reviews.uc.test.ts:151` | несколько условий — по И | Б-1 | `modules/peer-review/src/infra/review.json-repo.test.ts:162` (строка «direction + recipientId + campaignId (И)») | удалить |
| `modules/peer-review/src/review/uc/list-my-reviews.uc.test.ts:161` | пустой filter — как без фильтра | Б-6 | `modules/peer-review/src/review/uc/list-my-reviews.uc.test.ts:66` (выборка без фильтра — тот же результат) | удалить |
| `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:48` | пустой скоуп — пустой список групп | Б-12 | нигде: пустая выдача репозитория → `groupByRecipient([])` → `[]` по построению (Б-12) | удалить |
| `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:55` | пустой scopeIds — пустой результат | Б-12 | нигде: `scopeIds.includes` по пустому списку не находит ничего (Б-12); само эхо `scopeIds` проверяет `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:221` | удалить |
| `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:93` | группировка по адресатам со снимками ролей и исходов | Б-1 | `domain/src/peer-review/review/scope-reviews.dqs.test.ts:34` (группы, порядок, снимок ментора без `authorOutcome`) | удалить |
| `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:133` | отзывы в группе — по createdAt (число), группы — по первому появлению | Б-1 | `domain/src/peer-review/review/scope-reviews.dqs.test.ts:34` (то же в одном тесте) | удалить |
| `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:178` | recipientId | Б-1 | `modules/peer-review/src/infra/review.json-repo.test.ts:196` (фильтр `recipientId` на том же `matches()`) | удалить |
| `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:187` | campaignId | Б-1 | `modules/peer-review/src/infra/review.json-repo.test.ts:162` (строка «campaignId») | удалить |
| `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:198` | несколько условий — по И | Б-1 | `modules/peer-review/src/infra/review.json-repo.test.ts:162` (строка «direction + recipientId + campaignId (И)») | удалить |
| `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:209` | фильтр без совпадений — пустые группы, scopeIds сохранены | Б-12 | нигде: фильтр не находит строк → `groupByRecipient([])` (Б-12); эхо `scopeIds` — `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:221` | удалить |
| `modules/peer-review/src/peer-review.module.test.ts:103` | собирает модуль по карте Def: 7 UC и ER кампаний, без external | Б-7 | `domain/src/peer-review/peer-review.module.test.ts:8` (единственный паспорт состава: `dependsOn`, агрегаты, 7 UC, ER) | удалить |
| `modules/peer-review/src/peer-review.module.test.ts:198` | карта Def: 7 UC и ER кампаний | Б-6 | `domain/src/peer-review/peer-review.module.test.ts:8` — см. открытый вопрос 2 | удалить |
| `modules/peer-review/src/peer-review.module.test.ts:299` | повторный отзыв той же паре перезаписывает, а не дублирует | Б-1 | `modules/peer-review/src/review/uc/create-review.uc.test.ts:151` (ветка перезаписи: `uuid` тот же, `version` растёт, одна запись) | удалить |

**Не вошло в таблицу специально** (оставлено вопреки закономерности или как приёмник ссылок):

- `modules/peer-review/src/review/uc/create-review.uc.test.ts:260` — оставлен как **единственный** Policy-отказ модуля (решение по образцу `questionnaire`), хотя формально он дублирует `domain/src/peer-review/review/review.policy.test.ts:37`.
- `modules/peer-review/src/review/uc/create-review.uc.test.ts:75`, `:151`, `:314` — сквозной успех, ветка перезаписи и своя ошибка `load`: ответственность UC по TST-08. На `:151` ссылается удаление `peer-review.module.test.ts:299`.
- `modules/peer-review/src/review/uc/list-scope-reviews.uc.test.ts:63`, `:221` — сквозной сценарий (фильтр + группировка + снимок) и передача фильтра репозиторию: после чистки это единственная защита того, что UC не фильтрует в памяти.
- `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:241` — оставлен как единственная проверка «повторный `save` того же uuid не создаёт дубль» (фильтр по `uuid` в `review-campaign.json-repo.ts:67`); на него ссылается удаление `:167`.
- `modules/peer-review/src/review-campaign/er/create-student-campaign.er.test.ts:239` (`expectIdempotentReaction`, D-47) и `:249` (текст `warn`) — оставлены: готовый хелпер по `testing.md` §5 и единственная защита «состав недоступен → кампании нет». Текст `warn` формально TST-09, но это контракт для дежурного (сообщение не меняется незаметно).

---

## 4. Полезные тесты

- `infra/review.json-repo.test.ts` — 14 тестов, полезны: защищают контракт порта (round-trip и `undefined` при отсутствии, поиск по паре/скопу/списку/адресату, фильтр не расширяет выборку), инвариант уникальности пары на записи, строгий разбор файла без мягкого пропуска, отсутствие файла, чтение фикстур `data/fixtures/peer-review`.
- `infra/review-campaign.json-repo.test.ts` — 11 тестов, полезны: контракт `findById`/`findBySubject`/`findActiveBySubject`/`findActiveByMentor`, граница окна по `at`, инвариант уникальности ключа (скоуп, субъект), повторный `save` без дубля, строгий разбор, отсутствие файла, чтение фикстур и сохранность записей при записи поверх.
- `review-campaign/uc/get-campaign-recipients.uc.test.ts` — 4 теста, полезны: сквозная сборка ответа (роль, `subjectOutcome`, адресаты с `hasMyReview`), `daysLeft` от часов приложения, Policy-отказ `isWindowAuthor`; своя ошибка `load` — после переписывания `:137`.
- `review-campaign/uc/get-my-campaigns.uc.test.ts` — 5 тестов, полезны: сборка карточки, прогресс M/K (единственная проверка, что отзывы грузятся на кампанию), собственный фильтр `scopeId`/`context`, субъект+ментор вместе, граница окна от часов приложения.
- `review-campaign/er/create-student-campaign.er.test.ts` — 8 тестов, полезны: создание кампании по `completed` (ключ, окно от часов), abandoned-ветка с `never_started`, обращение к `stream` по `streamId` события, публикация `created` после сохранения, идемпотентность `unique` как успеха, D-47, недоступный состав (warn + без кампании), отказ UC состава как отказ реакции.
- `review/uc/create-review.uc.test.ts` — 5 тестов, полезны: сквозной первый отзыв (снимки из кампании, запись в UoW), ветка перезаписи, Policy-отказ, своя ошибка `REVIEW_CAMPAIGN_NOT_FOUND`.
- `review/uc/get-my-review.uc.test.ts` — 3 теста, полезны: оба исхода отображения `found`/`text`, передача обоих ключей пары в репозиторий.
- `review/uc/list-my-reviews.uc.test.ts` — 5 тестов, полезны: адресат из субъекта и форма снимка, сортировка `createdAt` ↓, тай-брейк по `uuid` ↓, условный `authorOutcome` в снимке, передача фильтра репозиторию без фильтрации в памяти.
- `review/uc/list-scope-facts.uc.test.ts` — 3 теста, полезны: обе ветки производных `hasReviews`/`reviewsCount` (нельзя инвертировать флаг незаметно), передача `scopeId` в репозиторий.
- `review/uc/list-scope-reviews.uc.test.ts` — 2 теста, полезны: сквозной сценарий фильтр→группировка→снимок и передача `scopeIds`+`filter` репозиторию.
- `peer-review.module.test.ts` — 2 теста, полезны: вертикаль `student.completed` → кампания → `getMyCampaigns`/`getCampaignRecipients` через `module.subscribe()` и шину; smoke полного цикла всех UC чтения/записи через `dispatch` на реальных репозиториях.

---

## 5. Открытые вопросы

1. **`onlyLives` — мёртвый вход UC (Н1).** `GetMyCampaignsUcDef` объявляет `onlyLives` (`domain/src/peer-review/review-campaign/uc/get-my-campaigns.uc.ts:49`), `execute` его не читает: репозиторий всегда возвращает только живые окна (`findActiveBySubject`/`findActiveByMentor`). Варианты: (а) убрать поле из Def — правка контракта домена, вне границ среза и параллельно с доменной инвентаризацией; (б) оставить и пометить долгом. Рекомендация — (а) отдельным срезом домена, тест `get-my-campaigns.uc.test.ts:103` удалить сейчас (он маскирует мёртвый вход).
2. **Кто держит состав модуля после Б-7.** Все три модульных теста состава (`peer-review.module.test.ts:103`, `:198`, и доменный паспорт) сводятся к одному — `domain/src/peer-review/peer-review.module.test.ts:8`. Если доменная таблица удаления его тронет (например, как «ручной паспорт»), состав модуля (`7 UC`, `ER`, `dependsOn`) останется непроверенным ни на одном уровне. Нужно согласование с доменной инвентаризацией до удаления `:103`/`:198`.
3. **Порядок правил `окно → адресат → текст`.** Три теста порядка (`create-review.uc.test.ts:291`, `:298`, `:305`) удаляются со ссылкой на доменный паспорт `domain/src/peer-review/review/uc/create-review.uc.test.ts:34`. Если доменный паспорт уйдёт в чистке, порядок правил не проверяется нигде (правила поодиночке — `review.rules.test.ts`, порядок исполнения — платформа). Варианты: (а) принять риск, (б) оставить один кейс порядка в модуле.
4. **Покрытие версий и замка репозитория уходит за пределы репо.** После удаления 6 тестов (`review.json-repo.test.ts:210`, `:222`, `:230`, `review-campaign.json-repo.test.ts:167`, `:180`, `:188`) защита `VersionConflict` и сериализации `save` остаётся только в `node_modules/dmg-core/src/app/uow/repository.test.ts:46`, `:56`, `:91`. Подтвердить, что ссылка на тест платформы как «где покрыто» принимается (в таблице `questionnaire` такие ссылки приняты), и что своих регрессов версий модуль не ждёт.
5. **Недостижимая ветка отказа в `get-campaign-recipients`.** `get-campaign-recipients.uc.ts:49-54` дублирует отказ Policy `isWindowAuthor` («ветка сужает тип») — за Policy она недостижима, тестом не покрывается и покрыта быть не может. Тест `:117` остаётся единственным Policy-отказом модуля. Убрать ветку — правка кода модуля (долг), вне задачи чистки тестов; решение за orchestrator.

---

**Кандидаты в чистку тестов (для журнала `test-bloat.md` §3):** `modules/peer-review/src/**` — 79 выполнений (71 объявление), из них Б-1 36, Б-6 17, Б-9 8, Б-12 6, Б-7 5, Б-8 5, Н1 1, Н2 1; новые признаки — Н1 (мёртвый вход UC), Н2 (имя теста шире проверки).
