# Summary: temp-comments-check_20261103

## Итог

- **ФР-1–7.** `DebtRegistry.checkTempMarkers` (`scripts/domain-check.ts`), вызов из `check`; `scripts/arch-check.ts` не менялся (84433eed).
- Маркеры: «Временное решение», «Уходит с миграцией» — без учёта регистра; «ВРЕМЕННЫЙ» — только заглавными. Допустимы лишь в Месте открытой записи; «слит в» маркер не оправдывает.
- Правило описано в `conductor/architecture/debt.md` («Правила»); `rules.md` и `migration.md` маркеров не упоминают — не менялись.
- Кандидат снят из `conductor/tracks.md`, `conductor/roadmap/temp-comments-check.md` удалён.
- Данные `data/` не трогались.

## Базовая линия и гейт (2026-11-03)

| Когда | `bun run check` | `bun run arch:check` |
|---|---|---|
| До правок | 3558 pass, 0 fail | 0 нарушений |
| После Ф2 | 3568 pass, 0 fail (366 файлов) | 0 нарушений |

- Прирост: +10 тестов (`describe` проверки маркеров). Новых нарушений в реальном коде нет.

## Долг

- Новых записей в `debt.md` нет.
