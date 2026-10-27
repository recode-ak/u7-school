# Бриф среза: Фаза 1 — корень сборки и учебное приложение

Читай до старта: `../spec.md`, `../plan.md` (Фаза 1), решение **D-50** в `platform/dmg-core/docs/decisions.md` (и D-43, D-49), `platform/dmg-core/docs/layers.md` §5–6, `docs/transport.md` §4 (`apiApp.dispatch`).

Срез идёт шагами; агент получает путь к брифу и номер шага, делает только его. TDD: тест → запуск (red) → реализация → запуск (green), по шагам.

## Шаг 1 — `ApiApp` в `dmg-core/app` (api-author, платформа)

**Границы:** `platform/dmg-core/src/app/**` (новый каталог `src/app/api-app/`), экспорт в `src/app/index.ts`. Остальное не трогать; `conductor/`, `data/` — нельзя. Документацию пакета не править (отдельная задача).

**Что сделать.** Класс `ApiApp<U extends Identified>` — сборка модулей приложения и in-proc клиент (D-50, D-49):
- Вход: `AppContext` и список фабрик модулей. Фабрика — Def модуля + функция `ModuleDeps → ModuleFromDef` (замыкание на репозитории приложения). Форму типа фабрики выбери сам (простые типы, без type-level трюков), обоснуй в отчёте.
- Сборка в конструкторе (или статическом `create` — на твоё усмотрение): упорядочить по `def.dependsOn`, каждому модулю — `ModuleFacades` из `ModuleFacade` **только его** зависимостей (у модуля без зависимостей — пустой `ModuleFacades`). Ошибки сборки — исключение (`Error`, как `assertUniqueNames` в `module-from-def.ts`): цикл в `dependsOn`, зависимость без фабрики, повтор модуля (одно имя дважды). Внешний модуль (D-37, `external`) — обычная фабрика.
- `dispatch(moduleDef, command, caller, trace)` — типизированный `Result` (как `ModuleFromDef.dispatch`; команда UC чужого модуля — ошибка компиляции). Модуль не подключён → `Err` `CoreErrors.OPERATION_NOT_FOUND` `{ module, uc }`. Образец сигнатуры — legacy-потребитель `runners/u7-bot/src/core/u7-bot-ui-story.ts` (`dispatchUc`), только читать.
- `runJob(moduleDef, jobDef, trace)` и `subscribe()` — подписка реакций всех модулей, возвращает общую отписку.

**Тесты** (`src/app/api-app/api-app.test.ts`, образец модулей — учебные `todo` (зависит от `users`) и `users` в `src/testing/example/app`, двойники — `dmg-core/testing`):
- фабрики в любом порядке → модуль с зависимостью собирается после неё; UC `todo`, вызывающий `users` через фасад, работает;
- модуль без зависимостей получает пустые фасады (вызов чужого UC — ошибка «нет фасада»);
- цикл, отсутствующая зависимость, повтор — исключение сборки с понятным текстом;
- `dispatch` в неподключённый модуль → `OPERATION_NOT_FOUND`;
- `subscribe()` — событие `users` доходит до реакции `todo`; отписка снимает все;
- `runJob` вызывает Job модуля.

**Правила:** API-01, API-05, ERR-01 (ошибка сборки — исключение, а не `Result`), CODE-* (ООП: класс с ответственностью, без россыпи функций), TST-*. Новых зависимостей нет.

**Приёмка:** `bun run scripts/agent-gate.ts` зелёный; в пакете `cd platform/dmg-core && bun run check` зелёный.

## Отчёты

### Шаг 1 — отчёт автора (api-author, Opus)

- `src/app/api-app/api-app.ts` — `ApiApp<U>`: сборка в конструкторе, порядок — обход в глубину по `dependsOn`, граф по имени Def; затем Def сверяются по ссылке (Def из `dependsOn` и Def модуля, который вернула фабрика, — тот же объект, что у фабрики), иначе `ModuleFacade.serves` не узнал бы свои UC. Ошибки сборки — `Error`: повтор, зависимость без фабрики, цикл, фабрика вернула другой Def / другой объект Def с тем же именем.
- `api-app.types.ts` — `ModuleFactory<U> = { def: AnyModuleDef; create(deps: ModuleDeps) → AnyModuleFromDef<U> }`: простой тип, держит разные модули в одном списке, замыкает репозитории приложения.
- `dispatch` → `OPERATION_NOT_FOUND` для неподключённого модуля; `runJob` неподключённого модуля — исключение (ошибка конфигурации в рантайме, ERR-01, как `ModuleFromDef.runJob`); `subscribe()` — общая отписка.
- Тесты: 14 на учебных `users`/`todo` (`TaskJsonRepo` во временном каталоге), локальная `AwaitingBus` вместо таймеров.

### Шаг 1 — отчёт ревьюера

| ID | файл:строка | суть | severity |
|---|---|---|---|
| — | `api-app.ts:102-114` | связь по имени: другой объект Def с тем же именем ловился только в рантайме | info → исправлено (сверка по ссылке) |
| ERR-01 | `api-app.ts:75-91` | JSDoc `runJob`: «исключение сборки» вместо ошибки конфигурации в рантайме | info → исправлено |
| CODE-01 | `api-app.test.ts:181` | имя `viaTodo` вводит в заблуждение | info → исправлено (`adminPurge`) |
| TST-04 | `api-app.test.ts:75-92` | `AwaitingBus` — в тесте; перенести в `dmg-core/testing`, если понадобится дальше | info → оставлено (решение Нурболата) |
