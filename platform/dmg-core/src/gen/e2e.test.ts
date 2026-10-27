/**
 * Приёмка генераторов: срез module → aggregate → uc → er → job → dcs → dqs
 * создаётся во временном проекте с раскладкой по умолчанию и проходит
 * biome, tsc, bun test и ArchChecker без ручных правок. Проект лежит во
 * временном каталоге ОС: внутри пакета его тесты подхватывал параллельный
 * `bun test`. `dmg-core`, `valibot` и типы разрешаются через ссылки в его
 * `node_modules`; в конце проект удаляется.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { type ArchApp, ArchChecker } from '../arch';
import { GenLayout } from './layout';
import { runGen } from './main';

const PKG = join(import.meta.dir, '../..');
const MODULE = 'genprobe';
let project: string;

async function sh(
  cmd: string[],
  cwd = PKG,
): Promise<{ code: number; text: string }> {
  const proc = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code: await proc.exited, text: out + err };
}

beforeAll(() => {
  project = mkdtempSync(join(tmpdir(), 'dmg-gen-e2e-'));
  const modules = join(project, 'node_modules');
  mkdirSync(modules);
  symlinkSync(PKG, join(modules, 'dmg-core'));
  mkdirSync(join(modules, '@types'));
  for (const dep of ['valibot', '@types/bun', '@types/node']) {
    const dir = dirname(Bun.resolveSync(`${dep}/package.json`, PKG));
    symlinkSync(dir, join(modules, dep));
  }
  writeFileSync(
    join(project, 'tsconfig.json'),
    JSON.stringify({ extends: join(PKG, 'tsconfig.json'), include: ['src'] }),
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
  const res = await sh(['bun', 'test'], project);
  expect(res.text).toContain(' 0 fail');
  expect(res.code).toBe(0);
}, 120_000);

test('ArchChecker без нарушений', async () => {
  const layout = new GenLayout(GenLayout.defaults, project);
  const domain = await import(layout.domainDir(MODULE));
  const app: ArchApp = {
    name: MODULE,
    modules: [domain.GenprobeModuleDef],
    layout: (m) => ({ domain: layout.domainDir(m), app: layout.appDir(m) }),
  };
  expect(
    ArchChecker.of(app)
      .check()
      .map((v) => v.format()),
  ).toEqual([]);
});
