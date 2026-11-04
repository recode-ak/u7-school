# Бриф среза: `questionnaire` / `questionnaire` (Ф1 + задел Ф2)

Черновик — `dmg-tech-lead`, Ф0; проверка — orchestrator. Читать вместе с `../spec.md`, `../plan.md` (Ф1–Ф2), TR-46, TR-47, D-63, эталоном `wish` и брифами `conductor/archive/stream-dmg_20261103/slices/{stream,student}.md`.

Код анкеты в `v0.2.6` (worktree `../u7-school-v0.2.6`, пакет анкет) совпадает с HEAD с точностью до импортов и `biome-ignore`. Проверено `diff` для `a-root.ts` и `sweep-abandoned-job.ts`. Характеризация строится на текущих тестах как ожиданиях нового кода.

> **Статус:** принят orchestrator'ом (2026-11-04). С1, С2, Т1 решены Нурболатом по рекомендациям, Т2–Т20 — по рекомендациям; всё — TR-48.

## Расхождения spec/plan с кодом

1. **Job требует снять `external` в Ф1, а не в Ф3.**
   - У внешнего модуля ER и Job не объявляются (MAN-06): `dmg-core/src/arch/def-checker.ts:152-155`. Сейчас `QuestionnaireModuleDef.external = true` (`domain/src/questionnaire/questionnaire.module.ts:16`).
   - Следствия снятия `external` в Ф1 (по student-брифу, расхождение 1 и Т1):
     - В проверки попадает весь `domain/src/questionnaire`. `checkContractImports` (`scripts/domain-check.ts:170-190`) запрещает чужой `index`. Это `facade.ts:1`, `module.ts:3,5`, `policy.ts:1`, `questionnaire-uc.ts`.
     - `AssemblyChecker` и `file-checker.ts:74,119` включают ARC-07/08 и MAN-10 (пары домен ↔ прикладной слой). Раннеры и корень сборки больше не могут импортировать `@u7-scl/questionnaire/{domain,api,infra}`. Сейчас так делают `render.ts:14`, `fill.story.ts:19`, `invite.story.ts:10`, `u7-app.ts:40-45`, `u7-app-meta.ts:4`, `u7-app.types.ts:3`.
   - Ф3 по plan («`QuestionnaireModuleDef` без `external`») сжимается до ARC-07 `biome.json`, скриптов, миров и `test-app`. Это вопрос С1.
2. **`platform/app/src/u7-app.ts` входит в границы Ф1, а не Ф3.**
   - Новый модуль требует репозитория вместо `legacy`: `u7-app.ts:145-165,288-291`.
   - Удаление `questionnaireLegacyInbound` требует правки `u7-app.ts:38,243`.
   - Legacy `QuestionnaireApiModule` нельзя оставлять в `ApiApp` (`u7-app.ts:159-161,197`):
     - его Job `SweepAbandonedJob` пошёл бы параллельно с Job на Def;
     - его UC читали бы `questionnaires.json` схемой с `v.isoDateTime` и пропускали бы записи нового формата.
   - Поэтому в `U7App` исчезают `questionnaireModule`, `questionnaireFacade` (`:83,213`) и `U7LegacyFacades.questionnaire` (`u7-app.types.ts:37`). Тест `u7-app.test.ts:132` (`expect(app.questionnaireFacade).toBeDefined()`) меняется на `expect(app.apiApp.getModule('questionnaire')).toBeUndefined()` по образцу `stream`.
3. **Адрес через `GetTelegramAddressesUcDef` из story недоступен.**
   - spec Q3 и D-63 ссылаются на `inactivity` студента как на пример. Но `InactivityStory` берёт `telegramId` через legacy `get-user` (`inactivity.story.ts:48-53,84`, TR-43 С2).
   - У `GetTelegramAddressesUcDef` `callers: ['system']` (`domain/src/user/user/uc/get-telegram-addresses.uc.ts:21`). Story диспатчит UC как `user`/`guest` (`u7-bot-ui-story.ts:166-185`).
   - В Ф1 адрес не нужен: события без `telegramId`, Job доменный. Вопрос С2 решается до брифа Ф2.
4. **`StartQuestionnaireUcDef` уже существует, значит 9 UC = 8 новых + существующий.**
   - `start` (legacy) ≡ существующий `startQuestionnaire` (`domain/.../uc/start-questionnaire.uc.ts:21`). Имя и FQN — контракт `wish`, они сохраняются.
   - Минимальные `QuestionnaireArDef` (`questionnaire.ar.ts`) и `QuestionnaireEvents` (3 события из 6, `questionnaire.events.ts:19-48`) расширяются, а не создаются.
   - `QuestionnaireRespondentPolicy` назван так только потому, что `QuestionnairePolicy` занят legacy (`questionnaire-respondent.policy.ts:15-19`). После удаления legacy-объекта политика получает имя `QuestionnairePolicy`.
5. **Красная зона короче, чем в plan.**
   - Story-тесты с `executeMock` (`fill.dialog.test`, `fill.story.warning.test`, `fill.story.continue-invite.test`, `invite.dialog.test`, `inventory.test`) не поднимают `U7App` и кормят story готовые legacy-события. В Ф1 при нетронутом рантайме stories они остаются зелёными.
   - Красными по анализу кода будут два e2e (поимённо в разделе «Красная зона»). Окончательный список даёт прогон.
6. **Типы stories ломают `tsc` и `arch:check` в Ф1 даже без смены рантайма.**
   - Stories импортируют типы из `@u7-scl/questionnaire/domain`: `QuestionnaireStartEvent` и аналоги (`fill.story.ts:14-19`, `invite.story.ts:10`), `Question`/`QuestionnaireActionResponse` (`render.ts:11-14`).
   - Legacy-события удаляются вместе с `a-root`, а ARC-08 запрещает импорт прикладного пакета. Нужна правка только типовых импортов в Ф1 (Т16).
7. **Legacy `decline`/`likert-*` в `inbound` не входили.**
   - В `legacy-inbound.ts:14-30` только `complete` и `abandon`.
   - После слияния (Q1) ER `abandonWish` и `confirmWish` получают также `declined`, события likert и `reason: 'declined'`. Фильтр — формат `ownerInfo` в `WishAr.questionnaireTarget` (`wish.ar.ts:225-229`). Это новое наблюдаемое поведение; оно безопасно, потому что `wish` запускает анкету сразу (в `invited` она не бывает). Т4, тест обязателен.
8. **Фикстура `data/fixtures/questionnaires/questionnaires.json` = `[]`** (2 байта), `responses.json` = `[]`. Совпадает со spec, `dmg-data-keeper` строит собственные фикстуры в `mkdtemp`.
9. **`getActive()` не используется в production.** Единственные вхождения — интерфейс и реализация (`questionnaire-json-repo.ts:42`, `repo.ts:46`). Метод и тест `questionnaire-repo-active.test.ts` не переносятся (Т18).
10. **Смена имени Job меняет ключ `data/jobs/last-runs.json`.** С `sweep-abandoned-questionnaires` на `sweepAbandonedQuestionnaires`, как у `inactivity-sweep` (student-бриф, расхождение 12). Поведение первого запуска (misfire) проверяет `dmg-data-keeper`.

## Границы

**Домен `domain/src/questionnaire`:**
- Новое и изменённое:
  - `questionnaire/{questionnaire.state,questionnaire.ar,questionnaire.errors,questionnaire.events,questionnaire.policy,questionnaire.types,questionnaire-screen}.ts`;
  - `questionnaire/uc/*.uc.ts` (9);
  - `questionnaire/job/sweep-abandoned-questionnaires.job.ts`;
  - `questionnaire.module.ts`, `contract.ts`, `index.ts`, `state.ts`.
- Остаются без смены логики:
  - `questionnaire-engine.ts` (только импорт `Answer`);
  - `question.ts`;
  - `likert/likert-question.ts` (добавляются `description`).
- Удаляются: `a-root.ts`, `standard/*`, `likert/{likert-questionnaire,likert-questionnaire-ar}.ts`, `questionnaire-factory.ts`, `events.ts`, `errors.ts`, `repo.ts`, `policy.ts` (legacy), `questionnaire-respondent.policy.ts`, `facade.ts`, `uc/` старый тест.
- «Оболочка» до Ф3 (Т15): `module.ts` (только метатипы), `questionnaire/commands/*-cmd.ts` (9 метатипов) и `commands/errors.ts`, `entity.ts`. Назначение — только типы для `U7BotAppMeta`, миров и stories до Ф2. `ArMeta` из `entity.ts` убрать.

**Прикладной слой `modules/questionnaire/src`:**
- Новое:
  - `questionnaire.module.ts`;
  - `questionnaire/{questionnaire.repo.ts,questionnaire.repo.fake.ts}`;
  - `questionnaire/uc/*.uc.ts` (9) и тесты;
  - `questionnaire/job/sweep-abandoned-questionnaires.job.ts`;
  - `infra/questionnaire.json-repo.ts` и тест;
  - `index.ts`, `infra/index.ts`.
- Удаляются: весь `api/**` (UC, Job, `module.ts`, тесты), `infra/questionnaire-in-proc-facade.ts`, `infra/db/*`, `legacy-inbound.ts` и тест.
- `src/domain/index.ts` (barrel DEBT-3) остаётся.

**Вне пакета (Ф1):**
- `modules/wish/src/wish/{uc/create-course-wish.uc.ts,er/confirm-wish.er.ts,er/abandon-wish.er.ts}` и тесты. Раздел «Клиенты `wish`».
- `domain/src/wish/wish/er/{confirm,abandon}-wish.er.test.ts` (payload событий) и комментарии `wish.ar.ts:134,144,221-225`. Собственное поле `WishQuestionnaire.owner` не трогается.
- `platform/app/src/{u7-app.ts,u7-app.types.ts,u7-app-meta.ts}`, `platform/app/tests/u7-app.test.ts`.
- `runners/u7-bot/src/controllers/questionnaire/stories/{render,fill.story,invite.story}.ts` — только типовые импорты (Т16).
- `conductor/architecture/debt.md` — запись красной зоны и сужение globs (orchestrator).

**Не трогать:**
- `data/`; логику и рантайм stories (подписки, вызовы `appApi.execute`) — Ф2.
- `runners/u7-bot/tests/worlds/*`, `scripts/{call-uc,domain-arch}.ts`, `biome.json` ARC-07, `tsconfig.json` paths, `modules/questionnaire/package.json` — Ф3.
- Контракты `user`, `course`, `stream`; `dmg-core` (правка не требуется, раздел «Проверка variant-state»); `ui-spec.md`.

## Решения брифа

**Р1. Один `QuestionnaireArDef`, state — `v.variant('kind')` (TR-47 Т1).**
- Общие поля вынести в объект `QuestionnaireBaseFields` и разложить в обе ветки: `...BaseEntityFields`, `respondentId: F.uuid`, `status`, `currentQuestionCode: nullable`, `draftAnswers: record`, `answers: array(AnswerVo)`, `ownerInfo: record`, `warnedAt?`, `continueInvitedAt?`, `completedAt: nullable(F.timestamp)`, `abandonReason?`.
- Ветки различаются дискриминатором `kind` (`'standard'` / `'likert'`) и `questionPool`: `QuestionnairePoolSchema` / `LikertQuestionPoolSchema`.
- Единый `AnswerVo` для обеих веток. Likert-запись не несёт `answerText`, а `v.object` лишние ключи отбрасывает, так что наблюдаемого отличия нет.
- Даты — `F.timestamp` (читает ISO и число, пишет число): `createdAt`/`updatedAt` из `BaseEntityFields`, `answeredAt`, `completedAt`, `warnedAt`, `continueInvitedAt`. `null` в `currentQuestionCode` и `completedAt` остаётся: формат на диске не меняется.
- `ownerInfo` — единственное имя во всех слоях (Q2). Legacy-запись без `updatedAt` читается как `updatedAt = createdAt`, без `version` — как `0` (D-36).

**Р2. `QuestionnaireArDef`** (MAN-12).
- Статусы: `invited | in_progress | completed | abandoned`.
- Переходы:

  | Переход | from → to | Отказы |
  |---|---|---|
  | `start` | `invited` → `in_progress` | `NOT_INVITED` для остальных |
  | `decline` | `invited` → `abandoned` | `NOT_INVITED` |
  | `abandon` | `invited`, `in_progress` → `abandoned` | `completed`: `NOT_ACTIVE`; `abandoned`: `NOT_ACTIVE` (в Def обязателен типом `RejectsComplete`, недостижим из Ar, см. Т3) |
  | `complete` | `in_progress` → `completed` | `NOT_IN_PROGRESS` для остальных |

- События, не меняющие статус (`markWarned`, `markContinueInvited`, переключение черновика, ответ без завершения), идут через `change`.

**Р3. Ошибки** — группа `QUESTIONNAIRE` (`questionnaire.errors.ts`, ERR-04). `label` — прежние тексты legacy-исключений.

| Код | kind | label (прежний текст) | payload |
|---|---|---|---|
| `NOT_FOUND` | not_found | Анкета не найдена | `{ questionnaireId }` |
| `NOT_INVITED` | conflict | Анкета не в статусе invited, невозможно запустить или отказаться | — |
| `NOT_IN_PROGRESS` | conflict | Анкета уже завершена | — |
| `NOT_ACTIVE` | conflict | Анкета не активна | — |
| `CHOICE_EXPECTED` | validation | Ожидался ответ с выбором (нажатием кнопки) | — |
| `EMPTY_ANSWER_CODE` | validation | Код ответа не может быть пустым | — |

- Разделение `NOT_INVITED` на тексты «не может быть запущена» и «невозможно отказаться» — решение `dmg-test-designer` (фиксируется один `label` или два кода; рекомендация — один код, текст общий).
- «Вопрос не найден в пуле», `throwInternal` (нет `currentQuestionCode`, неизвестный тип вопроса) и `abandoned` без `abandonReason` — нарушение инварианта хранилища, не штатный отказ. Это `throw` в конструкторе/`restore` (прецедент `ReviewCampaignAr` + `v.parse`), а не `Err`.
- Устаревший ответ (`stale_answer`) — не ошибка, а вариант ответа экрана.

**Р4. Policy** (`questionnaire.policy.ts`, DOM-05/15, TR-11, DEBT-32).
- Субъект — `Pick<User, 'uuid' | 'roles'>` из `@u7-scl/domain/user/contract`, `Role` оттуда же (как `StreamPolicy`).
- Правила:

  | Правило | Что проверяет | Где используется |
  |---|---|---|
  | `hasRespondent` | перенос существующего; без субъекта `Rule.of` сам отказывает, `check: () => true` | `startQuestionnaire`, `sendLikertInvite` |
  | `isRespondent` | `ctx.questionnaire.isOf(subject.uuid)` | основа `canAccess` |
  | `isAdmin` | `subject.roles.includes(Role.ADMIN)` | основа `canAccess`, `canListFor` |
  | `canAccess` | `Rule.anyOf(isRespondent, isAdmin)`, `denyMessage: 'Нет доступа к анкете'` | `startByInvite`, `declineInvite`, `handleAction`, `abandon`, `getQuestionnaire`, `getCurrent` |
  | `canListFor` | `Rule.anyOf(isSelf, isAdmin)` по ctx `{ userId }`, `denyMessage: 'Нет доступа к списку анкет пользователя'` | `getQuestionnairesByUser` |

- Контекст `canAccess`: `{ questionnaire: ReadonlyAr<QuestionnaireAr> }`. Legacy `canRead` и `canEdit` совпадают, поэтому одно правило.
- «Только за себя»: респондент — всегда субъект (`caller.subject().uuid`), чужого респондента во входе нет. Admin может читать и править чужую анкету, как в legacy. Субъект модуля — `QuestionnaireUser = Pick<User, 'uuid' | 'roles'>` (`modules/.../questionnaire.module.ts`, как `StreamUser`). Импорт `User` из `@u7-scl/domain/user` (index) уходит (DEBT-32).

**Р5. Состав объектов домена.** DCS, DQS и доменных правил (`*.rules.ts`) нет.
- Нет мутации нескольких агрегатов и нет вычисления на чтение поверх нескольких.
- Решения о допустимости — переходы Def и методы-вопросы Ar.
- Движок остаётся чистым классом `QuestionnaireEngine` (`questionnaire-engine.ts`): маршрут, прогресс, схема валидации. Он бросает `Error` на повреждённом пуле, как сейчас (`:126,157,164-216`). Это дефект данных, не штатный отказ (ERR-01 к нему не применяется — не `.ar/.dcs/.uc/.er`). Ar не ловит исключения.
- Построение экранов — отдельный чистый класс `QuestionnaireScreen` (`questionnaire-screen.ts`): `invite()`, `current()`, `afterAnswer()`, `stale(reason)`, `waitNext()`. Он принимает `state` и `engine`, без мутаций и без `#`.
- Так Ar остаётся порядка 300 строк, а `get-current` использует тот же `QuestionnaireScreen` через метод-вопрос Ar `screen()`.

**Р6. Ar без `#`** (CODE-02, DEBT-10).
- Приватные члены — TS `private`.
- Вместо `#engine` — `private readonly engine`, строится в конструкторе из `state.questionPool` и `kind` (likert → вопросы по `LIKERT_SCALE`).
- Вместо `this._state.answers.push` и `delete` — работа с черновиком в `apply` метода `change`.
- Вместо `throwBadRequest` — `err(QuestionnaireErrors.X.make())`.
- Вместо `isoNow()` — аргумент `at: Timestamp` (DOM-14).

**Р7. Создание.**
- `QuestionnaireAr.createStandard(input, at): Result<QuestionnaireAr, never>` создаёт анкету сразу в `in_progress`, с выставленным `currentQuestionCode` (первый вопрос — по `engine.getNextQuestion(null, [])`). Событие — `started`.
  - Первый вопрос пула всегда показывается: условие может ссылаться только на вопрос выше (`questionnaire-engine.ts:200-216`). Ветка «пустой маршрут при старте» (`a-root.ts:129,478-493`) недостижима и в Ar не переносится.
- `createLikert(input, at)` создаёт анкету в `invited`, событие — `invited`.
- `restore(snapshot)` — для обеих веток.
- `startByInvite` вызывает метод `start(at)` (переход `invited` → `in_progress`) и событий не публикует (Т5).

**Р8. Время.** Все мутации принимают `at`. Job берёт `this.now()` один раз на запись. `answeredAt` и `completedAt` равны `at`.

**Р9. Репозиторий.**
- Порт `QuestionnaireRepo = Repository<QuestionnaireAr> & { findById(uuid); findByRespondent(userId); findIdle({ idleMs, at, kinds? }) }`. Метод `findIdle` возвращает незавершённые анкеты (`invited`, `in_progress`) с простоем от `updatedAt` не меньше порога.
- Фейк `questionnaire.repo.fake.ts` (`MemoryRepo`), тесты UC — на фейке.
- Реализация `infra/questionnaire.json-repo.ts extends VersionedRepository`, файл `<dbDir>/questionnaires/questionnaires.json`, строгий разбор `v.array(QuestionnaireArDef.state)`, как `StreamJsonRepo`.
- Тест реального репозитория — `mkdtemp`.
- Порядок записей в `findByRespondent` — порядок файла (как `filter` в legacy).

**Р10. Субъект и callers.**

| UC | `callers` |
|---|---|
| `startQuestionnaire`, `sendLikertInvite` | `['system']` (вызывают `wish` и будущий `peer-review` через фасад; респондент — `caller.subject()`) |
| Остальные 7 | `['user']` (бот диспатчит от имени актора) |

Админ-UI и гость анкет не открывают.

**Р11. Вызов чужого модуля.** UC и Job анкет чужие модули не вызывают, поэтому `calls`/`fetch` не нужны (API-07 не применим).

**Р12. Тексты Def (MAN-01).** Для UC `label`/`description` повторяют `ucLabel` legacy: «Запустить анкету», «Запустить анкету по приглашению», «Отказаться от приглашения на анкету», «Обработать действие в анкете», «Прервать анкету», «Получить текущее состояние анкеты», «Получить анкету», «Получить анкеты пользователя», «Пригласить на likert-анкету». Job — «Продолжение, предупреждение и закрытие брошенных анкет».

## Событийный контракт (TR-46: Q1, Q2, Q3)

`QuestionnaireEvents` (`questionnaire.events.ts`, FQN-префикс `questionnaire.questionnaire`) — 6 событий.

```
ref = {
  questionnaireId: F.uuid('анкеты'),
  respondentId:    F.uuid('респондента'),
  kind:            F.picklist(['standard', 'likert'], 'вида анкеты'),
  ownerInfo:       v.pipe(v.record(v.string(), v.unknown()),
                     v.description('Данные владельца анкеты: их задаёт и толкует владелец, модуль анкет — нет')),
}
```

| Событие | Payload | Кто публикует |
|---|---|---|
| `started` | `ref` | `createStandard` (UC `startQuestionnaire`). `startByInvite` его не публикует |
| `invited` | `ref` | `createLikert` (UC `sendLikertInvite`) |
| `completed` | `v.variant('kind')`: standard — `ref`; likert — `ref` + `likertScores: array({ category, subcategory, score })` (`score` от 1 до 5, Q1) | `handleAction`, последний вопрос |
| `abandoned` | `ref` + `reason: picklist(['timeout', 'by_user', 'declined'])`, обязателен | `abandon` (`by_user`), Job (`timeout`), `decline` (`declined`) |
| `abandonWarning` | `ref` | Job, простой 6 ч |
| `continueInvite` | `ref` | Job, простой 3 ч |

Принятое:
- Поля `telegramId` и `response` в payload отсутствуют (Q3, D-63). Слово `owner` в контракте не используется — только `ownerInfo` (Q2).
- `reason` стал обязательным: у legacy он необязателен и для likert отсутствует (`events.ts:48-56`, `likert-questionnaire-ar.ts:100-107`). Все издатели знают причину. Это правка payload для тестов `wish` (Т12).
- `kind` добавлен во все 6 событий (Q1 требует его для likert, единообразие дешевле). Тестовый builder payload в `wish` дополняется `kind: 'standard'`.
- Дополнительные описания (`MAN-02`): `likertScores` и его элементы получают `v.description`. Схемы `LikertScore*` в `likert-question.ts` сейчас без описаний.

**Бот в Ф2 слушает 5 событий** (`started`, `invited`, `abandonWarning`, `continueInvite`, `abandoned` — только `reason === 'timeout'`). `completed` бот не слушает (его слушает ER `wish`). Экран строит story по `getCurrent` (Q3), адрес — вопрос С2.

## Было → станет

### Домен

| Было | Станет |
|---|---|
| `questionnaire/a-root.ts` `BaseQuestionnaireAr` (590 строк, `core`, `#`, `throw*`, `isoNow`) | `questionnaire.ar.ts`: `QuestionnaireArDef` + `QuestionnaireAr` (Р6); экраны — `questionnaire-screen.ts` (Р5) |
| `standard/questionnaire-ar.ts`, `likert/likert-questionnaire-ar.ts` | ветки `kind` внутри `QuestionnaireAr` (движок и `computeLikertScores` по `kind`) |
| `questionnaire-factory.ts` `QuestionnaireFactory` | статические `createStandard`, `createLikert`, `restore` в `QuestionnaireAr` |
| `entity.ts` (`QuestionnaireSchema`, `v.isoDateTime`, `AbandonReasonSchema`) | `questionnaire.state.ts` (`F.timestamp`, variant); `entity.ts` — только оболочка типов (Т15) |
| `likert/likert-questionnaire.ts` (`LikertQuestionnaireSchema`) | ветка variant в `questionnaire.state.ts` |
| `state.ts` (реэкспорт `entity`) | реэкспорт нового state для прикладного пакета |
| `events.ts` (10 интерфейсов `DomainEvent`) | удаляется |
| `questionnaire.events.ts` (3 события, `owner`) | 6 событий (раздел «Событийный контракт») |
| `errors.ts`, `commands/errors.ts` (типы ошибок) | `questionnaire.errors.ts` (`QuestionnaireErrors`); `commands/errors.ts` — оболочка (Т15) |
| `policy.ts` `QuestionnairePolicy` (литерал, `UserPolicy`) | `questionnaire.policy.ts` `QuestionnairePolicy = PolicyDef.define` (Р4) |
| `questionnaire-respondent.policy.ts` + тест | удаляется, правило `hasRespondent` переезжает |
| `repo.ts` (`QuestionnaireRepo`, `QuestionnaireState`, `GetIdleQuestionnairesParams`) | порт в прикладном слое; тип `QuestionnaireState` — из `questionnaire.state.ts` |
| `types.ts` (`QuestionnaireActionResponse`, 5 схем) | `questionnaire.types.ts`: те же имена и формы, поля получают `v.description` (MAN-02); тип `Question` остаётся в `question.ts` |
| `commands/*-cmd.ts` (9 метатипов) | `uc/*.uc.ts` (9 Def); метатипы — оболочка до Ф3 (Т15) |
| `uc/start-questionnaire.uc.ts` (вход `owner`, policy `QuestionnaireRespondentPolicy`) | вход `ownerInfo`, policy `QuestionnairePolicy.rules.hasRespondent`, `errors: []`, `emits: [started]` |
| `module.ts` (`QuestionnaireApiModuleMeta`, resolver с `U7ModuleResolver`, DEBT-2) | оболочка: метатипы без resolver |
| `facade.ts` `QuestionnaireFacade` | удаляется |
| `questionnaire.module.ts` (`external`, 1 UC, `jobs: []`) | без `external`, 9 UC, Job `SweepAbandonedQuestionnairesJobDef` |
| `contract.ts` (экспорт legacy-фасада, ошибок-типов) | контракт: `QuestionnaireModuleDef`, 9 `*UcDef`, `SweepAbandonedQuestionnairesJobDef`, `QuestionnaireEvents`, `QuestionnaireErrors`, `QuestionnairePool`/`QuestionnairePoolSchema`, `LikertQuestionPool`, `Question`, `QuestionnaireActionResponse` (типы для stories, Ф2), `QuestionnaireView` |

**Def UC** (имена camelCase, файлы `uc/<kebab>.uc.ts`):

| UC (legacy → Def) | type | callers | Policy | Вход → выход | `errors` / `emits` |
|---|---|---|---|---|---|
| `start` → `startQuestionnaire` | command | `system` | `hasRespondent` | `{ pool, ownerInfo }` → `{}` | `[]` / `started` |
| `send-likert-invite` → `sendLikertInvite` | command | `system` | `hasRespondent` | `{ pool: LikertQuestionPool, ownerInfo }` → `{}` | `[]` / `invited` |
| `start-by-invite` → `startByInvite` | command | `user` | `canAccess` | `{ questionnaireId }` → `QuestionnaireActionResponse` | `NOT_FOUND`, `NOT_INVITED` / — |
| `decline-invite` → `declineInvite` | command | `user` | `canAccess` | `{ questionnaireId }` → `{}` | `NOT_FOUND`, `NOT_INVITED` / `abandoned` |
| `handle-action` → `handleAction` | command | `user` | `canAccess` | `{ questionnaireId, type: 'callback'\|'text', value }` → `QuestionnaireActionResponse` | `NOT_FOUND`, `NOT_IN_PROGRESS`, `CHOICE_EXPECTED`, `EMPTY_ANSWER_CODE` / `completed` |
| `abandon` → `abandon` | command | `user` | `canAccess` | `{ questionnaireId }` → `{}` | `NOT_FOUND`, `NOT_ACTIVE` / `abandoned` |
| `get-questionnaire` → `getQuestionnaire` | query | `user` | `canAccess` | `{ questionnaireId }` (было `uuid`, Т11) → `QuestionnaireView` | `NOT_FOUND` |
| `get-current` → `getCurrent` | query | `user` | `canAccess` | `{ questionnaireId }` → `QuestionnaireActionResponse` | `NOT_FOUND` |
| `get-questionnaires-by-user` → `getQuestionnairesByUser` | query | `user` | `canListFor` | `{ userId }` → `QuestionnaireView[]` | — |

- `QuestionnaireView` — `view()` по умолчанию (копия state, даты числами, DOM-17). Это схема variant из `questionnaire.state.ts`. Stories используют `kind`, `status`, `ownerInfo.courseId`, `uuid`.
- Входы и выходы описаны с `v.description` у каждого поля (MAN-02), включая `QuestionnaireActionResponse` и `Question`.

**Job `SweepAbandonedQuestionnairesJobDef`** (`job/sweep-abandoned-questionnaires.job.ts`):

| Свойство | Значение |
|---|---|
| `name` | `sweepAbandonedQuestionnaires` |
| `label` | «Продолжение, предупреждение и закрытие брошенных анкет» |
| `schedule` | `{ kind: 'interval', intervalMs: INVITE_AFTER_IDLE_MS }` (3 ч) |
| `scans` | `[QuestionnaireArDef]` |
| `emits` | `[continueInvite, abandonWarning, abandoned]` |

Экспортируемые константы (API-06) переезжают в файл Def: `INVITE_AFTER_HOURS = 3`, `WARN_AFTER_HOURS = 6`, `ABANDON_AFTER_HOURS = 9`, `*_IDLE_MS`, `INTERVAL_MS`.

### Прикладной слой

| Было | Станет |
|---|---|
| `api/questionnaire/*-uc.ts` (9, `QuestionnaireUseCase`) | `questionnaire/uc/*.uc.ts` (9, `UseCaseFromDef`) |
| `api/questionnaire/sweep-abandoned-job.ts` (`SweepAbandonedJob`) | `questionnaire/job/sweep-abandoned-questionnaires.job.ts` (`JobFromDef`) |
| `api/questionnaire-uc.ts`, `api/module.ts`, `api/index.ts`, `api/questionnaire/uc-metas.ts` | удаляются |
| `infra/questionnaire-in-proc-facade.ts` | удаляется |
| `infra/db/questionnaire-json-repo.ts` (`JsonFileRepo` + `QuestionnaireStateSchema`) | `infra/questionnaire.json-repo.ts` (`VersionedRepository`) |
| `infra/index.ts` (repo + facade) | экспорт только `QuestionnaireJsonRepo` |
| `questionnaire.module.ts` (`QuestionnaireModuleDeps = ModuleDeps & { legacy }`, `Caller<User>`) | `QuestionnaireDeps = ModuleDeps & { questionnaires: QuestionnaireRepo }`, `QuestionnaireUser`, `questionnaireMap`, `createQuestionnaireModule` |
| `questionnaire/uc/start-questionnaire.uc.ts` (адаптер DEBT-44, DEBT-32) | настоящий UC |
| `legacy-inbound.ts` + тест | удаляются |
| `index.ts` (`legacy-inbound`, `questionnaire.module`) | `domain`, `infra`, `questionnaire.module` |

**Алгоритмы UC** (`load` → `execute`, решения — в Ar):

- `startQuestionnaire`: `load` ничего не грузит. `execute` создаёт `QuestionnaireAr.createStandard({ uuid, respondentId: caller.subject().uuid, pool, ownerInfo }, now)`, `uow.register`.
- `sendLikertInvite`: то же с `createLikert`.
- `startByInvite`, `declineInvite`: `load` — `findById`, `NOT_FOUND`. `execute` — `ar.start(now)` / `ar.decline(now)`. Выход `startByInvite` — `ar.screen()`.
- `handleAction`: `ar.handleAction(now, action)` → `Result<QuestionnaireActionResponse, E>`. Выход — экран.
- `abandon`: `ar.abandon(now, 'by_user')`.
- `getCurrent`: `ok(ar.screen())`. `getQuestionnaire`: `ok(ar.view())`. `getQuestionnairesByUser`: `findByRespondent`, `map(ar => ar.view())`.

Метод-вопрос Ar `isOf(userId): boolean` (респондент ли пользователь) — для правила `isRespondent`.

**`QuestionnaireAr` — публичные методы:**

| Метод | Тип | Назначение |
|---|---|---|
| `createStandard(input, at)`, `createLikert(input, at)` | static, `Result` | создание, события `started` / `invited` |
| `restore(snapshot)` | static | восстановление |
| `start(at)` | переход | `invited` → `in_progress`, выдаёт первый вопрос, сбрасывает флаги простоя |
| `decline(at)` | переход | `invited` → `abandoned`, `abandonReason = 'by_user'`, событие `abandoned` с `reason: 'declined'` |
| `abandon(at, reason)` | переход | см. Т3 |
| `handleAction(at, action)` | `change` или переход `complete` | ветки раздела «Сохраняемое поведение» |
| `sweepIdle(at)` | `change` или переход `abandon` | решение ступени Job (Т1, Т7) |
| `idleFor(at)`, `needsSweep(at)` | вопросы | для отбора кандидатов |
| `screen()` | вопрос | экран для `getCurrent` и ответов UC |
| `isOf(userId)` | вопрос | для Policy |
| `view()` | вопрос | `QuestionnaireView` |

### Клиенты `wish` (D-41, Q2)

| Было | Станет |
|---|---|
| `domain/src/wish/wish/uc/create-course-wish.uc.ts`: `calls: [GetCourseEnrollmentUcDef, StartQuestionnaireUcDef]` | без изменений (имя и FQN `StartQuestionnaireUcDef` сохраняются) |
| `modules/wish/src/wish/uc/create-course-wish.uc.ts:100-104`: `{ pool: questionnaire.pool, owner: questionnaire.owner }` | `{ pool: questionnaire.pool, ownerInfo: questionnaire.owner }`; запуск остаётся в `execute` после `uow.register`, до фиксации (D-41, вариант 1) — отказ запуска анкеты не записывает желание. Поле `owner` в `WishQuestionnaire` (`wish.ar.ts:137-140`) не меняется |
| `modules/wish/src/wish/er/confirm-wish.er.ts:26`: `const { respondentId: userId, owner } = event.payload` | `{ respondentId: userId, ownerInfo }`, `WishAr.questionnaireTarget(ownerInfo)` |
| `modules/wish/src/wish/er/abandon-wish.er.ts:26` | то же |
| `domain/src/wish/wish/er/{confirm,abandon}-wish.er.ts`: `on: [QuestionnaireEvents.completed / abandoned]` | без изменений Def; `description` ER и комментарии — слово `owner` → `ownerInfo` |
| Тесты: `modules/wish/src/wish/er/{confirm,abandon}-wish.er.test.ts:53-60` (хелпер `owner`), `create-course-wish.uc.test.ts:156`, `domain/src/wish/wish/er/{confirm,abandon}-wish.er.test.ts` | хелперы payload: `ownerInfo`, `kind: 'standard'`, у `abandoned` — `reason`. Новые тесты: `abandoned` с `reason: 'declined'` и с `kind: 'likert'` и чужим `ownerInfo` не трогают желания |
| Адаптер `start-questionnaire.uc.ts` (DEBT-44, DEBT-32) | настоящий UC (Р10) |
| `questionnaireLegacyInbound` (`legacy-inbound.ts`), `inbound` в `u7-app.ts:243` | удаляются; ER подписаны на Def-события агрегата |

Сопутствующее:
- `modules/wish/src/wish.module.test.ts:43-47` использует `StubFacade(QuestionnaireModuleDef).answer(StartQuestionnaireUcDef, …)` — без изменений.
- Изменение входа `owner` → `ownerInfo` затрагивает также `peer-review` только контрактом (`dependsOn` есть, вызовов нет).

### Вне пакета

| Было | Станет |
|---|---|
| `u7-app.ts:25,37-45,145-165,181,197,213,243,288-291` | фабрика `createQuestionnaireModule({ ...deps, questionnaires: new QuestionnaireJsonRepo(`${dbDir}/questionnaires/questionnaires.json`) })`; убраны `QuestionnaireApiModule`, `QuestionnaireInProcFacade`, `QJsonRepo`, `questionnaireLegacyInbound`, `ApiApp([…, questionnaireModule])` → `[userModule, courseModule]`, `inbound: []` (или без `inbound`; решает orchestrator по `legacyEventBus`) |
| `u7-app.types.ts:3,37` (`QuestionnaireLegacy`) | поле и импорт удаляются |
| `u7-app-meta.ts:4,15` (`QuestionnaireApiModuleMeta`) | остаётся до Ф2/Ф3 импорт метатипа оболочки (Т15) — иначе `appApi.execute('handle-action')` не пройдёт `tsc` в stories |
| `u7-app.test.ts:15-17,132,281-286,399-420` | `questionnaireFacade` → `getModule('questionnaire')` `undefined`; сценарий «complete/abandon → ER `wish`» строится через `dispatch` `startQuestionnaire` + `handleAction` / `abandon` на модуле Def, а не через `QuestionnaireFactory` и `bus.publish` legacy-событий |
| `stories/{render,fill.story,invite.story}.ts` (типы) | `render.ts`: `Question`, `QuestionnaireActionResponse` из `@u7-scl/domain/questionnaire/contract`. `fill.story.ts`, `invite.story.ts`: legacy-интерфейсы событий — временные локальные типы в `stories/legacy-events.ts` с пометкой «удалить в Ф2» (Т16) |

## Разбор `a-root.ts` (590 строк)

| Блок legacy (строки) | Куда |
|---|---|
| `NEXT_BUTTON_PREFIX`, `getNextButtonText` (19-20, 183-185) | константа и статический метод остаются в `questionnaire-screen.ts` (кнопка — часть экрана) |
| Конструктор, `buildEngine`, `#engine` (26-40) | `QuestionnaireAr`: `private readonly engine`, ветка `kind` для likert (`toChoiceQuestion` + `LIKERT_SCALE`, `likert-questionnaire-ar.ts:42-62`) |
| `buildCompletedEvent` / `buildDeclinedEvent` / `buildAbandonedEvent` (46-54, 3 класса) | события `QuestionnaireEvents.*.make(...)` внутри методов; `completed` с `likertScores` для `kind: 'likert'` |
| `checkInvariant` (61-68) | `v.parse` инварианта в конструкторе (`abandoned` ⇒ `abandonReason`) — прецедент `ReviewCampaignAr`; платформа не конвертирует `v.check` в state (`toJsonSchema` в режиме `errorMode: 'throw'`, `kernel/schema/json-schema.ts`) |
| `markWarned`, `markContinueInvited` (77-98) | методы Ar через `change(this.state.updatedAt, …)`, см. Т1 |
| `getInvite` (100-114) | `QuestionnaireScreen.invite()` |
| `start` (119-130) | переход `start`; флаги сбрасываются в `apply` |
| `abandon` (138-151) | переход `abandon`; no-op для `abandoned` — Т3 |
| `decline` (158-166) | переход `decline` |
| `currentQuestionCode` геттер (172-177) | убирается (DOM-04): внутри Ar — приватное чтение, наружу не нужен |
| `handleAction` (198-251) | `QuestionnaireAr.handleAction(at, action)`: ветвление выбора ответа остаётся в Ar, потому что это решение домена |
| `getQuestionnaireActionResponse` (261-306) | `QuestionnaireScreen.current()`, метод Ar `screen()` |
| `#toggleDraftAnswer` (313-361) | приватный метод Ar (`change`) |
| `#submitCurrentQuestion` (368-443) | приватный метод Ar: ответ → следующий вопрос или завершение |
| `#findAndSetNextQuestion` (450-493) | приватный метод Ar; завершение — переход `complete` |
| `safeUpdate` override (503-507) | не нужен (платформа: `change`/`transition`) |
| `#cancelWarning`, `#staleAnswerResponse`, `#progress` (514-558) | `QuestionnaireScreen` |
| `#checkIsInProgress`, `#resetIdleFlags`, `#getQuestion` (561-581) | `NOT_IN_PROGRESS` из Def (переход/`change` с проверкой статуса), сброс флагов в `apply`, `getByCode` движка |
| `isKnownAnswerCode` (585-590) | приватная функция/метод `QuestionnaireScreen` или Ar |

Политика, правила, DQS из `a-root.ts` не выделяются: в нём нет прав субъекта и нет вычислений поверх нескольких агрегатов (Р5). Права — только новый `questionnaire.policy.ts`.

## Проверка variant-state в `AggregateDef` (TR-47 Т1)

**Вывод: поддерживается, правка `dmg-core` не нужна.** Проверено чтением кода и пробным запуском (временный файл вне репо, в scratchpad; `bun test` и `tsc` без ошибок).

- **Тип.** `AggregateSpec.state: S extends StateSchema` (`dmg-core/src/domain/aggregate/aggregate-def.types.ts:16`, `StateSchema = v.GenericSchema<unknown, EntityBase>`). Выход `v.variant` — union веток, каждая из которых содержит `BaseEntityFields`, то есть присваиваема `EntityBase`. `StatusOf<S>` (`:19-20`) берёт `status` из union: значения совпадают в ветках. Проба с `statuses` + `transitions: {}` прошла `tsc`.
- **Разбор.** `AggregateDef` оборачивает state `withEntityDefaults` (`aggregate-def.ts:44`). В `fields.ts:101-141` `hasUpdatedAt` для схем без `entries` (у variant `options`) возвращает `true`, поэтому `updatedAt = createdAt` для legacy-записи подставляется до выбора ветки; `version` получает `0` из `optional` в `BaseEntityFields`. Пробная запись без `updatedAt` и `version` разобрана: `updatedAt = createdAt`, `version = 0`.
- **JSON Schema.** `toJsonSchema` даёт `oneOf` (MAN-03). `def-checker.ts:135-136` спускается в `anyOf`/`oneOf` и проверяет `description` (MAN-02) у каждой ветки.
- **Мутации.** `Aggregate.mutate` клонирует и валидирует union целиком (`aggregate.ts:196-215`); `transition` берёт статус из `statusOf` (`:227-231`).
- **Ограничения.** В тестах пакета variant-state не покрыт (`grep variant src/**/*.test.ts` — нет). Это не блокирует; опционально, вне трека: регрессионный тест в `aggregate-def.test.ts` отдельным коммитом пакета.
- **Платформенное ограничение, которое надо обойти (Т1).** `change` и `transition` всегда выставляют `updatedAt: at` (`aggregate.ts:191-195`). Для `markWarned`/`markContinueInvited` это сбросило бы таймер простоя.

## Job `sweepAbandonedQuestionnaires` и поведение при отсутствии адреса (D-63)

**Поведение v0.2.6** (`sweep-abandoned-job.ts:61-95`):
- Отбор: `getIdle({ idleMs: 3 ч, kinds: ['standard'] })`, статусы по умолчанию `invited` и `in_progress`. Простой — от `updatedAt ?? createdAt`.
- Ступени выбираются по фактическому простою, а не по цепочке:
  - `≥ 9 ч` → `abandon('timeout')` и событие;
  - `≥ 6 ч` и `warnedAt` не задан → `markWarned` и событие предупреждения;
  - иначе (3–6 ч) и `continueInvitedAt` не задан → `markContinueInvited` и событие приглашения продолжить.
- Первый тик при простое `≥ 6 ч` пропускает ступень 3 ч — это сохраняется.
- Только `standard`: likert не затрагивается, в том числе не закрывается по таймауту.
- Флаг сохраняется (`repo.save`) **до** публикации. Если у пользователя нет `telegramId` (удалён), в `warn` и `inviteToContinue` флаг уже записан, событие не публикуется (`:116-117,142-143`). В `abandonByTimeout` событие публикуется всегда, `telegramId` может быть `undefined`, а story ничего не шлёт (`fill.story.ts:136-139`).
- Сбой одной анкеты не прерывает обход: `try/catch` → `logger.warn`.
- `invited`-анкеты на ступенях 3 ч и 6 ч: `markContinueInvited`/`markWarned` бросают `BAD_REQUEST` (`a-root.ts:561-565`), попадает в `warn`-лог, событий нет. На `≥ 9 ч` закрываются с событием `abandon`.

**Как это сохраняется при D-63** (Job доменный, `telegramId` в событии нет):
- Каждая запись обходится через `job.forEach`: своя UoW, сбой записи не прерывает обход (`JobFromDef.forEach`, `job-from-def.ts:78-97`).
- Решение ступени — в Ar: `QuestionnaireAr.sweepIdle(at)` возвращает `Result` и делает ровно одно из: `markContinueInvited`, `markWarned`, `abandon('timeout')` либо ничего. Job `if` по состоянию не содержит (API-01). Отбор кандидатов — `repo.findIdle({ idleMs: INVITE_AFTER_IDLE_MS, at, kinds: ['standard'] })`.
- Для `invited`-анкеты ступени 3 ч и 6 ч пропускаются без ошибки, закрытие `≥ 9 ч` сохраняется (Т7).
- Флаг и событие фиксируются одной UoW (outbox), порядок «флаг, затем событие» сохраняется. События публикуются всегда: решение «слать ли уведомление» переехало в story. При отсутствии адреса story молча пропускает отправку (Ф2: как `inactivity` — `warn` без падения). Наблюдаемое поведение для пользователя совпадает с v0.2.6. Различие — Job не зависит от канала, а флаги `warnedAt` / `continueInvitedAt` по-прежнему записаны.
- Тест Job на уровне домена и прикладного слоя проверяет: события без `telegramId`; запись флага без сдвига `updatedAt`; закрытие по таймауту; идемпотентность повторного тика; likert не затрагивается; сбой записи не прерывает обход.

## Шаги (по ролям)

1. **dmg-test-designer.** Характеризация по существующим тестам как ожиданиям, затем red.
   - Перенос сценариев:
     - `standard/questionnaire-ar.test.ts` (580), `standard/stale-answer.test.ts` (220), `likert/likert-questionnaire-ar.test.ts` (239) → `questionnaire.ar.test.ts`;
     - `warned-at.test.ts`, `continue-invited-at.test.ts` → тесты `sweepIdle`/`markWarned` (важно: `updatedAt` не сдвигается);
     - `questionnaire-factory.test.ts`, `uc/start-questionnaire.uc.test.ts`, `questionnaire.module.test.ts` (домен и прикладной), `questionnaire-respondent.policy.test.ts`;
     - `api/module.test.ts` (418) → тесты 9 UC на фейке; `sweep-abandoned-job.test.ts` и `.stages.test.ts` (533) → тест Job;
     - `infra/db/questionnaire-json-repo.test.ts`, `questionnaire-repo-idle.test.ts` → тест `QuestionnaireJsonRepo` (`findIdle`); `questionnaire-repo-active.test.ts` не переносится (Т18);
     - `questionnaire-engine.test.ts` (475) и `question.test.ts` остаются как есть.
   - Новое red:
     - Policy (TST-02: респондент, admin, чужой, гость/без субъекта);
     - каждая ошибка UC (TST-03);
     - Def-контракты: 6 событий, `ownerInfo`, обязательные `reason` и `kind`;
     - state: legacy-запись (ISO, без `updatedAt`/`version`) → числа, обе ветки `kind`;
     - репозиторий: round-trip, невалидная запись → исключение, файл цел;
     - клиенты `wish` (раздел выше).
   - Список перенесённых и удалённых сценариев — в отчёте.
2. **migrator, домен.** `bun run gen aggregate questionnaire.questionnaire --adopt` (при коллизиях с существующими файлами — вручную по `wish`/`stream`). Файлы раздела «Было → станет», удаление legacy, оболочка Т15, контракт и `index.ts`. Без `@u7-scl/core`, `@u7-scl/app-legacy` и чужого `index`.
3. **migrator, прикладной слой.** Порт, фейк, JSON-репозиторий, 9 UC + Job, `questionnaire.module.ts`, `index.ts`, удаление `api/**`, `infra/*`, `legacy-inbound`. Тесты UC — на фейке (DEBT-40/TST-07), репозиторий — `mkdtemp`.
4. **migrator, клиенты `wish`.** Раздел «Клиенты `wish`». Тесты `wish` зелёные.
5. **migrator, сборка Ф1.** `u7-app.ts`, `u7-app.types.ts`, `u7-app.test.ts`; типовые импорты stories (Т16).
6. **orchestrator.** Запись красной зоны в `debt.md`, сужение globs DEBT-1/2/5/10/32/44, TR на Т1–Т20 и ответы С1, С2.
7. **dmg-data-keeper.** State и репозиторий на собственных фикстурах: ISO и число, оба `kind`, `ownerInfo`, `warnedAt`, `continueInvitedAt`, `abandonReason`, запись без `updatedAt`, `answers[].answeredAt`, откат. Ключ Job в `last-runs.json` (расхождение 10). Риск строгого разбора — раздел «Риски».
8. **dmg-reviewer** по diff среза.

После каждого шага flash — гейт и `git diff --numstat` (не удалены ли проверки).

## Сохраняемое поведение (v0.2.6 = текущие тесты)

Для ревизии; `dmg-test-designer` фиксирует до перевода. Изменение текста — вопрос orchestrator.

- **start.**
  - Респондент — субъект. Анкета создаётся сразу `in_progress`, первый вопрос выставлен. Событие `started` публикуется после записи.
  - `QuestionnairePoolSchema`: минимум один вопрос. Пул без вопросов отклоняется схемой входа.
  - Движок отклоняет дублирующиеся `questionCode`, дубликаты `answerCode`, `text` с `answers`, условие на несуществующий или стоящий позже вопрос (`questionnaire-engine.ts:156-216`).
- **start-by-invite.**
  - Только `invited`, иначе отказ («Анкета не в статусе invited…»). Сбрасывает `warnedAt` и `continueInvitedAt`. Возвращает первый вопрос. Событие `started` не публикуется.
- **decline.**
  - Только `invited`. В state `abandonReason = 'by_user'`. Событие `abandoned` с `reason: 'declined'`.
- **abandon.**
  - `abandoned` — повтор без события и без ошибки. `completed` — «Анкета не активна». Иначе `abandoned`, причина `by_user`, событие `reason: 'by_user'`.
  - Работает из `invited` и `in_progress`.
- **handle-action** (`a-root.ts:198-251`). Отказ «Анкета уже завершена», если статус не `in_progress`. Сначала сбрасываются `warnedAt` и `continueInvitedAt`.
  - `text` на `text`-вопросе — ответ (`answerCode = 'text'`, `answerText`). `text` на `choice` — «Ожидался ответ с выбором (нажатием кнопки)».
  - `callback` вида `next:<code>`: код текущего вопроса и вопрос `multiple` → ответ из черновика; иначе `stale_answer` / `stale_button`.
  - `callback` на `choice`: пустой код — «Код ответа не может быть пустым». `multiple` → переключение черновика: чужой код — `stale_button`; повтор снимает выбор; пустой черновик удаляет ключ; ответ `wait_next` с `nextButton`, если выбор не пуст. `single` → ответ.
  - `callback` на `text`-вопросе — `stale_button`.
  - Ошибка валидации при ответе: `multiple` без выбора — `stale_answer` / `empty_selection`; иначе `stale_button`. Состояние не меняется (кроме флагов простоя, Т2).
  - Ответ `answerCode` — коды через запятую для `multiple`.
  - `new_question`: `previousQuestion`, `previousSelectedAnswers`, `questionIndex`/`poolSize` (прогресс по активному маршруту), `cancelWarning`. Нет следующего вопроса — `completed` с `completionText`, `completedAt`, событие `completed`.
  - Условное ветвление — `engine.getNextQuestion` по ответам; any-of для `multiple`.
- **get-current.** `invited` → `invited` (`inviteText`, `whyText`, `cancelWarning`). `completed` и `abandoned` → `{ type: 'completed' }`. `in_progress` → `wait_next` (для `multiple` с выбранными) или `new_question` с `selectedAnswers` из черновика.
- **Доступ.** Респондент или admin; отказы «Нет доступа к анкете» и «Нет доступа к списку анкет пользователя»; «Анкета не найдена».
- **Likert.** Вопросы по `LIKERT_SCALE` (1–5, `multiple: false`). `likertScores` — средневзвешенное по подкатегориям `Σ(ответ × вес) / Σ(вес)`, группы с нулевым весом пропускаются, нечисловой ответ пропускается; результат проходит `LikertScoreSchema` (1–5). В `completed` — поле `likertScores`.
- **Job.** Пороги 3/6/9 ч, интервал 3 ч, только `standard`, флаги `continueInvitedAt`/`warnedAt`, сброс при активности, один сбой не прерывает обход, событие `abandoned` с `reason: 'timeout'` (раздел Job). Тексты уведомлений бота (Ф2) сохраняются: «📋 Анкета… продолжим?», «⏳ Анкета приостановлена…», «⏱ Анкета была закрыта из-за длительной неактивности».
- **Бот.**
  - Уведомление о закрытии — только `reason === 'timeout'` (`fill.story.ts:136-139`).
  - Кнопки «▶️ Продолжить» / «▶️ Продолжить анкету» ведут на `Routes.questionnaire.resume(courseId)`.
  - `started` без `ownerInfo.courseId` — notify-подсказка, с `courseId` — кнопка «▶️ Заполнить анкету» (`fill.story.ts:68-87`).
  - Остальные тексты — тесты `fill.dialog.test`, `fill.story.warning.test`, `fill.story.continue-invite.test`, `invite.dialog.test`, `inventory.test` (Ф2).
- **Тесты, закрепляющие состав модуля** (падают при добавлении/удалении элементов):
  - в границах: `domain/src/questionnaire/questionnaire.module.test.ts` (`external: true`, `useCases: ['startQuestionnaire']`, `jobs: []`, 3 события с `owner`), `modules/questionnaire/src/questionnaire.module.test.ts`, `modules/questionnaire/src/legacy-inbound.test.ts`, `domain/.../uc/start-questionnaire.uc.test.ts`, `questionnaire-respondent.policy.test.ts`;
  - вне границ, но в Ф1: `platform/app/tests/u7-app.test.ts:15-17,132,281-286,399-420`;
  - вне границ, без правок (проверить прогоном): `scripts/arch-check.test.ts:50-53`, `domain/src/wish/wish.module.test.ts:10`, `domain/src/peer-review/peer-review.module.test.ts:13` (графы `dependsOn` не меняются);
  - вне границ, Ф2/Ф3: `runners/u7-bot/src/controllers/questionnaire/stories/*.test.ts`, `tests/e2e/{questionnaire-ux,wish-questionnaire}.e2e.test.ts`, `tests/worlds/*`.

## Красная зона Ф1–Ф2 (ожидаемая)

**Причина.** Новый `QuestionnaireJsonRepo` при первой записи переписывает весь `questionnaires.json` в числовых датах и с `version`. Legacy `JsonFileRepo` со схемой `v.isoDateTime` признал бы такие записи невалидными. Но в Ф1 legacy-репозиторий и UC удалены вместе с `a-root`, поэтому `appApi.execute('handle-action' | 'get-current' | …)` в рантайме падает «UC не найден». Stories (рантайм) до Ф2 живут на legacy-именах `questionnaire:*` и `execute`, а Def публикует события под FQN `questionnaire.questionnaire.*`.

**Красные тесты** (по анализу кода; окончательный список — по прогону, его записывает orchestrator в `debt.md`; критерий снятия — конец Ф2):
- `runners/u7-bot/tests/e2e/wish-questionnaire.e2e.test.ts` — вся анкетная ветка: `questionnaireStatus` через `app.apiApp.execute('get-questionnaires-by-user')` (`:140-147`), подписка story на `questionnaire:start`.
- `runners/u7-bot/tests/e2e/questionnaire-ux.e2e.test.ts` — публикация `questionnaire:continue-invite` и `execute` на legacy-имена (`:324`).

**Остаются зелёными (рантайм не тронут):** `fill.dialog.test`, `fill.story.warning.test`, `fill.story.continue-invite.test`, `invite.dialog.test`, `inventory.test` (все на `executeMock` и синтетических legacy-событиях), `course-catalog.story.test`, `course-nav-resolver.test`, `u7-bot-ui-story.test`, `ui-app.test`, `bot-transport.test`. Если прогон покажет иное — расширить список.

**Типы.** `tsc` для runners зелёный за счёт оболочки Т15 и локальных типов Т16. Красная зона — только тесты.

**Ловушка.** Пропущенная подписка молча гасит уведомление (риск plan). В Ф1 подписок нет, в Ф2 на каждое из 5 событий нужен e2e.

## Внешние зависимости

- **`user`** (`dependsOn` есть): `Role`, `User` — только из `@u7-scl/domain/user/contract` (Р4); `GetTelegramAddressesUcDef` — Ф2/С2.
- **`wish`** (клиент): `StartQuestionnaireUcDef` (вызов, `system`), события `completed`, `abandoned` (ER `confirmWish`, `abandonWish`).
- **`peer-review`**: `dependsOn: questionnaire` есть, вызовов и подписок нет. Контракт будущего: `SendLikertInviteUcDef`, `QuestionnaireEvents.completed` (с `likertScores`), `LikertQuestionPool`. Контракт экспортирует их сейчас.
- **Шина.** События Def публикует UoW модуля; шина DMG поверх legacy-шины (`u7-app.ts:233-247`). После удаления `questionnaireLegacyInbound` входящих legacy-событий анкет нет.
- **Новые связи `dependsOn` не нужны.**

## Открытые вопросы

### Стратегические — Нурболату

- **С1. Объём Ф1: снятие `external` и legacy-реализации анкет переносится из Ф3 в Ф1** (расхождения 1, 2, 6). Без этого Job на Def невозможен (MAN-06).
  - Что меняется: Ф3 сжимается до ARC-07 в `biome.json`, `scripts/{call-uc,domain-arch}.ts`, миров, `test-app` и удаления оболочки Т15. Ф1 включает `u7-app.ts` и типовую правку трёх файлов stories (Т16).
  - Рекомендация — да (так сделано в `student`, TR-43 С4). Если нет — Job остаётся в legacy-коде, а Ф1 теряет Job на Def.
- **С2. Адрес Telegram в stories Ф2 (D-63 vs фактический `callers`).** `GetTelegramAddressesUcDef` — `callers: ['system']`, story вызывает UC как `user` или `guest`. Решение нужно до брифа Ф2; на Ф1 не влияет.
  - (a) Новый помощник `dispatchUcAsSystem` в `u7-bot-ui-story.ts` — новая возможность UI-инфраструктуры, вопрос к ARC-08/D-49.
  - (b) Legacy `get-user` в stories, как `InactivityStory` (TR-43 С2). Отклонение от буквы D-63, но по прецеденту. Снимается переводом `user` на Def.
  - (c) Расширить `callers` у `GetTelegramAddressesUcDef` на `user` — меняет чужой контракт, не рекомендую.
  - Рекомендация — (b) на Ф2 с записью TR; D-63 остаётся для Job и ER (события без адреса).

### Тактические — orchestrator → TR (рекомендации tech-lead)

- **Т1. `updatedAt` при пометке `warnedAt` / `continueInvitedAt`.** `Aggregate.change` всегда ставит `updatedAt: at` (`aggregate.ts:191-195`), что сбросило бы таймер простоя.
  - Рекомендация — B: `markWarned`/`markContinueInvited` вызывают `this.change(this.state.updatedAt, …)`; `updatedAt` остаётся прежним, растёт `version`. Тест «не сдвигает `updatedAt`» обязателен (из `warned-at.test.ts:67`, `continue-invited-at.test.ts:74`).
  - Варианты: A — отдельное поле простоя (меняет формат на диске); C — правка `dmg-core` (опция `touch: false`), стратегическая.
- **Т2. Устаревшие ответы.** Legacy сбрасывает флаги простоя и в ветке `stale_answer`, не сдвигая таймер (`a-root.ts:203,569-572`). Рекомендация — сохранить через тот же приём `change(this.state.updatedAt, …)` (квирк, но не менять поведение).
- **Т3. `abandon` идемпотентен для `abandoned`.** Ar проверяет статус до `transition` и возвращает `ok()` без события. Запись `rejects.abandoned = NOT_ACTIVE` в Def нужна типу `RejectsComplete`, из Ar недостижима. Рекомендация — так.
- **Т4. `decline`.** Состояние: `abandonReason = 'by_user'` (формат на диске, `AbandonReason` без `declined`), событие: `reason: 'declined'`. ER `abandonWish` теперь реагирует на `declined` — безопасно (расхождение 7), тест обязателен.
- **Т5. `started` только при создании.** `startByInvite` его не публикует (иначе бот, подписанный на `started`, прислал бы пользователю приглашение сразу после нажатия «Начать»). Тест обязателен.
- **Т6. `createStandard` создаёт анкету сразу `in_progress`;** `createLikert` — `invited`.
- **Т7. `invited`-анкеты в Job:** ступени 3 ч и 6 ч пропускаются без ошибки и без события; закрытие `≥ 9 ч` — с событием. Результат для пользователя как в v0.2.6; уходит шум `warn` в логе.
- **Т8. Декомпозиция Ar:** `QuestionnaireAr` + `QuestionnaireScreen` (чистый класс) + `QuestionnaireEngine`. Вариант — строить экраны методами Ar (раздувает Ar до 450–500 строк). Рекомендация — отдельный класс.
- **Т9. Имена файлов и UC:** по списку раздела «Было → станет» (`uc/start-questionnaire.uc.ts` остаётся). Ошибки одной группой `QUESTIONNAIRE`.
- **Т10. `NOT_INVITED`:** один код и общий `label`, либо два кода по двум legacy-текстам. Рекомендация — один код.
- **Т11. Выходы:** даты числами, `QuestionnaireView = state`, вход `getQuestionnaire` — `questionnaireId` (в `uc` legacy поле `uuid`; вызывающих в production нет, `scripts/call-uc.ts` — Ф3).
- **Т12. `kind` во всех 6 событиях и обязательный `reason`.** Правка payload в тестах `wish`: ER-хелперы `confirm-wish.er.test.ts`, `abandon-wish.er.test.ts` (модуль и домен).
- **Т13. Повреждённый пул.** `QuestionnaireEngine` бросает `Error` на повреждённом пуле, UC его не ловит (платформа возвращает `SERVER_INTERNAL`). Рекомендация — так (пул — конфигурация курса, не ввод пользователя).
- **Т14. Фабрика и deps:** `QuestionnaireDeps`, `QuestionnaireUser = Pick<User, 'uuid' | 'roles'>`, как `StreamUser`. `package.json` пакета (зависимости `app-legacy`, `core`, `user`) — Ф3.
- **Т15. Оболочка до Ф3:** `domain/.../module.ts` (метатипы `QuestionnaireApiModuleMeta`, `QuestionnaireUcMetas`, без resolver), `commands/*-cmd.ts`, `commands/errors.ts`, `entity.ts` (без `ArMeta`; типы `Questionnaire`, `Answer` для миров и e2e). Нужна, чтобы `tsc` stories и `U7BotAppMeta` оставались зелёными. DEBT-1, 2, 5 сужаются до этих файлов (поимённый список — в `debt.md`), DEBT-10 гасится полностью (`a-root.ts` удалён).
- **Т16. Правка stories в Ф1 — только типы.** `render.ts` — типы из контракта. `fill.story.ts`/`invite.story.ts` — временные локальные типы в `stories/legacy-events.ts` (строка в красной зоне, удалить в Ф2). Рантайм подписок и вызовов не меняется.
- **Т17. Контракт для Ф2.** Экспортировать из `contract.ts`: `QuestionnaireActionResponse` (и ветки), `Question`, `QuestionnaireView`, `QuestionnairePool`, `LikertQuestionPool`, 9 `*UcDef`, `QuestionnaireEvents`, `QuestionnaireErrors`. Stories видят только контракт (D-45, ARC-08).
- **Т18. `getActive()` не переносится** (нет вызывающих), тест `questionnaire-repo-active.test.ts` удаляется; факт — в отчёте `dmg-test-designer`.
- **Т19. Тесты UC — на фейке порта,** репозиторий — на `mkdtemp`. `emits` не публикуются вручную (API-02).
- **Т20. `inbound` в `legacyEventBus`.** После удаления `questionnaireLegacyInbound` оставить `inbound: []` или убрать мост целиком — решает orchestrator по `legacyEventBus`; рекомендация — оставить мост без маршрутов до Ф3 (`TR-45`).

## Правила (ID rules.md)

DOM-01…06, DOM-10…12, DOM-14, DOM-15, DOM-17; API-01…07; MAN-01…06, MAN-08, MAN-10…13; ERR-01…06; ARC-02…04, ARC-06…08 (после снятия `external`); CODE-01, CODE-02, CODE-04; TST-01…07. Особое внимание:
- **MAN-02** — описания у каждого поля, включая `QuestionnaireActionResponseSchema`, `Answer`, `Likert*` схемы (сейчас без `description`).
- **MAN-06** — `external` + Job запрещены.
- **MAN-12** — отказы для всех статусов вне `from`.
- **DOM-14** — нет `isoNow`/`now` в Ar (аргумент `at`).
- **CODE-02** — нет `#` в Ar и в `QuestionnaireScreen`.
- **API-06** — пороги Job — экспортируемые константы.
- **TST-03** — каждая ошибка UC покрыта тестом с проверкой `code`.

## Документы

`dmg-core` срезом не правится (variant-state поддержан, Т1 решается в Ar), поэтому `docs:impact` для пакета не применим: «не затронуто, потому что правки пакета нет».

Проектные документы (orchestrator, не migrator):
- `conductor/architecture/debt.md` — сужение globs DEBT-1, 2, 5; снятие DEBT-10 и DEBT-32 в части анкет; строка DEBT-44 (адаптер удалён); запись красной зоны; TR на Т1–Т20 и ответы С1, С2.
- `decisions.md` — при необходимости D-xx по С2.
- `migration.md` §6 и «UC-адаптер над legacy-фасадом» — Ф4.

## Долг

- **Погашается в Ф1:**
  - DEBT-10 (`a-root.ts` удалён);
  - DEBT-32 (субъект — `Pick<User, 'uuid' | 'roles'>` из контракта; в `modules/questionnaire` не остаётся `import type { User } from '@u7-scl/domain/user'`);
  - DEBT-44 в части `start-questionnaire.uc.ts` (адаптер заменён настоящим UC, `external` снят);
  - TR-11 в части анкет;
  - DEBT-34 в части импортов `index` из legacy-файлов анкет, которые удалены (остаток — оболочка Т15 в Ф3).
- **Сужаются до оболочки (Т15), гасятся в Ф3:** DEBT-1, DEBT-2, DEBT-5.
- **DEBT-3 (barrel `modules/questionnaire/src/domain`) остаётся.**
- **Новые:** запись красной зоны; строка временных типов `stories/legacy-events.ts`; TR на Т1–Т20, С1, С2.

## Критерии приёмки

**Команды.**
- `bun run check` зелёный, кроме тестов из записи красной зоны. Число тестов анкет и `wish` не ниже базовой линии (`CI=true bun test domain/src/questionnaire` — 97 pass; `modules/questionnaire` — 51 pass; сценарии старых тестов перенесены, список — в отчёте `dmg-test-designer`).
- `bun run arch:check` синхронен с `debt.md`; `checkDefs` зелёный.
- `QuestionnaireModuleDef` без `external`: `grep -n "external" domain/src/questionnaire/questionnaire.module.ts` пуст.
- `git status data/` чист.

**Запрещённое (grep).**
- `grep -rnE "throw(BadRequest|Internal|Invariant|Error)|errNotFound|errAccessDenied|new (Questionnaire|LikertQuestionnaire)Ar\b|^\s+#\w+|@u7-scl/(core|app-legacy)" domain/src/questionnaire/questionnaire --include=*.ts` пуст, кроме файлов оболочки Т15 (`entity.ts`, `commands/*.ts`) и `questionnaire-engine.ts` (`new Error` на повреждённом пуле, ERR-01 к нему не применим; `engine` без `#` и без `@u7-scl`).
- `grep -rnE "throw|@u7-scl/(core|app-legacy)|new QuestionnaireAr\b" modules/questionnaire/src --include=*.ts` пуст, кроме `src/domain/index.ts` (barrel) и тестов.
- `grep -rn "isoDateTime" domain/src/questionnaire --include=*.ts` пуст, кроме `entity.ts` оболочки.
- `grep -rn "questionnaireLegacyInbound\|QuestionnaireInProcFacade\|QuestionnaireFacade\|startStandard\|questionnaire-in-proc" --include=*.ts domain modules platform runners scripts` пуст (в `scripts/call-uc.ts`/`domain-arch.ts` упоминания legacy-UC допустимы до Ф3).
- Адаптер: `grep -rn "Адаптер .* над legacy" modules/questionnaire` пуст.
- `grep -rnw "owner" domain/src/questionnaire modules/questionnaire/src --include=*.ts` пуст. В `wish`: слово `owner` только как свойство `WishQuestionnaire` (`domain/src/wish/wish/wish.ar.ts:137-140,317`, `questionnaire.owner` в `create-course-wish.uc.ts`, `wish.ar.test.ts:116,169,569-599`); `grep -rnE "payload.*\bowner\b|\{[^}]*respondentId[^}]*\bowner\b|^\s+owner:" modules/wish/src/wish/er domain/src/wish/wish/er` пуст.
- `grep -rnE "telegramId|response" domain/src/questionnaire/questionnaire/questionnaire.events.ts` пуст.
- `grep -rn "from '@u7-scl/domain/user'" modules/questionnaire domain/src/questionnaire --include=*.ts` пуст (только `/contract`).
- `grep -rn "@u7-scl/questionnaire/\(api\|infra\|domain\)" platform runners/u7-bot/src --include=*.ts` пуст; в `runners/u7-bot/tests` допустим до Ф3 (тестовые типы `QuestionnaireState`, `Questionnaire`).

**Наличие.**
- 9 UC — через `UseCaseFromDef`, Job — через `JobFromDef`; `grep -rn "extends QuestionnaireUseCase\|extends Job<" modules/questionnaire` пуст.
- Контракт: `QuestionnaireEvents` ровно с ключами `started`, `invited`, `completed`, `abandoned`, `abandonWarning`, `continueInvite`; `abandoned.reason` обязателен; `completed.likertScores` у `kind: 'likert'`.
- Тесты событий: `payload` без `telegramId`/`response` отклоняет лишнее поле схемой не требуется (схема не strict), но Ar и Job не кладут их.
- Тест репозитория: legacy-запись читается (ISO → число, нет `updatedAt` → `createdAt`, нет `version` → 0); round-trip обеих веток `kind`; невалидная запись → исключение, файл цел.
- Job: тест «простой 3 ч → `continueInvite`, `updatedAt` не сдвинут», «6 ч → `abandonWarning`», «9 ч → `abandoned` с `reason: 'timeout'`», «likert не затронут», «`invited` ≥ 9 ч закрывается, 3–9 ч — без ошибки», «повторный тик ничего не делает», «сбой одной записи не прерывает обход».
- Клиенты `wish`: тесты `confirm-wish.er`, `abandon-wish.er` (payload `ownerInfo`), `create-course-wish.uc` (вызов `startQuestionnaire` с `ownerInfo`, отказ запуска анкеты не записывает желание), `declined`/likert/чужой `ownerInfo` не трогают желания.
- `u7-app.test`: сценарий «complete/abandon анкеты → `confirmWish`/`abandonWish`» зелёный на Def-модуле.

**Красная зона.** Записана поимённо в `debt.md` (два e2e и всё, что покажет прогон), критерий снятия — конец Ф2. Остальные тесты зелёные.

## Риски

- **Строгий разбор файла.** `v.parse(v.array(QuestionnaireArDef.state))` падает на любой невалидной записи, в отличие от legacy `JsonFileRepo`, который пропускает и копирует такие записи в `backups/*.invalid.*`. Если в живом `questionnaires.json` есть записи, ранее отброшенные legacy, новый репозиторий упадёт на всех операциях. `dmg-data-keeper` проверяет на собственных фикстурах, но живые данные читать запрещено — сверку с реальным файлом выполняет Нурболат (read-only, вне агентов) до выкатки.
- **Ключ Job в `data/jobs/last-runs.json`** меняется (расхождение 10): первый запуск после выкатки — misfire-политика.
- **Новое наблюдаемое поведение ER `wish`:** `declined` и likert-события доходят до `abandonWish`/`confirmWish` (расхождение 7, Т4).
- **flash на домене:** качество держат тесты Sonnet; после каждого шага — гейт и `--numstat`.
- **`updatedAt`-приём (Т1/Т2)** опирается на то, что `change` не проверяет монотонность времени; если платформа добавит проверку, приём сломается — тесты «не сдвигает `updatedAt»» это поймают.

## Отчёт `dmg-test-designer` (Ф1, шаг 1)

**Итог прогона** `bun test domain/src/questionnaire modules/questionnaire domain/src/wish modules/wish`: 474 pass, 61 fail, 25 «Cannot find module» — ожидаемый red (нет реализации/Def; `wish` читает `owner`). `biome` по новым файлам зелёный; `tsc` — только ошибки от ненаписанных Ar/Def.

**Новые файлы.** Домен `domain/src/questionnaire/questionnaire/`: `questionnaire.fixture.ts`, `questionnaire.ar{,.answers,.likert,.idle}.test.ts`, `questionnaire.{errors,events,state,policy}.test.ts`, `questionnaire-screen.test.ts`, `uc/questionnaire.uc-defs.test.ts`, `job/sweep-abandoned-questionnaires.job.test.ts`. Модуль `modules/questionnaire/src/`: `questionnaire/uc/questionnaire-uc.fixture.ts`, 9 `questionnaire/uc/<uc>.uc.test.ts`, `questionnaire/job/sweep-abandoned-questionnaires.job.test.ts`, `infra/questionnaire.json-repo.test.ts`.

**Изменены:** тесты состава модуля (домен и модуль, переписаны на месте); `wish`: `er/{confirm,abandon}-wish.er.test.ts` (домен и модуль), `uc/create-course-wish.uc.test.ts`.

**Перенос сценариев:**

| Старый тест | Новый файл |
|---|---|
| `standard/questionnaire-ar`, `questionnaire-factory` | `questionnaire.ar.test.ts`, `questionnaire.ar.answers.test.ts` |
| `standard/stale-answer` | `questionnaire.ar.answers.test.ts` |
| `likert/likert-questionnaire-ar` | `questionnaire.ar.likert.test.ts` |
| `warned-at`, `continue-invited-at` | `questionnaire.ar.idle.test.ts` (через `sweepIdle`) |
| `uc/start-questionnaire.uc` | `uc/questionnaire.uc-defs.test.ts`, `start-questionnaire.uc.test.ts` |
| `questionnaire-respondent.policy` | `questionnaire.policy.test.ts` |
| `api/module.test.ts` | 9 `*.uc.test.ts` |
| `sweep-abandoned-job*` | `job/sweep-abandoned-questionnaires.job.test.ts` (домен и модуль) |
| `questionnaire-json-repo`, `questionnaire-repo-idle` | `infra/questionnaire.json-repo.test.ts` |

**Не перенесено:** `questionnaire-repo-active` (Т18); `legacy-inbound.test` (удаляется с кодом); `abandon(undefined|'неверно')` (причина типизирована); прямые `markWarned`/`markContinueInvited` (покрыты через `sweepIdle`, «бросает на не-активной» → Т7); «невалидные записи игнорируются» → «исключение, файл цел» (бриф). Старые тест-файлы удаляет migrator вместе с legacy.

**Отклонения:** Ar-тесты — 4 файла (прецедент `stream.ar.student.test.ts`); Т10 — один код `NOT_INVITED`. В доменных ER-тестах `wish` добавлены проверки payload через `*ErDef.on`.

**API, заданный тестами (для migrator):** `QuestionnaireAr.createStandard|createLikert({ uuid, respondentId, pool, ownerInfo }, at)` → `Result`; `start`, `decline`, `abandon(at, reason)`, `handleAction(at, { type, value })`, `sweepIdle(at)` → `Result`; `needsSweep`, `idleFor`, `screen`, `isOf`, `view`, `snapshot`, `pullEvents`; `QuestionnaireScreen.getNextButtonText` (static); коды `QUESTIONNAIRE_*`; константы Job `INVITE|WARN|ABANDON_AFTER_HOURS`, `*_IDLE_MS`, `INTERVAL_MS`; классы 9 UC и `SweepAbandonedQuestionnairesJob`; `QuestionnaireRepoFake` (`findIdle({ idleMs, at, kinds? })`), `QuestionnaireJsonRepo(filePath)`, `createQuestionnaireModule`, `questionnaireMap`, `QuestionnaireUser`.

**Эскалаций нет.**

## Отчёт `migrator`, домен (Ф1, шаг 2; flash, 2 круга, $0.45)

- Генератор отказал (каталог существует) — агрегат перенесён вручную по `wish`/`stream`. Созданы `questionnaire.{state,types,errors,events,policy,ar}.ts`, `questionnaire-screen.ts`, Def 9 UC и Job; обновлены `contract.ts`, `index.ts`, оболочка Т15. Удалены legacy (`a-root.ts`, `facade.ts`, `errors.ts`, `events.ts`, `policy.ts`, `repo.ts`, `types.ts`, фабрика, `standard/*`, `likert/likert-questionnaire*`) и 8 старых тест-файлов (сценарии перенесены test-designer).
- Принято: `throw` в конструкторе Ar на `restore` повреждённого state (инвариант, тест требует); `new QuestionnaireAr` в статических фабриках (образец `student.ar.ts`).
- Возвращено и исправлено во 2-м круге: `this.pullEvents()` при завершении (Ar глушил `started`) — ошибка теста `answers.test` (не забирал события после создания), тест поправлен; схемы расширены до `string` через `as unknown as` — возвращены точные литералы, `QuestionnaireState = v.InferOutput`, тесты — `as const`, `refOf` generic.
- Итог: `bun test domain/src/questionnaire domain/src/wish` — 424 pass; `tsc` домена — 0 ошибок; `biome` чисто. Гейт красный вне домена (шаги 3–5).

## Отчёт `migrator`, прикладной слой (Ф1, шаг 3; flash, 2 круга, ~$0.24)

- Созданы: порт `questionnaire.repo.ts` (`findById`, `findByRespondent`, `findIdle`), `questionnaire.repo.fake.ts` (`MemoryRepo`), 9 UC (`start-questionnaire` — настоящий UC вместо адаптера), Job `sweep-abandoned-questionnaires.job.ts`, `infra/questionnaire.json-repo.ts` (`VersionedRepository`, `v.array(QuestionnaireArDef.state)`); переписаны `questionnaire.module.ts`, `index.ts`, `infra/index.ts`. Удалены 24 файла legacy: `src/api/**`, `src/infra/db/**`, in-proc-фасад, `legacy-inbound{,.test}.ts`.
- Отклонение (на ревью, TR): `AbandonUc` регистрирует агрегат в UoW только при изменении версии — иначе идемпотентный повтор на `abandoned` (Т3) пишет запись.
- Не тронуто (шаги 4–5 / Ф3): `package.json` (`exports["./api"]`, `#api-legacy/*`), `tsconfig.json` (путь `@u7-scl/questionnaire/api`).
- Круг 2 — правка red-тестов по эскалации (дефекты тестов): отказ доступа проверяется по `payload.denyMessage` (платформа отдаёт общий `label`, образец `stream`); smoke модуля — свой `requestId` на команду (D-56); аннотации типов хелперов `caller: Caller<QuestionnaireUser>`, `input: unknown`.
- Итог: `bun test modules/questionnaire domain/src/questionnaire` — 324 pass; `tsc` модуля — 0; `biome` чисто; `data/` чист. `arch:check` красный: DEBT-32/44 погашены, DEBT-2/5/10 — сузить в `debt.md` (orchestrator, шаг 6), ARC-07/08 в `platform`/`runners` — шаги 4–5.

## Отчёт `migrator`, клиенты `wish` и сборка (Ф1, шаги 4–5; flash, 1 круг, $0.10)

- `wish`: `create-course-wish.uc.ts` — `ownerInfo` во входе `StartQuestionnaireUcDef`; ER `confirm-wish`/`abandon-wish` берут `ownerInfo` из payload Def-событий (`kind`, обязательный `reason` — схема).
- `U7App`: `createQuestionnaireModule` на `QuestionnaireJsonRepo(<dbDir>/questionnaires/questionnaires.json)`; удалены `QuestionnaireApiModule`, `QuestionnaireInProcFacade`, legacy-репозиторий, резолвер, `questionnaireLegacyInbound`, поле `questionnaireFacade`; `U7LegacyFacades` без `questionnaire`; метатип Т15 — из корня `@u7-scl/questionnaire` (ARC-07).
- Stories (Т16): только типовые импорты в `render`, `fill.story`, `invite.story`; временный `stories/legacy-events.ts`.
- `u7-app.test.ts`: `questionnaireFacade` → `getModule('questionnaire')` нет; сценарий «complete/abandon → ER wish» — через `dispatch` Def-UC вместо фабрики и ручной публикации.
- Эскалации (решены orchestrator): долг в `debt.md` (DEBT-1 сужен, 2/5/10/44 — глобы сняты, DEBT-32 закрыт); `TR-46` в комментарии теста событий убран; ссылка на `packages/` в брифе заменена.
- Итог: `bun run check` — 4134 pass, 12 fail (красная зона TR-49), `tsc`, `lint`, `arch:check` зелёные; `data/` чист.

## Отчёт `dmg-data-keeper` (Ф1, шаг 7; flash, $0.06)

Проверка на собственных фикстурах (`mkdtemp`), `data/` не читался.

- **Совместимо:** ISO и числовые даты (`createdAt`, `updatedAt`, `completedAt`, `warnedAt`, `continueInvitedAt`, `answers[].answeredAt`), запись без `updatedAt`/`version` (`updatedAt = createdAt`, `version: 0`), оба `kind`, `ownerInfo`, `draftAnswers`, `abandonReason`. Миграция не нужна: файл конвертируется первой записью.
- **Первая запись** переписывает весь `questionnaires.json` (числа, `version` всем записям).
- **Риск отката:** после первой записи legacy `v0.2.6` отвергает все записи (список пуст, `save` пишет только новую). Откат — только с восстановлением файла из бэкапа.
- **Строже legacy (при условии):** `answerText: ""` (`F.string` непустая), `version` чужого типа, `abandoned` без `abandonReason` (`restore` бросает); одна невалидная запись → `ValiError` на любом чтении/записи, файл цел.
- **Ключ Job** `sweep-abandoned-questionnaires` → `sweepAbandonedQuestionnaires`: первый прогон через 3 ч, старый ключ осиротеет (безвредно).
- **Рекомендации к выкатке:** `bun run backup`; read-only сверка живого файла через `v.safeParse(QuestionnaireArDef.state, row)` (Нурболат); откат — с восстановлением файла.
- **Недостающие тесты (следующий срез/ревизия):** соседняя запись после первой записи, `version` неверного типа, `abandoned` без причины через `findByRespondent`.

### Открытые вопросы к контрольной точке Ф1 (Нурболату, не блокируют)

- **Д1. Живые данные анкет.** Перед выкаткой — read-only сверка `data/questionnaires/questionnaires.json` новой схемой (команда — в отчёте `dmg-data-keeper`, вывод `.cache/pi-runs/F1-data-keeper.*`), бэкап и правило «откат — только с восстановлением файла». Делать сейчас или на ревизии перед релизом?
