import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReviewAr, type ReviewState } from '@u7-scl/domain/peer-review';
import { VersionConflict } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';
import { ValiError } from 'valibot';
import {
  CAMPAIGN_ID,
  HOUR,
  IDS,
  legacyReview,
  review,
  T0,
} from '../review/review.fixture';
import { ReviewJsonRepo } from './review.json-repo';

// Перенос `infra/db/review-json-repo.test.ts` (8) на VersionedRepository
// + legacy-записи, строгий разбор, фильтр ReviewFilter.
// Только временный каталог и чтение фикстуры `data/fixtures` (запись — никогда).

const tmpDir = mkdtempSync(join(tmpdir(), 'review-json-repo-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));
const path = (name: string) => join(tmpDir, name);

const CAMPAIGN_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02';
const AUTHOR2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccc02';
const R = (n: number) => `11111111-1111-4111-8111-11111111111${n}`;

/** Новый агрегат через `create` (ещё не записан). */
function make(over: Partial<ReviewState> = {}): ReviewAr {
  const s = review({ direction: 'student_student', ...over });
  return expectOk(
    ReviewAr.create(
      {
        uuid: s.uuid,
        campaignId: s.campaignId,
        scopeId: s.scopeId,
        authorId: s.authorId,
        direction: s.direction,
        ...(s.authorOutcome ? { authorOutcome: s.authorOutcome } : {}),
        recipientId: s.recipientId,
        text: s.text,
      },
      s.createdAt,
    ),
  );
}

async function repoWith(name: string, rows: unknown[]) {
  await Bun.write(path(name), JSON.stringify(rows));
  return new ReviewJsonRepo(path(name));
}

const uuids = (ars: ReviewAr[]) => ars.map((a) => a.uuid).sort();
const raw = async (name: string) =>
  (await Bun.file(path(name)).json()) as ReviewState[];

describe('ReviewJsonRepo: save и поиск', () => {
  test('save + findByPair/findById: round-trip нового формата (числа)', async () => {
    const repo = new ReviewJsonRepo(path('roundtrip.json'));
    const ar = make({ uuid: R(1) });
    await repo.save(ar);

    expect(
      (await repo.findByPair(CAMPAIGN_ID, IDS.alice, IDS.mentor))?.snapshot(),
    ).toEqual(ar.snapshot());
    expect((await repo.findById(R(1)))?.snapshot()).toEqual(ar.snapshot());
    expect(
      await repo.findByPair(CAMPAIGN_ID, IDS.alice, IDS.bob),
    ).toBeUndefined();
    expect(await repo.findById(R(2))).toBeUndefined();
    const [row] = await raw('roundtrip.json');
    expect(typeof row?.createdAt).toBe('number');
    expect(typeof row?.updatedAt).toBe('number');
  });

  test('повторный save той же пары (тот же uuid) — перезапись текста, версия растёт, дубля нет', async () => {
    const repo = new ReviewJsonRepo(path('overwrite.json'));
    await repo.save(make({ uuid: R(1) }));

    const loaded = await repo.findById(R(1));
    if (!loaded) throw new Error('запись не найдена');
    expectOk(
      loaded.overwrite('Перезаписанный отзыв после размышлений', T0 + 5 * HOUR),
    );
    await repo.save(loaded);

    const stored = await repo.findByPair(CAMPAIGN_ID, IDS.alice, IDS.mentor);
    expect(stored?.text).toBe('Перезаписанный отзыв после размышлений');
    expect(stored?.snapshot().version).toBe(1);
    expect(stored?.snapshot().updatedAt).toBe(T0 + 5 * HOUR);
    expect(await raw('overwrite.json')).toHaveLength(1);
  });

  test('дубль пары (кампания, автор, адресат) с другим uuid — VersionConflict, файл не изменён', async () => {
    const repo = new ReviewJsonRepo(path('unique-pair.json'));
    await repo.save(make({ uuid: R(1) }));
    const before = await Bun.file(path('unique-pair.json')).text();

    await expect(repo.save(make({ uuid: R(2) }))).rejects.toBeInstanceOf(
      VersionConflict,
    );

    expect(await Bun.file(path('unique-pair.json')).text()).toBe(before);
  });

  test('findByCampaignAndAuthor: только отзывы автора в кампании', async () => {
    const repo = await repoWith('by-author.json', [
      review({ uuid: R(1), recipientId: IDS.mentor }),
      review({ uuid: R(2), recipientId: IDS.bob }),
      review({ uuid: R(3), authorId: AUTHOR2 }),
      review({ uuid: R(4), campaignId: CAMPAIGN_B }),
    ]);
    expect(
      uuids(await repo.findByCampaignAndAuthor(CAMPAIGN_ID, IDS.alice)),
    ).toEqual([R(1), R(2)]);
  });

  test('findByScope: все отзывы скоупа', async () => {
    const repo = await repoWith('by-scope.json', [
      review({ uuid: R(1) }),
      review({ uuid: R(3), campaignId: CAMPAIGN_B, recipientId: IDS.bob }),
      review({ uuid: R(2), scopeId: IDS.scope2, authorId: AUTHOR2 }),
    ]);
    expect(uuids(await repo.findByScope(IDS.scope))).toEqual([R(1), R(3)]);
  });
});

describe('ReviewJsonRepo: findByScopes и фильтр', () => {
  const rows = () => [
    review({
      uuid: R(1),
      direction: 'student_mentor',
      recipientId: IDS.mentor,
    }),
    review({
      uuid: R(2),
      scopeId: IDS.scope2,
      authorId: AUTHOR2,
      direction: 'student_student',
      recipientId: IDS.bob,
    }),
    review({
      uuid: R(3),
      campaignId: CAMPAIGN_B,
      direction: 'student_student',
      recipientId: IDS.bob,
    }),
    review({ uuid: R(4), scopeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb09' }),
  ];

  test('по списку скоупов без фильтра', async () => {
    const repo = await repoWith('scopes.json', rows());
    expect(uuids(await repo.findByScopes([IDS.scope, IDS.scope2]))).toEqual([
      R(1),
      R(2),
      R(3),
    ]);
  });

  test.each([
    ['direction', { direction: 'student_student' as const }, [R(2), R(3)]],
    ['recipientId', { recipientId: IDS.bob }, [R(2), R(3)]],
    ['campaignId', { campaignId: CAMPAIGN_B }, [R(3)]],
    [
      'direction + recipientId + campaignId (И)',
      {
        direction: 'student_student' as const,
        recipientId: IDS.bob,
        campaignId: CAMPAIGN_ID,
      },
      [R(2)],
    ],
  ])('фильтр %s', async (_l, filter, expected) => {
    const repo = await repoWith('scopes-filter.json', rows());
    expect(
      uuids(await repo.findByScopes([IDS.scope, IDS.scope2], filter)),
    ).toEqual(expected);
  });

  test('фильтр не расширяет выборку за пределы скоупов', async () => {
    const repo = await repoWith('scopes-narrow.json', rows());
    expect(
      uuids(await repo.findByScopes([IDS.scope], { recipientId: IDS.bob })),
    ).toEqual([R(3)]);
  });

  test('findByRecipient без фильтра: все отзывы адресату, где бы он ни был адресатом', async () => {
    const repo = await repoWith('recipient.json', rows());
    expect(uuids(await repo.findByRecipient(IDS.bob))).toEqual([R(2), R(3)]);
  });

  test.each([
    ['direction', { direction: 'student_mentor' as const }, [] as string[]],
    ['campaignId', { campaignId: CAMPAIGN_B }, [R(3)]],
    ['recipientId другой — пусто (И)', { recipientId: IDS.mentor }, []],
    ['recipientId тот же', { recipientId: IDS.bob }, [R(2), R(3)]],
  ])('findByRecipient: фильтр %s', async (_l, filter, expected) => {
    const repo = await repoWith('recipient-filter.json', rows());
    expect(uuids(await repo.findByRecipient(IDS.bob, filter))).toEqual(
      expected,
    );
  });
});

describe('ReviewJsonRepo: legacy-записи', () => {
  test('ISO без зоны → число UTC, updatedAt = createdAt, version = 0', async () => {
    const row = legacyReview();
    const repo = await repoWith('legacy.json', [row]);
    const state = (await repo.findById(row.uuid))?.snapshot();
    expect(state?.createdAt).toBe(Date.UTC(2026, 8, 20, 11));
    expect(state?.updatedAt).toBe(Date.UTC(2026, 8, 20, 11));
    expect(state?.version).toBe(0);
  });
});

describe('ReviewJsonRepo: невалидная запись (строгий разбор)', () => {
  test('битая запись — ValiError на чтении и записи, файл не изменён', async () => {
    const text = JSON.stringify([legacyReview(), { uuid: 'not-a-uuid' }]);
    await Bun.write(path('broken.json'), text);
    const repo = new ReviewJsonRepo(path('broken.json'));

    await expect(repo.findByScope(IDS.scope)).rejects.toBeInstanceOf(ValiError);
    await expect(repo.findByRecipient(IDS.mentor)).rejects.toBeInstanceOf(
      ValiError,
    );
    await expect(repo.save(make({ uuid: R(1) }))).rejects.toBeInstanceOf(
      ValiError,
    );
    expect(await Bun.file(path('broken.json')).text()).toBe(text);
  });

  test('файла нет — пусто, поиск не падает и файл не создаёт', async () => {
    const repo = new ReviewJsonRepo(path('absent.json'));
    expect(await repo.findById(R(1))).toBeUndefined();
    expect(await repo.findByScope(IDS.scope)).toEqual([]);
    expect(await repo.findByScopes([IDS.scope])).toEqual([]);
    expect(await repo.findByRecipient(IDS.mentor)).toEqual([]);
    expect(await Bun.file(path('absent.json')).exists()).toBe(false);
  });
});

// Фикстуры только читаются: репозиторий над копией во временном каталоге.
describe('ReviewJsonRepo: фикстуры data/fixtures (чтение)', () => {
  const fixture = join(
    import.meta.dir,
    '../../../../data/fixtures/peer-review/reviews.json',
  );
  let rows: { uuid: string; scopeId: string }[];

  beforeAll(async () => {
    rows = await Bun.file(fixture).json();
    await Bun.write(path('fixture-copy.json'), await Bun.file(fixture).text());
  });

  test('все записи фикстуры читаются новой схемой, version 0, updatedAt = createdAt', async () => {
    const repo = new ReviewJsonRepo(path('fixture-copy.json'));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const state = (await repo.findById(row.uuid))?.snapshot();
      expect(state?.uuid).toBe(row.uuid);
      expect(state?.version).toBe(0);
      expect(typeof state?.createdAt).toBe('number');
    }
  });

  test('save новой рецензии поверх копии фикстуры не теряет существующие', async () => {
    const repo = new ReviewJsonRepo(path('fixture-copy.json'));
    await repo.save(make({ uuid: R(1), campaignId: CAMPAIGN_B }));
    for (const row of rows) {
      expect((await repo.findById(row.uuid))?.uuid).toBe(row.uuid);
    }
  });
});
