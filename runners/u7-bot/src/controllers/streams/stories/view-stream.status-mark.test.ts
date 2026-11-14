import { describe, expect, test } from 'bun:test';
import type { BotSession } from '@u7-scl/core/ui';
import { assertDialogResponseMarkdownSafe } from '@u7-scl/core/ui';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { userActor } from '../../../core/user-actor.test-kit';
import { dmgDispatch } from '../../courses/stories/course-dmg.test-kit';
import { testCallers } from '../../peer-review/stories/peer-review-dmg.test-kit';
import { streamView } from './stream-dmg.test-kit';
import { ViewStreamStory } from './view-stream.story';

// Ф4а, сценарий 10 (ментор): тот, кому API курса отдаёт неопубликованное
// (ментор потока, роль MENTOR — решение Нурболата), видит отметку статуса:
// `🚧 Черновик` / `🗄 В архиве` в заголовке карточки шага, значок `🚧` / `🗄`
// префиксом в кнопке шага. Отметка зависит от `status` в ответе UC (DOM-18),
// published — без отметки. Студенческий путь — в learning/stories/*.test.ts.

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

const stepRow = (uuid: string, description: string, status: string) => ({
  uuid,
  description,
  status,
});

function makeStory(
  steps: Record<string, { description: string; status: string }>,
) {
  const story = new ViewStreamStory();
  story.init({
    appApi: {
      dispatch: dmgDispatch(
        {
          getStream: () =>
            streamView({
              uuid: STREAM_ID,
              contentSnapshot: snapshot,
              canManage: true,
            }),
          getStepsByLessons: () => ({
            'lesson-1': Object.entries(steps).map(([uuid, s]) =>
              stepRow(uuid, s.description, s.status),
            ),
          }),
          getStep: (input) => {
            const id = (input as { stepId: string }).stepId;
            return {
              uuid: id,
              moduleId: 'mod-1',
              kind: 'text',
              description: steps[id]?.description ?? '',
              content: 'Тело шага',
              status: steps[id]?.status ?? 'published',
              createdAt: 0,
            };
          },
        },
        MODULES,
      ),
    },
    callers: testCallers,
  } as never);
  return story;
}

const steps = {
  'step-1': { description: 'Опубликованный', status: 'published' },
  'step-2': { description: 'Рабочий', status: 'draft' },
  'step-3': { description: 'Старый', status: 'archived' },
};

describe('ViewStreamStory — отметка статуса для ментора (Ф4а)', () => {
  test('уровень урока: кнопки draft/archived шагов с 🚧/🗄 префиксом, published — без отметки', async () => {
    const response = await makeStory(steps).handleCallback(
      `prog:${STREAM_ID}:lesson:lesson-1`,
      mentorActor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    const texts =
      response.screen?.keyboard?.rows.flat().map((b) => b.text) ?? [];
    const draft = texts.find((t) => t.includes('Рабочий'));
    const archived = texts.find((t) => t.includes('Старый'));
    const published = texts.find((t) => t.includes('Опубликованный'));
    expect(draft).toContain('🚧');
    expect(archived).toContain('🗄');
    expect(published).toBeDefined();
    expect(published).not.toContain('🚧');
    expect(published).not.toContain('🗄');
  });

  test('карточка draft-шага: заголовок с «🚧 Черновик»', async () => {
    const response = await makeStory(steps).handleCallback(
      `prog:${STREAM_ID}:step:step-2`,
      mentorActor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    const text = String(response.screen?.text);
    expect(text).toContain('Тело шага');
    expect(text).toContain('🚧 Черновик');
  });

  test('карточка archived-шага: «🗄 В архиве»', async () => {
    const response = await makeStory(steps).handleCallback(
      `prog:${STREAM_ID}:step:step-3`,
      mentorActor,
      session,
    );

    expect(String(response.screen?.text)).toContain('🗄 В архиве');
  });

  test('карточка опубликованного шага — без отметки', async () => {
    const response = await makeStory(steps).handleCallback(
      `prog:${STREAM_ID}:step:step-1`,
      mentorActor,
      session,
    );

    const text = String(response.screen?.text);
    expect(text).toContain('Тело шага');
    expect(text).not.toContain('Черновик');
    expect(text).not.toContain('В архиве');
    expect(text).not.toContain('🚧');
    expect(text).not.toContain('🗄');
  });
});
