import { describe, expect, test } from 'bun:test';
import {
  assertDialogResponseMarkdownSafe,
  type BotSession,
  type DialogResponse,
} from '@u7-scl/core/ui';
import { userActor } from '../../../core/user-actor.test-kit';
import { streamView } from '../../streams/stories/stream-dmg.test-kit';
import { peerReviewDispatch, testCallers } from './peer-review-dmg.test-kit';
import { ScopeReviewsStory } from './scope-reviews.story';

/**
 * S07 — просмотр отзывов потока (только чтение, пагинация).
 *
 * Формат блока (ui-spec S07), группировка по адресатам — порядок DS:
 *   👤 {Имя} (роль адресата):
 *   «{текст}» — {автор} (роль автора · лейбл исхода)
 * Лейбл исхода — только у автора-студента (authorOutcome); автор-ментор
 * — без лейбла. Роли выводятся из direction.
 */

const SCOPE_ID = 'cccccccc-0000-0000-0000-000000000001';
const MENTOR_ID = 'dddddddd-0000-0000-0000-000000000001';
const STUDENT_1 = 'eeeeeeee-0000-0000-0000-000000000001';
const STUDENT_2 = 'eeeeeeee-0000-0000-0000-000000000002';
const AUTHOR_1 = 'ffffffff-0000-0000-0000-000000000001';
const AUTHOR_2 = 'ffffffff-0000-0000-0000-000000000002';

const session: BotSession = {
  dialog: { path: 'peer-review/scope-reviews', seq: 1 },
};
const actor = userActor({
  uuid: '11111111-1111-4111-8111-aaaaaaaab007',
  name: 'Читатель',
  telegramId: 123,
  roles: ['GUEST'],
});

/** Снимок отзыва — как отдаёт list-scope-reviews (scope-reviews-ds). */
interface Snapshot {
  reviewId: string;
  scopeId: string;
  authorId: string;
  direction: 'student_student' | 'student_mentor' | 'mentor_student';
  authorOutcome?:
    | 'completed_passed'
    | 'completed_not_passed'
    | 'dropped'
    | 'never_started';
  text: string;
  createdAt: number;
}

interface Group {
  recipientId: string;
  reviews: Snapshot[];
}

/** Длинный текст отзыва (n — номер, чтобы блоки различались). */
function longText(n: number, pad = 700): string {
  return `Отзыв номер ${n}. ${'а'.repeat(pad)}`;
}

/** appApi-мок: listScopeReviews и getStream (DMG), get-users-by-ids. */
function makeAppApi(groups: Group[], opts: { emptyNames?: boolean } = {}) {
  return {
    dispatch: peerReviewDispatch({
      listScopeReviews: (input) => ({
        scopeIds: (input as { scopeIds: string[] }).scopeIds,
        recipients: groups,
      }),
      getStream: (input) =>
        streamView({
          uuid: (input as { streamId: string }).streamId,
          title: 'Поток решения',
        }),
      getUsersByIds: () => {
        if (opts.emptyNames) return [];
        return [
          { uuid: MENTOR_ID, name: 'Марина' },
          { uuid: STUDENT_1, name: 'Борис' },
          { uuid: STUDENT_2, name: 'Вера' },
          { uuid: AUTHOR_1, name: 'Анна' },
          { uuid: AUTHOR_2, name: 'Глеб' },
        ];
      },
    }),
  };
}

function makeStory(groups: Group[], opts?: { emptyNames?: boolean }) {
  const appApi = makeAppApi(groups, opts);
  const story = new ScopeReviewsStory();
  story.init({ appApi, callers: testCallers } as never);
  return { story, appApi };
}

function btnsOf(r: DialogResponse) {
  return (r.screen?.keyboard?.rows ?? []).flat();
}

function findBtn(r: DialogResponse, needle: string) {
  return btnsOf(r).find((b) => b.text.includes(needle)) ?? null;
}

/** Отзывы: n отзывов об адресате-студенте, авторы чередуются. */
function manyReviews(n: number, textPad = 700): Group[] {
  const reviews: Snapshot[] = Array.from({ length: n }, (_, i) => ({
    reviewId: `11111111-0000-0000-0000-${String(i).padStart(12, '0')}`,
    scopeId: SCOPE_ID,
    authorId: i % 2 === 0 ? AUTHOR_1 : AUTHOR_2,
    direction: 'student_student',
    authorOutcome: 'completed_passed',
    text: longText(i + 1, textPad),
    createdAt: Date.UTC(2026, 8, 20 + (i % 10), 10),
  }));
  return [{ recipientId: STUDENT_1, reviews }];
}

describe('ScopeReviewsStory — формат экрана S07', () => {
  test('блок: адресат + роль, текст, автор + роль + лейбл исхода (authorOutcome)', async () => {
    const groups: Group[] = [
      {
        recipientId: STUDENT_1,
        reviews: [
          {
            reviewId: '11111111-0000-0000-0000-000000000001',
            scopeId: SCOPE_ID,
            authorId: AUTHOR_1,
            direction: 'student_student',
            authorOutcome: 'completed_passed',
            text: 'Отличный товарищ по команде',
            createdAt: Date.UTC(2026, 8, 21, 10, 0),
          },
        ],
      },
    ];
    const { story } = makeStory(groups);

    const response = await story.handleCallback(
      `view:${SCOPE_ID}`,
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    const text = String(response.screen?.text ?? '');

    expect(text).toContain('💬 *Отзывы* — поток «Поток решения»');
    expect(text).toContain('👤 Борис \\(студент\\):');
    expect(text).toContain(
      '«Отличный товарищ по команде» — Анна \\(студент · завершил и прошел\\)',
    );
  });

  test('направление student_mentor: адресат — ментор; исход автора — свой лейбл', async () => {
    const groups: Group[] = [
      {
        recipientId: MENTOR_ID,
        reviews: [
          {
            reviewId: '11111111-0000-0000-0000-000000000002',
            scopeId: SCOPE_ID,
            authorId: AUTHOR_1,
            direction: 'student_mentor',
            authorOutcome: 'never_started',
            text: 'Ментор был на связи',
            createdAt: Date.UTC(2026, 8, 21, 11, 0),
          },
        ],
      },
    ];
    const { story } = makeStory(groups);

    const response = await story.handleCallback(
      `view:${SCOPE_ID}`,
      actor,
      session,
    );
    const text = String(response.screen?.text ?? '');

    expect(text).toContain('👤 Марина \\(ментор\\):');
    expect(text).toContain(
      '«Ментор был на связи» — Анна \\(студент · не начал\\)',
    );
  });

  test('имена: один batch-запрос get-users-by-ids с адресатами и авторами', async () => {
    const groups: Group[] = [
      {
        recipientId: STUDENT_1,
        reviews: [
          {
            reviewId: '11111111-0000-0000-0000-000000000004',
            scopeId: SCOPE_ID,
            authorId: AUTHOR_1,
            direction: 'student_student',
            text: 'текст один',
            createdAt: Date.UTC(2026, 8, 21, 10, 0),
          },
          {
            reviewId: '11111111-0000-0000-0000-000000000005',
            scopeId: SCOPE_ID,
            authorId: AUTHOR_1,
            direction: 'student_student',
            text: 'текст два',
            createdAt: Date.UTC(2026, 8, 21, 11, 0),
          },
        ],
      },
      {
        recipientId: MENTOR_ID,
        reviews: [
          {
            reviewId: '11111111-0000-0000-0000-000000000006',
            scopeId: SCOPE_ID,
            authorId: AUTHOR_2,
            direction: 'student_mentor',
            text: 'текст три',
            createdAt: Date.UTC(2026, 8, 21, 12, 0),
          },
        ],
      },
    ];
    const { story, appApi } = makeStory(groups);

    await story.handleCallback(`view:${SCOPE_ID}`, actor, session);

    const calls = appApi.dispatch.mock.calls.filter(
      ([, command]) => command.uc === 'getUsersByIds',
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1].input).toEqual({
      userIds: [STUDENT_1, AUTHOR_1, MENTOR_ID, AUTHOR_2],
    });
  });

  test('имя не найдено (batch пуст) — запасная подпись «неизвестно»', async () => {
    const groups: Group[] = [
      {
        recipientId: STUDENT_1,
        reviews: [
          {
            reviewId: '11111111-0000-0000-0000-000000000007',
            scopeId: SCOPE_ID,
            authorId: AUTHOR_1,
            direction: 'student_student',
            authorOutcome: 'completed_passed',
            text: 'текст отзыва',
            createdAt: Date.UTC(2026, 8, 21, 10, 0),
          },
        ],
      },
    ];
    const { story } = makeStory(groups, { emptyNames: true });

    const response = await story.handleCallback(
      `view:${SCOPE_ID}`,
      actor,
      session,
    );
    const text = String(response.screen?.text ?? '');

    expect(text).toContain('👤 неизвестно \\(студент\\):');
    expect(text).toContain('— неизвестно \\(студент · завершил и прошел\\)');
  });

  test('кнопка «⬅️ Назад к потоку» — мост в карточку потока', async () => {
    const { story } = makeStory(manyReviews(1, 50));

    const response = await story.handleCallback(
      `view:${SCOPE_ID}`,
      actor,
      session,
    );

    const back = findBtn(response, 'Назад к потоку');
    expect(back?.code).toBe(`stream:view-stream:view:${SCOPE_ID}`);
  });

  test('пустой список (гонка: отзывы исчезли) — заглушка с возвратом', async () => {
    const { story } = makeStory([]);

    const response = await story.handleCallback(
      `view:${SCOPE_ID}`,
      actor,
      session,
    );
    const text = String(response.screen?.text ?? '');

    expect(text).toContain('Отзывов по потоку пока нет');
    const back = findBtn(response, 'Назад к потоку');
    expect(back?.code).toBe(`stream:view-stream:view:${SCOPE_ID}`);
  });
});

describe('ScopeReviewsStory — пагинация (BotPaginator + DialogCache)', () => {
  test('длинные отзывы: ≥3 страницы из целых отзывов, полный цикл листания', async () => {
    const groups = manyReviews(16, 700);
    const { story } = makeStory(groups);

    const pageTexts: string[] = [];
    let response = await story.handleCallback(
      `view:${SCOPE_ID}`,
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    pageTexts.push(String(response.screen?.text ?? ''));

    for (let i = 0; i < 12; i++) {
      const next = findBtn(response, 'След ›');
      if (!next) break;
      const seg = next.code.split(':').pop();
      response = await story.handleCallback(
        `view:${SCOPE_ID}:${seg}`,
        actor,
        session,
      );
      assertDialogResponseMarkdownSafe(response);
      pageTexts.push(String(response.screen?.text ?? ''));
    }

    expect(pageTexts.length).toBeGreaterThanOrEqual(3);

    // Шапка и индикатор на каждой странице
    const total = pageTexts.length;
    for (let i = 0; i < total; i++) {
      expect(pageTexts[i]).toContain('Отзывы');
      expect(pageTexts[i]).toContain(`Стр\\. ${i + 1}/${total}`);
    }

    // Все 16 отзывов на местах, без потерь и дублей
    for (let i = 1; i <= 16; i++) {
      expect(pageTexts.join('\n').split(`Отзыв номер ${i}\\.`).length).toBe(2);
    }
  });

  test('запрос страницы за пределами — clamp к последней', async () => {
    const { story } = makeStory(manyReviews(8, 700));

    const response = await story.handleCallback(
      `view:${SCOPE_ID}:99`,
      actor,
      session,
    );
    const text = String(response.screen?.text ?? '');

    expect(text).toContain('Стр\\. 2/2');
    expect(findBtn(response, 'След ›')).toBeNull();
  });
});
