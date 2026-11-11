# Таблица удаления тестов: модуль `wish`

Трек `tst-cleanup_20261105`, фаза 2. Основание — инвентаризация [`wish.md`](./wish.md) (кандидаты, З1–З8), сводные закономерности [`test-bloat.md` §2](../../../roadmap/test-bloat.md) (Б-1…Б-13), правила `node_modules/dmg-core/docs/reference/testing.md` §3, §5, §5.1 (TST-08, TST-09) и [`bot-test.md` §2 п. 5](../../../../architecture/ui/bot-test.md), решения трека [`spec.md`](../spec.md) «Решения».

Номера строк — по текущему коду worktree `tst-cleanup`. Ссылки «где покрыто» проверены: файл существует, на указанной строке начинается `it(`/`test(`/`it.each(`/`test.each(`.

Действия: `удалить` / `слить в <файл>:<строка>` / `переписать` / `отложить до course-dmg`.
Б-ID, которых нет в инвентаризации, — результат пересмотра оценки (см. «Итог»).

## Таблица

| файл | строка | имя теста | Б-ID | действие | где покрыто |
|---|---|---|---|---|---|
| `domain/src/wish/wish/wish.ar.test.ts` | 38 | шесть статусов и четыре перехода | Б-11 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:179` (Def несёт статусы и переходы), `:215` (отказ для каждого статуса вне `from`); ветки переходов — `domain/src/wish/wish/wish.ar.test.ts:236` |
| `domain/src/wish/wish/wish.ar.test.ts` | 55 | ArchChecker с зависимостями — без нарушений (описания, FQN, уникальность кодов) | Б-7 | удалить | `arch:check` в `check` (`package.json:45`); правила — `node_modules/dmg-core/src/arch/def-checker.test.ts:193` (MAN-02), `:654` (ERR-02) |
| `domain/src/wish/wish/wish.ar.test.ts` | 200 | legacy-запись: ISO без зоны, без updatedAt и version | Б-1 | удалить | `modules/wish/src/infra/wish.json-repo.test.ts:165` (та же legacy-строка разбирается при чтении файла) |
| `domain/src/wish/wish/wish.ar.test.ts` | 212 | snapshot — round trip | Б-9 | удалить | `node_modules/dmg-core/src/domain/aggregate/aggregate.test.ts:251` (restore без событий), `:264` (snapshot — копия) |
| `domain/src/wish/wish/wish.ar.test.ts` | 372 | пользователь-желающий | Б-2 | удалить | `domain/src/wish/wish-invitation.dcs.test.ts:81` (адреса без повторов — через `addresseeId()`) |
| `domain/src/wish/wish/wish.ar.test.ts` | 438 | isActive: %s → %p | Б-1 | удалить | `domain/src/wish/wish/wish.rules.test.ts:42` (три неактивных — ok), `:47` (три активных — отказ) |
| `domain/src/wish/wish/wish.ar.test.ts` | 449 | isOwnedBy — только пользователь-желающий | Б-1 | удалить | `domain/src/wish/wish/wish.rules.test.ts:79` (чужое активное не мешает), `domain/src/wish/wish/wish.policy.test.ts:35` (чужой — denied) |
| `domain/src/wish/wish/wish.ar.test.ts` | 455 | alreadyExists — WISH_ALREADY_EXISTS с courseId и статусом желания | Б-1 | удалить | `domain/src/wish/wish/wish.rules.test.ts:47` (payload со статусом) |
| `domain/src/wish/wish/wish.ar.test.ts` | 466 | alreadyExists — цель-модуль даёт moduleId | Б-1 | удалить | `domain/src/wish/wish/wish.rules.test.ts:63` (payload с moduleId) |
| `domain/src/wish/wish/wish.ar.test.ts` | 479 | notFound — WISH_NOT_FOUND с userId и courseId цели (без статуса) | Б-1 | удалить | `domain/src/wish/wish/wish.rules.test.ts:193` |
| `domain/src/wish/wish/wish.ar.test.ts` | 486 | notFound — цель-модуль даёт moduleId | Б-1 | удалить | `domain/src/wish/wish/wish.rules.test.ts:205` |
| `domain/src/wish/wish/wish.ar.test.ts` | 495 | notFoundFor — ошибка от цели-курса без экземпляра | Б-1 | удалить | `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:125` (нет желания → payload цели) |
| `domain/src/wish/wish/wish.ar.test.ts` | 501 | notFoundFor — цель-модуль даёт moduleId | Б-1 | удалить | `domain/src/wish/wish/wish.rules.test.ts:205` (тот же payload из `notFoundFor`); добавлено при пересмотре — пара к `:495` |
| `domain/src/wish/wish/wish.ar.test.ts` | 570 | owner из questionnaire() разбирается в цель-курс | Б-11 | удалить | `modules/wish/src/wish/er/confirm-wish.er.test.ts:111` (`ownerInfo` из события → желание на курс найдено) |
| `domain/src/wish/wish/wish.ar.test.ts` | 578 | согласован с questionnaire(): owner желания разбирается в его цель | Б-11 | удалить | производитель `owner` — `modules/wish/src/wish/uc/create-course-wish.uc.test.ts:139`, потребитель — `domain/src/wish/wish/wish.ar.test.ts:590` (битый owner) |
| `domain/src/wish/wish/wish.ar.test.ts` | 626 | только завершённые — нет текущего | Б-2 | слить в `domain/src/wish/wish/wish.ar.test.ts:631` | — (становится кейсом сокращённого `current()`-теста) |
| `domain/src/wish/wish/wish.ar.test.ts` | 631 | не доверяет фильтру вызывающего: чужой пользователь и чужую цель игнорирует | Б-2 | переписать | — (единственная проверка собственного фильтра `current()`; сокращается до таблицы из двух кейсов) |
| `domain/src/wish/wish/wish.rules.test.ts` | 33 | описание правила ссылается на WISH_ALREADY_EXISTS | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` (ERR-02) |
| `domain/src/wish/wish/wish.rules.test.ts` | 124 | описание правила ссылается на WISH_COURSE_NOT_FOUND | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` |
| `domain/src/wish/wish/wish.rules.test.ts` | 154 | описание правила ссылается на WISH_MODULE_NOT_FOUND | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` |
| `domain/src/wish/wish/wish.rules.test.ts` | 184 | описание правила ссылается на WISH_NOT_FOUND | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:654` |
| `domain/src/wish/wish/wish.state.test.ts` | 24 | отклоняет module-цель с некорректным moduleId | Б-8 | слить в `domain/src/wish/wish/wish.state.test.ts:11` | — (строка таблицы «валидно/невалидно» `WishTargetVo`) |
| `domain/src/wish/wish/wish.state.test.ts` | 42 | отклоняет неизвестный kind цели | Б-8 | слить в `domain/src/wish/wish/wish.state.test.ts:11` | — (строка той же таблицы) |
| `domain/src/wish/wish/wish.state.test.ts` | 51 | отклоняет цель course без courseId | Б-8 | слить в `domain/src/wish/wish/wish.state.test.ts:11` | — (строка той же таблицы) |
| `domain/src/wish/wish/wish.state.test.ts` | 57 | отклоняет цель с невалидным форматом courseId | Б-8 | слить в `domain/src/wish/wish/wish.state.test.ts:11` | — (строка той же таблицы) |
| `domain/src/wish/wish/wish.state.test.ts` | 66 | у полей обеих веток есть описание | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:193` (MAN-02) |
| `domain/src/wish/wish/wish.state.test.ts` | 76 | принимает статус %s (шесть статусов) | Б-8 | удалить | приём `F.picklist` — платформа; реальное чтение файла со статусами — `modules/wish/src/infra/wish.json-repo.test.ts:403` (cancelled/expressed), `:468` (expressed/confirmed/fulfilled), `pending` — сиды ER-тестов модуля |
| `domain/src/wish/wish/wish.state.test.ts` | 87 | отклоняет неизвестный статус | Б-8 | удалить | `modules/wish/src/infra/wish.json-repo.test.ts:233` (запись со `status: 'nonsense'` → ValiError) |
| `domain/src/wish/wish/wish.state.test.ts` | 101 | принимает желание с target; ISO-даты (в т. ч. без зоны) — числа | Б-8 | переписать | — (становится таблицей «валидно/невалидно» `WishState`; в неё же строки из `:116` и `domain/src/wish/wish/wish.invited.test.ts:37`) |
| `domain/src/wish/wish/wish.state.test.ts` | 122 | у каждого поля есть описание | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:193` (MAN-02) |
| `domain/src/wish/wish/wish.invited.test.ts` | 33 | необязательное поле: старая запись без него валидна | Б-8 | удалить | `modules/wish/src/infra/wish.json-repo.test.ts:165` (старая запись без `invitedStreamIds` читается) |
| `domain/src/wish/wish/wish.invited.test.ts` | 37 | список uuid потоков валиден, не-uuid отклоняется | Б-8 | слить в `domain/src/wish/wish/wish.state.test.ts:101` | — (строка «невалидно» общей таблицы `WishState`) |
| `domain/src/wish/wish/wish.invited.test.ts` | 46 | у поля есть описание | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:193` (MAN-02) |
| `domain/src/wish/wish/wish.invited.test.ts` | 54 | приглашение дописывает streamId в state | Б-1 | удалить | `domain/src/wish/wish/wish.ar.test.ts:323` (snapshot после `invite` с `invitedStreamIds`) |
| `domain/src/wish/wish/wish.invited.test.ts` | 74 | wasInvitedTo: да для приглашённого потока, нет для чужого и без списка | Б-2 | удалить | `domain/src/wish/wish-invitation.dcs.test.ts:81` + `domain/src/wish/wish/wish.invited.test.ts:105` (отбор по потоку) |
| `domain/src/wish/wish/wish.invited.test.ts` | 98 | уже приглашённое — invite без приглашённых, без событий | Б-6 | слить в `domain/src/wish/wish/wish.invited.test.ts:93` | — (тот же фильтр `matched()`, что и в `:93`) |
| `domain/src/wish/wish/wish.events.test.ts` | 30 | FQN — wish.wish.invited | Б-11 | удалить | `runners/u7-bot/src/controllers/courses/stories/wish-invite.story.test.ts:158` (литерал FQN у потребителя) |
| `domain/src/wish/wish/wish.events.test.ts` | 34 | payload курса и модуля — допустим | Б-8 | удалить | `modules/wish/src/wish/er/invite-wishers.er.test.ts:156` (payload курса), `:228` (payload модуля) |
| `domain/src/wish/wish/wish.events.test.ts` | 39 | payload без адресата или с целью не своей ветки — недопустим | Б-8 | удалить | `runners/u7-bot/src/controllers/courses/stories/wish-invite.story.test.ts:164` (потребитель публикуемого payload) |
| `domain/src/wish/wish/wish.events.test.ts` | 51 | FQN — wish.wish.confirmed | Б-11 | удалить | `runners/u7-bot/src/controllers/courses/stories/wish-confirmed.story.test.ts:128` (литерал FQN у потребителя) |
| `domain/src/wish/wish/wish.events.test.ts` | 55 | payload { userId, courseId } — допустим | Б-8 | удалить | `modules/wish/src/wish/er/confirm-wish.er.test.ts:125` (публикуемый payload) |
| `domain/src/wish/wish/wish.events.test.ts` | 60 | payload без курса или с невалидным uuid — недопустим | Б-8 | удалить | `modules/wish/src/wish/er/confirm-wish.er.test.ts:125` + типы `WishInvitedEvent`/`WishConfirmedEvent` у потребителей |
| `domain/src/wish/wish/wish.errors.test.ts` | 13 | отказы переходов и ошибки UC | Б-11 | удалить | `arch:check` (`node_modules/dmg-core/src/arch/def-checker.test.ts:654`, ERR-02) + правило TST-09: тексты `label` не тестируются |
| `domain/src/wish/wish/wish.errors.test.ts` | 59 | ALREADY_EXISTS: цель и статус существующего желания | Б-8 | удалить | `domain/src/wish/wish/wish.rules.test.ts:47`, `:63` (payload там, где собирается) |
| `domain/src/wish/wish/wish.errors.test.ts` | 82 | NOT_FOUND: пользователь и цель | Б-8 | удалить | `domain/src/wish/wish/wish.rules.test.ts:193` |
| `domain/src/wish/wish/wish.errors.test.ts` | 93 | COURSE_NOT_FOUND / MODULE_NOT_FOUND: идентификатор цели | Б-8 | удалить | `domain/src/wish/wish/wish.rules.test.ts:138`, `:168` |
| `domain/src/wish/wish/wish.errors.test.ts` | 106 | make — код, kind, label и payload в значении ошибки | Б-11 | удалить | `node_modules/dmg-core/src/kernel/errors/error-def.define.test.ts:41` (`make()` — платформа) |
| `domain/src/wish/wish.module.test.ts` | 7 | паспорт: зависимости, агрегат, UC | Б-7 | переписать | — (единственный тест состава на модуль: `useCases` + `reactions` + `dependsOn`; образец — `node_modules/dmg-core/src/testing/example/todo/todo.module.test.ts:8`) |
| `domain/src/wish/wish.module.test.ts` | 23 | ArchChecker — без нарушений | Б-7 | удалить | `arch:check` (`package.json:45`); правила — `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06) |
| `domain/src/wish/wish/er/abandon-wish.er.test.ts` | 17 | на прерывание анкеты меняет желания, событий не публикует, чужих модулей не вызывает | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06), `:387` (MAN-05) |
| `domain/src/wish/wish/er/abandon-wish.er.test.ts` | 28 | слушает событие с payload { ownerInfo, kind, reason: %s } | Б-8 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.events.test.ts:128` (reason — контракт владельца) |
| `domain/src/wish/wish/er/abandon-wish.er.test.ts` | 35 | прежнее поле owner и событие без reason не принимаются | Б-8 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.events.test.ts:88` (owner вместо ownerInfo), `:135` (reason обязателен) |
| `domain/src/wish/wish/er/confirm-wish.er.test.ts` | 15 | на завершение анкеты меняет желания, публикует confirmed, чужих модулей не вызывает | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06) |
| `domain/src/wish/wish/er/confirm-wish.er.test.ts` | 26 | слушает событие с payload { ownerInfo, kind }: прежнее поле owner не принимается | Б-8 | удалить | `domain/src/questionnaire/questionnaire/questionnaire.events.test.ts:74` (ownerInfo + kind допустимы), `:88` |
| `domain/src/wish/wish/er/fulfill-wish.er.test.ts` | 6 | на зачисление студента меняет желания и спрашивает курс, событий не публикует | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230`, `:387` |
| `domain/src/wish/wish/er/invite-wishers.er.test.ts` | 6 | на создание потока: касается желаний, зовёт курсы, потоки и пользователей, публикует invited | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:230`, `:387` |
| `domain/src/wish/wish/uc/create-course-wish.uc.test.ts` | 12 | нормализуется: command пользователя, без событий, ошибки курса и дубля | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:387` (MAN-05), `:654` (ERR-02) |
| `domain/src/wish/wish/uc/create-course-wish.uc.test.ts` | 23 | правила: сначала курс открыт для записи, затем уникальность | Б-7 | удалить | `modules/wish/src/wish/uc/create-course-wish.uc.test.ts:262` (порядок отказов поведением) |
| `domain/src/wish/wish/uc/create-course-wish.uc.test.ts` | 30 | calls — запись на курс и запуск анкеты (D-42) | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:387` (MAN-05) |
| `domain/src/wish/wish/uc/create-course-wish.uc.test.ts` | 37 | вход — { courseId } uuid | Б-8 | удалить | `modules/wish/src/wish/uc/create-course-wish.uc.test.ts:119` (реальный вызов с uuid) |
| `domain/src/wish/wish/uc/create-course-wish.uc.test.ts` | 46 | выход — outcome %s | Б-8 | удалить | `modules/wish/src/wish/uc/create-course-wish.uc.test.ts:119` (instant), `:139` (questionnaire) |
| `domain/src/wish/wish/uc/create-course-wish.uc.test.ts` | 55 | выход — иной outcome отклоняется | Б-8 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` (OUTPUT_VALIDATION — платформа) |
| `domain/src/wish/wish/uc/create-module-wish.uc.test.ts` | 11 | нормализуется: command пользователя, без событий, ошибки модуля и дубля | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:387`, `:654` |
| `domain/src/wish/wish/uc/create-module-wish.uc.test.ts` | 23 | правила: сначала модуль доступен, затем уникальность | Б-7 | удалить | `modules/wish/src/wish/uc/create-module-wish.uc.test.ts:161` (порядок отказов поведением) |
| `domain/src/wish/wish/uc/create-module-wish.uc.test.ts` | 30 | calls — запись на модуль | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:387` (MAN-05) |
| `domain/src/wish/wish/uc/create-module-wish.uc.test.ts` | 34 | вход — { moduleId } uuid | Б-8 | удалить | `modules/wish/src/wish/uc/create-module-wish.uc.test.ts:101` (реальный вызов) |
| `domain/src/wish/wish/uc/create-module-wish.uc.test.ts` | 40 | выход — пустой объект | Б-8 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` (валидация выхода в платформе) |
| `domain/src/wish/wish/uc/cancel-wish.uc.test.ts` | 12 | нормализуется: command пользователя, без событий, ошибка NOT_FOUND | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:387`, `:654` |
| `domain/src/wish/wish/uc/cancel-wish.uc.test.ts` | 23 | Policy — только автор (canCancel), правило — cancellable | Б-7 | удалить | `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:143` (чужее желание → ACCESS_DENIED), `:98` после сокращения (правило подключено) |
| `domain/src/wish/wish/uc/cancel-wish.uc.test.ts` | 28 | вход — цель желания: курс или модуль по kind | Б-8 | удалить | `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:90` (module-вариант входа) |
| `domain/src/wish/wish/uc/cancel-wish.uc.test.ts` | 42 | expectedVersion: необязателен, неотрицательное целое | Б-8 | удалить | `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:181`, `:195` (D-57 поведением) |
| `domain/src/wish/wish/uc/cancel-wish.uc.test.ts` | 63 | expectedVersion сохраняется в разобранном входе | Б-11 | удалить | `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:181` (версия доходит до репозитория) |
| `domain/src/wish/wish/uc/cancel-wish.uc.test.ts` | 72 | выход — пустой объект | Б-8 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` |
| `domain/src/wish/wish/uc/list-user-wishes.uc.test.ts` | 8 | нормализуется как query без событий и ошибок | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:387` (MAN-05); сборка модуля — `platform/app/tests/u7-app.test.ts:143` |
| `domain/src/wish/wish/uc/list-user-wishes.uc.test.ts` | 16 | вход — пустой объект, выход — массив state желания | Б-8 | удалить | `modules/wish/src/wish/uc/list-user-wishes.uc.test.ts:51` (реальная выдача) |
| `domain/src/wish/wish-fulfillment.dcs.test.ts` | 126 | повторное событие — ничего не меняет | Б-6 | удалить | `domain/src/wish/wish-fulfillment.dcs.test.ts:31` (нереализуемые → вопросов нет), `:112` (нереализуемые не меняются) |
| `domain/src/wish/wish-invitation.dcs.test.ts` | 173 | нет совпавших или ответов раунда 2 — пустой итог | Б-6 | удалить | `domain/src/wish/wish-invitation.dcs.test.ts:70` (нечего спрашивать), `:164` (пустой итог `invite`) |
| `domain/src/wish/wish-invitation.dcs.test.ts` | 185 | неприглашаемые желания не трогает даже при совпадении цели | Б-1 | удалить | `domain/src/wish/wish-invitation.dcs.test.ts:34` + `domain/src/wish/wish/wish.ar.test.ts:398` (неприглашаемое целей не даёт) |
| `modules/wish/src/infra/wish.json-repo.test.ts` | 209 | legacy-запись после перехода сохраняется с version 1 | Б-9 | удалить | `modules/wish/src/infra/wish.json-repo.test.ts:184` (legacy-строка читается и переживает перезапись); версия после перехода — контракт `VersionedRepository` (платформа) |
| `modules/wish/src/infra/wish.json-repo.test.ts` | 262 | корень файла не массив — ValiError, файл не изменён | Б-8 | удалить | `modules/wish/src/infra/wish.json-repo.test.ts:233` (та же ветка: ValiError + файл не изменён) |
| `modules/wish/src/wish.module.test.ts` | 53 | собирает модуль по карте Def | Б-9 | удалить | `node_modules/dmg-core/src/domain/contracts/module-def.test.ts:38`; smoke того же файла — `modules/wish/src/wish.module.test.ts:57` |
| `modules/wish/src/wish/er/abandon-wish.er.test.ts` | 117 | ничего не публикует (emits: []) | Б-9 | удалить | `modules/wish/src/wish/er/abandon-wish.er.test.ts:103` (успех был бы `SERVER_INTERNAL` при незаявленном событии — `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:231`) |
| `modules/wish/src/wish/er/abandon-wish.er.test.ts` | 157 | желания другого курса и другого пользователя не затрагиваются | Б-1 | удалить | фильтр выборки делает репозиторий — `modules/wish/src/infra/wish.json-repo.test.ts:403`, `:418` |
| `modules/wish/src/wish/er/abandon-wish.er.test.ts` | 176 | повторное событие ничего не меняет | Б-6 | удалить | `modules/wish/src/wish/er/abandon-wish.er.test.ts:275` (D-47, `expectIdempotentReaction`) |
| `modules/wish/src/wish/er/abandon-wish.er.test.ts` | 213 | reason %s: pending → abandoned | Б-6 | удалить | `modules/wish/src/wish/er/abandon-wish.er.test.ts:103` (ER `reason` не читает — единственная ветка) |
| `modules/wish/src/wish/er/abandon-wish.er.test.ts` | 227 | declined для выданной, но не начатой анкеты курса закрывает pending-желание | Б-6 | удалить | `modules/wish/src/wish/er/abandon-wish.er.test.ts:103` (тот же путь: `reason` не читается) |
| `modules/wish/src/wish/er/abandon-wish.er.test.ts` | 243 | abandoned с kind: likert и чужим ownerInfo не трогает желания | Б-6 | удалить | `modules/wish/src/wish/er/abandon-wish.er.test.ts:189` (чужой `ownerInfo` → нет загрузки; `kind` не читается) |
| `modules/wish/src/wish/er/confirm-wish.er.test.ts` | 171 | желания другого курса и другого пользователя не затрагиваются | Б-1 | удалить | `modules/wish/src/infra/wish.json-repo.test.ts:403`, `:418` (фильтр пары в репозитории) |
| `modules/wish/src/wish/er/confirm-wish.er.test.ts` | 190 | повторное событие ничего не меняет | Б-6 | удалить | `modules/wish/src/wish/er/confirm-wish.er.test.ts:259` (D-47) |
| `modules/wish/src/wish/er/confirm-wish.er.test.ts` | 227 | completed с kind: likert и чужим ownerInfo не трогает желания | Б-6 | удалить | `modules/wish/src/wish/er/confirm-wish.er.test.ts:203` (чужой `ownerInfo`; `kind` не читается) |
| `modules/wish/src/wish/er/fulfill-wish.er.test.ts` | 143 | confirmed → fulfilled | Б-6 | слить в `modules/wish/src/wish/er/fulfill-wish.er.test.ts:128` | — (`:128` становится `it.each` по expressed/confirmed) |
| `modules/wish/src/wish/er/fulfill-wish.er.test.ts` | 234 | fulfilled/cancelled/pending/abandoned — курс не спрашивается, ничего не записано | Б-1 | удалить | `domain/src/wish/wish-fulfillment.dcs.test.ts:31` (нереализуемые → вопросов нет), `modules/wish/src/wish/er/fulfill-wish.er.test.ts:229` (нет вопросов — нет вызова) |
| `modules/wish/src/wish/er/fulfill-wish.er.test.ts` | 250 | повторное событие ничего не меняет | Б-6 | удалить | `modules/wish/src/wish/er/fulfill-wish.er.test.ts:330` (D-47) |
| `modules/wish/src/wish/er/invite-wishers.er.test.ts` | 177 | confirmed тоже приглашается; статус желания не меняется | Б-6 | удалить | `domain/src/wish/wish/wish.ar.test.ts:323` (`it.each` expressed/confirmed) |
| `modules/wish/src/wish/er/invite-wishers.er.test.ts` | 216 | не совпавшее с программой желание не зовётся | Б-6 | слить в `modules/wish/src/wish/er/invite-wishers.er.test.ts:192` | — (в `:192` таблица «цель не совпала: курс/модуль») |
| `modules/wish/src/wish/er/invite-wishers.er.test.ts` | 251 | другой модуль — желание не зовётся | Б-6 | слить в `modules/wish/src/wish/er/invite-wishers.er.test.ts:192` | — (та же таблица) |
| `modules/wish/src/wish/er/invite-wishers.er.test.ts` | 286 | pending/cancelled/fulfilled/abandoned с совпавшей целью не приглашаются и не записываются | Б-1 | удалить | `domain/src/wish/wish-invitation.dcs.test.ts:34`, `domain/src/wish/wish/wish.ar.test.ts:398` |
| `modules/wish/src/wish/uc/create-course-wish.uc.test.ts` | 201 | дубль — текст прежний | Б-11 | удалить | нигде: текст `label` — TST-09 (Б-11), видимые тексты проверяют тесты UI |
| `modules/wish/src/wish/uc/create-course-wish.uc.test.ts` | 215 | повторное желание после %s разрешено | Б-1 | удалить | `domain/src/wish/wish/wish.rules.test.ts:42` (только неактивные — ok); успех UC — `modules/wish/src/wish/uc/create-course-wish.uc.test.ts:119` |
| `modules/wish/src/wish/uc/create-course-wish.uc.test.ts` | 316 | calls Def — оба вызываемых UC: `this.call` пропускает только их (тип) | Б-7 | удалить | `node_modules/dmg-core/src/arch/def-checker.test.ts:387` (MAN-05); добавлено при пересмотре — ручной паспорт `calls` в модульном слое |
| `modules/wish/src/wish/uc/create-module-wish.uc.test.ts` | 140 | дубль — текст прежний | Б-11 | удалить | нигде: текст `label` — TST-09 (Б-11) |
| `modules/wish/src/wish/uc/create-module-wish.uc.test.ts` | 150 | неактивное желание (%s) не мешает создать новое | Б-1 | удалить | `domain/src/wish/wish/wish.rules.test.ts:42`; успех UC — `modules/wish/src/wish/uc/create-module-wish.uc.test.ts:101` |
| `modules/wish/src/wish/uc/cancel-wish.uc.test.ts` | 98 | желание в статусе %s — WISH_NOT_FOUND, статус не меняется | Б-1 | переписать | — (сократить до одного кейса `pending → WISH_NOT_FOUND`: перечисление статусов — `domain/src/wish/wish/wish.rules.test.ts:193`, кейс нужен как след подключения правила `cancellable`) |
| `modules/wish/src/wish/uc/cancel-wish.uc.test.ts` | 113 | module-вариант: неактивное желание — WISH_NOT_FOUND | Б-1 | удалить | `domain/src/wish/wish/wish.rules.test.ts:205`; module-вариант входа — `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:90` |
| `runners/u7-bot/tests/e2e/wish-questionnaire.e2e.test.ts` | 399 | resume без активной анкеты → «не найдена» без ⚠️ | Б-4 | удалить | `runners/u7-bot/src/controllers/questionnaire/stories/fill.story.dmg.test.ts:359` (тот же экран unit-уровнем) |
| `runners/u7-bot/tests/e2e/wish-questionnaire.e2e.test.ts` | 460 | confirmed → на карточке кнопка «Отменить желание»; отмена → cancelled | Б-4 | отложить до course-dmg | после закрытия `course-dmg` — слить в `runners/u7-bot/tests/courses/wish-flow.integration.test.ts:251` (сейчас красный: TR-57) |

## Переписать и слить

**Переписать (4)**

1. `domain/src/wish/wish/wish.state.test.ts:101` — свести к одной таблице «валидно/невалидно» схемы `WishState`: валидны полная запись (ISO без зоны → числа) и legacy-запись без `updatedAt`/`version`; невалидны legacy-поле `courseId` вместо `target` (кейс из `:116` переезжает сюда) и не-uuid в `invitedStreamIds` (из `domain/src/wish/wish/wish.invited.test.ts:37`).
2. `domain/src/wish/wish/wish.state.test.ts:11` (приёмник слияний, сам не кандидат) — свести к одной таблице `WishTargetVo`: валидны course и module, невалидны неизвестный kind, course без `courseId`, не-uuid `courseId`/`moduleId` (кейсы `:24`, `:33`, `:42`, `:51`, `:57`).
3. `domain/src/wish/wish.module.test.ts:7` — сократить до единственного теста состава модуля: `useCases` (`createCourseWish`, `createModuleWish`, `cancelWish`, `listUserWishes`), `reactions` (`fulfillWish`, `confirmWish`, `abandonWish`, `inviteWishers`), `jobs: []`, `dependsOn: ['user', 'course', 'questionnaire', 'stream']`; паспорт агрегата и `name` убрать (образец — `node_modules/dmg-core/src/testing/example/todo/todo.module.test.ts:8`).
4. `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:98` — оставить один кейс `pending → WISH_NOT_FOUND` (след подключения правила `cancellable`), перечисление статусов отдать тесту правила.

**Переписать-сохранить (1)**

- `domain/src/wish/wish/wish.ar.test.ts:631` — сократить до таблицы из двух кейсов: только завершённые → `undefined` (из `:626`) и чужой пользователь / чужая цель в списке → `undefined`. Это единственная проверка того, что `WishAr.current` не доверяет выборке вызывающего.

**Слить (10)**

1. `domain/src/wish/wish/wish.ar.test.ts:626` → `:631` — кейс «только завершённые → нет текущего».
2. `domain/src/wish/wish/wish.state.test.ts:24` → `:11` — строка «невалидный `moduleId`».
3. `domain/src/wish/wish/wish.state.test.ts:42` → `:11` — строка «неизвестный kind».
4. `domain/src/wish/wish/wish.state.test.ts:51` → `:11` — строка «course без `courseId`».
5. `domain/src/wish/wish/wish.state.test.ts:57` → `:11` — строка «не-uuid `courseId`».
6. `domain/src/wish/wish/wish.invited.test.ts:37` → `domain/src/wish/wish/wish.state.test.ts:101` — строка «не-uuid в `invitedStreamIds`».
7. `domain/src/wish/wish/wish.invited.test.ts:98` → `:93` — в тест «уже приглашённое» добавить проверку `invite()` (сейчас там только `reachQuestion`).
8. `modules/wish/src/wish/er/fulfill-wish.er.test.ts:143` → `:128` — `:128` сделать `it.each(['expressed', 'confirmed'])`.
9. `modules/wish/src/wish/er/invite-wishers.er.test.ts:216` → `:192` — в `:192` таблица «цель не совпала: курс / другой модуль».
10. `modules/wish/src/wish/er/invite-wishers.er.test.ts:251` → `:192` — та же таблица.

## Остающиеся проверки `label`

Решения требуют не тестировать тексты `label`. Отдельные `it` с этим удаляются (`modules/wish/src/wish/uc/create-course-wish.uc.test.ts:201`, `modules/wish/src/wish/uc/create-module-wish.uc.test.ts:140`, `domain/src/wish/wish/wish.errors.test.ts:13`), но одиночные `expect(...label)` остались внутри полезных тестов — их снять в том же срезе:

- `modules/wish/src/wish/uc/create-course-wish.uc.test.ts:256`
- `modules/wish/src/wish/uc/create-module-wish.uc.test.ts:121`
- `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:130`
- `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:158` (`toBeDefined()` на `label` — тавтология)

## Состав модуля

Тест состава остаётся один — `domain/src/wish/wish.module.test.ts:7` (после сокращения, см. выше). Других тестов, закрепляющих состав `wish` (точные списки UC/ER/ошибок/FQN) за границами модуля нет: `platform/app/tests/u7-app.test.ts:143` вызывает `listUserWishes` через `dispatch`, но состав не перечисляет; в `runners/u7-bot` перечислений нет.

## Итог

**Всего строк в таблице: 106** — 104 кандидата инвентаризации + 2 добавленных при пересмотре (`domain/src/wish/wish/wish.ar.test.ts:501`, `modules/wish/src/wish/uc/create-course-wish.uc.test.ts:316`).

| действие | сколько |
|---|---|
| удалить | 91 |
| слить | 10 |
| переписать | 4 |
| отложить до course-dmg | 1 |

Кандидатов инвентаризации, не вошедших в таблицу: **0**. В трёх строках исправлен путь (в `wish.md` опечатка — лишний `wish/`): `wish/wish-fulfillment.dcs.test.ts:126`, `wish/wish-invitation.dcs.test.ts:173`, `:185` → `domain/src/wish/wish-fulfillment.dcs.test.ts` и `domain/src/wish/wish-invitation.dcs.test.ts` (пути в таблице — проверенные по файловой системе).

Оценка пересмотрена по 13 строкам (все вошли в таблицу с другим действием):

- `domain/src/wish/wish/wish.state.test.ts:101`, `domain/src/wish/wish/wish.ar.test.ts:631`, `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:98` — инвентаризация предлагала удалить, оставлено переписыванием: уходит перечисление, но остаётся след подключения (`state` — единственная схема, читаемая с файла; `current()` — фильтр, не доверяющий вызывающему; `cancellable` — подключение правила к `UC`).
- `domain/src/wish/wish/wish.errors.test.ts:59,82,93` — вместо «слить в одну таблицу payload» удаляются: payload проверяется там, где собирается (`domain/src/wish/wish/wish.rules.test.ts:47,63,138,168,193,205`), а приём/отказ полей `F.uuid` — платформа (Б-8).
- `domain/src/wish/wish/wish.state.test.ts:24,42,51,57` и `domain/src/wish/wish/wish.invited.test.ts:37` — вместо удаления сливаются в таблицы схем (`WishTargetVo`, `WishState`): решение Б-8 оставляет схему state, читаемую с файла, одной таблицей «валидно/невалидно».
- `domain/src/wish/wish/uc/create-course-wish.uc.test.ts:46,55` — вместо «объединить в таблицу» удаляются обе: это выходная схема платформы (Б-8), её держит `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:264` и реальные вызовы.

**Побочный эффект:** после удаления пустеют и удаляются файлы целиком — `domain/src/wish/wish/wish.errors.test.ts`, `wish.events.test.ts`, `wish/er/*.er.test.ts` (4 файла), `wish/uc/*.uc.test.ts` (4 файла). Базовая линия домена и модуля `wish` — 348 тестов (`inventory/wish.md`).

**Спорные строки:**

1. `modules/wish/src/wish/uc/cancel-wish.uc.test.ts:98` — удаление вместе с паспортом `:23` оставило бы правило `cancellable` без единой проверки подключения, поэтому один кейс остаётся.
2. `domain/src/wish/wish/wish.ar.test.ts:631` — инвентаризация ссылается на тесты правила и репозитория, но они не поймают снятие фильтра в `WishAr.current` (вызывающий уже фильтрует выборку) — тест сокращается, а не удаляется.
3. `modules/wish/src/infra/wish.json-repo.test.ts:262` — «корень файла не массив» не то же, что `:233` (битая запись), но обе ветки — один и тот же `ValiError`/«файл не изменён»; удаление принято по инвентаризации.
4. `runners/u7-bot/tests/e2e/wish-questionnaire.e2e.test.ts:460` — отложено, хотя сценарий «отмена confirmed» уже есть в `runners/u7-bot/tests/courses/wish-flow.integration.test.ts:251`: слить нужно после зелёной базы `course-dmg` (TR-57, `conductor/architecture/debt.md`).
5. `domain/src/wish/wish/wish.state.test.ts:76` — приём шести статусов проверяется косвенно (чтение файла в `wish.json-repo.test.ts`/ER-тестах), отдельного «все статусы читаются» теста нет; удаление опирается на решение Б-8.
