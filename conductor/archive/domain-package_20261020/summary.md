# Итог трека domain-package

## Результат
Domain-слои семи модулей перенесены в `@u7-scl/domain` без изменения поведения: `user` (+ `User` из `app`), `course`, `questionnaire`, `stream`, `wish`, `peer-review`, `dossier`. Старые пути `@u7-scl/<m>/domain` и корень `@u7-scl/dossier` — barrel-реэкспорты с `// DEBT(D-<n>)`.

## Гейт закрытия
- `CI=true bun test`: **3211 pass, 0 fail** (343 файла); число совпадает со значением до переноса `dossier` — тесты не потеряны.
- `bun run check` зелёный, `bun run arch:check`: нарушений нет (example 0, domain 0).

## Реестр долга и владельцы (D-1…D-30, подробности — debt.md, ID `D-<n>` = `DEBT-<n>`)
| Владелец | Долги |
|---|---|
| `golden-wish` | D-21, D-22, D-23, D-24 (wish); D-1, D-2 (общие `core`) |
| треки перевода модулей на Def | user D-5; course D-9, D-10; questionnaire D-14, D-15; stream D-19, D-20; peer-review D-28, D-29 |
| `dmg-core-extract` Ф4 | импорты `core`/`app` в домене: D-1, D-2, D-6, D-7, D-11, D-12, D-16, D-17, D-21, D-22, D-25, D-26 |
| последний трек миграции | barrel-долги D-3, D-8, D-13, D-18, D-23, D-27, D-30; `User` в `app` D-4 |

Сверка маркер ↔ allowlist ↔ debt.md — `arch:check`. Состояние и входной долг для следующих треков — `conductor/architecture/migration.md` §6.

## Остаточные замечания
- ARC-06 warnings в `api` на `@u7-scl/{user,course,questionnaire,stream}/domain` — снимаются с barrel-долгами.
- Правила `biome.json` для `packages/dossier/**` удалить вместе с D-30.
