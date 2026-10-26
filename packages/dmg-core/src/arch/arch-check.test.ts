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

  it('вход модуля для других — из приложения (`entry`, по умолчанию index)', () => {
    // Пример входит через `contract.ts`; при входе `index` тот же импорт —
    // нарушение ARC-04 в домене и прикладном слое.
    const app = { ...ExampleArch, entry: undefined };
    const arc04 = (file: string) =>
      `ARC-04: ${file} импортирует users мимо index.ts: #core/testing/example/users/contract`;
    expect(archCheck(app).map(formatViolation)).toEqual([
      // домен
      arc04('todo/task/er/release-removed-user-tasks.er.ts'),
      arc04('todo/task/task.rules.ts'),
      arc04('todo/task/uc/assign-task.uc.test.ts'),
      arc04('todo/task/uc/assign-task.uc.ts'),
      arc04('todo/todo.module.ts'),
      // прикладной слой (`app/`)
      arc04('todo/task/er/release-removed-user-tasks.er.test.ts'),
      arc04('todo/task/uc/assign-task.uc.test.ts'),
      arc04('todo/task/uc/assign-task.uc.ts'),
      arc04('todo/todo.module.test.ts'),
    ]);
  });
});
