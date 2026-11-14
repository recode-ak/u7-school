# Вход для `dmg-ui`

**Назначение:** что будущая spec `dmg-ui` (UI-слой поверх `dmg-core`) обязана учесть: задачи из долга и бэклога, которые решаются только вместе с новым контрактом story.

> Черновик (трек `pre-dmg-ui-cleanup`, Ф3 — из `TODO.md`). Доводится в Ф7 по spec трека ФР-7: каскад `init` vs конструктор, F-110 (D-72 для `stream`), `@u7-scl/core` (`ui`, `shared`), [bot-ui-session-architecture.md](./bot-ui-session-architecture.md).

---

## 1. Форма ввода по схеме входа UC (wizard)

Сейчас пошаговый ввод написан вручную в единственном мастере — создание потока (`runners/u7-bot/src/controllers/mentor/stories/create-stream.ts`). Отдельный базовый класс `WizardStory` не делаем: `dmg-ui` строит форму из схемы входа UC (поля, валидация, ошибки по `Result`), мастер потока переходит на неё.

## 2. Экран отказа по `Result`

`ucErrorScreen` (`runners/u7-bot/src/controllers/questionnaire/stories/render.ts`) дублирует ветки `ucErrorNotify`. Один экран отказа по коду ошибки UC — вместе с контрактом story.

## 3. Автоподключение к группе потока

На `student.enrolled` студент попадает в Telegram-группу потока (`telegramGroupId`, ссылка — `telegramGroupInvite`) без ручного перехода по ссылке. Нужна операция транспорта (Bot API: `createChatInviteLink` или `approveChatJoinRequest`) и реакция UI на событие — не отдельным обработчиком в обход story. Сообщение о зачислении уже есть — не дублировать.

## 4. Долг, который гасит `dmg-ui`

- [C-DEBT-41](../debt/code.md) — id запроса в контракте story вместо `AsyncLocalStorage`;
- [C-DEBT-53](../debt/code.md) — нагрузка списка монитора;
- [D-DEBT-5](../debt/product.md) — история шагов студента у ментора;
- [D-DEBT-4](../debt/product.md) — зачисление в активный поток (после `dmg-ui`).
