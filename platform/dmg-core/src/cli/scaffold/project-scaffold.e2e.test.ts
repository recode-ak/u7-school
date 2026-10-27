/**
 * Приёмка каркаса `single` во временных проектах (как `gen/e2e.test.ts`:
 * `dmg-core`, `valibot` и типы — ссылками в `node_modules` проекта;
 * `dmg-core sync` и установку tarball проверяет `consumer-e2e.sh`):
 *
 * - чистый каркас проходит biome (по своему biome.json с плагинами пакета),
 *   tsc, `arch:check` и свои тесты без ручных правок;
 * - карта линтера срабатывает: на каждое правило — файл-нарушитель, biome
 *   выдаёт ожидаемые ID ровно на нём; вне `includes` (тесты, `infra`,
 *   репозитории, точка входа раннера) нарушений нет.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { applyPlan } from '../../gen/apply';
import { PackageSource } from '../package-source';
import { ProjectScaffold } from './project-scaffold';

const PKG = join(import.meta.dir, '../../..');
/** Исполняемый файл инструмента из зависимостей пакета: `<пакет>/<bin>`. */
const bin = (dep: string, path: string) =>
  join(dirname(Bun.resolveSync(`${dep}/package.json`, PKG)), path);
const BIOME = bin('@biomejs/biome', 'bin/biome');
const TSC = bin('typescript', 'bin/tsc');
const projects: string[] = [];

/** Каркас `single` во временном каталоге ОС со ссылками на зависимости. */
async function scaffold(): Promise<string> {
  const project = mkdtempSync(join(tmpdir(), 'dmg-scaffold-e2e-'));
  projects.push(project);
  const modules = join(project, 'node_modules');
  mkdirSync(join(modules, '@types'), { recursive: true });
  symlinkSync(PKG, join(modules, 'dmg-core'));
  for (const dep of ['valibot', '@types/bun']) {
    const dir = dirname(Bun.resolveSync(`${dep}/package.json`, PKG));
    symlinkSync(dir, join(modules, dep));
  }
  const pkg = await PackageSource.load(PKG);
  const plan = new ProjectScaffold({
    profile: 'single',
    name: 'acme',
    pkg,
    root: project,
  }).plan();
  applyPlan(plan, { write: true });
  return project;
}

async function sh(
  cmd: string[],
  cwd: string,
): Promise<{ code: number; out: string; text: string }> {
  const proc = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code: await proc.exited, out, text: out + err };
}

afterAll(() => {
  for (const project of projects) {
    rmSync(project, { recursive: true, force: true });
  }
});

describe('каркас single чист', () => {
  let project: string;
  beforeAll(async () => {
    project = await scaffold();
  });

  test('biome чист по biome.json проекта', async () => {
    const res = await sh([BIOME, 'check', '.'], project);
    expect(res).toMatchObject({
      code: 0,
      text: expect.stringContaining('No fixes'),
    });
  }, 60_000);

  test('tsc чист', async () => {
    const res = await sh([TSC, '--noEmit', '-p', project], project);
    expect(res.text).toBe('');
    expect(res.code).toBe(0);
  }, 120_000);

  test('arch:check без нарушений при пустом списке модулей', async () => {
    const res = await sh(['bun', 'scripts/arch-check.ts'], project);
    expect(res.text).toContain('arch:check: нарушений нет');
    expect(res.code).toBe(0);
  }, 60_000);

  test('тесты каркаса зелёные', async () => {
    const res = await sh(['bun', 'test'], project);
    expect(res.text).toContain(' 0 fail');
    expect(res.code).toBe(0);
  }, 120_000);
});

/** Нарушители: путь → код и ID правил, которые biome обязан на нём найти. */
const VIOLATIONS: Record<string, { code: string; ids: string[] }> = {
  'src/domain/v/clock.ts': {
    code: 'export const now = (): number => Date.now();\n',
    ids: ['DOM-14'],
  },
  'src/domain/v/io.ts': {
    code: "import { readFileSync } from 'node:fs';\nexport const read = readFileSync;\n",
    ids: ['ARC-02'],
  },
  'src/domain/v/platform.ts': {
    code: "import { ApiApp } from 'dmg-core/app';\nexport const api = ApiApp;\n",
    ids: ['ARC-02'],
  },
  'src/domain/v/escape.ts': {
    code: "import { App } from '../../app/app';\nimport { RunnerCli } from '../../runner/runner-cli';\nexport { App, RunnerCli };\n",
    ids: ['ARC-02'],
  },
  'src/domain/v/dates.ts': {
    code: "import * as v from 'valibot';\nexport const D = v.pipe(v.string(), v.isoDateTime());\n",
    ids: ['DOM-12'],
  },
  'src/domain/v/a/a.state.ts': {
    code: 'export const S = { uuid: 1 };\n',
    ids: ['DOM-11'],
  },
  // Policy: ARC-02 и DOM-01 в одной секции — biome не сливает их.
  'src/domain/v/a/a.policy.ts': {
    code: "import { readFileSync } from 'node:fs';\nimport { S } from './a.state';\nexport { readFileSync, S };\n",
    ids: ['ARC-02', 'DOM-01'],
  },
  'src/domain/v/a/a.rules.ts': {
    code: "import { S } from './a.state';\nexport { S };\n",
    ids: ['DOM-01'],
  },
  'src/domain/v/a/a.dcs.ts': {
    code: "import type { S } from './a.state';\nexport type D = typeof S;\n",
    ids: ['DOM-01'],
  },
  // Белый список домена: корень dmg-core и valibot.
  'src/domain/v/allowed.ts': {
    code: "import { F } from 'dmg-core';\nimport * as v from 'valibot';\nexport const A = v.object({ id: F.uuid('id') });\n",
    ids: [],
  },
  // Ar видит свой state; штатный отказ — не исключение.
  'src/domain/v/a/a.ar.ts': {
    code: "import { S } from './a.state';\nexport const f = () => {\n  throw new Error(String(S));\n};\n",
    ids: ['ERR-01'],
  },
  'src/app/v/a/uc/do.uc.ts': {
    code: "import { S } from '../../../../domain/v/a/a.state';\nexport const f = (bus: { publish(x: unknown): void }) => bus.publish(S);\n",
    ids: ['API-02', 'DOM-01'],
  },
  'src/app/v/a/job/sweep.job.ts': {
    code: 'export const f = (bus: { publish(x: unknown): void }) => bus.publish(1);\n',
    ids: ['API-02'],
  },
  'src/app/v/view.ts': {
    code: 'export const f = (ar: { snapshot(): unknown }) => ar.snapshot();\n',
    ids: ['DOM-17'],
  },
  'src/app/v/env.ts': {
    code: 'export const mode = process.env.APP_MODE;\n',
    ids: ['ARC-09'],
  },
  'src/app/v/members.ts': {
    code: 'export class K {\n  public x = 1;\n}\n',
    ids: ['CODE-02'],
  },
  // Вне includes: infra видит state, репозиторий берёт снимок.
  'src/app/v/infra/a.json-repo.ts': {
    code: "import { S } from '../../../domain/v/a/a.state';\nexport const f = (ar: { snapshot(): unknown }) => [S, ar.snapshot()];\n",
    ids: [],
  },
  // Тесты вне всех правил слоёв.
  'src/domain/v/a/a.policy.test.ts': {
    code: "import { readFileSync } from 'node:fs';\nimport { S } from './a.state';\nexport const f = () => [readFileSync, S, Date.now(), process.env.X];\n",
    ids: [],
  },
  'src/app/v/a/uc/do.uc.test.ts': {
    code: "import { S } from '../../../../domain/v/a/a.state';\nexport const f = (bus: { publish(x: unknown): void }) => {\n  bus.publish(S);\n  throw new Error('x');\n};\n",
    ids: [],
  },
};

type Diagnostic = { message: string; location?: { path?: string } };

describe('карта линтера single срабатывает', () => {
  let found: Map<string, string[]>;
  beforeAll(async () => {
    const project = await scaffold();
    for (const [path, { code }] of Object.entries(VIOLATIONS)) {
      mkdirSync(dirname(join(project, path)), { recursive: true });
      writeFileSync(join(project, path), code);
    }
    const res = await sh(
      [BIOME, 'lint', '--reporter=json', '--max-diagnostics=none', '.'],
      project,
    );
    const diagnostics: Diagnostic[] = JSON.parse(res.out).diagnostics;
    found = new Map();
    for (const d of diagnostics) {
      const id = /^([A-Z]+-\d+):/.exec(d.message)?.[1];
      const path = d.location?.path;
      if (id === undefined || path === undefined) continue;
      const ids = found.get(path) ?? [];
      if (!ids.includes(id)) ids.push(id);
      found.set(path, ids.sort());
    }
  }, 60_000);

  for (const [path, { ids }] of Object.entries(VIOLATIONS)) {
    test(`${path}: ${ids.join(', ') || 'нет нарушений'}`, () => {
      expect(found.get(path) ?? []).toEqual(ids);
    });
  }

  test('в файлах каркаса (в т.ч. runner/main.ts с process.env) нарушений нет', () => {
    const others = [...found.keys()].filter((path) => !(path in VIOLATIONS));
    expect(others).toEqual([]);
  });
});
