import { describe, expect, test } from 'bun:test';
import { streamLegacyInbound } from './legacy-inbound';

// `stream.created` теперь публикует UoW модуля (createStream), а не
// legacy-агрегат: маршрут из `streamLegacyInbound` удаляется (иначе событие
// придёт дважды). Остаются три маршрута `student.*` (до Ф2).
describe('streamLegacyInbound — без stream.created', () => {
  test('маршрута stream.created нет', () => {
    expect(
      streamLegacyInbound.find((r) => r.legacy === 'stream.created'),
    ).toBeUndefined();
  });

  test('остались три маршрута student.*', () => {
    expect(streamLegacyInbound.map((r) => r.legacy)).toEqual([
      'student.enrolled',
      'student.completed',
      'student.abandoned',
    ]);
  });
});
