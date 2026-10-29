# Бриф среза: `peer-review` / `review` (Ф2)

Перед стартом прочитай `../spec.md`, `../plan.md` (Фаза 2) и бриф [review-campaign.md](./review-campaign.md). Это образец: решения Ф1 действуют, если ниже не сказано иное. Ещё нужен эталон `wish`. Черновик подготовил `tech-lead`, orchestrator проверил его, решения Нурболата — в конце.

Поведение `v0.2.6` (worktree `../u7-school-v0.2.6`) сверено с HEAD. Код `review/*`, `api/review/*` и `api/er/*` совпадает, отличаются только импорты и маркеры DEBT. Поэтому отдельная характеризация на `v0.2.6` не нужна: ожидания — это сценарии текущих тестов.

## Расхождения spec/plan с кодом

1. **ER `notify-review-recipient` снимается.** Уведомление переходит в подписку story (решение 1 Нурболата). Критерии Ф2 поправлены.
2. **Потребителей больше, чем перечислено в плане.** UC рецензий вызывают:
   - `campaign.story.ts:90,99,278` — `get-my-review` и `create-review`;
   - `reviews-for-me.story.ts:62` и `my-reviews.story.ts:83,135` — `list-my-reviews`;
   - `view-stream.story.ts:224` (модуль `streams`) — `list-scope-facts`;
   - `scope-reviews.story.ts:72` и `school-reviews.story.ts:81` — `list-scope-reviews`.
   `review-render.ts` UC не вызывает, только рендерит: `reviewDate(createdAt: string)` разбирает ISO по `T` (`:46-49`).
3. **`peer-review-question-pool` не трогаем.** Файл содержит только данные и схемы valibot, импортов `core` и маркеров DEBT нет. Кроме собственного теста, его никто не импортирует.
4. **Порог `test:bot`:** после Ф1 факт — 979, в критериях Ф2 стоит 979.
5. **Комментарий у `list-scope-facts`** обещает фасад (`list-scope-facts-uc.ts:9`), но фасада нет. Единственный потребитель — `view-stream.story`.
6. **Событие переименовано:** `review.created` → `peer-review.review.created` (MAN-08). Затронуты `ui-spec.md:7` и тесты UC. `CHANGELOG.md` не правим.

## Границы

**Домен `domain/src/peer-review`:**
- `review/**` целиком заменяется по раскладке `wish`: `review.{state,errors,events,ar,policy,rules}.ts`, `uc/`, `*.dqs.ts`.
- Меняются `contract.ts`, `peer-review.module.ts` (добавить `ReviewArDef` и 5 UC) и `state.ts`.
- Удаляются: `shared/schema.ts` (`isoMinuteField` и `uuidField` больше никто не использует), `errors.ts` (legacy `PeerReviewUcErrors`). `shared/campaign-fields.ts` остаётся.
- `index.ts` — без `commands/*`.
- `module.ts` (DEBT-26) только усыхает: убрать `reviewCampaignRepo`, `reviewRepo`, `PeerReviewUcMetas`. Удаление — в Ф3.

**Прикладной слой `modules/peer-review/src`:**
- новое: `review/{uc,review.repo.ts}`, `infra/review.json-repo.ts`;
- меняются: `peer-review.module.ts` (`PeerReviewDeps.reviews: ReviewRepo` вместо `ReviewFactsReader`), `index.ts`;
- удаляются: `api/review/*`, `api/er/notify-review-recipient-er*`, `infra/db/review-json-repo*`, `review-campaign/review-facts.reader.ts`.

**Вне пакета:**
- `platform/app/src/u7-app.ts:186-228` (резолвер `PeerReviewApiModule`), `u7-app-meta.ts`, `platform/app/tests/u7-app.test.ts`;
- `runners/u7-bot/src/controllers/peer-review/stories/{campaign,my-reviews,reviews-for-me,scope-reviews}.story.ts`, `review-render.ts` и их тесты, а также подписчик уведомления (решение 1);
- `controllers/school/stories/school-reviews.story.ts` и `controllers/streams/stories/view-stream.story.ts` с тестами;
- `peer-review-dmg.test-kit.ts`, `tests/helpers/test-app.ts`, `tests/worlds/{types,builder,materializer}.ts`, e2e `peer-review-*.e2e.test.ts`;
- `ui-spec.md` — имя события.

**Не трогать:** `data/`; `review-campaign/**` (кроме геттеров, если они понадобятся вопросам Ar); `peer-review-question-pool*`; `biome.json` (ARC-07 — Ф3); оболочку `PeerReviewApiModule` и `domain/peer-review/module.ts` (Ф3).

## Решения брифа

1. **Агрегат `ReviewArDef`** (`name: 'review'`), как и кампания, без жизненного цикла. Значения полей не меняются. Хранение — как у кампаний: ISO-минута → число UTC (`F.timestamp`).
2. **State** (`review.state.ts`, `...BaseEntityFields`):
   - поля: `scopeId`, `campaignId`, `authorId`, `direction` (`F.picklist`, 3 значения), `authorOutcome?` (`StudentOutcomeSchema`), `recipientId`, `text`;
   - `text`: от 10 до 3500 символов, константы `REVIEW_TEXT_MIN/MAX_LENGTH` и сообщения схемы («Отзыв слишком короткий/длинный») остаются.
   В отличие от кампаний, у живых записей `updatedAt` уже есть: он конвертируется ISO → число, а если его нет — `= createdAt` (D-36). `version = 0`.
3. **Ar** (`ReviewAr`: `create(input, at): Result`, `restore`, `overwrite(text, at): Result`):
   - в Ar нет `Date.now()` и `crypto`: `uuid` передаётся на вход (генерирует UC), время — аргументом `at`; минутное усечение `createdAt` не переносится (как в Ф1);
   - событие `created` создаёт только `create`; `overwrite` события не создаёт, обновляет `updatedAt`;
   - геттеры: `campaignId`, `scopeId`, `authorId`, `recipientId`, `direction`, `authorOutcome`, `text`, `view()`. `authorId` и `recipientId` структурно подходят под `ReviewFact`, поэтому порт `ReviewFactsReader` снимается.
4. **Валидация текста (DEBT-29, CODE-02).** Вместо `#validateText` — правило `ReviewRules.rules.validText` без субъекта (D-40, DOM-16): ошибка `REVIEW_TEXT_INVALID`, payload `{ min, max, length }`, kind `validation`. Контекст `{ text }` собирает `load`. Правило стоит в `rules` Def `createReview`; перезапись идёт тем же UC. Схема state страхует `restore`.
5. **Право и правила `create-review`:**

   | Что | Где | Отказ |
   |---|---|---|
   | субъект — автор окна (`campaign.authorRoleOf(subject)`) | `ReviewPolicy.isCampaignAuthor`, ctx `{ campaign }` | `ACCESS_DENIED` |
   | окно открыто (`!campaign.isExpired(at)`, граница включительно) | `ReviewRules.windowOpen`, ctx `{ campaign, at }` | `REVIEW_WINDOW_CLOSED`, payload `{ campaignId, expiresAt: число }` |
   | адресат из `campaign.targetIdsFor(authorId)` | `ReviewRules.recipientAllowed` | `REVIEW_RECIPIENT_NOT_ALLOWED` |
   | текст от 10 до 3500 символов | `ReviewRules.validText` | `REVIEW_TEXT_INVALID` |

   - Время в ctx даёт `this.now()` в `load` (DOM-14). Порядок правил: `windowOpen` → `recipientAllowed` → `validText`.
   - Policy идёт раньше правил, поэтому посторонний при истёкшем окне получит `ACCESS_DENIED`. Это закрепляет тест.
   - Ошибки объявляются группой `ErrorDef.define('REVIEW', …)`: `WINDOW_CLOSED`, `RECIPIENT_NOT_ALLOWED`, `TEXT_INVALID` (ERR-04).
   - Не объявляются `NOT_PARTICIPANT` (вместо него `ACCESS_DENIED`, решение 2) и `REVIEW_DUPLICATE`: пара перезаписывается, а дубль в хранилище — инвариант `write`.
   - `REVIEW_CAMPAIGN_NOT_FOUND` — ссылкой из `ReviewCampaignErrors` (ERR-03) в `errors` UC (ERR-02).
   - Не ломать `review-campaign.errors.test.ts:20`.
6. **Направление и снимок исхода автора** — `ReviewDraftDqs.of(campaign, authorId, recipientId) → { direction, authorOutcome? }`. Ментор → `mentor_student`. Субъект → ментору `student_mentor`, соученику `student_student`, оба с `authorOutcome = campaign.subjectOutcome`. Логика перенесена из `create-review-uc.ts:107-123`.
7. **Читающие UC:** query, `callers: ['user']`, `allowAll` (решение 3), вход без `authorId`/`userId` (Ф1, решение 7):
   - `getMyReview` `{ campaignId, recipientId }` → `{ found, text? }`;
   - `listMyReviews` `{ filter? }` → `{ reviews }`, новые наверху (`createdAt` ↓, затем `uuid` ↓);
   - `listScopeReviews` `{ scopeIds, filter? }` → `{ scopeIds, recipients }`;
   - `listScopeFacts` `{ scopeId }` → `{ hasReviews, reviewsCount }`.
   В снимках `createdAt` — число (`epochMsField`). `ScopeReviewsDs` → `ScopeReviewsDqs` (`scope-reviews.dqs.ts`), порядок групп и записей прежний.
   **Фильтры** (решение 3): необязательный `ReviewFilter` `{ direction?, recipientId?, campaignId? }` во входе списочных UC. UC передаёт его в репозиторий, в памяти UC и story не фильтруют. Прежний `direction` списка рецензий переходит в `filter.direction`. Stories передают то, что им нужно: `school-reviews` — `direction`.
8. **`createReview`:**
   - `load` читает кампанию через `campaigns.findById` (если нет — `REVIEW_CAMPAIGN_NOT_FOUND`; чтение внутри модуля) и отзыв пары через `reviews.findByPair`;
   - `execute`: пара есть → `overwrite`, иначе → `create` с `ReviewDraftDqs`, затем `uow.register`;
   - выход `{ reviewId, campaignId, recipientId }`; `touches` — только `Review`.
9. **Репозиторий** (`review/review.repo.ts`):
   - `Repository<ReviewAr>` + `findById`, `findByPair`, `findByCampaignAndAuthor`, `findByScope`, `findByScopes(scopeIds, filter?)`, `findByRecipient(recipientId, filter?)`; фильтр применяется в репозитории; `findByCampaign` не переносится, вызовов нет;
   - `ReviewJsonRepo extends VersionedRepository` (`infra/review.json-repo.ts`) по образцу кампаний: строгий разбор (TR-37), дубль пары на `write` — исключение;
   - файл `<DB_DIR>/peer-review/reviews.json`, формат JSON-массива прежний.
10. **Deps:** `PeerReviewDeps = { campaigns, reviews: ReviewRepo }`; `CampaignFactsDqs` принимает `ReviewAr[]`. `dependsOn` не меняется.
11. **`PeerReviewModuleDef`:** `aggregates: [ReviewCampaignArDef, ReviewArDef]`, 7 UC. В `reactions` остаётся ER кампаний (уведомление — решение 1).
12. **Stories → `dispatchUc`** (образец Ф1):
    - 5 вызовов `appApi.execute` переходят на `dispatchUc(PeerReviewModuleDef, …)`;
    - отказ приходит как `Result`, ветвление — по `error.code`: `campaign.story.ts:123` сравнивает с `ReviewErrors.WINDOW_CLOSED.code`, прочие отказы — через `ucErrorNotify`;
    - `view-stream.story.ts:224`: «не `ok` ⇒ `false`», ошибки домена карточку не ломают;
    - `review-render.ts` принимает `createdAt: number` и форматирует **UTC**-дату `dd.mm.yyyy`, видимое поведение не меняется (перевод на UTC+5 — DEBT-43);
    - `get-stream`, `get-users-by-ids`, `get-user` остаются на `appApi.execute`.
13. **Уведомление адресату** (решение 1): story бота подписывается на FQN `ReviewEvents.created` (образец — `invite.story.ts`), получает имена автора и адресата через `get-users-by-ids` и отправляет через `proactiveSender`:
    - тексты прежние («твой соученик / твой студент / твой ментор»);
    - нет `telegramId` адресата или автор не найден — предупреждение, сообщение не отправляется;
    - событие только при первой записи.
    Пять сценариев `notify-review-recipient-er.test.ts` переходят в тест подписчика.
14. **Моки:**
    - тест-кит `peer-review-dmg.test-kit.ts` получает ответы на 5 UC;
    - миры e2e: `WorldReview` с ISO-датами (как `WorldCampaign`), `materializer` пишет legacy-формат;
    - `test-app.ts` берёт `ReviewJsonRepo` из нового пакета.

## Шаги

1. **test-designer:**
   - **Характеризация** — перенос сценариев:
     - `review/a-root.test.ts` (11) → `review.ar.test.ts` и `review.rules.test.ts`;
     - `review/entity.test.ts` (10) → `review.state.test.ts`: legacy-запись ISO → число, `updatedAt` из записи, нет `authorOutcome` у ментора;
     - `review/scope-reviews-ds.test.ts` (2) → `scope-reviews.dqs.test.ts`;
     - `create-review-uc.test.ts` (16), `get-my-review-uc.test.ts` (2), `list-my-reviews-uc.test.ts` (5), `list-scope-reviews-uc.test.ts` (4), `list-scope-facts-uc.test.ts` (2) → `review/uc/*.uc.test.ts`;
     - `infra/db/review-json-repo.test.ts` (8) → `infra/review.json-repo.test.ts`;
     - `api/peer-review-vertical.test.ts` (2) → `peer-review.module.test.ts` (полный цикл через `dispatch`, перезапись без дубля);
     - `notify-review-recipient-er.test.ts` (5) → тест подписчика story.
   - **Red по Def:** `ReviewArDef.state`, `ReviewEvents.created`, `ReviewErrors`, `ReviewPolicy`, `ReviewRules`, 5 `*UcDef`, `ReviewDraftDqs`, `ScopeReviewsDqs`, `PeerReviewModuleDef` (`checkDefs`).
   - **Новые сценарии:**
     - «посторонний при истёкшем окне → `ACCESS_DENIED`»;
     - фильтры `listScopeReviews` и `listMyReviews` (`direction`, `recipientId`, `campaignId`) и `findByScopes`/`findByRecipient` с фильтром;
     - репозиторий: legacy-запись, запись без `authorOutcome`, round-trip, дубль пары → исключение, версия растёт при перезаписи, невалидная запись — исключение, файл цел.
   - **Stories и e2e:**
     - `campaign.story.test.ts`, `my-reviews.story.test.ts`, `scope-reviews.story.test.ts`, `reviews-for-me.story.test.ts`, `school-reviews.story.test.ts`, `view-stream.story.test.ts`;
     - e2e `peer-review-*`.
     Мигрирует их `migrator` в шаге 4: тесты меняются вместе с моками.
2. **migrator, домен:**
   - структура — `bun run gen aggregate peer-review.review --adopt`;
   - удалить `review/{a-root,entity,errors,events,repo,scope-reviews-ds}.ts`, `review/commands/*`, `shared/schema.ts`, `errors.ts` вместе с тестами (сценарии уже перенесены).
3. **migrator, прикладной слой:**
   - `UseCaseFromDef` ×5, `ReviewJsonRepo`, `createPeerReviewModule`;
   - `u7-app.ts`: убрать `reviewCampaignRepo`/`reviewRepo` из резолвера, подключить `ReviewJsonRepo`;
   - удалить мост `create-review-uc`, `api/review/*`, `api/er/*`, `infra/db/*`;
   - `PeerReviewApiModule` остаётся пустой оболочкой до Ф3.
4. **migrator, stories** (п. 12–14): `bun run test:bot` ≥ 979.
5. **data-keeper** — state `review` и `review.json-repo` против аудита Ф0: проходят ли 24 прод-записи новую схему (UUID, длина текста).
6. **reviewer** — по diff среза.

## Было → станет

### Домен

| Было | Станет |
|---|---|
| `review/entity.ts` (`isoMinuteField`) | `review.state.ts` (`F.timestamp`), `ReviewDirectionSchema` |
| `review/a-root.ts` (`Aggregate` из `core`, `throwError`, `#validateText`) | `review.ar.ts` (`ReviewArDef`, `ReviewAr`) |
| `review/events.ts` (`review.created`) | `review.events.ts` (`peer-review.review.created`) |
| `review/errors.ts` + корневой `errors.ts` | `review.errors.ts` (`ReviewErrors`) |
| проверки в мосте `create-review-uc.ts:75-123` | `review.policy.ts`, `review.rules.ts`, `review-draft.dqs.ts` |
| `review/repo.ts` | удаляется, порт — в `modules/peer-review` |
| `review/commands/*-cmd.ts` ×5 (DEBT-25) | `review/uc/*.uc.ts` |
| `scope-reviews-ds.ts` | `scope-reviews.dqs.ts` |
| `shared/schema.ts` (DEBT-28) | удаляется |
| `module.ts` (DEBT-26) | усыхает, удаляется в Ф3 |
| `contract.ts` (type-экспорты `Review`, …) | типы из state и `OutputOf<Def>`; `ReviewEvents`, `ReviewErrors`, 5 `*UcDef` |

### Прикладной слой

| Было | Станет |
|---|---|
| `api/review/*-uc.ts` ×5 (`U7UseCase`, мост) | `review/uc/*.uc.ts` (`UseCaseFromDef`) |
| `api/er/notify-review-recipient-er.ts` | подписчик story бота |
| `infra/db/review-json-repo.ts` (`JsonFileRepo`) | `infra/review.json-repo.ts` (`VersionedRepository`) |
| `review-campaign/review-facts.reader.ts` | удаляется |
| `api/module.ts` (5 UC + ER) | пустая оболочка до Ф3 |

## Что снимается и что остаётся

**Снимается в Ф2:**
- мост `create-review-uc` и `reviewCampaignRepo` в резолвере;
- `ReviewFactsReader`;
- legacy-ошибки `domain/errors.ts` (TR-38 п. 6);
- DEBT-25, DEBT-28 и DEBT-29 в `peer-review`.

**До Ф3 остаются:**
- оболочка `PeerReviewApiModule` (`api/{module,index,errors}.ts`, `module.test.ts`) и `PeerReviewApiModuleMeta`;
- `domain/peer-review/module.ts` (DEBT-26);
- `modules/peer-review/src/domain/index.ts` (DEBT-27);
- `export * from './api'`;
- ARC-07 в `biome.json` и DEBT-34.

## Сохраняемое поведение

- **Первая запись** отзыва создаёт `Review` и событие.
- **Повтор пары** (кампания, автор, адресат) перезаписывает только `text` и `updatedAt`; `uuid` и `createdAt` сохраняются, события нет.
- **Направление и исход автора** — как в `create-review-uc.ts:107-123`.
- **Текст** — от 10 до 3500 символов.
- **Окно:** при `now >= expiresAt` оно закрыто.
- **`get-my-review`:** нет отзыва — `{ found: false }`.
- **`list-my-reviews`:** новые наверху.
- **`list-scope-reviews`:** группы по адресатам в порядке первого появления, фильтр по `direction`; пустой `scopeIds` — пустой список.
- **Уведомление адресату** — только при первой записи, тексты прежние.
- **Тексты stories** S02–S08 и заглушка «⌛ Окно закрылось» не меняются. Дата отзыва в UI — UTC, как сейчас.

**Меняется** (решения Нурболата и TR-39):
- посторонний получает `ACCESS_DENIED`;
- коды ошибок: `REVIEW_CAMPAIGN_NOT_FOUND`, `REVIEW_RECIPIENT_NOT_ALLOWED`;
- `expiresAt` в payload и `createdAt` в снимках — числа;
- имя события;
- новые записи — числами (читаются оба формата);
- невалидная запись — исключение;
- порядок проверок: сначала право, потом окно.

## Долг

- **Гасится:** DEBT-25 (кроме `module.ts`), DEBT-28, DEBT-29.
- **Не затрагивается:** DEBT-26, DEBT-27, DEBT-34 (Ф3).
- **TR-39** — тактические решения среза: строгий разбор `reviews.json` (TR-37), `allowAll` у читающих UC, переименование ошибок и события, пустая оболочка `PeerReviewApiModule`, дата в UI по UTC.

## Правила (ID `rules.md`)

DOM-01…06, DOM-10…12, DOM-14…16; API-01, API-03, API-05, API-07; MAN-01, MAN-02, MAN-04, MAN-05, MAN-06, MAN-08, MAN-13; ERR-01…04, ERR-07; CODE-01, CODE-02; ARC-03, ARC-07; TST-01, TST-04, TST-05.

## Критерии приёмки

- В `domain/src/peer-review/**` и `modules/peer-review/src/**` (кроме оболочек Ф3) нет `throw*` для штатных отказов, `new Ar`, `#`-методов, импортов `@u7-scl/core` и `@u7-scl/app-legacy`. `grep -rn "DEBT-25\|DEBT-28\|DEBT-29" domain/src/peer-review modules/peer-review/src` — пусто.
- `PeerReviewModuleDef`: 2 агрегата, 7 UC; `checkDefs` и `arch:check` зелёные.
- Мост `create-review-uc`, `ReviewFactsReader`, `reviewCampaignRepo` в резолвере и ER `notify-review-recipient` удалены. Уведомление идёт подпиской story, 5 сценариев перенесены.
- Тесты репозитория рецензий — по списку из шага 1.
- Сценарии характеризации перенесены без потерь, сценарий «право → окно» добавлен.
- Stories и e2e работают через `dispatch`; `bun run test:bot` ≥ 979; `bun run check` зелёный; `git status data/` чист.
- Перед выкаткой: `bun run backup:adhoc before-peer-review-review data/peer-review/reviews.json`.

## Решения Нурболата по открытым вопросам (2026-10-29)

1. ✅ **Уведомление адресату (D-41)** — подписка story бота на `peer-review.review.created`, отправка через `proactiveSender`, как `invite.story` у кампаний. ER нет, контракт `user` не меняется. Принятый риск: отзыв сохранён, а уведомление не ушло при сбое доставки, как и в legacy.
2. ✅ **`ACCESS_DENIED`** вместо `REVIEW_NOT_PARTICIPANT`: проверка — `ReviewPolicy`, единообразно с `get-campaign-recipients`. Пересматривает п. 5 решений Ф1 в части `NOT_PARTICIPANT`.
3. ✅ **Доступ к читающим UC** — `allowAll`: отзывы доступны всем, это нормально. Нужны фильтры, чтобы не тащить лишнее: `ReviewFilter` во входе списочных UC, фильтрует репозиторий (п. 7, 9).

Решения orchestrator'а без вопроса (TR-39): имя события по MAN-08; заменённое удаляется в Ф2 вместе с тестами; `peer-review-question-pool` не трогаем; строгий разбор `reviews.json`; дата в UI — UTC до DEBT-43.

## Отчёт test-designer (Ф2)

Новые тесты лежат незакоммиченными по TR-38 п. 1. Результат: 23 red и 21 файл, который не загружается без реализации; 208 старых тестов — pass.

**Файлы:**
- домен: `review/review.{state,ar,rules,policy,errors,events}.test.ts`, `review-draft.dqs.test.ts`, `scope-reviews.dqs.test.ts`, `review/uc/*.uc.test.ts` (Def), `peer-review.review-module.test.ts`;
- прикладной слой: `review/review.fixture.ts`, `review/uc/*.uc.test.ts`, `infra/review.json-repo.test.ts`, `review/review.vertical.test.ts`;
- бот: `stories/review-notify.story.test.ts`.

**Допущения по сигнатурам** (приняты orchestrator'ом, автор может уточнить вместе с тестами):
- контекст `recipientAllowed` — `{ campaign, authorId, recipientId }`, payload — `{ campaignId, authorId, recipientId }`;
- `ReviewFilter` фильтрует по И; чужой `recipientId` в фильтре `listMyReviews` даёт пустой результат;
- UC передаёт фильтр репозиторию и сам в памяти не фильтрует;
- подписчик — `ReviewNotifyStory` (`review-notify`): профили одним `get-users-by-ids`, отправка через `proactiveSender.notify`, предупреждение через `logger.warn`; добавить его в `PeerReviewController.stories`;
- `ReviewJsonRepo(filePath)`; UC — `CreateReviewUc` и т. д., конструктор `({ app, facades, campaigns, reviews }, PeerReviewModuleDef)`.

**Задания автору:**
- слить `peer-review.review-module.test.ts` в `peer-review.module.test.ts` домена и `review.vertical.test.ts` в `peer-review.module.test.ts` пакета; старые паспорта (1 агрегат, 2 UC) обновить;
- заглушки `reviews: { findByCampaignAndAuthor }` в тестах кампаний привести к `ReviewRepo`, иначе упадёт `tsc`;
- убрать из `domain/src/peer-review/index.ts` реэкспорты `review/commands/*` и `review/events`.

## Отчёт migrator (Ф2)

Три шага (домен, прикладной слой, stories) выполнены за один вызов, коммит `6a4cca7b`.

**Эскалации** (решены orchestrator'ом):
- в тесте `overwrite` ожидалась `version: 0`, хотя по D-36 версия растёт — исправлен тест;
- legacy-код домена удалён до шага 3: старые и новые имена конфликтуют в barrel.

**Отклонения:**
- `REVIEW_TEXT_*` вынесены в `review.constants.ts` (DOM-01);
- `ReviewAr.create/overwrite` возвращают `Result<_, never>`, длину текста проверяет только правило `validText`;
- в module-тесте каждая запись идёт со своим `requestId` (D-56);
- тесты кампаний используют `FactsReviewRepo` из `review.fixture.ts` вместо кастов.

**Итог:** `test:bot` — 987 pass.

## Отчёт data-keeper (Ф2)

**Совместимость.** Схема читает legacy-записи: даты ISO читаются как UTC, при отсутствии `updatedAt` берётся `createdAt`, `version = 0`. Поля и ограничения прежние. Миграция не нужна: при первой записи файл целиком переписывается в новом формате.

**Риски:**
- **R1, высокий.** Откат кода после первой записи без восстановления файла приведёт к потере отзывов: legacy-код пропускает числовые даты как невалидные и при следующей записи затирает их. Мера: `backup:adhoc` перед выкаткой (критерий брифа), откат — только вместе с восстановлением файла.
- **R2, средний.** Прочитает ли строгий разбор все живые записи, по коду не проверить: живой файл агент не читал. Нужна read-only проверка `reviews.json`, она требует согласия Нурболата (открытый вопрос на контрольной точке).
- **R3 и R4, низкие:** лишние ключи отбрасываются (так было и раньше), ISO-строки трактуются как UTC (так было и раньше).

## Отчёт reviewer (Ф2)

Замечаний уровня `error` нет. Принятые правки (TR-39 п. 7):
- `create-review` записывает время из `load`, а не второй `now()`;
- `view-stream`: исключение из `dispatchUc` тоже даёт `false`, как в `v0.2.6`;
- добавлен интеграционный тест цепочки «запись → событие → `ReviewNotifyStory`»;
- уточнён doc у `FactsReviewRepo`.

Каст `as unknown as ReviewRepo` в двух UC-тестах фильтров оставлен: там узкие моки одного метода.

## Открытые вопросы на контрольную точку

1. ✅ **R2 data-keeper** (Нурболат разрешил только чтение, 2026-10-29). Прод `kalki_server:/srv/u7-school/data/peer-review/reviews.json` передан по ssh в stdin, на диск не сохранялся, md5 до и после проверки совпадает. Результат: 24 записи, по `ReviewArDef.state` невалидных 0, дублей пар (кампания, автор, адресат) 0. Строгий разбор на проде отзывы не остановит.
