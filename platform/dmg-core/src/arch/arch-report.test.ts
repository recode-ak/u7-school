import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModuleDef } from '../domain/contracts/module-def';
import { ExampleArch } from '../testing/example/example.arch';
import type { ArchApp } from './arch-checker';
import { RULES_DOC, reportArchCheck } from './arch-report';

function run(apps: readonly ArchApp[], options?: { strict?: boolean }) {
  const lines: string[] = [];
  const code = reportArchCheck(apps, (line) => lines.push(line), options);
  return { code, lines };
}

/** Каталог модуля-заготовки: только файлы модуля в домене и пакете. */
let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'arch-report-'));
  for (const dir of ['domain', 'app']) {
    mkdirSync(join(root, dir));
    writeFileSync(join(root, dir, 'draft.module.ts'), '');
  }
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** Модуль-заготовка без нарушений: label и description не заполнены. */
const draft: ArchApp = {
  name: 'draft',
  modules: [
    ModuleDef.define({
      name: 'draft',
      label: 'TODO: название модуля',
      description: 'TODO: что делает модуль',
      dependsOn: [],
      aggregates: [],
      useCases: [],
      reactions: [],
      jobs: [],
    }),
  ],
  layout: () => ({ domain: join(root, 'domain'), app: join(root, 'app') }),
};

describe('reportArchCheck', () => {
  it('без нарушений — код 0, итог без ссылки на правила', () => {
    expect(run([ExampleArch])).toEqual({
      code: 0,
      lines: ['arch:check example: нарушений — 0', 'arch:check: нарушений нет'],
    });
  });

  it('пустой список приложений не падает', () => {
    expect(run([])).toEqual({ code: 0, lines: ['arch:check: нарушений нет'] });
  });

  it('нарушения — строки с ID правила, путь к rules.md пакета и код 1', () => {
    const broken = ModuleDef.define({
      name: 'broken',
      label: '',
      description: 'Модуль без названия и без файлов.',
      dependsOn: [],
      aggregates: [],
      useCases: [],
      reactions: [],
      jobs: [],
    });
    const { code, lines } = run([
      {
        name: 'broken',
        modules: [broken],
        layout: () => ({ domain: '/нет/домена', app: '/нет/пакета' }),
      },
    ]);
    expect(code).toBe(1);
    expect(lines).toEqual([
      'arch:check broken: нарушений — 3',
      'MAN-01: модуль broken: пустой label',
      'ARC-06: модуль broken: нет /нет/домена/broken.module.ts',
      'ARC-06: модуль broken: нет /нет/пакета/broken.module.ts',
      'arch:check: нарушений — 3',
      `Правила по ID: ${RULES_DOC}`,
    ]);
  });

  it('незаполненные TODO — предупреждения: список и код 0', () => {
    expect(run([draft])).toEqual({
      code: 0,
      lines: [
        'arch:check draft: нарушений — 0',
        'arch:check draft: незаполненных TODO — 2 (предупреждение)',
        'MAN-01 (предупреждение): модуль draft: label не заполнен — «TODO: название модуля»',
        'MAN-01 (предупреждение): модуль draft: description не заполнен — «TODO: что делает модуль»',
        'arch:check: незаполненных TODO — 2; строгий режим (--strict) считает их нарушениями',
        'arch:check: нарушений нет',
      ],
    });
  });

  it('strict — незаполненные TODO считаются нарушениями, код 1', () => {
    expect(run([draft], { strict: true })).toEqual({
      code: 1,
      lines: [
        'arch:check draft: нарушений — 2',
        'MAN-01: модуль draft: label не заполнен — «TODO: название модуля»',
        'MAN-01: модуль draft: description не заполнен — «TODO: что делает модуль»',
        'arch:check: нарушений — 2',
        `Правила по ID: ${RULES_DOC}`,
      ],
    });
  });

  it('RULES_DOC — путь к rules.md установленного пакета', async () => {
    expect(RULES_DOC).toBe('node_modules/dmg-core/docs/rules.md');
    const text = await Bun.file(
      `${import.meta.dir}/../../docs/rules.md`,
    ).text();
    for (const id of ['MAN-01', 'ARC-06']) expect(text).toContain(`| ${id} |`);
  });
});
