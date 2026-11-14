import { describe, expect, it } from 'bun:test';
import type { StepView } from '@u7-scl/domain/course/contract';
import { StreamLessonStepsDqs } from './stream-lesson-steps.dqs';

// Ф4а: шаги уроков потока по снимку — ответ `getStreamLessonSteps` из шагов,
// которые курс отдал без статусного фильтра (`getSnapshotSteps`).

const L1 = '21111111-1111-4111-8111-111111111111';
const L2 = '22222222-2222-4222-8222-222222222222';
const S1 = '31111111-1111-4111-8111-111111111111';
const S2 = '32222222-2222-4222-8222-222222222222';
const S3 = '33333333-3333-4333-8333-333333333333';

const view = (uuid: string, status: StepView['status']): StepView => ({
  uuid,
  moduleId: '3f2e1d0c-9b8a-4765-8432-10fedcba9876',
  kind: 'text',
  description: `Шаг ${uuid.slice(0, 2)}`,
  content: 'Текст',
  status,
  createdAt: 0,
  updatedAt: 0,
  version: 0,
});

describe('StreamLessonStepsDqs.build', () => {
  it('шаги урока в порядке снимка: uuid, description, status — любой статус', () => {
    const result = new StreamLessonStepsDqs(new Map([[L1, [S2, S1]]]), [
      view(S1, 'draft'),
      view(S2, 'archived'),
    ]).build();

    expect(result).toEqual({
      [L1]: [
        { uuid: S2, description: 'Шаг 32', status: 'archived' },
        { uuid: S1, description: 'Шаг 31', status: 'draft' },
      ],
    });
  });

  it('несколько уроков — ключ lessonId каждого', () => {
    const result = new StreamLessonStepsDqs(
      new Map([
        [L1, [S1]],
        [L2, [S2, S3]],
      ]),
      [view(S1, 'published'), view(S2, 'published'), view(S3, 'draft')],
    ).build();

    expect(Object.keys(result)).toEqual([L1, L2]);
    expect(result[L2]?.map((it) => it.uuid)).toEqual([S2, S3]);
  });

  it('шага, которого курс не отдал, нет; урок без шагов в ответ не попадает', () => {
    const result = new StreamLessonStepsDqs(
      new Map([
        [L1, [S1, S2]],
        [L2, [S3]],
      ]),
      [view(S2, 'published')],
    ).build();

    expect(result).toEqual({
      [L1]: [{ uuid: S2, description: 'Шаг 32', status: 'published' }],
    });
  });
});
