# Бриф среза: ранние модули `wish`, `peer-review` (Ф5)

> Разбор — `dmg-tech-lead` (Sonnet), решения — orchestrator (2026-11-14). Оба модуля уже на `dmg-core`; отставание от `stream`/`course` — тесты UC/ER на JSON во временном каталоге (C-DEBT-40), нет фейков, у `peer-review` лишняя зависимость и DQS-литералы. **Поведение для пользователя не меняется.**

## Границы

- Трогаем: `domain/src/{wish,peer-review}/`, `modules/{wish,peer-review}/`, `modules/peer-review/package.json`, `bun.lock`, `scripts/arch-check.test.ts` (ожидание графа).
- Не трогаем: `data/`, бот и stories (`runners/*`), чужие модули, `questionnaire`, `conductor/` (только orchestrator).
- Образцы фейков: `modules/stream/src/stream/stream.repo.fake.ts`, `modules/stream/src/student/student.repo.fake.ts`, `modules/stream/src/stream/uc/stream-uc.fixture.ts` (`makeEnv`, `env.streams.saved`); `modules/course/src/*/*.repo.fake.ts`. Справка — `node_modules/dmg-core/docs/reference/testing.md` §3–4 (D-55).
- Образец DQS-класса: `domain/src/stream/passed-modules.dqs.ts`.

## Решения

1. Фейк — рядом с портом: `<a>.repo.fake.ts`, `XRepoFake extends MemoryRepo<XAr, XState>`; `findById` — `restored`; тривиальные выборки — `where`; выборки с окном времени или составным фильтром (`findActiveBySubject/ByMentor`, `findByScopes`, `findByRecipient`, `findAllByUserAndTarget`) — `unanswered`, ответ задаёт тест. Корректность выборок — контрактные тесты `infra/*.json-repo.test.ts`, они остаются (`mkdtemp` там законен).
2. Перевод тестов: `Bun.write(file, …)`/`new XJsonRepo(file)` → `fake.seed(state)`; «что записано» — `fake.saved`/`restored(uuid)`; блоки `mkdtempSync/rmSync` удаляются. Сценарии 1:1, имена `it` не меняются (TST-08). Тест, проверяющий файл на диске, в UC/ER-тесте — дубль infra: удалить, строкой «Кандидат в чистку тестов» в отчёт.
3. **Вертикали** `modules/wish/src/wish.module.test.ts`, `modules/peer-review/src/peer-review.module.test.ts` — тоже на фейки (одна идея «UC/ER/модуль — фейки, диск — infra»; у `stream` так же).
4. DQS `peer-review` (4 литерала) → классы, данные в конструктор: `new CampaignFactsDqs(campaign, reviews).myFacts(userId, at)` (DOM-07).
5. `FactsReviewRepo` (`modules/peer-review/src/review/review.fixture.ts:62-114`, `matchesFilter`) заменить `ReviewRepoFake`; хелпер «отзывы из фактов» — функция, строящая `seed(...)`. Риск: `FactsReviewRepo.findByCampaignAndAuthor` не сверяет `campaignId` — в фактах ставить `campaignId` кампании теста; где неудобно — `unanswered`.
6. Вход `wish`: `index.ts` с `export *` — внутренний, внешние потребители (бот) импортируют только `contract`/`testing`. Не правим, долга нет.
7. `dependsOn` `wish` (`user, course, questionnaire, stream`) — `questionnaire` используется, не меняется.

## Шаги

**dmg-domain-author:**
1. `domain/src/peer-review/peer-review.module.ts` — убрать `QuestionnaireModuleDef` (импорт, `dependsOn`); `peer-review.module.test.ts` → `['user', 'stream']`; `scripts/arch-check.test.ts` — `'peer-review': ['user', 'stream']`.
2. Удалить `domain/src/peer-review/peer-review-question-pool.ts` и `.test.ts`, экспорт из `domain/src/peer-review/index.ts`.
3. DQS → классы: `campaign-facts.dqs.ts`, `student-fate.dqs.ts`, `review-draft.dqs.ts`, `scope-reviews.dqs.ts`; их тесты 1:1; типы не менять.
4. `domain/src/wish/wish/wish.fixture.ts` по образцу `domain/src/stream/stream/stream.fixture.ts` (сборщик `WishState`; экспорт через `testing.ts`, если нужен вне домена).
5. CODE-04: устаревшие комментарии `domain/src/wish/wish/wish.policy.ts` («legacy-UC без Policy», «с Ф8»). `legacy` в `*json-repo*` (D-36) не трогать.

**dmg-api-author:**
6. Вызовы DQS на классы: `get-my-campaigns.uc.ts`, `get-campaign-recipients.uc.ts`, `create-review.uc.ts`, `list-scope-reviews.uc.ts`, `create-student-campaign.er.ts`.
7. `modules/peer-review/package.json` — убрать `@u7-scl/questionnaire`; `bun install`.
8. Фейки: `modules/wish/src/wish/wish.repo.fake.ts`, `modules/peer-review/src/review/review.repo.fake.ts`, `modules/peer-review/src/review-campaign/review-campaign.repo.fake.ts`.
9. Перевод тестов UC/ER и вертикалей (таблица ниже); `FactsReviewRepo` удалить. CODE-04: «перенос legacy `api/...`» в шапках тестов.

Тесты — переезд существующих сценариев (red не нужен: поведение не меняется); проверка — те же тесты зелёные на фейках.

## Было → станет

| Модуль | Тесты на JSON во временном каталоге | Станет |
|---|---|---|
| `wish` UC | `cancel-wish`, `create-course-wish`, `create-module-wish`, `list-user-wishes` | `WishRepoFake` |
| `wish` ER | `abandon-wish`, `confirm-wish`, `fulfill-wish`, `invite-wishers` | `WishRepoFake` |
| `wish` вертикаль | `wish.module.test.ts` | фейк |
| `peer-review` UC | `get-my-campaigns`, `get-campaign-recipients`, `create-review`, `get-my-review`, `list-my-reviews`, `list-scope-reviews`, `list-scope-facts` | фейки |
| `peer-review` ER | `create-student-campaign` | фейки |
| `peer-review` вертикаль | `peer-review.module.test.ts` | фейки |

## Сохраняемое поведение

- Тексты, ошибки, события UC/ER, формат `data/wish/`, `data/peer-review/` не меняются.
- Потребители `peer-review` не меняются: `platform/app/src/u7-app.ts`, `scripts/domain-arch.ts`, `scripts/call-uc.ts`, бот `runners/u7-bot/src/controllers/peer-review/**`, e2e `peer-review-*`. `PeerReviewQuestion*`/`QuestionSkillMapping` никто не импортирует.
- Удаляемый тест: `peer-review-question-pool.test.ts` — «схема пула: валидно/невалидно; questionCode уникальны внутри и между пулами» (1 тест). Прочие удаления — только дубли с записью в отчёт.

## Правила (ID)

TST-08, D-55 (`testing.md` §3–4), DOM-01, DOM-07, CODE-04, ARC-04/06 (`biome.json` — запрет импорта `questionnaire` в `modules/peer-review`), API-03/05.

## Критерии приёмки

1. `bun run check` зелёный; `arch:check`, `dmg:check` без замечаний.
2. `rg "questionnaire" domain/src/peer-review modules/peer-review` и `rg "PeerReviewQuestion|question-pool" domain modules scripts platform runners --glob '*.ts'` — пусто.
3. Три фейка есть; `rg "mkdtemp|JsonRepo" modules/{wish,peer-review}/src --glob '!**/infra/**' --glob '*.test.ts'` — пусто.
4. Число `it` в каждом переведённом файле не меньше исходного, имена сохранены.
5. DQS `peer-review` — классы; `FactsReviewRepo` нет.
6. e2e бота `peer-review-*`, `wish*` зелёные без правок ожиданий.

## Для orchestrator

- C-DEBT-40 удалить из `conductor/debt/code.md` (коммит `закрыть C-DEBT-40`).
- Удалённый тест пула — в `summary.md`; упоминания пула в `conductor/roadmap.md`, `conductor/roadmap/metrics/metrics-pipeline-and-modules.md` — Ф6.

## Отчёты
