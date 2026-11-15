# План: `timezones` — часовые зоны школы и пользователя

> Spec — [spec.md](./spec.md). Исполнители: **O** — Opus, **S** — Sonnet (роли `conductor/architecture/agents.md` §4). Весь трек — u7-school, репо `dmg-core` не затрагивается (тег `#v0.3.2`).
>
> Порядок: Ф1 → Ф2 → Ф3, фаза = сессия.
>
> Рабочие имена: `LocalZone` (`platform/app/src/zone/local-zone.ts`, фабрика `LocalZone.of(name)`), валидатор имени IANA в домене (`domain/src/user/user/time-zone.vo.ts`), `School.timeZone`, `UserState.timeZone`.

---

## Фаза 1: сервис зоны и поля зоны (ФР-1–4)

- [ ] Task: O — базовая линия: `bun run check`, `CI=true bun test`; числа — в `summary.md`
- [ ] Task: S (`dmg-test-designer`) — red-тесты
    - [ ] `LocalZone`: `parseLocal` ↔ `formatInput`; отказ на `31.02` / `25:00` / секунды / `Z`; зона с летним временем (`Europe/Berlin`) в обоих сезонах; неизвестное имя — отказ `of`
    - [ ] `LocalZone`: время с подписью `18:00 (UTC+5)`, дата без подписи; `Etc/GMT-5` подписан как `UTC+5`
    - [ ] Перенос сценариев `platform/core/src/shared/project-zone.test.ts` в тест `LocalZone` на `Asia/Oral` (список сценариев сверен)
    - [ ] Валидатор имени IANA; `UserState` без `timeZone`, с `Europe/Berlin`, с `Mars/Base` (отказ); `SchoolSchema` отклоняет неизвестную зону; `U7_SCHOOL_STATIC.timeZone === 'Asia/Oral'` (`school.test.ts`)
    - [ ] Запуск — падают по делу
- [ ] Task: O (`dmg-domain-author` / автор `platform/app`) — валидатор IANA → `UserState.timeZone` (optional, не `F.sensitive`) → `School.timeZone` (`U7_SCHOOL_STATIC`, `SchoolSchema`, `createSchool`) → `LocalZone` с кэшем форматтера `Intl`; экспорт из `@u7-scl/app`
- [ ] Task: S (`dmg-data-keeper`) — старые записи `UserState` без поля читаются без миграции (только чтение; `data/fixtures`, живой `data/` не трогать)
- [ ] Task: O (`dmg-reviewer`) — ревью; замечания error/warn исправлены
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

**Критерии:** `bun run check` зелёный, тестов не меньше базовой линии; в тесте `LocalZone` есть случаи на `31.02`, `25:00`, оба сезона `Europe/Berlin`, неизвестное имя, подпись; `SchoolSchema` отклоняет `Foo/Bar`; `UserState` принимает запись без поля; `git diff package.json bun.lock` — без новых зависимостей; отчёт `dmg-data-keeper` без блокеров.

## Фаза 2: зона школы в раннере, удаление `ProjectZone` (ФР-3, 5–6)

- [ ] Task: S (`dmg-test-designer`) — red-тесты
    - [ ] `U7BotUiStory.formatDate/formatTime` — зона школы, `18:00 (UTC+5)` (перенос сценария `bot-ui-story.test.ts:463`)
    - [ ] `view-stream` и `wish-invite` — старт `чч:мм (UTC+5)`
    - [ ] `reviewDate` с зоной: переписать `review-render.test.ts` на зону школы, сценарии границы суток сохранить; вызывающие стори
    - [ ] `progress` — дата записи в зоне школы (новый тест, сейчас дата не проверяется)
    - [ ] мастер потока: подсказка «в зоне школы (UTC+5)»; ввод `2026-12-01T18:00` → `2026-12-01T13:00Z`
    - [ ] Запуск — падают по делу
- [ ] Task: S (`dmg-api-author` / автор раннера) — `formatDate/formatTime` из `BotUiStory` в `U7BotUiStory`; `reviewDate`/`renderReviewCard` и стори; `progress.ts`; `create-stream.ts` (зона — поле стори из `this.resolve.school`); удалить `project-zone.ts`, его тест, экспорт из `shared/index.ts`, импорт в `bot-ui-story.ts`
- [ ] Task: O (`dmg-reviewer`) — ревью; замечания error/warn исправлены
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

**Критерии:** `bun run check` зелёный, тестов не меньше базовой линии, сценарии перенесённых тестов не потеряны; `rg "ProjectZone|DEFAULT_OFFSET_MINUTES" platform runners modules domain --glob '*.ts'` пуст; `rg "getDate\(\)|getHours\(\)|toISOString\(\)\.slice" runners/u7-bot/src --glob '!*.test.ts'` — только `json-file-repo.ts`; тест мастера: `2026-12-01T18:00` → `2026-12-01T13:00Z`.

## Фаза 3: документация и финал (ФР-7–8)

- [ ] Task: S — правило выбора зоны в проектной документации (`conductor/architecture/ui/` — гайд экранов бота): время школы — в зоне школы, личное — зона пользователя ?? зона школы, время с подписью
- [ ] Task: S — `decisions.md`: новое D (зона школы, IANA, подпись, место `LocalZone`, расписания job — в UTC с местным временем в комментарии, миры читают UTC по D-36)
- [ ] Task: S — `dmg-ui-entry.md`: пункт о зоне (поле времени берёт зону из контекста и подписывает; экран личной зоны; ввод кнопками частых зон, запасной — смещения как `Etc/GMT∓N`; Telegram зону не передаёт)
- [ ] Task: S — удалить `C-DEBT-43` из `conductor/debt/code.md`; `conductor/architecture/index.md` (раздел о раскладке — `zone/` в `platform/app`); `CHANGELOG.md`
- [ ] Task: O (`dmg-reviewer`) — ревью текстов и ссылок
- [ ] Task: O — финальный гейт (`workflow.md`, «Гейт качества»): `bun run check`, `CI=true bun test`, сравнение с базовой линией, триаж — в `summary.md`
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

**Критерии:** `grep -n "зон" conductor/roadmap/dmg-ui-entry.md` находит пункт со способом ввода; `grep -n "C-DEBT-43" conductor/debt/code.md` пуст; новое D в `decisions.md`; правило выбора зоны записано; `bun run check` зелёный, тестов не меньше базовой линии.

## Покрытие spec

| Критерий spec | Фаза |
|---|---|
| 1 School.timeZone | Ф1 |
| 2 UserState, живые записи | Ф1 |
| 3 нет `ProjectZone` и вывода в обход | Ф2 |
| 4 тесты сервиса | Ф1 |
| 5 экраны и даты | Ф2 |
| 6 мастер | Ф2 |
| 7 job — правило UTC в D | Ф3 |
| 8 документация, D, C-DEBT-43 | Ф3 |
| 9 гейт | каждая фаза, финал — Ф3 |

## Риски

- Валидатор IANA в домене — решение вне образца; альтернатива (дубль в `app`) хуже.
- Перенос `formatDate/formatTime` меняет API `@u7-scl/core`; потребителей вне `runners/u7-bot` нет — подтвердить в брифе Ф2.
- Тесты, закрепляющие состав (`domain/src/index.test.ts`, `school.test.ts`, `user.sensitive.test.ts`), — проверить в брифе Ф1.
