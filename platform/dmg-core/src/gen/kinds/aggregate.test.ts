import { expect, test } from 'bun:test';
import { parseArgs } from '../cli';
import { GenLayout } from '../layout';
import { planDomainAggregate } from './aggregate';

const layout = new GenLayout(
  { domain: '/d/{m}', app: '/p/{m}/src', domainImport: '@acme/domain/{m}' },
  '.',
);

const plan = planDomainAggregate(
  parseArgs(['aggregate', 'stream.student'], layout),
);
const file = (path: string) =>
  plan.files.find((f) => f.path === `/d/stream/student/${path}`)?.content ?? '';

test('файлы агрегата по naming.md §2', () => {
  expect(plan.files.map((f) => f.path)).toEqual([
    '/d/stream/student/student.state.ts',
    '/d/stream/student/student.events.ts',
    '/d/stream/student/student.errors.ts',
    '/d/stream/student/student.ar.ts',
    '/d/stream/student/student.policy.ts',
    '/d/stream/student/student.ar.test.ts',
    '/d/stream/student/student.policy.test.ts',
  ]);
});

test('state: схема entity на BaseEntityFields', () => {
  const src = file('student.state.ts');
  expect(src).toContain('export const StudentState = v.object({');
  expect(src).toContain('...BaseEntityFields');
  expect(src).toContain('export type StudentState = v.InferOutput');
});

test('events: группа с FQN-префиксом модуль.агрегат', () => {
  const src = file('student.events.ts');
  expect(src).toContain(
    "export const StudentEvents = EventDef.define('stream.student', {",
  );
  expect(src).toContain('created: {');
  expect(src).toContain('studentId: F.uuid(');
});

test('errors: префикс UPPER_SNAKE, NOT_FOUND', () => {
  const src = file('student.errors.ts');
  expect(src).toContain(
    "export const StudentErrors = ErrorDef.define('STUDENT', {",
  );
  expect(src).toContain('NOT_FOUND: {');
});

test('ar: Def, класс, create/restore', () => {
  const src = file('student.ar.ts');
  expect(src).toContain('export const StudentArDef = AggregateDef.define({');
  expect(src).toContain("name: 'student'");
  expect(src).toContain(
    'export class StudentAr extends Aggregate<typeof StudentArDef>',
  );
  expect(src).toContain('static create(');
  expect(src).toContain('static restore(');
  expect(src).toContain('StudentEvents.created.make(');
});

test('policy: Def и правило', () => {
  const src = file('student.policy.ts');
  expect(src).toContain('export const StudentPolicy = PolicyDef.define({');
  expect(src).toContain('export type StudentCtx');
  expect(src).toContain('canView');
});

test('тесты: вход создания — одна константа Create<A> на файл, без литерала state', () => {
  const decl = 'const createInput: CreateStudent = {\n  uuid: ID,\n};';
  const ar = file('student.ar.test.ts');
  expect(ar).toContain(decl);
  expect(ar).toContain(
    "import { type CreateStudent, StudentAr } from './student.ar';",
  );
  expect(ar).toContain('StudentAr.create(createInput, T0)');
  // Новое поле state не ломает проверку снапшота.
  expect(ar).toContain('expect(ar.snapshot()).toMatchObject({');
  const policy = file('student.policy.test.ts');
  expect(policy).toContain(decl);
  expect(policy).toContain(
    'student: expectOk(StudentAr.create(createInput, T0)),',
  );
  expect(policy).not.toContain('restore(');
});

test('тесты: создание агрегата и правило политики', () => {
  expect(file('student.ar.test.ts')).toContain("describe('StudentAr.create'");
  expect(file('student.policy.test.ts')).toContain(
    "describe('StudentPolicy.canView'",
  );
});

test('правки: Def в паспорт модуля и экспорты в index', () => {
  const mod = '/d/stream/stream.module.ts';
  const idx = '/d/stream/index.ts';
  expect(plan.edits).toEqual([
    {
      path: mod,
      marker: '// gen:defs:imports',
      line: "import { StudentArDef } from './student/student.ar';",
    },
    { path: mod, marker: '// gen:defs:aggregates', line: '    StudentArDef,' },
    {
      path: idx,
      marker: '// gen:exports',
      line: "export {\n  type CreateStudent,\n  StudentAr,\n  StudentArDef,\n} from './student/student.ar';",
    },
    {
      path: idx,
      marker: '// gen:exports',
      line: "export { StudentErrors } from './student/student.errors';",
    },
    {
      path: idx,
      marker: '// gen:exports',
      line: "export { StudentEvents } from './student/student.events';",
    },
    {
      path: idx,
      marker: '// gen:exports',
      line: "export { type StudentCtx, StudentPolicy } from './student/student.policy';",
    },
  ]);
});

test('подсказки: created публикует UC создания (MAN-06); новое поле state', () => {
  expect(plan.notes).toEqual([
    'Событие created публикует UC создания (MAN-06): dmg-core gen uc stream.student create',
    'Новое поле state: из входа создания — в CreateStudent (student.ar.ts) и в константу createInput тестов заготовок (student.ar.test.ts, student.policy.test.ts, student.json-repo.test.ts, тест UC не create), иначе — значение в StudentAr.create; статус нового агрегата задаёт StudentAr.create.',
  ]);
});
