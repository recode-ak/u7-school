# Plan: stream-dmg_20261103

Каждая задача кода идёт по TDD: red → запуск → green. Структуру создаёт `bun run gen … --adopt`. Код пишут роли конвейера, коммитит orchestrator ([agents.md](../../architecture/agents.md) §3).

**Конвейер среза:** `tech-lead` (бриф) → `test-designer` (red) → `migrator` (green) → гейт → `data-keeper` (по триггеру) → `reviewer` → решение orchestrator.

**Учёт пилота (второй трек):** после каждого вызова роли в `summary.md` → «Пилот ролей» добавляется строка: роль, задача, модель, повлиял ли отчёт на решение, сколько замечаний принято из общего числа, правился ли промпт. Промпты в треке не правятся.

**Режим — автономный** ([agents.md](../../architecture/agents.md) §9). В `data/` не пишем. Решения и входной долг — в [spec.md](./spec.md).

**Перепроектирование** — только с разрешения Нурболата. Предложение из брифа, отчёта или находки оформляется как вопрос «сейчас или в `debt.md`»; ответ записывается в TR или `decisions.md` до выполнения.

**Красная зона Ф1–Ф2.** После Ф1 legacy-код студента может не прочитать поток, записанный новым репозиторием (моста нет — решение spec). Гейт Ф1: `check` зелёный, кроме тестов из записи красной зоны в `debt.md` (список поимённо, критерий снятия — конец Ф2). С конца Ф2 — `check` полностью зелёный.

## Фаза 0: База и решения

- [x] Task: Зафиксировать базовую линию в `summary.md`: `CI=true bun test`, `bun run test:bot`, тесты `domain/src/stream` и `modules/stream`, `dmg-core` `bun test`; каркас раздела «Пилот ролей» `df4a6dc`
- [x] Task: Решение по TR-8 (c с опорой на d) — в `debt.md` (TR-8: вопрос закрыт) и `decisions.md`; TR экспорта `Role` из контракта `user` (снимает перевод `user`) `702d6df`
- [~] Task: `tech-lead`: бриф `slices/stream.md` — 9 UC → «состав потока» (слияние), `findStreamByTelegramGroup`; `stream.created` как Def, удаление `stream.completed`; Policy с ролями через `Role` контракта `user`; DCS/DQS из `StreamDs` по TR-8; Def UC `course` (снимок модуля, `ContentSnapshot` в контракте `course`); DEBT-35 (`invitedStreamIds` в state `wish`); stories и клиенты потока; ожидаемая красная зона; ID rules.md; проверка брифа orchestrator'ом, вопросы перепроектирования — Нурболату
- [ ] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 0:**
- Базовая линия (числа pass/fail по командам) — в `summary.md`.
- TR-8 без открытого вопроса; запись в `decisions.md`; TR экспорта `Role` в `debt.md`.
- Бриф `slices/stream.md` покрывает все пункты задачи; открытых стратегических вопросов нет.

## Фаза 1: Срез `stream`

- [ ] Task: `test-designer`: характеризация на `v0.2.6` — `create`, `activate`, `archive`, `complete`, `get`, `list`, `list-students`, `getStreamMembers`, `getStreamPresence`; ER `invite-wishers` на повторное `stream.created`; red-тесты Def-контрактов среза, тест идемпотентности DEBT-35 (ждёт успеха)
- [ ] Task: `migrator`: домен — state (`F.timestamp`, DEBT-5 в части потока), `StreamArDef` и Ar, события, ошибки, Policy и правила, DCS/DQS по TR-8; без `core`/`app-legacy` и чужого `index`
- [ ] Task: `migrator`: внешние контракты — экспорт `Role` из контракта `user`; Def UC и адаптер `course` для снимка модуля, `ContentSnapshot` в контракте `course`
- [ ] Task: `migrator`: прикладной слой — Def UC (`UseCaseFromDef`), «состав потока», `findStreamByTelegramGroup`, репозиторий через UoW (строгий разбор) с тестом на `DB_DIR=./data/fixtures`; адаптеры TR-11 `getStreamMembers`/`getStreamPresence` у `wish` и `peer-review` заменены настоящими UC; фабрика в `U7App`
- [ ] Task: `migrator`: DEBT-35 — `invitedStreamIds` в state желания (необязательное поле), правило отсева повтора в ER `invite-wishers`; `stream.created` от агрегата на Def, не через `inbound`
- [ ] Task: Stories и клиенты потока → `dispatch`: `mentor/*` (create, activate, my-streams, submenu, view-stream-mentor — часть потока), `streams/*` (catalog, view-stream — часть потока, `controller` через `findStreamByTelegramGroup`), `courses/wish-*`, `peer-review/*` (`get-stream`), `school-reviews`; e2e потока зелёные
- [ ] Task: Запись красной зоны в `debt.md`: поимённый список падающих тестов студента, критерий снятия — конец Ф2
- [ ] Task: `data-keeper`: state и репозиторий `stream`, `update-stream-snapshot`, state `wish` — чтение `streams.json` и `wishes.json`, смешанные ISO/число, ленивая конвертация, откат
- [ ] Task: `reviewer`; замечания без `error` решает orchestrator (TR), предложения перепроектирования — Нурболату
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 1** (уточняет бриф `slices/stream.md`):
- `domain/src/stream/stream/**` и `modules/stream/src/stream/**`: нет `throw*` для штатных отказов, `new StreamAr`, импортов `@u7-scl/core` и `@u7-scl/app-legacy`.
- UC потока — через `UseCaseFromDef`, `checkDefs` зелёный; адаптеров TR-11 stream у `wish` и `peer-review` нет; `stream.completed` удалён.
- `grep -rn "'create-stream'\|'activate-stream'\|'archive-stream'\|'complete-stream'\|'get-stream'\|'list-streams'" runners scripts` — пусто.
- DEBT-35: тест повторного `stream.created` ждёт успеха и зелёный, маркера нет.
- Тесты репозитория: legacy-запись (ISO → число, `version`), round-trip, невалидная запись — исключение, файл цел.
- Сценарии старых тестов потока перенесены (список — отчёт `test-designer`).
- `bun run check` зелёный, кроме тестов из записи красной зоны; `git status data/` чист.

## Фаза 2: Срез `student`

- [ ] Task: `tech-lead`: бриф `slices/student.md` — 7 UC (без `set-next-preference`), `getActiveStudent`, Job `inactivity-sweep` (`JobFromDef`); события `enrolled`/`completed`/`abandoned`/`inactivity-*` как Def (inactivity — без `telegramId`); `complete(outcome)` без `abandoned`; правило зачисления в правилах студента (факты из DQS и Def UC `course`); запись `StreamDs` (`completeStep`, `tryIssueTailStep`) в Ar/DCS, UI-расчёты — DQS (query UC — при веских причинах); уведомления — stories по событиям (D-41); снятие красной зоны; вопросы перепроектирования — Нурболату
- [ ] Task: `test-designer`: характеризация на `v0.2.6` — `enroll` (кодовое слово, конфликт активной записи, gate модуля, нет шагов), `complete-step`, `complete` (исходы, тексты), `drop`, `mark-abandoned` (тексты уведомлений), `get-by-user`, `get-progress`; Job — пороги 5/7 дней, повтор через день, сброс, сбой одного студента не прерывает обход; red-тесты Def-контрактов
- [ ] Task: `migrator`: домен — state, `StudentArDef` и Ar (без `#…`), события, ошибки, Policy и правила, DCS/DQS из `StreamDs`; DEBT-1, 2, 5, 10 в части stream — маркеров нет
- [ ] Task: `migrator`: прикладной слой — Def UC, `getActiveStudent`, Job, репозиторий студентов через UoW с тестом на фикстурах; в stream нет `addRoleToUser`/`removeRoleFromUser`; `set-next-preference` удалён
- [ ] Task: `migrator`: подписчики на Def-события студента напрямую — ER `fulfill-wish` (`wish`), `create-student-campaign` (`peer-review`); `student.*` из `streamLegacyInbound` снят
- [ ] Task: UI → `dispatch` и подписки Def: `learning/*` (hub — меню через `getActiveStudent`, подписка на `completed`; shared, progress, step-view, nav-resolver — DQS/UC), `streams/stories/inactivity` (адрес через `GetTelegramAddressesUcDef`), `view-stream` (enroll, progress), `mentor/monitor`, `view-stream-mentor` (часть студента), `streams/controller` (без `new StudentAr`), stories уведомлений `complete`/`drop`/`mark-abandoned`, `scripts/gen-e2e`; инвариант миров `STUDENT_ROLE_MISMATCH` снят; e2e на каждое событие, получаемое ботом
- [ ] Task: Снять запись красной зоны из `debt.md`
- [ ] Task: `data-keeper`: state и репозиторий студента, `notices`, смешанные даты в `students.json`
- [ ] Task: `reviewer`; замечания без `error` решает orchestrator (TR), предложения перепроектирования — Нурболату
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 2** (уточняет бриф `slices/student.md`):
- Во всём `domain/src/stream/**` и `modules/stream/src/**` (кроме legacy, удаляемого в Ф3): нет `throw*` для штатных отказов, `new …Ar`, `#` в Ar, импортов `core` и `app-legacy`.
- DEBT-1, 2, 5, 10 в части stream — маркеров нет; `arch:check` — нарушений нет.
- `grep -rn "Role.STUDENT\|isStudent\|addRoleToUser\|removeRoleFromUser" domain/src/stream modules/stream runners/u7-bot/src` — пусто; из `modules/user` и `domain/src/user` ничего не удалено.
- `grep -rn "'student\.\(enrolled\|completed\|abandoned\|inactivity" runners` — пусто: бот подписан на Def.
- Job — через `JobFromDef`; сценарии старых тестов студента, Job и `stream-ds.test.ts` перенесены (список — отчёт `test-designer`).
- Записи красной зоны в `debt.md` нет; `bun run check` полностью зелёный; `test:bot` — не меньше базовой линии; `git status data/` чист.

## Фаза 3: Сборка и снятие legacy

- [ ] Task: `tech-lead` или orchestrator: бриф `slices/assembly.md` по образцу `peer-review`
- [ ] Task: `migrator`: `StreamModuleDef` без `external`; фабрика в `U7App` без legacy-резолвера; `@u7-scl/stream/**` в группу ARC-07 `biome.json`
- [ ] Task: `migrator`: удалить `StreamApiModule` (`modules/stream/src/api/`), `domain/src/stream/module.ts`, `commands/*-cmd.ts`, `StreamFacade`, `StreamInProcFacade`, `streamLegacyInbound`, legacy-репозитории, `stream-uc.ts`; `legacy.stream` и `inbound` в `u7-app.ts`, `u7-app-meta.ts`, `u7-app.types.ts`; DEBT-34 в части `stream`
- [ ] Task: `migrator`: `tests/helpers/test-app.ts`, миры (`builder`, `types`, `invariants`), скрипты (`update-stream-snapshot` — `version` и числовые даты, `stream-snapshot-sync`) — на модуль Def и типы контракта; `platform/app/tests/u7-app.test.ts`
- [ ] Task: `reviewer`; замечания без `error` решает orchestrator (TR)
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 3:**
- `grep -rn "StreamApiModule\|StreamInProcFacade\|streamLegacyInbound\|StreamJsonRepo" --include=*.ts .` — пусто; импорты `@u7-scl/stream/domain` — только barrel DEBT-3.
- `StreamModuleDef` без `external`; `checkDefs` и `bun run lint` (ARC-07) зелёные; DEBT-34 в части `stream` — маркеров нет.
- Сценарии удалённых тестов сверены с новыми (список в отчёте); `bun run check` зелёный; `test:bot` — не меньше базовой линии.

## Фаза 4: Финал

- [ ] Task: Гейт закрытия ([workflow.md](../../workflow.md)): `CI=true bun test`, `test:bot`, `dmg-core`, триаж и сравнение с базовой линией — в `summary.md`
- [ ] Task: Итог пилота за два трека: каждая роль по критериям §5 [agent-roles.md](../../architecture/agent-roles.md) — окончательное решение; решение о волне 2
- [ ] Task: [debt.md](../../architecture/debt.md) — DEBT-1, 2, 5, 10 (stream), 35 и TR-11 (stream) сняты; новый долг роли `STUDENT` и TR экспорта `Role` — трек `user`; долги, отложенные решениями Нурболата
- [ ] Task: [migration.md](../../architecture/migration.md) §6 — состояние, входной долг (алиасы DEBT-16, 17, 19, 20 → 1, 2, 5, 10), следующий трек `questionnaire`
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

**Критерии приёмки Фазы 4** (= критерии spec):
- `CI=true bun test` и `test:bot` — красных нет; регрессов нет; числа и сравнение с базовой линией — в `summary.md`.
- `debt.md` синхронен, `arch:check` — нарушений нет.
- «Пилот ролей» заполнен по всем вызовам, по каждой роли — окончательное решение.
- `migration.md` §6 обновлён; следующий трек — `questionnaire`.

## Покрытие spec

| Критерий spec | Фаза |
|---|---|
| нет `throw*`, `new …Ar`, `#`, импортов `core`/`app-legacy` | 1 (поток), 2 (весь модуль) |
| DEBT-1, 2, 5, 10, 35, TR-8; `arch:check` | 0 (TR-8), 1 (35), 2 (1, 2, 5, 10), 4 (`debt.md`) |
| без `external`, legacy и адаптеры удалены | 1 (адаптеры), 2 (inbound `student.*`), 3 (остальное) |
| нет `STUDENT` в stream и боте; из `user` ничего не удалено | 2 |
| бот подписан только на Def-события | 1 (`stream.created`), 2 (студент) |
| `check` зелёный, reviewer без `error`, красная зона закрыта | каждая фаза; красная зона — 1 (запись), 2 (снятие) |
| `git status data/` чист | каждая фаза |
| «Пилот ролей», решение по ролям | 0–3 (строки), 4 (решение) |
| перепроектирование только с разрешения и с записью | каждая фаза (бриф/ревью → вопрос → TR) |

## Риски

- **Красная зона Ф1–Ф2** на общих `streams.json`/`students.json`: откат после первой записи нового репозитория — только с восстановлением файла из бэкапа (на живых данных трек не работает).
- **`update-stream-snapshot.ts`** пишет файлы в обход репозитория: без `version` и числовых дат строгий разбор остановит модуль.
- **Возможная правка `dmg-core`** (DQS по TR-8, Policy с ролями) — отдельный коммит в репо пакета, `docs:impact`.
- **Объём UI:** `view-stream.story.ts` и `monitor.ts` по 700–950 строк, смешаны оба среза; профильных e2e мало — `test-designer` добирает e2e на сценарии потока и студента.
- **Подписки бота на имена Def:** пропущенная подписка молча гасит уведомление — e2e на каждое событие.
