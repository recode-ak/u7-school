# Триаж TR и DEBT (ФР-4)

Все `TR-<n>` с полем «Пересмотреть» (кроме «нет») и открытые `DEBT-<n>` из [debt.md](../../architecture/debt.md) — ровно одна группа:

- **оставить** — решение верное: перенос в гайд или `decisions.md`, TR закрывается;
- **погасить** — тактическая правка в этом треке (→ `fixes.md`);
- **решение** — нужен Нурболат: карточка в [cards.md](./cards.md).

| Запись | Модуль | Суть «Пересмотреть» | Группа | Куда (документ / fixes / карточка) |
|---|---|---|---|---|
| TR-1 | wish | убрать `legacy-reject.ts`, `legacy-uc-error.ts`; Policy полем Def | оставить | снято кодом (файлов нет, `if` по статусу ушёл); исторический |
| TR-2 | wish | снять приведение и `Date.now()` в UC/ER | оставить | снято: `this.now()` (`cancel-wish.uc.ts:48`); исторический |
| TR-3 | все | единый `kind` отказов, клиенты 400/409 | оставить | 27 `conflict`, бот по HTTP-коду не ветвится; правило «отказ перехода = conflict» → `decisions.md` |
| TR-4 | wish | конверт строит UoW, удалить `legacy-publish.ts` | оставить | снято; исторический |
| TR-5 | wish | не течёт ли `telegramId` в домен; свои события ER | оставить | `wish.events.ts:9` — осознанно (адресация карточки), ER событий не публикует; исторический |
| TR-7 | wish | выбор «текущего» желания уходит из репозитория | погасить | `wish.repo.ts:20`, `wish.json-repo.ts:54` (API-03): выбор — в Ar/правило, метод удалить; M |
| TR-8 | wish | DOM-16 review, `finally`, строгий разбор прода | погасить | шаг «read-only разбор `data/wish/wishes.json` на prod» → `rollout.md` (Ф6); S |
| TR-9 | wish | перевод бота, удаление legacy-классов | оставить | снято; исторический |
| TR-10 | платформа | пункты (1), (5) после Ф8а | оставить | знание в D-43 / гайде facade |
| TR-11 | course, questionnaire | адаптеры → настоящие UC | оставить | снято; исторический |
| TR-12 | wish, платформа | подпись `from` при выходе в сервис | оставить | выхода в сервис нет; исторический |
| TR-13 | платформа | JSONL подключить; `channel` в конверте | оставить | JSONL подключён (`u7-app.ts:177`); `channel` — без триггера, знание в `caller.md` пакета |
| TR-14 | dmg-core | порог размера `events`/`payload`; grit на поля-стрелки шагов | погасить | репо `dmg-core`: обрезка в `jsonl-operation-log.ts:6`, grit-правило; M |
| TR-16 | wish | снять исключение DOM-17 | оставить | снято (Ф12); исторический |
| TR-18 | wish | подписка ER; отказ вопроса прерывает реакцию | оставить | сделано; п. 3 — гайд `event-reaction.md` §3 (уже) |
| TR-19 | wish | раздел «Устройство реализации» | оставить | есть (`event-reaction.md:25`) |
| TR-20 | wish | приглашения без идемпотентности (п. 2) | решение | [C-06](./cards.md#c-06) |
| TR-21 | wish, бот | `update_id` до story | оставить | дубль DEBT-41; исторический |
| TR-22 | wish, бот | чистка п. 3–5 | оставить | DEBT-23 погашен, п. 3–4 приняты; исторический |
| TR-23 | domain | подпути `/contract` в ARC-04 | оставить | решено TR-26 / D-45; ARC-04 пакета |
| TR-24 | платформа | формы `Outbox`/`Inbox` | оставить | без триггера; знание D-47 |
| TR-25 | dmg-core | `module` в UoW обязателен | погасить | `dmg-core/src/app/uow/unit-of-work.ts:34`: `module?` → обязательное (ломающее API пакета); M |
| TR-26 | платформа | исключение пар legacy в ARC-04 | оставить | пусто; исторический |
| TR-30 | бот-UI | id запроса в story явно | оставить | остаток = DEBT-41; ALS-контекст → `decisions.md` |
| TR-31 | wish | вынести схему версии в state | оставить | условие не наступило; исторический |
| TR-32 | платформа | абстрактный `fetch` при заданном `F` | оставить | знание в D-58, гайд `use-case` §3/§7; API-07 в lint |
| TR-33 | платформа | резолвер через `dispatch`; удалить `app-legacy` | оставить | снято TR-66/67; исторический |
| TR-34 | платформа | чтение пользователя на вызов | оставить | замеров нет; D-50 |
| TR-35 | платформа | ARC-07-группы; `User` из контракта | оставить | исполнено треками `*-dmg`; исторический |
| TR-36 | arch | ARC-09 при `authoring` в приложении | оставить | условие не наступило; D-52 |
| TR-37 | peer-review | «карантин» в `VersionedRepository` | оставить | остановок нет; строгий разбор — норма платформы |
| TR-38 | peer-review | правило «коммит = red + реализация» | погасить | перенести (1) в `conductor/workflow.md`; S |
| TR-39 | peer-review | пагинация; UTC+5; `question-pool` | решение | [C-07](./cards.md#c-07); пагинация — не нужна, UTC+5 = DEBT-43 |
| TR-40 | stream, user | Policy на `isMentor()` | оставить | снято (`user-dmg` Ф8); исторический |
| TR-41 | stream | legacy потока; Т17 по коду ошибки | оставить | исполнено; устаревшая ссылка `StreamStudents` в `stream.types.ts:4` — попутно (S) |
| TR-43 | stream | С1: проекции UI в выходе query UC | решение | [C-03](./cards.md#c-03) (обязательная); С2, Т1 — сняты |
| TR-44 | stream | скрипты на типы контракта; оптимизации | оставить | скрипты на `StudentArDef`; оптимизации без замеров; исторический |
| TR-45 | stream | `update-stream-snapshot.ts` через репозитории и UoW | погасить | `scripts/update-stream-snapshot.ts:239`, `scripts/stream-snapshot-sync.ts:38` пишут сырой JSON без `version`; тест на временном каталоге; M |
| TR-46 | questionnaire | likert в кампаниях peer-review | оставить | решение Q5 действует |
| TR-47 | questionnaire | variant-state на учебном модуле | оставить | работает (`questionnaire.state.ts:95`); исторический |
| TR-48 | questionnaire | монотонность `at`; С2, Т15, Т16 | оставить | исполнено; Т1 — без повода |
| TR-49 | questionnaire | (7) бэкап перед выкаткой; (3) пропуск неизменённых в UoW | оставить | (7) — в `rollout.md` (Ф6); (3) без повода |
| TR-50 | questionnaire, бот | (6) типы событий вне контракта; (1), (8) экран отказа; (9) correlation | решение | [C-04](./cards.md#c-04) (обязательная); (1), (8) ждут `dmg-ui`; (9) — проверить при C-04 |
| TR-52 | course | authoring-UC; красная зона | оставить | (3) — `roadmap/course-module-history.md`; (5) снята |
| TR-53 | course | черновые шаги, висячие ссылки, Т11 | оставить | С1 — контент; ссылки — `course-module-history.md`; Т11 снят |
| TR-54 | course | запрет `save` новых репо до Ф5 | оставить | снято; исторический |
| TR-55 | course | `ModuleView.version`, запрет записи, CODE-04 | оставить | тест `module.ar.test.ts:188`; снято |
| TR-56 | course | С1 видимость, С2 «курс модуля», С3 мост | оставить | С1 — `course-module-history.md`; С2 = DEBT-50; С3 снят |
| TR-57 | бот, тесты | хеш кеша миров не видит правку `builder.ts` | погасить | `runners/u7-bot/tests/worlds/materializer.ts:63` (`computeSourceHash`); S |
| TR-58 | course | общая `versionOut` для 4 Ar | погасить | `domain/src/course/{course,lesson,module,step}/*.ar.ts` — вынести в один файл; S |
| TR-59 | course, бот | курс без этапов / с одним этапом в ui-spec | погасить | `runners/u7-bot/src/controllers/courses/ui-spec.md:25-27` — дописать спеку под код; S |
| TR-61 | user, бот | `UserCaller` и гость; аудит D-45 | оставить | остаток — C-01, C-05 |
| TR-62 | платформа | `core/shared` при `dmg-ui`; `JobExecutor` | оставить | `core/shared` ждёт `dmg-ui`; `JobExecutor` не нужен (D-71) |
| TR-63 | scripts | маркеры временности в `scripts/`; ветка `external` | оставить | условие не наступило; `external` — возможность пакета |
| TR-64 | платформа | состав `modules` против `api` в `start()` | оставить | оба из `dmgApp().modules` |
| TR-66 | платформа | ключи `last-runs.json` на бою | решение | [C-08](./cards.md#c-08); **влияет на выкатку** |
| TR-68 | бот, modules | гость без `/start`; `includes` ERR-01; пограничные `throw*` | решение | [C-01](./cards.md#c-01), [C-02](./cards.md#c-02) (обязательные); погасить: `VERSION_CONFLICT` в `peer-review/src/infra/{review,review-campaign}.json-repo.ts` (S), `NOT_FOUND` в `scope-reviews.story.ts:92` (S), имя по умолчанию в `ensure-registered.ts:57` (S) |
| DEBT-40 | wish, peer-review | UC/ER/Job-тесты на `mkdtemp` | оставить | перевод по мере касания (реален) |
| DEBT-41 | платформа | id апдейта через `AsyncLocalStorage` | оставить | ждёт `dmg-ui` / ui-manifests (D-26) |
| DEBT-42 | scripts | `call-uc`: `dbDir: 'data'` | оставить | ждёт `dmg-cli` (`roadmap.md` п. 11) |
| DEBT-43 | бот | единая зона UTC+5 | решение | [C-09](./cards.md#c-09) — трека-владельца нет |
| DEBT-45 | платформа, бот | проактив `invite` в обход `enterDialog` | оставить | `tasks-system` (`roadmap.md` п. 2) |
| DEBT-46 | scripts | менторские файлы с диска | решение | [C-10](./cards.md#c-10) — трека-владельца нет |
| DEBT-49 | scripts, .pi | расширение `subagent` привязано к `scripts/` | решение | [C-11](./cards.md#c-11) — трека-владельца нет |
| DEBT-50 | course | две ветки «курс модуля» | оставить | «История модулей курса» (`course-module-history.md`) |
| DEBT-51 | бот | 2 DMG-вызова на модуль в каталоге | оставить | триггер — рост каталога |
| DEBT-52 | user | нет bootstrap первого администратора | оставить | `schools-system` |

**Вне триажа** (нет «Пересмотреть» по существу): TR-6, TR-15, TR-17, TR-51 (поля нет), TR-60, TR-65 («—»), TR-67 («нет»). Номеров TR-27…29, TR-42 в реестре нет.

**Итог:** 67 записей (57 TR + 10 DEBT; план оценивал 62 + 10) — оставить 49, погасить 9, решение 9 (карточек 10: TR-68 — две; плюс C-05 — ФР-5 «проход по контрактам»).

**Влияет на выкатку (→ `rollout.md`, Ф6):** TR-66 (C-08), TR-8 (разбор `wishes.json`), TR-49 (7) (бэкап), миграция `users.json` (TR-61, уже в `migration.md`).
