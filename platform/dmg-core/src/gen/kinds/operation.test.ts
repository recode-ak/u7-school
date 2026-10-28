import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('uc: контракт — UseCaseDef на агрегат', () => {
  const src = content(
    plan('uc', 'complete-student'),
    '/d/stream/student/uc/complete-student.uc.ts',
  );
  expect(src).toContain(
    'export const CompleteStudentUcDef = UseCaseDef.define({',
  );
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
    "import {\n  CompleteStudentUcDef,\n  type StreamModuleDef,\n  type StudentAr,\n  StudentErrors,\n} from '@acme/domain/stream';",
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

test('uc: тест реализации — модуль, пустые фасады и репозиторий в резолвере', () => {
  const src = content(
    plan('uc', 'complete-student'),
    '/p/stream/src/student/uc/complete-student.uc.test.ts',
  );
  expect(src).toContain(
    "import { StreamModuleDef, StudentAr } from '@acme/domain/stream';",
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

test('er: контракт EventReactionDef на событие агрегата, реализация ReactionFromDef', () => {
  const p = plan('er', 'fulfill-wish');
  expect(p.files.map((f) => f.path)).toEqual([
    '/d/stream/student/er/fulfill-wish.er.ts',
    '/d/stream/student/er/fulfill-wish.er.test.ts',
    '/p/stream/src/student/er/fulfill-wish.er.ts',
    '/p/stream/src/student/er/fulfill-wish.er.test.ts',
  ]);
  const def = content(p, '/d/stream/student/er/fulfill-wish.er.ts');
  expect(def).toContain(
    'export const FulfillWishErDef = EventReactionDef.define({',
  );
  expect(def).toContain('on: [StudentEvents.created]');
  expect(def).toContain('touches: [StudentArDef]');
  const impl = content(p, '/p/stream/src/student/er/fulfill-wish.er.ts');
  expect(impl).toContain('export class FulfillWishEr extends ReactionFromDef<');
  expect(p.edits.map((e) => e.marker)).toContain('// gen:defs:reactions');
});

test('job: контракт JobDef со scans, константа экспортируется, реализация JobFromDef', () => {
  const p = plan('job', 'inactivity-sweep');
  const def = content(p, '/d/stream/student/job/inactivity-sweep.job.ts');
  expect(def).toContain('export const INACTIVITY_SWEEP_HOUR = 3;');
  expect(def).toContain('export const InactivitySweepJobDef = JobDef.define({');
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

test('uc create: заявляет created — событие агрегата не висит без издателя (MAN-06)', () => {
  for (const name of ['create', 'create-student']) {
    const src = content(plan('uc', name), `/d/stream/student/uc/${name}.uc.ts`);
    expect(src).toContain("import { StudentEvents } from '../student.events';");
    expect(src).toContain('emits: [StudentEvents.created]');
    expect(src).toContain(
      'output: v.object({ studentId: StudentState.entries.uuid })',
    );
  }
});

test('uc create: реализация создаёт агрегат и регистрирует его в UoW', () => {
  const src = content(
    plan('uc', 'create-student'),
    '/p/stream/src/student/uc/create-student.uc.ts',
  );
  expect(src).toContain('StudentAr.create({ uuid: crypto.randomUUID() }');
  expect(src).toContain(
    'uow.register(created.value, this.resolve.studentRepo);',
  );
  expect(src).toContain('return ok({ studentId: created.value.uuid });');
  expect(src).toContain(
    'type Input = ParsedInputOf<typeof CreateStudentUcDef>;',
  );
  expect(src).toContain('_input: Input,');
  expect(src).toContain('uow: UnitOfWork,');
  expect(src).toContain('_caller: Caller<Identified>,');
});

test('uc create: тест реализации — JSON-репозиторий во временном каталоге', () => {
  const src = content(
    plan('uc', 'create-student'),
    '/p/stream/src/student/uc/create-student.uc.test.ts',
  );
  expect(src).toContain(
    "import { StudentJsonRepo } from '../../infra/student.json-repo';",
  );
  expect(src).toContain('mkdtempSync(');
  expect(src).toContain('studentRepo: repo,');
  expect(src).toContain('await repo.findById(out.studentId)');
  expect(src).not.toContain('TODO');
});

test('uc не create: emits пуст с TODO про событие, загрузка агрегата по id', () => {
  const p = plan('uc', 'complete-student');
  const def = content(p, '/d/stream/student/uc/complete-student.uc.ts');
  expect(def).toContain('emits: [],');
  expect(def).toContain('MAN-06');
  expect(def).not.toContain('StudentEvents');
  expect(def).toContain(
    'input: v.object({ studentId: StudentState.entries.uuid })',
  );
  expect(def).toContain('errors: [StudentErrors.NOT_FOUND]');
  const impl = content(p, '/p/stream/src/student/uc/complete-student.uc.ts');
  expect(impl).toContain('type Loaded = { readonly student: StudentAr };');
  expect(impl).toContain(
    'const student = await this.resolve.studentRepo.findById(studentId);',
  );
  expect(impl).toContain('StudentErrors.NOT_FOUND.err({ studentId })');
  expect(impl).toContain('{ student }: Loaded,');
  expect(impl).toContain('uow.register(student, this.resolve.studentRepo);');
});

test('uc не create: тест реализации — успех на сохранённом агрегате и код NOT_FOUND', () => {
  const src = content(
    plan('uc', 'complete-student'),
    '/p/stream/src/student/uc/complete-student.uc.test.ts',
  );
  expect(src).toContain(
    "import { StudentJsonRepo } from '../../infra/student.json-repo';",
  );
  expect(src).toContain("expectErr(res, 'STUDENT_NOT_FOUND')");
  expect(src).not.toContain('TODO');
});

test('uc: callers — пользователь, с подсказкой про --user раннера каркаса', () => {
  const src = content(
    plan('uc', 'complete-student'),
    '/d/stream/student/uc/complete-student.uc.ts',
  );
  expect(src).toContain("callers: ['user'],");
  expect(src).toContain('--user <uuid>');
  expect(src).toContain("'guest'");
  expect(src).toContain('project.md §7');
});

test('er и job: пустой emits с подсказкой про MAN-06', () => {
  for (const [kind, path] of [
    ['er', '/d/stream/student/er/fulfill-wish.er.ts'],
    ['job', '/d/stream/student/job/fulfill-wish.job.ts'],
  ] as const) {
    const src = content(plan(kind, 'fulfill-wish'), path);
    expect(src).toContain('emits: [],');
    expect(src).toContain('MAN-06');
  }
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

const NOTE =
  'Событие created публикует UC создания (MAN-06): dmg-core gen uc stream.student create';

test('MAN-06: без UC создания в каталоге — подсказка у uc не-create и er', () => {
  expect(plan('uc', 'complete-student').notes).toEqual([NOTE]);
  expect(plan('er', 'fulfill-wish').notes).toEqual([NOTE]);
  expect(plan('uc', 'create-student').notes).toEqual([]);
  expect(plan('job', 'inactivity-sweep').notes).toEqual([]);
});

test('MAN-06: UC создания уже есть — подсказки нет', () => {
  const root = mkdtempSync(join(tmpdir(), 'gen-op-'));
  try {
    mkdirSync(join(root, 'stream/student/uc'), { recursive: true });
    writeFileSync(join(root, 'stream/student/uc/create-student.uc.ts'), '');
    const withCreate = new GenLayout(
      { domain: `${root}/{m}`, app: '/p/{m}/src' },
      '.',
    );
    const notes = planOperation(
      parseArgs(['uc', 'stream.student', 'complete-student'], withCreate),
    ).notes;
    expect(notes).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
