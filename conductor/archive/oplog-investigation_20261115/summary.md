# Итог трека F-111 (в работе)

## Базовая линия (Ф0, 2026-11-15)

| Репо | Команда | Итог |
|---|---|---|
| dmg-core (`72bdf0a`) | `bun run check` | 1504 pass, 0 fail, 137 файлов; lint, tslint, docs:covers, docs:jsdoc — зелёные |
| dmg-core | `bun run e2e` | ok |
| u7-school (`d00cfad6`) | `CI=true bun run check` | 3420 pass, 0 fail, 324 файла |
| u7-school | `bun run test:bot` | 1232 pass, 0 fail, 111 файлов |

**Объём лога фикстур:** `data/fixtures/oplog/2026-11-13.jsonl` — 93 226 байт (единственный файл) — точка сравнения для Ф1.

## Ф1 (2026-11-15)

dmg-core `f509cbf`: `bun run check` — 1602 pass, 0 fail, 140 файлов; e2e ok; `package.json` без изменений.
Замер `FieldDiff.between` на дереве ~550 КБ JSON: 0,53–0,73 мс; дайджест крупного значения — 2,6 мс. Порог размера сравнения не вводился.

## Ф2 (2026-11-15)

dmg-core `c456e8d`: check — 1640 pass, 0 fail; e2e ok. `dmg-core oplog <dir> --request <id>` на фикстуре legacy — цепочка из 5 записей по `at`.

## Ф3 (2026-11-15)

Документы dmg-core: D-86 в `docs/decisions.md` (D-73 «патч не входит» снят), `docs/reference/oplog.md`, правки concepts (aggregate-lifecycle, caller, uc-path), guides (aggregate, app, state, use-case), `reference/testing.md`, `llms.txt`, `docs/index.md`. Аудит `documentarian` — 4 неточности и 2 пробела исправлены (в т. ч. CLI: нет каталога — код 2, тест). Отдельного CHANGELOG в пакете нет — история в коммитах и D-86.
Номер решения — D-86 (D-85 занят в общей нумерации).
Релиз: `dmg-core` **v0.3.0** = `962046a`; check 1641 pass / 0 fail, e2e ok, `docs:covers --strict` чисто; установка из git в пустой каталог + `init --profile single` + `check` — 25 pass.

## Ф4 (2026-11-15)

u7-school на `dmg-core` v0.3.0 (`119f3e6c`); разметка ПД, `VisitorId`, `retainDays: 90`, `bun run oplog`, документы (`08343f47`).

**Гейт закрытия:** `CI=true bun test` — 3477 pass, 0 fail, 332 файла (базовая линия 3420); `CI=true bun run check` — зелёный; `bun run test:bot` — 1244 pass, 0 fail (базовая линия 1232). Красных нет — промежуточных состояний и регрессов нет.
`DB_DIR=./data/fixtures bun run oplog --request <id>` — лента. Свежий лог прогона u7-app (`u7-app.oplog.test.ts`) — без имён, ника, Telegram ID, текста отзыва, ключа зачисления, ответов анкеты.
Новый долг: C-DEBT-57 (глобальная установка ключа `VisitorId`).
Кандидатов в треки нет (заготовка `roadmap/oplog-state-patch.md` удалена).

## Открытые вопросы Нурболату

- DOM-17: публичные `Aggregate.baseline`/`current` в пакете (живые ссылки на state для UoW) — оставить с lint-правилом «только `app/uow`» или скрыть иначе?
