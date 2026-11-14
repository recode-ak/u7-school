import { describe, expect, it } from 'bun:test';
import { type ArchApp, reportArchCheck } from 'dmg-core/arch';
import { ARCH_APPS, assemblyPackages, runDomainCheck } from './arch-check';
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

describe('assemblyPackages: ARC-06 (D-53)', () => {
  it('пакеты корня сборки и всех раннеров', async () => {
    expect(await assemblyPackages('.')).toEqual(['@u7-scl/app', '@u7-scl/bot']);
  });
});

describe('arch:check domain', () => {
  it('граф dependsOn домена — из ModuleDef, внешних модулей нет', () => {
    expect(domainGraphOf(DOMAIN_MODULES)).toEqual({
      user: [],
      course: ['user'],
      questionnaire: ['user'],
      stream: ['user', 'course'],
      wish: ['user', 'course', 'questionnaire', 'stream'],
      'peer-review': ['user', 'questionnaire', 'stream'],
      dossier: [],
    });
    expect(DOMAIN_MODULES.filter((m) => m.external)).toEqual([]);
  });

  it('репозиторий — без нарушений домена и долга', async () => {
    expect(await runDomainCheck()).toEqual([]);
  });
});
