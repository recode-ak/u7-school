# Таблица удаления тестов: прикладной слой `stream` (потоки и студенты)

Трек `tst-cleanup_20261105`, фаза 2. Основание — инвентаризация [`stream-app.md`](./stream-app.md) (кандидаты, З1–З12), сводные закономерности [`test-bloat.md` §2](../../../roadmap/test-bloat.md) (Б-1…Б-13), правила `node_modules/dmg-core/docs/reference/testing.md` §3, §5, §5.1 (TST-08, TST-09), [`bot-test.md` §2 п. 5](../../../../architecture/ui/bot-test.md) и решения трека [`spec.md`](../spec.md) «Решения».

Область — `modules/stream/src/**/*.test.ts` (17 файлов). База: `cd modules/stream && bun test` → **226 pass, 0 fail** (проверено в worktree `tst-cleanup`).

Номера строк — по текущему коду worktree, а не по инвентаризации. Каждая ссылка «где покрыто» проверена: файл существует, на указанной строке начинается `it(`/`test(`/`it.each(`/`test.each(`, тест проверяет то же и **сам не удаляется этой таблицей** (цепочек «A покрыт B, B удалён» нет). Ссылок на `domain/src/stream/**/*.uc-defs.test.ts`, паспорта Def и тесты схем платформы в «где покрыто» нет — они удаляются параллельной доменной таблицей.

Действия: `удалить` / `слить в <файл>:<строка>` / `переписать` / `перенести в <файл>` / `отложить до course-dmg` / `отложить: удалить с кодом`.
В таблицу вошли только строки, по которым есть действие: полезные тесты (§4 инвентаризации) не перечислены — их не трогают. Б-ID — сводные из `test-bloat.md` §2; соответствие З→Б: З2→Б-8, З3→Б-11, З5→Б-1, З6→Б-6, З7→Б-11, З8→Б-9, З9→Б-10, З10→Б-11, З11→Б-9, З12→Б-5.

## Таблица

| файл | строка | имя теста | Б-ID | действие | где покрыто |
|---|---|---|---|---|---|
| `modules/stream/src/infra/stream.json-repo.test.ts` | 100 | переход статуса сохраняется, версия растёт | Б-6 | удалить | `modules/stream/src/infra/stream.json-repo.test.ts:82` (round-trip состояния), `:180` (переход сохраняется с `version: 1`) |
| `modules/stream/src/infra/stream.json-repo.test.ts` | 134 | create с занятым uuid — VersionConflict, файл не изменён | Б-9 | удалить | `node_modules/dmg-core/src/app/uow/repository.test.ts:46` (занятый uuid на новом агрегате — платформа), `modules/stream/src/infra/stream.json-repo.test.ts:117` (свой VersionConflict репозитория) |
| `modules/stream/src/infra/stream.json-repo.test.ts` | 289 | корень файла не массив — ValiError, файл не изменён | Б-6 | удалить | `modules/stream/src/infra/stream.json-repo.test.ts:262` (та же ветка: `ValiError` + файл не изменён) |
| `modules/stream/src/infra/student.json-repo.test.ts` | 83 | переход сохраняется, версия растёт | Б-6 | удалить | `modules/stream/src/infra/student.json-repo.test.ts:64` (round-trip), `:172` (переход сохраняется с `version: 1`) |
| `modules/stream/src/infra/student.json-repo.test.ts` | 300 | findStudying: учащихся нет — пусто | Б-12 | слить в `modules/stream/src/infra/student.json-repo.test.ts:285` | — (в `:285` добавить кейс «в файле только терминальные» — тот же `findStudying`) |
| `modules/stream/src/infra/student.json-repo.test.ts` | 336 | корень файла не массив — ValiError, файл не изменён | Б-6 | удалить | `modules/stream/src/infra/student.json-repo.test.ts:309` (та же ветка: `ValiError` + файл не изменён) |
| `modules/stream/src/stream.module.test.ts` | 33 | поток есть — exists: true | Б-5 | удалить | `modules/stream/src/stream/uc/read-stream.uc.test.ts:224` (presence через UC — единственное место после удаления файла) |
| `modules/stream/src/stream.module.test.ts` | 39 | потока нет — exists: false, без ошибки | Б-5 | удалить | `modules/stream/src/stream/uc/read-stream.uc.test.ts:234` |
| `modules/stream/src/stream.module.map.test.ts` | 51 | карта содержит 17 UC (поток и студент) и Job бездействия, ER нет | Б-7 | переписать | — (единственный тест состава модуля: ключи `streamMap` против `StreamModuleDef.useCases`/`.jobs` + `dependsOn`) |
| `modules/stream/src/stream.module.map.test.ts` | 77 | фасад обслуживает все 17 UC | Б-9 | удалить | `node_modules/dmg-core/src/app/module/module-from-def.test.ts:270` (тип `ModuleMap`: пропуск реализации — ошибка компиляции), `:279` (класс чужого Def), `node_modules/dmg-core/src/app/facade/module-facade.test.ts:69` (сам `serves`); сборка модуля — `platform/app/tests/u7-app.student.test.ts:144` |
| `modules/stream/src/stream/uc/create-stream.uc.test.ts` | 97 | публикует `stream.stream.created { streamId, moduleId }` после записи | Б-1 | слить в `modules/stream/src/stream/uc/create-stream.uc.test.ts:48` | — (в сквозной успех `:48` добавить `expect(env.ctx.published)` — публикация остаётся проверенной у UC) |
| `modules/stream/src/stream/uc/create-stream.uc.test.ts` | 110 | вызывающий guest — UNAUTHORIZED, ничего не записано и не опубликовано | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` (вид вызывающего не в `callers` → `UNAUTHORIZED`) |
| `modules/stream/src/stream/uc/create-stream.uc.test.ts` | 120 | %s — ACCESS_DENIED «Недостаточно прав для создания потока» (guest-роль / студент / админ без MENTOR, ×3) | Б-1 | удалить | `domain/src/stream/stream/stream.policy.test.ts:31` (роли GUEST/SUBSCRIBER/STUDENT/AUTHOR — denied с тем же текстом) |
| `modules/stream/src/stream/uc/create-stream.uc.test.ts` | 161 | ввод вне схемы (пустой заголовок) — INPUT_VALIDATION, ничего не записано | Б-8 | удалить | `domain/src/stream/stream/stream.state.test.ts:98` (своя логика схемы: пустой после trim заголовок — отказ) |
| `modules/stream/src/stream/uc/manage-stream.uc.test.ts` | 57 | ментор потока — Ok (×3) | Б-6 | удалить | `modules/stream/src/stream/uc/manage-stream.uc.test.ts:110`, `:156`, `:182` (успех каждой команды у ментора) |
| `modules/stream/src/stream/uc/manage-stream.uc.test.ts` | 61 | админ, не ментор потока — Ok (×3) | Б-1 | удалить | `domain/src/stream/stream/stream.policy.test.ts:58` (`canManage`: админ без роли ментора — allowed) |
| `modules/stream/src/stream/uc/manage-stream.uc.test.ts` | 65 | %s — ACCESS_DENIED, статус не меняется (чужой ментор / студент / GUEST, ×3 команды) | Б-1 | удалить | `domain/src/stream/stream/stream.policy.test.ts:64` (чужой ментор), `:72` (студент), `:78` (гость) — denied |
| `modules/stream/src/stream/uc/manage-stream.uc.test.ts` | 80 | вызывающий guest — UNAUTHORIZED (×3) | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/stream/src/stream/uc/manage-stream.uc.test.ts` | 102 | событий в шину нет (×3) | Б-9 | удалить | нигде: UC возвращает `events: []` ⇒ публиковать нечего (платформа: `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:205`), а «иных событий у агрегата нет» закреплено составом контракта — `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06) |
| `modules/stream/src/stream/uc/manage-stream.uc.test.ts` | 119 | первого шага нет — поток активен, студенты не тронуты | Б-5 | слить в `modules/stream/src/stream/uc/stream-students.uc.test.ts:84` | — (`:84` тот же сценарий, но со студентом в стенде и проверкой «студенты не записаны») |
| `modules/stream/src/stream/uc/manage-stream.uc.test.ts` | 128 | из %s — STREAM_NOT_ENROLLING, студенты не тронуты, ничего не записано (×3) | Б-1 | переписать | — (оставить один кейс `active`; ветка запуска — `domain/src/stream/stream-launch.dcs.test.ts:33`) |
| `modules/stream/src/stream/uc/manage-stream.uc.test.ts` | 141 | чужой ментор — студенты не тронуты | Б-6 | удалить | `domain/src/stream/stream/stream.policy.test.ts:64` (тот же отказ), `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:224` (отказ — без сохранения и публикации) |
| `modules/stream/src/stream/uc/manage-stream.uc.test.ts` | 162 | из %s — STREAM_NOT_ACTIVE, ничего не записано (×3) | Б-1 | переписать | — (оставить один кейс `enrollment`; перечисление статусов — `domain/src/stream/stream/stream.ar.test.ts:156`) |
| `modules/stream/src/stream/uc/manage-stream.uc.test.ts` | 174 | `stream.completed` в шину не уходит | Б-9 | удалить | `domain/src/stream/stream/stream.ar.test.ts:149` (`active → completed`, событий нет) |
| `modules/stream/src/stream/uc/manage-stream.uc.test.ts` | 190 | из %s — STREAM_NOT_COMPLETED «В архив можно отправить только завершённый поток.» (×2) | Б-1 | переписать | — (оставить один кейс `enrollment`, убрать `label`; статусы — `domain/src/stream/stream/stream.ar.test.ts:173`) |
| `modules/stream/src/stream/uc/manage-stream.uc.test.ts` | 204 | из archived — STREAM_ALREADY_ARCHIVED «Поток уже находится в архиве.» | Б-1 | удалить | `domain/src/stream/stream/stream.ar.test.ts:180` (из archived — `STREAM_ALREADY_ARCHIVED`) |
| `modules/stream/src/stream/uc/read-stream.uc.test.ts` | 58 | гость читает без ограничений | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:179` (allowAll — вызывающий без субъекта допускается) |
| `modules/stream/src/stream/uc/read-stream.uc.test.ts` | 105 | без ключа requiresEnrollmentKey = false | Б-1 | удалить | `domain/src/stream/stream/stream.ar.test.ts:257` |
| `modules/stream/src/stream/uc/read-stream.uc.test.ts` | 137 | только schoolId — фильтр `{ schoolId }` | Б-6 | слить в `modules/stream/src/stream/uc/read-stream.uc.test.ts:117` | — (`:117` становится `it.each` по трём фильтрам: полный, только schoolId, пустой) |
| `modules/stream/src/stream/uc/read-stream.uc.test.ts` | 145 | без фильтра — все потоки; гость допущен | Б-6 | слить в `modules/stream/src/stream/uc/read-stream.uc.test.ts:117` | — (строка «пустой фильтр» того же `it.each`) |
| `modules/stream/src/stream/uc/read-stream.uc.test.ts` | 153 | кодовое слово не отдаётся | Б-1 | удалить | `domain/src/stream/stream/stream.ar.test.ts:251` (тот же `view()` для списка) |
| `modules/stream/src/stream/uc/read-stream.uc.test.ts` | 162 | пусто — пустой список | Б-12 | удалить | нигде: `map` по пустой выдаче репозитория в `ListStreamsUc` — пустой список по построению (Б-12); пустая выборка — предмет контракта репозитория, не UC |
| `modules/stream/src/stream/uc/read-stream.uc.test.ts` | 191 | кодовое слово не отдаётся (find по группе) | Б-1 | удалить | `domain/src/stream/stream/stream.ar.test.ts:251` |
| `modules/stream/src/stream/uc/read-stream.uc.test.ts` | 213 | пользователь и гость тоже читают состав | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:179` |
| `modules/stream/src/stream/uc/stream-students.uc.test.ts` | 64 | студент с шагами не меняется и не пишется | Б-1 | удалить | `domain/src/stream/stream-launch.dcs.test.ts:59` (студент с шагами не меняется и не возвращается) |
| `modules/stream/src/stream/uc/stream-students.uc.test.ts` | 70 | ушедший без шагов получает первый шаг (статус не учитывается) | Б-1 | удалить | `domain/src/stream/stream-launch.dcs.test.ts:66` |
| `modules/stream/src/stream/uc/stream-students.uc.test.ts` | 78 | студенты другого потока не затронуты | Б-10 | удалить | `modules/stream/src/infra/student.json-repo.test.ts:266` (`findByStream` фильтрует по полю) |
| `modules/stream/src/stream/uc/stream-students.uc.test.ts` | 94 | поток не в наборе — STREAM_NOT_ENROLLING, студенты не тронуты | Б-5 | удалить | `domain/src/stream/stream-launch.dcs.test.ts:33`, `modules/stream/src/stream/uc/manage-stream.uc.test.ts:128` (кейс остаётся после сокращения) |
| `modules/stream/src/stream/uc/stream-students.uc.test.ts` | 101 | событий в шину нет | Б-9 | удалить | нигде: `StreamLaunchDcs` событий не порождает, UC возвращает `events: []` ⇒ публиковать нечего (платформа: `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:205`); «иных событий нет» — состав контракта, `node_modules/dmg-core/src/arch/def-checker.test.ts:230` (MAN-06) |
| `modules/stream/src/stream/uc/stream-students.uc.test.ts` | 125 | студентов нет — завершён | Б-5 | удалить | `modules/stream/src/stream/uc/manage-stream.uc.test.ts:156` (тот же сценарий, там же проверяется статус) |
| `modules/stream/src/stream/uc/stream-students.uc.test.ts` | 130 | студент %s блокирует: STREAM_STUDENTS_IN_PROGRESS со списком { userId, status } (×2) | Б-1 | переписать | — (оставить один кейс `active`; `enrolled` — `domain/src/stream/stream/stream.rules.test.ts:64`, payload списка — `:51`) |
| `modules/stream/src/stream/uc/stream-students.uc.test.ts` | 145 | студенты других потоков не блокируют | Б-10 | удалить | `modules/stream/src/infra/student.json-repo.test.ts:266` |
| `modules/stream/src/stream/uc/stream-students.uc.test.ts` | 161 | потока нет — пусто, не ошибка | Б-5 | удалить | `modules/stream/src/stream/uc/read-stream.uc.test.ts:207` (тот же UC и та же ветка `Ok(undefined)`) |
| `modules/stream/src/stream/uc/stream-students.uc.test.ts` | 222 | чтение не пишет и не публикует | Б-9 | удалить | нигде: в `GetStreamMembersUc.execute` нет ни `save`, ни `register` — писать и публиковать нечему |
| `modules/stream/src/student/job/inactivity-sweep.job.test.ts` | 48 | константы: WARN=5, REMOVE=7, NOTICE_EVERY=2 | Б-11 | удалить | нигде: константа против литерала (Б-11); пороги поведением — `domain/src/stream/student/student.ar.test.ts:445`, `:465`, повтор «через 2 дня» — `modules/stream/src/student/job/inactivity-sweep.job.test.ts:114` |
| `modules/stream/src/student/job/inactivity-sweep.job.test.ts` | 54 | 4 дня — тихо | Б-1 | удалить | `domain/src/stream/student/student.ar.test.ts:445` (в 4 дня 23 ч уведомлять нечего) |
| `modules/stream/src/student/job/inactivity-sweep.job.test.ts` | 77 | 7 дней впервые: студенту и ментору, wasWarned = false | Б-1 | удалить | `domain/src/stream/student/student.ar.test.ts:465` |
| `modules/stream/src/student/job/inactivity-sweep.job.test.ts` | 95 | wasWarned = true, если предупреждение уходило раньше (маркер до прогона) | Б-1 | удалить | `domain/src/stream/student/student.ar.test.ts:492` |
| `modules/stream/src/student/job/inactivity-sweep.job.test.ts` | 131 | повторный прогон в тот же момент ничего не публикует и не пишет | Б-1 | удалить | `domain/src/stream/student/student.ar.test.ts:586` (нечего слать — Ok без событий и изменений), `modules/stream/src/student/job/inactivity-sweep.job.test.ts:114` (расписание) |
| `modules/stream/src/student/job/inactivity-sweep.job.test.ts` | 145 | дни считаются от последней активности по шагам | Б-1 | удалить | `domain/src/stream/student/student.ar.test.ts:548` |
| `modules/stream/src/student/job/inactivity-sweep.job.test.ts` | 155 | терминальные и чужие по статусу записи не обходятся (`findStudying`) | Б-10 | удалить | `modules/stream/src/infra/student.json-repo.test.ts:285` (`findStudying` — только active и enrolled) |
| `modules/stream/src/student/job/inactivity-sweep.job.test.ts` | 165 | возобновление учёбы сбрасывает цепочку | Б-1 | удалить | `domain/src/stream/student/student.ar.test.ts:95` (`enrolled → active`, notices сброшены), `:297` (завершение шага сбрасывает notices) |
| `modules/stream/src/student/job/inactivity-sweep.job.test.ts` | 180 | сбой записи одной студенческой записи — остальные обработаны, failed: 1, сбой в логе | Б-9 | удалить | `node_modules/dmg-core/src/app/job/job-from-def.test.ts:108` (сбой одной записи не прерывает обход и пишется в лог), `:170` (то же в записи операций) |
| `modules/stream/src/student/uc/complete-step.uc.test.ts` | 59 | последний шаг потока — level stream, статус студента не меняется | Б-1 | удалить | `domain/src/stream/step-completion.dcs.test.ts:90` |
| `modules/stream/src/student/uc/complete-step.uc.test.ts` | 86 | сбрасывает notices (возобновление учёбы) | Б-1 | удалить | `domain/src/stream/student/student.ar.test.ts:297` |
| `modules/stream/src/student/uc/complete-step.uc.test.ts` | 94 | событий в шину нет | Б-9 | удалить | нигде: `completeStep` событий не поднимает, UC возвращает `events: []` ⇒ публиковать нечего (платформа: `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:205`; состав событий агрегата — `node_modules/dmg-core/src/arch/def-checker.test.ts:230`, MAN-06) |
| `modules/stream/src/student/uc/complete-step.uc.test.ts` | 123 | шага нет в потоке — STUDENT_STEP_NOT_IN_STREAM | Б-1 | удалить | `domain/src/stream/step-completion.dcs.test.ts:101` |
| `modules/stream/src/student/uc/complete-step.uc.test.ts` | 131 | шаг не выдан студенту — STUDENT_STEP_NOT_ISSUED | Б-1 | удалить | `domain/src/stream/step-completion.dcs.test.ts:111` |
| `modules/stream/src/student/uc/complete-step.uc.test.ts` | 139 | %s — ACCESS_DENIED, запись не меняется (×2) | Б-1 | удалить | `domain/src/stream/student/student.policy.test.ts:38` (`isSelf`: другой студент, ментор, админ — denied) |
| `modules/stream/src/student/uc/complete-step.uc.test.ts` | 148 | вызывающий guest — UNAUTHORIZED | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/stream/src/student/uc/complete-student.uc.test.ts` | 69 | смена исхода: advanced ↔ not_advanced разрешена | Б-1 | удалить | `domain/src/stream/student/student.ar.test.ts:187` (`it.each` шести пар статус/исход, включая смену) |
| `modules/stream/src/student/uc/complete-student.uc.test.ts` | 75 | админ, не ментор потока — Ok | Б-1 | удалить | `domain/src/stream/student/student.policy.test.ts:67` (`canComplete`: админ — allowed) |
| `modules/stream/src/student/uc/complete-student.uc.test.ts` | 79 | студент в статусе %s — STUDENT_NOT_COMPLETABLE «Нельзя завершить студента: он не учится.» (×2) | Б-1 | удалить | `domain/src/stream/student/student.ar.test.ts:215` (`enrolled`/`abandoned` — `STUDENT_NOT_COMPLETABLE`) |
| `modules/stream/src/student/uc/complete-student.uc.test.ts` | 121 | %s — ACCESS_DENIED «Недостаточно прав для завершения студента» (×2) | Б-1 | удалить | `domain/src/stream/student/student.policy.test.ts:67`, `:71` |
| `modules/stream/src/student/uc/complete-student.uc.test.ts` | 135 | вызывающий guest — UNAUTHORIZED | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/stream/src/student/uc/drop-student.uc.test.ts` | 67 | из %s — STUDENT_NOT_STUDYING «Нельзя снять студента с учёбы: он уже не учится.» (×3) | Б-1 | удалить | `domain/src/stream/student/student.ar.test.ts:140` |
| `modules/stream/src/student/uc/drop-student.uc.test.ts` | 91 | студент из другого потока (не streamId входа) — STUDENT_NOT_FOUND (Т8) | Б-6 | удалить | `modules/stream/src/student/uc/complete-student.uc.test.ts:113` (одна проверка ветки на модуль), `domain/src/stream/student/student.policy.test.ts:26` (владение решает право), `domain/src/stream/stream-members.dqs.test.ts:45` (фильтр по потоку) |
| `modules/stream/src/student/uc/drop-student.uc.test.ts` | 98 | %s — ACCESS_DENIED «Вы не можете выйти из чужого потока» (×3) | Б-1 | удалить | `domain/src/stream/student/student.policy.test.ts:38` (`isSelf` — чужой студент / ментор / админ), `:50` (без субъекта) |
| `modules/stream/src/student/uc/drop-student.uc.test.ts` | 113 | вызывающий guest — UNAUTHORIZED | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/stream/src/student/uc/enroll-student.uc.test.ts` | 81 | статус потока %s зачислению не мешает (как в legacy) (×4) | Б-6 | переписать | — (оставить один кейс `active`: сторож «UC не начал читать статус потока»; четыре статуса — одно и то же поведение) |
| `modules/stream/src/student/uc/enroll-student.uc.test.ts` | 89 | верное кодовое слово — Ok | Б-1 | удалить | `domain/src/stream/student/student.rules.test.ts:65` (ключ совпал — ok) |
| `modules/stream/src/student/uc/enroll-student.uc.test.ts` | 94 | ушедшие и завершённые записи не мешают | Б-1 | удалить | `domain/src/stream/student/student.rules.test.ts:96` (только запись в статусе %s — ok) |
| `modules/stream/src/student/uc/enroll-student.uc.test.ts` | 117 | вызывающий guest — UNAUTHORIZED | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |
| `modules/stream/src/student/uc/enroll-student.uc.test.ts` | 131 | ключ задан, введено %p — STUDENT_WRONG_ENROLLMENT_KEY «Неверное кодовое слово» (×3) | Б-1 | удалить | `domain/src/stream/student/student.rules.test.ts:75` (неверный ключ — отказ) |
| `modules/stream/src/student/uc/enroll-student.uc.test.ts` | 145 | живая запись %s в другом потоке — STUDENT_ALREADY_STUDYING (×2) | Б-1 | удалить | `domain/src/stream/student/student.rules.test.ts:108` |
| `modules/stream/src/student/uc/enroll-student.uc.test.ts` | 159 | живая запись в этом же потоке — тоже STUDENT_ALREADY_STUDYING | Б-1 | удалить | `domain/src/stream/student/student.rules.test.ts:122` |
| `modules/stream/src/student/uc/enroll-student.uc.test.ts` | 164 | в потоке нет шагов — STUDENT_NO_STEPS | Б-1 | удалить | `domain/src/stream/student/student.rules.test.ts:171` (`streamHasSteps`: пустой снимок, уроки без шагов) |
| `modules/stream/src/student/uc/enroll-student.uc.test.ts` | 204 | admitted (курса нет или модуль входной) — Ok | Б-1 | удалить | `domain/src/stream/student/student.rules.test.ts:134` (вердикт admitted — ok) |
| `modules/stream/src/student/uc/enroll-student.uc.test.ts` | 209 | closed — STUDENT_PREREQUISITE_NOT_PASSED с «предыдущий» | Б-1 | слить в `modules/stream/src/student/uc/enroll-student.uc.test.ts:215` | — (в `:215` `it.each` по двум вердиктам: closed / previous-not-passed) |
| `modules/stream/src/student/uc/enroll-student.uc.test.ts` | 215 | previous-not-passed — отказ с названием модуля из вердикта и текстом «Сначала пройдите предыдущий модуль» | Б-1 | переписать | — (приёмник слияния: `it.each` вердиктов, payload `moduleTitle`, без проверки `label`) |
| `modules/stream/src/student/uc/enroll-student.uc.test.ts` | 248 | not_advanced не «прошёл» — passedModuleIds пуст, отказ | Б-1 | удалить | `domain/src/stream/passed-modules.dqs.test.ts:39` |
| `modules/stream/src/student/uc/enroll-student.uc.test.ts` | 265 | прошёл другой модуль — в passedModuleIds только он | Б-1 | удалить | `domain/src/stream/passed-modules.dqs.test.ts:60` |
| `modules/stream/src/student/uc/enroll-student.uc.test.ts` | 290 | записи другого пользователя не учитываются | Б-10 | удалить | `modules/stream/src/infra/student.json-repo.test.ts:266` (`findByUser` фильтрует по полю) |
| `modules/stream/src/student/uc/get-active-student.uc.test.ts` | 66 | поток без кодового слова в виде: только requiresEnrollmentKey | Б-1 | удалить | `domain/src/stream/stream/stream.ar.test.ts:251` |
| `modules/stream/src/student/uc/get-active-student.uc.test.ts` | 76 | %s — пустой ответ, без ошибки (×2) | Б-6 | переписать | — (оставить кейс «записей нет»; «только терминальные» — `:57`) |
| `modules/stream/src/student/uc/get-active-student.uc.test.ts` | 87 | доступен гостю (allowAll): ответ тот же | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:179` |
| `modules/stream/src/student/uc/get-student-by-user.uc.test.ts` | 61 | вид без notices, с исходом и признаками | Б-1 | удалить | `domain/src/stream/student/student.ar.test.ts:421` (`inProgress`, не `passed`), `:397` (state без notices) |
| `modules/stream/src/student/uc/get-student-by-user.uc.test.ts` | 83 | записи другого пользователя не возвращаются | Б-10 | удалить | `modules/stream/src/infra/student.json-repo.test.ts:266` |
| `modules/stream/src/student/uc/get-student-by-user.uc.test.ts` | 91 | событий и записи нет | Б-9 | удалить | нигде: в `GetStudentByUserUc.execute` нет ни `save`, ни `register` — писать и публиковать нечему |
| `modules/stream/src/student/uc/get-student-progress.uc.test.ts` | 102 | прогресс виден любому: чужой студент, ментор, гость | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:179` |
| `modules/stream/src/student/uc/get-student-progress.uc.test.ts` | 121 | чтение не пишет и не публикует | Б-9 | удалить | нигде: в `GetStudentProgressUc.execute` нет ни `save`, ни `register` |
| `modules/stream/src/student/uc/get-student-progress.uc.test.ts` | 133 | lagLevel и hoursSinceLastActivity совпадают с roster состава потока | Б-11 | переписать | — (ожидание литералами `lagging` и `100`, без `new StreamMembersDqs` в тесте; значения — `domain/src/stream/stream-members.dqs.test.ts:86`, `:109`) |
| `modules/stream/src/student/uc/mark-abandoned.uc.test.ts` | 66 | enrolled тоже снимается | Б-1 | удалить | `domain/src/stream/student/student.ar.test.ts:152` (`it.each`: enrolled/active × обе причины) |
| `modules/stream/src/student/uc/mark-abandoned.uc.test.ts` | 72 | админ, не ментор потока — Ok | Б-1 | удалить | `domain/src/stream/student/student.policy.test.ts:67` (`canMarkAbandoned`: админ — allowed) |
| `modules/stream/src/student/uc/mark-abandoned.uc.test.ts` | 76 | студент в статусе %s — STUDENT_NOT_STUDYING (×3) | Б-1 | удалить | `domain/src/stream/student/student.ar.test.ts:176` |
| `modules/stream/src/student/uc/mark-abandoned.uc.test.ts` | 104 | студент из другого потока (не streamId входа) — STUDENT_NOT_FOUND (Т8) | Б-6 | удалить | `modules/stream/src/student/uc/complete-student.uc.test.ts:113`, `domain/src/stream/student/student.policy.test.ts:26`, `domain/src/stream/stream-members.dqs.test.ts:45` |
| `modules/stream/src/student/uc/mark-abandoned.uc.test.ts` | 115 | %s — ACCESS_DENIED «Недостаточно прав для снятия студента с учёбы» (×2) | Б-1 | удалить | `domain/src/stream/student/student.policy.test.ts:71` |
| `modules/stream/src/student/uc/mark-abandoned.uc.test.ts` | 129 | вызывающий guest — UNAUTHORIZED | Б-9 | удалить | `node_modules/dmg-core/src/app/use-case/use-case-from-def.test.ts:123` |

## Переписать, слить, перенести

**Переписать (9)**

1. `modules/stream/src/stream.module.map.test.ts:51` — сократить до единственного теста состава модуля: `Object.keys(streamMap.useCases)`/`.jobs` сравнить с именами из `StreamModuleDef.useCases`/`.jobs` (без списка имён литералами), `streamMap.reactions` — `{}`, добавить `dependsOn: ['user', 'course']`. Тест паспорта модуля `domain/src/stream/stream.module.test.ts:15` — паспорт Def (Б-7) и уходит параллельной таблицей, поэтому `dependsOn` держим здесь.
2. `modules/stream/src/stream/uc/manage-stream.uc.test.ts:128` — оставить кейс `active` (`STREAM_NOT_ENROLLING` + «ничего не записано»), два других статуса — перечисление в тесте правила.
3. `modules/stream/src/stream/uc/manage-stream.uc.test.ts:162` — оставить кейс `enrollment` (`STREAM_NOT_ACTIVE`).
4. `modules/stream/src/stream/uc/manage-stream.uc.test.ts:190` — оставить кейс `enrollment`; `label` не проверять (TST-09).
5. `modules/stream/src/stream/uc/stream-students.uc.test.ts:130` — оставить кейс `active` `STREAM_STUDENTS_IN_PROGRESS` с `pending`; `enrolled` — тест правила.
6. `modules/stream/src/student/uc/enroll-student.uc.test.ts:81` — оставить кейс `active`: сторож «UC не начал читать статус потока».
7. `modules/stream/src/student/uc/enroll-student.uc.test.ts:215` — приёмник слияния `:209`: `it.each` по двум вердиктам (`closed` → `{ moduleTitle: 'предыдущий' }`, `previous-not-passed` → `{ moduleTitle: 'Основы' }`); `label` не проверять.
8. `modules/stream/src/student/uc/get-active-student.uc.test.ts:76` — оставить кейс «записей нет»; «только терминальные» уже покрыт `:57`.
9. `modules/stream/src/student/uc/get-student-progress.uc.test.ts:133` — ожидание литералами (`lagLevel: 'lagging'`, `hoursSinceLastActivity: 100`), без `StreamMembersDqs` в тесте (Б-11); проверка отставания остаётся в DQS.

**Слить (6)**

1. `modules/stream/src/infra/student.json-repo.test.ts:300` → `:285` — в `:285` добавить кейс «в файле только терминальные записи → `[]`».
2. `modules/stream/src/stream/uc/create-stream.uc.test.ts:97` → `:48` — в сквозной успех `:48` добавить проверку `env.ctx.published` (`stream.stream.created`, payload `{ streamId, moduleId }`): «публикация» по решению задачи остаётся у UC, но отдельный `it` на тот же вызов не нужен.
3. `modules/stream/src/stream/uc/manage-stream.uc.test.ts:119` → `modules/stream/src/stream/uc/stream-students.uc.test.ts:84` — единственное место сценария «activate без первого шага»: проверить, что поток `active`, а студенты не записаны.
4. `modules/stream/src/stream/uc/read-stream.uc.test.ts:137` → `:117` — `:117` становится `it.each` по фильтрам: полный, только `schoolId`, пустой.
5. `modules/stream/src/stream/uc/read-stream.uc.test.ts:145` → `:117` — строка «пустой фильтр — все потоки» (гость допущен — платформа).
6. `modules/stream/src/student/uc/enroll-student.uc.test.ts:209` → `:215` — см. «Переписать» п. 7.

**Перенести (0)** — переносов в домен нет: доменные сценарии уже на месте, дубли наверху удаляются.

**Остаются, хотя инвентаризация называла кандидатами** (см. «Итог»): `modules/stream/src/stream/uc/read-stream.uc.test.ts:43`, `:62`, `:94`, `:224`, `:234`; `modules/stream/src/stream/uc/create-stream.uc.test.ts:91`; `modules/stream/src/stream/uc/stream-students.uc.test.ts:84`; `modules/stream/src/student/uc/complete-student.uc.test.ts:113`; `modules/stream/src/student/uc/enroll-student.uc.test.ts:282`; `modules/stream/src/infra/student.json-repo.test.ts:152`, `:197`.

**Отложить: удалить с кодом (Б-13)** — нет: мёртвых экспортов в области не нашлось.

## Остающиеся проверки `label`

Решения требуют не тестировать тексты `label` ошибок (TST-09). Отдельные `it` с `label` уходят вместе со строками таблицы (`manage-stream.uc.test.ts:204`, `:190` — при сокращении, `complete-step.uc.test.ts:123`, `:131`, `complete-student.uc.test.ts:79`, `drop-student.uc.test.ts:67`, `enroll-student.uc.test.ts:131`, `:215`, `get-active-student.uc.test.ts`, `mark-abandoned.uc.test.ts:115` — через `denyMessage`), но одиночные `expect` на `label` остались внутри полезных тестов — их снять в том же срезе:

- `modules/stream/src/stream/uc/manage-stream.uc.test.ts:98` (`STREAM_NOT_FOUND` — «Поток не найден»)
- `modules/stream/src/stream/uc/read-stream.uc.test.ts:78` (`STREAM_NOT_FOUND` — «Поток не найден»)
- `modules/stream/src/student/uc/complete-step.uc.test.ts:113` (`STUDENT_NOT_FOUND` — «Студент не найден»)
- `modules/stream/src/student/uc/get-student-progress.uc.test.ts:118` (`STUDENT_NOT_FOUND` — «Студент не найден»)

`expect(...denyMessage)` внутри удаляемых строк (`manage-stream.uc.test.ts:73`, `complete-student.uc.test.ts:128`, `drop-student.uc.test.ts:106`, `mark-abandoned.uc.test.ts:122`, `create-stream.uc.test.ts:130`) уходят вместе с тестами; `create-stream.uc.test.ts:144` — `label` в заглушке `StubFacade`, не проверка.

## Состав модуля

Тест состава остаётся один — `modules/stream/src/stream.module.map.test.ts:51` (после переписывания): список `useCases` и `jobs` модуля против `StreamModuleDef` + `dependsOn`. Других тестов, закрепляющих состав `stream` (точные списки UC/Job/ошибок/FQN), за границами модуля нет: `platform/app/tests/u7-app.student.test.ts:144` вызывает UC через `dispatch`, но состав не перечисляет. `modules/stream/src/stream.module.test.ts` после удаления двух строк пустеет и удаляется целиком; путь «фасад модуля → UC» остаётся покрыт `module-facade.test.ts:69` (платформа) и сборкой `u7-app.student.test.ts`.

**Вопрос к доменной таблице:** `domain/src/stream/stream.module.student.test.ts:47` тоже объявлен «единственным тестом состава» (паспорт модуля: UC + ER/Job + `dependsOn`). Один модуль — один тест состава (Б-7): либо доменный `:47` перестаёт перечислять UC (только `dependsOn`/агрегаты/ER), либо `stream.module.map.test.ts:51` остаётся тестом карты реализации, а список UC держит домен. Рекомендация: UC-список — в домене (`:47`), в модуле — только соответствие `streamMap` ↔ `StreamModuleDef` без перечисления имён (тогда моя строка `:51` — уже «переписать» в этом смысле).

## Согласование с доменной таблицей

`inventory/stream-domain-delete.md` в колонке «где покрыто» ссылается на строки модуля. Строки, которые этот срез **оставляет** специально как приёмники доменных проверок (иначе доменная ссылка уходит в пустоту): `read-stream.uc.test.ts:43` (домен: `stream.ar.test.ts:263` «view — state как есть» и `stream.uc-defs.test.ts:156`), `:94` (домен: `stream.uc-defs.test.ts:174` — С1, ключ не отдаётся), `create-stream.uc.test.ts:91` (домен: `stream.ar.test.ts:94` — ключа в state нет), `student.json-repo.test.ts:152`, `:197` (домен: `student.state.test.ts:54`, `:73`, `:89`), `enroll-student.uc.test.ts:282` (домен: `passed-modules.dqs.test.ts:69` удалён в «нигде»).

Ссылки доменной таблицы, которые после этой таблицы надо перевести (содержание сохраняется, меняется адрес): `create-stream.uc.test.ts:97` → `:48` (слито); `read-stream.uc.test.ts:145` и `:137` → `:117` (обе стали кейсами `it.each`); `read-stream.uc.test.ts:153` → `:94` (С1 держит `view`, для списка та же сериализация); `stream-students.uc.test.ts:161` → `read-stream.uc.test.ts:207` (тот же UC и та же ветка); `manage-stream.uc.test.ts:65` → `domain/src/stream/stream/stream.policy.test.ts:64` (права остаются в Policy); `manage-stream.uc.test.ts:102` → «нигде»/платформа (`use-case-from-def.test.ts:205` + MAN-06).

## Итог

**Всего строк в таблице: 98** — все 98 — кандидаты инвентаризации, добавленных строк нет.

| действие | строк | выполнений уходит |
|---|---|---|
| удалить | 83 | 114 |
| слить | 6 | 2 |
| переписать | 9 | 10 |
| перенести | 0 | 0 |
| отложить до course-dmg | 0 | 0 |
| отложить: удалить с кодом | 0 | 0 |

**Ожидаемое число тестов: 100** (было 226; уходит 126 выполнений; у `слить`/`переписать` учтён прирост кейсов `it.each` в приёмниках). По файлам: `stream.json-repo` 13→10, `student.json-repo` 14→12, `stream.module` 2→0 (файл удаляется), `stream.module.map` 2→1, `create-stream.uc` 11→5, `manage-stream.uc` 39→9, `read-stream.uc` 23→17, `stream-students.uc` 16→6, `inactivity-sweep.job` 11→2, `complete-step.uc` 12→4, `complete-student.uc` 12→5, `drop-student.uc` 11→3, `enroll-student.uc` 28→11, `get-active-student.uc` 7→4, `get-student-by-user.uc` 6→3, `get-student-progress.uc` 7→5, `mark-abandoned.uc` 12→3.

Оценка инвентаризации (~76) пересмотрена вверх: сохранены сквозные сценарии, которые инвентаризация считала дублями (`create-stream.uc.test.ts:48` с публикацией, `:137` `MODULE_NOT_FOUND`, `read-stream.uc.test.ts:82` — склейка Policy → view, `stream-students.uc.test.ts:84`, `:114`, `:167`, `:194`, `job:61`, `:114`, оба `presence`), часть кандидатов не удалена, а сокращена (пары `it.each`), и 6 строк оставлены приёмниками доменной таблицы (см. «Согласование с доменной таблицей»).

**Кандидатов инвентаризации не вошло в таблицу: 11**

- `modules/stream/src/stream/uc/read-stream.uc.test.ts:62` — приёмник проверки `callers` из `stream.uc-defs.test.ts` (решение 5 задачи): единственное место в модуле, где `callers: ['user', 'guest']` проверяется как отказ для `system`; у остальных `UNAUTHORIZED`-тестов отказ идёт по отсутствию субъекта (это платформа).
- `modules/stream/src/stream/uc/read-stream.uc.test.ts:43`, `:94` — приёмники доменных проверок «view — state как есть» и «С1: ключ не отдаётся» (см. «Согласование»); после удаления всех `кодовое слово не отдаётся` остаётся ровно одна такая проверка на модуль.
- `modules/stream/src/stream/uc/read-stream.uc.test.ts:224`, `:234` — инвентаризация сама предписывала «оставить здесь»: после удаления `stream.module.test.ts` это единственные тесты `presence`.
- `modules/stream/src/stream/uc/create-stream.uc.test.ts:91` — приёмник `stream.ar.test.ts:94` (ключ не попадает в state); тест UC проверяет это на реальной записи.
- `modules/stream/src/stream/uc/stream-students.uc.test.ts:84` — выживший в паре с `manage-stream.uc.test.ts:119` (решение 2 задачи: `activate` без первого шага — один тест, студенческая сторона).
- `modules/stream/src/student/uc/complete-student.uc.test.ts:113` — выживший в тройке `complete-student:113` / `drop-student:91` / `mark-abandoned:104`.
- `modules/stream/src/student/uc/enroll-student.uc.test.ts:282` — «записей нет → отказ»: доменная таблица удаляет `passed-modules.dqs.test.ts:69` в «нигде», UC-уровневая проверка (отказ с `moduleTitle`) остаётся единственной.
- `modules/stream/src/infra/student.json-repo.test.ts:152`, `:197` — приёмники `student.state.test.ts:54`, `:73`, `:89` (legacy-поля `sentAt`/`completionDetails`, смешанный файл с `version`).

**Побочный эффект:** пустеет и удаляется файл `modules/stream/src/stream.module.test.ts`; `manage-stream.uc.test.ts` сжимается с 39 до 9 выполнений.

**Спорные строки:**

1. `modules/stream/src/stream/uc/read-stream.uc.test.ts:62` — не удалён вопреки Б-9: после удаления `stream.uc-defs.test.ts` это единственная проверка узкого `callers` у `GetStreamUcDef`; если доменная таблица считает `callers` покрытым платформой, строку можно удалить.
2. `modules/stream/src/stream/uc/manage-stream.uc.test.ts:119` — удалён, выжил `stream-students.uc.test.ts:84`; доменной таблице ссылку надо перевести на `stream-students:84`.
3. `modules/stream/src/student/uc/complete-student.uc.test.ts:113` — одна проверка `belongsToStream` на модуль: в `dropStudent` и `markAbandoned` ветка «студент из другого потока» остаётся без теста UC (при правке владения её поймают `student.policy.test.ts:26` и `stream-members.dqs.test.ts:45`).
4. `modules/stream/src/stream/uc/create-stream.uc.test.ts:97` — не удалён, а слит в `:48`: «публикация» входит в список того, что по решению задачи остаётся у UC, поэтому проверка сохранена внутри сквозного успеха.
5. `modules/stream/src/stream.module.map.test.ts:51` и `domain/src/stream/stream.module.student.test.ts:47` — оба объявлены «единственным тестом состава»; нужен один (см. «Состав модуля»).
