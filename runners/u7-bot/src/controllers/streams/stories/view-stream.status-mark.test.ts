import { describe, expect, test } from 'bun:test';
import type { BotSession } from '@u7-scl/core/ui';
import { assertDialogResponseMarkdownSafe } from '@u7-scl/core/ui';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import type { Command } from 'dmg-core';
import { userActor } from '../../../core/user-actor.test-kit';
import { dmgDispatch } from '../../courses/stories/course-dmg.test-kit';
import { testCallers } from '../../peer-review/stories/peer-review-dmg.test-kit';
import { streamView } from './stream-dmg.test-kit';
import { ViewStreamStory } from './view-stream.story';

// Пересмотр Ф4а («Мои потоки», ментор потока): программа и тело шага — по
// снимку потока через `getStreamStep` / `getStreamLessonSteps` (правила
// потока), курсовые `getStep` / `getStepsByLessons` не вызываются. Снимок — не
// каталог: метки статуса («🚧»/«🗄», «Черновик»/«В архиве») нет даже у шага,
// снятого с публикации. Файл назван по прежнему сценарию 10 (метка убрана).

const MODULES = [CourseModuleDef, StreamModuleDef];
const STREAM_ID = '11111111-1111-4111-8111-111111111111';
const session: BotSession = { dialog: { path: 'stream/view-stream', seq: 2 } };

const mentorActor = userActor({
  uuid: '11111111-1111-4111-8111-aaaaaaaab0a1',
  name: 'Ментор',
  telegramId: 321,
  roles: ['MENTOR'],
});

const snapshot = [
  {
    projectId: 'proj-1',
    projectTitle: 'Проект',
    lessons: [
      {
        lessonId: 'lesson-1',
        lessonTitle: 'Урок',
        stepIds: ['step-1', 'step-2', 'step-3'],
      },
    ],
  },
];

const steps = {
  'step-1': { description: 'Опубликованный', status: 'published' },
  'step-2': { description: 'Рабочий', status: 'draft' },
  'step-3': { description: 'Старый', status: 'archived' },
};

function makeStory() {
  const dispatch = dmgDispatch(
    {
      getStream: () =>
        streamView({
          uuid: STREAM_ID,
          contentSnapshot: snapshot,
          canManage: true,
        }),
      getStreamLessonSteps: () => ({
        'lesson-1': Object.entries(steps).map(([uuid, s]) => ({
          uuid,
          ...s,
        })),
      }),
      getStreamStep: (input) => {
        const id = (input as { stepId: string }).stepId;
        const step = steps[id as keyof typeof steps];
        return {
          uuid: id,
          moduleId: 'mod-1',
          kind: 'text',
          description: step?.description ?? '',
          content: 'Тело шага',
          status: step?.status ?? 'published',
          createdAt: 0,
        };
      },
      // Ответы-ловушки: прежний путь через API курса не должен вызываться.
      getStepsByLessons: () => ({}),
      getStep: () => {
        throw new Error('getStep курса не должен вызываться');
      },
    },
    MODULES,
  );
  const story = new ViewStreamStory();
  story.init({ appApi: { dispatch }, callers: testCallers } as never);
  return { story, dispatch };
}

const called = (dispatch: ReturnType<typeof makeStory>['dispatch']) =>
  dispatch.mock.calls.map(
    ([, command]: [unknown, Command, unknown]) => command,
  );

describe('ViewStreamStory — программа потока по снимку, без метки статуса (пересмотр Ф4а)', () => {
  test('уровень урока: кнопки шагов из getStreamLessonSteps, без 🚧/🗄', async () => {
    const { story, dispatch } = makeStory();

    const response = await story.handleCallback(
      `prog:${STREAM_ID}:lesson:lesson-1`,
      mentorActor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    const texts =
      response.screen?.keyboard?.rows.flat().map((b) => b.text) ?? [];
    for (const title of ['Опубликованный', 'Рабочий', 'Старый']) {
      expect(texts.find((t) => t.includes(title))).toBeDefined();
    }
    expect(texts.join('\n')).not.toContain('🚧');
    expect(texts.join('\n')).not.toContain('🗄');
    expect(
      called(dispatch).find((c) => c.uc === 'getStreamLessonSteps')?.input,
    ).toEqual({
      streamId: STREAM_ID,
      lessonIds: ['lesson-1'],
    });
  });

  test('уровень проекта: описания шагов — через getStreamLessonSteps по урокам снимка', async () => {
    const { story, dispatch } = makeStory();

    await story.handleCallback(
      `prog:${STREAM_ID}:project:proj-1`,
      mentorActor,
      session,
    );

    expect(
      called(dispatch).find((c) => c.uc === 'getStreamLessonSteps')?.input,
    ).toEqual({
      streamId: STREAM_ID,
      lessonIds: ['lesson-1'],
    });
  });

  test('карточка шага снимка (draft) открывается через getStreamStep с телом и без отметки', async () => {
    const { story, dispatch } = makeStory();

    const response = await story.handleCallback(
      `prog:${STREAM_ID}:step:step-2`,
      mentorActor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    const text = String(response.screen?.text);
    expect(text).toContain('Тело шага');
    expect(text).not.toContain('Черновик');
    expect(text).not.toContain('🚧');
    expect(
      called(dispatch).find((c) => c.uc === 'getStreamStep')?.input,
    ).toEqual({
      streamId: STREAM_ID,
      stepId: 'step-2',
    });
  });

  test('карточка archived-шага снимка — без «В архиве»', async () => {
    const { story } = makeStory();

    const response = await story.handleCallback(
      `prog:${STREAM_ID}:step:step-3`,
      mentorActor,
      session,
    );

    const text = String(response.screen?.text);
    expect(text).toContain('Тело шага');
    expect(text).not.toContain('В архиве');
    expect(text).not.toContain('🗄');
  });

  test('getStep и getStepsByLessons курса не вызываются ни на одном уровне', async () => {
    const { story, dispatch } = makeStory();

    for (const level of ['project:proj-1', 'lesson:lesson-1', 'step:step-1']) {
      await story.handleCallback(
        `prog:${STREAM_ID}:${level}`,
        mentorActor,
        session,
      );
    }

    const names = called(dispatch).map((c) => c.uc);
    expect(names).not.toContain('getStep');
    expect(names).not.toContain('getStepsByLessons');
  });
});
