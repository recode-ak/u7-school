/**
 * Гейт после субагента в pi: склеивает ответ субагента с выводом `agent-gate`.
 *
 * В Claude Code красный гейт возвращается самому субагенту (хук SubagentStop).
 * В pi процесс субагента к этому моменту завершён, поэтому итог уходит
 * вызывающему агенту: красный гейт — ошибка инструмента с выводом проверки.
 * Логика проверки — только в `scripts/agent-gate.ts`, здесь лишь запуск.
 *
 * Модуль импортирует `.pi/extensions/subagent/index.ts`; pi работает под Node,
 * поэтому без Bun API.
 */

import { spawn } from 'node:child_process';

/** Роли, меняющие код; совпадает с matcher хука в `.claude/settings.json` */
export const GATED_AGENTS = ['migrator', 'domain-author', 'api-author'];

export interface GateRun {
  code: number;
  stdout: string;
  stderr: string;
}

export interface GatedAnswer {
  text: string;
  isError: boolean;
}

/** Нужен ли гейт после вызова этих агентов */
export function needsGate(agents: string[]): boolean {
  return agents.some((a) => GATED_AGENTS.includes(a));
}

/** Ответ субагента + вывод гейта → итоговый ответ инструмента */
export function withGate(answer: string, gate: GateRun): GatedAnswer {
  const output = [gate.stdout.trim(), gate.stderr.trim()]
    .filter((s) => s !== '')
    .join('\n\n');
  if (gate.code === 0) {
    return { text: `${answer}\n\n---\n${output}`, isError: false };
  }
  const verdict =
    gate.code === 2
      ? 'Гейт красный: передай ошибки субагенту на исправление и вызови его снова.'
      : `agent-gate упал (код ${gate.code}), проверка не выполнена.`;
  return { text: `${answer}\n\n---\n${verdict}\n\n${output}`, isError: true };
}

/** Запуск `bun run scripts/agent-gate.ts` в корне проекта `cwd` */
export function runAgentGate(cwd: string): Promise<GateRun> {
  return new Promise((resolve) => {
    const proc = spawn('bun', ['run', 'scripts/agent-gate.ts'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('error', (e) => resolve({ code: 1, stdout, stderr: e.message }));
    proc.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}
