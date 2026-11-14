# Spec: user-dmg_20261111

## Обзор

Трек 6 из migration.md, последний модуль группы «остальные модули». Модуль `user` (домен `domain/src/user`, прикладной слой `modules/user`) переводится с legacy на Def по эталону `wish`; вместе с ним снимаются barrel-реэкспорты (DEBT-3). Шаблон трека — `conductor/archive/course-dmg_20261105`. Конвейер ролей: `dmg-tech-lead` → `dmg-test-designer` → `migrator` → гейт → `dmg-data-keeper` (по триггеру) → `dmg-reviewer`.

**Исполнители — по таблице §2 [deepseek.md](../../architecture/deepseek.md).** После каждого шага на DeepSeek — гейт, `git diff --numstat`, grep-критерии брифа; строка расхода — в `summary.md`.

## Решения

- **Порядок.** Все клиенты `user` (`course`, `questionnaire`, `stream`, `peer-review`, `wish`) на Def — обратных мостов нет. `dossier` остаётся внешним `ModuleDef` (вне трека).
- **Исходное состояние.** Def у `user` есть частично: внешний `UserModuleDef` с `GetTelegramAddressesUcDef`, пустой `UserArDef` (`domain/src/user/user/user.ar.ts`), карта модуля `modules/user/src/user.module.ts`, фабрика `createUserModule` в `U7App`; рядом — legacy `UserAr` (`a-root.ts`). Трек наполняет Def и снимает `external`.
- **Перепроектирование разрешено на любом уровне** (доменная модель, состав и реализация UC, резолвер `Caller`) — **только с явного одобрения Нурболата** на каждое изменение. Каждое предложение — стратегический вопрос («сейчас в срезе» или «в `debt.md`»). Одобренное — в `TR-<n>` или `decisions.md`.
- **Состав UC.** Ф0: `dmg-tech-lead` разбирает 9 legacy-UC (`register-guest`, `create-user`, `add-role`, `remove-role`, `notify-user`, `get-user`, `get-user-by-telegram-id`, `get-users-by-ids`, `list-users`) и вызовы `userFacade` → список «переносим / удаляем» на утверждение Нурболату.
- **Роли.** Проверки прав — через API `UserAr` (`isMentor()`, `isAdmin()` …), а не `roles.includes`; экспорт `Role` из контракта снимается (TR-40).
- **Мосты:**
  - адаптер `get-telegram-addresses` (DEBT-44) → настоящий UC; DEBT-44 закрывается;
  - `U7CallerResolver` над legacy `userFacade` (TR-33) → резолвер `Caller` на Def;
  - адрес респондента анкет в stories — через UC `user` вместо legacy `get-user` (TR-49 (6)).
- **Вопросы Ф0** (решение Нурболата до выполнения): как Policy клиентов получает API ролей от субъекта `Caller`; судьба `notify-user`/`user.notified` (продюсера нет — сверка с `v0.2.6`); `create-user` (вызывающих нет), `list-users` (только `u7-cli`), имя `remove-role-to-user` → `remove-role-from-user`.
- **DEBT-3.** Импорты на контракт `user` / `@u7-scl/domain/<m>`: `@u7-scl/user/domain` — 46 файлов, `@u7-scl/app-legacy/domain` ради `User`/`Role` — 102, корень `app-legacy` — 8, barrel'ы `course`/`stream`/`wish` — 11. Удаляются 6 barrel'ов `modules/*/src/domain/index.ts`, их пути в `tsconfig.json` и `exports "./domain"`, `platform/app-legacy/src/domain/user.ts`. `app-legacy` целиком остаётся (нужен оставшемуся legacy). `modules/dossier/src/index.ts` — корень пакета, не barrel `domain`: не трогается, остаток DEBT-3 за треком `dossier`.
- **Сосуществование срезов.** Красная зона между срезами допустима, если записана в `debt.md` с критерием снятия «конец трека».
- **Режим.** Автономный ([agents.md](../../architecture/agents.md) §9), тактика — `TR-<n>`.

## Данные

- **Роль `STUDENT` (DEBT-48)** удаляется из кода (`Role.STUDENT`, `UserPolicy.isStudent`, исключения `canAddRole`/`canRemoveRole`); чтение `users.json` — строгое.
- **Скрипт миграции** `scripts/migrate-users-drop-student.ts` (имя уточняется): снимает `STUDENT` из `roles`; сухой прогон по умолчанию, запись — по флагу, идемпотентен, с тестом. Проверка — на `DB_DIR=./data/fixtures` и локальной заготовке; перед записью — проверка `dmg-data-keeper`.
- **Прод.** Запуск скрипта — при релизе, не в треке: `bun run backup` → скрипт → только с подтверждения Нурболата. Пункт — в чек-листе релиза `migration.md`.
- `createdAt`/`updatedAt` → `F.timestamp` (ленивая миграция до трека 7).
- Живые данные трек не трогает; `data/fixtures` пересобирается `bun run seed:fixtures`.

## Входной долг

| Долг | Решение |
|---|---|
| DEBT-1, 2, 5 (glob'ы `user`), DEBT-34 (пары `user`) | погашаются |
| DEBT-44, TR-33, TR-40, TR-49 (6), DEBT-48 | погашаются |
| DEBT-3 (barrel, `User` в `app-legacy`) | погашается; остаток — `modules/dossier/src/index.ts` (трек `dossier`) |

Реестр — debt.md.

## Функциональные требования

- **Ф0. База.** Новая базовая линия тестов. Разбор UC, вызовов `userFacade`, импортов barrel: списки «переносим / удаляем» и «импорт → новый путь».
- **Срезы домена и прикладного слоя:** state, `UserAr` (`create`/`restore`, API ролей), ошибки, Policy, правила, DCS/DQS, Def UC; JSON-репозиторий через UoW со строгим разбором; UC через `UseCaseFromDef`; ER/события — по разбору.
- **Резолвер `Caller`** на Def вместо `U7CallerResolver`.
- **Данные.** Снятие `STUDENT`, скрипт миграции с тестом.
- **UI.** Stories бота (регистрация, роли, меню, анкеты, уведомления) — на `dispatch` и Def-события.
- **Сборка.** Фабрика в `U7App`, `@u7-scl/user/**` — в ARC-07, `external` снят; удаляются legacy-фасад, `api/*`, legacy-репозиторий, `UserApiModule`; `test-app`, тестовые миры, скрипты (`call-uc.ts`, `_course-client.ts`, `domain-arch.ts`) — на Def.
- **DEBT-3.** Перевод импортов, удаление barrel и реэкспортов.
- **Итог.** `debt.md` — снять погашенное; `migration.md` §6 — состояние, чек-лист релиза, следующий трек; `deepseek.md` — сверка §2; `summary.md` с гейтом закрытия.

## Нефункциональные требования

- Поведение бота сохраняется, кроме одобренных перепроектирований.
- e2e зелёные к концу UI и сборки.
- TDD: red → запуск → green.
- Без новых зависимостей, деплоя, пуша и рестарта прода.
- Правка `dmg-core` — отдельным коммитом в репо пакета, SHA — в коммите u7-school.

## Критерии приёмки

- В `domain/src/user` и `modules/user` нет `throw*` для штатных отказов, `new …Ar`, `#` в Ar, импортов `core`/`app-legacy`.
- Нет `Role.STUDENT`/`isStudent` во всём коде (включая фикстуры и тесты); нет `roles.includes(Role.…)` в Policy клиентов (`course`, `stream`, `questionnaire`) и в `submenu.ts`; `Role` не экспортируется из контракта.
- Нет адаптера `get-telegram-addresses`, `U7CallerResolver` над legacy, legacy `get-user` в stories.
- Нет импортов `@u7-scl/<m>/domain` и реэкспорта `User` из `app-legacy`; barrel `modules/*/src/domain/index.ts` удалены; остаток DEBT-3 — только `modules/dossier/src/index.ts`.
- У `UserModuleDef` нет `external`; legacy-фасад и `UserApiModule` удалены.
- Скрипт миграции `STUDENT` с тестом (сухой прогон, запись, идемпотентность); шаг прода — в чек-листе релиза.
- `check` зелёный, `arch:check` синхронен, в отчётах reviewer нет `error`, красной зоны в `debt.md` нет.
- `git status data/` чист.
- Каждое перепроектирование одобрено и записано в `TR-<n>`, `decisions.md` или `debt.md`.

## За рамками

- Перевод `dossier` на Def и снятие его `external`.
- Запуск миграции на проде (только чек-лист).
- Персональная зона пользователя (DEBT-43), `u7-cli`/`call-uc` (DEBT-42), `Delegation` (трек 8), пакетная миграция дат (трек 7).
