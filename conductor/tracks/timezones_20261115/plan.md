# План: `timezones` — часовые зоны школы и пользователя

> Spec — [spec.md](./spec.md). Исполнители: **O** — Opus, **S** — Sonnet (роли `conductor/architecture/agents.md` §4). Весь трек — u7-school, репо `dmg-core` не затрагивается (тег `#v0.4.0`).
>
> Порядок: Ф1 → Ф2 → Ф3, фаза = сессия.
>
> Рабочие имена: `LocalZone` (`platform/app/src/zone/local-zone.ts`, фабрика `LocalZone.of(name)`), валидатор имени IANA в домене (`domain/src/user/user/time-zone.vo.ts`), `School.timeZone`, `UserState.timeZone`.

---

## Фаза 1: сервис зоны и поля зоны (ФР-1–4) [checkpoint: be5ed3d]

- [x] Task: O — базовая линия: `bun run check`, `CI=true bun test`; числа — в `summary.md` (3511 pass / 0 fail)
- [x] Task: S (`dmg-test-designer`) — red-тесты `14c1fc2`
    - [x] `LocalZone`: `parseLocal` ↔ `formatInput`; отказ на `31.02` / `25:00` / секунды / `Z`; зона с летним временем (`Europe/Berlin`) в обоих сезонах; неизвестное имя — отказ `of`
    - [x] `LocalZone`: время с подписью `18:00 (UTC+5)`, дата без подписи; `Etc/GMT-5` подписан как `UTC+5`
    - [x] Перенос сценариев `platform/core/src/shared/project-zone.test.ts` в тест `LocalZone` на `Asia/Oral` (список сценариев сверен)
    - [x] Валидатор имени IANA; `UserState` без `timeZone`, с `Europe/Berlin`, с `Mars/Base` (отказ); `SchoolSchema` отклоняет неизвестную зону; `U7_SCHOOL_STATIC.timeZone === 'Asia/Oral'` (`school.test.ts`)
    - [x] Запуск — падают по делу
- [x] Task: O (`dmg-domain-author` / автор `platform/app`) — валидатор IANA → `UserState.timeZone` (optional, не `F.sensitive`) → `School.timeZone` (`U7_SCHOOL_STATIC`, `SchoolSchema`, `createSchool`) → `LocalZone` с кэшем форматтера `Intl`; экспорт из `@u7-scl/app` `14c1fc2` (валидатор — `TimeZoneVo` в `domain/src/shared`, бриф `slices/f1-zone.md`)
- [x] Task: S (`dmg-data-keeper`) — старые записи `UserState` без поля читаются без миграции (только чтение; `data/fixtures`, живой `data/` не трогать) `14c1fc2` — без блокеров
- [x] Task: O (`dmg-reviewer`) — ревью; замечания error/warn исправлены `14c1fc2`
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md) — автоматическая (по указанию Нурболата трек идёт без пауз): `CI=true bun test` 3571/0; `School.timeZone` → `2026-12-01T18:00` = `13:00Z`, `18:00 (UTC+5)`

**Критерии:** `bun run check` зелёный, тестов не меньше базовой линии; в тесте `LocalZone` есть случаи на `31.02`, `25:00`, оба сезона `Europe/Berlin`, неизвестное имя, подпись; `SchoolSchema` отклоняет `Foo/Bar`; `UserState` принимает запись без поля; `git diff package.json bun.lock` — без новых зависимостей; отчёт `dmg-data-keeper` без блокеров.

## Фаза 2: зона школы в раннере, удаление `ProjectZone` (ФР-3, 5–6) [checkpoint: e34207f]

- [x] Task: S (`dmg-test-designer`) — red-тесты `305e57d`
    - [x] `U7BotUiStory.formatDate/formatTime` — зона школы, `18:00 (UTC+5)` (перенос сценария `bot-ui-story.test.ts:463`)
    - [x] `view-stream` и `wish-invite` — старт `чч:мм (UTC+5)`
    - [x] `reviewDate` с зоной: переписать `review-render.test.ts` на зону школы, сценарии границы суток сохранить; вызывающие стори
    - [x] `progress` — дата записи в зоне школы (новый тест, сейчас дата не проверяется)
    - [x] мастер потока: подсказка «в зоне школы (UTC+5)»; ввод `2026-12-01T18:00` → `2026-12-01T13:00Z`
    - [x] Запуск — падают по делу
- [x] Task: S (`dmg-api-author` / автор раннера) — `formatDate/formatTime` из `BotUiStory` в `U7BotUiStory`; `reviewDate`/`renderReviewCard` и стори; `progress.ts`; `create-stream.ts` (зона — поле стори из `this.resolve.school`); удалить `project-zone.ts`, его тест, экспорт из `shared/index.ts`, импорт в `bot-ui-story.ts` `305e57d` (+ превью мастера с подписью; `C-DEBT-43` удалён здесь — без класса запись ломает `arch:check`; бриф `slices/f2-runner.md`)
- [x] Task: O (`dmg-reviewer`) — ревью; замечания error/warn исправлены `305e57d`
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md) — автоматическая (трек без пауз): `CI=true bun test` 3545/0; e2e мастера и `user-notify` — зелёные

**Критерии:** `bun run check` зелёный, тестов не меньше базовой линии, сценарии перенесённых тестов не потеряны; `rg "ProjectZone|DEFAULT_OFFSET_MINUTES" platform runners modules domain --glob '*.ts'` пуст; `rg "getDate\(\)|getHours\(\)|toISOString\(\)\.slice" runners/u7-bot/src --glob '!*.test.ts'` — только `json-file-repo.ts`; тест мастера: `2026-12-01T18:00` → `2026-12-01T13:00Z`.

## Фаза 3: документация и финал (ФР-7–8)

- [x] Task: S — правило выбора зоны в проектной документации (`conductor/architecture/ui/` — гайд экранов бота): время школы — в зоне школы, личное — зона пользователя ?? зона школы, время с подписью
- [x] Task: S — `decisions.md`: новое D (зона школы, IANA, подпись, место `LocalZone`, расписания job — в UTC с местным временем в комментарии, миры читают UTC по D-36)
- [x] Task: S — `dmg-ui-entry.md`: пункт о зоне (поле времени берёт зону из контекста и подписывает; экран личной зоны; ввод кнопками частых зон, запасной — смещения как `Etc/GMT∓N`; Telegram зону не передаёт)
- [x] Task: S — удалить `C-DEBT-43` из `conductor/debt/code.md` (сделано в Ф2, `305e57d`); `conductor/architecture/index.md` (раздел о раскладке — `zone/` в `platform/app`); `CHANGELOG.md`
- [x] Task: O (`dmg-reviewer`) — ревью текстов и ссылок `98208b9`
- [x] Task: O — финальный гейт (`workflow.md`, «Гейт качества»): `bun run check`, `CI=true bun test`, сравнение с базовой линией, триаж — в `summary.md` `98208b9` (3545/0)
- [x] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md) — автоматическая (трек без пауз): критерии фазы проверены `grep`, ревью текстов без error

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
