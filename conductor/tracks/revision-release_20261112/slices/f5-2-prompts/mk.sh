#!/bin/bash
# mk.sh <n> "<шаг>" — промпт порции из шаблона p2
S=$(dirname "$0")
awk -v step="$2" 'NR==3{print step; next} {print}' $S/f5-2-p2.md > $S/f5-2-p$1.md
