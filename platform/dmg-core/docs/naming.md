# Структура и именование

**Назначение:** файловая структура домена и прикладного слоя, сокращения, имена файлов и объектов, генератор заготовок. Корни каталогов задаёт секция `gen` `dmg-core.json`, `ArchApp.layout` проекта берёт их оттуда же (`GenLayout`, §5); структуру внутри них проверяет проверка файлов `ArchChecker`, создаёт — `dmg-core gen` (§5). Образец — учебный модуль [src/testing/example](../src/testing/example/example.arch.ts).

---

## 1. Сокращения (закреплены в `dmg-core`)

| Сокр. | Полное | Пример класса | Суффикс файла |
|---|---|---|---|
| Ar | Aggregate Root | `TaskAr` | `.ar.ts` |
| Uc | UseCase | `CompleteTaskUc` | `.uc.ts` |
| Er | EventReaction | `ReleaseRemovedUserTasksEr` | `.er.ts` |
| Job | Job | `ArchiveDoneTasksJob` | `.job.ts` |
| Dcs | DomainCommandService | `TaskReleaseDcs` | `.dcs.ts` |
| Dqs | DomainQueryService | `TaskProgressDqs` | `.dqs.ts` |
| Def | манифест (экземпляр Def-класса, `XxxDef.define`) | `CompleteTaskUcDef` | — |
| Repo | Repository | `TaskRepo`, `TaskJsonRepo` | `.repo.ts` |
| Uow | Unit of Work | `Uow` | — |
| Vo | Value Object | `TaskAssignmentVo` | — |
| Fqn | полное имя (`todo.task.completed`) | — | — |

В тексте — заглавными (DCS, DQS), в коде — как слово (Google TS style): `TaskReleaseDcs`, не `TaskReleaseDCS`.

## 2. Домен: `<domain>/<m>/`

```
<m>/
  contract.ts              вход для остального кода: ModuleDef, Def внешних операций, события, ошибки, VO контрактов (D-45)
  index.ts                 API домена для своего прикладного пакета (включая contract)
  <m>.module.ts            ModuleDef.define — паспорт, dependsOn
  <topic>.dcs.ts           DCS модуля (несколько агрегатов)
  <topic>.dqs.ts           DQS модуля
  <aggregate>/
    <aggregate>.state.ts   схема entity и VO (единственное место структуры состояния)
    <aggregate>.ar.ts      агрегат + его Def (статусы, переходы)
    <aggregate>.policy.ts
    <aggregate>.rules.ts   доменные правила без субъекта (`<A>Rules = RulesDef.define`, D-40)
    <aggregate>.events.ts  группа событий агрегата (FQN-префикс задаётся один раз)
    <aggregate>.errors.ts  группа ошибок агрегата
    uc/<name>.uc.ts        контракт UC
    er/<name>.er.ts        контракт ER (папка основного агрегата — того, что мутируется)
    job/<name>.job.ts      контракт Job (папка основного агрегата)
  state.ts                 реэкспорт схем state для своего прикладного пакета (наружу модуля не выходит)
  shared/                  поля и VO модуля поверх F.*
<domain>/shared/           поля и VO приложения, общие для модулей
```

Подпути экспорта пакета домена: `<domain>/<m>/contract` — для другого кода; `<domain>/<m>` — для своего прикладного пакета. Подпути state нет: схемы entity наружу не выходят, форма данных — из контракта (D-45). Вход модуля, который проверяет ARC-04, задаёт `ArchApp` (`entry: 'contract'`).

## 3. Прикладной слой: `<app>/<m>/` (зеркало домена)

```
<m>.module.ts              реализация модуля: карта Def → класс, резолвер
<aggregate>/
  <aggregate>.repo.ts      порт репозитория
  uc/<name>.uc.ts          реализация UC  (пара к <domain>/<m>/…/uc/<name>.uc.ts)
  er/<name>.er.ts
  job/<name>.job.ts
infra/<aggregate>.json-repo.ts
```

Правило пары: контракт и реализация имеют **одинаковый путь** относительно каталога модуля (`<domain>/<m>/` и `<app>/<m>/`); контракт — `XxxDef`, реализация — `Xxx`.

## 4. Имена

| Что | Правило | Пример |
|---|---|---|
| Файлы, папки | kebab-case + суффикс вида | `complete-task.uc.ts` |
| Тесты | рядом, `<file>.test.ts` | `task.ar.test.ts` |
| Экспортируемые типы | рядом, `<file>.types.ts`; в файле класса — только приватные | `aggregate.types.ts`, `task-release.types.ts` |
| Классы, типы | PascalCase + сокращение | `TaskAr`, `TaskReleaseDcs` |
| Def | `<Имя><Вид>Def` | `TaskArDef`, `CompleteTaskUcDef` |
| Группы | `<Агрегат>Events`, `<Агрегат>Errors`, `<Агрегат>Rules` | `TaskEvents.completed` |
| События (FQN) | `module.aggregate.event`, событие — прошедшее время | `todo.task.completed` |
| Коды ошибок | UPPER_SNAKE с префиксом сущности, уникальны в приложении | `TASK_ALREADY_DONE` |
| UC | глагол + объект, kebab в имени | `complete-task` |
| Методы Ar | операции — глагол (`complete`), вопросы — `is/has/can` | `isTerminal()` |
| Методы Policy | доменный вопрос «можно ли?» | `canManage`, не `hasOwnerId` |
| Поля | camelCase; `uuid`, `createdAt`/`updatedAt` — через `F.*` | — |
| Константы | UPPER_SNAKE, экспортируются (пороги Job и т.п.) | `OPEN_TASKS_LIMIT` |
| Приватное | TS `private` / `protected`; `#private` запрещён | см. [typescript.md](./typescript.md) |

Отсутствие значения — `undefined`, не `null`.

## 5. Генератор `dmg-core gen`

`dmg-core gen <вид> <модуль>[.<агрегат>] [<имя>] [--write]` создаёт файлы по §2–§4. Без `--write` — dry-run (печатает план). Существующие файлы не перезаписываются: коллизия — ошибка, и ничего не записано. Код выхода 1 — ошибка ввода или коллизия.

| Команда | Что создаёт |
|---|---|
| `gen module <m>` | домен: `<m>.module.ts`, `contract.ts` (только паспорт: остальное в контракт добавляет автор, D-45), `index.ts`, тест; прикладной слой: `<m>.module.ts` (карта Def → класс, `Deps`, фабрика) и тест. Фасада нет: он пишется руками по потребителю (D-42) |
| `gen aggregate <m>.<a>` | домен: state, events, errors, Ar, Policy и тесты; прикладной слой: `<a>.repo.ts`, `infra/<a>.json-repo.ts` и тест |
| `gen uc\|er\|job <m>.<a> <имя>` | пара: контракт в домене и реализация в прикладном слое по тому же относительному пути (`<a>/<вид>/`), плюс тесты |
| `gen dcs\|dqs <m> <имя>` | сервис в домене с тестом |

Генератор правит существующие файлы только по маркерам: `// gen:exports` (`index.ts`), `// gen:defs:imports|aggregates|useCases|reactions|jobs` (паспорт и карта модуля), `// gen:deps` (`Deps` прикладного модуля). Нет файла или маркера — команда печатает «Вставь вручную …» и не падает. Заготовки содержат `TODO` (названия, описания, схемы): их заполняет автор; тесты прикладного слоя подставляют репозитории вручную. Импорты пишутся в порядке biome — заготовки проходят `check` без правок.

`--adopt` — перевод существующего модуля на Def: `gen module` допускает каталог модуля без `<m>.module.ts`, `gen aggregate` — каталог агрегата без `<a>.state.ts`. Существующие `index.ts` и `contract.ts` не перезаписываются (печатается «Пропущен» с шаблоном, правки по маркерам идут в `index.ts`); остальные коллизии — ошибка.

**Раскладка** — секция `gen` в `dmg-core.json` (корень проекта; без файла — значения по умолчанию). Шаблоны с `{m}`; пути — от корня проекта:

| Поле | Что | По умолчанию |
|---|---|---|
| `domain` | каталог модуля домена | `src/domain/{m}` |
| `app` | каталог прикладного слоя модуля | `src/app/{m}` |
| `domainImport` | спецификатор импорта домена из прикладного слоя (например, `@acme/domain/{m}`) | не задан — относительный путь к каталогу модуля домена (его `index.ts`; нужен `moduleResolution: bundler`) |

```json
{ "gen": { "domain": "domain/src/{m}", "app": "modules/{m}/src", "domainImport": "@acme/domain/{m}" } }
```

**Гибки только корни каталогов.** Форма внутри модуля (§2–§3) фиксирована: пары «контракт ↔ реализация» по одинаковому относительному пути (MAN-10), 1:1 домена и прикладного слоя (ARC-06). Третьей раскладки внутри модуля нет.

Раскладка — один источник для генератора и `arch:check`: проект строит `ArchApp.layout` из `GenLayout` (`dmg-core/gen`), а не пишет пути вручную. Первая строка вывода `gen` — применяемая раскладка.

```ts
import { GenLayout } from 'dmg-core/gen';

const layout = await GenLayout.read(root); // секция gen dmg-core.json
export const AppArch: ArchApp = { name: 'app', modules, layout: (m) => layout.module(m) };
```

Генератор пишет только исходники: заготовку пакета модуля (`package.json`, `tsconfig.json`, workspace) создаёт проект.
