# Бриф среза: модуль `wish` (эталон)

Читай до старта: `../spec.md`, `../plan.md` (текущая фаза), `conductor/architecture/` — `naming.md`, `manifests.md`, `errors-result.md`, `domain-modeling.md`, `rules.md`. Образец формы — учебный модуль `packages/dmg-core/src/testing/example/` (`todo`, `users`).

Срез идёт **фазами по виду артефакта** (план). Агент получает путь к брифу и номер фазы; делает только её.

## Границы

- Домен: `packages/domain/src/wish/**`. Прикладной слой: `packages/wish/src/**`.
- `dependsOn`: `user`, `course`, `questionnaire`, `stream` — только через `@u7-scl/domain/<dep>`.
- Точечно: вызывающие stories и тесты `apps/u7-bot` (Ф12, сосуществование), `scripts/call-uc.ts`.
- Не трогать: `data/`, `packages/dmg-core` (кроме эскалации), чужие модули, их контракты и фасады.
- Структура — `bun run gen … --adopt` (задача Ф0); руками только перенос содержимого.

## Решения брифа

- **DCS/DQS нет.** `list-user-wishes` — query UC, читает один агрегат через репозиторий; output выводится из схемы entity. Гайд «dcs/dqs» описывает критерий выбора, эталон DCS/DQS — в `stream`.
- **Job нет.**
- **Формат данных не меняется:** `F.timestamp` читает ISO-строку и число, пишет число. Репозиторий проверяется на `DB_DIR=./data/fixtures`.
- **Пулы анкет** (`wish/pools/course-pool.ts`, `course.json`) остаются доменными данными модуля, путь не меняется.

## Было → станет (naming.md §2–§3)

Домен `packages/domain/src/wish/`:

| Было | Станет | Фаза |
|---|---|---|
| `wish/entity.ts` (+ `state.ts` — подпуть `./state`) | `wish/wish.state.ts`; `state.ts` реэкспортирует его | 1 |
| `wish/a-root.ts` | `wish/wish.ar.ts` (`WishArDef` + `WishAr`) | 2 |
| `wish/events.ts` (интерфейсы) | `wish/wish.events.ts` (`WishEvents`) | 3 |
| `wish/errors.ts`, `contract.ts` | `wish/wish.errors.ts` (`WishErrors`) | 4 |
| `wish/policy.ts` | `wish/wish.policy.ts` (`WishPolicy`) | 5 |
| `wish/repo.ts` (порт в домене) | `packages/wish/src/wish/wish.repo.ts` | 6 |
| — | `wish.facade.ts` (`WishFacadeDef`) | 7 |
| `wish/commands/<n>-cmd.ts` | `wish/uc/<n>.uc.ts` (`<N>UcDef`) | 8–9 |
| — (ER только в api) | `wish/er/<n>.er.ts` (`<N>ErDef`) | 10–11 |
| `module.ts` (мета + резолвер) | `wish.module.ts` (`WishModuleDef`) | 12 |

Прикладной слой `packages/wish/src/`:

| Было | Станет | Фаза |
|---|---|---|
| `infra/db/wish-json-repo.ts` | `infra/wish.json-repo.ts` | 6 |
| — | `wish.facade.ts` (`implementFacade`) | 7 |
| `api/wish/<n>-uc.ts`, `api/wish-uc.ts` | `wish/uc/<n>.uc.ts` (`UseCaseFromDef`); базовый `WishUseCase` удаляется | 8–9 |
| `api/er/<n>-er.ts` | `wish/er/<n>.er.ts` (`ReactionFromDef`) | 10–11 |
| `api/module.ts` | `wish.module.ts` (`ModuleFromDef`, карта Def → класс) | 12 |
| `domain/index.ts` (barrel DEBT-23) | остаётся | — |

Тесты переезжают вместе с файлом (`<file>.test.ts` рядом).

## Сохраняемое поведение

- Две ветки статусов: `expressed → cancelled | fulfilled`; `pending → confirmed | abandoned`, `confirmed → cancelled | fulfilled`.
- Не более одного активного (`expressed | pending | confirmed`) желания на пару (user, target): проверяются **все** желания на цель, не «последнее».
- `create-course-wish`: курс недоступен для записи или без стартового модуля → `COURSE_NOT_FOUND`; есть пул анкеты → `pending` + `startStandard`, outcome `questionnaire`; нет → `expressed`, outcome `instant`. Дубль → `WISH_ALREADY_EXISTS` с `status` существующего.
- ER: идемпотентность (нереализуемые статусы игнорируются); идентичность курсов и модулей решает фасад курсов (`whichCoursesIncludeModule`, `isSameModule`, `whichModulesAreSame`); `invite-wishers` без `telegramId` → предупреждение и пропуск.
- Публичное поведение для UI: события `wish.invited`, `wish.confirmed` с текущим payload доходят до stories `wish-invite`, `wish-confirmed`.
- Базовая линия: репозиторий 3211 pass / 0 fail; `wish` (домен + пакет) — 107 pass / 14 файлов.

## Открытые вопросы (решаются с Нурболатом до соответствующей фазы)

1. **Ф3/Ф12. Имена событий.** FQN по naming.md — `wish.wish.invited`, а stories подписаны на `'wish.invited'`/`'wish.confirmed'`. Мост `legacyEventBus` передаёт legacy-подписчикам FQN как `eventName` — без решения stories перестанут получать события.
2. **Ф10–11. Входящие события legacy.** ER `wish` слушают `student.enrolled`, `stream.created` (stream) и `questionnaire:complete`/`questionnaire:abandon` — это legacy-события без Def; `legacyEventBus` **не доставляет** legacy-события подписчикам DMG. `defineEventReaction.on` требует Def события. Нужен мост «legacy → DMG» или Def событий зависимостей (их модули не мигрированы).
3. **Ф12. `dependsOn`.** У `user`, `course`, `questionnaire`, `stream` нет `ModuleDef`; `defineModule.dependsOn` ждёт Def. Варианты: stub-Def зависимостей (долг) или временное ослабление.
4. **Ф7. Содержимое фасада.** Сейчас у `wish` нет фасада и внешних потребителей фасада (UI ходит через `appApi`). Что выставить в `WishFacadeDef` без спекулятивного API.
5. **Фасады зависимостей** (`CourseFacade` и др.) — legacy: `boolean`/`undefined`, без `Result`. UC `wish` вызывает их как есть; перевод — в их треках.

## Правила (ID rules.md)

ARC-02, ARC-04, ARC-06; DOM-01…05, DOM-09…12; MAN-01…11; ERR-01…06; API-01…05; CODE-01…03; TST-01…06.

## Критерии приёмки среза

См. `../spec.md` «Критерии приёмки». По фазе — гейт `bun run scripts/agent-gate.ts`, затем `bun run check` и отчёт reviewer без `error`.

## Отчёты агентов

(заполняет оркестратор по фазам)
