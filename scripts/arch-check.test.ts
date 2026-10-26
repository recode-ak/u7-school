import { describe, expect, it } from 'bun:test';
import { type ArchApp, reportArchCheck } from 'dmg-core/arch';
import { ARCH_APPS, runDomainCheck } from './arch-check';
import { DOMAIN_MODULES } from './domain-arch';
import { domainGraphOf } from './domain-check';

function run(apps: readonly ArchApp[]) {
  const lines: string[] = [];
  const code = reportArchCheck(apps, (line) => lines.push(line));
  return { code, lines };
}

describe('arch:check', () => {
  it('зарегистрированные приложения — без нарушений', () => {
    const { code, lines } = run(ARCH_APPS);
    expect(code).toBe(0);
    expect(lines.at(-1)).toBe('arch:check: нарушений нет');
  });

  it('домен подключён: модули по Def, вход для других — contract (D-45)', () => {
    const domain = ARCH_APPS.find((a) => a.name === 'domain');
    expect(domain?.modules).toEqual(DOMAIN_MODULES);
    expect(domain?.entry).toBe('contract');
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
