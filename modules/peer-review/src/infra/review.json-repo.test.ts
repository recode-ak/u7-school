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

  test('дубль пары (кампания, автор, адресат) с другим uuid — save бросает, файл не изменён', async () => {
    const repo = new ReviewJsonRepo(path('unique-pair.json'));
    await repo.save(make({ uuid: R(1) }));
    const before = await Bun.file(path('unique-pair.json')).text();

    await expect(repo.save(make({ uuid: R(2) }))).rejects.toThrow();

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
    expect(await repo.findByScopes([])).toEqual([]);
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
    ['пустой фильтр', {}, [R(1), R(2), R(3)]],
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
    expect(await repo.findByRecipient(IDS.carol)).toEqual([]);
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

describe('ReviewJsonRepo: версия (D-36)', () => {
  test('create с занятым uuid — VersionConflict, файл не изменён', async () => {
    const repo = new ReviewJsonRepo(path('busy-uuid.json'));
    await repo.save(make({ uuid: R(1) }));
    const before = await Bun.file(path('busy-uuid.json')).text();

    await expect(
      repo.save(make({ uuid: R(1), recipientId: IDS.bob })),
    ).rejects.toBeInstanceOf(VersionConflict);

    expect(await Bun.file(path('busy-uuid.json')).text()).toBe(before);
  });

  test('восстановленный агрегат, записи нет — VersionConflict, файл не создан', async () => {
    const repo = new ReviewJsonRepo(path('restored-missing.json'));
    await expect(
      repo.save(ReviewAr.restore(review({ version: 1 }))),
    ).rejects.toBeInstanceOf(VersionConflict);
    expect(await Bun.file(path('restored-missing.json')).exists()).toBe(false);
  });

  test('параллельные записи разных пар не теряют друг друга', async () => {
    const repo = new ReviewJsonRepo(path('parallel.json'));
    await Promise.all([
      repo.save(make({ uuid: R(1), recipientId: IDS.mentor })),
      repo.save(make({ uuid: R(2), recipientId: IDS.bob })),
    ]);
    expect(await raw('parallel.json')).toHaveLength(2);
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

  test('updatedAt из записи (ISO) читается числом', async () => {
    const row = legacyReview({ updatedAt: '2026-09-21T08:15' });
    const repo = await repoWith('legacy-updated.json', [row]);
    const state = (await repo.findById(row.uuid))?.snapshot();
    expect(state?.updatedAt).toBe(Date.UTC(2026, 8, 21, 8, 15));
    expect(state?.createdAt).toBe(Date.UTC(2026, 8, 20, 11));
  });

  test('запись ментора без authorOutcome читается', async () => {
    const { authorOutcome: _, ...row } = legacyReview({
      direction: 'mentor_student',
      authorId: IDS.mentor,
      recipientId: IDS.alice,
    });
    const repo = await repoWith('legacy-mentor.json', [row]);
    const ar = await repo.findById(row.uuid);
    expect(ar?.direction).toBe('mentor_student');
    expect(ar?.authorOutcome).toBeUndefined();
  });

  test('legacy читается после save соседней; файл переписан в новом формате', async () => {
    const row = legacyReview();
    const repo = await repoWith('legacy-save.json', [row]);

    await repo.save(make({ uuid: R(1), recipientId: IDS.bob }));

    const state = (await repo.findById(row.uuid))?.snapshot();
    expect(state?.createdAt).toBe(Date.UTC(2026, 8, 20, 11));
    expect(state?.version).toBe(0);
    expect(
      (await raw('legacy-save.json')).every(
        (r) => typeof r.createdAt === 'number',
      ),
    ).toBe(true);
  });

  test('повторный save legacy-записи без изменений: version 0, запись одна', async () => {
    const row = legacyReview();
    const repo = await repoWith('legacy-resave.json', [row]);
    const loaded = await repo.findById(row.uuid);
    if (!loaded) throw new Error('запись не найдена');

    await repo.save(loaded);

    expect((await repo.findById(row.uuid))?.snapshot().version).toBe(0);
    expect(await raw('legacy-resave.json')).toHaveLength(1);
  });

  test('legacy-перезапись: version 1, uuid и createdAt прежние', async () => {
    const row = legacyReview();
    const repo = await repoWith('legacy-overwrite.json', [row]);
    const loaded = await repo.findById(row.uuid);
    if (!loaded) throw new Error('запись не найдена');
    expectOk(
      loaded.overwrite('Новый текст отзыва после правки', T0 + 9 * HOUR),
    );
    await repo.save(loaded);

    const [saved, ...rest] = await raw('legacy-overwrite.json');
    expect(rest).toEqual([]);
    expect(saved).toMatchObject({
      uuid: row.uuid,
      createdAt: Date.UTC(2026, 8, 20, 11),
      updatedAt: T0 + 9 * HOUR,
      version: 1,
    });
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

  test('текст короче 10 символов в файле — ValiError', async () => {
    const text = JSON.stringify([legacyReview({ text: 'коротко' })]);
    await Bun.write(path('short-text.json'), text);
    const repo = new ReviewJsonRepo(path('short-text.json'));
    await expect(repo.findByScope(IDS.scope)).rejects.toBeInstanceOf(ValiError);
    expect(await Bun.file(path('short-text.json')).text()).toBe(text);
  });

  test('невалидный JSON — исключение, файл не изменён', async () => {
    const text = '[{"uuid": ';
    await Bun.write(path('bad-json.json'), text);
    const repo = new ReviewJsonRepo(path('bad-json.json'));
    await expect(repo.findById(R(1))).rejects.toThrow();
    await expect(repo.save(make())).rejects.toThrow();
    expect(await Bun.file(path('bad-json.json')).text()).toBe(text);
  });

  test('корень файла не массив — ValiError, файл не изменён', async () => {
    const text = JSON.stringify({ reviews: [] });
    await Bun.write(path('not-array.json'), text);
    const repo = new ReviewJsonRepo(path('not-array.json'));
    await expect(repo.findById(R(1))).rejects.toBeInstanceOf(ValiError);
    expect(await Bun.file(path('not-array.json')).text()).toBe(text);
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
