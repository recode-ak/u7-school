import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  changedPaths,
  exec,
  type GatePlan,
  loadWorkspaces,
  parseStatus,
  planGate,
  type Runner,
  runGate,
  tail,
  type Workspace,
} from './agent-gate';

function ws(name: string, dir: string, deps: string[] = []): Workspace {
  return { name: `@u7-scl/${name}`, dir, deps, hasCheck: true };
}

const WORKSPACES: Workspace[] = [
  ws('core', 'packages/core'),
  ws('user', 'packages/user', ['@u7-scl/core']),
  ws('course', 'packages/course', ['@u7-scl/core', '@u7-scl/user']),
  ws('stream', 'packages/stream', ['@u7-scl/user', '@u7-scl/course']),
  ws('w3school', 'packages/w3school'),
  ws('bot', 'apps/u7-bot', ['@u7-scl/stream']),
];

describe('parseStatus', () => {
  test('пути из git status -z, включая новые и удалённые', () => {
    const out = ' M packages/user/a.ts\0?? packages/core/b.ts\0 D x.md\0';
    expect(parseStatus(out)).toEqual([
      'packages/user/a.ts',
      'packages/core/b.ts',
      'x.md',
    ]);
  });

  test('переименование даёт оба пути', () => {
    const out = 'R  packages/user/new.ts\0packages/core/old.ts\0';
    expect(parseStatus(out)).toEqual([
      'packages/user/new.ts',
      'packages/core/old.ts',
    ]);
  });

  test('пустой вывод — нет путей', () => {
    expect(parseStatus('')).toEqual([]);
  });
});

describe('planGate', () => {
  test('нет изменений — пропуск', () => {
    expect(planGate([], WORKSPACES).kind).toBe('skip');
  });

  test('только .md — пропуск', () => {
    const plan = planGate(
      ['conductor/tracks/x/plan.md', 'packages/user/README.md'],
      WORKSPACES,
    );
    expect(plan.kind).toBe('skip');
  });

  test('листовой пакет — только он', () => {
    const plan = planGate(['packages/w3school/src/a.ts'], WORKSPACES);
    expect(plan).toEqual({ kind: 'packages', dirs: ['packages/w3school'] });
  });

  test('пакет и транзитивно зависимые', () => {
    const plan = planGate(['packages/user/src/a.ts'], WORKSPACES);
    expect(plan).toEqual({
      kind: 'packages',
      dirs: [
        'apps/u7-bot',
        'packages/course',
        'packages/stream',
        'packages/user',
      ],
    });
  });

  test('несколько пакетов — объединение без повторов', () => {
    const plan = planGate(
      ['packages/stream/a.ts', 'packages/course/b.ts', 'packages/stream/c.ts'],
      WORKSPACES,
    );
    expect(plan).toEqual({
      kind: 'packages',
      dirs: ['apps/u7-bot', 'packages/course', 'packages/stream'],
    });
  });

  test('корневой конфиг — полный check', () => {
    const plan = planGate(
      ['packages/w3school/a.ts', 'tsconfig.json'],
      WORKSPACES,
    );
    expect(plan.kind).toBe('full');
  });

  test('файл вне пакетов (scripts/) — полный check', () => {
    expect(planGate(['scripts/x.ts'], WORKSPACES).kind).toBe('full');
  });

  test('.md ролей агентов — полный check (его проверяет agents:check)', () => {
    for (const path of [
      '.agents-core/roles/reviewer.md',
      '.agents-core/common.md',
      '.claude/agents/reviewer.md',
      '.pi/agents/reviewer.md',
    ]) {
      expect(planGate([path], WORKSPACES).kind).toBe('full');
    }
  });

  test('пакет без скрипта check — полный check', () => {
    const plan = planGate(
      ['packages/tool/a.ts'],
      [{ ...ws('tool', 'packages/tool'), hasCheck: false }],
    );
    expect(plan.kind).toBe('full');
  });

  test('зависимый пакет без скрипта check — полный check', () => {
    const plan = planGate(
      ['packages/core/a.ts'],
      [
        ws('core', 'packages/core'),
        { ...ws('tool', 'packages/tool', ['@u7-scl/core']), hasCheck: false },
      ],
    );
    expect(plan.kind).toBe('full');
  });

  test('префикс имени пакета не путается с другим пакетом', () => {
    const plan = planGate(
      ['packages/user-extra/a.ts'],
      [ws('user', 'packages/user')],
    );
    expect(plan.kind).toBe('full');
  });
});

describe('tail', () => {
  test('оставляет последние строки', () => {
    expect(tail('a\nb\nc\nd\n', 2)).toBe('c\nd');
  });

  test('короткий текст — без изменений', () => {
    expect(tail('a\nb', 10)).toBe('a\nb');
  });
});

describe('runGate', () => {
  function fakeRunner(failing: string[] = []): {
    run: Runner;
    calls: string[];
  } {
    const calls: string[] = [];
    const run: Runner = async (cwd) => {
      calls.push(cwd);
      const ok = !failing.includes(cwd);
      return { ok, output: ok ? 'ok' : `ошибка в ${cwd}\nстрока 2` };
    };
    return { run, calls };
  }

  test('пропуск — exit 0 без запусков', async () => {
    const { run, calls } = fakeRunner();
    const res = await runGate({ kind: 'skip', reason: 'нет изменений' }, run);
    expect(res.code).toBe(0);
    expect(calls).toEqual([]);
    expect(res.stdout).toContain('нет изменений');
  });

  test('полный check — запуск в корне', async () => {
    const { run, calls } = fakeRunner();
    const res = await runGate({ kind: 'full', reason: 'tsconfig.json' }, run);
    expect(res.code).toBe(0);
    expect(calls).toEqual(['.']);
  });

  test('зелёные пакеты — exit 0, все запущены', async () => {
    const { run, calls } = fakeRunner();
    const plan: GatePlan = {
      kind: 'packages',
      dirs: ['packages/core', 'packages/user'],
    };
    const res = await runGate(plan, run);
    expect(res.code).toBe(0);
    expect(calls.sort()).toEqual(['packages/core', 'packages/user']);
    expect(res.stderr).toBe('');
  });

  test('красный пакет — exit 2, в stderr имя и хвост вывода', async () => {
    const { run } = fakeRunner(['packages/user']);
    const plan: GatePlan = {
      kind: 'packages',
      dirs: ['packages/core', 'packages/user'],
    };
    const res = await runGate(plan, run);
    expect(res.code).toBe(2);
    expect(res.stderr).toContain('packages/user');
    expect(res.stderr).toContain('ошибка в packages/user');
    expect(res.stderr).not.toContain('ошибка в packages/core');
  });
});

describe('exec', () => {
  test('код возврата и вывод команды', async () => {
    const ok = await exec(['bun', '-e', 'console.log("привет")'], '.');
    expect(ok).toEqual({ ok: true, output: 'привет\n\n' });
    const bad = await exec(
      ['bun', '-e', 'console.error("сбой"); process.exit(3)'],
      '.',
    );
    expect(bad.ok).toBe(false);
    expect(bad.output).toContain('сбой');
  });
});

describe('changedPaths', () => {
  test('чистое дерево — пусто, новый файл — его путь', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agent-gate-git-'));
    try {
      await exec(['git', 'init', '-q'], root);
      expect(changedPaths(root)).toEqual([]);
      await mkdir(join(root, 'packages/a'), { recursive: true });
      await writeFile(join(root, 'packages/a/x.ts'), '');
      expect(changedPaths(root)).toEqual(['packages/a/x.ts']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('loadWorkspaces', () => {
  test('читает пакеты из workspaces корневого package.json', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agent-gate-'));
    try {
      const pkg = async (dir: string, json: object) => {
        await mkdir(join(root, dir), { recursive: true });
        await writeFile(join(root, dir, 'package.json'), JSON.stringify(json));
      };
      await pkg('.', { workspaces: ['packages/*', 'apps/*'] });
      await pkg('packages/core', {
        name: '@u7-scl/core',
        scripts: { check: 'x' },
      });
      await pkg('apps/bot', {
        name: '@u7-scl/bot',
        dependencies: { '@u7-scl/core': 'workspace:*', valibot: '^1' },
        devDependencies: { '@u7-scl/dev': 'workspace:*' },
      });

      const list = await loadWorkspaces(root);
      expect(list.sort((a, b) => a.dir.localeCompare(b.dir))).toEqual([
        {
          name: '@u7-scl/bot',
          dir: 'apps/bot',
          deps: ['@u7-scl/core', '@u7-scl/dev', 'valibot'],
          hasCheck: false,
        },
        {
          name: '@u7-scl/core',
          dir: 'packages/core',
          deps: [],
          hasCheck: true,
        },
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
