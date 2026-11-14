import { describe, expect, test } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TempDir } from 'dmg-core/testing';
import {
  type GateRun,
  needsGate,
  runAgentGate,
  withGate,
} from './subagent-gate';

describe('needsGate', () => {
  test('роли, меняющие код, — гейт нужен', () => {
    expect(needsGate(['migrator'])).toBe(true);
    expect(needsGate(['dmg-domain-author'])).toBe(true);
    expect(needsGate(['dmg-reviewer', 'dmg-api-author'])).toBe(true);
  });

  test('только dmg-reviewer или чужие агенты — гейт не нужен', () => {
    expect(needsGate(['dmg-reviewer'])).toBe(false);
    expect(needsGate(['dmg-tech-lead', 'dmg-data-keeper'])).toBe(false);
    expect(needsGate(['scout'])).toBe(false);
    expect(needsGate(['domain-author', 'api-author'])).toBe(false);
    expect(needsGate([])).toBe(false);
  });
});

describe('withGate', () => {
  const answer = 'Срез готов.';

  test('зелёный — ответ субагента и строка гейта, не ошибка', () => {
    const gate: GateRun = {
      code: 0,
      stdout: 'agent-gate: check в modules/user — зелёный\n',
      stderr: '',
    };
    const res = withGate(answer, gate);
    expect(res.isError).toBe(false);
    expect(res.text).toStartWith(answer);
    expect(res.text).toContain('agent-gate: check в modules/user — зелёный');
  });

  test('пропуск — ответ и причина пропуска, не ошибка', () => {
    const gate: GateRun = {
      code: 0,
      stdout: 'agent-gate: пропуск — изменены только .md-файлы\n',
      stderr: '',
    };
    const res = withGate(answer, gate);
    expect(res.isError).toBe(false);
    expect(res.text).toContain('пропуск — изменены только .md-файлы');
  });

  test('красный — ошибка, в ответе вывод гейта и указание передать на исправление', () => {
    const gate: GateRun = {
      code: 2,
      stdout: 'agent-gate: check в modules/user\n',
      stderr:
        'agent-gate: красный в modules/user.\n\n── modules/user ──\nTS2322',
    };
    const res = withGate(answer, gate);
    expect(res.isError).toBe(true);
    expect(res.text).toStartWith(answer);
    expect(res.text).toContain('TS2322');
    expect(res.text).toContain('красный в modules/user');
    expect(res.text).toContain('на исправление');
  });

  test('сбой самого гейта — ошибка с кодом и выводом', () => {
    const gate: GateRun = { code: 1, stdout: '', stderr: 'git status упал' };
    const res = withGate(answer, gate);
    expect(res.isError).toBe(true);
    expect(res.text).toContain('код 1');
    expect(res.text).toContain('git status упал');
  });
});

describe('runAgentGate', () => {
  test('запускает scripts/agent-gate.ts в каталоге и отдаёт код и вывод', async () => {
    using tmp = TempDir.create('subagent-gate-');
    const root = tmp.path;
    await mkdir(join(root, 'scripts'));
    await writeFile(
      join(root, 'scripts/agent-gate.ts'),
      'console.log("из гейта " + process.cwd()); console.error("err"); process.exit(2);',
    );
    const res = await runAgentGate(root);
    expect(res.code).toBe(2);
    expect(res.stdout).toContain('из гейта');
    expect(res.stdout).toContain(root);
    expect(res.stderr).toContain('err');
  });
});
