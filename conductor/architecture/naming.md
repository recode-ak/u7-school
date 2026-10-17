# Структура и именование

**Назначение:** файловая структура пакетов, сокращения, имена файлов и объектов. Структура создаётся генераторами (`bun run gen …`, трек generators) — руками её не придумывают. Детали API `define*` фиксируются в треке core и эталоне.

---

## 1. Сокращения (закреплены на уровне core)

| Сокр. | Полное | Пример класса | Суффикс файла |
|---|---|---|---|
| Ar | Aggregate Root | `StudentAr` | `.ar.ts` |
| Uc | UseCase | `CompleteStudentUc` | `.uc.ts` |
| Er | EventReaction | `FulfillWishEr` | `.er.ts` |
| Job | Job | `InactivitySweepJob` | `.job.ts` |
| Dcs | DomainCommandService | `StreamProgressDcs` | `.dcs.ts` |
| Dqs | DomainQueryService | `StreamNavigationDqs` | `.dqs.ts` |
| Def | манифест (результат `define*`) | `CompleteStudentUcDef` | — |
| Repo | Repository | `StudentRepo`, `StudentJsonRepo` | `.repo.ts` |
| Uow | Unit of Work | `Uow` | — |
| Vo | Value Object | `StepRecordVo` | — |
| Fqn | полное имя (`stream.student.completed`) | — | — |

В тексте — заглавными (DCS, DQS), в коде — как слово (Google TS style): `StreamDcs`, не `StreamDCS`.

## 2. Домен: `packages/domain/src/<m>/`

```
<m>/
  index.ts                 публичный API модуля (единственная точка входа для других модулей)
  <m>.module.ts            defineModule — паспорт, dependsOn
  <m>.facade.ts            defineFacade — контракт runtime-API модуля
  <topic>.dcs.ts           DCS модуля (несколько агрегатов)
  <topic>.dqs.ts           DQS модуля
  <aggregate>/
    <aggregate>.state.ts   схема entity и VO (единственное место структуры состояния)
    <aggregate>.ar.ts      агрегат + его Def (статусы, переходы)
    <aggregate>.policy.ts
    <aggregate>.events.ts  группа событий агрегата (FQN-префикс задаётся один раз)
    <aggregate>.errors.ts  группа ошибок агрегата
    uc/<name>.uc.ts        контракт UC
    er/<name>.er.ts        контракт ER (папка основного агрегата — того, что мутируется)
    job/<name>.job.ts      контракт Job (папка основного агрегата)
  shared/                  поля и VO модуля поверх core F.*
packages/domain/src/shared/  поля и VO школы, общие для модулей
```

Подпути экспорта: `@u7-scl/domain/<m>` — доменный API и Def; `@u7-scl/domain/<m>/state` — схемы entity, **только для рендереров UI**.

## 3. Прикладной слой: `packages/<m>/src/` (зеркало домена)

```
<m>.module.ts              реализация модуля: карта Def → класс, резолвер
<m>.facade.ts              реализация фасада (in-proc)
<aggregate>/
  <aggregate>.repo.ts      порт репозитория
  uc/<name>.uc.ts          реализация UC  (пара к domain …/uc/<name>.uc.ts)
  er/<name>.er.ts
  job/<name>.job.ts
infra/<aggregate>.json-repo.ts
```

Правило пары: контракт и реализация имеют **одинаковый путь** относительно `src/<m>/`; контракт — `XxxDef`, реализация — `Xxx`.

## 4. Имена

| Что | Правило | Пример |
|---|---|---|
| Файлы, папки | kebab-case + суффикс вида | `complete-student.uc.ts` |
| Тесты | рядом, `<file>.test.ts` | `student.ar.test.ts` |
| Классы, типы | PascalCase + сокращение | `StudentAr`, `StreamFacade` |
| Def | `<Имя><Вид>Def` | `StudentArDef`, `CompleteStudentUcDef` |
| Группы | `<Агрегат>Events`, `<Агрегат>Errors` | `StudentEvents.completed` |
| События (FQN) | `module.aggregate.event`, событие — прошедшее время | `stream.student.completed` |
| Коды ошибок | UPPER_SNAKE с префиксом сущности, уникальны в приложении | `STUDENT_NOT_ACTIVE` |
| UC | глагол + объект, kebab в имени | `complete-student` |
| Методы Ar | операции — глагол (`complete`), вопросы — `is/has/can` | `isTerminal()` |
| Методы Policy | доменный вопрос «можно ли?» | `canEnrollNextModule`, не `hasModule` |
| Поля | camelCase; `uuid`, `createdAt`/`updatedAt` — через `F.*` | — |
| Константы | UPPER_SNAKE, экспортируются (пороги Job и т.п.) | `INACTIVITY_DAYS` |
| Приватное | TS `private` / `protected`; `#private` запрещён | см. [typescript.md](./typescript.md) |

Отсутствие значения — `undefined`, не `null`.
