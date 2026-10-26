/**
 * Приёмка генераторов: срез module → aggregate → uc → er → job → dcs → dqs
 * создаётся во временном проекте с раскладкой по умолчанию и проходит
 * biome, tsc, bun test и archCheck без ручных правок. Проект лежит внутри
 * пакета (иначе не разрешаются `dmg-core` и `valibot`) и удаляется в конце.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type ArchApp, archCheck, formatViolation } from '../arch';
import { GenLayout } from './layout';
import { runGen } from './main';

const PKG = join(import.meta.dir, '../..');
const MODULE = 'genprobe';
let project: string;

async function sh(cmd: string[]): Promise<{ code: number; text: string }> {
  const proc = Bun.spawn(cmd, { cwd: PKG, stdout: 'pipe', stderr: 'pipe' });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code: await proc.exited, text: out + err };
}

beforeAll(() => {
  // Без точки в начале имени: tsc не видит скрытые каталоги.
  project = mkdtempSync(join(PKG, 'tmp-gen-e2e-'));
  writeFileSync(
    join(project, 'tsconfig.json'),
    JSON.stringify({ extends: '../tsconfig.json', include: ['.'] }),
  );
  const layout = new GenLayout(GenLayout.defaults, project);
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
    const code = runGen([...step, '--write'], layout, (l) => lines.push(l));
    if (code !== 0) {
      throw new Error(`gen ${step.join(' ')}: ${lines.join('\n')}`);
    }
  }
});
afterAll(() => rmSync(project, { recursive: true, force: true }));

test('biome чист', async () => {
  // Код и вывод вместе: при падении видно, что именно нашёл biome.
  const res = await sh(['bunx', 'biome', 'check', join(project, 'src')]);
  expect(res).toMatchObject({
    code: 0,
    text: expect.stringContaining('No fixes'),
  });
}, 60_000);

test('tsc чист', async () => {
  const res = await sh(['bunx', 'tsc', '--noEmit', '-p', project]);
  expect(res.text).toBe('');
  expect(res.code).toBe(0);
}, 120_000);

test('тесты заготовок зелёные', async () => {
  const res = await sh(['bun', 'test', project]);
  expect(res.text).toContain(' 0 fail');
  expect(res.code).toBe(0);
}, 120_000);

test('archCheck без нарушений', async () => {
  const layout = new GenLayout(GenLayout.defaults, project);
  const domain = await import(layout.domainDir(MODULE));
  const app: ArchApp = {
    name: MODULE,
    modules: [domain.GenprobeModuleDef],
    layout: (m) => ({ domain: layout.domainDir(m), app: layout.appDir(m) }),
  };
  expect(archCheck(app).map(formatViolation)).toEqual([]);
});
