import { expect, test } from 'bun:test';
import { parseArgs } from '../cli';
import { GenLayout } from '../layout';
import { planOperation } from './operation';

const layout = new GenLayout(
  { domain: '/d/{m}', app: '/p/{m}/src', domainImport: '@acme/domain/{m}' },
  '.',
);

const plan = (kind: 'uc' | 'er' | 'job', name: string) =>
  planOperation(parseArgs([kind, 'stream.student', name], layout));
const content = (p: ReturnType<typeof plan>, path: string) =>
  p.files.find((f) => f.path === path)?.content ?? '';

test('uc: пара контракт ↔ реализация с одинаковым относительным путём', () => {
  const p = plan('uc', 'complete-student');
  expect(p.files.map((f) => f.path)).toEqual([
    '/d/stream/student/uc/complete-student.uc.ts',
    '/d/stream/student/uc/complete-student.uc.test.ts',
    '/p/stream/src/student/uc/complete-student.uc.ts',
    '/p/stream/src/student/uc/complete-student.uc.test.ts',
  ]);
});

test('uc: контракт — defineUseCase на агрегат', () => {
  const src = content(
    plan('uc', 'complete-student'),
    '/d/stream/student/uc/complete-student.uc.ts',
  );
  expect(src).toContain('export const CompleteStudentUcDef = defineUseCase({');
  expect(src).toContain("name: 'completeStudent'");
  expect(src).toContain("import { StudentArDef } from '../student.ar';");
  expect(src).toContain('aggregate: StudentArDef');
  expect(src).toContain('policy: allowAll');
});

test('uc: реализация — класс XxxUc от UseCaseFromDef', () => {
  const src = content(
    plan('uc', 'complete-student'),
    '/p/stream/src/student/uc/complete-student.uc.ts',
  );
  expect(src).toContain(
    "import {\n  CompleteStudentUcDef,\n  type StreamModuleDef,\n} from '@acme/domain/stream';",
  );
  expect(src).toContain(
    "import type { StreamDeps } from '../../stream.module';",
  );
  expect(src).toContain(
    'export class CompleteStudentUc extends UseCaseFromDef<',
  );
  // Модуль передаёт себя (D-43): наследник проксирует его в super.
  expect(src).toContain(
    'constructor(deps: StreamDeps, module: typeof StreamModuleDef)',
  );
  expect(src).toContain('super(CompleteStudentUcDef, deps, module)');
});

test('uc: тест реализации — модуль и пустые фасады в резолвере', () => {
  const src = content(
    plan('uc', 'complete-student'),
    '/p/stream/src/student/uc/complete-student.uc.test.ts',
  );
  expect(src).toContain(
    "import { StreamModuleDef } from '@acme/domain/stream';",
  );
  expect(src).toContain('facades: new ModuleFacades()');
  expect(src).toContain('new CompleteStudentUc(deps, StreamModuleDef)');
});

test('uc: правки домена (module, index) и прикладного модуля', () => {
  const edits = plan('uc', 'complete-student').edits;
  expect(edits).toEqual([
    {
      path: '/d/stream/stream.module.ts',
      marker: '// gen:defs:imports',
      line: "import { CompleteStudentUcDef } from './student/uc/complete-student.uc';",
    },
    {
      path: '/d/stream/stream.module.ts',
      marker: '// gen:defs:useCases',
      line: '    CompleteStudentUcDef,',
    },
    {
      path: '/d/stream/index.ts',
      marker: '// gen:exports',
      line: "export { CompleteStudentUcDef } from './student/uc/complete-student.uc';",
    },
    {
      path: '/p/stream/src/stream.module.ts',
      marker: '// gen:defs:imports',
      line: "import { CompleteStudentUc } from './student/uc/complete-student.uc';",
    },
    {
      path: '/p/stream/src/stream.module.ts',
      marker: '// gen:defs:useCases',
      line: '    completeStudent: CompleteStudentUc,',
    },
  ]);
});

test('er: контракт defineEventReaction на событие агрегата, реализация ReactionFromDef', () => {
  const p = plan('er', 'fulfill-wish');
  expect(p.files.map((f) => f.path)).toEqual([
    '/d/stream/student/er/fulfill-wish.er.ts',
    '/d/stream/student/er/fulfill-wish.er.test.ts',
    '/p/stream/src/student/er/fulfill-wish.er.ts',
    '/p/stream/src/student/er/fulfill-wish.er.test.ts',
  ]);
  const def = content(p, '/d/stream/student/er/fulfill-wish.er.ts');
  expect(def).toContain(
    'export const FulfillWishErDef = defineEventReaction({',
  );
  expect(def).toContain('on: [StudentEvents.created]');
  expect(def).toContain('touches: [StudentArDef]');
  const impl = content(p, '/p/stream/src/student/er/fulfill-wish.er.ts');
  expect(impl).toContain('export class FulfillWishEr extends ReactionFromDef<');
  expect(p.edits.map((e) => e.marker)).toContain('// gen:defs:reactions');
});

test('job: контракт defineJob со scans, константа экспортируется, реализация JobFromDef', () => {
  const p = plan('job', 'inactivity-sweep');
  const def = content(p, '/d/stream/student/job/inactivity-sweep.job.ts');
  expect(def).toContain('export const INACTIVITY_SWEEP_HOUR = 3;');
  expect(def).toContain('export const InactivitySweepJobDef = defineJob({');
  expect(def).toContain('scans: [StudentArDef]');
  const impl = content(p, '/p/stream/src/student/job/inactivity-sweep.job.ts');
  expect(impl).toContain('export class InactivitySweepJob extends JobFromDef<');
  expect(p.edits.map((e) => e.marker)).toContain('// gen:defs:jobs');
  expect(p.edits).toContainEqual({
    path: '/p/stream/src/stream.module.ts',
    marker: '// gen:defs:jobs',
    line: '    inactivitySweep: InactivitySweepJob,',
  });
});

test('uc: заявляет created, чтобы реакция на него не висела без издателя (MAN-06)', () => {
  const src = content(
    plan('uc', 'complete-student'),
    '/d/stream/student/uc/complete-student.uc.ts',
  );
  expect(src).toContain("import { StudentEvents } from '../student.events';");
  expect(src).toContain('emits: [StudentEvents.created]');
});

test('тест контракта: длинное имя разбито по строкам, как требует biome', () => {
  const src = content(
    plan('uc', 'complete-student'),
    '/d/stream/student/uc/complete-student.uc.test.ts',
  );
  expect(src).toContain(
    "toMatchObject({\n      name: 'completeStudent',\n    });",
  );
});
