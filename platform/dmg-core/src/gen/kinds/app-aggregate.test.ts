import { expect, test } from 'bun:test';
import { parseArgs } from '../cli';
import { GenLayout } from '../layout';
import { planAppAggregate } from './app-aggregate';

const layout = new GenLayout(
  { domain: '/d/{m}', app: '/p/{m}/src', domainImport: '@acme/domain/{m}' },
  '.',
);

const plan = planAppAggregate(
  parseArgs(['aggregate', 'stream.student'], layout),
);
const file = (rel: string) =>
  plan.files.find((f) => f.path === `/p/stream/src/${rel}`)?.content ?? '';

test('файлы: порт репозитория, JSON-репозиторий и его тест', () => {
  expect(plan.files.map((f) => f.path)).toEqual([
    '/p/stream/src/student/student.repo.ts',
    '/p/stream/src/infra/student.json-repo.ts',
    '/p/stream/src/infra/student.json-repo.test.ts',
  ]);
});

test('порт: Repository<Ar> с поиском по uuid', () => {
  const src = file('student/student.repo.ts');
  expect(src).toContain('export type StudentRepo = Repository<StudentAr> & {');
  expect(src).toContain(
    'findById(uuid: string): Promise<StudentAr | undefined>',
  );
});

test('JSON-репозиторий: реализует порт, состояние разбирает схема Def', () => {
  const src = file('infra/student.json-repo.ts');
  // Длинная шапка — в столбик, как у biome.
  expect(src).toContain(
    'export class StudentJsonRepo\n  extends VersionedRepository<StudentAr>\n  implements StudentRepo\n{',
  );
  expect(src).toContain('protected async stored(uuid: string)');
  expect(src).toContain('protected async write(ar: StudentAr)');
  expect(src).toContain('readonly aggregate = StudentArDef');
  expect(src).toContain('v.array(StudentArDef.state)');
  expect(src).toContain('StudentAr.restore');
  expect(src).toContain("from '../student/student.repo'");
});

test('JSON-репозиторий: короткая шапка — в одну строку', () => {
  const short = planAppAggregate(parseArgs(['aggregate', 'stream.x'], layout));
  const src =
    short.files.find((f) => f.path === '/p/stream/src/infra/x.json-repo.ts')
      ?.content ?? '';
  expect(src).toContain(
    'export class XJsonRepo extends VersionedRepository<XAr> implements XRepo {',
  );
});

test('тест репозитория: сохранить и найти', () => {
  expect(file('infra/student.json-repo.test.ts')).toContain(
    "describe('StudentJsonRepo'",
  );
});

test('правки: порт попадает в Deps модуля, репозиторий — во вход пакета', () => {
  const mod = '/p/stream/src/stream.module.ts';
  const index = '/p/stream/src/index.ts';
  expect(plan.edits).toEqual([
    {
      path: mod,
      marker: '// gen:defs:imports',
      line: "import type { StudentRepo } from './student/student.repo';",
    },
    {
      path: mod,
      marker: '// gen:deps',
      line: '  readonly studentRepo: StudentRepo;',
    },
    {
      path: index,
      marker: '// gen:exports',
      line: "export type { StudentRepo } from './student/student.repo';",
    },
    {
      path: index,
      marker: '// gen:exports',
      line: "export { StudentJsonRepo } from './infra/student.json-repo';",
    },
  ]);
});
