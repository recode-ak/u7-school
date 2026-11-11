# Тестирование Telegram-бота (bot-test) — Styleguide

**Назначение:** правила тестирования UI-слоя Telegram-бота на трёх уровнях: unit, интеграционном, E2E.

> Общее устройство слоёв — см. [bot-architecture.md](./bot-architecture.md).

---

## 1. Уровни тестирования

| Уровень | Расположение | Что проверяет | Моки |
|---|---|---|:---:|
| **Unit** | `runners/u7-bot/src/controllers/**/*.test.ts`, `platform/core/src/ui/bot/*.test.ts` | Логика одной стори/контроллера в изоляции | ✅ `moduleApi`, `appApi` |
| **Интеграционный** | `runners/u7-bot/tests/<module>/*.integration.test.ts` | Стори + контроллер + BotTransport + реальные JSON-репозитории | ❌ |
| **E2E** | `runners/u7-bot/tests/e2e/*.e2e.test.ts` | Полные пользовательские цепочки через `code` кнопок | ❌ |

---

## 2. Ключевые правила

1. **Unit:** стори вызывается напрямую (`story.handleCallback(...)`), без роутера и транспорта. Не проверяются `code` кнопок — только текст и наличие кнопок.
2. **Integration:** вызов через честный `BotTransport` (хелпер `TestBotTransport`) с полным `callback_data`. Проверяется семантика ответа, НЕ внутренняя структура `code`.
3. **E2E:** каждый шаг извлекает `code` из кнопки предыдущего ответа и передаёт дальше. Единственный уровень, ловящий ошибки формирования `callback_data` (включая сжатие UUID).
4. **MarkdownV2-валидация обязательна** на всех уровнях (см. §4).
5. **Уровни не повторяют друг друга** (TST-08, решение Нурболата 2026-11-05). Integration проверяет связку слоёв (стори → транспорт → модуль → реальные репозитории), а не ветки стори: на файл — сквозной сценарий и то, что unit-уровнем не проверить. E2E — пользовательская история: последовательные действия пользователя, гарантирующие, что обещанное ему работает; без фанатизма — по истории, а не по каждой ветке экрана. Ветки, тексты и умолчания платформы (`menuButtons`, «Неизвестная команда») — только unit; общий хелпер раздела — один тест, а не в каждой стори.
6. **Изоляция:** каждый `describe` со своим `TestApp` (отдельные фикстуры) и `transport.reset()` в `beforeEach` (чистые сессии), чтобы изменения состояния не влияли на другие сценарии.

---

## 3. Структура и хелперы

```
runners/u7-bot/tests/
├── helpers/
│   ├── test-app.ts            # createTestApp() — ApiApp с временными репозиториями
│   ├── test-bot-transport.ts  # TestBotTransport — BotTransport + мок Api + сессии
│   └── fixture-loader.ts      # loadFixtures() — copy-on-write из кеша материализации миров
├── worlds/                    # декларативные тестовые миры (core-education, minimal, world-kit)
├── <module>/                  # интеграционные тесты модулей (courses/, streams/, learning/, mentor/)
└── e2e/                       # E2E сценарии
```

Хелпер `TestBotTransport` (`runners/u7-bot/tests/helpers/test-bot-transport.ts`):

- реальный `BotTransport` + реальный `U7BotUiApp` + реальная `sessionMap`;
- мок `RecordingBotApi` (`sendMessage`/`editMessageText` пишут вызовы в массив);
- фабрика `makeBotContext(tgId, { callbackData?/text? })`;
- `createTestBotTransport(app, controllers)` — быстрая сборка из `TestApp`.

Интеграционный вызов выглядит так:

```typescript
const response = await transport.handleCallback(
  transport.makeBotContext(guest.telegramId, { callbackData: 'stream:catalog:list' }),
);
assertBotResponseValid(response);
```

Примеры живых тестов:
- unit: `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.test.ts`;
- integration: `runners/u7-bot/tests/streams/catalog.integration.test.ts`;
- E2E: `runners/u7-bot/tests/e2e/`.

### Формат callback_data

```
stream:catalog:list                  — CatalogStory
stream:view-stream:view:<uuid>       — ViewStreamStory
learning:hub:my-study                — HubStory
course:course-catalog:list           — CourseCatalogStory
```

Первая часть — имя контроллера, вторая — имя стори, третья — экшен.
Префикс контроллера добавляет `BotController`; сжатие UUID (≤ 64 байт) выполняет
`BotTransport` (см. [bot-architecture.md](./bot-architecture.md), §4).

---

## 4. Валидация BotResponse

| Функция (`@u7-scl/core/ui`) | Проверяет | Где использовать |
|---|---|---|
| `assertResponseMarkdownSafe` | Только MarkdownV2 | Unit (стори без контроллера) |
| `assertBotResponseValid` | MarkdownV2 **+** длина `code` ≤ 64 байт | Integration, E2E |

```typescript
const response = await transport.handleCallback(ctx);
assertBotResponseValid(response);
```

### 4.1 Экранирование MarkdownV2

Любое сообщение с `parseMode: 'MarkdownV2'` обязано проходить `assertResponseMarkdownSafe()`.

Telegram резервирует: `` _ * [ ] ( ) ~ ` > # + - = | { } . ! ``

| Категория | Символы | Правило |
|---|---|---|
| Никогда не форматирующие | `. ! + - = \|` | **Всегда** экранировать (`\\.`) |
| Форматирующие | `* _ ~ \`` | Парные (чётное количество) |

- **Статические строки** — ручное экранирование.
- **Динамические значения** — `escapeMarkdown` из `@u7-scl/core/shared`. Нельзя применять к строке с готовой разметкой — только к отдельным значениям.

Функции: `validateMarkdownV2` (dev-assert), `assertMarkdownV2Safe` (низкоуровневые тесты), `assertResponseMarkdownSafe` (стори/контроллеры/e2e). Код: `platform/core/src/shared/markdown.ts`, `markdown-validator.ts`, `platform/core/src/ui/bot/response-assert.ts`.

---

## 5. E2E: хелперы и сценарии

```typescript
/** Найти кнопку в ответе по вхождению подстроки в текст */
function findButton(response: BotResponse, textContains: string): { text: string; code: string } {
  const btn = response.sendMessage?.keyboard?.rows.flat()
    .find(b => b.text.includes(textContains));
  if (!btn) throw new Error(`Кнопка «${textContains}» не найдена`);
  return btn;
}
```

Минимальный набор сценариев на модуль: гость (меню → каталог → карточка → назад), кандидат (запись на поток), студент («Моя учёба»), ментор (каталог → студенты → детали).

---

## 6. Запуск и отладка

```bash
bun test runners/u7-bot/                                  # все тесты бота
bun test runners/u7-bot/tests/<module>/                   # интеграционные модуля
bun test runners/u7-bot/tests/e2e/                        # e2e
bun test platform/core/src/ui/bot/                     # unit (core)

KEEP_FIXTURES=1 bun test runners/u7-bot/tests/streams/catalog.integration.test.ts  # не удалять фикстуры
```

---

## Связанные документы

- [Общие правила тестирования](../../../node_modules/dmg-core/docs/reference/testing.md)
- [BotController](./bot-controller.md) — префиксация кнопок, handleError
- [BotUiStory](./bot-ui-story.md) — стиль сторис
- [Архитектура bot-level](./bot-architecture.md)
- [DDD принципы](../../../node_modules/dmg-core/docs/reference/domain-modeling.md)
