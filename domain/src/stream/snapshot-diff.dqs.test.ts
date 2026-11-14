import { describe, expect, it } from 'bun:test';
import { flat, tree } from './content-sync.fixture';
import { SnapshotDiffDqs } from './snapshot-diff.dqs';

// Отчёт о различиях двух снимков (F-80) и сдвиги шагов относительно опорного.
// Позиция шага — индекс в плоском обходе «проекты → уроки → шаги» с 1.

const diff = (
  before: ReturnType<typeof tree>,
  after: ReturnType<typeof tree>,
) => new SnapshotDiffDqs(before, after).compute();

const empty = {
  projects: { added: [], removed: [], renamed: [] },
  lessons: { added: [], removed: [], renamed: [] },
  steps: { added: [], removed: [], moved: [] },
};

describe('SnapshotDiffDqs.compute — заголовки и пустые', () => {
  it('идентичные снимки: changed=false, всё пусто', () => {
    const snap = tree({ P1: { L1: ['a', 'b'] }, P2: { L2: ['c'] } });
    expect(diff(snap, structuredClone(snap))).toEqual({
      changed: false,
      ...empty,
    });
  });

  it('оба снимка пусты: changed=false', () => {
    expect(diff([], [])).toEqual({ changed: false, ...empty });
  });

  it('из пустого в непустой: добавлены проект, урок и шаги', () => {
    const result = diff([], tree({ P1: { L1: ['a', 'b'] } }));
    expect(result.changed).toBe(true);
    expect(result.projects.added).toEqual([
      { projectId: 'P1', title: 'заголовок-P1' },
    ]);
    expect(result.lessons.added).toEqual([
      { lessonId: 'L1', projectId: 'P1', title: 'заголовок-L1' },
    ]);
    expect(result.steps.added).toEqual([
      { stepId: 'a', lessonId: 'L1', projectId: 'P1', index: 1 },
      { stepId: 'b', lessonId: 'L1', projectId: 'P1', index: 2 },
    ]);
    expect(result.steps.removed).toEqual([]);
    expect(result.steps.moved).toEqual([]);
  });

  it('из непустого в пустой: удалены проект, урок и шаги (позиции — из старого)', () => {
    const result = diff(tree({ P1: { L1: ['a', 'b'] } }), []);
    expect(result.changed).toBe(true);
    expect(result.projects.removed).toEqual([
      { projectId: 'P1', title: 'заголовок-P1' },
    ]);
    expect(result.lessons.removed).toEqual([
      { lessonId: 'L1', projectId: 'P1', title: 'заголовок-L1' },
    ]);
    expect(result.steps.removed).toEqual([
      { stepId: 'a', lessonId: 'L1', projectId: 'P1', index: 1 },
      { stepId: 'b', lessonId: 'L1', projectId: 'P1', index: 2 },
    ]);
    expect(result.steps.added).toEqual([]);
  });

  it('переименование проекта и урока: renamed, шаги не затронуты, changed=true', () => {
    const before = tree({ P1: { L1: ['a'] } });
    const after = tree(
      { P1: { L1: ['a'] } },
      { P1: 'Новый проект', L1: 'Новый урок' },
    );
    expect(diff(before, after)).toEqual({
      changed: true,
      ...empty,
      projects: {
        added: [],
        removed: [],
        renamed: [
          { projectId: 'P1', from: 'заголовок-P1', to: 'Новый проект' },
        ],
      },
      lessons: {
        added: [],
        removed: [],
        renamed: [{ lessonId: 'L1', from: 'заголовок-L1', to: 'Новый урок' }],
      },
    });
  });

  it('добавлен новый урок в существующий проект', () => {
    const result = diff(
      tree({ P1: { L1: ['a'] } }),
      tree({ P1: { L1: ['a'], L2: ['b'] } }),
    );
    expect(result.projects.added).toEqual([]);
    expect(result.lessons.added).toEqual([
      { lessonId: 'L2', projectId: 'P1', title: 'заголовок-L2' },
    ]);
    expect(result.steps.added).toEqual([
      { stepId: 'b', lessonId: 'L2', projectId: 'P1', index: 2 },
    ]);
  });

  it('удалён урок целиком: lessons.removed и его шаги в steps.removed', () => {
    const result = diff(
      tree({ P1: { L1: ['a'], L2: ['b'] } }),
      tree({ P1: { L1: ['a'] } }),
    );
    expect(result.lessons.removed).toEqual([
      { lessonId: 'L2', projectId: 'P1', title: 'заголовок-L2' },
    ]);
    expect(result.steps.removed).toEqual([
      { stepId: 'b', lessonId: 'L2', projectId: 'P1', index: 2 },
    ]);
    expect(result.steps.moved).toEqual([]);
  });
});

describe('SnapshotDiffDqs.compute — шаги', () => {
  it('добавлен в конец: index — позиция в новом, moved пуст', () => {
    const result = diff(flat(['a', 'b']), flat(['a', 'b', 'c']));
    expect(result.changed).toBe(true);
    expect(result.steps.added).toEqual([
      { stepId: 'c', lessonId: 'L', projectId: 'P', index: 3 },
    ]);
    expect(result.steps.removed).toEqual([]);
    expect(result.steps.moved).toEqual([]);
  });

  it('добавлен в середину: сдвиг чужих шагов не считается moved', () => {
    const result = diff(flat(['a', 'b']), flat(['a', 'x', 'b']));
    expect(result.steps.added).toEqual([
      { stepId: 'x', lessonId: 'L', projectId: 'P', index: 2 },
    ]);
    expect(result.steps.moved).toEqual([]);
  });

  it('удалён: index — позиция в старом, moved пуст', () => {
    const result = diff(flat(['a', 'b', 'c']), flat(['a', 'c']));
    expect(result.steps.removed).toEqual([
      { stepId: 'b', lessonId: 'L', projectId: 'P', index: 2 },
    ]);
    expect(result.steps.added).toEqual([]);
    expect(result.steps.moved).toEqual([]);
  });

  it('удалён и добавлен под новым id на то же место: removed + added', () => {
    const result = diff(flat(['a', 'b', 'c']), flat(['a', 'x', 'c']));
    expect(result.steps.removed).toEqual([
      { stepId: 'b', lessonId: 'L', projectId: 'P', index: 2 },
    ]);
    expect(result.steps.added).toEqual([
      { stepId: 'x', lessonId: 'L', projectId: 'P', index: 2 },
    ]);
    expect(result.steps.moved).toEqual([]);
  });

  it('шаг ушёл в начало (остальные в прежнем порядке): moved один, с позициями from/to', () => {
    const result = diff(flat(['a', 'b', 'c', 'd']), flat(['d', 'a', 'b', 'c']));
    expect(result.steps.moved).toEqual([
      {
        stepId: 'd',
        from: { projectId: 'P', lessonId: 'L', index: 4 },
        to: { projectId: 'P', lessonId: 'L', index: 1 },
      },
    ]);
    expect(result.steps.added).toEqual([]);
    expect(result.steps.removed).toEqual([]);
  });

  it('перестановка двух соседних: moved ровно один шаг, from/to согласованы с позициями', () => {
    const result = diff(flat(['a', 'b', 'c']), flat(['a', 'c', 'b']));
    expect(result.steps.moved).toHaveLength(1);
    const [moved] = result.steps.moved;
    const before = ['a', 'b', 'c'];
    const after = ['a', 'c', 'b'];
    expect(moved?.from.index).toBe(before.indexOf(moved?.stepId ?? '') + 1);
    expect(moved?.to.index).toBe(after.indexOf(moved?.stepId ?? '') + 1);
  });

  it('перенос в другой урок с сохранением порядка: moved со сменой lessonId', () => {
    const result = diff(
      tree({ P1: { L1: ['a', 'b'], L2: ['c', 'd'] } }),
      tree({ P1: { L1: ['a'], L2: ['b', 'c', 'd'] } }),
    );
    expect(result.steps.moved).toEqual([
      {
        stepId: 'b',
        from: { projectId: 'P1', lessonId: 'L1', index: 2 },
        to: { projectId: 'P1', lessonId: 'L2', index: 2 },
      },
    ]);
    expect(result.steps.added).toEqual([]);
    expect(result.steps.removed).toEqual([]);
  });

  it('перенос в другой проект с сохранением порядка: moved со сменой projectId', () => {
    const result = diff(
      tree({ P1: { L1: ['a', 'b'] }, P2: { L2: ['c'] } }),
      tree({ P1: { L1: ['a'] }, P2: { L2: ['b', 'c'] } }),
    );
    expect(result.steps.moved).toEqual([
      {
        stepId: 'b',
        from: { projectId: 'P1', lessonId: 'L1', index: 2 },
        to: { projectId: 'P2', lessonId: 'L2', index: 2 },
      },
    ]);
  });

  it('перенос урока: moved его шагов, остальные остаются на месте', () => {
    const result = diff(
      tree({ P1: { L1: ['a'], L2: ['b', 'c'] } }),
      tree({ P1: { L2: ['b', 'c'], L1: ['a'] } }),
    );
    expect(result.steps.moved).toEqual([
      {
        stepId: 'a',
        from: { projectId: 'P1', lessonId: 'L1', index: 1 },
        to: { projectId: 'P1', lessonId: 'L1', index: 3 },
      },
    ]);
    expect(result.lessons.added).toEqual([]);
    expect(result.lessons.removed).toEqual([]);
  });

  it('дубликат stepId в снимке — учитывается первое вхождение', () => {
    const result = diff(flat(['a', 'a', 'b']), flat(['a', 'b']));
    expect(result.steps.added).toEqual([]);
    expect(result.steps.removed).toEqual([]);
    expect(result.steps.moved).toEqual([]);
  });

  it('дубликат stepId в новом снимке не даёт added', () => {
    const result = diff(flat(['a', 'b']), flat(['a', 'b', 'a']));
    expect(result.steps.added).toEqual([]);
    expect(result.steps.moved).toEqual([]);
  });

  it('детерминизм: повторный расчёт даёт тот же moved, входы не меняются', () => {
    const before = flat(['a', 'b', 'c', 'd']);
    const after = flat(['b', 'a', 'd', 'c']);
    const copyBefore = structuredClone(before);
    const copyAfter = structuredClone(after);
    const first = diff(before, after);
    expect(diff(before, after).steps.moved).toEqual(first.steps.moved);
    expect(first.steps.moved).toHaveLength(2);
    expect(before).toEqual(copyBefore);
    expect(after).toEqual(copyAfter);
  });
});

describe('SnapshotDiffDqs.shiftsAround', () => {
  const shifts = (before: string[], after: string[], pivot: string) =>
    new SnapshotDiffDqs(flat(before), flat(after)).shiftsAround(pivot);

  it('добавлен перед pivot: newlyBehind, позиции pivot в новом и старом', () => {
    expect(shifts(['a', 'b', 'c'], ['x', 'a', 'b', 'c'], 'b')).toEqual({
      pivotInNew: 3,
      pivotInOld: 2,
      newlyBehind: ['x'],
      newlyAhead: [],
    });
  });

  it('добавлен после pivot: newlyAhead', () => {
    expect(shifts(['a', 'b', 'c'], ['a', 'b', 'y', 'c'], 'b')).toEqual({
      pivotInNew: 2,
      pivotInOld: 2,
      newlyBehind: [],
      newlyAhead: ['y'],
    });
  });

  it('добавлен в конец, pivot — последний: newlyAhead', () => {
    expect(shifts(['a', 'b', 'c'], ['a', 'b', 'c', 'z'], 'c')).toMatchObject({
      newlyBehind: [],
      newlyAhead: ['z'],
    });
  });

  it('порядок списков — по новому снимку', () => {
    expect(shifts(['a'], ['x1', 'a', 'y1', 'y2'], 'a')).toMatchObject({
      newlyBehind: ['x1'],
      newlyAhead: ['y1', 'y2'],
    });
    expect(shifts(['a'], ['x1', 'x2', 'a'], 'a').newlyBehind).toEqual([
      'x1',
      'x2',
    ]);
  });

  it('пересёк «вперёд → назад»: newlyBehind', () => {
    expect(shifts(['a', 'b', 'c'], ['c', 'a', 'b'], 'b')).toEqual({
      pivotInNew: 3,
      pivotInOld: 2,
      newlyBehind: ['c'],
      newlyAhead: [],
    });
  });

  it('пересёк «назад → вперёд»: newlyAhead', () => {
    expect(shifts(['a', 'b', 'c'], ['b', 'c', 'a'], 'b')).toEqual({
      pivotInNew: 1,
      pivotInOld: 2,
      newlyBehind: [],
      newlyAhead: ['a'],
    });
  });

  it('шаг переставлен, но остался по ту же сторону pivot: списки пусты', () => {
    expect(
      shifts(['a', 'b', 'c', 'd'], ['a', 'b', 'd', 'c'], 'a'),
    ).toMatchObject({ newlyBehind: [], newlyAhead: [] });
  });

  it('перенос в другой урок не меняет сторону: списки пусты', () => {
    const dqs = new SnapshotDiffDqs(
      tree({ P: { L1: ['a', 'b'], L2: ['c'] } }),
      tree({ P: { L1: ['a'], L2: ['b', 'c'] } }),
    );
    expect(dqs.shiftsAround('a')).toMatchObject({
      newlyBehind: [],
      newlyAhead: [],
    });
  });

  it('удалённый шаг не попадает ни в один список', () => {
    expect(shifts(['a', 'b', 'c'], ['a', 'c'], 'c')).toMatchObject({
      newlyBehind: [],
      newlyAhead: [],
    });
  });

  it('снимки идентичны: списки пусты', () => {
    expect(shifts(['a', 'b'], ['a', 'b'], 'a')).toEqual({
      pivotInNew: 1,
      pivotInOld: 1,
      newlyBehind: [],
      newlyAhead: [],
    });
  });

  it('pivot нет в старом: только добавленные, по стороне от pivot', () => {
    expect(shifts(['a', 'b'], ['x', 'p', 'y', 'a', 'b'], 'p')).toMatchObject({
      pivotInNew: 2,
      newlyBehind: ['x'],
      newlyAhead: ['y'],
    });
  });

  it('pivot нет в новом: списки пусты', () => {
    expect(shifts(['a', 'b', 'c'], ['a', 'x', 'c'], 'b')).toMatchObject({
      newlyBehind: [],
      newlyAhead: [],
    });
  });
});
