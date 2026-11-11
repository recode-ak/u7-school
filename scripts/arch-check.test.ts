import { describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { type ArchApp, reportArchCheck } from 'dmg-core/arch';
import {
  ARCH_APPS,
  assemblyPackages,
  runDebtCheck,
  runDomainCheck,
} from './arch-check';
import { DEBT_MD as DEBT_MD_PATH, DOMAIN_MODULES } from './domain-arch';
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
    expect(await assemblyPackages('.')).toEqual([
      '@u7-scl/app',
      '@u7-scl/bot',
      '@u7-scl/cli',
    ]);
  });
});

describe('arch:check domain', () => {
  it('граф dependsOn домена — из ModuleDef, внешний dossier (peer-review на Def)', () => {
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
    expect(external.map((m) => m.name)).not.toContain('peer-review');
    expect(external.map((m) => m.name)).not.toContain('questionnaire');
    expect(external.map((m) => m.name)).not.toContain('course');
    expect(external.map((m) => m.name)).not.toContain('user');
    expect(external.map((m) => m.name)).toContain('dossier');
  });

  it('репозиторий — без нарушений домена и долга', async () => {
    expect(await runDomainCheck()).toEqual([]);
  });
});

describe('runDebtCheck: реестр долга как allowlist', () => {
  const REGISTRY = [
    '### DEBT-1: импорты `@u7-scl/core` в домене',
    '- **Место:** `domain/src/user/**`',
    "- **Признак:** `from '@u7-scl/core`",
    '- **Корень:** `domain/src/**`',
  ].join('\n');
  const CORE = "import { A } from '@u7-scl/core';\n";

  it('долг вне Места и неизвестный ID — нарушения; голый маркер — нарушение строгого режима', async () => {
    const root = await mkdtemp(join(tmpdir(), 'debt-check-'));
    try {
      const put = async (path: string, text: string) => {
        await mkdir(join(root, dirname(path)), { recursive: true });
        await writeFile(join(root, path), text);
      };
      await put(DEBT_MD_PATH, REGISTRY);
      await put('domain/src/user/a.ts', `${CORE}// DEBT-1\n`);
      await put('domain/src/course/b.ts', CORE);
      await put('domain/src/course/c.ts', '// DEBT-9\n');
      expect(await runDebtCheck(root)).toEqual([
        'DEBT: DEBT-1: долг без записи — domain/src/course/b.ts:1',
        'DEBT: domain/src/course/c.ts:1: DEBT-9 — нет записи в debt.md',
        'DEBT: domain/src/user/a.ts:2: DEBT-1 вне biome-ignore',
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
