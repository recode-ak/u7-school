# Spec: stream-dmg_20261103

## Обзор

Трек 6 из migration.md, первый из группы «остальные модули». Модуль `stream` (домен `domain/src/stream`, прикладной слой `modules/stream`) переводится с legacy на Def по эталону `wish`. Работу выполняет конвейер агентов, шаблон трека — `conductor/archive/peer-review-dmg_20261029`. Для ролей это второй трек пилота ([agent-roles.md](../../architecture/agent-roles.md) §5).

## Решения

- **Порядок.** Модули переводятся сверху вниз по графу (§2.1). Клиенты `stream` (`wish` и `peer-review`) уже на Def, legacy-клиентов нет, поэтому обратных мостов нет. Зависимости `user` и `course` подключаются как внешние `ModuleDef` с адаптерами над legacy-фасадами (§2.2).
- **Срезы:**
  - `stream` — 9 UC: `create`, `activate`, `archive`, `complete`, `get`, `list`, `list-students`, `getStreamMembers`, `getStreamPresence`. Последние два сейчас адаптеры.
  - `student` — 8 UC (`enroll`, `complete-step`, `complete`, `drop`, `mark-abandoned`, `get-by-user`, `get-progress`, `set-next-preference`) и Job `inactivity-sweep`.
  - Сборка.
- **Конвейер среза.** `tech-lead` (бриф) → `test-designer` (характеризация `v0.2.6`, red) → `migrator` (green) → гейт → `data-keeper` (если diff затрагивает `state`, `*.repo.ts` или снимки) → `reviewer`.
- **Режим.** Работа автономная ([agents.md](../../architecture/agents.md) §9). Тактические решения записываются в `TR-<n>`, Нурболату выносятся только стратегические вопросы. Промпты ролей в треке не правятся.
- **Перепроектирование.** Принцип «переносить и перепроектировать — отдельно» (§1) в этом треке ослаблен. Неудачные решения разрешено пересматривать на любом уровне: домен (распределение ответственностей между агрегатами и модулями, события), API UC, ER, Job и UI (stories бота). Каждое предложение — от брифа `tech-lead`, из отчёта `reviewer` или находка оркестратора — это стратегический вопрос к Нурболату с выбором: «делаем сейчас в срезе» или «записываем в `debt.md`». Без его разрешения ничего не перепроектируется. Принятые решения фиксируются в `TR-<n>` или в `decisions.md`.
- **Сосуществование срезов — без моста.** Ф1 и Ф2 работают с одними файлами данных: после Ф1 legacy-код студента может не прочитать поток, записанный новым репозиторием. Временный мост не строим. Внутри трека между Ф1 и Ф2 допустима красная зона: падающие тесты и e2e студента записываются в `debt.md` с критерием снятия «конец Ф2». К концу Ф2 `check` полностью зелёный.

### Решения Нурболата (2026-11-03)

- **DQS и state (TR-8).** Вариант (c) с опорой на (d). Def проекции (`v.pick` из state, «форма» по D-39) лежит отдельно от сервиса. Сервис state не читает: поля для проекции отдаёт Ar методом, который типизирован схемой проекции. DQS только сводит ответы нескольких Ar. Решение записывается в `TR-8` и `decisions.md`.
- **Роли в Policy.** Пока `user` не на Def, субъект `Caller` — legacy-entity `User` с `roles`. Контракт `domain/src/user/contract.ts` дополнительно экспортирует `Role` (одна строка), Policy `stream` проверяет `subject.roles.includes(Role.MENTOR)`. Это TR, его снимает перевод `user`: тогда проверки переходят на API `UserAr` (`isMentor()`, `isAdmin()`). Если по ходу трека понадобится расширить контракт `user`, это допустимо при меньшем числе движений. Но небольшой долг лучше оставить, чем выходить за пределы модуля `stream`.
- **Роль `STUDENT`.** Stream больше не выдаёт и не снимает роль. Проверки роли заменяет UC `getActiveStudent(userId)`, он возвращает `{ student?, stream? }`. Его используют `learning` (hub, shared), `streams/controller` и правило зачисления; инвариант тестовых миров `STUDENT_ROLE_MISMATCH` снимается. В модуле `user` роль не удаляется: `Role.STUDENT`, исключения `canAddRole`/`canRemoveRole` и `STUDENT` в `data/users` остаются долгом трека `user`.
- **API и домен:**
  1. `set-next-preference` удаляется: вызывающих нет.
  2. У `complete-student` убирается исход `abandoned`, он дублирует `mark-abandoned`. `studentAr.complete(outcome)` принимает только `advanced` и `not_advanced`.
  3. `list-stream-students` и `getStreamMembers` сливаются в один запрос «состав потока».
  4. Правило зачисления («одна активная запись» и gate модуля) переносится из `StreamAr.enroll` в правила студента. Факты приходят из DQS и Def UC `course`, а не через entity `Course`.
  5. UI-расчёты `StreamDs` (прогресс, дерево навигации, категории, карточки) превращаются в DQS по решению TR-8. Query UC выбираются вместо DQS только при веских причинах — будущие потребители, оптимизация. Выбор фиксируется в брифе.
  6. `stream.completed` удаляется: подписчиков нет.
- **ER, Job, UI:**
  7. Уведомления (`notify` в `complete`, `drop`, `mark-abandoned`) переносятся из UC в stories, подписанные на события (D-41, как `peer-review`). Текст формирует UI.
  8. События `inactivity-*` несут только id и `days`, без `telegramId`. Адрес story получает через `GetTelegramAddressesUcDef`, и Job становится чисто доменным.
  9. Добавляется UC `findStreamByTelegramGroup`, `streams/controller` больше не перебирает все потоки.
  10. DEBT-35: в state желания хранится `invitedStreamIds` (необязательное поле), ER `invite-wishers` отсеивает повтор правилом.
- **События.** Def-события публикуют агрегаты: `stream.created`, `student.enrolled`, `student.completed`, `student.abandoned`, `student.inactivity-warning`, `student.inactivity-remove-candidate`. `streamLegacyInbound` удаляется. Подписчики переходят на Def напрямую:
  - ER `invite-wishers` и `fulfill-wish` (`wish`);
  - ER `create-student-campaign` (`peer-review`);
  - stories бота (`learning/hub`, `inactivity`), которые сейчас подписаны на legacy-имена.
- **`StreamDs`.** Запись (`completeStream`, `completeStep`, `tryIssueTailStep`) уходит в Ar и DCS, чтение для UI — в DQS (п. 5). Вызов чужого `CourseDs` заменяется Def UC `course` или снимком.
- **UI.** Stories бота переводятся на `dispatch` в срезе своего агрегата. Это `streams/*`, `mentor/*`, `learning/*` и `streams/controller`, а также вызовы потока в `courses/wish-*`, `peer-review/*` и `school-reviews`.
- **Данные.** Формат записей потоков и студентов не меняется: `F.timestamp` читает ISO-строку и пишет число. `invitedStreamIds` в `wish` необязательное поле, старые записи читаются. Трек не пишет в `data/`, репозитории проверяются на `DB_DIR=./data/fixtures`. Скрипт `update-stream-snapshot.ts` после перевода сохраняет `version` и числовые даты.

## Входной долг

| Долг | Что | Решение в треке |
|---|---|---|
| DEBT-1 (stream) | импорты `@u7-scl/core` в `domain/stream` | погашается |
| DEBT-2 (stream) | `U7ModuleResolver`, `U7_SCHOOL_ID` из `app-legacy` | погашается |
| DEBT-5 (stream) | `v.isoDateTime` в 9 местах схем | погашается через `F.timestamp` |
| DEBT-10 (stream) | `#…` в `StudentAr` | погашается: логика переходит в Policy, правила или DQS |
| DEBT-34 | импорты чужого `index` | погашается в части `stream` (в том числе `ContentSnapshotSchema` из `index` модуля `course`) |
| DEBT-35 | ER `invite-wishers` не идемпотентен | погашается (п. 10) |
| TR-8 | открытый вопрос «DQS и state» | решён: (c) с опорой на (d) |
| TR-11 (stream) | адаптеры `GetStreamMembers`/`GetStreamPresence`, `inbound` | снимаются |
| DEBT-3 (stream) | barrel `modules/stream/src/domain/index.ts` | остаётся до последнего трека |

Реестр — debt.md.

## Функциональные требования

**Ф0. База и решения.** Зафиксировать базовую линию тестов. Записать решения этого spec в TR-8 и `decisions.md`.

**Ф1. Срез `stream`.**
- Описать агрегат через Def: state, Ar, события, ошибки, Policy с ролями, правила, DCS и DQS, Def UC, репозиторий через UoW.
- Реализовать UC через `UseCaseFromDef`: «состав потока» (п. 3) и `findStreamByTelegramGroup` (п. 9). Адаптеры `wish` и `peer-review` удаляются.
- Сделать `stream.created` событием Def. Закрыть DEBT-35: тест идемпотентности `invite-wishers` ждёт успеха.
- Перевести на `dispatch` stories ментора, `streams/*` и вызовы потока в `courses/*`, `peer-review/*` и `school-reviews`.

**Ф2. Срез `student`.**
- Сделать то же для 7 UC (после п. 1), `getActiveStudent` и Job `inactivity-sweep` (`JobFromDef`).
- Сделать события студента событиями Def. Подписчиков `wish`, `peer-review` и бота перевести на прямую подписку.
- Снять роль `STUDENT` и перенести уведомления в stories (п. 7, 8).
- Перевести на `dispatch` `learning/*`, `inactivity`, студенческую часть `view-stream`, `monitor`, `view-stream-mentor`, `streams/controller` и `scripts/gen-e2e`.
- Закрыть красную зону Ф1.

**Ф3. Сборка.**
- Фабрика модуля в `U7App`.
- `@u7-scl/stream/**` в группе ARC-07 `biome.json`.
- Снять `external` у `StreamModuleDef`.
- Удалить `StreamApiModule`, `StreamFacade`, `StreamInProcFacade`, `streamLegacyInbound`, legacy-репозитории и `commands/*-cmd.ts`.
- Перевести `test-app`, тестовые миры и скрипты (`update-stream-snapshot`, `stream-snapshot-sync`) на модуль Def.

**Ф4. Итог.**
- Пилот ролей: окончательное решение по каждой роли и о волне 2.
- `debt.md`: снять погашенное, завести долг роли `STUDENT` и TR экспорта `Role` для трека `user`.
- `migration.md` §6: состояние, входной долг (исправить алиасы DEBT-16, 17, 19, 20), следующий трек — `questionnaire`.

## Нефункциональные требования

- Поведение бота для пользователя сохраняется. Исключения — только одобренные перепроектирования. e2e зелёные на конец Ф2 и Ф3. Сценарии тестов домена и модуля не теряются.
- На каждое событие, которое бот получает по подписке, есть e2e: если подписка оборвётся, уведомления не должны пропадать молча.
- Работа по TDD: red → запуск → green.
- Без новых зависимостей, без деплоя, пуша и перезапуска прода.
- Если понадобится правка `dmg-core`, она делается отдельным коммитом в репо пакета, а его SHA указывается в коммите u7-school (`architecture/index.md`, «Правка платформы»).
- Базовая линия фиксируется в Ф0. На конец `peer-review` было 3526 pass и 996 e2e.

## Критерии приёмки

- В `domain/src/stream` и `modules/stream` нет `throw*` для штатных отказов, `new …Ar`, `#` в Ar, импортов `core` и `app-legacy`.
- DEBT-1, 2, 5, 10 (в части stream) и DEBT-35 погашены, TR-8 решён, `arch:check` синхронен.
- У `StreamModuleDef` нет `external`. Legacy `StreamApiModule`, `streamLegacyInbound` и адаптеры stream у `wish` и `peer-review` удалены.
- В `domain/src/stream`, `modules/stream` и `runners/u7-bot/src` нет `Role.STUDENT`, `isStudent`, `addRoleToUser`, `removeRoleFromUser`. Из `user` ничего не удалено.
- Бот подписан только на имена Def-событий stream.
- `check` зелёный, в отчётах reviewer нет `error`. Красная зона внутри трека закрыта, в `debt.md` её записей нет.
- `git status data/` чист.
- «Пилот ролей» заполнен, по каждой роли принято окончательное решение.
- Каждое перепроектирование одобрено Нурболатом и записано в `TR-<n>`, `decisions.md` или `debt.md`.

## За рамками

- Удаление роли `STUDENT` из `user` (`Role.STUDENT`, `UserPolicy`, данные `data/users`) и перевод `user`, `course`, `questionnaire` на Def.
- Миграция живых данных (трек 7), barrel DEBT-3, `User` в `app-legacy` (DEBT-4).
- Продуктовые доработки UX потоков из `analysis.md`.
