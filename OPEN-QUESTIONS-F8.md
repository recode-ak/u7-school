# Открытые вопросы после Ф8 `golden-wish` (временный файл)

Удалить после решения: решения переносятся в `conductor/architecture/decisions.md` (D-43), правки — фазой «Ф8а» в `conductor/tracks/golden-wish_20261020/plan.md` перед Ф9.

Контекст: Ф8 закрыта (`6e2e7e9`). Платформа по D-42 сделана агентами в форме, которую Нурболат не обсуждал детально (TR-10, TR-12). Ниже — что решено (2026-10-21) и что ещё обсудить.

---

## Что было в коде (`packages/dmg-core`) и почему переделываем

- Вызывающий `module` — матрёшка `{ from, origin }`, `originOf`/`subjectOf` рекурсивно спускаются по цепочке; Policy пропускалась при `originOf(caller).kind === 'system'`, `rule()` смотрел на `delegate`.
- `ModuleFromDef.useCase(def)` раздаёт UC наружу: фасад (`callUseCase`) и `ApiApp` сами зовут `uc.handle` — у модуля нет своей точки входа.
- Связь «UC → чужой UC» не закрыта типами: проверка `calls` трижды — `checkDefs`, рантайм в `UseCaseFromDef.run`, `fakeFacadeCall` в тестах.
- Россыпь функций (`callUseCase`, `moduleCaller`, `systemCaller`, `subjectOf`, `originOf`, `fakeFacadeCall`) вместо классов с зоной ответственности.

## Решено (Нурболат, 2026-10-21)

### Р1. `Caller` — иерархия классов
```ts
abstract class Caller<U extends { uuid: string }> {
  abstract readonly kind: 'guest' | 'user' | 'delegate' | 'system';
  abstract subject(): U | undefined;
  abstract person(): PersonCaller<U> | undefined;
  abstract toLog(): CallerLog;
}
type PersonCaller<U> = GuestCaller<U> | UserCaller<U> | DelegateCaller<U>;

class GuestCaller<U>    extends Caller<U> {}                                                  // subject → undefined
class UserCaller<U>     extends Caller<U> { constructor(user: U) }                            // → user
class DelegateCaller<U> extends Caller<U> { constructor(subject: U, actor: U, delegationId: string) } // → subject

type OperationRef = {
  readonly kind: 'useCase' | 'eventReaction' | 'job';
  readonly module: string;   // свой/чужой — сравнением с модулем вызываемого
  readonly name: string;
};
class SystemCaller<U> extends Caller<U> {
  constructor(readonly from: OperationRef, readonly person?: PersonCaller<U>) {}
  // subject() → person?.subject()
}
```
- `ModuleCaller` нет; один `SystemCaller`. Матрёшки нет: `person` по типу не `SystemCaller`, при вложенном вызове передаётся `caller.person()` пришедшего.
- Job и ER — `person = undefined`, `subject()` → `undefined` (Job — не гость: гость — реальный посетитель; аудит ER — через `trace.cause` к записи породившей операции).
- `callers`: `('guest' | 'user' | 'delegate' | 'system')[]`.
- `channel`/`channelId` уходят из `GuestCaller` в `Trace.channel?: { name; visitorId? }` (задаётся на входе, идёт по цепочке).
- `toLog()`:
  ```ts
  type CallerLog =
    | { kind: 'guest' }
    | { kind: 'user'; subjectId: string }
    | { kind: 'delegate'; subjectId: string; actorId: string; delegationId: string }
    | { kind: 'system'; from: OperationRef; person?: CallerLog };
  ```
- Удаляются `subjectOf`, `originOf`, `moduleCaller`, `systemCaller`, `delegable`.

### Р2. Policy — только субъект, вызывается всегда
- `Rule.evaluate(subject: U | undefined, ctx)`; `rule()` без субъекта — отказ. Вид вызывающего Policy не знает, делегирование не проверяет (это решение людей; приложение даёт право и возможность).
- `callers` отсекает недопустимый вид (гость в UC для авторизованных → `UNAUTHORIZED`). Системный вызов без субъекта в UC с правилом субъекта → отказ Policy.
- Системный вызов без актора разрешается только явно: отдельный UC (`callers: ['system']`, `allowAll`) или переопределение `checkPolicy` в наследнике.
- Шаги `UseCaseFromDef` — `protected`: `checkCaller` → `parseInput` → `load` → `checkPolicy` → `checkRules` → `execute` → `parseOutput` → commit. Ослабление в наследнике — его право и ответственность.

### Р3. Модуль — единственная точка входа
```ts
class ModuleFromDef<M, R, U> {
  readonly def: M;
  readonly facade: ModuleFacade<M>;        // создаёт сам модуль
  handle<D extends M['useCases'][number]>(def: D, input: unknown, caller: Caller<U>, trace: Trace)
    : Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>>;   // ApiApp и фасад — только сюда
  subscribe(): () => void;
  runJob(def: M['jobs'][number], trace: Trace): Promise<Result<void, DomainError>>;
  // useCase(def) — не публичный
}
```

### Р4. Фасад — класс-обёртка над модулем, без `CallContext`
```ts
// domain/contracts
/** UC модуля M, у которых 'system' ∈ callers. */
type SystemCallable<M extends AnyModuleDef> = …;
interface Facade<M extends AnyModuleDef> {
  readonly def: M;
  handle<D extends SystemCallable<M>>(def: D, input: InputOf<D>, caller: SystemCaller<unknown>, trace: Trace)
    : Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>>;
}
// app
class ModuleFacade<M extends AnyModuleDef> implements Facade<M> {
  constructor(protected readonly module: ModuleFromDef<M, ModuleDeps, unknown>) {}
  serves(def: AnyUseCaseDef): boolean;
  handle(…) // → this.module.handle(def, input, caller, trace)
}
```
- Не абстрактный (абстрактных членов нет); наследник — только если модулю нужны удобные методы поверх `handle`.
- Типы `CourseModuleFacade`/`QuestionnaireModuleFacade` и обёртки-методы уходят: в домене — `Facade<typeof CourseModuleDef>`.
- Выход — как у UC; обёртку в `ReadonlyAr` делает вызывающий.
- Удаляются `CallContext`, `callUseCase`, `asReadonlyAr` в фасаде, `fakeFacadeCall`; в `dmg-core/testing` — `StubFacade<M> implements Facade<M>` (ответы по Def).

### Р5. Общая база операций и типизированный `call`
```ts
abstract class OperationFromDef<D extends AnyOperationDef, R extends ModuleDeps> {
  constructor(readonly def: D, protected readonly resolve: R) {}
  protected now(): Timestamp;
  /** UC другого модуля — только из D['calls']; свой Def база подставляет сама. */
  protected call<C extends D['calls'][number]>(def: C, input: InputOf<C>, caller: Caller<unknown>, trace: Trace)
    : Promise<Result<OutputOf<C>, UseCaseErrorOf<C>>>;
    // → this.resolve.facades.call(def, input, new SystemCaller(this.ref, caller.person()), trace)
}
// UseCaseFromDef, ReactionFromDef, JobFromDef extends OperationFromDef
```
- `caller` и `trace` передаются явно (экземпляр операции общий для параллельных вызовов); класса `Invocation` нет.
- `ModuleFacades` (в `deps`) — фасады модулей из `dependsOn`, `call(def, …)` выбирает фасад по `serves(def)`.
- Вызов: `await this.call(GetCourseEnrollmentUcDef, { courseId }, caller, trace)`; UC не из `calls` не компилируется.
- Рантайм-проверка `calls` удаляется; `checkDefs` (`arch:check`) остаётся — согласованность Def/графа.

### Р6. Персистентный лог операций
```ts
type OperationRecord = {
  at: Timestamp; module: string; op: string; kind: 'useCase' | 'eventReaction' | 'job';
  caller: CallerLog; trace: Trace; input: unknown;
  result: { ok: true; output: unknown } | { ok: false; error: DomainError };
  events: readonly { name: string; eventId: string }[];
  durationMs: number;
};
interface OperationLog { append(record: OperationRecord): Promise<void> }  // в AppContext
```
- Пишет база операции (`OperationFromDef`) последним шагом — при успехе и отказе: только она знает вход, события и выход. `uow.commit()` возвращает опубликованные события.
- `input`/`output` целиком с порогом размера (≈8 КБ, хвост обрезается с пометкой).
- Хранение: JSONL по дням в `data/oplog/`; не в git (`.gitignore`), не в бэкап; в AGENTS.md — в список живых данных.

### Р7. Ревизия TR-10
- Ошибки ядра чужого UC (`CoreError`) проходят насквозь — `load`/`execute` возвращают `UseCaseErrorOf<D>`. Доменные ошибки чужого UC — явно в `errors` своего UC или перевод в свои (тип не пропустит необъявленную).
- `calls` в Def UC/ER/Job по типу сужен до UC с `'system'` в `callers`; проверка `checkDefs` остаётся.
- `UNAUTHORIZED.from` из payload удаляется (вместе с рантайм-проверкой `calls`).
- `trace` — последний аргумент `load`/`execute` (как у `handle`); `Trace`/`Cause` — в `kernel`.
- `asReadonlyAr` удаляется; в базе `Aggregate` — статический `readonly(state)` с полиморфным `this` (типизация — по `restore` конкретного Ar, без кода в каждом агрегате): `TaskAr.readonly(state): ReadonlyAr<TaskAr>`.
- Из конверта события удаляется `caller` (и из контекста UoW, если больше не нужен): аудит — через oplog породившей операции (Р6).

### Р8. Функции → объекты в рамках Ф8а
- `contractUnitOfWork` → `protected createUow(caller, trace)` у `OperationFromDef`.
- `requestTrace`/`incomingRequestId` и ручная сборка следа в ER/Job → класс `Trace` (`fromRequest`, `fromEvent`, `forJob`, `channel`, `toLog()`).
- `newEntity` + символ-метка → `protected static newState(uuid, at)` у `Aggregate`.
- Остальное (Def-классы, `Rule`-иерархия, `DefIndex`, `ArchChecker`, база репозитория с `Lock`/`assertVersion`, тестовые двойники) — отдельный трек `dmg-core-oop` (см. `conductor/tracks.md`), после `golden-wish`.

### Р9. Ревизия TR-11
- Подход принят: Def UC во внешнем контракте, адаптеры `UseCaseFromDef` над legacy в пакетах владельцев; после Ф8а — `callers: ['system']`, `Facade<typeof CourseModuleDef>` вместо `CourseModuleFacade`/`QuestionnaireModuleFacade`.
- `GetCourseEnrollmentUcDef.policy = allowAll` — остаётся (ответ не зависит от субъекта).
- `StartQuestionnaireUcDef.policy`: `allowAll` → правило «респондент есть» (без субъекта — `ACCESS_DENIED`, а не `SERVER_INTERNAL` из `subject()`).

## Не решено — обсудить после Ф8а

### В4. Принятые оркестратором решения Ф8 — на ревизию (смотреть код явно)
- TR-12: `createForCourse` → `{ wish, outcome, questionnaire? }`; принятые риски обхода `calls` (снимаются Р3–Р5).

## Решено в Ф8 (для справки)
- D-41 — место межмодульного побочного эффекта выбирает Нурболат по каждому случаю; `create-course-wish` — вариант 1 (анкета в `execute` до фиксации).
- D-42 — фасад без манифеста, связи «UC → UC» через `calls`; вызывающий `module` заменяется Р1–Р5 (D-43).
