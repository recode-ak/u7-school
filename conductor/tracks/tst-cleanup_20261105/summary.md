# Summary: tst-cleanup_20261105

## Базовая линия

Ветка от `816908b1`, 2026-11-05. `bun test` по каталогу (в worktree нужен `bun run seed:fixtures`, иначе 2 падения фикстур peer-review).

| Модуль | `domain/src/<m>` | `modules/<m>` |
|---|---|---|
| wish | 213 | 135 |
| stream | 416 | 226 |
| questionnaire | 213 | 113 |
| peer-review | 184 | 141 |
| user | 56 | 103 |
| dossier | 14 | 0 |

Тесты бота по модулям — в Ф2 при чистке модуля.

## DeepSeek

| Фаза | Шаг (`--label`) | Модель | $ | Ходы | hitRate | Круги доработок |
|---|---|---|---|---|---|---|
| Ф1 | `T1-inv-wish` | flash | 0.185 | 80 | 97% | 0 |
| Ф1 | `T1-inv-stream-domain` | flash | 0.256 | 114 | 97% | 0 |
| Ф1 | `T1-inv-stream-app` | flash | 0.127 | 31 | 94% | 0 |
| Ф1 | `T1-inv-stream-bot` | flash | 0.243 | 114 | 97% | 0 |

| Ф2 | `T2-wish-table` | flash | 0.139 | 54 | 97% | 0 (приёмка: одна строка оставлена) |
| Ф2 | `T2-wish-apply` | flash | 0.192 | 126 | 99% | 0 |
| Ф2 | `T2-stream-domain-table` | flash | 0.149 | 47 | 96% | 0 |
| Ф2 | `T2-stream-app-table` | flash | 0.184 | 69 | 97% | 0 (приёмка: Policy-отказ UC — один кейс вместо удаления, ×6; `stream.module.map` — удалить) |
| Ф2 | `T2-stream-bot-table` | flash | 0.180 | 84 | 97% | 0 |
| Ф2 | `T2-stream-domain-apply` | flash | 0.105 | 56 | 98% | 0 |
| Ф2 | `T2-stream-app-apply` | flash | 0.173 | 118 | 99% | 0 |
| Ф2 | `T2-stream-bot-apply` | flash | 0.227 | 162 | 99% | 0 |
| Ф2 | `T2-inv-questionnaire-domain` | flash | 0.157 | 76 | 97% | 0 |
| Ф2 | `T2-inv-questionnaire-app` | flash | 0.093 | 37 | 97% | 0 |
| Ф2 | `T2-inv-questionnaire-bot` | flash | 0.154 | 60 | 97% | 0 |
| Ф2 | `T2-questionnaire-domain-table` | flash | 0.168 | 68 | 97% | 0 |
| Ф2 | `T2-questionnaire-app-table` | flash | 0.148 | 57 | 97% | 0 (приёмка: `module.test.ts:169` отложен — покрытие красное) |
| Ф2 | `T2-questionnaire-bot-table` | flash | 0.148 | 47 | 96% | 0 |
| Ф2 | `T2-questionnaire-domain-apply` | flash | 0.106 | 73 | 99% | 0 |
| Ф2 | `T2-questionnaire-bot-apply` | flash | 0.146 | 86 | 99% | 0 |
| Ф2 | `T2-questionnaire-app-apply` | flash | 0.068 | 46 | 98% | 0 |

Инвентаризация — роль `dmg-tech-lead` (только чтение, файл отчёта через bash). Три `stream` шли параллельно в одном дереве без конфликтов: код не меняют, файлы разные.

## Итог по модулям

| Модуль | Тестов до → после | Покрытие строк | `check` |
|---|---|---|---|
| wish | домен 213 → 133, модуль 135 → 104, e2e −1 | без падения | 4782 pass / 29 fail (TR-57) |
| stream | домен 416 → 263, модуль 226 → 112 (+3 перенесены из `*.uc-defs`), бот 335 → 252 | без падения (`stream.module.ts` — сборкой `platform/app`) | 4432 pass / 29 fail (TR-57) |
| questionnaire | домен 213 → 126, модуль 113 → 39 (+3 перенесены из `*.uc-defs`), бот 134 → 88 | собственные исходники без падения (в прогоне модуля падают доменные и `dmg-core` — их держат свои тесты) | 4223 pass / 29 fail (TR-57) |

Таблицы `stream` шли параллельно (три файла, только чтение): цепочки «покрыт удаляемым» между таблицами — проверены скриптом, все с конечным покрытием в домене или платформе. В `student-dmg.e2e.test.ts:412` найдена скрытая связность (праймер в удалённом соседнем тесте) — исполнитель сделал её явной.

`questionnaire`: инвентаризация сразу с Б-ID (три параллельно), таблицы — параллельно, применение — домен ‖ бот, затем модуль (доменный перенос пишет в `modules/questionnaire`). Расход шага Ф2 по модулю — $1.19 (9 запусков flash, 0 кругов доработок). Новая закономерность у бота — Н1 «файл-паспорт UI-экранов» (`inventory.test.ts` → реестр кодов).
