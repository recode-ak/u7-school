# Roadmap — видение

> v7 (2026-11-15). Куда растёт продукт: инициативы, как модули взаимодействуют, на какие решения опираются (`D-NN` — проектные в [decisions.md](./architecture/decisions.md), платформенные — в [пакете](../node_modules/dmg-core/docs/decisions.md)). Детали реализации — в spec треков; модель фичи — в [roadmap/](./roadmap/) ([feature-modeling.md](./architecture/feature-modeling.md)). Видение платформы — [vision.md](./architecture/vision.md).

---

## Карта доменных модулей (метрики и профиль)

Пайплайн «люди взаимодействуют и оценивают друг друга → цифры и тексты паспорта», разрезанный на модули по вопросу, на который отвечает каждый. Сбор фактов, агрегация и предъявление — разные модули; клиент спрашивает, модуль-владелец разруливает (D-65).

| Модуль | Вопрос | Ответственность | Статус |
|---|---|---|---|
| `questionnaire` | Как заполняется анкета? | движок анкет: статусы, likert-шкалы, баллы | ✅ |
| `peer-review` | Что люди сказали друг о друге? | кампании сбора по мероприятиям, текстовые отзывы, затем анкеты в кампании | ✅ отзывы; анкеты — дальше |
| `sessions` | Что произошло? | реестр взаимодействий (парное программирование, код-ревью) → `session.completed` | концепция |
| `dossier` | Что известно о студенте? | агрегация метрик и отзывов по модулю учёбы и по студенту; порог достоверности | заготовка (`modules/dossier`) |
| `passport` | Как предъявить миру? | витрина, PDF+QR, портфолио, рекомендация | концепция |

Смежные: `task` — доставка приглашений и действий человеку; `contribution` — второе измерение профиля «член сообщества».

## Платформа: последовательность работ

1. **`timestamp-data`** (v0.3.2) — пакетная миграция дат в живых данных, удаление «чтения строки» в схемах (D-16, D-34).
2. **delegation** — агрегат делегирования в `user`, `DelegateCaller` в транспорте (D-25, [caller.md](../node_modules/dmg-core/docs/reference/caller.md) §4).
3. **Граф как продукт и процессы** — общий формат узлов, запросы к графу, diff графа между релизами; манифест процесса ([vision.md](./architecture/vision.md) §8, D-78).
4. **`dmg-ui`** — отдельный пакет UI на манифестах (поглощает `ui-manifests`): эталонный контроллер бота, затем остальные; уходят `ui-spec.md` и `@u7-scl/core` (D-26, D-79, D-80, D-72). Вход — [dmg-ui-entry.md](./roadmap/dmg-ui-entry.md).
5. **`dmg-cli`** и wizard — текстовый интерфейс к бэку из графа Def, ввод по схеме входа UC; заменит `scripts/call-uc.ts` (C-DEBT-42; D-54). Заготовка — `~/dev/tools/dmg/dmg-cli`.
6. Документация продукта, agent-ui, web-ui, развёртывание и масштабы — [vision.md](./architecture/vision.md) §8 (D-27, D-82).

## Продукт: инициативы

| Инициатива | Видение | Опора | Зависит от | Документ |
|---|---|---|---|---|
| **Задачи** (`task`) | pull вместо push: человек видит, что от него ждут; задача — конверт данных, рендерит канал; завершение по критерию | D-63, D-47, D-71 | — | [tasks-system.md](./roadmap/tasks-system.md) |
| **Отзывы и анкеты** (`peer-review`) | кампании на мероприятия («студент завершил поток», позже сессии); отзывы есть, следующий шаг — анкеты в кампании | D-63, D-35, D-56, D-77 | задачи (приглашения) | [peer-review-system.md](./roadmap/metrics/peer-review-system.md), [metrics-system.md](./roadmap/metrics/metrics-system.md) |
| **Сессии** (`sessions`) | реестр взаимодействий людей — источник анкет навыков | D-09, D-63, D-65 | — | [sessions-system.md](./roadmap/sessions-system.md) |
| **Досье** (`dossier`) | агрегация по модулю и студенту: категории, шкалы, формулы, порог достоверности | D-69, D-72 | анкеты, сессии | [metrics-conception.md](./roadmap/metrics/metrics-conception.md) |
| **Вклад** (`contribution`) | балл вклада из кросс-анкет командных задач и явных фиксаций | D-65 | досье, задачи | [contribution-system.md](./roadmap/contribution-system.md) |
| **Цифровой паспорт** (`passport`) | витрина профиля для внешнего мира | D-72, D-79 | досье | [digital-passport.md](./roadmap/metrics/digital-passport.md) |
| **Контент** | frozen snapshot защищает потоки; `basedOn`, edit vs fork, Import/Export; история модулей курса | D-64, D-65 | — | [content-management.md](./roadmap/content-management.md), [course-module-history.md](./roadmap/course-module-history.md) |
| **Школы** | школа — множественная сущность; связка автор–школа–ментор–поток | D-53, D-54, D-82 | — | [schools-system.md](./roadmap/schools-system.md) |

Кандидаты в треки (`[?]` в [tracks.md](./tracks.md)) — разборы в `roadmap/`: [stream-snapshot-dmg](./roadmap/stream-snapshot-dmg.md), [stream-front-domain](./roadmap/stream-front-domain.md), [oplog-state-patch](./roadmap/oplog-state-patch.md).

## Выполнено

- **Метрики, этап 1**: шина событий, `questionnaire`, `peer-review` с текстовыми отзывами; bot-ui «Диалог и Экран»; уведомления через `user` (этап A задач).
- **Переход на DMG** (`core-dmg` … `legacy-removal`) и релизы v0.3.0–v0.3.1 (2026-11-14): все модули на `dmg-core`, поведение сверено с v0.2.6 ([CHANGELOG](../CHANGELOG.md)).

Треки — [tracks.md](./tracks.md), завершённые — `conductor/archive/` (spec + summary).
