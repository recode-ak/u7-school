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
  contract.ts              вход для остального кода: ModuleDef, Def внешних операций, события, ошибки, VO контрактов (D-45)
  index.ts                 API домена для своего прикладного пакета packages/<m> (включая contract)
  <m>.module.ts            defineModule — паспорт, dependsOn
  <m>.facade.ts            defineFacade — контракт runtime-API модуля
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
  shared/                  поля и VO модуля поверх core F.*
packages/domain/src/shared/  поля и VO школы, общие для модулей
```

Подпути экспорта: `@u7-scl/domain/<m>/contract` — для другого кода; `@u7-scl/domain/<m>` — для своего прикладного пакета. Подпути state нет: схемы entity наружу не выходят, форма данных — из контракта (D-45).

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
| Экспортируемые типы | рядом, `<file>.types.ts`; в файле класса — только приватные (TR-19) | `aggregate.types.ts`, `wish.types.ts` |
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

## 5. Генераторы

`bun run gen <вид> <модуль>[.<агрегат>] [<имя>] [--write]` создаёт файлы по §2–§4. Без `--write` — dry-run (печатает план). Существующие файлы не перезаписываются: коллизия — ошибка и ничего не записано.

| Команда | Что создаёт |
|---|---|
| `gen module <m> [--facade]` | домен: `<m>.module.ts`, `index.ts`, тест; прикладной пакет (для нового — `package.json`, `tsconfig.json`, `src/index.ts`), `<m>.module.ts`, тест; с `--facade` — ещё `<m>.facade.ts` в домене и в пакете (фасад — только по потребителю, D-38) |
| `gen aggregate <m>.<a>` | домен: state, events, errors, Ar, Policy и тесты; прикладной слой: `<a>.repo.ts`, `infra/<a>.json-repo.ts` и тест |
| `gen uc\|er\|job <m>.<a> <имя>` | пара: контракт в домене и реализация в `packages/<m>/src/<a>/<вид>/` по тому же относительному пути, плюс тесты |
| `gen dcs\|dqs <m> <имя>` | сервис в домене с тестом |

Генератор правит существующие файлы только по маркерам: `// gen:exports` (`index.ts`), `// gen:defs:imports\|aggregates\|useCases\|reactions\|jobs` (паспорт модуля), `// gen:deps` (`Deps` прикладного модуля). Нет файла или маркера — команда печатает строку «Вставь вручную …» и не падает. Заготовки содержат `TODO` (названия, описания, схемы): их заполняет автор; тесты прикладного слоя подставляют репозитории вручную.

`--adopt` — перевод legacy-модуля на Def: `gen module` допускает существующий каталог модуля без `<m>.module.ts`, `gen aggregate` — каталог агрегата без `<a>.state.ts`. Существующий `index.ts` не перезаписывается (печатается «Пропущен» с шаблоном, правки по маркерам идут в него); остальные коллизии — ошибка. Существующий прикладной пакет (`package.json`) генератор не пересоздаёт и без `--adopt`.

Опции `--domain-root` и `--packages-root` меняют корни (по умолчанию `packages/domain/src` и `packages`).

