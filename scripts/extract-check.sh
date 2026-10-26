#!/usr/bin/env bash
# Проверка самодостаточности пакета dmg-core (трек dmg-core-extract, Ф3, Ф6).
#
#   bun run extract:check
#
# 1. Копия пакета в пустой каталог (вне монорепо) → install → check.
# 2. В копии — сквозная проверка потребителя пакета (`bun run e2e`,
#    scripts/consumer-e2e.sh пакета): publish --dry-run, состав tarball,
#    установка в пустой проект, init, документация, плагины biome, gen.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG="$ROOT/platform/dmg-core"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "extract:check: копия пакета → $WORK/copy"
mkdir "$WORK/copy"
tar -C "$PKG" --exclude=node_modules --exclude='*.tgz' --exclude='tmp-gen-e2e-*' -cf - . | tar -C "$WORK/copy" -xf -
cd "$WORK/copy"
bun install
bun run check
bun run e2e
echo "extract:check: ok"
