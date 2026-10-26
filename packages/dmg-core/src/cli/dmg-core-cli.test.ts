import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DmgCoreCli } from './dmg-core-cli';
import { Marker } from './marker';
import { PackageSource } from './package-source';

function role(name: string): string {
  return `---\nname: ${name}\ndescription: Роль ${name}\ntools: [read, bash]\n---\n\nПромпт ${name}.\n`;
}

const PACKAGE_FILES: Record<string, string> = {
  'package.json': JSON.stringify({ name: 'dmg-core', version: '1.0.0' }),
  'skills/demo/SKILL.md': '---\nname: demo\ndescription: d\n---\n\nСкил.\n',
  'skills/demo/ref/notes.md': 'Заметки.\n',
  'agents/roles/alpha.md': role('alpha'),
  'agents/roles/beta.md': role('beta'),
  'agents/common.md': 'Общий блок пакета.\n',
};

let work: string;
let pkgRoot: string;
let root: string;

async function put(base: string, files: Record<string, string>) {
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(base, path)), { recursive: true });
    await writeFile(join(base, path), text);
  }
}

const read = (path: string) => readFile(join(root, path), 'utf8');
const write = (path: string, text: string) => put(root, { [path]: text });

async function cli(version = '1.0.0'): Promise<DmgCoreCli> {
  await put(pkgRoot, {
    'package.json': JSON.stringify({ name: 'dmg-core', version }),
  });
  return new DmgCoreCli(await PackageSource.load(pkgRoot));
}

async function snapshot(): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  for await (const path of new Bun.Glob('**/*').scan({
    cwd: root,
    dot: true,
  })) {
    files.set(path, await read(path));
  }
  return files;
}

beforeEach(async () => {
  work = await mkdtemp(join(tmpdir(), 'dmg-core-cli-'));
  pkgRoot = join(work, 'pkg');
  root = join(work, 'project');
  await put(pkgRoot, PACKAGE_FILES);
  await mkdir(root);
});

afterEach(() => rm(work, { recursive: true, force: true }));

describe('PackageSource', () => {
  test('читает версию, скилы, роли и общий блок пакета', async () => {
    const pkg = await PackageSource.load(pkgRoot);
    expect(pkg.version).toBe('1.0.0');
    expect([...pkg.skills.keys()]).toEqual(['demo']);
    expect([...(pkg.skills.get('demo')?.keys() ?? [])].sort()).toEqual([
      'SKILL.md',
      'ref/notes.md',
    ]);
    expect(pkg.roles.map((r) => r.name)).toEqual(['alpha', 'beta']);
    expect(pkg.common).toBe('Общий блок пакета.\n');
  });

  test('настоящий пакет: роли платформы и скил dmg-architecture', async () => {
    const pkg = await PackageSource.load(join(import.meta.dir, '../..'));
    expect(pkg.roles.map((r) => r.name).sort()).toEqual([
      'api-author',
      'domain-author',
      'reviewer',
    ]);
    expect([...pkg.skills.keys()]).toEqual(['dmg-architecture']);
  });
});

describe('init', () => {
  test('пустой проект: конфиг по умолчанию, копии для Claude Code, вставка', async () => {
    const result = await (await cli()).init(root);
    expect(result).toEqual({ ok: true, messages: [] });

    expect(JSON.parse(await read('dmg-core.json'))).toEqual({
      skills: { names: ['demo'], dirs: ['.claude/skills'] },
      roles: {
        names: ['alpha', 'beta'],
        targets: [{ dir: '.claude/agents', format: 'claude' }],
      },
      instructions: 'AGENTS.md',
    });
    const skill = await read('.claude/skills/demo/SKILL.md');
    expect(Marker.versionOf(skill)).toBe('1.0.0');
    expect(Marker.strip(await read('.claude/skills/demo/ref/notes.md'))).toBe(
      'Заметки.\n',
    );
    const alpha = await read('.claude/agents/alpha.md');
    expect(alpha).toContain('tools: Read, Bash\n');
    expect(alpha).toEndWith('Общий блок пакета.\n');
    expect(await read('AGENTS.md')).toContain('node_modules/dmg-core/llms.txt');
    expect(await (await cli()).check(root)).toEqual({ ok: true, messages: [] });
  });

  test('идемпотентен и не трогает существующий конфиг и текст инструкций', async () => {
    await write('AGENTS.md', '# Правила проекта\n');
    await write(
      'dmg-core.json',
      JSON.stringify({ roles: { names: ['beta'] }, instructions: 'AGENTS.md' }),
    );
    await (await cli()).init(root);
    const first = await snapshot();
    expect(await (await cli()).init(root)).toEqual({ ok: true, messages: [] });
    expect(await snapshot()).toEqual(first);

    expect(first.has('.claude/agents/alpha.md')).toBe(false);
    expect(first.get('AGENTS.md')).toStartWith('# Правила проекта\n\n');
    expect(JSON.parse(first.get('dmg-core.json') ?? '')).toEqual({
      roles: { names: ['beta'] },
      instructions: 'AGENTS.md',
    });
  });
});

describe('sync и check', () => {
  test('без dmg-core.json — не ok, подсказка про init', async () => {
    const result = await (await cli()).check(root);
    expect(result.ok).toBe(false);
    expect(result.messages).toEqual([
      'нет dmg-core.json — запусти dmg-core init',
    ]);
  });

  test('check: нет копии, правка руками, вставки нет', async () => {
    await (await cli()).init(root);
    await rm(join(root, '.claude/agents/beta.md'));
    await write(
      '.claude/agents/alpha.md',
      `${await read('.claude/agents/alpha.md')}+`,
    );
    await write('AGENTS.md', '# Пусто\n');

    const result = await (await cli()).check(root);
    expect(result.ok).toBe(false);
    expect(result.messages).toEqual([
      'расходится с пакетом (правлена руками?): .claude/agents/alpha.md',
      'нет копии: .claude/agents/beta.md',
      'нет вставки dmg-core или она устарела: AGENTS.md',
    ]);
  });

  test('новая версия пакета: check сообщает об устаревших копиях, sync обновляет', async () => {
    await (await cli()).init(root);
    const next = await cli('1.1.0');
    const result = await next.check(root);
    expect(result.ok).toBe(false);
    expect(result.messages).toContain(
      'устарела (1.0.0 → 1.1.0): .claude/agents/alpha.md',
    );
    expect(result.messages).toContain(
      'нет вставки dmg-core или она устарела: AGENTS.md',
    );
    expect(await next.sync(root)).toEqual({ ok: true, messages: [] });
    expect(await next.check(root)).toEqual({ ok: true, messages: [] });
  });

  test('sync удаляет свою копию, исключённую из конфига; чужие файлы не трогает', async () => {
    await (await cli()).init(root);
    await write('.claude/agents/own.md', 'Своя роль проекта.\n');
    await write(
      'dmg-core.json',
      JSON.stringify({ skills: { names: [] }, roles: { names: ['beta'] } }),
    );

    const check = await (await cli()).check(root);
    expect(check.messages).toEqual([
      'копия без источника: .claude/agents/alpha.md',
      'копия без источника: .claude/skills/demo',
    ]);
    expect(await (await cli()).sync(root)).toEqual({ ok: true, messages: [] });
    const files = await snapshot();
    expect(files.has('.claude/agents/alpha.md')).toBe(false);
    expect(files.has('.claude/skills/demo/SKILL.md')).toBe(false);
    expect(files.get('.claude/agents/own.md')).toBe('Своя роль проекта.\n');
  });

  test('ручной файл на месте копии — не перезаписывается, не ok', async () => {
    await write('.claude/agents/alpha.md', 'Ручная alpha.\n');
    const result = await (await cli()).init(root);
    expect(result.ok).toBe(false);
    expect(result.messages).toEqual([
      'файл не от dmg-core (удали его или исключи роль/скил в dmg-core.json): .claude/agents/alpha.md',
    ]);
    expect(await read('.claude/agents/alpha.md')).toBe('Ручная alpha.\n');
    expect(Marker.versionOf(await read('.claude/agents/beta.md'))).toBe(
      '1.0.0',
    );
  });

  test('цель neutral: исходник роли с меткой и общий блок отдельным файлом', async () => {
    await write(
      'dmg-core.json',
      JSON.stringify({
        skills: { dirs: ['.pi/skills'] },
        roles: {
          targets: [
            { dir: 'roles', format: 'neutral', common: 'dmg-core-common.md' },
            { dir: '.pi/agents', format: 'pi' },
          ],
        },
        instructions: null,
      }),
    );
    expect(await (await cli()).sync(root)).toEqual({ ok: true, messages: [] });
    expect(Marker.strip(await read('roles/alpha.md'))).toBe(role('alpha'));
    expect(Marker.strip(await read('dmg-core-common.md'))).toBe(
      'Общий блок пакета.\n',
    );
    expect(await read('.pi/agents/alpha.md')).toContain('tools: read, bash\n');
    expect((await snapshot()).has('AGENTS.md')).toBe(false);
  });

  test.each([
    [
      { roles: { names: ['gamma'] } },
      'dmg-core.json: нет роли «gamma» в пакете',
    ],
    [{ skills: { names: ['x'] } }, 'dmg-core.json: нет скила «x» в пакете'],
    [
      { roles: { targets: [{ dir: 'r', format: 'vim' }] } },
      'dmg-core.json: roles.targets[0].format — neutral, claude или pi',
    ],
    [
      { roles: { targets: [{ dir: 'r', format: 'neutral' }] } },
      'dmg-core.json: roles.targets[0].common — путь общего блока для neutral',
    ],
    [{ extra: 1 }, 'dmg-core.json: неизвестное поле «extra»'],
  ])(
    'ошибка конфига — не ok, сообщение с полем: %#',
    async (config, message) => {
      await write('dmg-core.json', JSON.stringify(config));
      expect(await (await cli()).sync(root)).toEqual({
        ok: false,
        messages: [message],
      });
    },
  );
});
