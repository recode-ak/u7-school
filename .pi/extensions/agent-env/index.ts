/**
 * Помечает окружение pi как агентское: `AGENT=1`.
 *
 * Bun по `AGENT`/`CLAUDECODE` переключает `bun test` в краткий вывод (только
 * падения и итог) — без этого каждый `(pass)` уходит в контекст модели.
 * Claude Code ставит `CLAUDECODE=1` сам, pi — нет. Bash-инструмент pi и
 * дочерние pi-процессы (расширение subagent) наследуют `process.env`.
 */

export default function () {
  process.env.AGENT ??= '1';
}
