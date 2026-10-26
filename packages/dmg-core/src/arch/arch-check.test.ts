import { describe, expect, it } from 'bun:test';
import { ExampleArch } from '../testing/example/example.arch';
import { archCheck } from './arch-check';
import { formatViolation } from './violation';

describe('archCheck', () => {
  it('учебный пример (todo + users) — без нарушений', () => {
    expect(archCheck(ExampleArch)).toEqual([]);
  });

  it('пустой домен — без нарушений', () => {
    const empty = { name: 'empty', modules: [], layout: ExampleArch.layout };
    expect(archCheck(empty)).toEqual([]);
  });

  it('вход модуля для других — из приложения (`entry`)', () => {
    const app = { ...ExampleArch, entry: 'contract' };
    expect(archCheck(app).map(formatViolation)).toEqual([
      'ARC-04: todo/task/er/archive-removed-user-tasks.er.ts импортирует users мимо contract.ts: #core/testing/example/users/index',
      'ARC-04: todo/todo.module.ts импортирует users мимо contract.ts: ../users',
      'ARC-04: todo/task/er/archive-removed-user-tasks.er.test.ts импортирует users мимо contract.ts: #core/testing/example/users/index',
    ]);
  });
});
