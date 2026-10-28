/**
 * Приёмка каркасов `single` и `monorepo` во временных проектах (как `gen/e2e.test.ts`:
 * `dmg-core`, `valibot` и типы — ссылками в `node_modules` проекта;
 * `dmg-core sync` и установку tarball проверяет `consumer-e2e.sh`):
 *
 * - чистый каркас проходит biome (по своему biome.json с плагинами пакета),
 *   tsc, `arch:check` и свои тесты без ручных правок;
 * - карта линтера срабатывает: на каждое правило — файл-нарушитель, biome
 *   выдаёт ожидаемые ID ровно на нём; вне `includes` (тесты, `infra`,
 *   репозитории, точка входа раннера) нарушений нет;
 * - в `monorepo` пакеты `@acme/*` — ссылки на свои каталоги (как
 *   workspaces после `bun install`), `ArchChecker` видит их спецификаторы;
 * - срез `gen` в `monorepo` (модуль, агрегат, UC) с пакетом модуля сам
 *   подключает модуль к приложению (маркеры каркаса) и проходит biome,
 *   tsc, `arch:check` и тесты без ручных правок.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { type ArchApp, ArchChecker } from '../../arch';
import { applyPlan } from '../../gen/apply';
import { GenLayout } from '../../gen/layout';
import { runGen } from '../../gen/main';
import { DmgCoreCli } from '../dmg-core-cli';
import { PackageSource } from '../package-source';
import { ProjectScaffold } from './project-scaffold';
import type { ScaffoldProfile } from './project-scaffold.types';

const PKG = join(import.meta.dir, '../../..');
/** Исполняемый файл инструмента из зависимостей пакета: `<пакет>/<bin>`. */
const bin = (dep: string, path: string) =>
  join(dirname(Bun.resolveSync(`${dep}/package.json`, PKG)), path);
const BIOME = bin('@biomejs/biome', 'bin/biome');
const TSC = bin('typescript', 'bin/tsc');
const projects: string[] = [];

/** Пакеты workspaces `monorepo`: имя → каталог от корня проекта. */
const WORKSPACES: Record<string, string> = {
  '@acme/domain': 'domain',
  '@acme/app': 'app',
  '@acme/cli': 'runners/cli',
};

/** Каркас профиля во временном каталоге ОС со ссылками на зависимости. */
async function scaffold(profile: ScaffoldProfile): Promise<string> {
  const project = mkdtempSync(join(tmpdir(), `dmg-scaffold-${profile}-e2e-`));
  projects.push(project);
  const modules = join(project, 'node_modules');
  mkdirSync(join(modules, '@types'), { recursive: true });
  symlinkSync(PKG, join(modules, 'dmg-core'));
  for (const dep of ['valibot', '@types/bun']) {
    const dir = dirname(Bun.resolveSync(`${dep}/package.json`, PKG));
    symlinkSync(dir, join(modules, dep));
  }
  if (profile === 'monorepo') {
    mkdirSync(join(modules, '@acme'));
    for (const [name, dir] of Object.entries(WORKSPACES)) {
      symlinkSync(join(project, dir), join(modules, name));
    }
  }
  const pkg = await PackageSource.load(PKG);
  const plan = new ProjectScaffold({
    profile,
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

for (const profile of ['single', 'monorepo'] as const) {
  describe(`каркас ${profile} чист`, () => {
    let project: string;
    beforeAll(async () => {
      project = await scaffold(profile);
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
}

/** Нарушители: путь → код и ID правил, которые biome обязан на нём найти. */
type Violations = Record<string, { code: string; ids: string[] }>;

const SINGLE_VIOLATIONS: Violations = {
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

/** Нарушители в раскладке monorepo: правило — на каталогах пакетов. */
const MONOREPO_VIOLATIONS: Violations = {
  'domain/src/v/clock.ts': {
    code: 'export const now = (): number => Date.now();\n',
    ids: ['DOM-14'],
  },
  'domain/src/v/io.ts': {
    code: "import { readFileSync } from 'node:fs';\nexport const read = readFileSync;\n",
    ids: ['ARC-02'],
  },
  // Пакеты приложения — не в белом списке домена.
  'domain/src/v/package.ts': {
    code: "import { App } from '@acme/app';\nexport { App };\n",
    ids: ['ARC-02'],
  },
  // Относительный выход домена — по файлу на каждый каталог вне домена.
  'domain/src/v/escape-app.ts': {
    code: "import { App } from '../../../app/src/app';\nexport { App };\n",
    ids: ['ARC-02'],
  },
  'domain/src/v/escape-runners.ts': {
    code: "import { RunnerCli } from '../../../runners/cli/src/runner-cli';\nexport { RunnerCli };\n",
    ids: ['ARC-02'],
  },
  'domain/src/v/escape-modules.ts': {
    code: "import { M } from '../../../modules/v/src/m';\nexport { M };\n",
    ids: ['ARC-02'],
  },
  'domain/src/v/a/a.state.ts': {
    code: 'export const S = { uuid: 1 };\n',
    ids: ['DOM-11'],
  },
  'domain/src/v/a/a.policy.ts': {
    code: "import { readFileSync } from 'node:fs';\nimport { S } from './a.state';\nexport { readFileSync, S };\n",
    ids: ['ARC-02', 'DOM-01'],
  },
  'domain/src/v/allowed.ts': {
    code: "import { F } from 'dmg-core';\nimport * as v from 'valibot';\nexport const A = v.object({ id: F.uuid('id') });\n",
    ids: [],
  },
  'domain/src/v/a/a.ar.ts': {
    code: "import { S } from './a.state';\nexport const f = () => {\n  throw new Error(String(S));\n};\n",
    ids: ['ERR-01'],
  },
  'modules/v/src/m.ts': {
    code: 'export const M = 1;\n',
    ids: [],
  },
  'modules/v/src/a/uc/do.uc.ts': {
    code: "import { S } from '../../../../../domain/src/v/a/a.state';\nexport const f = (bus: { publish(x: unknown): void }) => bus.publish(S);\n",
    ids: ['API-02', 'DOM-01'],
  },
  'modules/v/src/view.ts': {
    code: 'export const f = (ar: { snapshot(): unknown }) => ar.snapshot();\n',
    ids: ['DOM-17'],
  },
  'modules/v/src/infra/a.json-repo.ts': {
    code: "import { S } from '../../../../domain/src/v/a/a.state';\nexport const f = (ar: { snapshot(): unknown }) => [S, ar.snapshot()];\n",
    ids: [],
  },
  'app/src/env.ts': {
    code: 'export const mode = process.env.APP_MODE;\n',
    ids: ['ARC-09'],
  },
  'app/src/members.ts': {
    code: 'export class K {\n  public x = 1;\n}\n',
    ids: ['CODE-02'],
  },
  'runners/cli/src/dates.ts': {
    code: "import * as v from 'valibot';\nexport const D = v.pipe(v.string(), v.isoDateTime());\n",
    ids: ['DOM-12'],
  },
  'runners/cli/src/do.er.ts': {
    code: "export const f = () => {\n  throw new Error('x');\n};\n",
    ids: ['ERR-01'],
  },
  'modules/v/src/a/uc/do.uc.test.ts': {
    code: "import { S } from '../../../../../domain/src/v/a/a.state';\nexport const f = (bus: { publish(x: unknown): void }) => {\n  bus.publish(S);\n  throw new Error('x');\n};\n",
    ids: [],
  },
};

type Diagnostic = { message: string; location?: { path?: string } };

/** ID правил biome по файлам проекта профиля с записанными нарушителями. */
async function lintFindings(
  profile: ScaffoldProfile,
  violations: Violations,
): Promise<Map<string, string[]>> {
  const project = await scaffold(profile);
  for (const [path, { code }] of Object.entries(violations)) {
    mkdirSync(dirname(join(project, path)), { recursive: true });
    writeFileSync(join(project, path), code);
  }
  const res = await sh(
    [BIOME, 'lint', '--reporter=json', '--max-diagnostics=none', '.'],
    project,
  );
  const diagnostics: Diagnostic[] = JSON.parse(res.out).diagnostics;
  const found = new Map<string, string[]>();
  for (const d of diagnostics) {
    const id = /^([A-Z]+-\d+):/.exec(d.message)?.[1];
    const path = d.location?.path;
    if (id === undefined || path === undefined) continue;
    const ids = found.get(path) ?? [];
    if (!ids.includes(id)) ids.push(id);
    found.set(path, ids.sort());
  }
  return found;
}

const LINT_CASES: [ScaffoldProfile, Violations][] = [
  ['single', SINGLE_VIOLATIONS],
  ['monorepo', MONOREPO_VIOLATIONS],
];

for (const [profile, violations] of LINT_CASES) {
  describe(`карта линтера ${profile} срабатывает`, () => {
    let found: Map<string, string[]>;
    beforeAll(async () => {
      found = await lintFindings(profile, violations);
    }, 60_000);

    for (const [path, { ids }] of Object.entries(violations)) {
      test(`${path}: ${ids.join(', ') || 'нет нарушений'}`, () => {
        expect(found.get(path) ?? []).toEqual(ids);
      });
    }

    test('в файлах каркаса (в т.ч. точке входа раннера с process.env) нарушений нет', () => {
      const others = [...found.keys()].filter((path) => !(path in violations));
      expect(others).toEqual([]);
    });
  });
}

describe('ArchChecker на monorepo видит спецификаторы пакетов', () => {
  let violations: string[];
  beforeAll(async () => {
    const project = await scaffold('monorepo');
    const layout = await GenLayout.read(project);
    const lines: string[] = [];
    const deps = (await PackageSource.load(PKG)).moduleDependencies();
    const print = (line: string) => lines.push(line);
    if (runGen(['module', 'probe', '--write'], layout, print, deps)) {
      throw new Error(`gen module probe: ${lines.join('\n')}`);
    }
    const files: Record<string, string> = {
      // Вход contract — можно; мимо contract (index модуля) — нельзя.
      'app/src/probe-root.ts':
        "export { ProbeModuleDef } from '@acme/domain/probe/contract';\n",
      'app/src/probe-root-bad.ts':
        "export { ProbeModuleDef } from '@acme/domain/probe';\n",
      'runners/cli/src/probe-runner.ts':
        "export { ProbeModuleDef } from '@acme/domain/probe/contract';\nexport { App } from '@acme/app';\n",
      'runners/cli/src/probe-runner-bad.ts':
        "export { ProbeModuleDef } from '@acme/domain/probe';\n",
    };
    for (const [path, code] of Object.entries(files)) {
      writeFileSync(join(project, path), code);
    }
    const domain = await import(layout.domainDir('probe'));
    const app: ArchApp = {
      name: 'acme',
      entry: 'contract',
      modules: [domain.ProbeModuleDef],
      layout: (m) => layout.module(m),
      root: join(project, 'app/src'),
      runners: [join(project, 'runners/cli/src')],
    };
    violations = ArchChecker.of(app)
      .check()
      .map((v) => v.format());
  }, 60_000);

  test('нарушения — только импорты мимо contract (ARC-07, ARC-08)', () => {
    expect(violations).toEqual([
      expect.stringMatching(
        /^ARC-07: .*probe-root-bad\.ts.*@acme\/domain\/probe$/,
      ),
      expect.stringMatching(
        /^ARC-08: .*probe-runner-bad\.ts.*@acme\/domain\/probe$/,
      ),
    ]);
  });
});

describe('monorepo: срез gen подключает модуль без ручных правок', () => {
  let project: string;
  let output: string;
  beforeAll(async () => {
    project = await scaffold('monorepo');
    const cli = new DmgCoreCli(await PackageSource.load(PKG));
    const messages: string[] = [];
    for (const step of [
      ['module', 'todo'],
      ['aggregate', 'todo.task'],
      // Создание публикует `created` (MAN-06), операция — над существующим.
      ['uc', 'todo.task', 'create-task'],
      ['uc', 'todo.task', 'complete-task'],
    ]) {
      const res = await cli.gen(project, [...step, '--write']);
      if (!res.ok) throw new Error(`gen ${step.join(' ')}: ${res.messages}`);
      messages.push(...res.messages);
    }
    output = messages.join('\n');
    // Как после `bun install`: пакет модуля — ссылка в node_modules.
    symlinkSync(
      join(project, 'modules/todo'),
      join(project, 'node_modules/@acme/todo'),
    );
  }, 60_000);

  test('вывод gen: корень сборки, arch-check и package.json изменены, вручную — ничего', () => {
    expect(output).not.toContain('Вставь вручную');
    for (const path of [
      'app/src/app.ts',
      'scripts/arch-check.ts',
      'app/package.json',
    ]) {
      expect(output).toContain(`Изменён: ${join(project, path)}`);
    }
    expect(output).toContain('bun install');
  });

  test('корень сборки: фабрика модуля с JSON-репозиторием агрегата', () => {
    const app = readFileSync(join(project, 'app/src/app.ts'), 'utf8');
    expect(app).toContain(
      "import { TodoModuleDef } from '@acme/domain/todo/contract';",
    );
    expect(app).toContain(
      "import { createTodoModule, TaskJsonRepo } from '@acme/todo';",
    );
    expect(app).toContain(
      "taskRepo: new TaskJsonRepo(join(env.dataDir, 'todo.task.json')),",
    );
    expect(
      JSON.parse(readFileSync(join(project, 'app/package.json'), 'utf8'))
        .dependencies,
    ).toMatchObject({ '@acme/todo': 'workspace:*' });
  });

  test('пакет модуля и вход с репозиторием', () => {
    expect(
      JSON.parse(
        readFileSync(join(project, 'modules/todo/package.json'), 'utf8'),
      ),
    ).toMatchObject({
      name: '@acme/todo',
      exports: { '.': './src/index.ts' },
      dependencies: {
        valibot: expect.any(String),
        '@acme/domain': 'workspace:*',
      },
    });
    expect(
      readFileSync(join(project, 'modules/todo/src/index.ts'), 'utf8'),
    ).toContain("export { TaskJsonRepo } from './infra/task.json-repo';");
  });

  test('biome чист', async () => {
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

  test('arch:check без нарушений с модулем todo', async () => {
    const res = await sh(['bun', 'scripts/arch-check.ts'], project);
    expect(res.text).toContain('arch:check: нарушений нет');
    expect(res.code).toBe(0);
  }, 60_000);

  test('тесты проекта зелёные', async () => {
    const res = await sh(['bun', 'test'], project);
    expect(res.text).toContain(' 0 fail');
    expect(res.code).toBe(0);
  }, 120_000);
});
