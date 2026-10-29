# Summary: peer-review-dmg_20261029

## Базовая линия (2026-10-29)

| Где | Команда | Результат |
|---|---|---|
| u7-school (`3ec36148`) | `CI=true bun test` | 3330 pass, 0 fail (343 файла) |
| u7-school (`3ec36148`) | `bun run test:bot` (e2e-тесты бота) | 978 pass, 0 fail (89 файлов) |
| u7-school (`3ec36148`) | `CI=true bun test domain/src/peer-review` | 99 pass, 0 fail (8 файлов) |
| u7-school (`3ec36148`) | `CI=true bun test modules/peer-review` | 73 pass, 0 fail (13 файлов) |
| dmg-core (`00bda68`) | `CI=true bun test` | 1345 pass, 0 fail (130 файлов) |
| dmg-core (`00bda68`) | `bun run e2e` | `e2e: ok` |

## Пилот ролей

Критерии — [agent-roles.md](../../architecture/agent-roles.md) §5. Строка на каждый вызов новой роли.

| # | Роль | Задача | Модель | Повлиял на решение | Принято замечаний | Промпт правился | Оценка orchestrator |
|---|---|---|---|---|---|---|---|
| 1 | `data-keeper` | Аудит формата `campaigns.json`/`reviews.json` (Ф0) | Sonnet (через `general-purpose` с промптом роли: сессия стартовала до `agents:sync`) | да — найдено: `peer-review` вне системного бэкапа, риск отката после первой записи, строгий разбор вместо пропуска невалидных, TZ у `expiresAt`; список тестов репозиториев | 6 из 6 (проверены `backup.sh`, `json-file-repo.ts`) | нет | полезен; дублей с `reviewer` нет — это вне diff; ~75k токенов |
| 2 | `architect` (ныне `tech-lead`) | Черновик брифа `review-campaign` (Ф0) | Sonnet | да — нашёл 3 ошибки постановки (ER слушает `student.*`, а не `stream.completed`; в контракте `stream` нет нужных Def и UC состава; `external` нельзя держать до Ф3 из-за MAN-06), 8 открытых вопросов с рекомендациями | бриф принят почти целиком; проверены 4 ключевых утверждения — верны; сокращён на ~20 % | нет | полезен; черновик требует лишь сжатия; ~155k токенов, 6 мин |
