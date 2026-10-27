import { describe, expect, expectTypeOf, it } from 'bun:test';
import { Def } from '#core/kernel/def/def';
import {
  ArchiveDoneErDef,
  CompleteTaskUcDef,
  GetUserUcDef,
  ListTasksUcDef,
  RemindJobDef,
  TaskArDef,
  UserArDef,
} from './contracts.fixture';
import { type AnyModuleDef, ModuleDef } from './module-def';

const Users = ModuleDef.define({
  name: 'users',
  label: 'Пользователи',
  description: 'Учётные записи.',
  external: true,
  dependsOn: [],
  aggregates: [UserArDef],
  useCases: [GetUserUcDef],
  reactions: [],
  jobs: [],
});

const Todo = ModuleDef.define({
  name: 'todo',
  label: 'Задачи',
  description: 'Список дел.',
  dependsOn: [Users],
  aggregates: [TaskArDef],
  useCases: [CompleteTaskUcDef, ListTasksUcDef],
  reactions: [ArchiveDoneErDef],
  jobs: [RemindJobDef],
});

describe('ModuleDef', () => {
  it('Def вида module; состав и зависимости ссылками', () => {
    expect(Todo).toBeInstanceOf(ModuleDef);
    expect(Todo).toBeInstanceOf(Def);
    expect(Todo.dmg).toBe('module');
    expect(Todo.dependsOn[0]).toBe(Users);
    expect(Todo.aggregates).toEqual([TaskArDef]);
    expect(Todo.useCases).toEqual([CompleteTaskUcDef, ListTasksUcDef]);
    expect(Todo.reactions).toEqual([ArchiveDoneErDef]);
    expect(Todo.jobs).toEqual([RemindJobDef]);
    expect('facade' in Todo).toBe(false);
  });

  it('external — по умолчанию false', () => {
    expect(Users.external).toBe(true);
    expect(Todo.external).toBe(false);
  });

  it('литеральные типы состава', () => {
    expectTypeOf<(typeof Todo)['useCases'][number]>().toEqualTypeOf<
      typeof CompleteTaskUcDef | typeof ListTasksUcDef
    >();
    expectTypeOf(Todo.name).toEqualTypeOf<'todo'>();
  });

  it('describe() — тексты без схем', () => {
    expect(Todo.describe()).toEqual({
      label: 'Задачи',
      description: 'Список дел.',
      schemas: [],
    });
  });

  it('normalize() — ссылки → имена', () => {
    expect(Todo.normalize()).toEqual({
      dmg: 'module',
      name: 'todo',
      label: 'Задачи',
      description: 'Список дел.',
      external: false,
      dependsOn: ['users'],
      aggregates: ['task'],
      useCases: ['completeTask', 'listTasks'],
      reactions: ['archiveDone'],
      jobs: ['remind'],
    });
  });

  it('конкретный Def совместим с AnyModuleDef; сравнение по ссылке', () => {
    const all: readonly AnyModuleDef[] = [Todo, Users];
    expect(all.includes(Users)).toBe(true);
    const owner = new Map<AnyModuleDef, number>([[Todo, 1]]);
    expect(owner.get(Todo)).toBe(1);
  });

  it('структурная типизация: нет private/#', () => {
    type PublicShape = { [K in keyof ModuleDef]: ModuleDef[K] };
    expectTypeOf<PublicShape>().toExtend<ModuleDef>();
  });
});
