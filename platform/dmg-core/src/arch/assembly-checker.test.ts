import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { type AnyModuleDef, ModuleDef } from '../domain/contracts/module-def';
import { DefIndex } from '../graph/def-index';
import { AlphaModuleDef, BetaModuleDef } from './arch.fixture';
import { AssemblyChecker } from './assembly-checker';
import type { ModuleLayout } from './file-checker';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'arch-assembly-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

// Как в учебном примере: прикладные пакеты модулей лежат внутри каталога
// корня сборки (`app/<m>`), раннер — рядом.
const layout = (m: string): ModuleLayout => ({
  domain: join(root, 'domain', m),
  app: join(root, 'app', m),
});

function write(path: string, text = 'export {};\n'): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

/** Чистая раскладка: корень сборки и раннер импортируют только разрешённое. */
function cleanTree(): void {
  for (const m of ['alpha', 'beta']) {
    write(`domain/${m}/contract.ts`);
    write(`domain/${m}/index.ts`);
    write(`app/${m}/index.ts`);
    write(`app/${m}/${m}.module.ts`);
  }
  write('app/beta/item/uc/create-item.uc.ts');
  write(
    'app/app.ts',
    [
      "import { BetaModuleDef } from '../domain/beta/contract';",
      "import { createBeta } from './beta';",
      "import { createAlpha } from './alpha/index';",
      "import { join } from 'node:path';",
      '',
    ].join('\n'),
  );
  write(
    'runner/cli.ts',
    [
      "import { App } from '../app/app';",
      "import { CreateItemUcDef } from '../domain/beta/contract';",
      "import { join } from 'node:path';",
      '',
    ].join('\n'),
  );
}

const check = (
  roots: readonly AnyModuleDef[] = [AlphaModuleDef],
  places: { root?: string; runners?: readonly string[] } = {
    root: join(root, 'app'),
    runners: [join(root, 'runner')],
  },
): string[] =>
  new AssemblyChecker(DefIndex.from(roots), layout, 'contract', places)
    .check()
    .map((v) => v.format());

describe('AssemblyChecker', () => {
  it('чистая раскладка — без нарушений', () => {
    cleanTree();
    expect(check()).toEqual([]);
  });

  it('без корня сборки и раннеров — проверять нечего', () => {
    cleanTree();
    write('app/app.ts', "import { x } from './beta/beta.module';\n");
    expect(check([AlphaModuleDef], {})).toEqual([]);
  });

  describe('ARC-07 — корень сборки', () => {
    it('домен модуля мимо входа (index вместо contract)', () => {
      cleanTree();
      write('app/app.ts', "import { BetaModuleDef } from '../domain/beta';\n");
      expect(check()).toEqual([
        'ARC-07: корень сборки app/app.ts импортирует beta мимо contract.ts: ../domain/beta',
      ]);
    });

    it('прикладной пакет модуля мимо index.ts — реализация UC', () => {
      cleanTree();
      write(
        'app/app.ts',
        "import { CreateItemUc } from './beta/item/uc/create-item.uc';\n",
      );
      expect(check()).toEqual([
        'ARC-07: корень сборки app/app.ts импортирует прикладной пакет beta мимо index.ts: ./beta/item/uc/create-item.uc',
      ]);
    });

    it('файлы прикладных пакетов внутри корня — не корень сборки', () => {
      cleanTree();
      // Импорт своего домена мимо входа — не дело проверки корня сборки.
      write(
        'app/beta/item/uc/create-item.uc.ts',
        "import { ItemArDef } from '../../../../domain/beta/item/item.ar';\n",
      );
      expect(check()).toEqual([]);
    });

    it('зависимость через dependsOn тоже проверяется', () => {
      cleanTree();
      // В корневых модулях только alpha; beta — его зависимость.
      write('app/app.ts', "import { createBeta } from './beta/beta.module';\n");
      expect(check()).toEqual([
        'ARC-07: корень сборки app/app.ts импортирует прикладной пакет beta мимо index.ts: ./beta/beta.module',
      ]);
    });

    it('внешний модуль: прикладной пакет не проверяется, домен — только вход', () => {
      cleanTree();
      write(
        'app/app.ts',
        [
          "import { legacy } from './beta/legacy/factory';",
          "import { ItemEvents } from '../domain/beta/item/item.events';",
          '',
        ].join('\n'),
      );
      const beta = ModuleDef.define({ ...BetaModuleDef, external: true });
      const alpha = ModuleDef.define({ ...AlphaModuleDef, dependsOn: [beta] });
      expect(check([alpha])).toEqual([
        'ARC-07: корень сборки app/app.ts импортирует beta мимо contract.ts: ../domain/beta/item/item.events',
      ]);
    });
  });

  describe('ARC-08 — раннер', () => {
    it('импорт прикладного пакета модуля — даже его index', () => {
      cleanTree();
      write(
        'runner/cli.ts',
        [
          "import { createBeta } from '../app/beta';",
          "import { CreateItemUc } from '../app/beta/item/uc/create-item.uc';",
          '',
        ].join('\n'),
      );
      expect(check()).toEqual([
        'ARC-08: раннер runner/cli.ts импортирует прикладной пакет beta: ../app/beta',
        'ARC-08: раннер runner/cli.ts импортирует прикладной пакет beta: ../app/beta/item/uc/create-item.uc',
      ]);
    });

    it('домен модуля мимо входа', () => {
      cleanTree();
      write(
        'runner/main.ts',
        "import { ItemEvents } from '../domain/beta/item/item.events';\n",
      );
      expect(check()).toEqual([
        'ARC-08: раннер runner/main.ts импортирует beta мимо contract.ts: ../domain/beta/item/item.events',
      ]);
    });

    it('раннер внутри каталога корня сборки — проверяется как раннер', () => {
      cleanTree();
      write('app/cli/main.ts', "import { createBeta } from '../beta';\n");
      expect(
        check([AlphaModuleDef], {
          root: join(root, 'app'),
          runners: [join(root, 'app/cli')],
        }),
      ).toEqual([
        'ARC-08: раннер app/cli/main.ts импортирует прикладной пакет beta: ../beta',
      ]);
    });
  });

  describe('ARC-06 — прикладной пакет модуля и приложение вокруг него', () => {
    it('импорт файла корня сборки и раннера — нарушение', () => {
      cleanTree();
      write(
        'app/beta/item/uc/create-item.uc.ts',
        [
          "import type { AppUser } from '../../../app-user';",
          "import { App } from '../../../app';",
          "import { USAGE } from '../../../../runner/cli';",
          '',
        ].join('\n'),
      );
      write('app/app-user.ts');
      expect(check()).toEqual([
        'ARC-06: beta/item/uc/create-item.uc.ts импортирует корень сборки: ../../../app-user',
        'ARC-06: beta/item/uc/create-item.uc.ts импортирует корень сборки: ../../../app',
        'ARC-06: beta/item/uc/create-item.uc.ts импортирует раннер: ../../../../runner/cli',
      ]);
    });

    it('общий домен, свой и чужой прикладной пакет — не дело этой проверки', () => {
      cleanTree();
      // Тип пользователя — в общем домене (D-53); импорт другого прикладного
      // пакета — ARC-06 у `FileChecker`, не здесь.
      write('domain/shared/app-user.ts');
      write(
        'app/beta/item/uc/create-item.uc.ts',
        [
          "import type { AppUser } from '../../../../domain/shared/app-user';",
          "import { createBeta } from '../../index';",
          "import { createAlpha } from '../../../alpha';",
          '',
        ].join('\n'),
      );
      expect(check()).toEqual([]);
    });

    it('без корня сборки — проверяются только раннеры', () => {
      cleanTree();
      write(
        'app/beta/item/uc/create-item.uc.ts',
        [
          "import { App } from '../../../app';",
          "import { USAGE } from '../../../../runner/cli';",
          '',
        ].join('\n'),
      );
      expect(
        check([AlphaModuleDef], { runners: [join(root, 'runner')] }),
      ).toEqual([
        'ARC-06: beta/item/uc/create-item.uc.ts импортирует раннер: ../../../../runner/cli',
      ]);
    });

    it('внешний модуль: прикладной пакет не проверяется (D-37)', () => {
      cleanTree();
      write('app/beta/legacy/factory.ts', "import { App } from '../../app';\n");
      const beta = ModuleDef.define({ ...BetaModuleDef, external: true });
      const alpha = ModuleDef.define({ ...AlphaModuleDef, dependsOn: [beta] });
      expect(check([alpha])).toEqual([]);
    });
  });

  describe('место нарушения', () => {
    it('раннеры с одинаковым basename различаются путём от общего предка', () => {
      cleanTree();
      for (const r of ['a', 'b']) {
        write(
          `runners/${r}/src/main.ts`,
          "import { x } from '../../../app/beta';\n",
        );
      }
      expect(
        check([AlphaModuleDef], {
          root: join(root, 'app'),
          runners: [join(root, 'runners/a/src'), join(root, 'runners/b/src')],
        }),
      ).toEqual([
        'ARC-08: раннер runners/a/src/main.ts импортирует прикладной пакет beta: ../../../app/beta',
        'ARC-08: раннер runners/b/src/main.ts импортирует прикладной пакет beta: ../../../app/beta',
      ]);
    });

    it('только раннеры — путь от их общего предка', () => {
      cleanTree();
      for (const r of ['a', 'b']) {
        write(
          `runners/${r}/src/main.ts`,
          "import { x } from '../../../app/beta';\n",
        );
      }
      expect(
        check([AlphaModuleDef], {
          runners: [join(root, 'runners/a/src'), join(root, 'runners/b/src')],
        }),
      ).toEqual([
        'ARC-08: раннер a/src/main.ts импортирует прикладной пакет beta: ../../../app/beta',
        'ARC-08: раннер b/src/main.ts импортирует прикладной пакет beta: ../../../app/beta',
      ]);
    });
  });
});
