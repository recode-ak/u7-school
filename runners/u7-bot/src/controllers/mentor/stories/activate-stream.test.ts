import { describe, expect, mock, test } from 'bun:test';
import type { BotSession, DialogResponse } from '@u7-scl/core/ui';
import { assertDialogResponseMarkdownSafe } from '@u7-scl/core/ui';
import {
  ActivateStreamUcDef,
  StreamErrors,
} from '@u7-scl/domain/stream/contract';
import { userActor } from '../../../core/user-actor.test-kit';
import { testCallers } from '../../peer-review/stories/peer-review-dmg.test-kit';
import { dmgDispatch, refuse } from '../../streams/stories/stream-dmg.test-kit';
import { ActivateStreamStory } from './activate-stream';

const actor = userActor({
  uuid: '11111111-1111-4111-8111-aaaaaaaab013',
  name: 'Ментор',
  telegramId: 123,
  roles: ['MENTOR'],
});

const session: BotSession = {
  dialog: { path: 'mentor/activate-stream', seq: 2 },
};

function createStory(answer: () => unknown = () => ({})) {
  const story = new ActivateStreamStory();
  const dispatch = dmgDispatch({ activateStream: answer });
  const appApi = { execute: mock(async () => undefined), dispatch };
  story.init({ appApi, callers: testCallers } as never);
  return { story, appApi, dispatch };
}

describe('ActivateStreamStory (US-7) — контракт «Диалог и Экран»', () => {
  test('activate: экран «Поток запущен» с точной кнопкой назад', async () => {
    const { story, dispatch } = createStory();
    const response: DialogResponse = await story.handleCallback(
      'activate:s1',
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    expect(String(response.screen?.text)).toContain('Поток запущен');
    expect(String(response.screen?.text)).toContain('Моя учёба');
    // Точная кнопка: назад в менторскую карточку потока (не в view-stream)
    expect(response.screen?.keyboard?.rows).toEqual([
      [{ text: '⬅️ Назад к потоку', code: 'view-stream-mentor:view:s1' }],
    ]);

    // UC вызван с параметрами потока
    expect(dispatch.mock.calls.map(([, command]) => command)).toEqual([
      ActivateStreamUcDef.command({ streamId: 's1' }),
    ]);
  });

  test('activate: поток не в наборе — реплика с текстом отказа, без экрана успеха', async () => {
    const { story } = createStory(() =>
      refuse(StreamErrors.NOT_ENROLLING.code, 'conflict'),
    );
    const response = await story.handleCallback('activate:s1', actor, session);
    expect(response.notify?.kind).toBe('warn');
    expect(response.screen).toBeUndefined();
  });

  test('activate без streamId — экран «Неизвестная команда»', async () => {
    const { story } = createStory();
    const response = await story.handleCallback('activate', actor, session);
    expect(String(response.screen?.text)).toContain('Неизвестная');
  });
});
