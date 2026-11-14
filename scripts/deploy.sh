#!/usr/bin/env bash
# ═══ Деплой u7-school-bot (запускается НА ПРОД-СЕРВЕРЕ) ═══
#
# Использование (из корня рабочей копии):
#   bash scripts/deploy.sh 0.1.0
#
# Что делает:
#   1. Гейты: чистая рабочая копия, тег существует в origin, нет коммитов вне тега
#   2. Остановка бота — бэкап и checkout без параллельной записи
#   3. Бэкап данных → data/backup/<timestamp>-before-deploy/ (в meta.txt —
#      версия ещё развёрнутого кода: снимок для отката)
#   4. git checkout vX.Y.Z — деплой по тегу, не по main
#   5. bun install --frozen-lockfile
#   6. Запуск по pm2.config.cjs (delete → start → save) + smoke-check
#
# Запуск — по конфигу, а не `pm2 restart <имя>`: restart по имени берёт
# сохранённые в pm2 args и не видит смены пути точки входа в новом теге.
#
# Релиз с миграцией данных выкатывается по своему документу выкатки:
# миграции идут между checkout и запуском, скрипт их не делает.
#
# Откат на предыдущую версию:
#   bash scripts/deploy.sh <предыдущая версия>
#   Если схема данных менялась — сначала восстанови бэкап, чей meta.txt
#   указывает на ту же версию кода (docs/backup.md, «Восстановление»):
#     rsync -a --exclude manifest.json --exclude meta.txt data/backup/<каталог>/ data/
#
# После деплоя: отправь боту тестовое сообщение и нажми кнопку старого
# экрана — диалог должен продолжиться (персистентность сессий).
#
# Первый раз (пока на сервере нет этого скрипта): выполнить шаги 1–5
# вручную — скрипт появится после первого checkout тега.

set -euo pipefail

APP_NAME="u7-school-bot" # имя приложения из pm2.config.cjs

main() {
  local version="${1:-}"
  if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "❌ Укажи версию (тег без 'v'): bash scripts/deploy.sh 0.1.0"
    echo "   Список тегов: git fetch --tags && git tag -l | sort -V"
    exit 1
  fi

  # Работаем строго из корня репо
  cd "$(git rev-parse --show-toplevel)"

  local tag="v${version}"

  # ── Гейт: чистая рабочая копия (checkout затёр бы ручные правки) ──
  if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Рабочая копия не чистая — деплой отменён:"
    git status --short
    echo "   Разберись вручную (commit / stash / rm) и запусти снова."
    exit 1
  fi

  # ── Гейт: тег есть в origin ──
  echo "▶ git fetch origin --tags"
  git fetch origin --tags --prune
  if ! git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
    echo "❌ Тег ${tag} не найден. Сначала сделай релиз локально (scripts/release.sh)."
    exit 1
  fi

  # ── Гейт: в HEAD/main не должно быть коммитов вне тега ──
  # Иначе checkout молча выкинет их содержимое из рабочего каталога
  # (например, контентную доставку, закоммиченную на сервере).
  for ref in HEAD main; do
    git rev-parse -q --verify "${ref}" >/dev/null 2>&1 || continue
    lost="$(git rev-list --count "${tag}..${ref}")"
    if [ "${lost}" -gt 0 ]; then
      echo "❌ В '${ref}' ${lost} коммит(ов), которых нет в ${tag}:"
      git log --oneline "${tag}..${ref}" | head -10
      echo "   Деплой отбросил бы их содержимое из рабочего каталога."
      echo "   Запушь их → release.sh с ними → деплой нового тега."
      exit 1
    fi
  done

  # ── 1. Остановка: бэкап и checkout без параллельной записи бота ──
  echo "▶ pm2 stop ${APP_NAME}"
  pm2 stop "$APP_NAME" || echo "   (не запущен — продолжаем)"

  # ── 2. Бэкап данных — ВСЕГДА перед обновлением ──
  echo "▶ Бэкап данных (before-deploy)"
  bash scripts/backup.sh before-deploy

  # ── 3. Checkout тега ──
  echo "▶ git checkout ${tag}"
  git checkout --quiet "$tag"
  echo "   Развёрнута версия: $(git describe --tags)"

  # ── 4. Зависимости ──
  echo "▶ bun install --frozen-lockfile"
  bun install --frozen-lockfile

  # ── 5. Запуск по конфигу нового тега ──
  echo "▶ pm2 delete ${APP_NAME} → start pm2.config.cjs → save"
  pm2 delete "$APP_NAME" || true
  pm2 start pm2.config.cjs --env production
  pm2 save

  # ── 6. Smoke-check ──
  echo "▶ Ожидание старта (5 сек)…"
  sleep 5
  pm2 status "$APP_NAME"
  echo "▶ Хвост логов (проверь, нет ли ошибок старта):"
  pm2 logs "$APP_NAME" --lines 20 --nostream

  echo ""
  echo "✅ Деплой ${tag} завершён. Отправь боту тестовое сообщение:"
  echo "   — старые кнопки должны работать (сессии пережили рестарт);"
  echo "   — при проблемах: bash scripts/deploy.sh <предыдущая версия>"
  echo "     (бэкап перед этим деплоем: $(ls -td data/backup/*-before-deploy 2>/dev/null | head -1))"
}

# main вызывается последней строкой: к этому моменту bash уже дочитал весь
# файл в память — checkout в середине скрипта не сломает его выполнение,
# даже если содержимое deploy.sh в новом теге изменилось.
main "$@"
