import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { indexDefs } from '../graph/def-index';
import { AlphaModuleDef } from './arch.fixture';
import { checkFiles, type ModuleLayout } from './check-files';
import { formatViolation } from './violation';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'arch-files-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const layout = (m: string): ModuleLayout => ({
  domain: join(root, 'domain', m),
  app: join(root, 'app', m),
});

function write(path: string, text = 'export {};\n'): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

/** Раскладка, при которой проверки по файлам проходят. */
function cleanTree(): void {
  for (const side of ['domain', 'app']) {
    write(`${side}/alpha/alpha.module.ts`);
    write(`${side}/alpha/note/er/add-note.er.ts`);
    write(`${side}/alpha/note/job/purge-notes.job.ts`);
    write(`${side}/beta/beta.module.ts`);
    write(`${side}/beta/item/uc/create-item.uc.ts`);
  }
  write('domain/beta/index.ts');
}

const report = (): string[] =>
  checkFiles(indexDefs([AlphaModuleDef]), layout).map(formatViolation);

describe('checkFiles', () => {
  it('чистая раскладка — без нарушений', () => {
    cleanTree();
    write(
      'domain/alpha/note/er/add-note.er.ts',
      "import { ItemEvents } from '../../../beta';\n",
    );
    write('domain/alpha/note/er/add-note.er.test.ts');
    expect(report()).toEqual([]);
  });

  describe('MAN-10 — пары путей', () => {
    it('реализация без контракта и контракт без реализации', () => {
      cleanTree();
      rmSync(join(root, 'app/beta/item/uc/create-item.uc.ts'));
      write('app/alpha/note/uc/extra.uc.ts');
      expect(report()).toEqual([
        'MAN-10: alpha/note/uc/extra.uc.ts есть в прикладном слое, нет в домене',
        'MAN-10: beta/item/uc/create-item.uc.ts есть в домене, нет в прикладном слое',
      ]);
    });

    it('ER не в папке основного агрегата', () => {
      cleanTree();
      for (const side of ['domain', 'app']) {
        rmSync(join(root, `${side}/alpha/note/er/add-note.er.ts`));
        write(`${side}/alpha/other/er/add-note.er.ts`);
      }
      expect(report()).toEqual([
        'MAN-10: ER alpha.addNote: ожидается файл note/er/add-note.er.ts',
        'MAN-06: alpha/other/er/add-note.er.ts — нет такой операции в модуле (Def вне модуля)',
      ]);
    });
  });

  describe('ARC-04 — импорт другого модуля домена', () => {
    it('мимо index.ts', () => {
      cleanTree();
      write(
        'domain/alpha/note/er/add-note.er.ts',
        "import { ItemEvents } from '../../../beta/item/item.events';\n",
      );
      expect(report()).toEqual([
        'ARC-04: alpha/note/er/add-note.er.ts импортирует beta мимо index.ts: ../../../beta/item/item.events',
      ]);
    });

    it('модуль вне dependsOn', () => {
      cleanTree();
      write(
        'domain/beta/item/uc/create-item.uc.ts',
        "import type { X } from '../../../alpha';\n",
      );
      write('domain/alpha/index.ts');
      expect(report()).toEqual([
        'ARC-04: beta/item/uc/create-item.uc.ts импортирует alpha, которого нет в dependsOn beta',
      ]);
    });
  });

  describe('ARC-06 — прикладные пакеты', () => {
    it('импорт прикладного пакета другого модуля', () => {
      cleanTree();
      write(
        'app/alpha/note/er/add-note.er.ts',
        "export { x } from '../../../beta/beta.module';\n",
      );
      expect(report()).toEqual([
        'ARC-06: alpha/note/er/add-note.er.ts импортирует прикладной пакет beta',
      ]);
    });

    it('у модуля нет прикладного пакета', () => {
      cleanTree();
      rmSync(join(root, 'app/beta'), { recursive: true });
      expect(report()).toEqual([
        `ARC-06: модуль beta: нет ${join(root, 'app/beta/beta.module.ts')}`,
        'MAN-10: beta/item/uc/create-item.uc.ts есть в домене, нет в прикладном слое',
      ]);
    });
  });
});
