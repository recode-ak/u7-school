import { describe, expect, spyOn, test } from 'bun:test';
import * as Shared from '@u7-scl/core/shared';
import type { BotSession } from '@u7-scl/core/ui';
import { assertDialogResponseMarkdownSafe } from '@u7-scl/core/ui';
import { userActor } from '../../../core/user-actor.test-kit';
import { testCallers } from '../../peer-review/stories/peer-review-dmg.test-kit';
import {
  dmgDispatch,
  streamView,
} from '../../streams/stories/stream-dmg.test-kit';
import {
  type LegacyStudent,
  studentAnswers,
} from '../../streams/stories/student-dmg.test-kit';
import { ProgressStory } from './progress';

describe('ProgressStory', () => {
  const studentActor = userActor({
    uuid: '11111111-1111-4111-8111-aaaaaaaab004',
    name: 'Студент',
    telegramId: 123,
    roles: ['GUEST'],
  });

  const session: BotSession = {
    dialog: { path: 'learning/progress', seq: 1 },
  };
  const STREAM_ID = '11111111-1111-1111-1111-111111111111';
  const STEP1_ID = '22222222-2222-2222-2222-222222222222';
  const STEP2_ID = '33333333-3333-3333-3333-333333333333';

  const mockStudent = {
    uuid: 'student-uuid',
    streamId: STREAM_ID,
    userId: '11111111-1111-4111-8111-aaaaaaaab004',
    status: 'active',
    currentStepId: STEP1_ID,
    steps: [
      { stepId: STEP1_ID, status: 'completed' },
      { stepId: STEP2_ID, status: 'completed' },
    ],
  };

  const mockStream = {
    uuid: STREAM_ID,
    title: 'Python Basic',
    description: 'Курс',
    status: 'active',
    startDate: Date.parse('2026-06-01T00:00:00.000Z'),
    contentSnapshot: [
      {
        projectId: 'proj-1',
        projectTitle: 'Основы',
        lessons: [
          {
            lessonId: 'lesson-1',
            lessonTitle: 'Введение',
            stepIds: [STEP1_ID, STEP2_ID],
          },
        ],
      },
    ],
  };

  function makeStory(overrides: Partial<LegacyStudent> = {}) {
    const student = { ...mockStudent, ...overrides } as LegacyStudent;

    const story = new ProgressStory();
    story.init({
      appApi: {
        dispatch: dmgDispatch({
          getStream: () => streamView(mockStream),
          ...studentAnswers(student, mockStream.contentSnapshot),
        }),
      },
      callers: testCallers,
    } as never);
    return { story };
  }

  test('progress:{streamId} — экран общего прогресса', async () => {
    const { story } = makeStory();

    const response = await story.handleCallback(
      `progress:${STREAM_ID}`,
      studentActor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    const text = String(response.screen?.text);
    expect(text).toContain('Мой прогресс');
    expect(text).toContain('Python Basic');
    expect(text).toContain('Общий прогресс:');
    expect(text).toContain('Пройдено шагов:');
    expect(text).toContain('Проекты курса:');
  });

  test('progress:{streamId} — подробные метрики студента (текущий этап и темп)', async () => {
    const { story } = makeStory();

    const response = await story.handleCallback(
      `progress:${STREAM_ID}`,
      studentActor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    const text = String(response.screen?.text);
    expect(text).toContain('Текущий этап:');
    expect(text).toContain('Основы');
    expect(text).toContain('Введение');
    expect(text).toContain('Темп и усидчивость:');
  });

  test('progress:{streamId} — кнопки «Назад к учёбе» и «Главное меню»', async () => {
    const { story } = makeStory();

    const response = await story.handleCallback(
      `progress:${STREAM_ID}`,
      studentActor,
      session,
    );

    const btns = response.screen?.keyboard?.rows.flat() ?? [];
    const backBtn = btns.find((b) => b.text.includes('Назад к учёбе'));
    expect(backBtn?.code).toBe('hub:my-study');
    expect(
      btns.some(
        (b) => b.text.includes('Главное меню') && b.code === 'app:main-menu',
      ),
    ).toBe(true);
  });

  test('progress:{streamId} — несовпадение streamId → ошибка', async () => {
    const { story } = makeStory();

    const response = await story.handleCallback(
      'progress:wrong-stream',
      studentActor,
      session,
    );

    expect(String(response.screen?.text)).toContain('не соответствует');
  });

  test('progress:{streamId} — дни в обучении считаются от now() (часы приложения)', async () => {
    const { story } = makeStory({
      enrolledAt: Date.parse('2026-06-01T12:00:00.000Z'),
    });
    const clock = spyOn(Shared, 'now').mockImplementation(
      () => new Date('2026-06-11T12:00:00.000Z'),
    );
    try {
      const response = await story.handleCallback(
        `progress:${STREAM_ID}`,
        studentActor,
        session,
      );
      expect(String(response.screen?.text)).toContain('\\(10 дн\\.\\)');
    } finally {
      clock.mockRestore();
    }
  });
});
