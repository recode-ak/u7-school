# Правки платформы по архитектурному ревью (20.10)

**Назначение:** что изменилось в `dmg-core`, мостах и учёте долга после ревью треков 20.10 (`core-dmg`, `dmg-core-extract` Ф1–3, `generators`, `domain-package`) — до старта Фазы 1 `golden-wish`. Эталон `wish` пишется уже на этом API.

---

## 1. Что изменилось для эталона

| Тема | Было | Стало | Решение |
|---|---|---|---|
| Импорт платформы | всё из `dmg-core` | корень — ядро и `define*` (домен); `dmg-core/app` — UC/ER/Job, модуль, UoW, шина; `/graph`, `/arch` | D-33, ARC-02, ARC-11 |
| Время | глобальный `now()`, `setNow/resetNow` | домен получает `at` аргументом (`create(input, at)`, `complete(at)`); UC/ER/Job — `this.now()`; тесты — `testAppContext({ at })` | D-34 |
| Жизненный цикл | статусы проверялись в методах Ar | переход в Def: `from`, `to`, `rejects`; метод Ar — `this.transition('<op>', at, apply)`; `change` статус не меняет | D-35, MAN-12 |
| Версия | нет | `version` в `BaseEntityFields` (без поля — 0), `newEntity(uuid, at)`; репозиторий — `assertVersion` + `createLock`; UoW → `VERSION_CONFLICT` | D-36 |
| Выход UC | проверялся после фиксации | проверяется до `commit`: невалидный ответ ничего не сохраняет | errors-result.md §3 |
| Зависимости-legacy | событий и `ModuleDef` нет | `defineModule({ external: true })` в `contract.ts`; legacy-события — карта `inbound` в `legacyEventBus` | D-37 |
| Долг | `D-<n>` в архиве, allowlist | `DEBT-<n>` в [debt.md](../../architecture/debt.md), сверка маркер ↔ запись | — |

Образец формы — учебный модуль `packages/dmg-core/src/testing/example/` (`task.ar.ts`, `task.json-repo.ts`); шаблоны `bun run gen` обновлены.

## 2. Решения по пунктам ревью

1. **Входящие legacy-события и `dependsOn`** — платформа готова (D-37); Def событий `stream`/`questionnaire` и внешние `ModuleDef` зависимостей — задача Фазы 0 [plan.md](./plan.md).
2. **Невалидный выход UC** — отказ `OUTPUT_VALIDATION` до фиксации, а не частичный ответ с `warn`: операция без следов, клиент может повторить; непроверенный ответ ломает клиента и может раскрыть лишние поля.
3. **Переходы** — `transition()` и `rejects` (D-35).
4. **Подпути пакета** — D-33; UI-манифесты (D-26) — отдельным пакетом.
5. **Версия агрегата** — D-36. Откат уже записанных агрегатов UoW по-прежнему не делает (D-15).
6. **Часы** — сделано сразу (D-34): после эталона перевод стоил бы дороже.
7. **Реестр долга** — вынесен из архива в `conductor/architecture/debt.md`.
8. **ID долга** — `DEBT-<n>` (не путаются с решениями `D-NN`); в архиве `domain-package` старые `D-<n>` = `DEBT-<n>`.
9. **Allowlist** — удалён как дубль: `arch:check` сверяет маркеры в `packages/*/src` и `scripts/` с `debt.md` в обе стороны.
10. **Ручной граф `DOMAIN_GRAPH`** — учтён как DEBT-31 (гасится в Ф12 вместе с `WishModuleDef`); комментарий `ARCH_APPS` актуализирован.
11. **Мелочи.** Осиротевший JSDoc в `use-case-from-def.ts` удалён. Порядок проверок оставлен: сначала право вызова (`callers`) — до чтения данных; контекстная Policy — после `load` (ей нужны агрегаты); «не найдено» раньше `ACCESS_DENIED` допустимо при UUID — errors-result.md §3.

## 3. Коммиты

`c5793a8c` долг · `6fe43246` подпути · `b8b35b86` выход UC · `1b72fdd7` часы · `8f0b07c5` переходы · `4dc4e488` версия · коммит с этим файлом — внешние модули и мост.

## 4. Что учесть в треке

- Входной долг: гасится DEBT-21, DEBT-22, DEBT-24 и DEBT-31; новые — с DEBT-32.
- Гайды пишутся на новом API (время аргументом, `transition`, `version`, подпути).
- Данные `data/wish/` записаны без `version` — читаются как 0, миграция не нужна.
