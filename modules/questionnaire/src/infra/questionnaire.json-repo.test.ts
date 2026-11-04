import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  QuestionnaireAr,
  type QuestionnaireState,
} from '@u7-scl/domain/questionnaire';
import { VersionConflict } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';
import { QuestionnaireJsonRepo } from './questionnaire.json-repo';

// Репозиторий анкет (`<dbDir>/questionnaires/questionnaires.json`). Перенос
// `infra/db/questionnaire-json-repo.test.ts` и `questionnaire-repo-idle.test.ts`
// (`getIdle` → `findIdle`) + контракт новой записи: legacy ISO → число, нет
// `updatedAt` → `createdAt`, нет `version` → 0, round-trip обеих веток `kind`,
// невалидная запись — исключение, файл цел. `getActive` не переносится (Т18).
// Каталог — mkdtemp, живые данные не читаются.

const tmpDir = mkdtempSync(join(tmpdir(), 'questionnaire-json-repo-test-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

const HOUR = 60 * 60 * 1000;
const T0 = Date.UTC(2026, 5, 1, 10);
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const filePath = (name: string) => join(tmpDir, name);

const standardPool = () => ({
  inviteText: 'Приглашение',
  questions: [
    {
      question: 'Q1',
      questionCode: 'q1',
      type: 'choice' as const,
      multiple: false,
      answers: [
        { answer: 'A', answerCode: 'a' },
        { answer: 'B', answerCode: 'b' },
      ],
    },
  ],
});
const likertPool = () => ({
  questions: [
    {
      questionCode: 'lq1',
      question: 'Q1',
      likertMapping: { category: 'C', subcategory: 'S', weight: 1 },
    },
  ],
});

const makeStandard = (extra: { respondentId?: string; at?: number } = {}) =>
  expectOk(
    QuestionnaireAr.createStandard(
      {
        uuid: crypto.randomUUID(),
        respondentId: extra.respondentId ?? USER,
        pool: standardPool(),
        ownerInfo: { courseId: 'c-1' },
      },
      extra.at ?? T0,
    ),
  );
const makeLikert = (at = T0) =>
  expectOk(
    QuestionnaireAr.createLikert(
      {
        uuid: crypto.randomUUID(),
        respondentId: USER,
        pool: likertPool(),
        ownerInfo: { context: 'module_completed' },
      },
      at,
    ),
  );

async function repoWith(name: string, rows: unknown[]) {
  const path = filePath(name);
  await Bun.write(path, JSON.stringify(rows));
  return { repo: new QuestionnaireJsonRepo(path), path };
}

const legacy = (uuid: string, extra: Record<string, unknown> = {}) => ({
  kind: 'standard',
  uuid,
  respondentId: USER,
  status: 'in_progress',
  currentQuestionCode: 'q1',
  draftAnswers: {},
  answers: [
    { questionCode: 'q0', answerCode: 'a', answeredAt: '2026-06-01T10:30' },
  ],
  questionPool: standardPool(),
  ownerInfo: { courseId: 'c-1' },
  createdAt: '2026-06-01T10:00',
  completedAt: null,
  ...extra,
});

describe('QuestionnaireJsonRepo — save и findById', () => {
  test('round-trip обычной анкеты: сохранённая читается тем же состоянием', async () => {
    const repo = new QuestionnaireJsonRepo(filePath('roundtrip-standard.json'));
    const ar = makeStandard();
    await repo.save(ar);
    expect((await repo.findById(ar.uuid))?.snapshot()).toEqual(ar.snapshot());
  });

  test('round-trip likert-анкеты (ветка kind)', async () => {
    const repo = new QuestionnaireJsonRepo(filePath('roundtrip-likert.json'));
    const ar = makeLikert();
    await repo.save(ar);
    const found = (await repo.findById(ar.uuid))?.snapshot();
    expect(found).toEqual(ar.snapshot());
    expect(found?.kind).toBe('likert');
  });

  test('findById несуществующей — undefined, файл не создаётся', async () => {
    const path = filePath('missing.json');
    const repo = new QuestionnaireJsonRepo(path);
    expect(await repo.findById(crypto.randomUUID())).toBeUndefined();
    expect(await Bun.file(path).exists()).toBe(false);
  });

  test('переход сохраняется, версия растёт (обновление существующей)', async () => {
    const repo = new QuestionnaireJsonRepo(filePath('transition.json'));
    const ar = makeStandard();
    await repo.save(ar);

    const loaded = await repo.findById(ar.uuid);
    if (!loaded) throw new Error('анкета не найдена');
    expectOk(loaded.abandon(T0 + 1000, 'by_user'));
    await repo.save(loaded);

    const after = (await repo.findById(ar.uuid))?.snapshot();
    expect(after).toMatchObject({
      status: 'abandoned',
      abandonReason: 'by_user',
      version: 1,
    });
  });

  test('запись по устаревшей версии — VersionConflict', async () => {
    const repo = new QuestionnaireJsonRepo(filePath('stale.json'));
    const ar = makeStandard();
    await repo.save(ar);
    const first = await repo.findById(ar.uuid);
    const second = await repo.findById(ar.uuid);
    if (!first || !second) throw new Error('анкета не найдена');
    expectOk(first.abandon(T0 + 1000, 'by_user'));
    expectOk(second.abandon(T0 + 2000, 'by_user'));
    await repo.save(first);
    await expect(repo.save(second)).rejects.toBeInstanceOf(VersionConflict);
  });
});

describe('QuestionnaireJsonRepo — legacy-записи', () => {
  test('ISO → числа (UTC), updatedAt = createdAt, version = 0; даты ответов тоже', async () => {
    const id = crypto.randomUUID();
    const { repo } = await repoWith('legacy.json', [legacy(id)]);
    const state = (await repo.findById(id))?.snapshot();
    expect(state).toMatchObject({
      uuid: id,
      createdAt: T0,
      updatedAt: T0,
      version: 0,
      completedAt: null,
    });
    expect(state?.answers[0]?.answeredAt).toBe(Date.UTC(2026, 5, 1, 10, 30));
  });

  test('warnedAt, continueInvitedAt, completedAt и updatedAt читаются из ISO', async () => {
    const id = crypto.randomUUID();
    const { repo } = await repoWith('legacy-flags.json', [
      legacy(id, {
        updatedAt: '2026-06-01T11:00',
        warnedAt: '2026-06-01T10:20',
        continueInvitedAt: '2026-06-01T10:10',
      }),
    ]);
    expect((await repo.findById(id))?.snapshot()).toMatchObject({
      updatedAt: Date.UTC(2026, 5, 1, 11),
      warnedAt: Date.UTC(2026, 5, 1, 10, 20),
      continueInvitedAt: Date.UTC(2026, 5, 1, 10, 10),
    });
  });

  test('legacy likert-запись читается', async () => {
    const id = crypto.randomUUID();
    const { repo } = await repoWith('legacy-likert.json', [
      legacy(id, {
        kind: 'likert',
        status: 'invited',
        currentQuestionCode: null,
        answers: [],
        questionPool: likertPool(),
      }),
    ]);
    expect((await repo.findById(id))?.snapshot()).toMatchObject({
      kind: 'likert',
      createdAt: T0,
      version: 0,
    });
  });

  test('legacy-запись после перехода сохраняется с version 1, соседние целы', async () => {
    const id = crypto.randomUUID();
    const neighbour = crypto.randomUUID();
    const { repo, path } = await repoWith('legacy-transition.json', [
      legacy(id),
      legacy(neighbour),
    ]);

    const loaded = await repo.findById(id);
    if (!loaded) throw new Error('анкета не найдена');
    expectOk(loaded.abandon(T0 + 5000, 'timeout'));
    await repo.save(loaded);

    const rows = JSON.parse(
      await Bun.file(path).text(),
    ) as QuestionnaireState[];
    expect(rows.find((r) => r.uuid === id)).toMatchObject({
      status: 'abandoned',
      abandonReason: 'timeout',
      version: 1,
      createdAt: T0,
    });
    expect((await repo.findById(neighbour))?.snapshot().createdAt).toBe(T0);
  });

  test('смешанный файл: ISO без version и числовые с version читаются целиком', async () => {
    const legacyId = crypto.randomUUID();
    const modernId = crypto.randomUUID();
    const modern = makeStandard().snapshot();
    const { repo } = await repoWith('mixed.json', [
      legacy(legacyId),
      { ...modern, uuid: modernId, updatedAt: T0 + 7000, version: 3 },
    ]);
    expect((await repo.findByRespondent(USER)).map((q) => q.uuid)).toEqual([
      legacyId,
      modernId,
    ]);
    expect((await repo.findById(modernId))?.snapshot()).toMatchObject({
      updatedAt: T0 + 7000,
      version: 3,
    });
    expect((await repo.findById(legacyId))?.snapshot().version).toBe(0);
  });
});

describe('QuestionnaireJsonRepo — findByRespondent', () => {
  test('фильтрует по респонденту, порядок — как в файле', async () => {
    const repo = new QuestionnaireJsonRepo(filePath('by-respondent.json'));
    const a = makeStandard();
    const b = makeStandard({ respondentId: OTHER_USER });
    const c = makeLikert();
    for (const ar of [a, b, c]) await repo.save(ar);

    expect((await repo.findByRespondent(USER)).map((q) => q.uuid)).toEqual([
      a.uuid,
      c.uuid,
    ]);
    expect(
      (await repo.findByRespondent(OTHER_USER)).map((q) => q.uuid),
    ).toEqual([b.uuid]);
    expect(await repo.findByRespondent(crypto.randomUUID())).toEqual([]);
  });
});

describe('QuestionnaireJsonRepo — findIdle (брошенные анкеты)', () => {
  const NOW = T0 + 10 * HOUR;
  const stored = (name: string, ...ars: QuestionnaireAr[]) => {
    const repo = new QuestionnaireJsonRepo(filePath(name));
    return Promise.all(ars.map((ar) => repo.save(ar))).then(() => repo);
  };
  const idle = (repo: QuestionnaireJsonRepo, p: object = {}) =>
    repo.findIdle({ idleMs: 6 * HOUR, at: NOW, ...p });

  test('незавершённые с простоем ≥ порога: и in_progress, и invited', async () => {
    const repo = await stored(
      'idle-both.json',
      makeStandard({ at: T0 }),
      makeLikert(T0),
    );
    expect(await idle(repo)).toHaveLength(2);
  });

  test('не возвращает completed и abandoned', async () => {
    const done = makeStandard();
    expectOk(done.abandon(T0 + 1, 'by_user'));
    const repo = await stored('idle-finished.json', done);
    expect(await idle(repo)).toEqual([]);
  });

  test('не возвращает анкеты с простоем меньше порога', async () => {
    const repo = await stored(
      'idle-fresh.json',
      makeStandard({ at: NOW - HOUR }),
    );
    expect(await idle(repo)).toEqual([]);
  });

  test('простой считается от updatedAt, а не от createdAt', async () => {
    const touched = makeStandard({ at: T0 });
    expectOk(
      touched.handleAction(NOW - HOUR, { type: 'callback', value: 'a' }),
    );
    const stale = makeStandard({ at: T0 });
    const repo = await stored('idle-updated.json', touched, stale);
    expect((await idle(repo)).map((q) => q.uuid)).toEqual([stale.uuid]);
  });

  test('legacy-запись без updatedAt: точка отсчёта createdAt', async () => {
    const id = crypto.randomUUID();
    const { repo } = await repoWith('idle-legacy.json', [
      legacy(id, { createdAt: '2026-06-01T10:00' }),
    ]);
    expect((await idle(repo)).map((q) => q.uuid)).toEqual([id]);
  });

  test('kinds фильтрует вид анкеты; без kinds — все виды', async () => {
    const repo = await stored(
      'idle-kinds.json',
      makeStandard({ at: T0 }),
      makeLikert(T0),
    );
    const only = await idle(repo, { kinds: ['standard'] });
    expect(only.map((q) => q.snapshot().kind)).toEqual(['standard']);
    expect(await idle(repo)).toHaveLength(2);
  });

  test('пустое хранилище — пустой массив', async () => {
    expect(
      await idle(new QuestionnaireJsonRepo(filePath('idle-empty.json'))),
    ).toEqual([]);
  });
});

describe('QuestionnaireJsonRepo — битая запись', () => {
  test('невалидная запись в файле — исключение при чтении, файл не перезаписан', async () => {
    const id = crypto.randomUUID();
    const { repo, path } = await repoWith('invalid.json', [
      legacy(id),
      { invalid: 'data' },
    ]);
    const before = await Bun.file(path).text();

    await expect(repo.findById(id)).rejects.toThrow();
    await expect(repo.findByRespondent(USER)).rejects.toThrow();
    await expect(repo.save(makeStandard())).rejects.toThrow();

    expect(await Bun.file(path).text()).toBe(before);
  });
});
