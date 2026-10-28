/**
 * Приёмка генераторов: срез module → aggregate → uc (создание и операция
 * над агрегатом) → er → job → dcs → dqs создаётся во временном проекте с
 * раскладкой по умолчанию и проходит biome, tsc, bun test и ArchChecker без
 * ручных правок. Второй срез — с очень длинными именами модуля, агрегата и
 * операций: шаблоны переносят строки так же, как biome (CODE-01). Проект
 * лежит во временном каталоге ОС: внутри пакета его тесты подхватывал
 * параллельный `bun test`. `dmg-core`, `valibot` и типы разрешаются через
 * ссылки в его `node_modules`; в конце проект удаляется.
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
/** Модуль и агрегат с длинными именами — проверка переносов строк. */
const LONG = 'learning-progress-analytics';
const LONG_AGG = `${LONG}.questionnaire-response-revision`;
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
    ['uc', `${MODULE}.student`, 'create-student'],
    ['uc', `${MODULE}.student`, 'complete-student'],
    ['er', `${MODULE}.student`, 'react-student'],
    ['job', `${MODULE}.student`, 'sweep-students'],
    ['dcs', MODULE, 'progress'],
    ['dqs', MODULE, 'navigation'],
    ['module', LONG],
    ['aggregate', LONG_AGG],
    ['uc', LONG_AGG, 'create-questionnaire-response-revision'],
    ['uc', LONG_AGG, 'archive-questionnaire-response-revision'],
    ['er', LONG_AGG, 'react-to-questionnaire-response-revision'],
    ['job', LONG_AGG, 'sweep-stale-questionnaire-response-revisions'],
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

async function probeApp(): Promise<ArchApp> {
  const layout = new GenLayout(GenLayout.defaults, project);
  const domain = await import(layout.domainDir(MODULE));
  const long = await import(layout.domainDir(LONG));
  return {
    name: MODULE,
    modules: [
      domain.GenprobeModuleDef,
      long.LearningProgressAnalyticsModuleDef,
    ],
    layout: (m) => ({ domain: layout.domainDir(m), app: layout.appDir(m) }),
  };
}

test('TODO заготовок — все в предупреждениях MAN-01, без пропусков', async () => {
  const app = await probeApp();
  const todos = ArchChecker.of(app)
    .todos()
    .map((v) => v.format());
  // Каждый текст с TODO, который gen пишет в домене, — одно предупреждение.
  const field = /\b(?:label|description|denyMessage):\s*'TODO/g;
  let written = 0;
  for (const m of [MODULE, LONG]) {
    const dir = app.layout(m).domain;
    for (const f of new Bun.Glob('**/*.ts').scanSync({ cwd: dir })) {
      if (f.endsWith('.test.ts')) continue;
      const text = await Bun.file(join(dir, f)).text();
      written += text.match(field)?.length ?? 0;
    }
  }
  expect(todos).toHaveLength(written);
  for (const part of [
    'агрегат genprobe.student статус active: label',
    'политика genprobe/student/student.policy.ts:',
    ': denyMessage не заполнен',
    'UC genprobe.createStudent: label',
  ]) {
    expect(todos.some((t) => t.includes(part))).toBe(true);
  }
});

test('ArchChecker без нарушений', async () => {
  const app = await probeApp();
  expect(
    ArchChecker.of(app)
      .check()
      .map((v) => v.format()),
  ).toEqual([]);
});
