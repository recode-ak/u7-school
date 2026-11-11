# Список тестов типов dmg-core (механический)

Скрипт, без LLM. Строки импорта исключены. Всего случаев: 135.

| # | файл:строка | вид | тест (it) | фрагмент |
|---|---|---|---|---|
| 1 | src/app/api-app/api-app.test.ts:271 | expect-error | команда UC чужого модуля — ошибка компиляции | `// @ts-expect-error createTask не из модуля users ⏎ CreateTaskUcDef.command({ title: 'Хлеб' }),` |
| 2 | src/app/client/module-api.test.ts:86 | pos | ответ типизирован по Def команды | `expectTypeOf(res).toEqualTypeOf< ⏎ Promise<Result<OutputOf<Get>, UseCaseErrorOf<Get>>> ⏎ >();` |
| 3 | src/app/client/module-api.test.ts:94 | expect-error | команда UC другого модуля — ошибка типа | `// @ts-expect-error removeUser — UC модуля users ⏎ RemoveUserUcDef.command({ userId: OWNER }),` |
| 4 | src/app/client/module-api.test.ts:161 | pos | восстановленный Result типизирован по Def команды | `expectTypeOf(restored).toEqualTypeOf< ⏎ Result<OutputOf<Complete>, UseCaseErrorOf<Complete>> ⏎ >();` |
| 5 | src/app/facade/module-facade.test.ts:80 | expect-error | UC без system в callers и UC другого модуля — ошибка типа | `// @ts-expect-error createTask не вызывается системой ⏎ todo.handle(CreateTaskUcDef, { title: 'x' }, caller, REQ),` |
| 6 | src/app/facade/module-facade.test.ts:82 | expect-error | UC без system в callers и UC другого модуля — ошибка типа | `// @ts-expect-error removeUser не из модуля todo ⏎ todo.handle(RemoveUserUcDef, { userId: OWNER }, caller, REQ),` |
| 7 | src/app/module/module-from-def.test.ts:151 | expect-error | реализации UC наружу не раздаются | `// @ts-expect-error useCases — не публичные: вход только через dispatch ⏎ expect(mini.useCases).toBeDefined();` |
| 8 | src/app/module/module-from-def.test.ts:204 | expect-error | команда UC другого модуля — ошибка компиляции | `// @ts-expect-error createTask не из модуля mini ⏎ CreateTaskUcDef.command({ title: 'x' }),` |
| 9 | src/app/module/module-from-def.test.ts:273 | expect-error | пропуск реализации UC | `// @ts-expect-error: нет completeTask ⏎ useCases: {},` |
| 10 | src/app/module/module-from-def.test.ts:282 | expect-error | класс чужого Def под именем UC | `// @ts-expect-error: ReleaseRemoved реализует ER, а не completeTask ⏎ useCases: { completeTask: ReleaseRemoved },` |
| 11 | src/app/module/module-from-def.test.ts:289 | expect-error | фасада в карте нет (D-42) | `// @ts-expect-error: фасад собирает приложение, а не карта модуля ⏎ const extra: Map = { ...map, facade: () => ({}) };` |
| 12 | src/app/module/module-from-def.test.ts:299 | expect-error | UC, которому нужен субъект богаче, чем даёт приложение | `// @ts-expect-error: Caller<Poor> не несёт hasRole ⏎ useCases: { completeTask: CompleteTask },` |
| 13 | src/app/operation/operation-from-def.test.ts:166 | expect-error |  | `// @ts-expect-error getTask нет в calls UC silent ⏎ await this.call(GetTaskUcDef, input, caller, trace);` |
| 14 | src/app/operation/operation-from-def.test.ts:225 | expect-error |  | `// @ts-expect-error у реакции silentEr нет calls ⏎ await this.call(GetTaskUcDef, { taskId: TASK }, caller, trace);` |
| 15 | src/app/operation/operation-from-def.test.ts:251 | expect-error |  | `// @ts-expect-error у задания silentJob нет calls ⏎ await this.call(GetTaskUcDef, { taskId: TASK }, this.caller, job.trace);` |
| 16 | src/app/operation/operation-from-def.test.ts:316 | expect-error | необъявленная доменная ошибка вызванного UC — ошибка типа, ядра — проходит | `// @ts-expect-error TASK_NOT_FOUND нет в errors UC translate ⏎ const leaked: UseCaseErrorOf<typeof TranslateUcDef> = notFound;` |
| 17 | src/app/use-case/use-case-from-def.test.ts:566 | expect-error | execute не может вернуть незаявленную ошибку (ERR-02) | `// @ts-expect-error: OTHER_FAILED нет в errors CompleteTaskUcDef ⏎ protected async execute() {` |
| 18 | src/app/use-case/use-case-from-def.test.ts:576 | expect-error | загруженный контекст обязан подходить Policy | `// @ts-expect-error: { title } не TaskCtx — Policy нечего проверять ⏎ type WrongCtx = UseCaseFromDef<Uc, Deps, { title: string }>;` |
| 19 | src/app/use-case/use-case-from-def.test.ts:578 | pos | загруженный контекст обязан подходить Policy | `expectTypeOf<WrongCtx>().not.toBeNever();` |
| 20 | src/app/use-case/use-case-from-def.test.ts:661 | expect-error | ошибка правила обязана быть в errors UC (ERR-02) | `// @ts-expect-error: TASK_ALREADY_DONE правила нет в errors UC ⏎ UndeclaredUcDef,` |
| 21 | src/app/use-case/use-case-from-def.test.ts:698 | expect-error | контекст load и fetch вместе обязан подходить каждому правилу (D-58) | `// @ts-expect-error: нет openCount — правилу fewOpen нечего проверять ⏎ TwoRulesUcDef,` |
| 22 | src/domain/aggregate/aggregate-def.test.ts:70 | pos | без статусов — statuses и transitions не объявлены | `expectTypeOf<TransitionOf<typeof TagArDef>>().toEqualTypeOf<never>();` |
| 23 | src/domain/aggregate/aggregate-def.test.ts:71 | pos | без статусов — statuses и transitions не объявлены | `expectTypeOf<TransitionOf<typeof NoteArDef>>().toEqualTypeOf<'close'>();` |
| 24 | src/domain/aggregate/aggregate-def.test.ts:94 | expect-error | переход объявляет отказ для каждого статуса вне  | `// @ts-expect-error нет отказа для статуса 'closed' ⏎ close: { from: ['draft'], to: 'closed', rejects: {} },` |
| 25 | src/domain/aggregate/aggregate-def.test.ts:128 | pos | конкретный Def совместим с AnyAggregateDef | `expectTypeOf(NoteArDef).toExtend<AnyAggregateDef>();` |
| 26 | src/domain/aggregate/aggregate-def.test.ts:129 | pos | конкретный Def совместим с AnyAggregateDef | `expectTypeOf(TagArDef).toExtend<AnyAggregateDef>();` |
| 27 | src/domain/aggregate/aggregate.test.ts:206 | expect-error | статусы обязаны покрыть все значения  | `// @ts-expect-error нет статуса 'done' ⏎ statuses: { open: { label: 'Открыта' } },` |
| 28 | src/domain/aggregate/aggregate.test.ts:223 | expect-error | переход объявляет отказ для каждого статуса вне  | `// @ts-expect-error нет отказа для статуса 'done' ⏎ complete: { from: ['open'], to: 'done', rejects: {} },` |
| 29 | src/domain/aggregate/aggregate.test.ts:284 | expect-error | переопределение — своя форма выхода со своим типом | `// @ts-expect-error скрытое поле не входит в тип выхода ⏎ expect(view.pin).toBeUndefined();` |
| 30 | src/domain/aggregate/readonly-ar.test.ts:62 | expect-error | мутирующие методы, снимок и выдача событий недоступны | `// @ts-expect-error мутирующий метод (возвращает Result) ⏎ view.pin;` |
| 31 | src/domain/aggregate/readonly-ar.test.ts:64 | expect-error | мутирующие методы, снимок и выдача событий недоступны | `// @ts-expect-error снимок — entity, только для репозитория ⏎ view.snapshot;` |
| 32 | src/domain/aggregate/readonly-ar.test.ts:66 | expect-error | мутирующие методы, снимок и выдача событий недоступны | `// @ts-expect-error события выдаёт только UoW ⏎ view.pullEvents;` |
| 33 | src/domain/aggregate/readonly-ar.test.ts:77 | expect-error | state → ReadonlyAr конкретного Ar через его restore | `// @ts-expect-error мутирующий метод скрыт (ReadonlyAr) ⏎ expect(typeof value.pin).toBe('function');` |
| 34 | src/domain/aggregate/readonly-ar.test.ts:95 | expect-error | state другого агрегата — ошибка компиляции | `// @ts-expect-error restore NoteAr ждёт state заметки ⏎ const wrong = () => NoteAr.readonly({ uuid: ID });` |
| 35 | src/domain/contracts/command.test.ts:33 | pos | meta — только requestId: версии в meta нет (D-57) | `expectTypeOf<keyof CommandMeta>().toEqualTypeOf<'requestId'>();` |
| 36 | src/domain/contracts/command.test.ts:59 | pos | тип команды — по Def аргумента | `expectTypeOf(command).toEqualTypeOf<Command<typeof CompleteTaskUcDef>>();` |
| 37 | src/domain/contracts/command.test.ts:69 | pos | команда из Def несёт этот Def фантомно | `expectTypeOf(command).toEqualTypeOf<Command<Complete>>();` |
| 38 | src/domain/contracts/command.test.ts:70 | pos | команда из Def несёт этот Def фантомно | `expectTypeOf<DefOfCommand<typeof command>>().toEqualTypeOf<Complete>();` |
| 39 | src/domain/contracts/command.test.ts:74 | pos | uc — литерал имени, input — InputOf | `expectTypeOf<Command<Complete>['uc']>().toEqualTypeOf<'completeTask'>();` |
| 40 | src/domain/contracts/command.test.ts:75 | pos | uc — литерал имени, input — InputOf | `expectTypeOf<Command<Complete>['input']>().toEqualTypeOf< ⏎ InputOf<Complete> ⏎ >();` |
| 41 | src/domain/contracts/command.test.ts:83 | pos | по команде выводятся OutputOf и UseCaseErrorOf Def | `expectTypeOf<OutputOf<D>>().toEqualTypeOf<OutputOf<Complete>>();` |
| 42 | src/domain/contracts/command.test.ts:84 | pos | по команде выводятся OutputOf и UseCaseErrorOf Def | `expectTypeOf<UseCaseErrorOf<D>>().toEqualTypeOf<UseCaseErrorOf<Complete>>();` |
| 43 | src/domain/contracts/command.test.ts:88 | expect-error | вход проверяет компилятор | `// @ts-expect-error — нет обязательного taskId ⏎ CompleteTaskUcDef.command({});` |
| 44 | src/domain/contracts/command.test.ts:90 | expect-error | вход проверяет компилятор | `// @ts-expect-error — taskId не строка ⏎ CompleteTaskUcDef.command({ taskId: 1 });` |
| 45 | src/domain/contracts/command.test.ts:95 | pos | Def с командой по-прежнему совместим с AnyUseCaseDef | `expectTypeOf<Complete>().toExtend<AnyUseCaseDef>();` |
| 46 | src/domain/contracts/command.test.ts:96 | pos | Def с командой по-прежнему совместим с AnyUseCaseDef | `expectTypeOf<Command<Complete>>().toExtend<Command>();` |
| 47 | src/domain/contracts/contracts.test.ts:47 | expect-error | calls — только Def UC (MAN-07, D-42) | `// @ts-expect-error в calls — Def UC, а не агрегат или строка ⏎ calls: [TaskArDef],` |
| 48 | src/domain/contracts/contracts.test.ts:57 | expect-error | calls — только UC с system в callers (D-43, Р7) | `// @ts-expect-error ListTasks зовёт только user — система его не вызовет ⏎ calls: [GetUserUcDef, ListTasksUcDef],` |
| 49 | src/domain/contracts/contracts.test.ts:70 | expect-error | input, output и ошибки выводятся из Def | `// @ts-expect-error чужой код ⏎ const alien: UseCaseErrorOf<typeof CompleteTaskUcDef>['code'] =` |
| 50 | src/domain/contracts/contracts.test.ts:73 | expect-error | input, output и ошибки выводятся из Def | `// @ts-expect-error неверный тип входа ⏎ const bad: InputOf<typeof CompleteTaskUcDef> = { taskId: 1 };` |
| 51 | src/domain/contracts/contracts.test.ts:79 | expect-error | label, description и policy обязательны, query не публикует события (тип) | `// @ts-expect-error policy обязательна (без ограничений — allowAll) ⏎ UseCaseDef.define({` |
| 52 | src/domain/contracts/contracts.test.ts:91 | expect-error | label, description и policy обязательны, query не публикует события (тип) | `// @ts-expect-error нет description ⏎ UseCaseDef.define({` |
| 53 | src/domain/contracts/contracts.test.ts:103 | expect-error | label, description и policy обязательны, query не публикует события (тип) | `// @ts-expect-error query не публикует события ⏎ UseCaseDef.define({` |
| 54 | src/domain/contracts/contracts.test.ts:147 | expect-error | calls — только UC с system в callers (D-43, Р7) | `// @ts-expect-error ListTasks зовёт только user — система его не вызовет ⏎ calls: [ListTasksUcDef],` |
| 55 | src/domain/contracts/contracts.test.ts:190 | expect-error | calls — только UC с system в callers (D-43, Р7) | `// @ts-expect-error ListTasks зовёт только user — система его не вызовет ⏎ const job = JobDef.define({ ...RemindJobDef, calls: [ListTasksUcDef] });` |
| 56 | src/domain/contracts/def-types.test.ts:16 | pos | литеральные типы calls, policy, useCases, InputOf | `expectTypeOf<(typeof CompleteTaskUcDef)['calls'][number]>().toEqualTypeOf< ⏎ typeof GetUserUcDef ⏎ >();` |
| 57 | src/domain/contracts/def-types.test.ts:19 | pos | литеральные типы calls, policy, useCases, InputOf | `expectTypeOf<(typeof CompleteTaskUcDef)['policy']>().toEqualTypeOf< ⏎ typeof TaskPolicy.rules.canComplete ⏎ >();` |
| 58 | src/domain/contracts/def-types.test.ts:22 | pos | литеральные типы calls, policy, useCases, InputOf | `expectTypeOf<(typeof TodoModuleDef)['useCases'][number]>().toEqualTypeOf< ⏎ typeof CompleteTaskUcDef \| typeof ListTasksUcDef ⏎ >();` |
| 59 | src/domain/contracts/def-types.test.ts:25 | pos | литеральные типы calls, policy, useCases, InputOf | `expectTypeOf<InputOf<typeof CompleteTaskUcDef>>().toEqualTypeOf<{ ⏎ taskId: string;` |
| 60 | src/domain/contracts/def-types.test.ts:31 | pos | конкретный Def совместим с Any*Def | `expectTypeOf<typeof CompleteTaskUcDef>().toExtend<AnyUseCaseDef>();` |
| 61 | src/domain/contracts/event-reaction-def.test.ts:52 | pos | on, touches — ссылками; необъявленные calls, emits, touches — пусто | `expectTypeOf(ArchiveDone.calls).toEqualTypeOf<readonly []>();` |
| 62 | src/domain/contracts/event-reaction-def.test.ts:57 | pos | calls — те же UC, литеральный тип | `expectTypeOf<(typeof SyncUser)['calls'][number]>().toEqualTypeOf< ⏎ typeof GetUserUcDef ⏎ >();` |
| 63 | src/domain/contracts/event-reaction-def.test.ts:67 | expect-error | calls — только UC с system в callers (D-43) | `// @ts-expect-error ListTasks зовёт только user — система его не вызовет ⏎ calls: [ListTasksUcDef],` |
| 64 | src/domain/contracts/event-reaction-def.test.ts:109 | pos | тип события реакции — union событий из on | `expectTypeOf<ReactionEventOf<typeof ArchiveDone>['name']>().toEqualTypeOf< ⏎ 'todo.task.completed' \| 'todo.task.created' ⏎ >();` |
| 65 | src/domain/contracts/event-reaction-def.test.ts:112 | expect-error | тип события реакции — union событий из on | `// @ts-expect-error SyncUser не подписан на completed ⏎ const bad: ReactionEventOf<typeof SyncUser> = completed;` |
| 66 | src/domain/contracts/event-reaction-def.test.ts:124 | pos | структурная типизация: нет private/# | `expectTypeOf<PublicShape>().toExtend<EventReactionDef>();` |
| 67 | src/domain/contracts/job-def.test.ts:48 | pos | расписание и ссылки; необъявленные scans, calls, emits — пусто | `expectTypeOf(Remind.calls).toEqualTypeOf<readonly []>();` |
| 68 | src/domain/contracts/job-def.test.ts:49 | pos | расписание и ссылки; необъявленные scans, calls, emits — пусто | `expectTypeOf<(typeof Sync)['calls'][number]>().toEqualTypeOf< ⏎ typeof GetUserUcDef ⏎ >();` |
| 69 | src/domain/contracts/job-def.test.ts:59 | expect-error | calls — только UC с system в callers (D-43) | `// @ts-expect-error ListTasks зовёт только user — система его не вызовет ⏎ calls: [ListTasksUcDef],` |
| 70 | src/domain/contracts/job-def.test.ts:96 | pos | структурная типизация: нет private/# | `expectTypeOf<PublicShape>().toExtend<JobDef>();` |
| 71 | src/domain/contracts/module-def.test.ts:56 | pos | литеральные типы состава | `expectTypeOf<(typeof Todo)['useCases'][number]>().toEqualTypeOf< ⏎ typeof CompleteTaskUcDef \| typeof ListTasksUcDef ⏎ >();` |
| 72 | src/domain/contracts/module-def.test.ts:59 | pos | литеральные типы состава | `expectTypeOf(Todo.name).toEqualTypeOf<'todo'>();` |
| 73 | src/domain/contracts/module-def.test.ts:109 | pos | структурная типизация: нет private/# | `expectTypeOf<PublicShape>().toExtend<ModuleDef>();` |
| 74 | src/domain/contracts/operation-def.test.ts:74 | pos | наследник Def | `expectTypeOf(op.name).toEqualTypeOf<'remind'>();` |
| 75 | src/domain/contracts/operation-def.test.ts:80 | pos | calls не объявлены — пустой кортеж из конструктора | `expectTypeOf(op.calls).toEqualTypeOf<readonly []>();` |
| 76 | src/domain/contracts/operation-def.test.ts:90 | pos | calls объявлены — те же Def по ссылке, литеральный тип | `expectTypeOf(op.calls).toEqualTypeOf<readonly [typeof GetUserUcDef]>();` |
| 77 | src/domain/contracts/operation-def.test.ts:145 | pos | структурная типизация: нет private/# | `expectTypeOf<PublicShape>().toExtend<ScanDef>();` |
| 78 | src/domain/contracts/use-case-def.result.test.ts:92 | pos | восстановленный Result типизирован по Def | `expectTypeOf(restored).toEqualTypeOf<CompleteResult>();` |
| 79 | src/domain/contracts/use-case-def.test.ts:64 | pos | поля спеки — те же ссылки, литеральные типы | `expectTypeOf(CompleteTask.type).toEqualTypeOf<'command'>();` |
| 80 | src/domain/contracts/use-case-def.test.ts:65 | pos | поля спеки — те же ссылки, литеральные типы | `expectTypeOf(CompleteTask.policy).toEqualTypeOf( ⏎ TaskPolicy.rules.canComplete, ⏎ );` |
| 81 | src/domain/contracts/use-case-def.test.ts:68 | pos | поля спеки — те же ссылки, литеральные типы | `expectTypeOf<(typeof CompleteTask)['calls'][number]>().toEqualTypeOf< ⏎ typeof GetUserUcDef ⏎ >();` |
| 82 | src/domain/contracts/use-case-def.test.ts:71 | pos | поля спеки — те же ссылки, литеральные типы | `expectTypeOf<InputOf<typeof CompleteTask>>().toEqualTypeOf<{ ⏎ taskId: string;` |
| 83 | src/domain/contracts/use-case-def.test.ts:80 | pos | необъявленные rules, calls, emits — пустые кортежи | `expectTypeOf(ListTasks.calls).toEqualTypeOf<readonly []>();` |
| 84 | src/domain/contracts/use-case-def.test.ts:123 | expect-error | calls — только UC с system в callers (D-43) | `// @ts-expect-error CompleteTask зовёт только user — система его не вызовет ⏎ calls: [GetUserUcDef, CompleteTask],` |
| 85 | src/domain/contracts/use-case-def.test.ts:130 | expect-error | query не публикует события (тип) | `// @ts-expect-error query не публикует события ⏎ UseCaseDef.define({` |
| 86 | src/domain/contracts/use-case-def.test.ts:155 | pos | структурная типизация: нет private/# | `expectTypeOf<PublicShape>().toExtend<UseCaseDef>();` |
| 87 | src/domain/events/event-def.define.test.ts:48 | expect-error | тип события выводится из Def | `// @ts-expect-error payload проверяется схемой Def ⏎ TaskEvents.completed.make({ id: 't1' });` |
| 88 | src/domain/events/event-def.define.test.ts:67 | expect-error | префикс обязан иметь вид  | `// @ts-expect-error префикс без агрегата ⏎ EventDef.define('todo', {});` |
| 89 | src/domain/events/event-def.test.ts:22 | pos | define — группа Def-классов, имя = префикс + ключ | `expectTypeOf(def.name).toEqualTypeOf<'todo.task.completed'>();` |
| 90 | src/domain/events/event-def.test.ts:31 | pos | make() — событие с типизированным payload | `expectTypeOf(e).toEqualTypeOf<EventOf<typeof TaskEvents.completed>>();` |
| 91 | src/domain/events/event-def.test.ts:32 | expect-error | make() — событие с типизированным payload | `// @ts-expect-error payload не по схеме ⏎ TaskEvents.completed.make({ id: 1 });` |
| 92 | src/domain/events/event-def.test.ts:52 | pos | конкретный Def совместим с AnyEventDef | `expectTypeOf(TaskEvents.completed).toExtend<AnyEventDef>();` |
| 93 | src/domain/policy/policy-def.test.ts:36 | pos | литеральные типы правил сохраняются; совместим с AnyPolicyDef | `expectTypeOf(TaskPolicy.rules.canComplete).toEqualTypeOf<typeof isOwner>();` |
| 94 | src/domain/policy/policy-def.test.ts:37 | pos | литеральные типы правил сохраняются; совместим с AnyPolicyDef | `expectTypeOf(TaskPolicy.name).toEqualTypeOf<'task'>();` |
| 95 | src/domain/policy/policy-def.test.ts:38 | pos | литеральные типы правил сохраняются; совместим с AnyPolicyDef | `expectTypeOf(TaskPolicy).toExtend<AnyPolicyDef>();` |
| 96 | src/domain/policy/policy.test.ts:54 | expect-error | вид вызывающего правило не знает: принимает субъекта, а не Caller (тип) | `// @ts-expect-error Caller — не субъект правила (D-43, Р2) ⏎ isOwner.evaluate(new UserCaller(user('u1')), ctx);` |
| 97 | src/domain/policy/policy.test.ts:123 | expect-error | субъект композиции — пересечение субъектов правил (тип) | `// @ts-expect-error у субъекта нет id, нужного isOwner ⏎ both.evaluate(roleOnly, ctx);` |
| 98 | src/domain/policy/policy.test.ts:129 | expect-error | контекст композиции — объединение контекстов правил (тип) | `// @ts-expect-error нет ownerId ⏎ both.evaluate(user('u1'), {});` |
| 99 | src/domain/policy/rule.test.ts:112 | expect-error | субъект композиции — пересечение субъектов правил (тип) | `// @ts-expect-error у субъекта нет id, нужного isOwner ⏎ both.evaluate(roleOnly, ctx);` |
| 100 | src/domain/policy/rule.test.ts:114 | expect-error | субъект композиции — пересечение субъектов правил (тип) | `// @ts-expect-error нет ownerId в контексте ⏎ both.evaluate(user('u1'), {});` |
| 101 | src/domain/policy/rule.test.ts:121 | expect-error | anyOf: субъект и контекст — тоже пересечения (тип) | `// @ts-expect-error у субъекта нет id, нужного isOwner ⏎ canEdit.evaluate(roleOnly, ctx);` |
| 102 | src/domain/policy/rule.test.ts:123 | expect-error | anyOf: субъект и контекст — тоже пересечения (тип) | `// @ts-expect-error нет ownerId в контексте ⏎ canEdit.evaluate(user('u1'), {});` |
| 103 | src/domain/policy/rule.test.ts:128 | expect-error | evaluate строго контравариантен по субъекту (тип) | `// @ts-expect-error чужой субъект ⏎ isOwner.evaluate({ name: 'x' }, ctx);` |
| 104 | src/domain/rules/domain-rule-def.define.test.ts:65 | pos | контекст правила выводится из check | `expectTypeOf< ⏎ DomainRuleContextOf<typeof hasRoom> ⏎ >().toEqualTypeOf<ShelfCtx>();` |
| 105 | src/domain/rules/domain-rule-def.define.test.ts:81 | expect-error | ошибка чужого ErrorDef не компилируется (DOM-16) | `// @ts-expect-error: OTHER_FAILED — не ошибка из 'error' правила ⏎ check: () => OtherErrors.FAILED.err(),` |
| 106 | src/domain/rules/domain-rule-def.test.ts:57 | pos | контекст выводится из check; совместим с AnyDomainRule | `expectTypeOf< ⏎ DomainRuleContextOf<typeof hasRoom> ⏎ >().toEqualTypeOf<ShelfCtx>();` |
| 107 | src/domain/rules/domain-rule-def.test.ts:60 | pos | контекст выводится из check; совместим с AnyDomainRule | `expectTypeOf(hasRoom).toExtend<AnyDomainRule>();` |
| 108 | src/domain/rules/domain-rule-def.test.ts:69 | expect-error | check возвращает только свою ошибку (DOM-16) | `// @ts-expect-error OTHER_FAILED — не ошибка из 'error' правила ⏎ check: () => OtherErrors.FAILED.err(),` |
| 109 | src/domain/rules/domain-rule-def.test.ts:76 | expect-error | check контравариантен: правило с чужим контекстом не подходит | `// @ts-expect-error контекст правила — ShelfCtx, а не Other ⏎ const wrong: DomainRuleDef<Other, typeof ShelfErrors.FULL> = hasRoom;` |
| 110 | src/domain/rules/domain-rule-def.test.ts:101 | pos | экземпляр вида с правилами по ссылке | `expectTypeOf(ShelfRules.rules.hasRoom).toEqualTypeOf<typeof hasRoom>();` |
| 111 | src/domain/rules/domain-rule-def.test.ts:102 | pos | экземпляр вида с правилами по ссылке | `expectTypeOf(ShelfRules).toExtend<AnyRulesDef>();` |
| 112 | src/kernel/caller/caller.test.ts:114 | expect-error | человек по типу — не SystemCaller | `// @ts-expect-error системный вызывающий не бывает исходным человеком ⏎ const _person: PersonCaller<User> = new SystemCaller<User>(erRef);` |
| 113 | src/kernel/caller/caller.test.ts:147 | expect-error | CallerKind — четыре вида, module нет | `// @ts-expect-error вызывающего module больше нет (D-43) ⏎ const _module: CallerKind = 'module';` |
| 114 | src/kernel/def/def.test.ts:48 | pos | тексты из спеки, литерал имени сохраняется | `expectTypeOf(note.name).toEqualTypeOf<'draft'>();` |
| 115 | src/kernel/def/def.test.ts:84 | pos | структурная типизация: нет private/# | `expectTypeOf<PublicShape>().toExtend<NoteDef>();` |
| 116 | src/kernel/errors/core-errors.test.ts:35 | expect-error | UNAUTHORIZED несёт только вид вызывающего (D-43, Р7) | `// @ts-expect-error 'calls' проверяет тип — 'from' в отказе не нужен ⏎ from: 'notes.notifyTodo',` |
| 117 | src/kernel/errors/core-errors.test.ts:54 | expect-error | REQUEST_CONFLICT несёт requestId и причину (D-56) | `// @ts-expect-error причина — только input или in_progress ⏎ CoreErrors.REQUEST_CONFLICT.make({ requestId: 'r-1', reason: 'other' });` |
| 118 | src/kernel/errors/error-def.define.test.ts:50 | expect-error | make() строит ошибку с типизированным payload | `// @ts-expect-error payload не по схеме ⏎ TodoErrors.NOT_FOUND.make({ id: 1 });` |
| 119 | src/kernel/errors/error-def.define.test.ts:56 | expect-error | без схемы payload make() не принимает аргументов | `// @ts-expect-error payload не объявлен ⏎ TodoErrors.ALREADY_DONE.make({ x: 1 });` |
| 120 | src/kernel/errors/error-def.define.test.ts:75 | expect-error | kind — закрытый набор | `// @ts-expect-error неизвестный kind ⏎ BAD: { kind: 'oops', label: 'л', description: 'о' },` |
| 121 | src/kernel/errors/error-def.define.test.ts:82 | expect-error | label и description обязательны | `// @ts-expect-error нет description ⏎ BAD: { kind: 'conflict', label: 'л' },` |
| 122 | src/kernel/errors/error-def.test.ts:27 | pos | define — группа Def-классов, код = префикс + ключ | `expectTypeOf(def.code).toEqualTypeOf<'TODO_NOT_FOUND'>();` |
| 123 | src/kernel/errors/error-def.test.ts:54 | pos | типы make/err: payload по схеме, литералы code и kind | `expectTypeOf(e.code).toEqualTypeOf<'TODO_NOT_FOUND'>();` |
| 124 | src/kernel/errors/error-def.test.ts:55 | pos | типы make/err: payload по схеме, литералы code и kind | `expectTypeOf(e.kind).toEqualTypeOf<'not_found'>();` |
| 125 | src/kernel/errors/error-def.test.ts:56 | pos | типы make/err: payload по схеме, литералы code и kind | `expectTypeOf(e.payload).toEqualTypeOf<{ todoId: string }>();` |
| 126 | src/kernel/errors/error-def.test.ts:57 | expect-error | типы make/err: payload по схеме, литералы code и kind | `// @ts-expect-error схема объявлена — payload обязателен ⏎ TodoErrors.NOT_FOUND.make();` |
| 127 | src/kernel/errors/error-def.test.ts:59 | expect-error | типы make/err: payload по схеме, литералы code и kind | `// @ts-expect-error payload не по схеме ⏎ TodoErrors.NOT_FOUND.err({ id: 1 });` |
| 128 | src/kernel/errors/error-def.test.ts:61 | expect-error | типы make/err: payload по схеме, литералы code и kind | `// @ts-expect-error схемы нет — payload не принимается ⏎ TodoErrors.ALREADY_DONE.err({ x: 1 });` |
| 129 | src/kernel/errors/error-def.test.ts:88 | pos | конкретный Def совместим с AnyErrorDef | `expectTypeOf(TodoErrors.NOT_FOUND).toExtend<AnyErrorDef>();` |
| 130 | src/kernel/errors/error-def.test.ts:89 | pos | конкретный Def совместим с AnyErrorDef | `expectTypeOf(TodoErrors.ALREADY_DONE).toExtend<AnyErrorDef>();` |
| 131 | src/kernel/fields/fields.test.ts:90 | pos | тип — number \| undefined, описание из метки | `expectTypeOf<v.InferOutput<typeof schema>>().toEqualTypeOf<{ ⏎ expectedVersion?: number \| undefined;` |
| 132 | src/testing/example/app/todo/todo.facade.test.ts:124 | expect-error |  | `// @ts-expect-error getTask нет в calls UC sneaky ⏎ await this.call(GetTaskUcDef, input, caller, trace);` |
| 133 | src/testing/expect-result.test.ts:32 | expect-error | не принимает код вне union ошибок | `// @ts-expect-error код не объявлен в Failure ⏎ expect(() => expectErr(failed, 'C_FAILED')).toThrow();` |
| 134 | src/testing/stub-facade.test.ts:75 | expect-error | у UC нет system в callers — ответ не задаётся (ошибка типа) | `// @ts-expect-error createTask не вызывается системой ⏎ todo.answer(CreateTaskUcDef, () => ok({ taskId: TASK }));` |
| 135 | src/testing/stub-facade.test.ts:83 | expect-error | UC другого модуля — ошибка типа | `// @ts-expect-error removeUser не из модуля todo ⏎ todo.answer(RemoveUserUcDef, () => ok({}));` |
