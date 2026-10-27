import { describe, expect, test } from 'bun:test';
import { Lock } from './lock';

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe('Lock', () => {
  test('задачи выполняются по одной в порядке вызова', async () => {
    const lock = new Lock();
    const log: string[] = [];
    const task = (name: string) =>
      lock.run(async () => {
        log.push(`${name}:start`);
        await tick();
        log.push(`${name}:end`);
        return name;
      });
    expect(await Promise.all([task('a'), task('b')])).toEqual(['a', 'b']);
    expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  test('сбой задачи не блокирует следующие', async () => {
    const lock = new Lock();
    const failed = lock.run(async () => {
      throw new Error('диск недоступен');
    });
    await expect(failed).rejects.toThrow('диск недоступен');
    expect(await lock.run(async () => 'ok')).toBe('ok');
  });
});
