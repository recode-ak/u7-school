# Долг тестов (`T-DEBT-<n>`)

**Назначение:** найденные, но ещё не почищенные лишние тесты и повторы в тестовом коде. Правила, формат и каталог признаков (Б-1…Б-19) — [README.md](./README.md) §1, §3.

**Последний выданный ID:** T-DEBT-7

---

### T-DEBT-1: одно правило `isSelf` двумя тестами Policy студента
- **Файлы:** `domain/src/stream/student/student.policy.test.ts`
- **Дублирует:** «сам студент» (`SUBSCRIBER`) и «роли не важны» (`GUEST`) — одно правило `isSelf` (Б-6)
- **Решение:** свести в один `it.each`
- **Погашает:** трек `pre-dmg-ui-cleanup`, Ф4

### T-DEBT-2: мёртвые моки `appApi.execute` в тестах stories
- **Файлы:** `runners/u7-bot/src/controllers/learning/stories/hub.test.ts`, `runners/u7-bot/src/controllers/mentor/stories/activate-stream.test.ts`, `runners/u7-bot/src/controllers/learning/stories/progress.test.ts`, `runners/u7-bot/src/controllers/school/stories/school-info.story.test.ts`
- **Дублирует:** ничего не проверяют — stories вызовов через `execute` не делают
- **Решение:** удалить моки
- **Погашает:** трек `pre-dmg-ui-cleanup`, Ф4

### T-DEBT-3: команды регистрации проверены в `ui-app.test.ts` повторно
- **Файлы:** `runners/u7-bot/src/core/ui-app.test.ts` — блок проверок команд регистрации (≈ строки 148–162)
- **Дублирует:** `ensure-registered.test.ts` (Б-1)
- **Решение:** оставить одно утверждение «регистрация вызвана»
- **Погашает:** трек `pre-dmg-ui-cleanup`, Ф4

### T-DEBT-4: тесты-некрологи удалённых полей и тавтология резолвера
- **Файлы:** `runners/u7-bot/src/create-ui-app.test.ts`, `runners/u7-bot/src/core/u7-bot-ui-story.test.ts`
- **Дублирует:** негативные проверки удалённых полей (`userFacade`, `userController`, `subjectOf`) гарантирует тип (Б-15, TST-09); «отказ резолвера → исключение» — тавтология (Б-11)
- **Решение:** удалить
- **Погашает:** трек `pre-dmg-ui-cleanup`, Ф4

### T-DEBT-5: локальные помощники `subHandler`/`subscriptionOf` в тестах stories
- **Файлы:** `runners/u7-bot/src/controllers/streams/stories/inactivity.story.test.ts`, `runners/u7-bot/src/controllers/courses/stories/{wish-invite,wish-confirmed}.story.test.ts`, `runners/u7-bot/src/controllers/questionnaire/stories/questionnaire-dmg.test-kit.ts` — и ещё три файла `questionnaire`/`peer-review` с тем же помощником
- **Дублирует:** поиск подписки по `def.name` повторён в каждом файле
- **Решение:** один помощник в `runners/u7-bot/tests/helpers`
- **Погашает:** трек `pre-dmg-ui-cleanup`, Ф4

### T-DEBT-6: фикстура «долг вне Места» повторена в тестах проверок
- **Файлы:** `scripts/domain-check.test.ts` — фикстура `C-DEBT-2` (≈ строки 527–543)
- **Дублирует:** `scripts/arch-check.test.ts` и `runDebtCheck`
- **Решение:** оставить одну проверку при переносе проверки долга в `dmg-core`
- **Погашает:** трек `pre-dmg-ui-cleanup`, Ф2

### T-DEBT-7: повтор Job в тот же день проверен в двух e2e
- **Файлы:** `runners/u7-bot/tests/e2e/student-dmg.e2e.test.ts` — тест «повторный runJob в тот же день ничего не шлёт»
- **Дублирует:** частный случай P8-04 в `inactivity.e2e.test.ts` (Б-4)
- **Решение:** оставить один, в `inactivity.e2e`
- **Погашает:** трек `pre-dmg-ui-cleanup`, Ф4
