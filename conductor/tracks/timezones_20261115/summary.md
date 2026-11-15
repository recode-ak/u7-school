# Итог трека `timezones`

Зона — свойство школы (IANA), время показывается с подписью смещения; решение — D-90 (`conductor/architecture/decisions.md`), экраны зоны для `dmg-ui` — `conductor/roadmap/dmg-ui-entry.md` §14.

## Что сделано

- **Ф1 (`14c1fc2`):** `TimeZoneVo` в общем домене `domain/src/shared/` (первый общий VO; `scripts/domain-check.ts` научен: `shared` — не модуль, импорт напрямую, сам модули не импортирует); `UserState.timeZone` (optional); `School.timeZone = 'Asia/Oral'`; `LocalZone` (`platform/app/src/zone/`).
- **Ф2 (`305e57d`):** `U7BotUiStory.zone/formatDate/formatTime`; старт потока, дата записи, даты отзывов, мастер потока (подсказка, разбор, превью) — в зоне школы; `ProjectZone` и `BotUiStory.formatDate/formatTime` удалены; `C-DEBT-43` закрыт.
- **Ф3:** D-90, правило 9 в `ui/bot-ui-story.md`, `ui/bot-architecture.md` §2.4, `dmg-ui-entry.md` §14, раскладка в `architecture/index.md`, CHANGELOG, ссылка в `roadmap/schools-system.md`.

## Ловушки и неочевидное

- `Intl` в Bun принимает `+05:00` как `timeZone` — поэтому `TimeZoneVo` требует латинскую первую букву.
- `v.check` не переводится в JSON Schema (MAN-03) — проверку `Intl` ставим после `transform` (по образцу `trimmed`).
- `resolvedOptions().timeZone` в Bun сводит только регистр, псевдонимы (`Asia/Calcutta`) остаются.
- `\(` внутри шаблона `md` — неэкранированная скобка MarkdownV2; нужно `\\(`. Юнит-тесты экрана без `assertDialogResponseMarkdownSafe` это не ловят — падали только e2e.
- Удаление класса из Места записи `C-DEBT-<n>` ломает `arch:check` (устаревшее место) — запись закрывается в том же коммите.
- `data-dir-audit.test.ts` брал фикстуры от cwd — гейт агента (запуск из пакета) краснел на любой правке `platform/app`; путь теперь от `import.meta.dir`.

## Гейт качества

| Точка | `check` | `CI=true bun test` |
|---|---|---|
| Базовая линия (`9abbc8f`) | зелёный | 3511 pass / 0 fail, 335 файлов |
| После Ф1 (`14c1fc2`) | зелёный | 3571 / 0 |
| После Ф2 (`305e57d`) | зелёный | 3545 / 0 |
| Финал | зелёный | 3545 / 0, 336 файлов |

Триаж: красных нет; промежуточных состояний нет. Тестов больше базы (+34). Удалены: `project-zone.test.ts` (сценарии — в `local-zone.test.ts`, таблица переноса — в брифе Ф1), сценарий `bot-ui-story.test.ts:463` (→ `u7-bot-ui-story.test.ts`), дубли срезов: −4 (Ф1), −3 (Ф2).

## Долг

Новых записей нет; `C-DEBT-43` закрыт. `tests.md` — без новых записей (дубли почищены в срезах).
