/**
 * Приёмка генераторов (`gen-e2e`): срез module → aggregate → uc → er → job →
 * dcs → dqs создаётся в настоящих каталогах репозитория (иначе не
 * разрешаются `dmg-core` и `@u7-scl/domain`) и проходит biome, tsc, bun test
 * и arch:check без ручных правок. Каталоги среза удаляются в конце.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { type ArchApp, archCheck, formatViolation } from 'dmg-core';
import { runGen } from './main.ts';

const REPO = join(import.meta.dir, '../..');
const MODULE = 'genprobe';
const DOMAIN = join(REPO, 'packages/domain/src', MODULE);
const APP = join(REPO, 'packages', MODULE);

const cleanup = () => {
  rmSync(DOMAIN, { recursive: true, force: true });
  rmSync(APP, { recursive: true, force: true });
};

async function sh(cmd: string[]): Promise<{ code: number; text: string }> {
  const proc = Bun.spawn(cmd, { cwd: REPO, stdout: 'pipe', stderr: 'pipe' });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code: await proc.exited, text: out + err };
}

beforeAll(() => {
  cleanup();
  const steps = [
    ['module', MODULE],
    ['aggregate', `${MODULE}.student`],
    ['uc', `${MODULE}.student`, 'complete-student'],
    ['er', `${MODULE}.student`, 'react-student'],
    ['job', `${MODULE}.student`, 'sweep-students'],
    ['dcs', MODULE, 'progress'],
    ['dqs', MODULE, 'navigation'],
  ];
  for (const step of steps) {
    const lines: string[] = [];
    const code = runGen([...step, '--write'], (l) => lines.push(l));
    if (code !== 0)
      throw new Error(`gen ${step.join(' ')}: ${lines.join('\n')}`);
  }
});
afterAll(cleanup);

test('biome чист', async () => {
  const res = await sh([
    'bunx',
    'biome',
    'check',
    `packages/domain/src/${MODULE}`,
    `packages/${MODULE}`,
  ]);
  expect(res.text).toContain('No fixes');
  expect(res.code).toBe(0);
}, 60_000);

test('tsc чист', async () => {
  const res = await sh(['bunx', 'tsc', '--noEmit']);
  expect(res.text).toBe('');
  expect(res.code).toBe(0);
}, 300_000);

test('тесты заготовок зелёные', async () => {
  const res = await sh([
    'bun',
    'test',
    `packages/domain/src/${MODULE}`,
    `packages/${MODULE}`,
  ]);
  expect(res.text).toContain(' 0 fail');
  expect(res.code).toBe(0);
}, 120_000);

test('arch:check без нарушений', async () => {
  const domain = await import(`@u7-scl/domain/${MODULE}`);
  const app: ArchApp = {
    name: MODULE,
    modules: [domain.GenprobeModuleDef],
    layout: (m) => ({
      domain: join(REPO, 'packages/domain/src', m),
      app: join(REPO, 'packages', m, 'src'),
    }),
  };
  expect(archCheck(app).map(formatViolation)).toEqual([]);
});
