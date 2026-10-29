# Plan: dmg-docs_20261029

Каждая фаза — отдельная сессия. Код — TDD (red → запуск → green). Правки пакета — коммит в `~/dev/tools/dmg/dmg-core` (зелёные `check` и `e2e`), затем в u7-school `bun install`, `dmg:sync`/`agents:sync` при изменении доставляемых файлов, `check`, коммит с SHA пакета. Данные `data/` не трогаем; пушей и деплоя нет.

## Фаза 0: Базовая линия

- [ ] Task: Зафиксировать базовую линию: `bun test`, `bun run e2e` пакета и u7-school; точный замер `dmg-core/src` (доля комментариев, блоки ≥12 строк, строки с `D-NN`, `TR-NN`) в черновике `summary.md`
- [ ] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md)

## Фаза 1: Правило и решение

- [ ] Task: Решение `D-NN` в `decisions.md` пакета: типы документов, ответственность, направление ссылок, критерий «оправдан»; обсудить с Нурболатом
- [ ] Task: Правило о комментариях в `rules.md` пакета (новый ID)
- [ ] Task: Раздел «Как устроена документация» в `docs/index.md`: типы, ответственность, кто и когда актуализирует
- [ ] Task: Правило и критерий в промптах `domain-author`, `api-author` (пакет), `migrator`, `tech-lead` (`.agents-core/roles`), проверка в `reviewer`; `agents:sync`
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: Проверки, роль и concepts

- [ ] Task: Тест ссылок (`docs/`, `llms.txt`, JSDoc `@see`) в `bun run check`
    - [ ] Тесты: битая ссылка, ссылка на несуществующий файл, ссылка против направления; red
    - [ ] Реализация; green
- [ ] Task: Проверка `covers:` во front-matter concepts — `warn` в `check`, блок в гейте релиза (`RELEASING.md`)
    - [ ] Тесты: исходник менялся позже документа → warn; red
    - [ ] Реализация; green
- [ ] Task: Роль `documentarian` в `.agents-core/roles/` (только чтение, список расхождений, триггер — после фазы, менявшей документы, и перед релизом); пилот ведётся в `summary.md`
- [ ] Task: Каталог `concepts/`, `docs/index.md`, `llms.txt` с двумя входами
- [ ] Task: Concepts: «Путь вызова UC», «Слои и зависимости», «Жизненный цикл агрегата и событий», «Как читать модуль» (mermaid, `covers:`)
- [ ] Task: Ревью reviewer; вызов `documentarian` (пилот)
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Нарезка существующих docs

- [ ] Task: `transport`, `errors-result`, `caller` — нормативная часть в reference, объяснение — в concepts
- [ ] Task: `layers`, `domain-modeling`, `manifests` — то же
- [ ] Task: `testing`, `rules`, `naming`, `typescript` — в reference; `guides/` — обновить ссылки
- [ ] Task: Ссылки в `llms.txt`, скилах, `AGENTS.md` u7-school; `dmg:sync`; тест ссылок зелёный
- [ ] Task: Ревью reviewer; вызов `documentarian`
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: Стрижка JSDoc

- [ ] Task: `kernel` — для каждого сценария сначала сверка с тестами, недостающие (red → green), затем сокращение комментария
- [ ] Task: `domain` — то же
- [ ] Task: `app` (`UnitOfWork.commit`, `CommandReplay`, `use-case-from-def`, `reaction`) — сценарии сбоев в именованные тесты, выжимка в concepts
- [ ] Task: `arch`, `cli` (комментарии `scaffold/app-sources.ts` — в шаблоны), `testing`
- [ ] Task: `D-NN` из середины фраз — в шапки; `@see` на документы
- [ ] Task: Ревью reviewer; вызов `documentarian`
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

## Фаза 5: Финал

- [ ] Task: Повторный замер, сверка с базовой линией, `check` и `e2e` пакета и проекта
- [ ] Task: `bun install` в u7-school, SHA пакета; `summary.md` с разделом «Пилот ролей» (`documentarian`)
- [ ] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md)
