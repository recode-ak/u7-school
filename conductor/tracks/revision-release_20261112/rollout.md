# Выкатка v0.3.0 на prod (Ф6)

Документ — для отдельной сессии **на прод-машине**. Все команды ниже выполняет человек; каждая, трогающая данные, — **с подтверждения Нурболата**. Агент против `data/` не запускает ничего (ни сухих прогонов, ни `jq`).
Обоснование пользовательских шагов — [migration.md §6](../../architecture/migration.md#6-состояние-переноса), формат снимков и восстановление — [docs/backup.md](../../../docs/backup.md), влияние на выкатку — [triage.md](./triage.md), [cards.md C-08](./cards.md#c-08).

## 1. Порядок (prod, одна сессия)

0. **Pre-flight, только чтение:** `git status --short`, `git log --oneline origin/main..HEAD` (должно быть пусто), `git describe --tags` (`v0.2.6`), `bun --version`, наличие `.env.production`. Открытые вопросы — §6.
   - **Доступ к `dmg-core`:** u7-school ставит пакет из git (`git+ssh://git@github.com/recode-ak/dmg-core.git#v0.1.1`). На сервере — deploy key репо `recode-ak/dmg-core` (только чтение); проверка: `git ls-remote git@github.com:recode-ak/dmg-core.git v0.1.1`. Если ключей GitHub на сервере несколько — `Host`-алиас в `~/.ssh/config` (`RELEASING.md` пакета, п. 6). Без доступа `bun install` (п. 4) упадёт при остановленном боте.
1. **Остановить прод:** `pm2 stop u7-school-bot` (или `bun run start:prod:stop`). Останавливаем **до** `git pull` — две причины: снимок из п. 2 получает в `manifest.json`/`meta.txt` версию кода `v0.2.6`, а именно её требует откат; `pull` под работающим Bun может сломать ленивый импорт.
2. **Бэкап — с подтверждения Нурболата:** `bash scripts/backup.sh --name=before-0.3.0` (protected, ротация не тронет) и `bash scripts/backup.sh before-deploy`.
3. `git pull --ff-only` — прод должен стоять на `main` = тег `v0.3.0`; локальных коммитов в проде быть не должно (иначе `pull` конфликтует).
4. `bun install --frozen-lockfile` — workspaces переехали (`apps/`, `packages/` → `platform/`, `domain/`, `modules/`, `runners/`).
5. **Миграции** (§2) — с подтверждения Нурболата, при остановленном боте.
6. **Запуск:** `pm2 delete u7-school-bot` → `bun run start:prod` → `pm2 save`. `pm2 delete` обязателен: в сохранённом конфиге pm2 остались `args` старой раскладки (`apps/u7-bot/src/main.ts`), `pm2 restart u7-school-bot` перезапустил бы несуществующий файл — см. §5.
7. **Проверка после запуска:**
   - `pm2 status u7-school-bot` — `online`, без цикла рестартов; `pm2 logs u7-school-bot --lines 50 --nostream` — нет `JsonFileRepoError`, `ValiError`, `ERR-01`.
   - `data/oplog/` — появился файл `<дата>.jsonl` (лог операций DMG; в v0.2.6 его не было), `data/replay/` создан при старте.
   - `data/jobs/last-runs.json` — после первого прогона появились ключи `inactivitySweep` и `sweepAbandonedQuestionnaires`; старые (`inactivity-sweep`, `sweep-abandoned-questionnaires`) остаются мёртвыми, миграции нет (C-08, вариант А).
   - Smoke руками: `/start` гостем; кнопка **со старого экрана** (сессии и shortId пережили рестарт — формат файлов тот же); зачисление и прохождение шага; желание через анкету; карточка курса и отчёт ментора.

## 2. Миграции — по файлу

| Файл | Шаг | Если пропустить |
|---|---|---|
| `users/users.json` | `DB_DIR=./data bun run scripts/migrate-users-drop-student.ts` (сухой) → сверить `всего / снят STUDENT / невалидные` с файлом → `--write` | Строгое чтение: `STUDENT` вне picklist → одна запись роняет **все** чтения `user`, включая резолвер `Caller` (ERR-01) — бот не обслуживает никого |
| `streams/streams.json` | Миграции нет. `migrate-streams-school-id` **не запускать**: он в релизе с v0.2.4, а `StreamSchema` v0.2.6 уже требует `schoolId` строго — на проде поле есть. Скрипт без сухого прогона (пишет сразу), поэтому «на всякий случай» — нельзя | Нечего: `schoolId` обязателен и в новой схеме |
| `streams/students.json` | Миграции нет: набор полей тот же (ISO→число, `version` → 0) | — |
| `questionnaires/questionnaires.json` | Миграции нет, чтение legacy (D-36). Обязателен только бэкап (TR-49 (7)) | Бэкапа нет — откат после первой записи невозможен (новый формат), см. §3 |
| `wish/wishes.json` | Миграции нет; вместо неё разовый **read-only** разбор (TR-8) — команда ниже | Битая запись → исключение на первом чтении `wish`; в v0.2.6 такие записи молча пропускались |
| `peer-review/{campaigns,reviews}.json` | Миграции нет (ISO→число, `version` → 0) | — |
| `users/seed.json` | Не нужен: новый `UserJsonRepo` его не читает; на проде инертен (`users.json` есть) | — |
| `jobs/last-runs.json` | **Не мигрируем** (C-08 А). Первый прогон `inactivitySweep` — в следующее окно 19:00, `sweepAbandonedQuestionnaires` — через полный интервал | Потерь и дублей рассылки нет; пропуск не больше одного окна |
| `bot/sessions.json`, `bot/short-ids.json` | Миграции нет — схемы совпадают побайтно с v0.2.6 | Диалоги и старые кнопки живы |
| `oplog/`, `replay/` | Каталоги создаёт сам код (D-43, D-56) | — |

Разбор `wishes.json` (только чтение, ничего не пишет):

```bash
bun -e 'import { WishArDef } from "@u7-scl/domain/wish"; import * as v from "valibot";
const rows = await Bun.file("data/wish/wishes.json").json();
const bad = rows.flatMap((r, i) => { const p = v.safeParse(WishArDef.state, r); return p.success ? [] : [[i, p.issues[0]?.message]]; });
console.log(`записей: ${rows.length}, невалидных: ${bad.length}`); for (const b of bad) console.log(...b);'
```

Примечания: разбор проверен на записи старого вида — ISO-дата без зоны читается как UTC, `updatedAt` берётся из `createdAt`, `version` → 0 (D-36); единственный несовместимый случай — роль `STUDENT` в `users` (её и снимает миграция). Миграция `users` пишет `writeFile` без temp+rename и без блокировки — только при остановленном боте; повтор идемпотентен. `DB_DIR` задавай явно: `bun run` грузит `.env`/`.env.local`, но не `.env.production`.

## 3. Бэкапы и откат

- **Что в снимке:** всё `data/`, кроме `backup/`, `backup-adhoc/`, `oplog/` (D-43), `replay/` (D-56), `fixtures/`, `sources/`, `fullstack-js/` (`EXCLUDE` в `scripts/backup.sh`). Новый код добавляет только `oplog/` и `replay/` — оба сознательно вне бэкапа.
- **Откат — только код + файлы из снимка.** Новая версия пишет даты числами и добавляет `version`; схема v0.2.6 ждёт ISO-строки. Legacy `JsonFileRepo` невалидные записи **молча пропускает** (складывая файл в `<каталог>/backups/<файл>.invalid.<stamp>.json`), а следующая запись перезаписывает файл только валидными — то есть откат «только по коду» теряет данные при первой же записи.
- **Восстанавливать обязательно** (если новая версия успела записать): `users/users.json`, `streams/streams.json`, `streams/students.json`, `questionnaires/questionnaires.json`, `wish/wishes.json`, `peer-review/campaigns.json`, `peer-review/reviews.json`; `courses/*.json` — git-tracked, сверить `git status` и вернуть `git checkout -- data/courses`.
- **Не требуют восстановления:** `bot/*` (формат тот же), `jobs/last-runs.json` (ключи расходятся, потерь нет), `oplog/`, `replay/`.
- Команды (`docs/backup.md`, «Восстановление»), подряд и с подтверждения Нурболата:
  ```bash
  bash scripts/backup.sh before-rollback        # сохранить текущее
  pm2 stop u7-school-bot
  rsync -a --exclude manifest.json --exclude meta.txt data/backup/<снимок>/ data/
  git checkout v0.2.6 && bun install --frozen-lockfile
  pm2 delete u7-school-bot && bun run start:prod && pm2 save
  ```

## 4. env

Схема `BotConfigSchema` (`runners/u7-bot/src/config.ts`) относительно v0.2.6 не изменилась: те же обязательные (`BOT_TOKEN`, `COMMUNITY_GROUP_URL`, `COMMUNITY_GROUP_ID`, `STUDENT_GROUP_ID`, `STUDENT_GROUP_INVITE`, `NODE_ENV`, `BOT_ADMIN_UUID`, `DB_DIR`) и опциональные (`BOT_MODE`, `WEBHOOK_URL/PORT/PATH`, `LOGGER_BOT_TOKEN`, `ADMIN_TELEGRAM_IDS`, `DEV_TELEGRAM_ID`, `SCHOOL_MENTOR_IDS`).

- **Добавить:** нечего. **Переименовать:** нечего. **Убрать:** `MENTOR_CHAT_ID` (лежит в `.env.development`, не читается ни в одной версии) — необязательно.
- `.env.production` править не нужно; проверить только наличие обязательных ключей. `NODE_ENV=production` выставляет pm2 (`env_production`).
- Изменился не env, а запуск: `pm2.config.cjs` → `args: run --env-file .env.production runners/u7-bot/src/main.ts` (было `apps/u7-bot/src/main.ts`).

## 5. Остатки `apps`/`packages`, `deploy.sh`

- После `pull` старые каталоги удалены только для tracked-файлов; untracked остаются. Проверка (только чтение): `ls -d apps packages 2>/dev/null`, затем `find apps packages -maxdepth 2 -not -path '*/node_modules/*'`. Если внутри только `node_modules/` и пустые каталоги — удалить `rm -rf apps packages` **с подтверждения Нурболата** (untracked, могло остаться что-то ручное).
- Висячие workspace-симлинки после переезда: `find node_modules/@u7-scl -maxdepth 1 -type l -print` + `readlink -f` — цель не существует (например `@u7-scl/cli`, старые пути `w3school`, `video-summarizer`) → `rm -rf node_modules && bun install --frozen-lockfile`. `bun install` (п. 4 §1) чинит симлинки сам; проверка нужна, только если старт упал на импорте.
- **0.3.0 — вручную, `scripts/deploy.sh` не запускать:** на prod лежит скрипт v0.2.6 — он перезапускает `pm2 restart u7-school-bot` по имени, а restart берёт сохранённые `args` (`apps/u7-bot/src/main.ts`) → падение старта; к тому же у релиза миграция `users.json`, а скрипт миграций не делает.
- **Со следующего релиза — скриптом:** в 0.3.0 `deploy.sh` останавливает бота до бэкапа и запускает по `pm2.config.cjs` (`delete` → `start` → `save`); README синхронизирован. Релиз с миграцией данных — по своему документу выкатки.

## 6. Что решается только на prod

1. Сколько записей в `users.json` со `STUDENT` и сколько невалидных — покажет сухой прогон миграции (п. 2).
2. Есть ли невалидные записи в `wishes.json` — разбор в п. 2 (TR-8).
3. Все ли потоки/студенты проходят строгую схему: v0.2.6 невалидные записи молча пропускал, файл их хранит, а новая версия на такой записи падает целиком. Проверки — тем же `bun -e` по `StreamArDef.state` / `StudentArDef.state`.
4. Состав `.env.production` (файл вне git) — какие из обязательных ключей реально есть.
5. Чистота рабочей копии в проде: незакоммиченные правки, особенно сверх `data/courses/*.json` (tracked).
6. Какие снимки уже лежат в `data/backup/` и есть ли среди них с `meta.txt` версии `v0.2.6` (страховка, если `before-0.3.0` не создастся: код возврата `10`/`1`).
