import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ReplayClaim } from 'dmg-core/app';
import { FileReplayStore } from './file-replay-store';

const T0 = Date.UTC(2026, 0, 1);
const TTL = 60_000;
const KEY = 'wish/user:u-1/tg:100#1';
const INPUT = '{"input":{"courseId":"c-1"},"uc":"addWish"}';
const OTHER_INPUT = '{"input":{"courseId":"c-2"},"uc":"addWish"}';
const ANSWER = { ok: true, value: { wishId: 'w-1' } };

/** Токен владельца записи из итога `claim`; другой итог — ошибка теста. */
function tokenOf(claim: ReplayClaim): string {
  if (claim.kind !== 'claimed') {
    throw new Error(`ожидался claimed, ${claim.kind}`);
  }
  return claim.token;
}

let root: string;
let dir: string;
let now: number;

/** Хранилище над каталогом теста с часами, которые переводит тест. */
const open = () => FileReplayStore.open({ dir, clock: () => now, ttlMs: TTL });

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'replay-'));
  dir = path.join(root, 'replay');
  now = T0;
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('FileReplayStore — контракт ReplayStore', () => {
  test('свободный ключ занимается; повтор того же входа — «в работе»', async () => {
    const replay = await open();
    expect(await replay.claim(KEY, INPUT)).toMatchObject({ kind: 'claimed' });
    expect(await replay.claim(KEY, INPUT)).toStrictEqual({
      kind: 'conflict',
      reason: 'in_progress',
    });
  });

  test('после complete повтор того же входа получает копию ответа', async () => {
    const replay = await open();
    await replay.complete(KEY, tokenOf(await replay.claim(KEY, INPUT)), ANSWER);

    const claim = await replay.claim(KEY, INPUT);
    expect(claim).toStrictEqual({ kind: 'answered', answer: ANSWER });
    if (claim.kind === 'answered') expect(claim.answer).not.toBe(ANSWER);
  });

  test('тот же ключ с другим входом — конфликт входа', async () => {
    const replay = await open();
    await replay.complete(KEY, tokenOf(await replay.claim(KEY, INPUT)), ANSWER);

    expect(await replay.claim(KEY, OTHER_INPUT)).toStrictEqual({
      kind: 'conflict',
      reason: 'input',
    });
  });

  test('release владельца снимает запись — повтор исполняется заново', async () => {
    const replay = await open();
    await replay.release(KEY, tokenOf(await replay.claim(KEY, INPUT)));

    expect(await replay.claim(KEY, INPUT)).toMatchObject({ kind: 'claimed' });
  });

  test('чужой токен: complete и release запись не трогают', async () => {
    const replay = await open();
    tokenOf(await replay.claim(KEY, INPUT));

    await replay.complete(KEY, 'чужой', ANSWER);
    await replay.release(KEY, 'чужой');

    expect(await replay.claim(KEY, INPUT)).toStrictEqual({
      kind: 'conflict',
      reason: 'in_progress',
    });
  });

  test('два параллельных claim одного ключа — занимает только один', async () => {
    const replay = await open();

    const claims = await Promise.all([
      replay.claim(KEY, INPUT),
      replay.claim(KEY, INPUT),
    ]);

    expect(claims.map((c) => c.kind).sort()).toEqual(['claimed', 'conflict']);
  });

  test('запись живёт ttlMs: после срока ключ свободен', async () => {
    const replay = await open();
    await replay.complete(KEY, tokenOf(await replay.claim(KEY, INPUT)), ANSWER);

    now += TTL;

    expect(await replay.claim(KEY, OTHER_INPUT)).toMatchObject({
      kind: 'claimed',
    });
  });
});

describe('FileReplayStore — файлы', () => {
  test('каталог создаётся при открытии', async () => {
    await open();
    expect(await readdir(dir)).toEqual([]);
  });

  test('ответ переживает рестарт: новое хранилище над тем же каталогом', async () => {
    const before = await open();
    await before.complete(KEY, tokenOf(await before.claim(KEY, INPUT)), ANSWER);

    const after = await open();

    expect(await after.claim(KEY, INPUT)).toStrictEqual({
      kind: 'answered',
      answer: ANSWER,
    });
  });

  test('запись «в работе» прежнего процесса при открытии снимается вместе с файлом', async () => {
    const before = await open();
    tokenOf(await before.claim(KEY, INPUT));

    const after = await open();

    expect(await readdir(dir)).toEqual([]);
    expect(await after.claim(KEY, INPUT)).toMatchObject({ kind: 'claimed' });
  });

  test('просроченная запись при открытии снимается вместе с файлом', async () => {
    const before = await open();
    await before.complete(KEY, tokenOf(await before.claim(KEY, INPUT)), ANSWER);

    now += TTL;
    await open();

    expect(await readdir(dir)).toEqual([]);
  });

  test('просроченная запись снимается с файлом при работе хранилища', async () => {
    const replay = await open();
    await replay.complete(KEY, tokenOf(await replay.claim(KEY, INPUT)), ANSWER);

    now += TTL;
    await replay.claim('wish/user:u-2/tg:200#1', INPUT);

    expect(await readdir(dir)).toHaveLength(1);
  });

  test('release удаляет файл записи', async () => {
    const replay = await open();
    await replay.release(KEY, tokenOf(await replay.claim(KEY, INPUT)));

    expect(await readdir(dir)).toEqual([]);
  });

  test('битый файл пропускается и не мешает открытию', async () => {
    const before = await open();
    await before.complete(KEY, tokenOf(await before.claim(KEY, INPUT)), ANSWER);
    await writeFile(path.join(dir, 'broken.json'), '{не json');

    const after = await open();

    expect(await after.claim(KEY, INPUT)).toMatchObject({ kind: 'answered' });
  });
});
