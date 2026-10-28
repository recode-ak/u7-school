/**
 * `gen aggregate <m>.<agg>` — прикладной слой: порт `repo` и
 * JSON-репозиторий; оба — во вход пакета модуля `index.ts` (D-52: корень
 * сборки передаёт репозитории в фабрику), JSON-репозиторий — в фабрику
 * модуля в корне сборки (`AppWiring`).
 */
import { join } from 'node:path';
import type { GenArgs } from '../cli';
import { namedImport, sortImports, sortNames } from '../import-order';
import { toCamel, toPascal } from '../naming';
import type { GenPlan } from '../plan';
import { fit, list } from '../wrap';
import { createInputConst } from './aggregate';
import { AppWiring } from './app-wiring';

/**
 * Шапка класса с `extends` и `implements`, как её форматирует biome: в одну
 * строку до 80 символов, иначе — в столбик с `{` на отдельной строке.
 */
function classHeader(name: string, base: string, port: string): string {
  const line = `export class ${name} extends ${base} implements ${port} {`;
  return line.length <= 80
    ? line
    : `export class ${name}\n  extends ${base}\n  implements ${port}\n{`;
}

export function planAppAggregate(args: GenArgs): GenPlan {
  const { module: m, aggregate: a = '' } = args;
  const P = toPascal(a);
  const src = args.layout.appDir(m);
  const domain = (dir: string) => args.layout.domainImport(m, join(src, dir));
  const modulePath = join(src, `${m}.module.ts`);
  const indexPath = join(src, 'index.ts');

  /** Сигнатура \`findById\` с отступом \`pad\` (у класса — \`async\`). */
  const findById = (head: string, end: string) => {
    const pad = head.replace(/\S.*$/, '');
    const name = head.trimStart();
    return list(
      pad,
      `${name}findById(`,
      ['uuid: string'],
      `): Promise<${P}Ar | undefined>${end}`,
    );
  };

  const repoSrc = `${sortImports([
    `import type { ${P}Ar } from '${domain(a)}';`,
    "import type { Repository } from 'dmg-core/app';",
  ])}

/** Порт репозитория: принимает и возвращает Ar (API-03). */
${fit(
  `export type ${P}Repo = Repository<${P}Ar> & {\n${findById('  ', ';')}\n};`,
  `export type ${P}Repo =\n  Repository<${P}Ar> & {\n${findById('    ', ';')}\n  };`,
)}
`;

  const jsonRepoSrc = `${sortImports([
    namedImport([`${P}Ar`, `${P}ArDef`], domain('infra')),
    "import { type StoredRecord, VersionedRepository } from 'dmg-core/app';",
    "import * as v from 'valibot';",
    `import type { ${P}Repo } from '../${a}/${a}.repo';`,
  ])}

const Rows = v.array(${P}ArDef.state);

/**
 * Агрегаты в JSON-файле: массив снапшотов. Только хранение — состояние
 * разбирает схема Def, агрегат восстанавливает \`${P}Ar.restore\`. Запись —
 * под замком: чтение → сверка версии → запись атомарны в процессе (D-36).
 */
${classHeader(`${P}JsonRepo`, `VersionedRepository<${P}Ar>`, `${P}Repo`)}
  readonly aggregate = ${P}ArDef;

  constructor(private readonly filePath: string) {
    super();
  }

${findById('  async ', ' {')}
    const row = (await this.rows()).find((r) => r.uuid === uuid);
    return row && ${P}Ar.restore(row);
  }

  protected async stored(uuid: string): Promise<StoredRecord | undefined> {
    return (await this.rows()).find((r) => r.uuid === uuid);
  }

  protected async write(ar: ${P}Ar): Promise<void> {
    const next = (await this.rows()).filter((r) => r.uuid !== ar.uuid);
    next.push(ar.snapshot());
    await Bun.write(this.filePath, JSON.stringify(next, undefined, 2));
  }

  private async rows() {
    const file = Bun.file(this.filePath);
    if (!(await file.exists())) return [];
    return v.parse(Rows, await file.json());
  }
}
`;

  const newRepo = list(
    '    ',
    `const repo = new ${P}JsonRepo(`,
    [`join(dir, '${a}.json')`],
    ');',
  );
  const createAr = list(
    '    ',
    'const ar = expectOk(',
    [`${P}Ar.create(createInput, T0)`],
    ');',
  );

  const testSrc = `${sortImports([
    "import { afterEach, beforeEach, describe, expect, it } from 'bun:test';",
    "import { mkdtempSync, rmSync } from 'node:fs';",
    "import { tmpdir } from 'node:os';",
    "import { join } from 'node:path';",
    namedImport(sortNames([`type Create${P}`, `${P}Ar`]), domain('infra')),
    "import { VersionConflict } from 'dmg-core/app';",
    "import { expectOk } from 'dmg-core/testing';",
    `import { ${P}JsonRepo } from './${a}.json-repo';`,
  ])}

const ID = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const T0 = Date.UTC(2026, 9, 1);
const OTHER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
${createInputConst(P)}

let dir: string;
beforeEach(() => {
${list('  ', 'dir = mkdtempSync(', [`join(tmpdir(), '${a}-repo-')`], ');')}
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('${P}JsonRepo', () => {
  it('сохраняет агрегат и находит его по uuid', async () => {
${newRepo}
${createAr}
    await repo.save(ar);
    expect((await repo.findById(ID))?.snapshot()).toEqual(ar.snapshot());
  });

  it('запись по устаревшей версии — VersionConflict', async () => {
${newRepo}
${createAr}
    await repo.save(ar);
${list('    ', `const stale = ${P}Ar.restore({`, ['...ar.snapshot()', 'version: 1'], '});', { space: true })}
    await expect(repo.save(stale)).rejects.toBeInstanceOf(VersionConflict);
  });

  it('нет записи — undefined', async () => {
${newRepo}
    expect(await repo.findById(OTHER)).toBeUndefined();
  });
});
`;

  return {
    files: [
      { path: join(src, a, `${a}.repo.ts`), content: repoSrc },
      { path: join(src, 'infra', `${a}.json-repo.ts`), content: jsonRepoSrc },
      {
        path: join(src, 'infra', `${a}.json-repo.test.ts`),
        content: testSrc,
      },
    ],
    edits: [
      {
        path: modulePath,
        marker: '// gen:defs:imports',
        line: `import type { ${P}Repo } from './${a}/${a}.repo';`,
      },
      {
        path: modulePath,
        marker: '// gen:deps',
        line: `  readonly ${toCamel(a)}Repo: ${P}Repo;`,
      },
      {
        path: indexPath,
        marker: '// gen:exports',
        line: `export type { ${P}Repo } from './${a}/${a}.repo';`,
      },
      {
        path: indexPath,
        marker: '// gen:exports',
        line: `export { ${P}JsonRepo } from './infra/${a}.json-repo';`,
      },
      ...new AppWiring(args).aggregateEdits(a),
    ],
  };
}
