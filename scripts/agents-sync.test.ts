import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildCopies,
  COMMON_FILE,
  compareCopies,
  parseRole,
  renderRole,
  runSync,
} from './agents-sync';

const SRC = '.agents-core/roles/reviewer.md';

function source(frontmatter: string, body = 'Промпт роли.'): string {
  return `---\n${frontmatter}\n---\n\n${body}\n`;
}

const REVIEWER = source(
  [
    'name: reviewer',
    'description: Проверка по rules.md',
    'tools: [read, grep, find, bash]',
    'model:',
    '  claude: sonnet',
    '  pi: claude-sonnet-4-5',
  ].join('\n'),
);

describe('parseRole', () => {
  test('разбирает frontmatter и тело', () => {
    expect(parseRole(SRC, REVIEWER)).toEqual({
      source: SRC,
      name: 'reviewer',
      description: 'Проверка по rules.md',
      tools: ['read', 'grep', 'find', 'bash'],
      model: { claude: 'sonnet', pi: 'claude-sonnet-4-5' },
      body: 'Промпт роли.',
    });
  });

  test('model необязателен', () => {
    const role = parseRole(
      SRC,
      source('name: reviewer\ndescription: d\ntools: [read]'),
    );
    expect(role.model).toEqual({});
  });

  test('неизвестный инструмент — ошибка с именем файла и инструмента', () => {
    const text = source('name: reviewer\ndescription: d\ntools: [read, ls]');
    expect(() => parseRole(SRC, text)).toThrow(
      `${SRC}: неизвестный инструмент «ls»`,
    );
  });

  test('нет frontmatter — ошибка', () => {
    expect(() => parseRole(SRC, 'просто текст')).toThrow(
      `${SRC}: нет frontmatter`,
    );
  });

  test('name не совпадает с именем файла — ошибка', () => {
    const text = source('name: other\ndescription: d\ntools: [read]');
    expect(() => parseRole(SRC, text)).toThrow(
      `${SRC}: name «other» не совпадает с именем файла`,
    );
  });

  test('нет description или tools — ошибка', () => {
    expect(() =>
      parseRole(SRC, source('name: reviewer\ntools: [read]')),
    ).toThrow(`${SRC}: нужен description`);
    expect(() =>
      parseRole(SRC, source('name: reviewer\ndescription: d')),
    ).toThrow(`${SRC}: нужен непустой список tools`);
  });

  test('неизвестное поле или среда модели — ошибка', () => {
    expect(() =>
      parseRole(
        SRC,
        source('name: reviewer\ndescription: d\ntools: [read]\ncolor: red'),
      ),
    ).toThrow(`${SRC}: неизвестное поле «color»`);
    expect(() =>
      parseRole(
        SRC,
        source(
          'name: reviewer\ndescription: d\ntools: [read]\nmodel:\n  gpt: x',
        ),
      ),
    ).toThrow(`${SRC}: неизвестная среда модели «gpt»`);
  });
});

describe('renderRole', () => {
  const role = parseRole(SRC, REVIEWER);

  test('Claude Code: инструменты в его именах, модель claude', () => {
    expect(renderRole('claude', role)).toBe(
      [
        '---',
        'name: reviewer',
        'description: "Проверка по rules.md"',
        'tools: Read, Grep, Glob, Bash',
        'model: sonnet',
        '---',
        '',
        '<!-- Сгенерировано из .agents-core/roles/reviewer.md командой `bun run agents:sync` — не править. -->',
        '',
        'Промпт роли.',
        '',
      ].join('\n'),
    );
  });

  test('pi: инструменты как есть, модель pi', () => {
    const text = renderRole('pi', role);
    expect(text).toContain('tools: read, grep, find, bash\n');
    expect(text).toContain('model: claude-sonnet-4-5\n');
  });

  test('без модели для среды поле model не пишется', () => {
    const noModel = { ...role, model: { pi: 'x' } };
    expect(renderRole('claude', noModel)).not.toContain('model:');
  });

  test('общий блок дописывается после тела роли', () => {
    const text = renderRole('pi', role, '## Общее\n\nТекст.\n');
    expect(text.endsWith('Промпт роли.\n\n## Общее\n\nТекст.\n')).toBe(true);
  });

  test('description экранируется и разбирается обратно', () => {
    const tricky = { ...role, description: 'a: "b" # c' };
    const text = renderRole('claude', tricky);
    const fm = Bun.YAML.parse(text.split('---')[1] ?? '') as {
      description: string;
    };
    expect(fm.description).toBe('a: "b" # c');
  });
});

describe('buildCopies', () => {
  test('каждая роль даёт копию для обеих сред', () => {
    const copies = buildCopies([{ path: SRC, text: REVIEWER }]);
    expect([...copies.keys()].sort()).toEqual([
      '.claude/agents/reviewer.md',
      '.pi/agents/reviewer.md',
    ]);
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
    const root = await mkdtemp(join(tmpdir(), 'agents-sync-'));
    try {
      await Bun.write(join(root, SRC), REVIEWER);
      await fn(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  test('sync пишет копии, после него check зелёный', async () => {
    await withRepo(async (root) => {
      expect((await runSync(root, 'check')).ok).toBe(false);
      expect((await runSync(root, 'sync')).ok).toBe(true);
      const claude = await readFile(
        join(root, '.claude/agents/reviewer.md'),
        'utf8',
      );
      expect(claude).toContain('tools: Read, Grep, Glob, Bash');
      expect(await runSync(root, 'check')).toEqual({ ok: true, messages: [] });
    });
  });

  test('check сообщает о ручной правке копии', async () => {
    await withRepo(async (root) => {
      await runSync(root, 'sync');
      await writeFile(join(root, '.pi/agents/reviewer.md'), 'правка');
      const result = await runSync(root, 'check');
      expect(result.ok).toBe(false);
      expect(result.messages).toContain(
        'расходится с источником: .pi/agents/reviewer.md',
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
        await Bun.file(join(root, '.claude/agents/reviewer.md')).exists(),
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
      const pi = await readFile(join(root, '.pi/agents/reviewer.md'), 'utf8');
      expect(pi).toContain('Общее правило.');
      await writeFile(join(root, COMMON_FILE), 'Другое правило.\n');
      expect((await runSync(root, 'check')).ok).toBe(false);
    });
  });

  test('ошибка разбора источника — не ok, сообщение с файлом', async () => {
    await withRepo(async (root) => {
      await writeFile(
        join(root, SRC),
        source('name: reviewer\ndescription: d\ntools: [ls]'),
      );
      const result = await runSync(root, 'sync');
      expect(result).toEqual({
        ok: false,
        messages: [`${SRC}: неизвестный инструмент «ls»`],
      });
    });
  });
});
