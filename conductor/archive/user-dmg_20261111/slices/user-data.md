# Бриф среза: `user` / данные и роль `STUDENT` (Ф3, DEBT-48)

> **Статус:** составлен orchestrator (простой срез по готовому образцу, `dmg-tech-lead` не вызывался). Основание — TR-61 (Т6, Т9–Т11), `../spec.md` («Данные»), `../summary.md` → «Ф0: вопросы».

## Цель

Роль `STUDENT` исчезает из кода целиком (enum, picklist, исключения legacy-Policy, фикстуры, тестовые миры, тесты). Чтение `users.json` строгое: запись со `STUDENT` отклоняется. Для живых данных — скрипт миграции, запуск которого — пункт чек-листа релиза (не в треке).

## Границы

**Новое:**
- `scripts/migrate-users-drop-student.ts` и `scripts/migrate-users-drop-student.test.ts`. Образец формы — `scripts/migrate-streams-school-id.ts` и его тест (чистая функция + `runMigration(dbDir)` + `import.meta.main`).

**Изменяется (прод-код):**
- `domain/src/user/user/user.state.ts` — `STUDENT` убирается из `UserRoleName`, комментарий про `STUDENT` снимается.
- `domain/src/user/user/roles.ts` — `Role.STUDENT` и его место в `RoleSchema`, строка JSDoc.
- `domain/src/user/user/policy.ts` (legacy) — исключения `STUDENT` в `canAddRole`/`canRemoveRole` (строки ~32–45): остаётся только ADMIN (как `canManageRoles` нового `UserPolicy`).

**Изменяется (тесты и фикстуры)** — все вхождения из grep ниже, в том числе legacy-тесты (`platform/app-legacy/src/domain/*.test.ts`, `domain/src/user/user/{a-root,policy}.test.ts`, `modules/user/src/api/**`, `modules/user/src/infra/db/user-json-repo.test.ts`), тесты Policy клиентов, фикстуры UC модулей, тесты и миры бота (`runners/u7-bot/tests/worlds/*`, stories).

**Не трогать:** `data/` (в том числе `data/fixtures` — пересобирает orchestrator); Policy клиентов в прод-коде (Ф4); экспорт `Role` из контракта (Ф4); stories (прод-код, Ф5); агрегат студента потока (`domain/src/stream/student/**`, `student.errors.ts` — группа ошибок `STUDENT`, не роль); `isStudentAheadOfStep`, `isStudentActive` — не о роли; `dmg-core`; `conductor/`.

## Решения

**Р1. Скрипт** `scripts/migrate-users-drop-student.ts` (Т9):
- Файл: `<DB_DIR>/users/users.json` (вложенный путь; плоский `<DB_DIR>/users.json` — запасной, как у образца). `DB_DIR` из окружения, по умолчанию `data`. Файла нет — сообщение, итог с нулями.
- Работает по сырому JSON (`Array<Record<string, unknown>>`): снимает `'STUDENT'` из `roles`; если `roles` опустел — `['GUEST']`. Остальные поля (даты, `version`, `nick`, порядок ролей и записей) не трогаются.
- **Сухой прогон по умолчанию** — ничего не пишет, печатает итог. **`--write`** — пишет файл (`JSON.stringify(…, null, 2)`), только если есть что менять.
- **Идемпотентен:** повторный прогон после записи — `migrated: 0`, файл не переписывается.
- **Невалидные записи** (С5): каждая запись *после* снятия `STUDENT` проверяется строгой схемой `UserState` домена (`v.safeParse`); не прошедшие перечисляются в итоге (`uuid` или индекс + текст первой ошибки). Скрипт их не чинит и не удаляет; при `--write` невалидные записи пишутся как есть (только снят `STUDENT`).
- Итог (тип `MigrateUsersResult`): `total`, `migrated` (записей со снятым `STUDENT`), `becameGuest` (из них получили `['GUEST']`), `invalid: { id: string; issue: string }[]`, `written: boolean`.
- Шапка файла — порядок на проде: бот остановлен → `bun run backup before-drop-student` → сухой прогон → разбор `invalid` → `--write` → старт бота на новом коде; без подтверждения Нурболата на проде не запускать.

**Р2. Строгое чтение** — `UserState` без `STUDENT`: запись со `STUDENT` → отказ разбора (тест в `user.state.test.ts` меняет ожидание с «проходит» на «отклоняется»). Новый `UserJsonRepo` поведение «невалидная запись — ошибка» уже имеет (Ф2) — отдельный тест на `STUDENT` в репозитории не нужен, если `user.state.test.ts` его покрывает.

**Р3. Замена `STUDENT` в тестах.** `Role.STUDENT` в тестах `course`/`stream`/`questionnaire`/бота — «роль без прав» (TR-44): заменяется на `Role.GUEST`. Где список ролей уже содержит `GUEST` (`it.each([...])`, массивы `roles`) — `STUDENT` просто удаляется, дубль не вводится. Где тест legacy-репозитория фильтрует по `STUDENT` — берётся роль, при которой ожидаемые счётчики сохраняют смысл (меняются ожидания, не проверка). Ветки legacy `policy.test.ts`, проверяющие исключения `STUDENT`, удаляются (исключений больше нет); проверки ADMIN остаются.

**Р4. Миры бота** (Т10): три персоны `core-education` (`tests/worlds/core-education.ts:97,177,185`) со `STUDENT` → `GUEST` (или `SUBSCRIBER`, если по сценарию мира персона подписана на канал); `invariants`/`world-check`/`kit-framework` — литерал `'STUDENT'` → `'GUEST'`.

**Р5. `DEBT-48`.** Код-часть гасится в Ф3. Если `arch:check` требует снять запись `debt.md` без маркера — это эскалация к orchestrator (`conductor/` пишет только он), не обход.

## Критерии приёмки (grep)

```bash
grep -rnE "Role\.STUDENT|['\"]STUDENT['\"]|isStudent\b" --include=*.ts --exclude-dir=node_modules . \
  | grep -v "student.errors.ts"
```
пуст, кроме упоминания `'STUDENT'` в самом скрипте миграции и его тесте.

- Тест скрипта: сухой прогон не пишет; `--write` пишет; повтор — `migrated: 0`, файл не меняется; только `STUDENT` → `['GUEST']`; даты и `version` не тронуты; невалидная запись перечислена.
- `bun run check` зелёный, тесты не ниже Ф2 с поправкой на удалённые ветки `STUDENT`; `git status data/` чист.

## ID правил

TST-08 (тесты переезжают, лишние — в журнал), TST-09, ERR-01 (строгое чтение — отказ, не тихий пропуск), D-36 (даты не трогаются скриптом).

## Шаги

1. **`dmg-test-designer` (Sonnet):** red — `scripts/migrate-users-drop-student.test.ts` (по Р1, `mkdtemp`), `user.state.test.ts` (Р2). Прод-код не пишет.
2. **`migrator` (flash):** скрипт; Р2–Р4 в прод-коде, тестах и мирах.
3. **orchestrator:** гейт, grep; `bun run seed:fixtures`.
4. **`dmg-data-keeper` (flash):** прогон скрипта (сухой, `--write`, повтор) на копии прежних `data/fixtures` (со `STUDENT`, снята orchestrator до пересборки) во временном каталоге; путь отката; живые данные не открываются.
5. **`dmg-reviewer` (Opus).**

## Отчёты

**`dmg-test-designer` (Sonnet, шаг 1).** Red: `scripts/migrate-users-drop-student.test.ts` (22 теста: `migrateUsersData` 9, `resolveUsersFilePath` 3, `runMigration` 10, каталоги `mkdtemp`), `user.state.test.ts` (`STUDENT` отклоняется), `user.policy.test.ts` и `contract.role.test.ts` (без `STUDENT`). Ожидаемый экспорт скрипта: `MigrateUsersResult`, `migrateUsersData(users) → { updatedUsers, result }` (чистая, `written: false`, неизменённая запись — тот же объект), `resolveUsersFilePath(dbDir)`, `runMigration(dbDir, { write? })` (по умолчанию сухой). Запись без `uuid` в `invalid` — индекс строкой; невалидная запись без `STUDENT` тоже попадает в `invalid` (принято orchestrator: С5 — перечислить все невалидные). Итог: 60 pass, 3 fail (нет модуля; `STUDENT` в `Role` и в `UserState`) — red по ожидаемой причине, проверено orchestrator. Эскалаций нет.

**`migrator` (flash, `ud-F3-migrator`, 2 круга, $0.077).** Скрипт `scripts/migrate-users-drop-student.ts` по Р1 (`v.safeParse(UserState)` после снятия `STUDENT`); `STUDENT` снят из `UserRoleName`, `Role`/`RoleSchema`, исключения legacy `canAddRole`/`canRemoveRole` → только ADMIN, сигнатуры сужены до `(actor)` (второй круг: 4 `noUnusedFunctionParameters`), вызывающие legacy-UC поправлены. Тесты и фикстуры — 32 файла, миры бота — 4. Замены: `STUDENT` → `GUEST`; где `GUEST` уже был — удалён; `student.policy.test.ts` (`isSelf`) — `SUBSCRIBER` (иначе дубль соседнего теста); фильтр `user-json-repo.test.ts` — `GUEST`, ожидания прежние. В legacy `policy.test.ts` удалено 6 тестов исключений `STUDENT` и сценариев «другому пользователю», невыразимых после сужения сигнатуры (17 → 12). Эскалация DEBT-48 (`arch:check`) — запись снята orchestrator, итог — TR-61 «Ф3». Гейт (полный `check`) зелёный, grep чист (кроме red-теста `user.state.test.ts:37–38` и самого скрипта) — проверено orchestrator. `bun run seed:fixtures` — `data/fixtures` без `STUDENT`.
- Кандидат в чистку тестов: `platform/app-legacy/src/domain/user.test.ts` — схемные проверки дублируют `user.state.test.ts` (TST-09).
- Кандидат в чистку тестов: `domain/src/stream/student/student.policy.test.ts` — два теста на одно правило `isSelf`.

**`dmg-data-keeper` (flash, `ud-F3-data`).** Копия прежних фикстур (14 записей, 3 со `STUDENT`, `mktemp -d`): сухой прогон — файл не изменён (sha256), `migrated: 3`, `becameGuest: 3`; `--write` — diff ровно 3 замены `STUDENT` → `GUEST`, даты/порядок/поля прежние, новый `UserJsonRepo` читает 14/14; повтор — `migrated: 0`, файл не переписан. Живые данные не открывались.
- **Дефект (исправлен в срезе):** проверка `invalid` шла через `UserState`, а прод-читатель — через `UserArDef.state` (`withEntityDefaults`: нет `updatedAt` → `createdAt`; ловушка `state.md` §5 пакета) → все 14 legacy-записей ложно невалидны. Исправление — `migrator` (flash, `ud-F3-fix`): red-тест «legacy-запись без `updatedAt`/`version` не в `invalid`» → `UserArDef.state`; заголовок `user-json-repo.test.ts:166` под факт (`GUEST`). Перепроверено orchestrator: на копии прежних фикстур `migrated: 3`, `invalid: []`; `DB_DIR=./data/fixtures` (сухой) — `migrated: 0`, `invalid: []`.
- **Порядок релиза (в чек-лист `migration.md`, Ф8):** миграция — ДО выкатки нового кода: старый код читает `GUEST` и `STUDENT` не выдаёт, а новый `UserJsonRepo` на файле со `STUDENT` роняет все чтения `user`, legacy-репозиторий молча теряет такие записи при первой записи. Шаги: остановить бота → `bun run backup --name=before-drop-student` (защищённый снимок, не уходит в ротацию) → сухой прогон, разбор `invalid` → `--write` → контрольное чтение → деплой → старт.
- **Откат:** восстановить `data/users/users.json` из снимка (скрипт меняет только `roles`); откат кода `e7298e73` — только вместе с файлом.
- **Открыто для релиза:** сколько записей живого `data/users/users.json` со `STUDENT` и без `updatedAt` — проверка Нурболатом (чтение `data/` агентам запрещено).

**`dmg-reviewer` (Opus).** `error` нет. Закрыто в срезе (flash, `ud-F3-review-fix`): warn — шапка скрипта: бэкап `--name=before-drop-student` (защищённый снимок); info — `start:prod:stop`, явный шаг деплоя после миграции; имя `student` → `guest` в `add-role-to-user-uc.test.ts`. Принято без правки (TR-61 «Ф3»): запись `writeFile` без temp+rename — прикрыта защищённым снимком; 6 удалённых тестов legacy `policy.test.ts` — обоснованы (TST-08). Вне границ: `STUDENT` в документах (`README.md:56`, `runners/u7-bot/src/controllers/learning/ui-spec.md`, `courses/content-nav.md:52`, `modules/stream/src/analysis.md:55`, `TODO.md:104,154`) — Ф8, «Документы».
