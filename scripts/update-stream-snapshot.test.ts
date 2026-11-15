import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NUR_UUID } from './_app';
import { run, type SyncIo } from './update-stream-snapshot';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'stream-sync-'));
  await cp('data/fixtures', dir, { recursive: true });
  // Фикстуры без администратора: скрипт работает от имени Nur.
  const usersFile = join(dir, 'users/users.json');
  const users = (await Bun.file(usersFile).json()) as unknown[];
  users.push({
    uuid: NUR_UUID,
    name: 'Nur',
    telegramId: 1,
    roles: ['ADMIN', 'MENTOR'],
    createdAt: Date.UTC(2026, 5, 25, 12),
  });
  await Bun.write(usersFile, JSON.stringify(users));
});
afterAll(() => rm(dir, { recursive: true, force: true }));

function fakeIo(answers: string[] = []) {
  const out: string[] = [];
  const err: string[] = [];
  const io: SyncIo = {
    log: (l) => out.push(l),
    error: (l) => err.push(l),
    prompt: () => answers.shift() ?? null,
  };
  return { io, out, err };
}

const STREAM_ID = 'e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0';
const streamsFile = () => join(dir, 'streams/streams.json');

/** Переименование урока в курсе: контент модуля расходится со снимком потока. */
async function renameLesson(title: string) {
  const file = join(dir, 'courses/lessons.json');
  const lessons = (await Bun.file(file).json()) as Array<{ title: string }>;
  const first = lessons[0];
  if (first) first.title = title;
  await Bun.write(file, JSON.stringify(lessons));
}

describe('update-stream-snapshot', () => {
  it('--dry-run: печатает отчёт и не пишет данные', async () => {
    const { io, out, err } = fakeIo();
    const before = await Bun.file(join(dir, 'streams/streams.json')).text();
    const first = (JSON.parse(before) as Array<{ uuid: string }>)[0];

    const code = await run([first?.uuid ?? '', '--dry-run'], dir, io);

    expect(err).toEqual([]);
    expect(code).toBe(0);
    expect(out.join('\n')).toContain('Режим:');
    expect(await Bun.file(join(dir, 'streams/streams.json')).text()).toBe(
      before,
    );
  });

  it('неизвестный поток: код 1', async () => {
    const { io, err } = fakeIo();

    const code = await run(['no-such', '--dry-run'], dir, io);

    expect(code).toBe(1);
    expect(err.join('\n')).toContain('не найден');
  });

  it('неизвестный флаг: код 1, без записи', async () => {
    const { io, err } = fakeIo();
    const before = await Bun.file(streamsFile()).text();

    const code = await run([STREAM_ID, '--dryrun'], dir, io);

    expect(code).toBe(1);
    expect(err.join('\n')).toContain('--dryrun');
    expect(await Bun.file(streamsFile()).text()).toBe(before);
  });

  it('неверный номер при интерактивном выборе: код 1; пустой ввод: 0', async () => {
    expect(await run([], dir, fakeIo(['999']).io)).toBe(1);
    expect(await run([], dir, fakeIo(['abc']).io)).toBe(1);
    expect(await run([], dir, fakeIo(['']).io)).toBe(0);
  });

  it('ответ не y: отмена, данные не изменены', async () => {
    await renameLesson('Переименованный урок');
    const before = await Bun.file(streamsFile()).text();
    const { io, out } = fakeIo(['n']);

    const code = await run([STREAM_ID], dir, io);

    expect(code).toBe(0);
    expect(out.join('\n')).toContain('Отменено');
    expect(await Bun.file(streamsFile()).text()).toBe(before);
  });

  it('применение y: код 0, поток обновлён; повтор — контент не изменился', async () => {
    await renameLesson('Переименованный урок');
    const before = await Bun.file(streamsFile()).text();

    const applied = fakeIo(['y']);
    expect(await run([STREAM_ID], dir, applied.io)).toBe(0);
    expect(applied.out.join('\n')).toContain('Готово');
    expect(await Bun.file(streamsFile()).text()).not.toBe(before);

    const again = fakeIo();
    expect(await run([STREAM_ID], dir, again.io)).toBe(0);
    expect(again.out.join('\n')).toContain('Контент не изменился');
  });
});
