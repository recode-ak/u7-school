# Plan: generators_20261020

Каждая задача — TDD (сначала падающий тест), `bun run check` зелёный после каждой. Предшествует `dmg-core-extract` Фазы 1–3 (выполнены). Шаблоны пишутся на финальные `dmg-core` и `#core/*`.

## Фаза 1: Каркас `gen` и пакет `packages/domain`

- [x] Task: Минимальный пакет `packages/domain` (`@u7-scl/domain`: package.json, tsconfig, biome, пустой `src/index.ts`, подпути `<m>` и `<m>/state`), подключение к корневым конфигам и `check` e9dfc033
    - [x] Тест: пакет собирается, `tslint` и `arch:check` зелёные
    - [x] Отметить в spec/plan `domain-package`: пакет-каркас уже создан (трека пока нет — пометка в `migration.md`, строка 3)
- [x] Task: Ядро `scripts/gen/`: разбор CLI (`gen <kind> <m>[.<agg>] <name>`, `--dry-run` по умолчанию, `--write`, `--domain-root`, `--packages-root`), модель «план файлов» 0cb8c489
    - [x] Тесты: разбор аргументов, kebab → PascalCase/Def/FQN по таблице `naming.md` §4
- [x] Task: Валидация ввода (kebab, существование модуля/агрегата, уникальность имён и FQN) с понятными ошибками на русском 0d3b80fc
- [x] Task: Атомарная запись: сначала план, коллизия → ошибка без единой записи; никаких перезаписей f65761b9
- [x] Task: Правки по маркерам `// gen:exports` и `// gen:defs`; нет маркера → печать строки для ручной вставки f65761b9
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: Генераторы домена

- [x] Task: `gen module <m>` (домен: `<m>.module.ts`, `<m>.facade.ts`, `index.ts` с маркерами) + заготовка теста b3ee4f4b
- [x] Task: `gen aggregate <m>.<agg>` (`state`, `ar`, `policy`, `events`, `errors`) + заготовки тестов 0446d689
- [x] Task: `gen dcs` и `gen dqs` (`<topic>.dcs.ts` / `.dqs.ts`) + заготовки тестов 67ff3a0e
- [x] Task: Тест на снапшотах: пути и имена совпадают с `naming.md` §2, результат проходит biome без правок 5065a57f
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Пары контракт ↔ реализация

- [x] Task: `gen uc` — пара `domain/<m>/<agg>/uc/<name>.uc.ts` + `packages/<m>/src/<agg>/uc/<name>.uc.ts` (одинаковый относительный путь, `XxxDef`/`Xxx`) + тесты f265ac69
- [x] Task: `gen er` и `gen job` — пары по тому же правилу, константы Job экспортируются + тесты f265ac69
- [x] Task: `gen module <m>` в прикладном слое (`packages/<m>`: `<m>.module.ts` с картой Def → класс, `<m>.facade.ts`, каркас) f265ac69
- [ ] Task: `gen aggregate` в прикладном слое: порт `repo` + `infra/<agg>.json-repo.ts`
- [ ] Task: Тест правила пары: путь контракта и реализации совпадает, иначе падает
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: Приёмка и интеграция

- [ ] Task: E2E `gen-e2e`: во временном каталоге генерируется срез (module → aggregate → uc → er → job → dcs → dqs), на нём зелёные `check` и `arch:check` без ручных правок
- [ ] Task: Идемпотентность и детерминизм: повторный запуск ничего не ломает, порядок и форматирование стабильны
- [ ] Task: Скрипт `gen` в `package.json`; тесты `scripts/gen` входят в `check`
- [ ] Task: Документация: раздел «Генераторы» в `naming.md`, правка `agents.md` §2; в ролях `.agents-core/roles` (`domain-author`, `api-author`, `migrator`) — «создавай через `gen`»; `bun run agents:sync`
- [ ] Task: Обновить `migration.md` (трек 2 ✅) и spec/plan `domain-package` (каркас пакета создан здесь)
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)
