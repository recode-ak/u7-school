# Таблица инвентаризации тестов типов `dmg-core` (Б-17)

Всего случаев: **135** (72 `@ts-expect-error`, 63 позитивных) — по `inventory/list.md`.
Пакет: `~/dev/tools/dmg/dmg-core`; вердикты — по `inventory/rules.md`.
Пути и строки — от корня пакета. «Использование» — место рабочего кода (`src/` вне `*.test.ts`), где тот же вывод проверяется `tsc`;
`нет` — потребителя нет. Для негативных — «—».

| # | файл:строка | вид | гарантия | использование | вердикт | причина |
|---|---|---|---|---|---|---|
| 1 | src/app/api-app/api-app.test.ts:271 | негативный | команда UC чужого модуля не принимается dispatch другого модуля | — | оставить | гарантия (4): единственный страж адресации команды по Def модуля |
| 2 | src/app/client/module-api.test.ts:86 | позитивный | dispatch возвращает Result по Def команды | src/app/client/module-api.ts:50 | удалить | сигнатура dispatch объявляет ровно этот тип — тавтология (TST-08 п.3) |
| 3 | src/app/client/module-api.test.ts:94 | негативный | UC чужого модуля не принимается dispatch | — | оставить | гарантия (4) |
| 4 | src/app/client/module-api.test.ts:161 | позитивный | restore возвращает Result по Def команды | src/app/client/module-api.ts:68 | удалить | тавтология с сигнатурой restore (TST-08 п.3) |
| 5 | src/app/facade/module-facade.test.ts:80 | негативный | UC без system в callers не зовут через фасад | — | оставить | публичный запрет API, пояснение есть, ошибка одна |
| 6 | src/app/facade/module-facade.test.ts:82 | негативный | UC другого модуля не зовут через фасад | — | оставить | гарантия (4) |
| 7 | src/app/module/module-from-def.test.ts:151 | негативный | реализации UC не входят в публичный тип модуля | — | оставить | единственный страж скрытого useCases (в рантайме свойство есть) |
| 8 | src/app/module/module-from-def.test.ts:204 | негативный | команда UC чужого модуля не принимается dispatch | — | оставить | гарантия (4) |
| 9 | src/app/module/module-from-def.test.ts:273 | негативный | карта реализаций покрывает все UC модуля | — | оставить | полнота ModuleMap держится только компилятором |
| 10 | src/app/module/module-from-def.test.ts:282 | негативный | под именем UC — класс реализации своего Def | — | оставить | единственный страж соответствия ключа карты Def UC |
| 11 | src/app/module/module-from-def.test.ts:289 | негативный | в карте модуля нет фасада (D-42) | — | оставить | единственный страж формы ModuleMap |
| 12 | src/app/module/module-from-def.test.ts:299 | негативный | субъект приложения покрывает Policy UC | — | оставить | единственный страж Caller<U> по Policy |
| 13 | src/app/operation/operation-from-def.test.ts:166 | негативный | вызов UC вне calls UC запрещён | — | оставить | гарантия (1) |
| 14 | src/app/operation/operation-from-def.test.ts:225 | негативный | реакция не вызывает UC вне calls | — | оставить | гарантия (1) |
| 15 | src/app/operation/operation-from-def.test.ts:251 | негативный | Job не вызывает UC вне calls | — | оставить | гарантия (1) |
| 16 | src/app/operation/operation-from-def.test.ts:316 | негативный | доменная ошибка чужого UC не входит в errors | — | оставить | гарантия (2) |
| 17 | src/app/use-case/use-case-from-def.test.ts:566 | негативный | execute не возвращает незаявленную ошибку (ERR-02) | — | оставить | гарантия (2) |
| 18 | src/app/use-case/use-case-from-def.test.ts:576 | негативный | загруженный контекст подходит Policy | — | оставить | ограничение L extends UseCaseContextOf<D> иначе ничем не держится |
| 19 | src/app/use-case/use-case-from-def.test.ts:578 | позитивный | тип с чужим контекстом не вырождается в never | нет | оставить | подпорка строки 18: без неё псевдоним WrongCtx не используется; живёт и умирает вместе с 18 (приёмка Opus) |
| 20 | src/app/use-case/use-case-from-def.test.ts:661 | негативный | ошибка правила объявлена в errors UC | — | оставить | гарантия (2) |
| 21 | src/app/use-case/use-case-from-def.test.ts:698 | негативный | контекст load и fetch покрывает каждое правило (D-58) | — | оставить | D-58 иначе ничем не держится |
| 22 | src/domain/aggregate/aggregate-def.test.ts:70 | позитивный | без statuses переходов нет: TransitionOf = never | нет | оставить | запрет жизненного цикла без statuses иначе ничем не держится |
| 23 | src/domain/aggregate/aggregate-def.test.ts:71 | позитивный | TransitionOf — только объявленные переходы | src/domain/aggregate/aggregate.ts:160 | удалить | transition() ограничен TransitionOf<D>, TaskAr зовёт transition("complete") |
| 24 | src/domain/aggregate/aggregate-def.test.ts:94 | негативный | отказ объявлен для каждого статуса вне from | — | оставить | единственный страж RejectsOf в AggregateDef.define |
| 25 | src/domain/aggregate/aggregate-def.test.ts:128 | позитивный | Def агрегата совместим с AnyAggregateDef | src/testing/example/todo/todo.module.ts:18 | удалить | TaskArDef уже передаётся в слот AnyAggregateDef |
| 26 | src/domain/aggregate/aggregate-def.test.ts:129 | позитивный | Def без статусов совместим с AnyAggregateDef | src/testing/example/todo/todo.module.ts:18 | удалить | тот же слот aggregates проверяет tsc |
| 27 | src/domain/aggregate/aggregate.test.ts:206 | негативный | statuses покрывают все значения status состояния | — | оставить | единственный страж полноты statuses |
| 28 | src/domain/aggregate/aggregate.test.ts:223 | негативный | rejects объявлен для каждого статуса вне from | — | оценить: удалить | покрыто src/domain/aggregate/aggregate-def.test.ts:86 — тот же RejectsOf |
| 29 | src/domain/aggregate/aggregate.test.ts:284 | негативный | view() переопределённой формы: скрытое поле не в типе | — | оставить | единственный страж формы выхода view() |
| 30 | src/domain/aggregate/readonly-ar.test.ts:62 | негативный | мутирующий метод недоступен на ReadonlyAr | — | оставить | гарантия (3) |
| 31 | src/domain/aggregate/readonly-ar.test.ts:64 | негативный | снимок недоступен на ReadonlyAr | — | оставить | гарантия (3) |
| 32 | src/domain/aggregate/readonly-ar.test.ts:66 | негативный | выдача событий недоступна на ReadonlyAr | — | оставить | гарантия (3) |
| 33 | src/domain/aggregate/readonly-ar.test.ts:77 | рантайм-ветка | ReadonlyAr скрывает pin только типом, объект тот же | — | оценить: удалить | дубль: тип — readonly-ar.test.ts:62, рантайм — readonly-ar.test.ts:75 (toBeInstanceOf) |
| 34 | src/domain/aggregate/readonly-ar.test.ts:95 | негативный | readonly ждёт state своего агрегата | — | оставить | гарантия (3) |
| 35 | src/domain/contracts/command.test.ts:33 | позитивный | в CommandMeta только requestId (D-57) | нет | оставить | точный набор ключей wire-контракта иначе ничем не держится |
| 36 | src/domain/contracts/command.test.ts:59 | позитивный | commandOf возвращает Command<D> | src/app/facade/module-facade.ts:57 | удалить | возврат commandOf объявлен, фасад передаёт его в dispatch |
| 37 | src/domain/contracts/command.test.ts:69 | позитивный | command() от Def даёт Command<Def> | src/testing/example/runner/example-cli.ts:90 | удалить | команда уходит в dispatch с Command<D> (example-cli.ts:72) |
| 38 | src/domain/contracts/command.test.ts:70 | позитивный | DefOfCommand извлекает Def из команды | нет | оставить | DefOfCommand — публичный экспорт (src/index.ts:28) без потребителя в src; module-api.test.ts:94 его не проверяет (приёмка Opus) |
| 39 | src/domain/contracts/command.test.ts:74 | позитивный | uc — литерал имени Def | нет | удалить | тавтология с объявлением Command (command.ts:23) |
| 40 | src/domain/contracts/command.test.ts:75 | позитивный | input — InputOf<D> | нет | удалить | тавтология с объявлением Command (command.ts:24) |
| 41 | src/domain/contracts/command.test.ts:83 | позитивный | OutputOf по Def, извлечённому из команды | нет | удалить | тавтология: DefOfCommand возвращает тот же D (TST-08 п.3) |
| 42 | src/domain/contracts/command.test.ts:84 | позитивный | UseCaseErrorOf по Def, извлечённому из команды | нет | удалить | тавтология: тот же круговой вывод (TST-08 п.3) |
| 43 | src/domain/contracts/command.test.ts:88 | негативный | обязательное поле входа проверяет компилятор | — | оставить | публичный запрет: вход строится по схеме, иначе ничем не держится |
| 44 | src/domain/contracts/command.test.ts:90 | негативный | тип поля входа проверяет компилятор | — | оценить: удалить | покрыто src/domain/contracts/contracts.test.ts:63 — тот же InputOf по схеме |
| 45 | src/domain/contracts/command.test.ts:95 | позитивный | Def с командой совместим с AnyUseCaseDef | src/testing/example/todo/todo.module.ts:19 | удалить | реальные UC уже в слоте AnyUseCaseDef |
| 46 | src/domain/contracts/command.test.ts:96 | позитивный | Command<Complete> совместим с Command | src/app/client/module-api.ts:53 | удалить | command: Command<D> передаётся в send(command: Command) |
| 47 | src/domain/contracts/contracts.test.ts:47 | негативный | в calls только Def UC (MAN-07) | — | оставить | публичный запрет состава calls, иначе ничем не держится |
| 48 | src/domain/contracts/contracts.test.ts:57 | негативный | calls — только UC с system в callers | — | оценить: удалить | покрыто src/domain/contracts/use-case-def.test.ts:119 — тот же UseCaseDef.define и SystemCalls |
| 49 | src/domain/contracts/contracts.test.ts:70 | негативный | код ошибки вне errors UC не принимается | — | оставить | гарантия (2) |
| 50 | src/domain/contracts/contracts.test.ts:73 | негативный | InputOf не расширяется до any | — | оставить | вход по схеме иначе ничем не держится |
| 51 | src/domain/contracts/contracts.test.ts:79 | негативный | policy обязательна в спеке UC | — | оставить | обязательность поля иначе ничем не держится |
| 52 | src/domain/contracts/contracts.test.ts:91 | негативный | description обязателен в спеке UC | — | оставить | обязательность текста DefTexts иначе ничем не держится |
| 53 | src/domain/contracts/contracts.test.ts:103 | негативный | query не публикует события | — | оставить | публичный запрет UseCaseSpec |
| 54 | src/domain/contracts/contracts.test.ts:147 | негативный | ER: calls только UC с system в callers | — | оставить | своя точка — EventReactionDef.define (SystemCalls) |
| 55 | src/domain/contracts/contracts.test.ts:190 | негативный | Job: calls только UC с system в callers | — | оставить | своя точка — JobDef.define (SystemCalls) |
| 56 | src/domain/contracts/def-types.test.ts:16 | позитивный | calls — литеральный Def по ссылке | src/app/operation/operation-from-def.ts:34 | удалить | CallsOf<D> выводит UC из литерала calls (проверяет operation-from-def.test.ts:166) |
| 57 | src/domain/contracts/def-types.test.ts:19 | позитивный | policy — литеральный Rule по ссылке | src/app/use-case/use-case-from-def.ts:31 | удалить | UseCaseSubjectOf берёт субъект из D["policy"] |
| 58 | src/domain/contracts/def-types.test.ts:22 | позитивный | useCases модуля — литеральный union | src/app/api-app/api-app.ts:47 | удалить | dispatch ограничен M["useCases"][number] |
| 59 | src/domain/contracts/def-types.test.ts:25 | позитивный | InputOf выводится из схемы Def | src/app/facade/module-facade.ts:52 | оценить: удалить | покрыто src/domain/contracts/use-case-def.test.ts:57 — тот же InputOf в своём файле |
| 60 | src/domain/contracts/def-types.test.ts:31 | позитивный | Def UC совместим с AnyUseCaseDef | src/testing/example/todo/todo.module.ts:19 | удалить | реальные UC уже в слоте AnyUseCaseDef |
| 61 | src/domain/contracts/event-reaction-def.test.ts:52 | позитивный | необъявленные calls — пустой кортеж | нет | оценить: удалить | покрыто src/app/operation/operation-from-def.test.ts:386 — ER без calls не компилируется |
| 62 | src/domain/contracts/event-reaction-def.test.ts:57 | позитивный | calls — литеральный Def по ссылке | src/app/operation/operation-from-def.ts:34 | удалить | CallsOf<D> выводит UC из литерала calls |
| 63 | src/domain/contracts/event-reaction-def.test.ts:67 | негативный | ER: calls только UC с system в callers | — | оставить | своя точка — EventReactionDef.define |
| 64 | src/domain/contracts/event-reaction-def.test.ts:109 | позитивный | ReactionEventOf — union событий из on | src/app/reaction/reaction-from-def.ts:41 | удалить | react получает ReactionEnvelopeOf<D> с этим union |
| 65 | src/domain/contracts/event-reaction-def.test.ts:112 | негативный | событие вне on не подходит реакции | — | оставить | единственный страж ReactionEventOf |
| 66 | src/domain/contracts/event-reaction-def.test.ts:124 | позитивный | EventReactionDef структурный: нет private/# | src/testing/example/todo/todo.module.ts:26 | оставить | гарантия D-48: Def без private/#, Any*Def структурный; рабочий код внутри одной копии пакета добавленный #-член не заметит — держит только этот тест (приёмка Opus) |
| 67 | src/domain/contracts/job-def.test.ts:48 | позитивный | необъявленные calls — пустой кортеж | нет | оценить: удалить | покрыто src/app/operation/operation-from-def.test.ts:386 — Job без calls не компилируется |
| 68 | src/domain/contracts/job-def.test.ts:49 | позитивный | calls — литеральный Def по ссылке | src/app/operation/operation-from-def.ts:34 | удалить | CallsOf<D> выводит UC из литерала calls |
| 69 | src/domain/contracts/job-def.test.ts:59 | негативный | Job: calls только UC с system в callers | — | оставить | своя точка — JobDef.define |
| 70 | src/domain/contracts/job-def.test.ts:96 | позитивный | JobDef структурный: нет private/# | src/testing/example/todo/todo.module.ts:27 | оставить | гарантия D-48: Def без private/#, Any*Def структурный; рабочий код внутри одной копии пакета добавленный #-член не заметит — держит только этот тест (приёмка Opus) |
| 71 | src/domain/contracts/module-def.test.ts:56 | позитивный | useCases модуля — литеральный union | src/app/api-app/api-app.ts:47 | удалить | dispatch ограничен M["useCases"][number] |
| 72 | src/domain/contracts/module-def.test.ts:59 | позитивный | имя модуля — литерал | нет | оставить | литерал имени держит адрес модуля (D-49) иначе ничем не держится |
| 73 | src/domain/contracts/module-def.test.ts:109 | позитивный | ModuleDef структурный: нет private/# | src/testing/example/app/todo/todo.module.ts:35 | оставить | гарантия D-48: Def без private/#, Any*Def структурный; рабочий код внутри одной копии пакета добавленный #-член не заметит — держит только этот тест (приёмка Opus) |
| 74 | src/domain/contracts/operation-def.test.ts:74 | позитивный | имя операции — литерал | нет | оставить | литерал держит localId и title операции иначе ничем не держится |
| 75 | src/domain/contracts/operation-def.test.ts:80 | позитивный | необъявленные calls — пустой кортеж (база OperationDef) | нет | оценить: удалить | покрыто src/domain/contracts/use-case-def.test.ts:76 — тот же Declared на реальном классе |
| 76 | src/domain/contracts/operation-def.test.ts:90 | позитивный | объявленные calls — литеральный кортеж | src/app/operation/operation-from-def.ts:34 | удалить | CallsOf<D> выводит UC из литерала calls |
| 77 | src/domain/contracts/operation-def.test.ts:145 | позитивный | ScanDef структурный: нет private/# | нет | оставить | гарантия D-48: Def без private/#, Any*Def структурный; рабочий код внутри одной копии пакета добавленный #-член не заметит — держит только этот тест (приёмка Opus) |
| 78 | src/domain/contracts/use-case-def.result.test.ts:92 | позитивный | restoreResult возвращает Result по Def | src/domain/contracts/use-case-def.ts:114 | удалить | тавтология с сигнатурой restoreResult (TST-08 п.3) |
| 79 | src/domain/contracts/use-case-def.test.ts:64 | позитивный | type — литерал command | нет | оставить | дискриминант UseCaseSpec иначе ничем не держится |
| 80 | src/domain/contracts/use-case-def.test.ts:65 | позитивный | policy — литеральный Rule по ссылке | src/app/use-case/use-case-from-def.ts:31 | удалить | UseCaseSubjectOf берёт субъект из D["policy"] |
| 81 | src/domain/contracts/use-case-def.test.ts:68 | позитивный | calls — литеральный Def по ссылке | src/testing/example/app/todo/task/uc/assign-task.uc.ts:58 | удалить | CallsOf<AssignTaskUcDef> проверяет this.call(GetUserUcDef) |
| 82 | src/domain/contracts/use-case-def.test.ts:71 | позитивный | InputOf выводится из схемы Def | src/app/facade/module-facade.ts:52 | удалить | input: InputOf<D> у фасада, реализация читает поля входа |
| 83 | src/domain/contracts/use-case-def.test.ts:80 | позитивный | необъявленные rules, calls, emits — пустые кортежи | нет | оставить | Declared: пустые rules и emits иначе ничем не держатся |
| 84 | src/domain/contracts/use-case-def.test.ts:123 | негативный | UC: calls только UC с system в callers | — | оставить | своя точка — UseCaseDef.define |
| 85 | src/domain/contracts/use-case-def.test.ts:130 | негативный | query не публикует события | — | оценить: удалить | покрыто src/domain/contracts/contracts.test.ts:78 — тот же UseCaseDef.define |
| 86 | src/domain/contracts/use-case-def.test.ts:155 | позитивный | UseCaseDef структурный: нет private/# | src/testing/example/todo/todo.module.ts:19 | оставить | гарантия D-48: Def без private/#, Any*Def структурный; рабочий код внутри одной копии пакета добавленный #-член не заметит — держит только этот тест (приёмка Opus) |
| 87 | src/domain/events/event-def.define.test.ts:48 | негативный | payload события — по схеме Def | — | оставить | публичный запрет: payload из схемы, иначе ничем не держится |
| 88 | src/domain/events/event-def.define.test.ts:67 | негативный | префикс события вида module.aggregate | — | оставить | единственный страж формата FQN |
| 89 | src/domain/events/event-def.test.ts:22 | позитивный | имя события — литерал FQN | нет | оставить | литерал имени держит union-типы событий иначе ничем не держится |
| 90 | src/domain/events/event-def.test.ts:31 | позитивный | make() возвращает EventOf<Def> | src/testing/example/todo/task/task.ar.ts:106 | удалить | make() объявлен EventOf<D>, TaskAr эмитит completed |
| 91 | src/domain/events/event-def.test.ts:32 | негативный | payload не по схеме не принимается | — | оценить: удалить | покрыто src/domain/events/event-def.define.test.ts:40 — тот же make по схеме |
| 92 | src/domain/events/event-def.test.ts:52 | позитивный | событие совместимо с AnyEventDef | src/testing/example/todo/task/task.ar.ts:38 | удалить | events: TaskEvents принимает группу AnyEventDef |
| 93 | src/domain/policy/policy-def.test.ts:36 | позитивный | правило группы — та же ссылка и литеральный тип | src/testing/example/todo/task/uc/assign-task.uc.ts:25 | удалить | rules берёт TaskRules.rules.assigneeActive по ссылке |
| 94 | src/domain/policy/policy-def.test.ts:37 | позитивный | имя группы правил — литерал | нет | оставить | литерал имени держит адресацию группы иначе ничем не держится |
| 95 | src/domain/policy/policy-def.test.ts:38 | позитивный | группа правил совместима с AnyPolicyDef | нет | оставить | tsc-потребителя нет, структурная совместимость группы иначе ничем не держится |
| 96 | src/domain/policy/policy.test.ts:54 | негативный | правило принимает субъекта, а не Caller | — | оставить | публичная гарантия D-43, Р2 |
| 97 | src/domain/policy/policy.test.ts:123 | негативный | allOf: субъект — пересечение субъектов | — | оценить: удалить | покрыто src/domain/policy/rule.test.ts:109 — тот же allOf в файле своего модуля |
| 98 | src/domain/policy/policy.test.ts:129 | негативный | allOf: контекст — объединение контекстов | — | оценить: удалить | покрыто src/domain/policy/rule.test.ts:109 — тот же allOf |
| 99 | src/domain/policy/rule.test.ts:112 | негативный | allOf: субъект — пересечение субъектов | — | оставить | файл своего модуля; anyOf-тест его не покрывает |
| 100 | src/domain/policy/rule.test.ts:114 | негативный | allOf: контекст — объединение контекстов | — | оставить | вторая ошибка того же сценария, сужать нечего |
| 101 | src/domain/policy/rule.test.ts:121 | негативный | anyOf: субъект — пересечение субъектов | — | оставить | anyOf-ветка композиции, allOf её не покрывает |
| 102 | src/domain/policy/rule.test.ts:123 | негативный | anyOf: контекст — объединение контекстов | — | оставить | anyOf-ветка композиции |
| 103 | src/domain/policy/rule.test.ts:128 | негативный | evaluate контравариантен по субъекту | — | оставить | публичная гарантия Rule.evaluate |
| 104 | src/domain/rules/domain-rule-def.define.test.ts:65 | позитивный | контекст правила выводится из check | нет | оценить: удалить | покрыто src/domain/rules/domain-rule-def.test.ts:56 — тот же DomainRuleContextOf |
| 105 | src/domain/rules/domain-rule-def.define.test.ts:81 | негативный | ошибка чужого ErrorDef не компилируется (DOM-16) | — | оценить: удалить | покрыто src/domain/rules/domain-rule-def.test.ts:63 — тот же DOM-16 |
| 106 | src/domain/rules/domain-rule-def.test.ts:57 | позитивный | контекст правила выводится из check | src/app/use-case/use-case-from-def.ts:82 | удалить | L extends UseCaseContextOf<D> выводит контекст из правила |
| 107 | src/domain/rules/domain-rule-def.test.ts:60 | позитивный | правило совместимо с AnyDomainRule | src/testing/example/todo/task/uc/assign-task.uc.ts:26 | удалить | rules: [TaskRules.rules.assigneeActive] в слоте AnyDomainRule |
| 108 | src/domain/rules/domain-rule-def.test.ts:69 | негативный | check возвращает только свою ошибку (DOM-16) | — | оставить | публичная гарантия правила |
| 109 | src/domain/rules/domain-rule-def.test.ts:76 | негативный | правило с чужим контекстом не подходит | — | оставить | контравариантность DomainRuleDef |
| 110 | src/domain/rules/domain-rule-def.test.ts:101 | позитивный | правило группы — та же ссылка и литеральный тип | src/testing/example/todo/task/uc/assign-task.uc.ts:26 | удалить | ссылка на правило группы потребляется Def UC |
| 111 | src/domain/rules/domain-rule-def.test.ts:102 | позитивный | группа правил совместима с AnyRulesDef | нет | оставить | структурная совместимость группы иначе ничем не держится |
| 112 | src/kernel/caller/caller.test.ts:114 | негативный | SystemCaller не PersonCaller | — | оставить | публичная гарантия иерархии (D-43) |
| 113 | src/kernel/caller/caller.test.ts:147 | негативный | CallerKind — четыре вида, module нет | — | оставить | единственный страж состава CallerKind |
| 114 | src/kernel/def/def.test.ts:48 | позитивный | имя Def — литерал | нет | оставить | литерал имени базы Def иначе ничем не держится |
| 115 | src/kernel/def/def.test.ts:84 | позитивный | NoteDef структурный: нет private/# | нет | оставить | гарантия D-48: Def без private/#, Any*Def структурный; рабочий код внутри одной копии пакета добавленный #-член не заметит — держит только этот тест (приёмка Opus) |
| 116 | src/kernel/errors/core-errors.test.ts:35 | негативный | UNAUTHORIZED несёт только callerKind | — | оставить | единственный страж payload (D-43, Р7) |
| 117 | src/kernel/errors/core-errors.test.ts:54 | негативный | REQUEST_CONFLICT.reason — закрытый набор | — | оставить | единственный страж (D-56) |
| 118 | src/kernel/errors/error-def.define.test.ts:50 | негативный | payload ошибки — по схеме (make) | — | оставить | make и err — разные публичные методы со своими сигнатурами; err-тесты 127/128 make не держат (приёмка Opus) |
| 119 | src/kernel/errors/error-def.define.test.ts:56 | негативный | без схемы make() не принимает payload | — | оставить | то же: запрет аргумента у make без схемы, err его не держит (приёмка Opus) |
| 120 | src/kernel/errors/error-def.define.test.ts:75 | негативный | kind — закрытый набор | — | оставить | единственный страж ErrorKind |
| 121 | src/kernel/errors/error-def.define.test.ts:82 | негативный | description обязателен у ошибки | — | оставить | обязательность текста DefTexts у ошибки |
| 122 | src/kernel/errors/error-def.test.ts:27 | позитивный | код ошибки — литерал | нет | оценить: удалить | покрыто src/domain/contracts/contracts.test.ts:63 — при расширении кода маркер :70 станет неиспользуемым |
| 123 | src/kernel/errors/error-def.test.ts:54 | позитивный | код значения ошибки — литерал | нет | удалить | дубль строки 122 в том же файле |
| 124 | src/kernel/errors/error-def.test.ts:55 | позитивный | kind значения ошибки — литерал | нет | оставить | литерал kind держит ErrorKind иначе ничем не держится |
| 125 | src/kernel/errors/error-def.test.ts:56 | позитивный | payload значения — по схеме | нет | оставить | payload из схемы иначе ничем не держится |
| 126 | src/kernel/errors/error-def.test.ts:57 | негативный | payload обязателен, если схема объявлена | — | оставить | единственный страж обязательности |
| 127 | src/kernel/errors/error-def.test.ts:59 | негативный | payload err() — по схеме | — | оставить | публичная гарантия err(), дубль 118 удаляется |
| 128 | src/kernel/errors/error-def.test.ts:61 | негативный | без схемы payload не принимается | — | оставить | публичная гарантия err(), дубль 119 удаляется |
| 129 | src/kernel/errors/error-def.test.ts:88 | позитивный | Def ошибки совместим с AnyErrorDef | src/testing/example/todo/task/task.ar.ts:39 | удалить | errors: TaskErrors в слоте AnyErrorDef |
| 130 | src/kernel/errors/error-def.test.ts:89 | позитивный | ошибка без схемы совместима с AnyErrorDef | src/testing/example/todo/task/task.ar.ts:39 | удалить | тот же слот (ALREADY_DONE в TaskErrors) |
| 131 | src/kernel/fields/fields.test.ts:90 | позитивный | опциональное поле — number или undefined | src/testing/example/app/todo/task/uc/complete-task.uc.ts:31 | удалить | execute читает expectedVersion как необязательный |
| 132 | src/testing/example/app/todo/todo.facade.test.ts:124 | негативный | вызов UC вне calls в эталонном модуле | — | оценить: удалить | TST-09: учебный модуль не тестирует поведение платформы; гарантию (1) держит operation-from-def.test.ts:166. Удалить it :177 целиком и класс Sneaky/его Def, если станут неиспользуемыми (приёмка Opus) |
| 133 | src/testing/expect-result.test.ts:32 | рантайм-ветка | expectErr не принимает код вне union ошибок | — | оставить | expectErr — публичный API dmg-core/testing; сужение кода до union держит только этот маркер (приёмка Opus) |
| 134 | src/testing/stub-facade.test.ts:75 | негативный | StubFacade отвечает только на UC с system | — | оставить | свой API (answer), ModuleFacade его не покрывает |
| 135 | src/testing/stub-facade.test.ts:83 | негативный | StubFacade: UC чужого модуля | — | оставить | гарантия (4) |

## Четыре гарантии из `rules.md`

1. **Вызов Def вне `calls`** — строки 13, 14, 15, 132. Все «оставить»: три вида операции (UC, ER, Job) плюс эталонный модуль.
2. **Ошибка вне Meta (`errors` Def)** — строки 16, 17, 20, 49, 105, 108. Дубль к удалению — 105; гарантию держат 16, 17, 20, 49, 108.
3. **Мутация `ReadonlyAr`/`state`** — строки 30, 31, 32, 33, 34. Рантайм-ветка 33 — дубль к удалению; запрет держат 30, 31, 32, 34.
4. **Команда чужого модуля** — строки 1, 3, 6, 8, 135. Все «оставить»: три точки входа (ApiApp, ModuleApi, ModuleFacade, ModuleFromDef) плюс StubFacade.

## Итог (после приёмки Opus)

- **оставить** — 83
- **удалить** — 36
- **оценить: удалить** — 16

`сузить` — 0: все 72 `@ts-expect-error` с пояснением; в копии пакета маркеры сняты, `tsc` дал ровно 72 ошибки — по одной в строке под каждым маркером, посторонних нет (2026-11-11).

После применения «удалить» и «оценить: удалить» пустыми станут эти `it` (удаляются целиком; список flash, поправленный приёмкой):

- `src/app/client/module-api.test.ts:79` it 'ответ типизирован по Def команды'
- `src/app/client/module-api.test.ts:158` it 'восстановленный Result типизирован по Def команды'
- `src/domain/aggregate/aggregate-def.test.ts:127` it 'конкретный Def совместим с AnyAggregateDef'
- `src/domain/aggregate/aggregate.test.ts:215` it 'переход объявляет отказ для каждого статуса вне from' (остаётся только `expect(true)`)
- `src/domain/contracts/command.test.ts:57` it 'тип команды — по Def аргумента'
- `src/domain/contracts/command.test.ts:73` it 'uc — литерал имени, input — InputOf'
- `src/domain/contracts/command.test.ts:81` it 'по команде выводятся OutputOf и UseCaseErrorOf Def'
- `src/domain/contracts/command.test.ts:94` it 'Def с командой по-прежнему совместим с AnyUseCaseDef'
- `src/domain/contracts/def-types.test.ts:15` it 'литеральные типы calls, policy, useCases, InputOf'
- `src/domain/contracts/def-types.test.ts:30` it 'конкретный Def совместим с Any*Def'
- `src/domain/contracts/use-case-def.result.test.ts:89` it 'восстановленный Result типизирован по Def'
- `src/domain/rules/domain-rule-def.define.test.ts:64` it 'контекст правила выводится из check'
- `src/domain/rules/domain-rule-def.test.ts:56` it 'контекст выводится из check; совместим с AnyDomainRule'
- `src/testing/example/app/todo/todo.facade.test.ts:177` it 'UC нет в calls потребителя — ошибка типа'
- остальные `it`, где остаётся только рантайм-проверка (например, `domain-rule-def.define.test.ts:76` — `expect(foreign).toBeDefined()`), — проверить при применении: рантайм-строка, ставшая тавтологией, уходит вместе с маркером.

## Приёмка (Opus, 2026-11-11)

Принято с правками 12 строк:

- **Структурная типизация (66, 70, 73, 77, 86, 115) — оставить.** Flash ссылался на «реальные Def уже в слоте Any*Def», но слот `Any*Def` структурный и добавленный `#`-член не заметит. Гарантию D-48 держат только эти тесты.
- **38 `DefOfCommand`, 133 `expectErr`** — публичный API без другого стража.
- **118, 119** — `make` и `err` объявлены отдельно, это не дубли 127/128.
- **19** — неотделим от 18.
- **132** — согласен с удалением, но по TST-09 (учебный модуль — образец кода модуля, а не тест платформы).

Остальные вердикты сверены с §2 выборочно по каждой группе: дубли негативов между `*.define.test.ts` и `*.test.ts` (28, 85, 91, 97, 98, 104, 105) и тавтологии сигнатур (2, 4, 39–42, 78) — подтверждены. Позитивы вывода, которые «использует рабочий код», ловят поломку вывода, но не расширение до `any`; расширение держат оставленные негативы (43, 49, 50, 65, 87 и др.).
