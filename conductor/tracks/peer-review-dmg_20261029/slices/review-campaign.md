# Бриф среза: `peer-review` / `review-campaign`

Черновик — `architect`, ныне `tech-lead` (Sonnet, Ф0), проверен orchestrator'ом: пп. 1–2 и 7 «Расхождений» и MAN-06 сверены с кодом. Читай до старта: `../spec.md`, `../plan.md` (Фаза 1), эталон `wish` и его бриф `conductor/archive/golden-wish_20261020/slices/wish.md`.

## Расхождения с постановкой

1. **ER слушает не `stream.completed`**, а `student.completed` и `student.abandoned` (`modules/peer-review/src/api/er/create-student-campaign-er.ts:30-33`). Комментарий к `StreamCompletedEvent` в `domain/src/stream/stream/events.ts` прямо говорит, что кампании от `stream.completed` не зависят. Формулировку в `migration.md` §2.1/§6 и `spec.md` исправить в Ф4.
2. **Def этих событий в контракте `stream` нет.** `domain/src/stream/contract.ts` экспортирует `StudentEvents.enrolled` и `StreamEvents.created`; в `modules/stream/src/legacy-inbound.ts` те же два маршрута. Нужно добавить `StudentEvents.completed` (`studentId, userId, streamId, moduleId, outcome: 'advanced'|'not_advanced'`) и `StudentEvents.abandoned` (`studentId, userId, streamId, who: 'self'|'mentor', cause`) — исходные формы `domain/src/stream/student/events.ts:33-46`, `:107-120` — и две строки в `streamLegacyInbound`.
3. **Нет Def UC «состав потока».** ER зовёт legacy `streamFacade.getMembers(scopeId)` (`create-student-campaign-er.ts:50`). Нужен `GetStreamMembersUcDef` (`callers: ['system']`, `allowAll`, выход `{ mentorId, students[{ userId, status, neverStarted }] }`, `undefined` — «нет потока», штатный исход по образцу `GetStreamPresenceUcDef`); адаптер TR-11 в `modules/stream/src/stream/uc/` (`StreamLegacy = Pick<StreamFacade, 'getStream'|'getMembers'>`), запись в `streamModuleMap`. Аддитивное изменение чужого контракта — открытый вопрос 1.
4. **`v0.2.6`** — worktree `../u7-school-v0.2.6` (старая раскладка: пакет `peer-review`, каталог `src/`). Код кампаний совпадает с HEAD (отличия — маркеры DEBT и импорты): характеризацию на `v0.2.6` отдельно писать не нужно, достаточно сверки.
5. **`my-reviews.story` тоже зовёт `get-my-campaigns`** (`my-reviews.story.ts:67-68`, `:123-124`) — эти два вызова переходят на `dispatch` в этом срезе, остальное в файле — срез `review`.
6. **Событие переименовывается:** `student-campaign.created` → `peer-review.review-campaign.created` (MAN-08). Затронуты `invite.story` и его тест, `controller.test.ts:24`, e2e smoke.
7. **`external` снимается в Ф1, а не в Ф3:** MAN-06 запрещает ER у внешнего модуля (решения, п. 7).

## Границы

**Домен `domain/src/peer-review`:** `review-campaign/**`; `shared/schema.ts` — только если кампания перестаёт использовать `isoMinuteField` (остаётся для `Review`); `contract.ts`, `peer-review.module.ts` — экспорты и Def среза; `state.ts` — реэкспорт нового state.

**Прикладной слой `modules/peer-review/src`:** `api/review-campaign/*`, `api/er/create-student-campaign-er*`, `infra/db/review-campaign-json-repo*` (заменяется); новая раскладка по `wish`: `review-campaign/{uc,er}`, `review-campaign/review-campaign.repo.ts`, `infra/review-campaign.json-repo.ts`, `peer-review.module.ts`, вход пакета; мосты в `api/module.ts` и `api/review/create-review-uc.ts` (решения, п. 6).

**Вне пакета:**
- `domain/src/stream/contract.ts`, `stream/student/student.events.ts` (аддитивно), `stream/stream/uc/get-stream-members.uc.ts`;
- `modules/stream/src/legacy-inbound.ts`, `stream.module.ts`, адаптер UC;
- `platform/app/src/u7-app.ts` (`:197-217`, `dmgApp` `:300+`), `platform/app/tests/u7-app.test.ts`;
- `runners/u7-bot/src/controllers/peer-review/stories/{campaign.story,invite.story,campaign-profiles,my-reviews.story}.ts` и тесты, `controller.test.ts`;
- `runners/u7-bot/tests/helpers/test-app.ts:8,29,70`, `tests/worlds/types.ts:4,25`, `materializer.ts:88,160`, e2e `peer-review-*.e2e.test.ts`.

**Не трогать:** `data/`; `review/**` в домене и `api/review/*` (кроме моста `create-review-uc`); `peer-review-question-pool*`; `notify-review-recipient-er`; `biome.json` (ARC-07 — Ф3). `modules/peer-review/src/api/errors.ts` и `domain/peer-review/errors.ts` — минимально: убрать `CampaignNotFoundUcError`.

## Решения брифа

1. **Агрегат без жизненного цикла.** `ReviewCampaignArDef` без `statuses`/`transitions` (`aggregate-def.types.ts:98-99`): окно закрывается временем (`expiresAt`), статус `expired` не хранится. Если `AggregateDef` не примет `variant` по `context`, state — `v.object` с `context: literal('stream_fate')`; это первый red-тест на `ReviewCampaignArDef.state`.
2. **State** (`review-campaign.state.ts`, `...BaseEntityFields`, MAN-02, DOM-11/12): `context`, `scopeId`, `subjectId`, `expiresAt: F.timestamp`, `participants: F.uuid[]`, `payload { subjectOutcome, mentorId }`; `createdAt`/`updatedAt` — из `BaseEntityFields` (D-36), `version = 0`. `StudentOutcome` и `CampaignContext` нужны и `Review` (`review/entity.ts:4`, `scope-reviews-ds.ts`) — в `shared/` (рекомендация).
3. **Ar** (`ReviewCampaignAr`, `create(input, at): Result` + `restore`; DOM-02/03/04/14):
   - `create` проверяет инварианты адресации (`a-root.ts:57-80`, сейчас `throwInvariant`) и возвращает отказ как `Result`;
   - `expiresAt = at + 7 суток` (`REVIEW_WINDOW_DAYS.streamFate`); `Date.now()` в Ar нет;
   - событие `created` — из `create` (замена `announceCreated`);
   - вопросы: `isSubject`, `isMentor`, `hasParticipant`, `authorRoleOf(userId)`, `targetIdsFor(userId)`, `isExpired(at)`, `daysLeft(at)`, `view()`, геттеры `scopeId`, `subjectId`, `mentorId`, `subjectOutcome`;
   - `assertCanWrite`/`ensureLive` не переносятся; направление рецензии вычисляет срез `review`.
4. **Правила и Policy:**
   - `ReviewCampaignRules.unique` (D-40, DOM-16) — одна кампания на (`scopeId`, `subjectId`), отказ `ALREADY_EXISTS`. ER трактует его как успех без записи (идемпотентность, `create-student-campaign-er.ts:45-49`).
   - `ReviewCampaignPolicy.isWindowAuthor` — субъект окна или его ментор; в `get-campaign-recipients`. Отказ — `ACCESS_DENIED` вместо `PEER_REVIEW_NOT_PARTICIPANT` (открытый вопрос 4). `get-my-campaigns` — `allowAll`, список строится по субъекту.
5. **Ошибки** (`ErrorDef`, группа `PEER_REVIEW`): `CAMPAIGN_NOT_FOUND` (`not-found`), `ALREADY_EXISTS` (`conflict`); `NOT_PARTICIPANT`, `RECIPIENT_NOT_ALLOWED` объявляются сейчас, чтобы не менять группу в Ф2. Код окна — открытый вопрос 5.
6. **Мост `create-review-uc` до Ф2 (вариант C, TR):** он читает кампанию через `reviewCampaignRepo.findById` + `ReviewCampaignFactory.restore` + `assertCanWrite`/`ensureLive` (`create-review-uc.ts:40-52`). Минимальная правка: берёт `ReviewCampaignAr` из нового порта, проверки — через вопросы Ar, бросает прежние legacy-исключения с теми же кодами. Тесты `create-review-uc.test.ts`, `peer-review-vertical.test.ts` переводятся на новый Ar. Снимается в Ф2.
7. **`PeerReviewModuleDef`:** без `external`; `aggregates: [ReviewCampaignArDef]`, `useCases: [GetMyCampaignsUcDef, GetCampaignRecipientsUcDef]`, `reactions: [CreateStudentCampaignErDef]`. UC рецензий и `notify-review-recipient` — в legacy `PeerReviewApiModule` до Ф2/Ф3.
8. **Def UC:**
   - `getMyCampaigns` — query, `callers: ['user']`, `allowAll`; вход `{ onlyLives?, filter? }` без `userId` (открытый вопрос 7); выход — карточки `campaignId, context, scopeId, subjectId, myRole, expiresAt (F.timestamp), subjectOutcome, daysLeft, progress{done,total}`. `expiresAt` становится числом — stories поле не читают.
   - `getCampaignRecipients` — query, `callers: ['user']`, Policy `isWindowAuthor`, вход `{ campaignId }`; выход `campaignId, context, myRole, mentorId, subjectOutcome, daysLeft, recipients[{ userId, hasMyReview }]`; ошибка `CAMPAIGN_NOT_FOUND`.
   - Часы — `this.now()`.
9. **ER `createStudentCampaign`:** `on: [StudentEvents.completed, StudentEvents.abandoned]`, `touches: [ReviewCampaignArDef]`, `calls: [GetStreamMembersUcDef]`, `emits: [ReviewCampaignEvents.created]`. Проекция исхода и состав адресатов (`create-student-campaign-er.ts:92-131`) — DQS `StudentFateDqs` (`{ outcome, participantIds }` по событию и составу). «Состав недоступен» — `warn` и `ok()` без кампании (`:50-58`).
10. **`CampaignFactsDs` → `CampaignFactsDqs`** (`campaign-facts-ds.ts:58-94`). Рецензии на вход — узкий `readonly { authorId, recipientId }[]` (до Ф2 — из legacy `ReviewRepo`), Ф2 DQS не меняет. Типы `MyCampaignCard`, `MyRecipientsView`, `AuthorRole` → `OutputOf<Def>` через `contract.ts` (их импортируют `campaign-profiles.ts:2-6`, `campaign.story.ts:6`).
11. **Репозиторий** (`modules/peer-review/src/review-campaign/review-campaign.repo.ts`, по `wish.repo.ts`): `Repository<ReviewCampaignAr> & { findById; findBySubject(scopeId, subjectId); findActiveBySubject(userId, at); findActiveByMentor(userId, at) }` — `at` параметром (legacy читает часы внутри, `review-campaign-json-repo.ts:63,71`). `ReviewCampaignJsonRepo extends VersionedRepository` (`infra/review-campaign.json-repo.ts`). Порт в домене (`review-campaign/repo.ts`) удаляется. Защита от дубля пары в `write` остаётся как инвариант хранилища (бросает); штатный отказ — правило `unique`. Подключение — `uow.register` в ER.
12. **Строгий разбор записей** (как TR-2 у `wish`): `v.parse` бросает на невалидной записи, файл не читается и не перезаписывается. Мягкий пропуск опасен: `write` переписывает файл целиком и затрёт пропущенное. Открытый вопрос 3.
13. **TZ `expiresAt`:** новый код сравнивает числа; ISO без зоны читается как UTC (раньше — локальное время). Контрольный тест на границу окна с `TZ=Asia/Oral` — у `test-designer`. Открытый вопрос 8.
14. **Stories → `dispatch`** (`this.dispatchUc(PeerReviewModuleDef, command, actor)`, `u7-bot-ui-story.ts:166`; образец — `course-catalog.story.ts:177`): `campaign.story.ts:151-160, 225-229, 336-340, 376-380`, `my-reviews.story.ts:67, 123`. Отказ — `Result`, ветвление по `code`. `invite.story` подписывается на FQN `ReviewCampaignEvents.created` (образец — `wish-invite.story.ts:17-21`), тело прежнее. Вызовы `get-my-review`, `create-review`, `list-my-reviews`, `get-stream`, `get-users-by-ids`, `get-user` остаются на `appApi.execute`. Тексты S02–S06 не меняются.

## Шаги (по ролям)

1. **test-designer.**
   - Характеризация (сценарии существующих тестов как ожидания нового кода): `review-campaign-factory.test.ts`, `a-root.test.ts`, `entity.test.ts` (инварианты, окно 7 суток, `daysLeft`, цели по ролям, посторонний); `campaign-facts-ds.test.ts`; `get-my-campaigns-uc.test.ts`; `get-campaign-recipients-uc.test.ts`; `create-student-campaign-er.test.ts` (исходы, участники, идемпотентность, «состав недоступен», событие); `review-campaign-json-repo.test.ts`, `peer-review-vertical.test.ts`, `u7-app.test.ts`.
   - Red по Def: `ReviewCampaignArDef.state` (legacy-запись: `updatedAt = createdAt`, ISO → число UTC), `ReviewCampaignEvents.created`, `ReviewCampaignErrors`, Policy и `Rules`, `GetMyCampaignsUcDef`, `GetCampaignRecipientsUcDef`, `CreateStudentCampaignErDef`, `GetStreamMembersUcDef`, `StudentEvents.completed/abandoned`, `PeerReviewModuleDef` (`checkDefs`, без `external`), `legacy-inbound.test.ts` (два маршрута).
   - Тесты репозитория — по списку аудита данных ниже; невалидная запись — «бросает, файл цел».
   - Граница TZ (решения, п. 13).
2. **migrator, домен.** Структура — `bun run gen aggregate peer-review.review-campaign --adopt` (если `--adopt` не подходит — вручную по `wish`). Файлы: `review-campaign.{state,errors,events,ar,policy,rules}.ts`, `uc/{get-my-campaigns,get-campaign-recipients}.uc.ts`, `er/create-student-campaign.er.ts`, `campaign-facts.dqs.ts`, `student-fate.dqs.ts`. Импорты — только `dmg-core`. `contract.ts`. Контракт `stream`: `StudentEvents.completed/abandoned`, `GetStreamMembersUcDef`.
3. **migrator, прикладной слой.** `UseCaseFromDef`/`ReactionFromDef`, `peerReviewMap`, `createPeerReviewModule(deps)`, порт и `ReviewCampaignJsonRepo`, вход пакета (TR-35 п. 1, как `wish`); адаптер `GetStreamMembersUc` и inbound в `modules/stream`; `u7-app.ts` — фабрика в `dmgApp`, legacy-резолвер на новый порт, из `PeerReviewApiModule` убираются ER и 2 UC; e2e-миры; мост `create-review-uc`.
4. **migrator, stories** (п. 14): моки `appApi.dispatch` (`course-catalog.story.test.ts:161-185`), `test-app.ts`, `worlds/types.ts` (тип мира — ввод с ISO, не state), e2e. `bun run test:bot` зелёный, сценарии `peer-review-*.e2e` не потеряны.
5. **data-keeper** — итоговый state и репозиторий против аудита.
6. **reviewer** — по diff среза.

## Было → станет

### Домен

| Было | Станет |
|---|---|
| `review-campaign/entity.ts` (`variant`, `isoMinuteField`) | `review-campaign.state.ts` (`ReviewCampaignState`, `F.timestamp`) |
| `a-root.ts` (`Aggregate` из `core`, `throwError`, `announceCreated`) | `review-campaign.ar.ts` (`ReviewCampaignArDef`, `ReviewCampaignAr`) |
| `review-campaign-factory.ts` | `ReviewCampaignAr.create` / `.restore`; фабрика удаляется |
| `events.ts` (`StudentCampaignCreatedEvent`) | `review-campaign.events.ts` (`ReviewCampaignEvents.created`) |
| `errors.ts` (3 `*UcError` из `core`) | `review-campaign.errors.ts`; `CAMPAIGN_NOT_FOUND` из корневого `errors.ts` переезжает сюда |
| `constants.ts` | остаётся |
| `repo.ts` | удаляется; порт — в `modules/peer-review` |
| `commands/*-cmd.ts` (DEBT-25) | `uc/*.uc.ts` |
| `campaign-facts-ds.ts` | `campaign-facts.dqs.ts` |
| — | `review-campaign.policy.ts`, `review-campaign.rules.ts`, `student-fate.dqs.ts`, `er/create-student-campaign.er.ts` |
| `module.ts` (DEBT-26) | до Ф3; из резолвера убирается `reviewCampaignRepo`, из `PeerReviewUcMetas` — меты кампаний |
| `peer-review.module.ts` (`external: true`) | без `external`, Def кампаний |
| `state.ts` → `review-campaign/entity` | → `review-campaign.state` |

### Прикладной слой

| Было | Станет |
|---|---|
| `api/review-campaign/*-uc.ts` (`U7UseCase`) | `review-campaign/uc/*.uc.ts` (`UseCaseFromDef`) |
| `api/er/create-student-campaign-er.ts` | `review-campaign/er/create-student-campaign.er.ts` (`ReactionFromDef`, `inbound`) |
| `infra/db/review-campaign-json-repo.ts` (`JsonFileRepo`) | `infra/review-campaign.json-repo.ts` (`VersionedRepository`) |
| `api/module.ts` (7 UC + 2 ER) | 5 UC + 1 ER рецензий до Ф3 |
| — | `peer-review.module.ts` (`PeerReviewDeps`, `peerReviewMap`, `createPeerReviewModule`) |
| `src/index.ts` | + фабрика, порт, `ReviewCampaignJsonRepo` |

## Сохраняемое поведение (`v0.2.6` = текущие тесты)

- **Окно:** 7 суток от события; истечение включительно (`now >= expiresAt`); `daysLeft` вверх, минимум 1, истёкшая — 0 (`a-root.ts:140-155`).
- **Адресаты:** субъект → participants + ментор; ментор → только субъект; пустой `participants` → только ментор; посторонний — отказ (`:178-206`).
- **Инварианты:** participants уникальны; субъект и ментор не в participants (`:57-80`).
- **Идемпотентность ER:** повтор пары (`scopeId`, `subjectId`) — без записи и события (`create-student-campaign-er.ts:43-49`).
- **Исходы:** `student.completed` → `advanced` = `completed_passed`, иначе `completed_not_passed`; `student.abandoned` → `never_started` при `neverStarted`, иначе `dropped` (`:119-131`).
- **Участники:** `abandoned` → `[]`; `completed` → студенты потока без субъекта и без `status === 'abandoned'` (`:97-105`).
- **Нет состава потока:** `warn` «Состав потока недоступен — кампания не создана», кампании нет (`:50-58`).
- **Событие для UI:** после сохранения; payload `campaignId, context, scopeId, subjectId, mentorId, subjectOutcome`; UI приглашает субъекта и ментора.
- **`get-my-campaigns`:** субъектные и менторские; `onlyLives`, фильтры `context`, `scopeId`; прогресс по рецензиям автора (`get-my-campaigns-uc.ts:38-83`).
- **`get-campaign-recipients`:** `CAMPAIGN_NOT_FOUND` «Кампания отзывов не найдена» (`:37-47`).
- **Тексты S02–S06** (`campaign-profiles.ts`) не меняются.

**Меняется (открытые вопросы):** код отказа постороннему (`ACCESS_DENIED`); `expiresAt` в выходе — число; код `REVIEW_WINDOW_CLOSED`; имя события; формат записей (число, читаются оба); невалидная запись — исключение вместо пропуска.

## Внешние зависимости

- **`stream`** (`dependsOn` есть): inbound `StudentEvents.completed/abandoned` и `GetStreamMembersUcDef` — добавить; адаптер TR-11 над `StreamInProcFacade.getMembers`.
- **`user`**, **`questionnaire`** — в срезе не вызываются (`notify-review-recipient`, пул вопросов — Ф2).
- **Шина:** `student.*` из legacy-шины по `inbound` (`dmgContext` в `u7-app.ts:262-267`); событие кампании публикует DMG-шина, stories подписаны по FQN.
- Legacy `PeerReviewApiModule` остаётся в `ApiApp` рядом с DMG.
- DEBT-34: импорты чужого `index` — в `domain/peer-review/module.ts`, уходят в Ф3; новый код ходит в `stream` только через `contract`.

## Долг

- **DEBT-25 (кампании):** снимаются импорты `@u7-scl/core` в `review-campaign/**`; запись остаётся до Ф2.
- **DEBT-28 (кампании):** `isoMinuteField` уходит из state кампании; `shared/schema.ts` с `biome-ignore` остаётся для `Review` до Ф2.
- **DEBT-26, 29, 34, 27** — не затрагиваются в срезе (кроме удаления `reviewCampaignRepo` из резолвера).
- **Новые TR:** мост `create-review-uc` (до Ф2); аддитивный контракт `stream` и адаптер (TR-11, снимается треком `stream`); строгий разбор (как TR-2); снятие `external` в Ф1.

## Решения Нурболата по открытым вопросам (2026-10-29)

1. ✅ **Контракт `stream` дополняется** `StudentEvents.completed/abandoned`, `GetStreamMembersUcDef` и адаптером TR-11.
2. ✅ **`external` снимается в Ф1**; Ф3 — проверка и удаление legacy.
3. ✅ **Строгий разбор** (решение поручено orchestrator'у) — TR-37. На проде невалидных записей не было.
4. ✅ **`ACCESS_DENIED`** вместо `PEER_REVIEW_NOT_PARTICIPANT` в `get-campaign-recipients`.
5. ✅ **Вариант A:** `PEER_REVIEW_WINDOW_CLOSED` в группе `PEER_REVIEW`, правка `campaign.story.ts:123`.
   **Пересмотрено (Нурболат, 2026-10-29, ERR-04 — префикс агрегата):** ошибки кампании — `REVIEW_CAMPAIGN_NOT_FOUND`, `_ALREADY_EXISTS`, `_INVALID_PARTICIPANTS`. Ошибки записи рецензии (`WINDOW_CLOSED`, `NOT_PARTICIPANT`, `RECIPIENT_NOT_ALLOWED`) — агрегата `Review`, объявляются в Ф2 как `REVIEW_*`; до Ф2 мост `create-review-uc` бросает прежние legacy-коды, `campaign.story.ts:123` правится в Ф2. Решения брифа п. 5 и сигнатуры test-designer в этой части заменены.
6. ✅ **Вариант C:** мост `create-review-uc` на новый `ReviewCampaignAr` (TR, снимается в Ф2).
7. ✅ **Вход UC без `userId`/`authorId`** — пользователь берётся из субъекта.
8. ✅ **UTC.** Сервер на проде — `Etc/UTC`, поэтому толкование не меняется. Тест с `TZ=Asia/Oral` снят (Нурболат, 2026-10-29): прод и хранение в UTC, зона пользователя — UTC+5 при выводе (DEBT-43).

Бэкап: `scripts/backup.sh` теперь берёт все файлы `data/`, кроме явных исключений (`d7c073a4`, вне трека) — `peer-review/*.json` в снимке. На прод попадёт с выкаткой; до неё перед первой записью новым кодом — `backup:adhoc` (см. аудит).

## Правила (ID rules.md)

DOM-01…06, DOM-10…12, DOM-14…16; API-01, API-03, API-05; MAN-01, MAN-02, MAN-06, MAN-08; ERR-01, ERR-02, ERR-07; CODE-01, CODE-02; ARC-03, ARC-07; TST-01, TST-04, TST-05.

## Критерии приёмки

- В `domain/src/peer-review/review-campaign/**` и `modules/peer-review/src/review-campaign/**` нет `throw*` для штатных отказов, `new Ar`, импортов `@u7-scl/core`, `@u7-scl/app-legacy`.
- Маркеры DEBT-25, DEBT-28 сняты в части кампаний, записи синхронны (`arch:check`).
- `PeerReviewModuleDef` без `external`, `checkDefs` зелёный.
- `legacy-inbound.test.ts`: `student.completed`/`abandoned` доходят как Def; `GetStreamMembersUcDef` и адаптер покрыты тестами.
- Тесты репозитория (фикстуры и временный каталог) зелёные, включая legacy-записи и невалидную запись.
- Сценарии «Характеризации» перенесены без потерь; тест TZ зелёный.
- Stories, `u7-app.test.ts`, e2e на новых Def; `bun run test:bot` зелёный.
- UC рецензий работают через мост; тесты `create-review-uc` зелёные.
- `bun run check` зелёный; `git status data/` чист.

## Аудит данных (data-keeper, Фаза 0)

Источники: legacy-репозитории и тесты, схемы `domain/src/peer-review`, фикстуры, `platform/core/src/infra/json-file-repo.ts`, `fields.ts` пакета, `wish.json-repo.ts`, `scripts/backup.sh`. Живые `data/` не читались.

**Формат.** `<DB_DIR>/peer-review/campaigns.json` и `reviews.json` — JSON-массивы (`JsonFileRepo`); нет файла — пусто. Даты — ISO без зоны до минуты (`isoNow()`, UTC), схема `v.isoDateTime`. `version` нет, `updatedAt?` — только после обновления.
- campaigns: `uuid`, `context` (`'stream_fate'`, вариант по `context`), `scopeId`, `subjectId`, `createdAt`, `expiresAt`, `updatedAt?`, `participants: uuid[]` (может быть пуст), `payload { subjectOutcome (picklist 4), mentorId }`.
- reviews: `uuid`, `scopeId`, `campaignId`, `authorId`, `direction` (picklist 3), `recipientId`, `text` (10..3500), `createdAt`, `authorOutcome?` (picklist 4; у ментора нет), `updatedAt?`.
- Уникальность держит репозиторий: кампания — (`scopeId`, `subjectId`), рецензия — (`campaignId`, `authorId`, `recipientId`). Новый репозиторий обязан сохранить обе.

**Переход на `defineAggregate` + `F.timestamp` + репозиторий по образцу `wish`:**

| Поле | Было | Станет | Совместимость |
|---|---|---|---|
| `createdAt`, `expiresAt`, `updatedAt` | ISO-минута | число (мс) | чтение — да (`F.timestamp` дописывает `Z`); старый код новое не прочтёт |
| `updatedAt` отсутствует | опционально | `= createdAt` (D-36) | да |
| `version` | нет | `0` при чтении | да |
| `authorOutcome`, `payload`, `participants` | — | без изменений | да |
| невалидная запись | пропуск + копия `backups/*.invalid.*` | `v.parse` бросает, файл не читается | **нет** — решение нужно явно (как TR-2 у `wish`) |

- Первая запись переписывает весь файл в новом формате. **Откат кода после неё опасен:** старая схема не примет числовые даты, пропустит все записи, и первый `save` их затрёт (страхует только `*.invalid.*`). Перед выкаткой — бэкап.
- `expiresAt` сравнивается в Ar и `campaign-facts-ds.ts` через `new Date(строка)` — ISO без зоны трактуется как локальное время; `F.timestamp` — как UTC. При TZ сервера ≠ UTC — сдвиг на границе окна.
- `JsonFileRepo<T>` требует один тип входа и выхода (TR-2) → путь `wish` (`VersionedRepository`); согласованно правятся `platform/app/src/u7-app.ts:200` и e2e-миры (`materializer.ts:88`).

**Миграция.** Пакетная в треке не нужна (трек 7): чтение обоих форматов + переписывание при первой записи.

**Бэкап.** `peer-review/*.json` **нет в `FILES` `scripts/backup.sh`** — системный бэкап эти файлы не сохраняет. Перед выкаткой: `bun run backup:adhoc before-peer-review-dmg data/peer-review/campaigns.json data/peer-review/reviews.json`. Включение в системный бэкап — вопрос Нурболату (вне трека).

**Тесты репозиториев (обе коллекции, фикстуры + временный каталог; образец — блок «legacy-записи» `modules/wish/src/infra/wish.json-repo.test.ts`):** ISO → число UTC, `updatedAt = createdAt`, `version = 0`; запись без `updatedAt` / без `authorOutcome` / `participants: []`; legacy-запись читается после `save` соседней; после обновления `version = 1`; невалидная запись — явный ожидаемый исход; дубли пар → ошибка; round-trip нового формата.

**Живые записи (прод `/srv/u7-school`, `v0.2.6`, 2026-10-29, только чтение):** `campaigns.json` — 65 записей, поля `context, createdAt, expiresAt, participants, payload, scopeId, subjectId, uuid`, даты — строки, `updatedAt` нет ни у одной; `reviews.json` — 24 записи, поля `authorId, authorOutcome, campaignId, createdAt, direction, recipientId, scopeId, text, updatedAt, uuid`, даты — строки. Каталога `backups/*.invalid` нет. TZ сервера — `Etc/UTC`.

## Отчёты агентов

### test-designer (Ф1, Sonnet)

21 тестовый файл + хелпер `modules/peer-review/src/review-campaign/review-campaign.fixture.ts`; `TZ=Asia/Oral bun test` — 30 fail (нет модулей/Def, `external`), 1 pass (`ArchChecker`). Характеризация покрыта старыми тестами — сценарии перенесены как ожидания нового кода.

**Старый тест → новый (перенос — автор):** `review-campaign-factory`, `a-root`, `entity` → `D/review-campaign.{ar,state}.test.ts` (`ensureLive`/`assertCanWrite`/`reviewTargets` не переносятся — их сценарии держит мост `create-review-uc`); `campaign-facts-ds` → `D/campaign-facts.dqs.test.ts`; `get-my-campaigns-uc`, `get-campaign-recipients-uc` → `M/review-campaign/uc/*.uc.test.ts`; `create-student-campaign-er` → `M/review-campaign/er/…` + `D/student-fate.dqs.test.ts`; `review-campaign-json-repo` → `M/infra/review-campaign.json-repo.test.ts`; `peer-review-vertical` → `M/peer-review.module.test.ts` (кампании). Автор правит `u7-app.test.ts`, `stream.module.test.ts`; `legacy-inbound.student-fate.test.ts` можно слить с `legacy-inbound.test.ts`. (`D` = `domain/src/peer-review/review-campaign`, `M` = `modules/peer-review/src`.)

**Сигнатуры, зафиксированные тестами** (автор следует им): `ReviewCampaignAr.create({ uuid, scopeId, subjectId, mentorId, subjectOutcome, participantIds }, at)`; `authorRoleOf` постороннему → `undefined`, `targetIdsFor` → `[]`; `isMentor`. Ошибки: `CAMPAIGN_NOT_FOUND` (`not_found`), `ALREADY_EXISTS` (`conflict`), `NOT_PARTICIPANT` (`access`), `RECIPIENT_NOT_ALLOWED`, `WINDOW_CLOSED` (`conflict`, payload `{ campaignId, expiresAt }`), `INVALID_PARTICIPANTS` (`validation`, TR-38). `ReviewCampaignRules.unique({ scopeId, subjectId, campaigns })`; Policy — контекст `{ campaign }` (`ReviewCampaignCtx`). `CampaignFactsDqs.myCampaignFacts(ar, userId, reviews, at)`, `.recipientsWithMyReview(ar, userId, reviews)`; `StudentFateDqs.forCompleted({ userId, outcome }, members)`, `.forAbandoned({ userId }, members)` → `{ outcome, participantIds }`. Deps прикладного слоя `{ app, facades, campaigns, reviews }`, `reviews.findByCampaignAndAuthor` — форма legacy `ReviewRepo`. Экспорты: `createPeerReviewModule`, `peerReviewMap`; Def `getMyCampaigns`, `getCampaignRecipients`, `createStudentCampaign`, `getStreamMembers`.

**Решения orchestrator (TR-38):** код инварианта адресации — `PEER_REVIEW_INVALID_PARTICIPANTS`; `get-my-campaigns` — только живые и без `onlyLives` (как `v0.2.6`). Возможная строгость `F.uuid` к UUID фикстур (`3333…`) проявится в тесте чтения фикстур.

### migrator — домен и контракт `stream` (Ф1, Sonnet)

Домен кампаний: `review-campaign.{state,errors,events,ar,policy,rules}.ts`, `campaign-facts.dqs.ts`, `student-fate.dqs.ts`, `uc/*`, `er/*`, `shared/campaign-fields.ts`; `PeerReviewModuleDef` без `external`. `stream`: `StudentEvents.completed/abandoned`, `GetStreamMembersUcDef` (в `useCases` модуля — иначе `checkDefs` не принимает `calls` ER), адаптер TR-11 `GetStreamMembersUc`, два маршрута inbound. Эскалации: ERR-04 (решено Нурболатом — группа `REVIEW_CAMPAIGN`), проверка `'statuses' in ArDef` и утечка TZ — дефекты тестов, исправил `test-designer`. Отклонения: `myCampaignFacts` → `undefined` для постороннего; время в выходе UC — строго число (`epochMsField`), `F.timestamp` принимает ISO; инвариант адресации при `restore` — схемой.

### migrator — прикладной слой (Ф1, Sonnet)

`modules/peer-review/src`: `peer-review.module.ts`, `review-campaign/{uc,er}/*`, `review-campaign.repo.ts`, `review-facts.reader.ts`, `infra/review-campaign.json-repo.ts` (`VersionedRepository`, строгий разбор). Мост `create-review-uc` на новом Ar с прежними legacy-кодами. `u7-app.ts`: `PeerReviewModuleDef` в `dmgApp`, в `PeerReviewApiModule` — 5 UC и ER `notify`. Удалены legacy кампаний в домене и пакете вместе с тестами. Сценарии: ER 10 → 13, recipients 9 → 7 (часть — в домене), my-campaigns 5 → 9, repo 6 → 20, `create-review-uc` 13 → 16 (+3 из удалённого `a-root.test.ts`), `u7-app` 7 → 9. Отклонения — TR-38 пп. 5–6.

### migrator — stories (Ф1, Sonnet)

`campaign.story` (адресаты, «мои кампании»), `my-reviews.story` → `dispatchUc(PeerReviewModuleDef, …)`; `REVIEW_CAMPAIGN_NOT_FOUND` по `code` → экран S03 (текст прежний), прочие отказы — `ucErrorNotify`. `invite.story` подписан на FQN `ReviewCampaignEvents.created`. Импорты бота — `@u7-scl/domain/peer-review/contract`; в контракт добавлены type-экспорты `Review`, `ReviewDirection`, `RecipientReviewsGroup`, `StudentOutcome` (как `User` у `user`, TR-35 п. 2). Миры: `WorldCampaign` (ввод с ISO). Тест-кит `stories/peer-review-dmg.test-kit.ts`. e2e `reviews-for-me` — кампания создаётся событием `student.completed` вместо записи сырого state. `test:bot` 978 → 979 pass (+1 — NOT_FOUND в S03).

**Гейт orchestrator:** `CI=true bun run check` зелёный — 3392 pass, `arch:check` 0 нарушений, `test:tz` 20 + 20 pass; `git status data/` чист.

### data-keeper — по diff `6ac8d0e0..2d03728b` (Ф1, Sonnet)

Расхождений с аудитом нет: ISO → число UTC, `updatedAt = createdAt`, `version = 0`, `participants: []`, round-trip, уникальность пары (`json-repo.ts:143-154`), строгий разбор без перезаписи файла (`:165-169`, тесты сверяют текст до и после), путь и формат JSON-массива прежние (`u7-app.ts:188-190`), `reviews.json` не затронут, миры e2e пишут ISO как legacy. Недостающих тестов нет. Риски: откат кода после первой записи — только из копии, не `git revert`; строгий разбор — TR-37 (утверждён). Риск «`peer-review` вне системного бэкапа» — устаревший: `backup.sh` после `d7c073a4` копирует весь `data/` вне `EXCLUDE` (проверено orchestrator'ом). Перед выкаткой — `backup:adhoc` по аудиту.

### reviewer — по diff `6ac8d0e0..2d03728b` (Ф1, Sonnet)

| ID | файл:строка | суть | severity | решение |
|---|---|---|---|---|
| ERR-01 | `modules/peer-review/src/review-campaign/uc/get-campaign-recipients.uc.ts:49` | `throw` в недостижимой ветке после Policy | minor | исправить (TR-38 п. 7) |
| — | `modules/peer-review/src/infra/review-campaign.json-repo.ts:73` | `throw` при дубле пары в `write` | question | оставить: инвариант хранилища (бриф п. 11), штатный отказ — `unique` |
| TST-05 | `modules/peer-review/src/infra/review-campaign.json-repo.test.ts:241` | потеряна проверка «повторный save не дублирует» (число записей) | minor | вернуть (TR-38 п. 7) |

Критерии приёмки, сохраняемое поведение, мост `create-review-uc` (коды и порядок проверок прежние), тексты S02–S06 — без замечаний. Перенос сценариев: потерь нет; `get-campaign-recipients` 9 → 7 — два «доступ запрещён» слиты в `it.each`. Намеренно сняты: минутная точность `createdAt`, генерация uuid в фабрике (теперь в ER), клон-снапшот `participants`.
