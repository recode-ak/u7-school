/** `gen aggregate <m>.<agg>` — прикладной слой: порт `repo` и JSON-репозиторий. */
import { join } from 'node:path';
import type { GenArgs } from '../cli.ts';
import { toCamel, toPascal } from '../naming.ts';
import type { GenPlan } from '../plan.ts';

export function planAppAggregate(args: GenArgs): GenPlan {
  const { module: m, aggregate: a = '' } = args;
  const P = toPascal(a);
  const domain = `@u7-scl/domain/${m}`;
  const src = join(args.packagesRoot, m, 'src');
  const modulePath = join(src, `${m}.module.ts`);

  const repoSrc = `import type { ${P}Ar } from '${domain}';
import type { Repository } from 'dmg-core/app';

/** Порт репозитория: принимает и возвращает Ar (API-03). */
export type ${P}Repo = Repository<${P}Ar> & {
  findById(uuid: string): Promise<${P}Ar | undefined>;
};
`;

  const jsonRepoSrc = `import { ${P}Ar, ${P}ArDef } from '${domain}';
import { assertVersion, createLock } from 'dmg-core/app';
import * as v from 'valibot';
import type { ${P}Repo } from '../${a}/${a}.repo';

const Rows = v.array(${P}ArDef.state);

/**
 * Агрегаты в JSON-файле: массив снапшотов. Только хранение — состояние
 * разбирает схема Def, агрегат восстанавливает \`${P}Ar.restore\`. Запись —
 * под замком: чтение → сверка версии → запись атомарны в процессе (D-36).
 */
export class ${P}JsonRepo implements ${P}Repo {
  readonly aggregate = ${P}ArDef;
  private readonly lock = createLock();

  constructor(private readonly filePath: string) {}

  async findById(uuid: string): Promise<${P}Ar | undefined> {
    const row = (await this.rows()).find((r) => r.uuid === uuid);
    return row && ${P}Ar.restore(row);
  }

  save(ar: ${P}Ar): Promise<void> {
    return this.lock(async () => {
      const rows = await this.rows();
      const stored = rows.find((r) => r.uuid === ar.uuid);
      assertVersion(this.aggregate, ar, stored?.version);
      const next = rows.filter((r) => r.uuid !== ar.uuid);
      next.push(ar.snapshot());
      await Bun.write(this.filePath, JSON.stringify(next, undefined, 2));
    });
  }

  private async rows() {
    const file = Bun.file(this.filePath);
    if (!(await file.exists())) return [];
    return v.parse(Rows, await file.json());
  }
}
`;

  const testSrc = `import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ${P}Ar } from '${domain}';
import { VersionConflict } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';
import { ${P}JsonRepo } from './${a}.json-repo';

const ID = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const OTHER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), '${a}-repo-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('${P}JsonRepo', () => {
  it('сохраняет агрегат и находит его по uuid', async () => {
    const repo = new ${P}JsonRepo(join(dir, '${a}.json'));
    const ar = expectOk(${P}Ar.create({ uuid: ID }, Date.UTC(2026, 9, 1)));
    await repo.save(ar);
    expect((await repo.findById(ID))?.snapshot()).toEqual(ar.snapshot());
  });

  it('запись по устаревшей версии — VersionConflict', async () => {
    const repo = new ${P}JsonRepo(join(dir, '${a}.json'));
    const ar = expectOk(${P}Ar.create({ uuid: ID }, Date.UTC(2026, 9, 1)));
    await repo.save(ar);
    const stale = ${P}Ar.restore({ ...ar.snapshot(), version: 1 });
    await expect(repo.save(stale)).rejects.toBeInstanceOf(VersionConflict);
  });

  it('нет записи — undefined', async () => {
    const repo = new ${P}JsonRepo(join(dir, '${a}.json'));
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
    ],
  };
}
