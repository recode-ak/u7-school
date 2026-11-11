# Plan: user-dmg_20261111

Каждая задача кода идёт по TDD: red → запуск → green. Структуру создаёт `bun run gen … --adopt`. Код пишут роли конвейера, коммитит orchestrator ([agents.md](../../architecture/agents.md) §3).

**Конвейер среза:** `dmg-tech-lead` (бриф) → `dmg-test-designer` (red) → `migrator` (green) → гейт → `dmg-data-keeper` (по триггеру) → `dmg-reviewer` → решение orchestrator.

**Исполнители** — по таблице §2 [deepseek.md](../../architecture/deepseek.md); метка в скобках у задачи:
- **Opus:** orchestrator (в т.ч. приёмка брифов), `dmg-reviewer`.
- **Sonnet:** `dmg-tech-lead`, red-тесты, UI-stories.
- **flash:** через `scripts/pi-role.ts`, один шаг — один `--label`.

После каждого шага на flash — гейт (`bun run scripts/agent-gate.ts`), `git diff --numstat` (не удалены ли проверки) и grep-критерии брифа. Строка расхода по фазе — в `summary.md` → «DeepSeek». Отклонение от таблицы — в отчёт фазы с причиной.

**Режим — автономный** ([agents.md](../../architecture/agents.md) §9). Живые данные трек не трогает: скрипт миграции проверяется на `DB_DIR=./data/fixtures` и копии заготовки; запуск на проде — пункт чек-листа релиза. Решения и входной долг — в [spec.md](./spec.md).

**Перепроектирование** — только с явного разрешения Нурболата: вопрос «сейчас или в `debt.md`», ответ — в TR или `decisions.md` до выполнения.

**Красная зона Ф3–Ф5.** Ф1–Ф2 аддитивны: legacy-UC `user` живут рядом с Def, `check` зелёный. С Ф3 (строгое чтение без `STUDENT`) и Ф4 (резолвер, Policy) могут падать legacy-UC, stories и их integration/e2e. Гейт — `check` зелёный, кроме поимённого списка в `debt.md`; критерий снятия — конец Ф5.

## Фаза 0: База и решения [checkpoint: ca01960]

- [x] Task: Зафиксировать базовую линию в `summary.md`: `CI=true bun test`, `bun run test:bot`, тесты `domain/src/user` и `modules/user`, `dmg-core` `bun test`. Каркас раздела «DeepSeek» (Opus) 5843f1a
- [x] Task: `dmg-tech-lead`: разбор и брифы `slices/user-domain.md`, `slices/user-app.md` (Sonnet): 847b3b7
    - [x] состав UC «переносим / удаляем / перепроектировать» по 9 legacy-UC и методам `UserFacade` с вызывающими;
    - [x] варианты получения API ролей субъектом `Caller` в Policy клиентов (сверка с `wish`/`stream`, D-41);
    - [x] сверка `notify-user`/`user.notified` с `../u7-school-v0.2.6` (есть ли продюсер);
    - [x] список legacy-тестов на перенос (с учётом TST-08) и тестов состава модуля; ID `rules.md`.
- [x] Task: orchestrator проверяет брифы (Opus); вопросы Нурболату — субъект Policy, состав UC (`create-user`, `list-users`, `notify-user`), имя `remove-role-from-user` 19ff0c2
- [x] Task: Записать решения в TR (`debt.md`) и `decisions.md` (Opus) 19ff0c2 — TR-61, DEBT-52; решение пакета — D-69 `dmg-core` (проектный `decisions.md` не менялся)
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md; автономно) ca01960

**Критерии приёмки Фазы 0:**
- Базовая линия (pass/fail по командам) — в `summary.md`.
- Состав UC, субъект Policy и судьба `notify-user` утверждены Нурболатом и записаны.
- Брифы `user-domain` и `user-app` приняты.

## Фаза 1: Домен `user` (аддитивно) [checkpoint: aab0d4f]

- [x] Task: `migrator` S0 (flash): legacy `UserAr`/`UserPolicy`/`UserRepo`/`UserJsonRepo` → `Legacy*` (бриф, шаг 0) 6d840c14
- [x] Task: `dmg-test-designer`: характеризация на `../u7-school-v0.2.6` и red-тесты (Sonnet): 03d6b4f4
    - [x] state `User` с `F.timestamp`, чтение legacy ISO;
    - [x] `UserAr.create`/`restore`, API ролей (по решению Ф0), ошибки;
    - [x] Policy, правила; события — по утверждённому составу (нет, MAN-06); DCS/DQS бриф не предусматривает;
    - [x] перенос сценариев `a-root.test.ts`, `policy.test.ts` (список — в отчёте, TST-08).
- [x] Task: `migrator`, домен (flash): Def, Ar без `#` и `throw*`, правила, ошибки; `UserModuleDef` пока с `external` 03d6b4f4
- [x] Task: `dmg-reviewer` (Opus). Замечания без `error` решает orchestrator (TR), перепроектирование — Нурболату 16a77b00 — `error` нет, 5 info закрыты в срезе
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md; автономно) aab0d4f

**Критерии приёмки Фазы 1:**
- `grep -rnE "throw[A-Z]|new [A-Za-z]*Ar\b|#[a-z]|@u7-scl/(core|app-legacy)"` по Def-файлам `domain/src/user` пуст (удаляемый legacy — исключение поимённо).
- Сценарии `a-root`/`policy` перенесены (список сверен).
- `check` зелёный, тесты не ниже базовой линии, `git status data/` чист.

## Фаза 2: Прикладной слой `modules/user` (аддитивно) [checkpoint: 5045b99]

- [x] Task: `dmg-test-designer`: red-тесты (Sonnet): 54b5f76a
    - [x] UC по утверждённому составу (query и команды);
    - [x] `get-telegram-addresses` настоящим UC (вместо адаптера над `getUserByUuid`);
    - [x] репозиторий через UoW: строгое чтение, legacy ISO → число, round-trip, невалидная запись.
- [x] Task: `migrator`, прикладной слой (flash): Def 7 UC в домене и их регистрация в `UserModuleDef` (перенесено из Ф1, TR-61); UC через `UseCaseFromDef`, репозиторий; legacy-UC живут рядом; тесты состава модуля (`user.module.test.ts`, `u7-app*.test.ts`, `scripts/*.test.ts`) 54b5f76a — эскалации: smoke с одним `requestId` (D-56) исправлен; DEBT-44 снят из `debt.md` уже в Ф2 (`arch:check` требует снять запись без маркера)
- [x] Task: `dmg-data-keeper` (flash): чтение `users.json` (копия заготовки и `DB_DIR=./data/fixtures`), записи в живые данные нет — совместимо; риск выкатки (оба писателя на один файл) — в отчёте брифа
- [x] Task: `dmg-reviewer` (Opus) 2291a904 — `error` нет, 2 warn и 6 info закрыты в срезе
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 2:**
- Те же grep-критерии по Def-файлам `modules/user`.
- В `get-telegram-addresses.uc.ts` нет `legacy.`; маркера DEBT-44 в коде нет.
- `check` зелёный, тесты не ниже базовой линии, `git status data/` чист.

## Фаза 3: Данные и роль `STUDENT` (DEBT-48) [checkpoint: fbdcae4]

- [x] Task: `dmg-test-designer`: red-тесты (Sonnet): скрипт `scripts/migrate-users-drop-student.ts` (сухой прогон по умолчанию, запись по флагу, идемпотентность); строгое чтение записи со `STUDENT` — ошибка e7298e73
- [x] Task: `migrator` (flash): скрипт; удалить `Role.STUDENT`, `isStudent`, исключения `canAddRole`/`canRemoveRole`; убрать `STUDENT` из фикстур модулей, тестовых миров и тестов; `bun run seed:fixtures` e7298e73 — DEBT-48 снят из `debt.md` (`arch:check`), итог в TR-61
- [x] Task: `dmg-data-keeper` (flash): прогон скрипта на копии фикстур и копии заготовки; откат; живые данные не трогаются e26d667b — дефект проверки `invalid` (`UserState` → `UserArDef.state`) исправлен в срезе; порядок релиза — миграция до выкатки
- [x] Task: Записать красную зону в `debt.md` поимённо (если есть), критерий снятия — конец Ф5 (Opus) — красной зоны нет: полный `check` зелёный (3171 pass)
- [x] Task: `dmg-reviewer` (Opus) 9d522023 — `error` нет; 1 warn + 2 info закрыты в срезе, 2 info приняты (TR-61 «Ф3»)
- [x] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 3:**
- `grep -rn "Role.STUDENT\|isStudent" --include=*.ts .` пуст (вне `node_modules`).
- Тест скрипта: сухой прогон, запись, повтор.
- `check` зелёный, кроме поимённой красной зоны в `debt.md`; `git status data/` чист.

## Фаза 4: Резолвер `Caller` и Policy клиентов [checkpoint: aa874174]

- [x] Task: `dmg-tech-lead`: бриф `slices/caller.md` (Sonnet; шага не было в плане — форма фикстуры субъекта отложена на бриф Ф4, Р9 `user-domain`); фикстура — общий `@u7-scl/domain/user/testing` (Нурболат) 26d341b6
- [x] Task: `dmg-test-designer`: red-тесты (Sonnet): резолвер `Caller` на Def (`dispatch` UC `user`; сбой — ERR-01); Policy `course`/`stream`/`questionnaire` и `submenu` — на API ролей (способ — решение Ф0) 26d341b6
- [x] Task: `migrator` (flash): резолвер вместо `U7CallerResolver`; 5 Policy и `submenu.ts`; `Role` убран из `contract.ts`; фикстуры клиентов 26d341b6 — эскалация: вход `testing` в платформе (D-70, `dmg-core@d2128ce`, Opus — решение Нурболата), проектный дубль проверки удалён
- [x] Task: `dmg-reviewer` (Opus) 26d341b6 — `error` нет; 1 warn (TST-08) и 4 info закрыты в срезе, остальные приняты (TR-61 «Ф4»)
- [x] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 4:**
- `grep -rn "roles.includes(Role\.\|roles.some(" domain/src modules runners/u7-bot/src` пуст вне `user` (`tests/worlds/invariants.ts` — по решению).
- `Role` не экспортируется из `domain/src/user/contract.ts`; TR-33, TR-40 — к снятию.
- `check` зелёный, кроме поимённой красной зоны в `debt.md`.

## Фаза 5: UI бота [checkpoint: bcec82bc]

- [x] Task: `dmg-tech-lead`: бриф `slices/ui.md` с «Сохраняемым поведением» — регистрация, роли, меню, анкеты, уведомления; эталон `../u7-school-v0.2.6` (Sonnet); приёмка — Opus d006057a — О1: актор `ReadonlyAr<UserAr>` (Нурболат), мост Р5 снимается в Ф5
- [x] Task: `dmg-test-designer`: перевод тестов бота на Def-имена (литералы `'get-user'` и др., кит анкет) и red-тесты (Sonnet) 99c6da92 — 2 круга (смена О1 на `Caller`, Нурболат)
- [x] Task: UI-stories: `ensure-registered`, `school/controller`, `ui-app`/`create-ui-app`, адрес респондента анкет (TR-49 (6)) — Sonnet; механика `get-user`/`get-users-by-ids` в `streams`, `learning`, `peer-review`, `u7-cli`, `test-bot-transport` — flash 99c6da92 — актор `UserCaller<ReadonlyAr<UserAr>>`, `platform/core/src/ui/bot` — `TActor extends PersonCaller` (Нурболат); `resolveByTelegramId` в резолвере (TR-61 «Ф5»)
- [x] Task: Снять красную зону в `debt.md` (Opus) 99c6da92 — красной зоны не было (Ф3); мост `subjectOf` снят, TR-61 «Ф5»; мост `call-uc`/`_course-client` до Ф6
- [x] Task: `dmg-reviewer` (Opus) 99c6da92 — 1 `error` (актор в мете логов) и 4 `warn` исправлены, повторное ревью — `error` нет
- [x] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 5:**
- В `runners` нет вызовов legacy-имён UC `user` через `appApi.execute` (с учётом многострочных) и `userFacade.`.
- Поведение — как в `v0.2.6` (характеризация), кроме одобренных перепроектирований.
- `check` целиком зелёный, `test:bot` и e2e не ниже базовой линии с поправкой на удалённые UC; красной зоны в `debt.md` нет.

## Фаза 6: Сборка и снятие legacy

- [ ] Task: Бриф `slices/assembly.md` (Opus, решения — TR)
- [ ] Task: `migrator`, сборка (flash): `UserModuleDef` без `external`, фабрика в `U7App`, `@u7-scl/user/**` — в ARC-07 `biome.json`
- [ ] Task: `migrator`, удаление legacy и клиенты сборки (flash): `UserInProcFacade`, `UserApiModule`, `api/*`, `module.ts`, `facade.ts`, `commands/*`, legacy-репозиторий, поле `userFacade` и тип `UserLegacy` в `platform/app`; `tests/helpers/test-app.ts`, `scripts/{call-uc,_course-client,domain-arch}.ts`, тестовые миры
- [ ] Task: `dmg-data-keeper` (flash): скрипты на `DB_DIR=./data/fixtures` — вывод совпадает с `v0.2.6`
- [ ] Task: `dmg-reviewer` (Opus)
- [ ] Task: Conductor - User Manual Verification 'Фаза 6' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 6:**
- `grep -rn "UserApiModule\|UserInProcFacade\|UserFacade\|UserLegacy" --include=*.ts .` пуст; `U7CallerResolver` — на Def с Ф4 (вне `node_modules`).
- У `UserModuleDef` нет `external`; `lint` (ARC-07) и `arch:check` зелёные.
- Маркеров DEBT-1, 2, 5, 34, 44 в `user` нет.
- `check` зелёный, `git status data/` чист.

## Фаза 7: Barrel-реэкспорты (DEBT-3)

- [ ] Task: `migrator`, механика (flash): импорты `@u7-scl/user/domain` (46), `@u7-scl/app-legacy/domain` ради `User`/`Role` (102), корень `app-legacy` (8), `@u7-scl/{course,stream,wish}/domain` (11) — на контракт `user` / `@u7-scl/domain/<m>`; удалить 6 `modules/*/src/domain/index.ts`, их пути в `tsconfig.json`, `exports "./domain"`, `platform/app-legacy/src/domain/user.ts`. После шага — `tsc --noEmit` и grep
- [ ] Task: Записать остаток DEBT-3 — `modules/dossier/src/index.ts`, владелец — трек `dossier` (Opus)
- [ ] Task: `dmg-reviewer` (Opus)
- [ ] Task: Conductor - User Manual Verification 'Фаза 7' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 7:**
- `grep -rn "@u7-scl/[a-z-]*/domain['\"]" --include=*.ts --include=*.json .` пуст (вне `node_modules`, `conductor`).
- `modules/*/src/domain/index.ts` нет; DEBT-3 в `debt.md` — только `modules/dossier/src/index.ts`.
- `check` зелёный, `arch:check` синхронен.

## Фаза 8: Итог

- [ ] Task: Гейт закрытия: `CI=true bun test`, `bun run test:bot`, `dmg-core` `bun test` — сравнение с базовой линией в `summary.md` (Opus)
- [ ] Task: Документы (Opus):
    - [ ] `debt.md` — снять DEBT-1, 2, 5, 34, 48 (user; DEBT-44 снят в Ф2), DEBT-3 (кроме `dossier`); закрыть TR-33, TR-40, TR-49 (6);
    - [ ] `migration.md` §6 — состояние, чек-лист релиза (`bun run backup` → скрипт миграции `STUDENT` → подтверждение Нурболата; legacy-писателя `users.json` в релизе нет — иначе потеря записей, отчёт data-keeper Ф2), следующий трек;
    - [ ] `deepseek.md` — сверка таблицы §2 с данными трека;
    - [ ] `summary.md` — таблица критериев spec и строка «DeepSeek».
    - [ ] упоминания роли `STUDENT` в документах (`README.md`, `runners/u7-bot/src/controllers/learning/ui-spec.md`, `courses/content-nav.md`, `modules/stream/src/analysis.md`, `TODO.md`) — ревью Ф3;
    - [ ] чек-лист релиза: миграция `STUDENT` — ДО выкатки нового кода, бэкап `--name=before-drop-student`; проверка живого `users.json` (записи со `STUDENT`, без `updatedAt`) — Нурболат (отчёт `dmg-data-keeper` Ф3).
- [ ] Task: Conductor - User Manual Verification 'Фаза 8' (Protocol in workflow.md; автономно)

**Критерии приёмки Фазы 8:**
- Все критерии приёмки spec выполнены (таблица в `summary.md`).
- `arch:check` чист, `debt.md` и `migration.md` синхронны с кодом.
