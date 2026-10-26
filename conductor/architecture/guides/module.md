# Module — гайд

**Назначение:** паспорт модуля — контракт `<M>ModuleDef = defineModule(...)` (`packages/domain/src/<m>/<m>.module.ts`) и реализация — карта «Def → класс» с `create<M>Module(deps)` (`packages/<m>/src/<m>.module.ts`); сборка модулей — в приложении.

---

## 1. Когда применять

- Модуль есть всегда: в паспорте — `dependsOn`, агрегаты, UC, ER, Job; всё, что не перечислено, в граф и приложение не попадает (MAN-06).
- Зависимость ещё не мигрирована — внешний модуль `defineModule({ external: true })` в её `<m>.module.ts`, экспорт — из `contract.ts` (D-37); если ей нужны UC для `calls` — карта-адаптер над legacy-фасадом в её пакете (TR-11).
- Вход для остального кода — `contract.ts` (D-45): `<M>ModuleDef`, Def UC, которые зовут снаружи, события, ошибки, VO их схем; каждый экспорт — с JSDoc «кто и зачем». Ar, Policy, DCS, ArDef и схем entity в нём нет. Эталон — [contract.ts](../../../packages/domain/src/wish/contract.ts).
- Фасад — только по потребителю ([facade.md](./facade.md), D-38): другим модулям `wish` не нужен — фасада нет.

## 2. Команда

`bun run gen module <m> [--facade] [--adopt] --write` — паспорт и тест в домене, карта и тест в пакете (для нового — `package.json`, `tsconfig.json`). Строки в `useCases`/`reactions`/`jobs` и в карте дописывают `gen uc|er|job` по маркерам `// gen:defs:*`; руками — только `dependsOn`, `label`, `description`.

## 3. Эталон

- [wish.module.ts (Def)](../../../packages/domain/src/wish/wish.module.ts): `dependsOn` — внешние `ModuleDef` из `contract.ts` зависимостей, четыре UC, четыре ER, `jobs: []`.
- [wish.module.ts (реализация)](../../../packages/wish/src/wish.module.ts): `WishDeps = ModuleDeps & { wishes }` (тип резолвера — платформа; субъект — `Identified` из `dmg-core`: UC берут у него только `uuid`), `wishMap … satisfies ModuleMap<…>`, `createWishModule(deps)` → `ModuleFromDef`.
- Внешний модуль-адаптер: [course.module.ts (Def)](../../../packages/domain/src/course/course.module.ts), [course.module.ts (карта)](../../../packages/course/src/course.module.ts) — `<M>Legacy = Pick<…>` над legacy-фасадом.
- Сборка приложения: [create-dmg-modules.ts](../../../apps/u7-bot/src/create-dmg-modules.ts) — `AppContext` (мост `legacyEventBus` с картами `inbound`, `onInvalid` → `logger.warn`, `legacyClock`, `JsonlOperationLog(<DB_DIR>/oplog)`), фасады `ModuleFacades` по `dependsOn`; подключение — `ApiApp.addDmgModules` до `init` в [create-api-app.ts](../../../apps/u7-bot/src/create-api-app.ts).
- Вызов из UI: `U7BotUiStory.executeUc(Def, input, actor)` — [u7-bot-ui-story.ts](../../../apps/u7-bot/src/core/u7-bot-ui-story.ts) (`UserCaller`, `Trace.fromRequest`).

## 4. Чеклист правил

- ARC-04, ARC-05 — `dependsOn` объектами Def, граф без циклов; импорт другого модуля домена — только из `dependsOn`.
- ARC-06 — пакет модуля не импортирует другие модульные пакеты: чужие модули — только `ModuleFacades` в `deps`.
- API-05 — карта типизирована `satisfies ModuleMap<typeof <M>ModuleDef, <M>Deps, …>`; класс без Def в карте — ошибка типа.
- MAN-01, MAN-06 — у паспорта `label`/`description`; каждый Def модуля в паспорте.
- MAN-05 — `calls` операций только из модулей `dependsOn` (`checkDefs`).

## 5. Типичные ловушки

- Legacy-модуль и DMG-модуль подписаны одновременно — двойная обработка событий; при переключении legacy убирается из `ApiApp` тем же коммитом.
- Удаление legacy до подключения DMG в приложении — сломанный `check`: сначала сборка и stories, потом удаление (TR-21).
- Резолвер из `@u7-scl/app` (`U7ModuleResolver`) → `ModuleDeps` платформы и свои репозитории; субъект `User` из `@u7-scl/app` → `Identified`.
- Лог операций тестов в `data/oplog` → временный каталог (`test-app.ts`).
- Строковое имя UC (`execute('create-course-wish', …)`) → Def; `Caller` и `Trace` строятся в одном месте UI, не в каждой story.
- `inbound` не передан в мост — DMG ER молча не получают legacy-события; тест доставки на сборке приложения ([create-api-app.test.ts](../../../apps/u7-bot/src/create-api-app.test.ts)).

## 6. Как тестировать

Домен — `normalize(<M>ModuleDef)` (состав паспорта) и `checkDefs(indexDefs([…]))` без нарушений ([wish.module.test.ts](../../../packages/domain/src/wish/wish.module.test.ts)). Пакет — модуль на настоящем репозитории во временном каталоге, фасады — `StubFacade` по Def, вызов через `handle` ([wish.module.test.ts](../../../packages/wish/src/wish.module.test.ts)). Приложение — доставка legacy-событий до ER на сборке `createApiApp` во временном `DB_DIR`.
