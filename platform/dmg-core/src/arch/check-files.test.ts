import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { defineModule } from '../domain/contracts/define-module';
import { DefIndex } from '../graph/def-index';
import { AlphaModuleDef, BetaModuleDef } from './arch.fixture';
import { checkFiles, type ModuleLayout } from './check-files';

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
    write(`${side}/beta/item/uc/get-item.uc.ts`);
  }
  write('domain/beta/index.ts');
}

const report = (): string[] =>
  checkFiles(DefIndex.from([AlphaModuleDef]), layout).map((v) => v.format());

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

    it('вход модуля задаёт приложение: contract.ts вместо index.ts', () => {
      cleanTree();
      write('domain/beta/contract.ts');
      write(
        'domain/alpha/note/er/add-note.er.ts',
        "import { ItemEvents } from '../../../beta/contract';\n",
      );
      write(
        'domain/alpha/note/job/purge-notes.job.ts',
        "import { ItemEvents } from '../../../beta';\n",
      );
      expect(
        checkFiles(DefIndex.from([AlphaModuleDef]), layout, 'contract').map(
          (v) => v.format(),
        ),
      ).toEqual([
        'ARC-04: alpha/note/job/purge-notes.job.ts импортирует beta мимо contract.ts: ../../../beta',
      ]);
    });

    describe('мимо входа между внешними модулями', () => {
      const legacyImport = (): void => {
        cleanTree();
        write('domain/beta/contract.ts');
        write(
          'domain/alpha/note/er/add-note.er.ts',
          "import { ItemEvents } from '../../../beta';\n",
        );
      };
      const run = (alphaExternal: boolean, betaExternal: boolean): string[] => {
        const beta = defineModule({ ...BetaModuleDef, external: betaExternal });
        const alpha = defineModule({
          ...AlphaModuleDef,
          external: alphaExternal,
          dependsOn: [beta],
        });
        return checkFiles(DefIndex.from([alpha]), layout, 'contract').map((v) =>
          v.format(),
        );
      };
      const violation =
        'ARC-04: alpha/note/er/add-note.er.ts импортирует beta мимо contract.ts: ../../../beta';

      it('external → external: не проверяется', () => {
        legacyImport();
        expect(run(true, true)).toEqual([]);
      });

      it('external → модуль на Def: нарушение', () => {
        legacyImport();
        expect(run(true, false)).toEqual([violation]);
      });

      it('модуль на Def → external: нарушение', () => {
        legacyImport();
        expect(run(false, true)).toEqual([violation]);
      });

      it('dependsOn проверяется и между внешними', () => {
        legacyImport();
        write(
          'domain/beta/item/uc/create-item.uc.ts',
          "import type { X } from '../../../alpha';\n",
        );
        expect(run(true, true)).toEqual([
          'ARC-04: beta/item/uc/create-item.uc.ts импортирует alpha, которого нет в dependsOn beta',
        ]);
      });
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
        'ARC-06: alpha/note/er/add-note.er.ts импортирует прикладной пакет beta: ../../../beta/beta.module',
      ]);
    });

    it('у модуля нет прикладного пакета', () => {
      cleanTree();
      rmSync(join(root, 'app/beta'), { recursive: true });
      expect(report()).toEqual([
        `ARC-06: модуль beta: нет ${join(root, 'app/beta/beta.module.ts')}`,
        'MAN-10: beta/item/uc/create-item.uc.ts есть в домене, нет в прикладном слое',
        'MAN-10: beta/item/uc/get-item.uc.ts есть в домене, нет в прикладном слое',
      ]);
    });

    it('внешний модуль: только контракт в домене, прикладного пакета нет (D-37, D-42)', () => {
      cleanTree();
      rmSync(join(root, 'app/beta'), { recursive: true });
      const beta = defineModule({ ...BetaModuleDef, external: true });
      const alpha = defineModule({ ...AlphaModuleDef, dependsOn: [beta] });
      expect(
        checkFiles(DefIndex.from([alpha]), layout).map((v) => v.format()),
      ).toEqual([]);
    });

    it('внешний модуль: прикладной слой не проверяется, и импорты в нём тоже', () => {
      cleanTree();
      write(
        'app/beta/legacy.ts',
        "import { x } from '../alpha/alpha.module';\nimport { y } from '../../domain/alpha/note/er/add-note.er';\n",
      );
      const beta = defineModule({ ...BetaModuleDef, external: true });
      const alpha = defineModule({ ...AlphaModuleDef, dependsOn: [beta] });
      expect(
        checkFiles(DefIndex.from([alpha]), layout).map((v) => v.format()),
      ).toEqual([]);
    });
  });
});
