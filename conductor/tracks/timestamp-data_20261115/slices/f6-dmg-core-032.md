# Бриф Ф6: u7-school на dmg-core v0.3.2 (ФР-1, ФР-5: legacy-тесты)

Трек — [spec.md](../spec.md), [plan.md](../plan.md) Ф6. Бриф — оркестратор.

## Границы

- Шаг 1 (`dmg-test-designer`, до смены версии): тесты, которые сейчас проверяют чтение ISO (legacy), → «ISO отвергается» (инверсия, TST-08): `domain/**/*.state.test.ts`, `modules/**/*.json-repo.test.ts`, `platform/app/src/u7-caller-resolver.test.ts:21`, а также найденные в Ф5: `platform/app/tests/u7-app.test.ts:332,339,350,396`, `scripts/update-stream-snapshot.test.ts:20`, `runners/u7-bot/tests/courses/wish-legacy-records.integration.test.ts:26-27`. Где ISO в тесте — не цель сценария, а просто вход, — перевести на числа (сценарий сохранить). Негативный тест чтения ISO — по одному на каждый из 11 state (если в файле агрегата его нет; не дублировать — один на state). `DataDirAudit`: тест «ловит ISO-строку в дате» (`platform/app/src/infra/data-dir-audit.test.ts`). Запуск на v0.3.1 — новые негативные падают по делу.
- Шаг 2 (`migrator`): `#v0.3.1` → `#v0.3.2` во всех 13 `package.json` (корень, `platform/{core,app}`, `domain`, `modules/*`, `runners/u7-bot`), `bun install`, `bun run dmg:sync`, `bun run agents:sync` (если есть). Комментарии про legacy ISO в state-файлах, json-repo, `campaign-fields.ts:35`, `worlds/types.ts` — убрать/переписать. Ветки «нет `updatedAt`/`version`» в репозиториях остаются. Прод-код по поведению не меняется (кроме того, что схемы платформы стали строгими).
- Не трогать: `scripts/migrate-timestamps*` (ISO — его вход), `data/`.

## Критерии приёмки

1. Одна версия `dmg-core#v0.3.2` во всех `package.json`, `bun.lock` обновлён.
2. `CI=true bun run check`, `bun run arch:check` зелёные; тестов ≥ 3571 (минус обоснованно удалённые — списком).
3. `grep -rn "legacy ISO" --include=*.ts . | grep -v node_modules` пуст.
4. Тест «`DataDirAudit` ловит ISO» есть и зелёный.

## Правила

`dmg-core`: TST-05, TST-08, TST-09 (не проверять разбор платформы в каждом модуле сверх одного сценария на state), DOM-12. Проект: TST-06.

## Открытые вопросы

—

## Отчёты

### Ф6 шаг 1 — dmg-test-designer

29 файлов. Негатив «ISO отвергается» — по одному на каждый из 11 state; `DataDirAudit` «ISO-строка в дате — ошибка записи»; в json-repo — один сквозной (`stream.json-repo.test.ts`: ValiError, файл не изменён). Дубли внутри среза почищены: 10 json-repo ISO-тестов и 2 сценария course («боевые даты», «ISO с секундами») удалены (TST-08/09). Legacy-входы (`u7-app.test.ts`, `u7-caller-resolver.test.ts`, `update-stream-snapshot.test.ts`, `wish-legacy-records.integration.test.ts`, фабрики state/json-repo) — на числах, сценарии «нет `updatedAt`/`version`» сохранены. Red на v0.3.1: 13, все «ISO отвергается».

### Ф6 шаг 2 — migrator

`#v0.3.2` во всех `package.json`, `bun.lock` → `4df6cbc`; `dmg:sync`/`agents:sync` — 9 файлов (строка версии). Ловушка `bun install` «failed to resolve» (K-20261114-w39q) — лечится `git -C ~/.bun/install/cache/<hash>.git fetch … 'refs/tags/*:refs/tags/*'`; **учесть на проде**. Комментарии про legacy ISO в state/json-repo/`campaign-fields.ts` переписаны.

### Ф6 шаг 3 — dmg-reviewer

Error нет. Minor CODE-04 — в шапках 6 state осталось «ISO-даты → число» → исправлено оркестратором. Склейка строк в JSDoc — косметика, оставлено.

Итог: `CI=true bun run check` — 3575 pass / 0 fail, `arch:check` чисто, `grep "legacy ISO"` пуст.
