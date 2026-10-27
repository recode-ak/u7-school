import { describe, expect, it } from 'bun:test';
import {
  ArchiveDoneErDef,
  CompleteTaskUcDef,
  GetUserUcDef,
  ListTasksUcDef,
  RemindJobDef,
  TaskArDef,
  TaskErrors,
  TaskEvents,
  TodoModuleDef,
  UserArDef,
  UsersModuleDef,
} from '../domain/contracts/contracts.fixture';
import { DomainRuleDef } from '../domain/rules/domain-rule-def';
import { ErrorDef } from '../kernel/errors/error-def';
import { ok } from '../kernel/result/result';
import { DefIndex } from './def-index';

const NotDone = DomainRuleDef.define({
  name: 'notDone',
  label: 'Не выполнена',
  description: 'Задачу ещё не завершили.',
  error: TaskErrors.ALREADY_DONE,
  check: () => ok(undefined),
});

const Stray = ErrorDef.define('STRAY', {
  LOST: { kind: 'conflict', label: 'Чужая', description: 'Вне модулей.' },
});

const Orphan = DomainRuleDef.define({
  name: 'orphan',
  label: 'Сирота',
  description: 'Ошибка вне модулей индекса.',
  error: Stray.LOST,
  check: () => ok(undefined),
});

describe('DefIndex', () => {
  const index = DefIndex.from([TodoModuleDef]);

  it('modules — замыкание корней по dependsOn, без повторов', () => {
    expect(index.modules).toEqual([TodoModuleDef, UsersModuleDef]);
    const twice = DefIndex.from([TodoModuleDef, UsersModuleDef]);
    expect(twice.modules).toEqual([TodoModuleDef, UsersModuleDef]);
  });

  it('operations() — операции всех модулей индекса', () => {
    expect(index.operations()).toEqual([
      CompleteTaskUcDef,
      ListTasksUcDef,
      ArchiveDoneErDef,
      RemindJobDef,
      GetUserUcDef,
    ]);
  });

  it('moduleOf — модуль-владелец агрегата или операции', () => {
    expect(index.moduleOf(TaskArDef)).toBe(TodoModuleDef);
    expect(index.moduleOf(UserArDef)).toBe(UsersModuleDef);
    expect(index.moduleOf(GetUserUcDef)).toBe(UsersModuleDef);
    expect(index.moduleOf(RemindJobDef)).toBe(TodoModuleDef);
    expect(DefIndex.from([UsersModuleDef]).moduleOf(TaskArDef)).toBeUndefined();
  });

  it('aggregateOf — агрегат-владелец события или ошибки', () => {
    expect(index.aggregateOf(TaskEvents.completed)).toBe(TaskArDef);
    expect(index.aggregateOf(TaskErrors.NOT_FOUND)).toBe(TaskArDef);
    expect(index.aggregateOf(Stray.LOST)).toBeUndefined();
  });

  it('id — `module.name` по владельцу; `?.name` вне индекса', () => {
    expect(index.id(TaskArDef)).toBe('todo.task');
    expect(index.id(GetUserUcDef)).toBe('users.getUser');
    const users = DefIndex.from([UsersModuleDef]);
    expect(users.id(CompleteTaskUcDef)).toBe('?.completeTask');
    expect(users.id(TaskArDef)).toBe('?.task');
  });

  it('ruleId — по агрегату-владельцу ошибки правила (D-40)', () => {
    expect(index.ruleId(NotDone)).toEqual({
      id: 'todo.task.notDone',
      module: 'todo',
    });
    expect(index.ruleId(Orphan)).toEqual({ id: '?.?.orphan', module: '?' });
  });
});
