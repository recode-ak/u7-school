# Доработка по ревью (tt-F2-apply)

Тот же пакет и те же ограничения: правишь только `*.test.ts` в `src/` пакета, типы не ослаблять, не коммитить.

1. **Устаревшие имена `it`.** Проверка типа из этих `it` ушла, осталась рантайм-проверка. Переименуй по тому, что `it` проверяет теперь:
   - `src/domain/contracts/event-reaction-def.test.ts:54` «calls — те же UC, литеральный тип»
   - `src/domain/contracts/operation-def.test.ts:82` «calls объявлены — те же Def по ссылке, литеральный тип»
   - `src/domain/events/event-def.test.ts:25` «make() — событие с типизированным payload»
   - `src/kernel/fields/fields.test.ts:89` «тип — number | undefined, описание из метки»
2. **`src/domain/policy/policy.test.ts:113` и `:122`** (имена с «(тип)») — сравни рантайм-проверку `allOf` с `src/domain/policy/rule.test.ts`. Тот же сценарий там уже есть — удали `it` целиком (TST-08) и укажи в отчёте, где покрыто (файл:строка `it`). Нет — переименуй без «(тип)».
3. **`src/domain/contracts/def-types.test.ts`** — остался один `it` «сравнение по ссылке». Сравни с `src/domain/contracts/use-case-def.test.ts` («конкретный Def совместим с AnyUseCaseDef; сравнение по ссылке»). Дубль — удали файл целиком и укажи, где покрыто. Не дубль — перенеси `it` в `use-case-def.test.ts` и удали файл (один сценарий — один файл).

Готово: `cd ~/dev/tools/dmg/dmg-core && bun run check` — зелёный; `git diff --name-only` — только `*.test.ts`. Отчёт: что сделано по каждому пункту, где покрыто, число тестов.
