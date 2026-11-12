# Summary: user-dmg_20261111

## Базовая линия (2026-11-11)

| Где | Команда | Результат |
|---|---|---|
| u7-school (`b3b44aea`) | `CI=true bun test` | 3179 pass, 0 fail (335 файлов) |
| u7-school (`b3b44aea`) | `bun run test:bot` (e2e-тесты бота) | 894 pass, 0 fail (94 файла) |
| u7-school (`b3b44aea`) | `CI=true bun test domain/src/user` | 27 pass, 0 fail (4 файла) |
| u7-school (`b3b44aea`) | `CI=true bun test modules/user` | 67 pass, 0 fail (12 файлов) |
| dmg-core (`93333e8`) | `CI=true bun test` | 1379 pass, 0 fail (131 файл) |

## Пилот ролей

Строка на каждый вызов роли ([agent-roles.md](../../architecture/agent-roles.md) §5).

| # | Роль | Задача | Модель | Повлиял на решение | Принято замечаний | Промпт правился | Оценка orchestrator |
|---|---|---|---|---|---|---|---|
| Ф1 | `ud-F1-s0` (S0 переименование) | flash | 0.019 | 18 | 95 | 0 | 0 |
| Ф1 | `ud-F1-domain` (домен) | flash | 0.119 | 69+6 | 99–100 | 1 (эскалации MAN-06, `DEBT-48` в комментариях) | 0 |
| Ф1 | `ud-F1-review-fix` (5 info ревью) | flash | 0.026 | 27 | 97 | 0 | 0 |
| Ф2 | `ud-F2-app` (прикладной слой + 1 доработка по эскалации) | flash | 0.179 | 98+5 | 99–100 | 1 (smoke с одним `requestId`, D-56 — тест неверен) | 0 |
| Ф2 | `ud-F2-data` (`dmg-data-keeper`) | flash | 0.040 | 46 | 98 | 0 | — |
| Ф2 | `ud-F2-review-fix` (2 warn + 6 info ревью) | flash | 0.029 | 31 | 98 | 0 | 0 |

| Ф3 | `ud-F3-migrator` (скрипт, снятие `STUDENT`, 36 файлов тестов + 1 доработка: unused-параметры) | flash | 0.077 | 42+10 | 98–99 | 1 (DEBT-48 против `arch:check` — по делу) | 0 |
| Ф3 | `ud-F3-data` (`dmg-data-keeper`) | flash | 0.040 | 42 | 98 | 0 | — |
| Ф3 | `ud-F3-fix` (дефект `invalid`: `UserState` → `UserArDef.state`, TDD) | flash | 0.015 | 20 | 96 | 0 | 0 |
| Ф3 | `ud-F3-review-fix` (1 warn + 2 info) | flash | 0.005 | 9 | 96 | 0 | 0 |

**Ф3 итог:** flash $0.137, 4 сессии; red-тесты — Sonnet, ревью — Opus (0 `error`). Отклонений от §2 нет. Наблюдение: data-keeper на flash нашёл реальный дефект скрипта (проверка через экспортированную схему state без `withEntityDefaults` — все legacy-записи ложно невалидны; ловушка `state.md` §5 пакета) — бриф Р1 сам предписал неверную схему, red-тесты Sonnet это пропустили (в фикстурах теста был `updatedAt`). Тесты: 3171 pass, 0 fail.

**Ф2 итог:** flash $0.248, 3 сессии; red-тесты — Sonnet, ревью — Opus (0 `error`, 2 warn + 6 info закрыты в срезе). Отклонений от §2 нет. Наблюдение: flash дважды эскалировал по делу (неверный smoke, DEBT-44 против `arch:check`) вместо обхода; data-keeper на flash нашёл реальный риск выкатки (оба писателя `users.json` → потеря записей) и не стал читать живые данные. Счёт тестов: `data/**` исключён из `bun test` (`6d3af7b6`, −113 тестов контента), поэтому `CI=true bun test` = 3158 при базовой линии 3179; без `data/**` — +55 за Ф2; `domain/src/user` + `modules/user`: 94 → 184.

**Ф1 итог:** flash $0.164, 3 сессии; red-тесты — Sonnet, ревью — Opus (0 `error`, 5 info закрыты в срезе). Отклонений от §2 нет. Наблюдение: flash сам нашёл противоречие Р7 брифа и MAN-06 `arch:check` и эскалировал, а не обошёл — постановка «не ослабляй, эскалируй» работает.
| 1 | `dmg-tech-lead` | Разбор UC/`UserFacade`, черновики брифов `user-domain` (Ф1) и `user-app` (Ф2) | Sonnet | да — 14 расхождений: `isStudent` в HEAD нет, grep `new …Ar` ловит собственную фабрику, Policy с `Role` — 4 файла (не 5), `domain/src/shared` ломает `checkDomainDirs`, `UserLegacy` снимается уже в Ф2, строгое чтение требует порядка выкатки, 64 `new UserCaller(<plain>)`; 5 стратегических, 17 тактических вопросов | проверены 4 утверждения о коде — верны; брифы записаны без переписывания | нет | полезен; ~323k токенов, 15 мин, 95 вызовов инструментов |

## DeepSeek по фазам (`deepseek.md` §5)

| Фаза | Шаг (`--label`) | Модель | $ | Ходов | hitRate | Кругов доработки | `error` ревью |
|---|---|---|---|---|---|---|---|
| Ф4 | `F4-migrator` (реализация + снятие дубля проверки) | flash | 0.2055 | 138 | 99 | 1 (эскалация `testing` → D-70) | 0 |
| Ф4 | `F4-migrator-review` (правки ревью, чистка дублей) | flash | 0.0424 | 41 | 95–99 | 2 | 0 |
| Ф5 | `F5-migrator-mech` (stories, `u7-cli`, ~65 тестов) | flash | 0.4399 | 361 | 99 | 0 (эскалация grep-критерия) | 1 (мета логов — в коде Sonnet) |
| Ф5 | `F5-migrator-fix` (правки ревью и повторного ревью) | flash | 0.1111 | 102 | 99–100 | 2 | 0 |
| Ф6 | `ud-F6-clients` (клиенты сборки; 2 запуска — таймаут провайдера) | flash | 0.1619 | 121 | 98–100 | 1 (продолжение после таймаута; 4 эскалации) | 0 |
| Ф6 | `ud-F6-remove` (удаление legacy) | flash | 0.1188 | 95 | — | 0 (эскалация `debt.md`) | 0 |
| Ф6 | `ud-F6-data` (`dmg-data-keeper`) | flash | 0.0623 | 54 | — | 0 | — |
| Ф7 | `ud-F7-barrel` (3 круга: механика, `testing` + `scripts/` вне ARC-04, правки ревью) | flash | 0.1089 | 73 | 98–100 | 2 (эскалация ARC-04 → решение Нурболата; minor ревью) | 0 |

## Ф0: вопросы (разбор `dmg-tech-lead`)

### Стратегические вопросы (для Нурболата)

**С1. Субъект Policy клиентов и UI-проверки ролей** (раздел 2).
- Варианты: А (тип `AppUser` в контракте `user`, реализация — `UserAr`, резолвер строит субъект из `getUser`), Б (VO `UserRoles` в контракте), В (литералы `roles.includes('MENTOR')`).
- Рекомендация: А. Тип — в контракте `user`, не в `domain/src/shared` (ломает `checkDomainDirs`), отклонение от D-53 записать в TR.
- С1б — UI (`submenu.ts`, `main.ts`): (a) через `callers.resolve(...).subject()` (рекомендую), (b) данные `actor.roles`, (c) флаги прав в выходе UC.
- Цена: ~64 `new UserCaller(<plain>)` и 4 fixture-файла.

**С2. Состав UC.**
- `create-user` — удалить (нет вызывающих ни в HEAD, ни в `v0.2.6`, как authoring `course`).
- `list-users` — перенести (u7-cli `/login`, не стартует, DEBT-42); вариант — удалить вместе с `create-user`.
- Имя `remove-role-to-user` → `remove-role-from-user`, Def — `removeRoleFromUser` (рекомендую).
- Политика `registerGuest` остаётся ADMIN (бот действует от `botAdminUser`); `callers: ['system']` с `allowAll` отвергнут: меняет модель доступа, вернуться при web-API.

**С3. `notify-user`/`user.notified`.**
- Рекомендация: удалить UC, событие, `UserFacade.notify`, `UserController` и `NotifyStory` (+ тесты).
- Продюсеров в HEAD нет, поведение бота не меняется.
- Нурболату поправить `tasks-system-*.md` и `development-roadmap.md:233`.

**С4. Bootstrap первого администратора (seed).** Legacy `UserJsonRepo` при отсутствии `users.json` заливает `users/seed.json` (`user-json-repo.ts:14-72`); без `create-user` это единственный путь завести первого ADMIN в новой школе.
- Рекомендация: seed в новый репозиторий не переносить; bootstrap новой школы — отдельный долг (проектирует трек `schools-system`).
- Вариант: перенести seed (~30 строк + 3 теста).

**С5. Выкатка со строгим чтением.**
- В чек-листе `migration.md`: `bun run backup` → dry-run скрипта (перечисляет невалидные записи) → запуск скрипта → только после этого рестарт на новом коде.
- Переход с толерантного чтения (невалидные записи молча пропускались) на строгое делает одну битую запись причиной отказа всех чтений `user` (в том числе резолвера `Caller` в Ф4 — ERR-01).
- Подтвердить и принять порядок.

---

### Тактические вопросы (предлагаемое решение)

- **Т1. Идемпотентность `registerGuest`.** Занятый `telegramId` → `USER_TELEGRAM_ID_TAKEN`; идемпотентность `/start` держит `ensureRegisteredGuest` (сначала `getUserByTelegramId`). Вариант «возвращать существующего» противоречит API-01 (ветка по состоянию в UC). Узкая гонка двух `/start` одного пользователя гасится отсевом повторов (D-56). Записать в TR.
- **Т2. S0 — `Legacy*`.** Переименования по образцу TR-41 (`course`, `stream`). Список: `LegacyUserAr` (`a-root.ts`), `LegacyUserPolicy` (`policy.ts`), `LegacyUserRepo` (`repo.ts`), `LegacyUserJsonRepo` (`infra/db/user-json-repo.ts`); `UserListFilter` не трогать. Конфликты: `domain/src/user/index.ts:4,67,68` (экспорт новых имён рядом с legacy) и `modules/user/src/index.ts` (`export *` из `./domain` и `./infra` — коллизия `UserRepo`/`UserJsonRepo` с новыми).
- **Т3. Def UC в Ф1, регистрация в Ф2.** Файлы Def создаёт Ф1; `UserModuleDef.useCases`, контракт, карта модуля — Ф2 одним коммитом (иначе `ModuleMap` падает).
- **Т4. `isAuthor()` в `UserAr` не добавлять.** Вызывающих нет (`Role.AUTHOR` — только в `tests/worlds`). `isAdmin()`, `isMentor()`, `hasRole()` — достаточно.
- **Т5. Событий у `user` нет** (`events: {}`): подписчиков нет, MAN-06.
- **Т6. `STUDENT` остаётся в picklist state и в enum `Role` до Ф3** (данные и фикстуры его содержат); `Role` снимается из контракта в Ф4 (`contract.role.test.ts` удаляется).
- **Т7. Формы выходов.** `UserView[]` (не `{ users }`), как у `wish`/`stream`; вызывающий `u7-cli` правится в Ф5. Константа `GET_USERS_BY_IDS_MAX = 100` — экспортируемая в Def-файле.
- **Т8. `UserLegacy`/`U7LegacyFacades` снимаются в Ф2** вместе с адаптером (в плане — Ф6).
- **Т9. Скрипт миграции `STUDENT` (Ф3).**
  - Работает по сырому JSON без доменных импортов (после Ф3 строгая схема `STUDENT` не примет).
  - Снимает `STUDENT`; если `roles` опустел — `['GUEST']` (как `removeRole`).
  - Не трогает даты и `version`.
  - Сухой прогон по умолчанию, `--write` пишет, идемпотентен.
  - Сухой прогон также перечисляет записи, не проходящие строгую схему (для С5).
- **Т10. Фикстуры.** После Ф3 `bun run seed:fixtures` пересобирает `data/fixtures`; три персоны `core-education` со `STUDENT` (`tests/worlds/core-education.ts:97,177,185`) получают `GUEST`/`SUBSCRIBER` (мир правит test-designer/migrator Ф3).
- **Т11. Критерий Ф3** — grep `Role\.STUDENT` + `['"]STUDENT['"]` по `*.ts` (кроме `student.errors.ts` — группа ошибок `STUDENT`), без `isStudent`. Критерий Ф1/Ф2 про `new …Ar` — с исключением собственного класса.
- **Т12. `Role` как литеральный тип `UserRole`** вместо enum; вход `role` UC — picklist; `school/controller.ts` (Ф5) передаёт `'SUBSCRIBER'`, типобезопасно через `InputOf<typeof AddRoleToUserUcDef>['role']`.
- **Т13. Предупреждение о ненайденных (`getUsersByIds`)** — `this.resolve.app.logger.warn` (`AppContext.logger`), как в legacy `resolve.appResolver.logger`.
- **Т14. Тип актора UI.** Контракт экспортирует `UserView` (числовые даты); временный alias `User` (в контракте) снимается механически в Ф7 вместе с 102 импортами `app-legacy/domain`. Фикстуры 68 файлов (164 строки `createdAt: '…'`) переводятся на `createdAt: <число>` или `userFixture()` — механика Ф7/Ф5 (flash).
- **Т15. Порядок Ф5.** Новый репозиторий пишет числовые даты, legacy их не читает. Поэтому в Ф5 переход чтений и записей `user` — одним коммитом (не раздельно); иначе legacy `getUserByTelegramId` начнёт отбрасывать записи, записанные новым `registerGuest`.
- **Т16. `u7-cli`.** Два вызова (`list-users:374`, `get-user:409`) — в Ф5 на `dispatchByName`; иначе при удалении `UserApiModuleMeta` ломается типизация `app.execute`. Остальное — DEBT-42.
- **Т17. `scripts/call-uc.ts`.** `app.userFacade.getUserByUuid(actorId)` (`:149`) и `_course-client.ts:83` — на `callers.resolve` + `getUser` в Ф6 (скрипты по плану).

## Почищено из журнала `test-bloat.md`

- Ф6: `platform/app-legacy/src/domain/user.test.ts` (дубль схемных проверок `UserSchema`/`RoleSchema`, TST-09) — удалён вместе с legacy-доменом `user` (`6f6435b6`); строка снята из журнала в Ф7.
