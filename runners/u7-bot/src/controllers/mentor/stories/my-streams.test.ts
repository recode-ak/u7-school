import { describe, expect, test } from 'bun:test';
import type { BotSession, DialogResponse } from '@u7-scl/core/ui';
import { assertDialogResponseMarkdownSafe } from '@u7-scl/core/ui';
import { ListStreamsUcDef } from '@u7-scl/domain/stream/contract';
import type { U7BotActor } from '../../../core/u7-bot-app-meta';
import { userActor } from '../../../core/user-actor.test-kit';
import { testCallers } from '../../peer-review/stories/peer-review-dmg.test-kit';
import { dmgDispatch } from '../../streams/stories/stream-dmg.test-kit';
import { MyStreamsStory } from './my-streams';

function mentorActor(): U7BotActor {
  return userActor({
    uuid: '11111111-1111-4111-8111-aaaaaaaab010',
    name: 'Ментор',
    telegramId: 123,
    roles: ['MENTOR'],
  });
}

const session: BotSession = {
  dialog: { path: 'mentor/my-streams', seq: 2 },
};

const mockStreams = [
  {
    uuid: 's1',
    title: 'Поток 1',
    status: 'enrollment',
    mentorId: '11111111-1111-4111-8111-aaaaaaaab010',
  },
  {
    uuid: 's2',
    title: 'Поток 2',
    status: 'active',
    mentorId: '11111111-1111-4111-8111-aaaaaaaab010',
  },
  {
    uuid: 's3',
    title: 'Поток 3',
    status: 'completed',
    mentorId: '11111111-1111-4111-8111-aaaaaaaab010',
  },
  {
    uuid: 's4',
    title: 'Поток 4',
    status: 'archived',
    mentorId: '11111111-1111-4111-8111-aaaaaaaab010',
  },
  {
    uuid: 's5',
    title: 'Чужой поток',
    status: 'active',
    mentorId: 'other-mentor',
  },
];

/** Ответ listStreams по умолчанию — как UC: только потоки запрошенного ментора. */
const ownStreams = (input: unknown) =>
  mockStreams.filter((s) => s.mentorId === (input as ListInput).mentorId);

type ListInput = { mentorId?: string };

function setupStory(
  answer: (input: unknown) => unknown = ownStreams,
): MyStreamsStory & { dispatch: ReturnType<typeof dmgDispatch> } {
  const story = new MyStreamsStory();
  const dispatch = dmgDispatch({ listStreams: answer });
  story.init({ appApi: { dispatch }, callers: testCallers } as never);
  return Object.assign(story, { dispatch });
}

function flat(response: DialogResponse) {
  return {
    texts: (response.screen?.keyboard?.rows ?? []).flat().map((b) => b.text),
    codes: (response.screen?.keyboard?.rows ?? []).flat().map((b) => b.code),
  };
}

describe('MyStreamsStory — контракт «Диалог и Экран»', () => {
  // ── list: дефолт (только enrollment + active) ──

  test('list: показывает enrollment + active с точными кодами кнопок', async () => {
    const story = setupStory();
    const response = await story.handleCallback('list', mentorActor(), session);
    assertDialogResponseMarkdownSafe(response);

    const text = String(response.screen?.text);
    expect(text).toContain('Мои потоки');
    expect(text).toContain('идёт набор');

    const { texts, codes } = flat(response);
    expect(texts).toContain('🟡 Поток 1');
    expect(texts).toContain('🔵 Поток 2');
    expect(texts).not.toContain('🟢 Поток 3');
    expect(texts).not.toContain('⚫ Поток 4');
    // Чужой поток не показывается
    expect(texts).not.toContain('Чужой поток');

    // Кнопки потоков ведут в view-stream-mentor
    expect(codes).toContain('view-stream-mentor:view:s1');
    expect(codes).toContain('view-stream-mentor:view:s2');

    // Переключатели фильтров (инвентаризация)
    expect(codes).toContain('my-streams:list:archived:1');
    expect(codes).toContain('my-streams:list:completed:1');
    expect(texts).toContain('⚫ Вкл. архивированные');
    expect(texts).toContain('🟢 Вкл. завершённые');

    // «Назад» — в подменю ментора
    expect(codes).toContain('submenu:start');
    expect(texts).toContain('🔙 Назад');
  });

  test('list:completed:1 — завершённые видны, переключатель парный', async () => {
    const story = setupStory();
    const response = await story.handleCallback(
      'list:completed:1',
      mentorActor(),
      session,
    );
    const { texts, codes } = flat(response);
    expect(texts).toContain('🟢 Поток 3');
    expect(texts).not.toContain('⚫ Поток 4');
    expect(codes).toContain('my-streams:list:completed:1:archived:1');
    expect(texts).toContain('⚫ Вкл. архивированные');
  });

  test('list:archived:1 — архив виден, переключатель парный', async () => {
    const story = setupStory();
    const response = await story.handleCallback(
      'list:archived:1',
      mentorActor(),
      session,
    );
    const { texts, codes } = flat(response);
    expect(texts).toContain('⚫ Поток 4');
    expect(texts).not.toContain('🟢 Поток 3');
    expect(codes).toContain('my-streams:list:completed:1:archived:1');
    expect(texts).toContain('🟢 Вкл. завершённые');
  });

  test('list:completed:1:archived:1 — оба включены, переключателей нет', async () => {
    const story = setupStory();
    const response = await story.handleCallback(
      'list:completed:1:archived:1',
      mentorActor(),
      session,
    );
    const { texts } = flat(response);
    expect(texts).toContain('🟢 Поток 3');
    expect(texts).toContain('⚫ Поток 4');
    expect(texts.some((t) => t.includes('Вкл.'))).toBe(false);
  });

  test('list: потоки запрашиваются UC listStreams с mentorId актора', async () => {
    const story = setupStory();
    await story.handleCallback('list', mentorActor(), session);
    expect(story.dispatch.mock.calls.map(([, command]) => command)).toEqual([
      ListStreamsUcDef.command({
        mentorId: '11111111-1111-4111-8111-aaaaaaaab010',
      }),
    ]);
  });

  // ── Пустой список ──

  test('пустой список — «У вас пока нет потоков» + Назад', async () => {
    const story = setupStory(() => []);
    const response = await story.handleCallback('list', mentorActor(), session);
    expect(String(response.screen?.text)).toContain('У вас пока нет потоков');
    const { texts, codes } = flat(response);
    expect(texts).toContain('🔙 Назад');
    expect(codes).toContain('submenu:start');
  });

  // ── Ошибка API ──

  test('ошибка API — экран «Не удалось загрузить список потоков.»', async () => {
    const story = setupStory(() => {
      throw new Error('API error');
    });
    const response = await story.handleCallback('list', mentorActor(), session);
    expect(String(response.screen?.text)).toContain('Не удалось загрузить');
  });
});
