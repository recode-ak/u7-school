import { describe, expect, it } from 'bun:test';
import { defineModule } from 'dmg-core';
import { ARCH_APPS, runArchCheck, runDomainCheck } from './arch-check';
import { DOMAIN_MODULES } from './domain-arch';
import { domainGraphOf } from './domain-check';

function run(apps: Parameters<typeof runArchCheck>[0]) {
  const lines: string[] = [];
  const code = runArchCheck(apps, (line) => lines.push(line));
  return { code, lines };
}

describe('arch:check', () => {
  it('зарегистрированные приложения — без нарушений', () => {
    const { code, lines } = run(ARCH_APPS);
    expect(code).toBe(0);
    expect(lines.at(-1)).toBe('arch:check: нарушений нет');
  });

  it('пустой список приложений не падает', () => {
    expect(run([])).toEqual({ code: 0, lines: ['arch:check: нарушений нет'] });
  });

  it('нарушения — строки с ID правила и код 1', () => {
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
    ]);
  });
});

describe('arch:check domain', () => {
  it('граф dependsOn домена — из ModuleDef, внешние peer-review и dossier', () => {
    expect(domainGraphOf(DOMAIN_MODULES)).toEqual({
      user: [],
      course: ['user'],
      questionnaire: ['user'],
      stream: ['user', 'course'],
      wish: ['user', 'course', 'questionnaire', 'stream'],
      'peer-review': ['user', 'questionnaire', 'stream'],
      dossier: [],
    });
    const external = DOMAIN_MODULES.filter((m) => m.external);
    expect(external.map((m) => m.name)).toContain('peer-review');
    expect(external.map((m) => m.name)).toContain('dossier');
  });

  it('репозиторий — без нарушений домена и долга', async () => {
    expect(await runDomainCheck()).toEqual([]);
  });
});
