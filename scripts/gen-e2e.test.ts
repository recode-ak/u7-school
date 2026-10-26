/**
 * Приёмка генераторов на раскладке проекта (`dmg-core.json`, `gen`): срез
 * module → aggregate → uc → er → job → dcs → dqs создаётся командой
 * `bun run gen` в настоящих каталогах репозитория (иначе не разрешаются
 * `@u7-scl/domain` и `dmg-core`) и проходит biome, tsc, bun test и
 * arch:check без ручных правок. Каталоги среза удаляются в конце.
 *
 * Сами генераторы и их тесты — в пакете (`dmg-core/src/gen`); здесь — только
 * проверка, что настройки проекта дают рабочий код.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { type ArchApp, archCheck, formatViolation } from 'dmg-core/arch';
import { DomainArch } from './domain-arch';

const REPO = join(import.meta.dir, '..');
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

beforeAll(async () => {
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
    const res = await sh(['bun', 'run', 'gen', ...step, '--write']);
    if (res.code !== 0) throw new Error(`gen ${step.join(' ')}: ${res.text}`);
  }
}, 60_000);
afterAll(cleanup);

test('biome чист', async () => {
  const res = await sh([
    'bunx',
    'biome',
    'check',
    `packages/domain/src/${MODULE}`,
    `packages/${MODULE}`,
  ]);
  expect(res).toMatchObject({
    code: 0,
    text: expect.stringContaining('No fixes'),
  });
}, 60_000);

test('tsc чист', async () => {
  const res = await sh(['bunx', 'tsc', '--noEmit']);
  expect(res).toEqual({ code: 0, text: '' });
}, 300_000);

test('тесты заготовок зелёные', async () => {
  const res = await sh([
    'bun',
    'test',
    `packages/domain/src/${MODULE}`,
    `packages/${MODULE}`,
  ]);
  expect(res).toMatchObject({
    code: 0,
    text: expect.stringContaining(' 0 fail'),
  });
}, 120_000);

test('arch:check без нарушений (раскладка приложения домена)', async () => {
  const domain = await import(`@u7-scl/domain/${MODULE}`);
  const app: ArchApp = {
    ...DomainArch,
    name: MODULE,
    modules: [domain.GenprobeModuleDef],
    entry: 'index',
  };
  expect(archCheck(app).map(formatViolation)).toEqual([]);
});
