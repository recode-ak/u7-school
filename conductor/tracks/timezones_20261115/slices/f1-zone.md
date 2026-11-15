# Бриф среза Ф1: сервис зоны и поля зоны

Spec — [../spec.md](../spec.md) (ФР-1–4), план — [../plan.md](../plan.md), Фаза 1.

## Границы

| Пакет | Файлы | Что |
|---|---|---|
| `@u7-scl/domain` | `domain/src/shared/time-zone.ts`, `domain/src/shared/index.ts` (новые) | `TimeZoneVo` — имя зоны IANA |
| `@u7-scl/domain` | `domain/src/user/user/user.state.ts` | `UserState.timeZone?: TimeZoneVo` |
| `@u7-scl/app` | `platform/app/src/school/school.ts` | `School.timeZone`, `U7_SCHOOL_STATIC.timeZone = 'Asia/Oral'` |
| `@u7-scl/app` | `platform/app/src/zone/local-zone.ts`, `zone/index.ts` (новые), `src/index.ts` | `LocalZone`, экспорт |

Вне среза: `platform/core` (`ProjectZone` удаляется в Ф2), раннер, `data/`.

**Отступление от рабочих имён плана (тактика):** валидатор — не `domain/src/user/user/time-zone.vo.ts`, а VO приложения `TimeZoneVo` в `domain/src/shared/` (`naming.md` §2 пакета, гайд state §1: VO, общий для приложения, — в `<domain>/shared/`; им пользуются user, School и `LocalZone`). Импорт — `@u7-scl/domain/shared` (подпуть `./*` уже есть в `domain/package.json`).

## Def и реализации

### `TimeZoneVo` (`domain/src/shared/time-zone.ts`)

- Схема и тип под одним именем: `v.pipe(v.string(), v.description('Часовая зона (имя IANA)'), v.check(…))`. Своего текста ошибки нет (гайд state, «Свои тексты ошибок»).
- Допустимо: имя, которое принимает `Intl.DateTimeFormat` (`timeZone`), и не строка смещения — первая буква латинская (`Asia/Oral`, `Europe/Berlin`, `UTC`, `Etc/GMT-5`). Отклоняется: `Mars/Base`, `Foo/Bar`, `+05:00`, `''`.
- Домен чистый и синхронный: только `Intl`, без зависимостей.

### `UserState.timeZone`

- `timeZone: v.optional(TimeZoneVo)` — не `F.sensitive`. `UserView = UserState` — поле появится в виде само.
- Старые записи без поля читаются без миграции.

### `School.timeZone`

- `SchoolSchema.timeZone: TimeZoneVo` (обязательное); `U7_SCHOOL_STATIC.timeZone: 'Asia/Oral'`; `createSchool` переносит его из статики, `TEST_SCHOOL` — тоже `Asia/Oral`.

### `LocalZone` (`platform/app/src/zone/local-zone.ts`)

Класс с закрытым конструктором; форматтер `Intl.DateTimeFormat` (`en-US`, `hourCycle: 'h23'`, все поля числами, `formatToParts`) создаётся один раз в экземпляре.

| Член | Поведение |
|---|---|
| `static of(name: string): LocalZone` | имя проверяется `TimeZoneVo`; неизвестное — бросает `Error` (конфигурация, не ввод пользователя) |
| `readonly name: string` | имя IANA |
| `parseLocal(text): Timestamp \| undefined` | местное `YYYY-MM-DD` (полночь) / `YYYY-MM-DDTHH:mm` → UTC со смещением зоны **на этот момент** (летнее время). Невалидно → `undefined`: переполнение (`31.02`, `25:00`, `14:60`), секунды, `Z`, пробел вместо `T`, мусор, несуществующее местное время (скачок вперёд при переходе на летнее время). Проверка — обратным `formatInput` |
| `formatDate(at)` | `дд.мм.гггг`, без подписи |
| `formatTime(at)` | `чч:мм (UTC+5)` — время с подписью зоны |
| `formatInput(at)` | `YYYY-MM-DDTHH:mm`, без подписи, обратно `parseLocal` |
| `offsetLabel(at)` | подпись смещения на момент: `UTC+5`, `UTC+5:30`, `UTC-3`, `UTC` при нуле; знак — ASCII-минус. `Etc/GMT-5` → `UTC+5` (обратный знак IANA скрыт). Нужна Ф2 (подсказка мастера) |

## Сценарии тестов (red)

1. `LocalZone` на `Asia/Oral` — перенос **всех** сценариев `platform/core/src/shared/project-zone.test.ts` (список ниже сверить один в один), `formatTime` — с подписью `(UTC+5)`:
   - ввод 10:00 ↔ 05:00Z; вывод 05:00Z → `10:00 (UTC+5)`, `17.09.2026`, `2026-09-17T10:00`; 10:00Z → 15:00; 22:30Z → следующие сутки 03:30; граница суток 18:59Z/19:00Z и 23:59 местного → 18:59Z; граница года; дополнение нулями;
   - дата без времени — полночь местного; високосный `2028-02-29`; 15 невалидных вводов; `parseLocal ∘ formatInput` — тождество;
   - «произвольное смещение» ProjectZone → через зоны: `UTC` (местное = UTC), `America/Sao_Paulo` (UTC-3, без летнего времени с 2019); сценарий `default() ≡ new ProjectZone(300)` → `LocalZone.of('Etc/GMT-5')` форматирует так же, как `Asia/Oral`.
2. `Europe/Berlin`: зимой (январь) `UTC+1`, летом (июль) `UTC+2` — в `parseLocal`, `formatInput`, `offsetLabel`; несуществующее `2026-03-29T02:30` → `undefined`.
3. Подпись: `formatTime` → `18:00 (UTC+5)`; `formatDate` без подписи; `Etc/GMT-5` → `UTC+5`; `Asia/Kolkata` → `UTC+5:30`; `UTC` → `UTC`.
4. `LocalZone.of('Mars/Base')` бросает; `LocalZone.of('Asia/Oral').name === 'Asia/Oral'`.
5. `TimeZoneVo` (`domain/src/shared/time-zone.test.ts`): принимает `Asia/Oral`, `Europe/Berlin`, `UTC`, `Etc/GMT-5`; отклоняет `Mars/Base`, `+05:00`, `''`.
6. `UserState` (`user.state.test.ts`): без `timeZone` — принимается, поле `undefined`; с `Europe/Berlin` — принимается; с `Mars/Base` — отклоняется. Поле не `F.sensitive` (по образцу `user.sensitive.test.ts` — отдельный кейс в `user.state.test.ts`, не в списке sensitive).
7. `school.test.ts`: `validSchoolData` дополнить `timeZone: 'Asia/Oral'`; `SchoolSchema` отклоняет `Foo/Bar` и отсутствие поля; `U7_SCHOOL_STATIC.timeZone === 'Asia/Oral'`; `createSchool(...).timeZone === 'Asia/Oral'`.

Тест `project-zone.test.ts` в Ф1 **не удаляется** (`ProjectZone` живёт до Ф2), сценарии копируются в `local-zone.test.ts`; удаление старого теста — Ф2 вместе с классом (TST-08).

## Критерии приёмки

- `bun run check` зелёный, тестов ≥ 3511.
- Без новых зависимостей (`git diff package.json bun.lock` пуст).
- Все сценарии выше есть и зелёные.

## Применимые ID (`node_modules/dmg-core/docs/reference/rules.md`)

ARC-02 (домен не импортирует `app`), ARC-04 (импорт `@u7-scl/domain/shared`), MAN-02 (описание у поля и ветки `optional`), DOM-01 (state — только Ar/Def/репо), DOM-11, DOM-13 (VO без дат и идентичности), CODE-01 (имя `TimeZoneVo`), TST-04 (короткие тесты), TST-08 (сценарии переезжают).

---

## Отчёт `dmg-test-designer` (Sonnet)

- Новые: `platform/app/src/zone/local-zone.test.ts` (47 тестов, пп. 1–4), `domain/src/shared/time-zone.test.ts` (7, п. 5); дополнены `user.state.test.ts` (+4, п. 6), `school.test.ts` (+4, п. 7, `validSchoolData` с `timeZone`).
- Red: 9 fail + 2 файла без модуля (`./local-zone`, `./time-zone`) — по делу.
- Перенос `project-zone.test.ts`: все 15 сценариев (включая цикл из 15 невалидных вводов) есть в `local-zone.test.ts`; «UTC+0» → `LocalZone.of('UTC')`, «UTC-3» → `America/Sao_Paulo`, `default() ≡ new ProjectZone(300)` → `Etc/GMT-5 ≡ Asia/Oral`. Старый тест удаляется в Ф2 вместе с классом.
- Сверх брифа: `formatTime` в `UTC` → `10:00 (UTC)`; отрицательная подпись `UTC-3`. Принято.
- Кандидатов в чистку тестов нет.

## Отчёт автора (`dmg-domain-author`, Opus)

- `TimeZoneVo` = `string → description → regex(/^[A-Za-z]/) → transform(регистр как в IANA) → check(Intl)`. Эскалация MAN-03 (`v.check` не переводится в JSON Schema) решена оркестратором по образцу `trimmed` (`user.state.ts`): JSON Schema обрывается на `transform` → `{type:'string', pattern:'^[A-Za-z]'}`. Псевдонимы (`Asia/Calcutta`, `Etc/UTC`) не сводятся.
- `LocalZone`: смещение на момент — `formatToParts` → `Date.UTC` − момент (до секунды); `parseLocal` — кандидаты по смещениям за сутки до/после, отбор обратным `formatInput`, при неоднозначности — ранний момент (как `compatible` в Temporal); `of` хранит выход схемы.
- Эскалация ARC-04/05 (`scripts/domain-check.ts` не знал `domain/src/shared`) — исправил оркестратор: `shared` — общий домен (`naming.md` §2 пакета), не модуль; импорт напрямую; сам модули не импортирует (+4 теста).
- Попутно (оркестратор): `data-dir-audit.test.ts` брал фикстуры от cwd — гейт краснел на любой правке `platform/app`; путь от `import.meta.dir`.

## Отчёт `dmg-data-keeper` (Sonnet)

Блокеров нет. Старые записи без `timeZone` читаются через `UserArDef.state`, ключ при записи не появляется (тест добавлен). Предупреждения на будущее (→ D в Ф3): откат станет односторонним, когда появится UC записи зоны (перед ним — `bun run backup`); значение зависит от набора зон ICU рантайма.

## Отчёт `dmg-reviewer` (Opus)

Error нет. Исправлено: warn — `of` хранил исходное имя; warn CODE-04 — формулировка «каноническое»; info — единое правило неоднозначного времени (ранний момент), CODE-03 (`as`), импорт `@u7-scl/domain/shared`, тест «shared не импортирует модули». Принято как есть: крайние случаи (год < 100, LMT с секундами). Алгоритм проверен зондом: 11 зон, шаг 15 мин, 2025–2026, 0 ошибок.

Дубли среза почищены в срезе (−4 теста): `U7_SCHOOL_STATIC.timeZone`, три теста подписи в `local-zone.test.ts`.

## Итог

`bun run check` зелёный, 3571 pass / 0 fail (база 3511); `package.json`/`bun.lock` без изменений.
