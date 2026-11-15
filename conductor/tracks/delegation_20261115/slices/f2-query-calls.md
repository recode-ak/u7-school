# Срез Ф2: «query не вызывает command» (ФР-5)

**Репо:** `~/dev/tools/dmg/dmg-core`. Решение — D-89 (черновик, пункт «Правило „query вызывает только query“»).

## Границы

| Файл | Что |
|---|---|
| `src/arch/def-checker.ts` | новая приватная проверка по образцу `checkCalls`: у UC с `type: 'query'` каждый UC в `calls` — `query`; иначе нарушение `MAN-14` с именами обоих UC. Подключить в список проверок рядом с `checkCalls` |
| `src/arch/violation.ts` | `'MAN-14'` в union ID |
| `src/arch/def-checker.test.ts` | red: query с command в `calls` — нарушение `MAN-14`; query с query — нет; command с command — нет (MAN-14 его не касается) |
| `docs/reference/rules.md` | строка `MAN-14` после `MAN-13`: «query UC вызывает только query UC (`calls`): иначе запись идёт мимо признака „только чтение“ заместителя (D-89)», проверка — `test`; MAN-05 — дописать «query — только query (MAN-14)» |
| `src/arch/rules-catalog` / тест каталога | если есть тест соответствия `rules.md` ↔ `violation.ts` — пройти его |

## Критерии приёмки

- `grep -n "MAN-14" docs/reference/rules.md src/arch/violation.ts src/arch/def-checker.test.ts` — во всех трёх.
- `bun run check` зелёный.

## Правила

MAN-05, D-42, D-43, TST-09 (тест — по логике проверки, не состав).

## Отчёты
