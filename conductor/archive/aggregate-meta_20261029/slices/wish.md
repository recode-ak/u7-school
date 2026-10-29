# Бриф среза: `cancelWish` с ожидаемой версией (D-57)

Читай до старта: `../spec.md`, `../plan.md` (Фаза 3), D-57 в `node_modules/dmg-core/docs/decisions.md`, гайд `node_modules/dmg-core/docs/guides/use-case.md` (раздел об ожидаемой версии). Образец — учебный модуль пакета: Def `node_modules/dmg-core/src/testing/example/todo/task/uc/complete-task.uc.ts`, UC и тест — `node_modules/dmg-core/src/testing/example/app/todo/task/uc/complete-task.uc{,.test}.ts`.

## Границы

- Домен: `domain/src/wish/wish/uc/cancel-wish.uc.ts` и его тест.
- Прикладной слой: `modules/wish/src/wish/uc/cancel-wish.uc.ts` и его тест.
- Не трогать: `data/`, `node_modules/dmg-core`, другие UC и модули, `WishTargetVo` (его используют другие UC), бот (передача версии в кнопках — за рамками трека).

## Решения брифа

- **Вход остаётся плоским (TR-31):** цель желания + необязательное `expectedVersion: F.expectedVersion('желания')`. Варианты союза по `kind` расширяются полем: `v.variant('kind', [v.object({ ...WishCourseTargetVo.entries, expectedVersion }), v.object({ ...WishModuleTargetVo.entries, expectedVersion })])` с `v.description` на союзе. Вызывающие (бот: только цель) не меняются. `WishTargetVo` не трогаем.
- **Порядок:** сверка версии — в `execute` до `wish.cancel(...)`, как в образце (`this.expectVersion(wish, expectedVersion)`). Отказы Policy и правила `cancellable` идут раньше (их порядок платформы не меняем).
- В `load` поиск по цели: вход — надмножество цели; `isSameTarget` и `WishAr.notFoundFor` берут только поля цели. Если тип не сходится — выдели цель из входа явно, без приведения типов.
- `errors` Def не меняется: `VERSION_CONFLICT` — ошибка платформы (как в образце).

## Шаг 1 — domain-author

- Def `CancelWishUcDef.input` по решению выше.
- Тест Def (TDD: сначала тест, запуск — red): вход с `expectedVersion` (курс и модуль) принимается; без него — принимается; отрицательное и дробное — отказ; прежние случаи остаются.

## Шаг 2 — api-author

- UC `CancelWishUc.execute`: сверка `expectedVersion` до отмены (образец `CompleteTaskUc`).
- Тесты (TDD: сначала тесты, запуск — red): совпала (версия 0 из `seed`) — отменено; расходится — `VERSION_CONFLICT` (payload `{ aggregate: 'wish', uuid }`), статус не изменился; не прислана — покрыто существующими случаями. Существующие тесты не меняй.

## Критерии приёмки

- `bun run scripts/agent-gate.ts` зелёный; `bun run check` зелёный.
- Формат state, `view()` и записей не изменился.
- Применимые ID: DOM-11 (описание поля из метки), ERR-02, UC-правила гайда `use-case`.

## Отчёты

### Шаг 1 — domain-author (Sonnet)

Готово. `cancel-wish.uc.ts`: `input` — союз по `kind` с `expectedVersion` (`F.expectedVersion('желания')`) в каждом варианте; `WishTargetVo` и `errors` не тронуты. Тест Def: поле необязательное (0, 3, без поля — для курса и модуля), отрицательное и дробное — отказ; разобранный вход сохраняет поле. Red 4/2 → green 6/0. Гейт (оркестратор) — зелёный.

### Шаг 2 — api-author (Sonnet)

Готово. `CancelWishUc.execute`: `this.expectVersion(wish, expectedVersion)` до `wish.cancel` (образец `CompleteTaskUc`). Тесты: совпала (0) — отменено; расходится (1) — `VERSION_CONFLICT` `{ aggregate: 'wish', uuid }`, статус `expressed`; не прислана — существующие случаи. Red 13/1 → green 14/0. Гейт (оркестратор) — зелёный; `check` — 3308 pass, 0 fail.

### Ревью — reviewer (Sonnet)

error и warning нет. Проверены DOM-11, ERR-02, порядок проверок гайда `use-case` (D-57), границы брифа. info: (1) в `load` вход целиком (с `expectedVersion`) уходит в поиск — поиск сравнивает только поля цели, оставлено; (2) хелпер `seededUuid` в тесте возвращает `''` при пустом файле — ложно-зелёного исхода нет, оставлено.
