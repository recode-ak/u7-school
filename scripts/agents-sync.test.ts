import { describe, expect, test } from 'bun:test';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Marker } from 'dmg-core/cli';
import { TempDir } from 'dmg-core/testing';
import {
  buildCopies,
  COMMON_FILE,
  compareCopies,
  DMG_COMMON_FILE,
  runSync,
} from './agents-sync';

const SRC = '.agents-core/roles/dmg-reviewer.md';

function source(frontmatter: string, body = 'Промпт роли.'): string {
  return `---\n${frontmatter}\n---\n\n${body}\n`;
}

const REVIEWER = source(
  [
    'name: dmg-reviewer',
    'description: Проверка по rules.md',
    'tools: [read, grep, find, bash]',
    'model:',
    '  claude: sonnet',
    '  pi: claude-sonnet-4-5',
  ].join('\n'),
);

// Разбор формата роли — `Role.parse` пакета (`dmg-core/src/cli/role.test.ts`).
describe('buildCopies', () => {
  const copies = buildCopies([{ path: SRC, text: REVIEWER }], '## Общее');

  test('каждая роль даёт копию для обеих сред', () => {
    expect([...copies.keys()].sort()).toEqual([
      '.claude/agents/dmg-reviewer.md',
      '.pi/agents/dmg-reviewer.md',
    ]);
  });

  test('Claude Code: инструменты в его именах, модель claude, метка проекта, общий блок', () => {
    expect(copies.get('.claude/agents/dmg-reviewer.md')).toBe(
      [
        '---',
        'name: dmg-reviewer',
        'description: "Проверка по rules.md"',
        'tools: Read, Grep, Glob, Bash',
        'model: sonnet',
        '---',
        '',
        '<!-- Сгенерировано из .agents-core/roles/dmg-reviewer.md командой `bun run agents:sync` — не править. -->',
        '',
        'Промпт роли.',
        '',
        '## Общее',
        '',
      ].join('\n'),
    );
  });

  test('pi: инструменты как есть, модель pi', () => {
    const text = copies.get('.pi/agents/dmg-reviewer.md');
    expect(text).toContain('tools: read, grep, find, bash\n');
    expect(text).toContain('model: claude-sonnet-4-5\n');
  });

  test('ошибка разбора — с путём источника', () => {
    expect(() => buildCopies([{ path: SRC, text: 'просто текст' }])).toThrow(
      `${SRC}: нет frontmatter`,
    );
  });

  test('одноимённая роль в двух источниках — ошибка', () => {
    expect(() =>
      buildCopies([
        { path: SRC, text: REVIEWER },
        { path: SRC, text: REVIEWER },
      ]),
    ).toThrow(`${SRC}: роль dmg-reviewer уже задана в ${SRC}`);
  });
});

describe('compareCopies', () => {
  const expected = new Map([
    ['.claude/agents/a.md', 'A'],
    ['.claude/agents/b.md', 'B'],
  ]);

  test('совпадение — расхождений нет', () => {
    expect(compareCopies(expected, new Map(expected))).toEqual({
      changed: [],
      missing: [],
      extra: [],
    });
  });

  test('находит изменённый, недостающий и лишний файл', () => {
    const actual = new Map([
      ['.claude/agents/a.md', 'A правка'],
      ['.claude/agents/old.md', 'X'],
    ]);
    expect(compareCopies(expected, actual)).toEqual({
      changed: ['.claude/agents/a.md'],
      missing: ['.claude/agents/b.md'],
      extra: ['.claude/agents/old.md'],
    });
  });
});

describe('runSync', () => {
  async function withRepo(fn: (root: string) => Promise<void>): Promise<void> {
    using tmp = TempDir.create('agents-sync-');
    const root = tmp.path;
    await Bun.write(join(root, SRC), REVIEWER);
    await fn(root);
  }

  test('sync пишет копии, после него check зелёный', async () => {
    await withRepo(async (root) => {
      expect((await runSync(root, 'check')).ok).toBe(false);
      expect((await runSync(root, 'sync')).ok).toBe(true);
      const claude = await readFile(
        join(root, '.claude/agents/dmg-reviewer.md'),
        'utf8',
      );
      expect(claude).toContain('tools: Read, Grep, Glob, Bash');
      expect(await runSync(root, 'check')).toEqual({ ok: true, messages: [] });
    });
  });

  test('check сообщает о ручной правке копии', async () => {
    await withRepo(async (root) => {
      await runSync(root, 'sync');
      await writeFile(join(root, '.pi/agents/dmg-reviewer.md'), 'правка');
      const result = await runSync(root, 'check');
      expect(result.ok).toBe(false);
      expect(result.messages).toContain(
        'расходится с источником: .pi/agents/dmg-reviewer.md',
      );
    });
  });

  test('sync удаляет сгенерированную копию без источника, ручной файл не трогает', async () => {
    await withRepo(async (root) => {
      await runSync(root, 'sync');
      await rm(join(root, SRC));
      await writeFile(join(root, '.claude/agents/manual.md'), 'свой агент');
      const result = await runSync(root, 'sync');
      expect(
        await Bun.file(join(root, '.claude/agents/dmg-reviewer.md')).exists(),
      ).toBe(false);
      expect(
        await Bun.file(join(root, '.claude/agents/manual.md')).exists(),
      ).toBe(true);
      expect(result.ok).toBe(false);
      expect(result.messages).toContain(
        'лишний файл (не сгенерирован, удали или перенеси в .agents-core/roles): .claude/agents/manual.md',
      );
    });
  });

  test('общий блок попадает во все копии, его правка ломает check', async () => {
    await withRepo(async (root) => {
      await Bun.write(join(root, COMMON_FILE), 'Общее правило.\n');
      await runSync(root, 'sync');
      const pi = await readFile(
        join(root, '.pi/agents/dmg-reviewer.md'),
        'utf8',
      );
      expect(pi).toContain('Общее правило.');
      await writeFile(join(root, COMMON_FILE), 'Другое правило.\n');
      expect((await runSync(root, 'check')).ok).toBe(false);
    });
  });

  test('роль и общий блок от dmg-core sync: метка снимается, общий блок пакета — перед проектным', async () => {
    await withRepo(async (root) => {
      const marker = new Marker('1.0.0');
      await Bun.write(
        join(root, '.agents-core/roles/dmg-api-author.md'),
        marker.mark(
          source('name: dmg-api-author\ndescription: d\ntools: [read]'),
        ),
      );
      await Bun.write(
        join(root, DMG_COMMON_FILE),
        marker.mark('Правило пакета.\n'),
      );
      await Bun.write(join(root, COMMON_FILE), 'Правило проекта.\n');
      expect(await runSync(root, 'sync')).toEqual({ ok: true, messages: [] });
      const claude = await readFile(
        join(root, '.claude/agents/dmg-api-author.md'),
        'utf8',
      );
      expect(claude).toContain(
        'Сгенерировано из .agents-core/roles/dmg-api-author.md',
      );
      expect(claude).not.toContain('dmg-core@');
      expect(claude.indexOf('Правило пакета.')).toBeGreaterThan(0);
      expect(claude.indexOf('Правило проекта.')).toBeGreaterThan(
        claude.indexOf('Правило пакета.'),
      );
    });
  });

  test('ошибка разбора источника — не ok, сообщение с файлом', async () => {
    await withRepo(async (root) => {
      await writeFile(
        join(root, SRC),
        source('name: dmg-reviewer\ndescription: d\ntools: [ls]'),
      );
      const result = await runSync(root, 'sync');
      expect(result).toEqual({
        ok: false,
        messages: [`${SRC}: неизвестный инструмент «ls»`],
      });
    });
  });
});
