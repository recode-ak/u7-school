import { describe, expect, it } from 'bun:test';
import { StreamAr } from './stream.ar';
import { stored } from './stream.fixture';

// Вопросы потока, нужные студенту (решение 4): замена legacy `LegacyStreamAr`
// (`getFirstStepId`/`findNextStep`/`findStepContext`/проверка ключа).

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '12121212-1212-4212-8212-121212121212';
const L1 = '21111111-1111-4111-8111-111111111111';
const L2 = '22222222-2222-4222-8222-222222222222';
const L3 = '23333333-3333-4333-8333-333333333333';
const S1 = '31111111-1111-4111-8111-111111111111';
const S2 = '32222222-2222-4222-8222-222222222222';
const S3 = '33333333-3333-4333-8333-333333333333';
const S4 = '34444444-4444-4444-8444-444444444444';
const S5 = '35555555-5555-4555-8555-555555555555';

// П1: У1 [S1, S2], У2 [S3]; П2: У3 [S4, S5]
const snapshot = [
  {
    projectId: P1,
    projectTitle: 'П1',
    lessons: [
      { lessonId: L1, lessonTitle: 'У1', stepIds: [S1, S2] },
      { lessonId: L2, lessonTitle: 'У2', stepIds: [S3] },
    ],
  },
  {
    projectId: P2,
    projectTitle: 'П2',
    lessons: [{ lessonId: L3, lessonTitle: 'У3', stepIds: [S4, S5] }],
  },
];

const streamWith = (extra = {}) =>
  StreamAr.restore(stored('active', { contentSnapshot: snapshot, ...extra }));

describe('StreamAr.stepPlace', () => {
  it('обычный шаг: следующий в уроке, не последний', () => {
    expect(streamWith().stepPlace(S1)).toEqual({
      nextStepId: S2,
      lessonId: L1,
      projectId: P1,
      lastInLesson: false,
      lastLessonInProject: false,
    });
  });

  it('последний шаг урока (не последнего в проекте): следующий — первый шаг следующего урока', () => {
    expect(streamWith().stepPlace(S2)).toEqual({
      nextStepId: S3,
      lessonId: L1,
      projectId: P1,
      lastInLesson: true,
      lastLessonInProject: false,
    });
  });

  it('последний шаг последнего урока проекта: следующий — в другом проекте', () => {
    expect(streamWith().stepPlace(S3)).toEqual({
      nextStepId: S4,
      lessonId: L2,
      projectId: P1,
      lastInLesson: true,
      lastLessonInProject: true,
    });
  });

  it('последний шаг потока — nextStepId нет', () => {
    const place = streamWith().stepPlace(S5);
    expect(place).toMatchObject({
      lessonId: L3,
      projectId: P2,
      lastInLesson: true,
      lastLessonInProject: true,
    });
    expect(place?.nextStepId).toBeUndefined();
  });

  it('шага нет в снимке — undefined (не исключение)', () => {
    expect(streamWith().stepPlace(P1)).toBeUndefined();
  });

  it('пустой снимок — undefined', () => {
    expect(streamWith({ contentSnapshot: [] }).stepPlace(S1)).toBeUndefined();
  });
});

describe('StreamAr.hasStep', () => {
  it('шаг из снимка — true', () => {
    expect(streamWith().hasStep(S4)).toBe(true);
  });

  it('шага нет в снимке — false', () => {
    expect(streamWith().hasStep(L1)).toBe(false);
  });
});

describe('StreamAr.lessonSteps', () => {
  it('шаги запрошенных уроков снимка — в порядке запроса', () => {
    expect([...streamWith().lessonSteps([L3, L1])]).toEqual([
      [L3, [S4, S5]],
      [L1, [S1, S2]],
    ]);
  });

  it('урока нет в снимке — в ответ не попадает', () => {
    expect([...streamWith().lessonSteps([S1, L2]).keys()]).toEqual([L2]);
  });

  it('урок с пустым stepIds — с пустым списком', () => {
    const stream = streamWith({
      contentSnapshot: [
        {
          projectId: P1,
          projectTitle: 'П1',
          lessons: [{ lessonId: L1, lessonTitle: 'У1', stepIds: [] }],
        },
      ],
    });
    expect([...stream.lessonSteps([L1])]).toEqual([[L1, []]]);
  });
});
