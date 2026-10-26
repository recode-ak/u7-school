# Структура и именование

**Назначение:** файловая структура домена и прикладного слоя, сокращения, имена файлов и объектов. Корни каталогов задаёт `ArchApp.layout` проекта (`dmg-core/arch`); структуру внутри них проверяет `checkFiles`. Образец — учебный модуль [src/testing/example](../src/testing/example/example.arch.ts).

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
| Def | манифест (результат `define*`) | `CompleteTaskUcDef` | — |
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
  <m>.module.ts            defineModule — паспорт, dependsOn
  <topic>.dcs.ts           DCS модуля (несколько агрегатов)
  <topic>.dqs.ts           DQS модуля
  <aggregate>/
    <aggregate>.state.ts   схема entity и VO (единственное место структуры состояния)
    <aggregate>.ar.ts      агрегат + его Def (статусы, переходы)
    <aggregate>.policy.ts
    <aggregate>.rules.ts   доменные правила без субъекта (`<A>Rules = defineRules`, D-40)
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
