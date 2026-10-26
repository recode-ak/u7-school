---
name: architecture
description: ЗАГРУЖАТЬ ПЕРВЫМ при создании или редактировании ЛЮБЫХ методов, классов, объектов, модулей или слоёв. Определяет режим (legacy, UI, DMG), где размещать логику, как называть файлы и объекты, какие правила (ID из rules.md) проверить. Вход в conductor/architecture/ и документацию dmg-core.
---

# Архитектура u7-school: как работать с кодом

Документация платформы DMG — пакет `dmg-core` (`platform/dmg-core/docs/`, вход — `index.md`). Проектные документы — `conductor/architecture/` (вход — `index.md`): переход, legacy, UI, процесс агентов, решения проекта. Скилл — маршрутизатор: не дублирует документы, а говорит, что прочитать.

## 1. Определи режим

| Ситуация | Режим | Читай |
|---|---|---|
| Модуль ещё не в `@u7-scl/domain` (старая структура `modules/<m>/src/{domain,api,infra}`) | **legacy** | `conductor/architecture/legacy.md` — правь по образцу соседнего кода модуля |
| Модуль уже мигрирован или создаётся новый | **DMG** | скил `dmg-architecture`, затем §2 ниже |
| Telegram-бот (stories, controllers) | **UI** | `conductor/architecture/ui/bot-architecture.md`, `ui/bot-ui-story.md`, `ui/bot-controller.md`, `ui/bot-test.md` |

Сомневаешься в режиме — проверь, есть ли модуль в `domain/src/`.

## 2. DMG в этом проекте

Скил `dmg-architecture` ведёт по документации пакета; здесь — привязка к монорепо:

- Раскладка: домен — `domain/src/<m>` (`@u7-scl/domain/<m>`, контракт — `@u7-scl/domain/<m>/contract`), прикладной слой — `modules/<m>/src`, приложение — `@u7-scl/app`, входные адаптеры — `runners/*` (вызов операций — `appApi`). Как правила ложатся на пакеты — `conductor/architecture/rules.md`.
- Генератор — `bun run gen …` = `dmg-core gen …` пакета (`naming.md` §5 пакета); раскладка проекта — `conductor/architecture/naming.md`.
- Образцы: учебный модуль пакета (гайды `platform/dmg-core/docs/guides/`) и эталон проекта — модуль `wish` (внешние модули над legacy, мосты, межмодульный побочный эффект).
- Модуль зависит от немигрированного — внешний модуль `external: true` и мост `platform/core/src/legacy-bridge` (`legacy.md` §6).

## 3. Проверь перед завершением

- Применимые ID из `platform/dmg-core/docs/rules.md`.
- `bun run check` (включает `arch:check`, `agents:check`, `extract:check`) — зелёный. TDD.

## 4. Стоп-сигналы

Остановись и спроси Нурболата, если:
- правило противоречит задаче или другому правилу;
- нужно изменить чужой модуль или контракт, от которого зависят другие;
- нужно нарушить `dependsOn` (новая связь модулей) — это решение уровня `decisions.md`;
- вызов фасада меняет чужой модуль — место выбирает Нурболат по каждому случаю (D-41, `conductor/architecture/decisions.md`);
- нужно любое действие с `data/`.
