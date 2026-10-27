import { describe, expect, it } from 'bun:test';
import { defineModule } from '../domain/contracts/define-module';
import { DefIndex } from '../graph/def-index';
import { ExampleArch } from '../testing/example/example.arch';
import { ArchChecker } from './arch-checker';

const broken = defineModule({
  name: 'broken',
  label: '',
  description: 'Модуль без названия и без файлов.',
  dependsOn: [],
  aggregates: [],
  useCases: [],
  reactions: [],
  jobs: [],
});
const nowhere = () => ({ domain: '/нет/домена', app: '/нет/пакета' });

describe('ArchChecker', () => {
  it('без раскладки — только проверки по Def', () => {
    const checker = new ArchChecker(DefIndex.from([broken]));
    expect(checker.check().map((v) => v.format())).toEqual([
      'MAN-01: модуль broken: пустой label',
    ]);
  });

  it('defsOf(roots) — только Def по модулям; report() — строки нарушений', () => {
    expect(ArchChecker.defsOf([broken]).report()).toEqual([
      'MAN-01: модуль broken: пустой label',
    ]);
  });

  it('с раскладкой — проверки по Def, затем по файлам', () => {
    const checker = new ArchChecker(DefIndex.from([broken]), nowhere);
    expect(checker.check().map((v) => v.format())).toEqual([
      'MAN-01: модуль broken: пустой label',
      'ARC-06: модуль broken: нет /нет/домена/broken.module.ts',
      'ARC-06: модуль broken: нет /нет/пакета/broken.module.ts',
    ]);
  });

  it('учебный пример (todo + users) — без нарушений', () => {
    expect(ArchChecker.of(ExampleArch).check()).toEqual([]);
  });

  it('пустой домен — без нарушений', () => {
    const empty = { name: 'empty', modules: [], layout: ExampleArch.layout };
    expect(ArchChecker.of(empty).check()).toEqual([]);
  });

  it('вход модуля для других — из приложения (`entry`, по умолчанию index)', () => {
    // Пример входит через `contract.ts`; при входе `index` тот же импорт —
    // нарушение ARC-04 в домене и прикладном слое.
    const app = { ...ExampleArch, entry: undefined };
    const arc04 = (file: string) =>
      `ARC-04: ${file} импортирует users мимо index.ts: #core/testing/example/users/contract`;
    expect(
      ArchChecker.of(app)
        .check()
        .map((v) => v.format()),
    ).toEqual([
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
