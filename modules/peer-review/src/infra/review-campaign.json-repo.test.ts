import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ReviewCampaignAr,
  type ReviewCampaignState,
} from '@u7-scl/domain/peer-review';
import { VersionConflict } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';
import { ValiError } from 'valibot';
import { campaign, IDS, T0 } from '../review-campaign/review-campaign.fixture';
import { ReviewCampaignJsonRepo } from './review-campaign.json-repo';

// Перенос legacy `infra/db/review-campaign-json-repo.test.ts` на VersionedRepository
// + блок «legacy-записи» (образец — wish.json-repo.test.ts). Только временный каталог
// и чтение фикстуры `data/fixtures` (запись — никогда).

const tmpDir = mkdtempSync(join(tmpdir(), 'review-campaign-json-repo-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

const path = (name: string) => join(tmpDir, name);
const FAR = Date.UTC(2099, 0, 1);
const PAST = Date.UTC(2020, 0, 1);

/** Новый агрегат через `create` (ещё не записан). */
function make(
  over: Partial<{
    uuid: string;
    scopeId: string;
    subjectId: string;
    mentorId: string;
    at: number;
  }> = {},
): ReviewCampaignAr {
  return expectOk(
    ReviewCampaignAr.create(
      {
        uuid: over.uuid ?? crypto.randomUUID(),
        scopeId: over.scopeId ?? IDS.scope,
        subjectId: over.subjectId ?? IDS.alice,
        mentorId: over.mentorId ?? IDS.mentor,
        subjectOutcome: 'completed_passed',
        participantIds: [],
      },
      over.at ?? T0,
    ),
  );
}

/** Записи «как есть» (в т.ч. legacy-формат) — и репозиторий над ними. */
async function repoWith(name: string, rows: unknown[]) {
  await Bun.write(path(name), JSON.stringify(rows));
  return new ReviewCampaignJsonRepo(path(name));
}

/** Legacy-запись релиза: ISO без зоны, без updatedAt и version. */
const legacyRow = (over: Record<string, unknown> = {}) => ({
  uuid: crypto.randomUUID(),
  context: 'stream_fate',
  scopeId: IDS.scope,
  subjectId: IDS.alice,
  createdAt: '2026-09-20T10:00',
  expiresAt: '2026-09-27T10:00',
  participants: [IDS.bob],
  payload: { subjectOutcome: 'completed_passed', mentorId: IDS.mentor },
  ...over,
});

describe('ReviewCampaignJsonRepo: save и поиск', () => {
  test('save + findById: round-trip нового формата (числа)', async () => {
    const repo = new ReviewCampaignJsonRepo(path('roundtrip.json'));
    const ar = make();
    await repo.save(ar);

    expect((await repo.findById(ar.uuid))?.snapshot()).toEqual(ar.snapshot());
    expect(await repo.findById(crypto.randomUUID())).toBeUndefined();
    const raw = (await Bun.file(
      path('roundtrip.json'),
    ).json()) as ReviewCampaignState[];
    expect(typeof raw[0]?.createdAt).toBe('number');
    expect(typeof raw[0]?.expiresAt).toBe('number');
  });

  test('findBySubject: ключ (scopeId, subjectId)', async () => {
    const repo = new ReviewCampaignJsonRepo(path('by-subject.json'));
    const ar = make();
    await repo.save(ar);

    expect((await repo.findBySubject(IDS.scope, IDS.alice))?.uuid).toBe(
      ar.uuid,
    );
    expect(await repo.findBySubject(IDS.scope, IDS.bob)).toBeUndefined();
    expect(await repo.findBySubject(IDS.scope2, IDS.alice)).toBeUndefined();
  });

  test('дубль ключа (scopeId, subjectId) с другим uuid — VersionConflict, файл не изменён', async () => {
    const repo = new ReviewCampaignJsonRepo(path('unique.json'));
    await repo.save(make());
    const before = await Bun.file(path('unique.json')).text();

    await expect(repo.save(make())).rejects.toBeInstanceOf(VersionConflict);

    expect(await Bun.file(path('unique.json')).text()).toBe(before);
  });

  test('findActiveBySubject: только неистёкшие, где пользователь — субъект', async () => {
    const live = campaign({ expiresAt: FAR });
    const expired = campaign({ scopeId: IDS.scope2, expiresAt: PAST });
    const asMentor = campaign({
      subjectId: IDS.bob,
      participants: [],
      payload: { subjectOutcome: 'dropped', mentorId: IDS.alice },
      expiresAt: FAR,
    });
    const repo = await repoWith('active-subject.json', [
      live,
      expired,
      asMentor,
    ]);

    const found = await repo.findActiveBySubject(IDS.alice, T0);

    expect(found.map((c) => c.uuid)).toEqual([live.uuid]);
  });

  test('findActiveByMentor: только неистёкшие, где пользователь — ментор', async () => {
    const live = campaign({ expiresAt: FAR });
    const expired = campaign({ scopeId: IDS.scope2, expiresAt: PAST });
    const asSubject = campaign({
      subjectId: IDS.mentor,
      expiresAt: FAR,
      participants: [],
      payload: { subjectOutcome: 'dropped', mentorId: IDS.carol },
    });
    const repo = await repoWith('active-mentor.json', [
      live,
      expired,
      asSubject,
    ]);

    const found = await repo.findActiveByMentor(IDS.mentor, T0);

    expect(found.map((c) => c.uuid)).toEqual([live.uuid]);
  });

  test('«активна» — по параметру at: граница включительно (at >= expiresAt — закрыта)', async () => {
    const row = campaign();
    const repo = await repoWith('boundary.json', [row]);

    expect(
      await repo.findActiveBySubject(IDS.alice, row.expiresAt - 1),
    ).toHaveLength(1);
    expect(
      await repo.findActiveBySubject(IDS.alice, row.expiresAt),
    ).toHaveLength(0);
    expect(
      await repo.findActiveByMentor(IDS.mentor, row.expiresAt - 1),
    ).toHaveLength(1);
    expect(
      await repo.findActiveByMentor(IDS.mentor, row.expiresAt),
    ).toHaveLength(0);
  });
});

describe('ReviewCampaignJsonRepo: legacy-записи', () => {
  test('ISO без зоны → число UTC, updatedAt = createdAt, version = 0', async () => {
    const row = legacyRow();
    const repo = await repoWith('legacy.json', [row]);

    const state = (await repo.findById(row.uuid))?.snapshot();

    expect(state?.createdAt).toBe(Date.UTC(2026, 8, 20, 10));
    expect(state?.expiresAt).toBe(Date.UTC(2026, 8, 27, 10));
    expect(state?.updatedAt).toBe(Date.UTC(2026, 8, 20, 10));
    expect(state?.version).toBe(0);
  });

  test('повторный save legacy-записи без изменений остаётся допустимым и сохраняет version 0', async () => {
    const row = legacyRow();
    const repo = await repoWith('legacy-resave.json', [row]);
    const loaded = await repo.findById(row.uuid);
    if (!loaded) throw new Error('запись не найдена');

    await repo.save(loaded);

    expect((await repo.findById(row.uuid))?.snapshot().version).toBe(0);
    const raw = (await Bun.file(
      path('legacy-resave.json'),
    ).json()) as ReviewCampaignState[];
    expect(raw.filter((r) => r.uuid === row.uuid)).toHaveLength(1);
    expect(raw).toHaveLength(1);
  });
});

describe('ReviewCampaignJsonRepo: невалидная запись (строгий разбор)', () => {
  test('битая запись — ValiError на чтении и записи, файл не изменён (мягкого пропуска нет)', async () => {
    const text = JSON.stringify([
      legacyRow(),
      { uuid: 'not-a-uuid', context: 'x' },
    ]);
    await Bun.write(path('broken.json'), text);
    const repo = new ReviewCampaignJsonRepo(path('broken.json'));

    await expect(repo.findBySubject(IDS.scope, IDS.bob)).rejects.toBeInstanceOf(
      ValiError,
    );
    await expect(
      repo.findActiveBySubject(IDS.alice, T0),
    ).rejects.toBeInstanceOf(ValiError);
    await expect(
      repo.save(make({ subjectId: IDS.bob })),
    ).rejects.toBeInstanceOf(ValiError);

    expect(await Bun.file(path('broken.json')).text()).toBe(text);
  });

  test('файла нет — пусто, поиск не падает и файл не создаёт', async () => {
    const repo = new ReviewCampaignJsonRepo(path('absent.json'));
    expect(await repo.findBySubject(IDS.scope, IDS.alice)).toBeUndefined();
    expect(await repo.findActiveBySubject(IDS.alice, T0)).toEqual([]);
    expect(await Bun.file(path('absent.json')).exists()).toBe(false);
  });
});

// Фикстуры только читаются (копировать/писать в data/fixtures нельзя): репозиторий
// над копией во временном каталоге.
describe('ReviewCampaignJsonRepo: фикстуры data/fixtures (чтение)', () => {
  const fixture = join(
    import.meta.dir,
    '../../../../data/fixtures/peer-review/campaigns.json',
  );
  let rows: { uuid: string; scopeId: string; subjectId: string }[];

  beforeAll(async () => {
    rows = await Bun.file(fixture).json();
    await Bun.write(path('fixture-copy.json'), await Bun.file(fixture).text());
  });

  test('все записи фикстуры читаются новой схемой (legacy ISO), version 0, updatedAt = createdAt', async () => {
    const repo = new ReviewCampaignJsonRepo(path('fixture-copy.json'));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const state = (
        await repo.findBySubject(row.scopeId, row.subjectId)
      )?.snapshot();
      expect(state?.uuid).toBe(row.uuid);
      expect(state?.version).toBe(0);
      expect(state?.updatedAt).toBe(state?.createdAt as number);
    }
  });

  test('save новой кампании поверх копии фикстуры не теряет существующие', async () => {
    const repo = new ReviewCampaignJsonRepo(path('fixture-copy.json'));
    await repo.save(make({ scopeId: IDS.scope2, subjectId: IDS.carol }));
    for (const row of rows) {
      expect((await repo.findById(row.uuid))?.uuid).toBe(row.uuid);
    }
  });
});
