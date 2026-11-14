# Бриф Ф5.6: домен и модули

Трек `revision-release_20261112`, строки F-70…F-74 [fixes.md](../fixes.md). Исполнитель — `migrator` (flash), одна сессия; ревью — Opus. Видимое поведение бота не меняется.

## Границы

- Можно: `domain/src/{wish,course,stream,peer-review}/**`, `modules/{wish,peer-review}/src/**`, тесты рядом.
- Нельзя: `conductor/`, `data/`, `node_modules/`, `dmg-core`, прочие модули и контракты (кроме названных), `runners/**` (кроме правки импорта, если `ReviewState` уходит из контракта); коммиты.
- Нужно изменить контракт сверх описанного — эскалация.

## Было → станет

**F-70 (TR-7, API-03).** Было: `WishRepo.findCurrentByUserAndTarget` (`modules/wish/src/wish/wish.repo.ts:15-23`, `modules/wish/src/infra/wish.json-repo.ts:54-66`) выбирает «текущее» желание — решение в хранилище. Единственный клиент — `CancelWishUc.load` (`modules/wish/src/wish/uc/cancel-wish.uc.ts:32`).
Станет: выбор — в домене, статический метод `WishAr.currentOf(wishes: readonly WishAr[]): WishAr | undefined` (тот же алгоритм: среди активных — последнее созданное, иначе последнее созданное из всех; пустой — `undefined`). UC грузит `findAllByUserAndTarget` и зовёт `WishAr.currentOf`. Метод репозитория и его реализацию удалить.
Тесты **переезжают, не копируются** (TST-08): кейсы `describe('findCurrentByUserAndTarget')` из `modules/wish/src/infra/wish.json-repo.test.ts:255-380` → в `domain/src/wish/wish/wish.ar.test.ts` (`describe('currentOf')`) на Ar без файла; проверки «другой пользователь / другая цель» в домене не нужны (фильтр — у `findAllByUserAndTarget`, он покрыт своими тестами) — их удалить из json-repo-теста, не переносить. Подмена `findCurrentByUserAndTarget` в `cancel-wish.uc.test.ts:131-135` — перевести на `findAllByUserAndTarget` (это **правка старого теста** — отдельное поручение, не пропускать).

**F-71 (TR-58).** Было: одинаковая `const versionOut = v.pipe(...)` в `domain/src/course/{course/course,lesson/lesson,module/module,step/step}.ar.ts`. Станет: один экспорт `VersionOut` в `domain/src/course/version-out.ts` (не в контракт), четыре Ar импортируют его.

**F-72 (TR-41).** `domain/src/stream/stream/stream.types.ts:1-5`: ссылка на несуществующий порт `StreamStudents` — переписать: строит UC прикладного слоя (найди, кто строит `StreamStudentFact`, и назови его). Комментарии в тестах `stream-launch.dcs.test.ts:9`, `stream-members.dqs.test.ts:9`, `stream-students.uc.test.ts:26` — исторические («бывш.»), не трогать.

**F-73 (TR-68).** `modules/peer-review/src/infra/review-campaign.json-repo.ts:73`, `review.json-repo.ts:98`: дубль ключа при записи — это гонка двух создателей, оба прошли правило `unique`. Было: `throw new Error(...)` — UoW пробрасывает как сбой. Станет: `throw new VersionConflict(this.aggregate, ar.uuid)` (`dmg-core/app`) — UoW вернёт `Err(VERSION_CONFLICT)` (`dmg-core` `unit-of-work.ts:82-91`). Комментарий класса (`:19-20`) обновить. Тесты репозиториев на дубль — ожидать `VersionConflict` (правка старого теста — отдельное поручение).

**F-74 (C-05, D-69).** Правило (решение orchestrator, правка D-69 пакета идёт параллельно): JSDoc «Кто: … Зачем: …» обязателен **только** у экспортов Ar, Policy, DQS в контракте; Def операций, группы событий/ошибок, `ModuleDef`, VO, типы — без JSDoc. Шапка контракта — образец `domain/src/user/contract.ts` (прочитай).
- `domain/src/wish/contract.ts:1-4`, `domain/src/peer-review/contract.ts:1-3`, `domain/src/course/contract.ts:1-4` — шапки под D-69 по образцу `user`.
- Ar/Policy/DQS в контрактах `wish`, `peer-review`, `course`, `stream`, `questionnaire` без JSDoc «Кто / Зачем» — дописать (кто — найди клиентов grep'ом вне модуля; зачем — одна фраза). Лишних JSDoc у Def не добавлять, существующие не удалять.
- `ReviewState` из `domain/src/peer-review/contract.ts` — убрать, если клиентов вне `domain/src/peer-review` и `modules/peer-review` нет (`grep -rn "ReviewState" --include=*.ts domain modules runners scripts platform | grep -v "domain/src/peer-review\|modules/peer-review"`); клиенты есть — оставить и сообщить.

## Готово

- Во время работы — узкие проверки: `bun test <файл>`, `bunx tsc --noEmit -p <пакет>`.
- В конце — `bun run scripts/agent-gate.ts` зелёный.
- `grep -rn "findCurrentByUserAndTarget" --include=*.ts domain modules runners scripts` — пусто.
- `grep -rn "const versionOut" domain/src/course` — пусто.
- `grep -n "throw new Error" modules/peer-review/src/infra/review*.json-repo.ts` — пусто.
- `git diff --numstat` — удалённые тесты только из перечисленных выше (переезд F-70).
- **Не ослаблять типы ради тестов** (`as unknown as`, расширение схем) — тест кажется неверным: не правь, опиши в отчёте.

## Отчёт

Файлы; отклонения с причиной; число тестов до/после в затронутых файлах; итог гейта; эскалации.

## Отчёт и приёмка (2026-11-14)

- **Исполнитель:** `migrator` flash, одна сессия, 58 ходов, $0.07, hit 98%; доработок по гейту нет.
- **Сделано:** F-70 — `WishAr.latest` (имя `currentOf` исполнителя переименовано на приёмке: рядом `WishAr.current` — активное для ER), метод репозитория удалён, 4 кейса переехали в `wish.ar.test.ts`, 2 (фильтр выборки) удалены; F-71 — `VersionOut`; F-72 — ссылка на `complete-stream.uc.ts`; F-73 — `VersionConflict`; F-74 — шапки трёх контрактов, `ReviewState` из контракта `peer-review` убран.
- **F-74 без JSDoc:** в контрактах `wish`, `peer-review`, `course`, `stream`, `questionnaire` нет экспортов Ar/Policy/DQS — дописывать не к чему.
- **`dmg-data-keeper` не нужен:** форма state и файлов не менялась (удалён метод порта, у дубля ключа другой класс исключения).
- **Ревью Opus:** принять; `debt.md` — TR-7, TR-58 (`versionOut`), TR-68 закрыты.
