import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyPlan } from './apply';
import { parseArgs } from './cli';
import { planDomainAggregate } from './kinds/aggregate';
import { planDomainModule } from './kinds/module';
import { planDomainService } from './kinds/service';
import { GenLayout } from './layout';

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'gen-snapshot-'));
  const run = (argv: string[], plan: typeof planDomainModule) =>
    applyPlan(
      plan(
        parseArgs(
          argv,
          new GenLayout({ ...GenLayout.defaults, domain: '{m}' }, root),
        ),
      ),
      {
        write: true,
      },
    );
  run(['module', 'stream'], planDomainModule);
  run(['aggregate', 'stream.student'], planDomainAggregate);
  run(['dcs', 'stream', 'stream-progress'], planDomainService);
  run(['dqs', 'stream', 'stream-navigation'], planDomainService);
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

test('дерево домена совпадает с naming.md §2', () => {
  const files = readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts'))
    .sort();
  expect(files).toEqual([
    'stream/index.ts',
    'stream/stream-navigation.dqs.test.ts',
    'stream/stream-navigation.dqs.ts',
    'stream/stream-progress.dcs.test.ts',
    'stream/stream-progress.dcs.ts',
    'stream/stream.module.test.ts',
    'stream/stream.module.ts',
    'stream/student/student.ar.test.ts',
    'stream/student/student.ar.ts',
    'stream/student/student.errors.ts',
    'stream/student/student.events.ts',
    'stream/student/student.policy.test.ts',
    'stream/student/student.policy.ts',
    'stream/student/student.state.ts',
  ]);
});

test('сгенерированное проходит biome без правок', () => {
  const biome = Bun.spawnSync(
    ['bunx', 'biome', 'check', `--config-path=${process.cwd()}`, root],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  expect(biome.stderr.toString() + biome.stdout.toString()).not.toContain('×');
  expect(biome.exitCode).toBe(0);
});
