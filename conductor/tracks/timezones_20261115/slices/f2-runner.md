# Бриф среза Ф2: зона школы в раннере, удаление `ProjectZone`

Spec — [../spec.md](../spec.md) (ФР-3, 5–6), план — [../plan.md](../plan.md), Фаза 2. Сервис зоны — Ф1 ([f1-zone.md](./f1-zone.md)): `LocalZone` из `@u7-scl/app` (`of`, `parseLocal`, `formatDate`, `formatTime` → `чч:мм (UTC+5)`, `formatInput`, `offsetLabel`).

## Границы

| Пакет | Файлы | Что |
|---|---|---|
| `@u7-scl/core` | `platform/core/src/ui/bot/bot-ui-story.ts` (+тест) | удалить `formatDate/formatTime` и импорт `ProjectZone` |
| `@u7-scl/core` | `platform/core/src/shared/project-zone.ts`, `project-zone.test.ts`, экспорт в `shared/index.ts` | удалить |
| `runners/u7-bot` | `src/core/u7-bot-ui-story.ts` (+тест) | `zone`, `formatDate`, `formatTime` |
| `runners/u7-bot` | `controllers/streams/stories/view-stream.story.ts`, `controllers/courses/stories/wish-invite.story.ts` | старт `дд.мм.гггг, чч:мм (UTC+5)` — через унаследованные `formatDate/formatTime`, код стори почти не меняется |
| `runners/u7-bot` | `controllers/peer-review/stories/review-render.ts` (+тест), `reviews-for-me.story.ts`, `controllers/school/stories/school-reviews.story.ts` | дата отзыва в зоне школы |
| `runners/u7-bot` | `controllers/learning/stories/progress.ts` (+тест) | дата записи `В обучении: с …` в зоне школы |
| `runners/u7-bot` | `controllers/mentor/stories/create-stream.ts` (+тест) | подсказка, пример, разбор и подтверждение — через зону школы |
| `runners/u7-bot` | тесты, закрепляющие старый формат времени (`tests/e2e/user-notify.e2e.test.ts:121` и др.) | ожидание с подписью `(UTC+5)` |

Вне среза: остальной мастер, экраны (`dmg-ui`), `InactivitySweepJobDef`, миры тестов (`tests/worlds/relative-time.ts` — UTC по D-36, не меняются), `json-file-repo.ts` (служебное имя файла).

Потребители `formatDate/formatTime` из `BotUiStory` вне `runners/u7-bot` — нет (проверено `rg`); API `@u7-scl/core` сужается без внешних потребителей.

## Реализация

### `U7BotUiStory`

- `protected get zone(): LocalZone` — зона школы `LocalZone.of(this.resolve.school.timeZone)`, кэш в приватном поле экземпляра (форматтер `Intl` создаётся один раз; при смене имени зоны в `resolve` — пересоздать).
- `protected formatDate(at)` / `formatTime(at)` → `this.zone.formatDate/formatTime`. JSDoc: «зона школы».
- В `BotUiStory` (`platform/core`) этих методов больше нет: `platform/core` без зоны (ARC-01).

### `review-render.ts`

- `reviewDate(createdAt, zone: LocalZone)` → `zone.formatDate(createdAt)`; `renderReviewCard` / `renderSchoolReviewCard` получают `zone` в `args`. Вызывающие стори передают `this.zone`. JSDoc без «Зона — UTC».

### `progress.ts`

- `dateStr = this.formatDate(student.enrolledAt)` вместо локальных геттеров `Date`. Счёт дней не меняется.

### `create-stream.ts`

- Импорт `ProjectZone` удалить; зона — `this.zone`.
- Подсказка шага даты: «… в зоне школы (UTC+5)»; подпись — `this.zone.offsetLabel(now().getTime())`. Сообщение об ошибке ввода — тоже с этой подписью.
- `#exampleDate`, `#handleDateInput`, разбор в confirm — через `this.zone`.

## Сценарии тестов (red)

1. `u7-bot-ui-story.test.ts`: `formatDate/formatTime` берут зону школы — перенос сценария `platform/core/src/ui/bot/bot-ui-story.test.ts:463` (`05:00Z` → `17.09.2026`, `10:00 (UTC+5)`); плюс школа с другой зоной (`Europe/Berlin`, лето) → `07:00 (UTC+2)` — зона берётся из `resolve.school`, а не зашита. Тест-хелперы `callFormatDate/callFormatTime` в тесте `BotUiStory` удаляются вместе со сценарием (TST-08).
2. `view-stream.story.test.ts` и `wish-invite.story.test.ts`: старт показан `чч:мм (UTC+5)` (с экранированием MarkdownV2).
3. `review-render.test.ts`: переписать на зону школы (`LocalZone.of('Asia/Oral')`), сценарии границы суток сохранить, сдвинув на зону: `2026-09-21T18:59Z` → `21.09.2026`, `2026-09-21T19:00Z` → `22.09.2026`. Тесты сторей-потребителей (`reviews-for-me`, `school-reviews`) — без новых кейсов, если ожидания дат не меняются.
4. `progress.test.ts`: дата записи в зоне школы — новый тест: `enrolledAt = 2026-09-05T19:30Z` → `с 06.09.2026` (в UTC было бы 05.09).
5. `create-stream.test.ts`: подсказка содержит «в зоне школы» и `UTC\+5` (экранированно); ввод `2026-12-01T18:00` → в UC уходит `startDate = Date.parse('2026-12-01T13:00:00Z')`.
6. Существующие тесты, закрепляющие время без подписи (`user-notify.e2e.test.ts:121` и найденные `rg`) — ожидание с `\\(UTC\\+5\\)`.
7. Запуск — падают по делу.

## Критерии приёмки

- `bun run check` зелёный, тестов ≥ 3511; сценарии `project-zone.test.ts` и `bot-ui-story.test.ts:463` не потеряны (они уже в `local-zone.test.ts` / переезжают в `u7-bot-ui-story.test.ts`).
- `rg "ProjectZone|DEFAULT_OFFSET_MINUTES" platform runners modules domain --glob '*.ts'` пуст.
- `rg "getDate\(\)|getHours\(\)|toISOString\(\)\.slice" runners/u7-bot/src --glob '!*.test.ts'` — только `json-file-repo.ts`.
- Тест мастера: `2026-12-01T18:00` → `2026-12-01T13:00Z`.

## Применимые ID

ARC-01 (`platform/core` без зоны и без `@u7-scl/app`), ARC-06 (раннер берёт `LocalZone` из `@u7-scl/app` — корень сборки раннеру доступен), CODE-01, TST-04, TST-08 (сценарии переезжают, старые тесты удаляются), TST-09.

---

## Отчёт `dmg-test-designer` (Sonnet)

- +8 тестов, −1 (сценарий `bot-ui-story.test.ts:463` с хелперами `callFormatDate/Time` → `u7-bot-ui-story.test.ts`, «U7BotUiStory — зона школы»: `Asia/Oral` и `Europe/Berlin`), 6 тестов с новыми ожиданиями (`view-stream.story.test.ts:179,193`, `wish-invite.story.test.ts:171`, `user-notify.e2e.test.ts:121` и др.).
- `school: TEST_SCHOOL` добавлен в `init` тестов `view-stream`, `wish-invite`, `reviews-for-me`, `progress`.
- Red: 17 fail по делу (+5 ожидаемых ошибок tsc в `review-render.test.ts` — новая сигнатура).
- Кандидат: confirm `2026-12-01T18:00 → 13:00Z` в `create-stream.test.ts` близок к имеющимся (23:59→18:59Z) — оставлен: его называет критерий spec (6).

## Отчёт автора (`dmg-api-author`, Sonnet)

- `U7BotUiStory.zone` (кэш по имени зоны из `resolve.school`), `formatDate/formatTime`; из `BotUiStory` — удалены вместе с `ProjectZone` (`project-zone.ts`, тест, экспорт).
- `reviewDate(createdAt, zone)`, `zone` в args карточек; `progress.ts` — `this.formatDate`; `create-stream.ts` — подсказка и ошибка «в зоне школы (UTC+5)», пример, разбор, confirm и превью (`01.12.2026, 18:00 (UTC+5)`) через `this.zone`.
- Эскалация: старые тесты (`streams/controller.test.ts`, `view-stream-mentor.test.ts`) звали `init` без `school` — правку тестов автору заблокировал классификатор (вне роли); сделал тест-дизайнер.
- Найден тест-дизайнером баг: неэкранированные скобки подписи в подсказке (`\(` внутри `md`) — падали e2e мастера; добавлен `assertDialogResponseMarkdownSafe` на шаг даты, исправлено.

## Отчёт `dmg-reviewer` (Opus)

Error нет. Исправлено: превью мастера без подписи зоны (ФР-4), мёртвая обёртка `Date` в `progress.ts`, устаревший комментарий теста; `bot-architecture.md` §2.4 — в Ф3. К сведению: подсказка мастера берёт смещение на `now()` — для зоны с летним временем зимой покажет зимнее (разбор верен).

Дубли среза почищены в срезе (−3): confirm 23:59→18:59Z и «дата без времени» в `create-stream.test.ts`, «22:30Z — следующие сутки» в `view-stream.story.test.ts`.

## Итог

`bun run check` зелёный, 3545 pass / 0 fail (база 3511; −`project-zone.test.ts`, сценарии в `local-zone.test.ts`); `rg` ProjectZone — пусто; локальные геттеры `Date` — только `json-file-repo.ts`. `C-DEBT-43` удалён в этом же коммите: без класса запись ломает сверку долга `arch:check`.
