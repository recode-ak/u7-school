# Бриф Ф2: зона проекта и `stream.startDate` (ФР-7: ввод и вывод)

Трек — [spec.md](../spec.md) (ФР-7), [plan.md](../plan.md) Ф2. Черновик — `dmg-tech-lead`, решения — оркестратор.

## Расхождения plan с кодом

- `create-stream.ts:421` — комментарий; нормализация ввода — `:422`, разбор `+Z` — `:783`. Не названы в плане: `:397-400` (пример даты через локальные `getFullYear/getDate`) и `view-stream.story.ts:914` (второй вызов `formatDate`).
- `review-render.ts` не содержит `getUTC*` (`reviewDate` — `toISOString().slice(0,10)`): критерий читается как «`getUTC*` — только в модуле зоны».
- C-DEBT-43 (Признак `getUTCHours\(`, Место — две stories) после фазы нарушит ARC-12 — запись переписать в этой же фазе.

## Границы

- `platform/core/src/shared/project-zone.ts` (+ тест, экспорт в `shared/index.ts`).
- `platform/core/src/ui/bot/bot-ui-story.ts` и тест.
- `runners/u7-bot/src/controllers/streams/stories/view-stream.story.ts`, `courses/stories/wish-invite.story.ts`, `mentor/stories/create-stream.ts` и их тесты; `runners/u7-bot/tests/e2e/user-notify.e2e.test.ts`.
- `conductor/debt/code.md` (C-DEBT-43) — правит оркестратор по отчёту автора.
- Не трогать: `review-render.ts`, `progress.ts:143-146` (`enrolledAt`, локальные геттеры — наблюдение в отчёт), `tests/worlds/*` (Ф5), `student-dmg.test-kit.ts` (Ф5/Ф6), домен и модули, формат хранения.

## Решения

- **Класс `ProjectZone`** (`platform/core/src/shared/project-zone.ts`), простые типы `Timestamp`/`string`, фиксированное смещение (в Уральске нет летнего времени):
  - `static default(): ProjectZone` — UTC+5; приватная константа `DEFAULT_OFFSET_MINUTES = 300` только в этом файле;
  - `constructor(offsetMinutes: number)`;
  - `parseLocal(text): Timestamp | undefined` — `YYYY-MM-DD` или `YYYY-MM-DDTHH:mm` как местное → UTC; строго по regex, невалидное (`2026-02-31`, `25:00`, секунды, `Z`, мусор, пусто) → `undefined`, проверка обратным форматированием;
  - `formatDate(at)` → `дд.мм.гггг`; `formatTime(at)` → `чч:мм`; `formatInput(at)` → `YYYY-MM-DDTHH:mm`;
  - модификаторы TS `private` (CODE-02), не `#`.
- **Единая точка показа — `BotUiStory`:** `protected formatDate(at: Timestamp)` и новый `protected formatTime(at: Timestamp)` делегируют `ProjectZone.default()`; оба `#formatTime` в stories удалить; обёртки `new Date(stream.startDate).toISOString()` убрать.
- **Визард `create-stream`:** контекст хранит `startDate` строкой `YYYY-MM-DDTHH:mm` как местное; дата без времени → `T00:00` местного; разбор — `ProjectZone.default().parseLocal` (`:783`). Невалидный ввод на шаге даты → повторный ask того же шага с текстом об ошибке (формат + пример), UC не вызывается.
- Пример даты (`:397-400`) — `formatInput` от «сейчас + 5 дней, 10:00 в зоне проекта».
- Ввод с пробелом вместо `T` и с секундами — не принимается (как сейчас). Превью визарда (`:732`) не меняется.
- **C-DEBT-43:** Место — `platform/core/src/shared/project-zone.ts` (+ в тексте остаток `review-render.ts` `reviewDate`); Признак — `getUTCHours\(`; Корень — `{platform/core,runners/u7-bot}/src/**`. Тест зоны не должен содержать `getUTCHours(`.

## Было → станет

| Было | Станет |
|---|---|
| `bot-ui-story.ts:279-290` `formatDate(iso: string)` через `getUTC*` | `formatDate(at)`, `formatTime(at)` через `ProjectZone` |
| `view-stream.story.ts:164-166,914,934-945` `#formatTime`, ISO-обёртки | `this.formatDate/formatTime(stream.startDate)` |
| `wish-invite.story.ts:98,105,201-211` | то же |
| `create-stream.ts:397-400` локальные `getFullYear` | `ProjectZone.default().formatInput(...)` |
| `create-stream.ts:417-430` без валидации | `parseLocal`; невалидное → повторный ask |
| `create-stream.ts:783` `new Date(`${s}Z`).getTime()` | `ProjectZone.default().parseLocal(ctx.startDate)` |

## Тесты, которые затронет смена показа

| Тест | Изменение |
|---|---|
| `bot-ui-story.test.ts:121,459-462` | логика переезжает в `project-zone.test.ts` (TST-08); в `bot-ui-story` — одна проверка делегата на `Timestamp`, плюс `formatTime` |
| `wish-invite.story.test.ts:35,168-169` | `'10:00'` → `'15:00'` |
| `tests/e2e/user-notify.e2e.test.ts:106,121` | `Date.UTC(2026,9,1)`: `…, 00:00` → `…, 05:00` |
| `create-stream.test.ts:657` | `T14:00:00.000Z` → `T09:00:00.000Z` |
| `create-stream.test.ts:338,354,363,555,628` | строки контекста не меняются — подтвердить прогоном |

Без правок (проверить прогоном): `view-stream.story.test.ts`, `view-stream.status-mark.test.ts`, `inactivity.story.test.ts`, `step-view.test.ts`, `progress.test.ts`, `view-stream-mentor.test.ts`, `tests/streams/view-stream.integration.test.ts`.

## Критерии приёмки

1. `bun run check`, `bun run arch:check` зелёные; тестов ≥ 3456 (удаления — только перенос `formatDate`, с пояснением).
2. `grep -rnE "getUTC|\+ ?[\"'\`]Z|Z\`" runners/u7-bot/src platform/core/src --include=*.ts` — вне `project-zone.ts` совпадений в коде нет.
3. Тесты «10:00 по Уральску ↔ 05:00Z» в обе стороны и граница суток (22:30Z → следующий день; 23:59 местного ↔ 18:59Z).
4. Невалидный ввод даты — отказ с понятным текстом, UC не вызывается.
5. C-DEBT-43 соответствует новому Месту, ARC-12 зелёный.

## Правила

Проект: ARC-01, ARC-12, TST-06, TST-08. `dmg-core`: CODE-02, CODE-04, TST-04, TST-05, TST-08, TST-09, DOM-12.

## Шаги

1. `dmg-test-designer` — red-тесты: `project-zone.test.ts`; `create-stream.test.ts` (ввод `…T14:00` → команда с 09:00Z; невалидный ввод → тот же шаг, текст ошибки); `view-stream.story.test.ts` (`startDate = 10:00Z` → «15:00»; «Обучение начнётся» на границе суток); правки таблицы выше. Запуск — падают по делу.
2. `dmg-api-author` — класс, `BotUiStory`, три stories, пример даты; текст для C-DEBT-43 — в отчёт.
3. `dmg-reviewer`.

## Открытые вопросы

—

## Отчёты

### Ф2 шаг 1 — dmg-test-designer

`project-zone.test.ts` (новый): 10:00 местного ↔ 05:00Z, границы суток и года, дата без времени, 15 невалидных вводов, смещения 0/−180/300. `bot-ui-story.test.ts`: логика `formatDate` переехала в тест зоны (TST-08), осталась одна проверка делегата. `view-stream.story.test.ts`: +3 (15:00; 22:30Z → следующий день; «Обучение начнётся»). `create-stream.test.ts`: 09:00Z, 7 невалидных вводов, 23:59 → 18:59Z, дата без времени. `wish-invite` 15:00, `user-notify.e2e` 05:00. Red: 17 fail по делу.

### Ф2 шаг 2 — dmg-api-author

`ProjectZone` (`platform/core/src/shared/project-zone.ts`), `BotUiStory.formatDate/formatTime` делегируют зоне, `#formatTime` в stories удалены, `create-stream`: пример через `formatInput`, повторный ask на невалидный ввод, разбор через `parseLocal`. Эскалации решены оркестратором:
- C-DEBT-43: в модуле зоны нет `getUTCHours(` → Признак `DEFAULT_OFFSET_MINUTES`, Корень `platform/core/src/**` (отклонение от брифа, ARC-12 соблюдён).
- e2e P4-48 (`mentor-management.e2e.test.ts:759`) ждал отказ на confirm → переписан `dmg-test-designer`: «Некорректная дата» на шаге 3, поток не создан. Дубль unit-теста частичный, оставлен как сквозная проверка (в реестр не идёт — дубль среза).
- Наблюдение (вне фазы): `progress.ts:143-146` (`enrolledAt`) — локальные геттеры, зависят от TZ процесса.

### Ф2 шаг 3 — dmg-reviewer

Error нет. Решено: question «NaN в UC при неразобранной дате в confirm» → guard (warn + release, «Дата старта потеряна или некорректна»), тест «модуль не найден» получил валидный `startDate`, добавлен тест «невалидный startDate в контексте — UC не вызван»; warn TST-08 (граница суток в `bot-ui-story.test.ts`) → простая точка 05:00Z. Критерий 2: единственное совпадение — `student-dmg.test-kit.ts:38` (`${iso}Z`), тест-кит, уходит в Ф5/Ф6.

Итог: `CI=true bun run check` — 3498 pass / 0 fail (база 3456), `arch:check` без нарушений.
