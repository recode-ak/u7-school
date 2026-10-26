import { expect, test } from 'bun:test';

test('пакет @u7-scl/domain загружается', async () => {
  const api = await import('@u7-scl/domain');
  expect(api).toBeDefined();
});
