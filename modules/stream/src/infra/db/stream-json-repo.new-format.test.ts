import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StreamAr } from '@u7-scl/domain/stream';
import { expectOk } from 'dmg-core/testing';
import { StreamJsonRepo } from '../stream.json-repo';
import { LegacyStreamJsonRepo } from './stream-json-repo';

// Красная зона перехода: legacy-репозиторий читает файл, записанный новым
// `StreamJsonRepo` (числовые даты). Записи пропускаются без исключения, файл
// не меняется. Каталог — mkdtemp.

const dir = mkdtempSync(join(tmpdir(), 'stream-legacy-read-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('LegacyStreamJsonRepo над файлом нового формата', () => {
  test('записи пропускаются, исключения нет, файл не изменён', async () => {
    const path = join(dir, 'streams.json');
    const created = StreamAr.create(
      {
        uuid: '11111111-1111-4111-8111-111111111111',
        schoolId: 'a0000000-0000-4000-8000-000000000001',
        title: 'Поток',
        description: 'Описание',
        mentorId: '660e8400-e29b-41d4-a716-446655440002',
        moduleId: '770e8400-e29b-41d4-a716-446655440003',
        startDate: Date.UTC(2026, 5, 1, 12),
        contentSnapshot: [],
      },
      Date.UTC(2026, 5, 1, 10),
    );
    await new StreamJsonRepo(path).save(expectOk(created));
    const before = await Bun.file(path).text();

    const legacy = new LegacyStreamJsonRepo(path);

    expect(await legacy.getAll()).toEqual([]);
    expect(await legacy.getByUuid('11111111-1111-4111-8111-111111111111')).toBe(
      undefined,
    );
    expect(await Bun.file(path).text()).toBe(before);
  });
});
