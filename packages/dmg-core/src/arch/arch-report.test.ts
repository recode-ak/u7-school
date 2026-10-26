import { describe, expect, it } from 'bun:test';
import { defineModule } from '../domain/contracts/define-module';
import { ExampleArch } from '../testing/example/example.arch';
import type { ArchApp } from './arch-check';
import { RULES_DOC, reportArchCheck } from './arch-report';

function run(apps: readonly ArchApp[]) {
  const lines: string[] = [];
  const code = reportArchCheck(apps, (line) => lines.push(line));
  return { code, lines };
}

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
    const broken = defineModule({
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

  it('RULES_DOC — путь к rules.md установленного пакета', async () => {
    expect(RULES_DOC).toBe('node_modules/dmg-core/docs/rules.md');
    const text = await Bun.file(
      `${import.meta.dir}/../../docs/rules.md`,
    ).text();
    for (const id of ['MAN-01', 'ARC-06']) expect(text).toContain(`| ${id} |`);
  });
});
