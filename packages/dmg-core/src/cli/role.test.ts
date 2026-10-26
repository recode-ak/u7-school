import { describe, expect, test } from 'bun:test';
import { Marker } from './marker';
import { Role } from './role';

const SRC = 'agents/roles/reviewer.md';
const marker = new Marker('1.2.3');

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

describe('Role.parse', () => {
  test('разбирает frontmatter и тело', () => {
    const role = Role.parse(SRC, REVIEWER);
    expect(role.name).toBe('reviewer');
    expect(role.description).toBe('Проверка по rules.md');
    expect(role.tools).toEqual(['read', 'grep', 'find', 'bash']);
    expect(role.model).toEqual({ claude: 'sonnet', pi: 'claude-sonnet-4-5' });
    expect(role.body).toBe('Промпт роли.');
  });

  test('model необязателен', () => {
    const role = Role.parse(
      SRC,
      source('name: reviewer\ndescription: d\ntools: [read]'),
    );
    expect(role.model).toEqual({});
  });

  test.each([
    ['Текст без frontmatter', 'нет frontmatter'],
    [source('name: other\ndescription: d\ntools: [read]'), 'name «other»'],
    [source('name: reviewer\ntools: [read]'), 'нужен description'],
    [source('name: reviewer\ndescription: d'), 'нужен непустой список tools'],
    [
      source('name: reviewer\ndescription: d\ntools: [read, ls]'),
      'неизвестный инструмент «ls»',
    ],
    [
      source('name: reviewer\ndescription: d\ntools: [read]\nextra: 1'),
      'неизвестное поле «extra»',
    ],
    [
      source('name: reviewer\ndescription: d\ntools: [read]\nmodel:\n  vim: x'),
      'неизвестная среда модели «vim»',
    ],
  ])('нарушение формата — ошибка с путём: %#', (text, message) => {
    expect(() => Role.parse(SRC, text)).toThrow(`${SRC}: ${message}`);
  });
});

describe('Role.render', () => {
  const role = Role.parse(SRC, REVIEWER);

  test('neutral — исходный текст с меткой', () => {
    expect(role.render('neutral', marker)).toBe(marker.mark(REVIEWER));
  });

  test('claude — инструменты и модель Claude Code, общий блок в конце', () => {
    const text = role.render('claude', marker, 'Общий блок.');
    expect(text).toBe(
      [
        '---',
        'name: reviewer',
        'description: "Проверка по rules.md"',
        'tools: Read, Grep, Glob, Bash',
        'model: sonnet',
        '---',
        '',
        marker.comment,
        '',
        'Промпт роли.',
        '',
        'Общий блок.',
        '',
      ].join('\n'),
    );
  });

  test('pi — инструменты как есть, модель pi', () => {
    const text = role.render('pi', marker);
    expect(text).toContain('tools: read, grep, find, bash\n');
    expect(text).toContain('model: claude-sonnet-4-5\n');
  });

  test('без модели для среды поле model не пишется', () => {
    const plain = Role.parse(
      SRC,
      source('name: reviewer\ndescription: d\ntools: [read]'),
    );
    expect(plain.render('claude', marker)).not.toContain('model:');
  });
});
