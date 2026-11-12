# Технологический стек

## Основное
- **Язык:** TypeScript
- **Среда выполнения и менеджер пакетов:** Bun

## Фреймворки и библиотеки
- **Платформа DMG:** пакет `dmg-core` — отдельный репо `~/dev/tools/dmg/dmg-core`, подключён как `file:` (с релиза — `git+ssh` по тегу, D-61); весь код — на нём; `@u7-scl/core` — только `ui` и `shared`, кандидат на удаление при `dmg-ui`
- **Web API / Бэкенд:** Elysia
- **Telegram Bot:** Grammy
- **Telegram Conversations:** @grammyjs/conversations
- **Валидация данных:** Valibot
- **Интеграция ИИ:** Google GenAI / Gemini
- **Линтинг и форматирование:** Biome; архитектурные правила — `noRestrictedImports` и GritQL-плагины пакета `dmg-core` (`node_modules/dmg-core/biome-plugins/*.grit`)

## Агентная инфраструктура
- **Среды:** Claude Code (основная), pi (внешний исполнитель) — процесс в `conductor/architecture/agents.md`
- **Роли агентов:** единый источник `.agents-core/roles/`, генератор копий `scripts/agents-sync.ts` (`bun run agents:sync`)
- **Гейт после субагента:** `scripts/agent-gate.ts` — хук `SubagentStop` в Claude Code, расширение `.pi/extensions/subagent/` в pi
- Без новых зависимостей: скрипты на Bun, расширение pi использует пакеты из поставки pi
