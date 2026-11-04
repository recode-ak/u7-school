import { describe, expect, test } from 'bun:test';
import * as v from 'valibot';
import { StreamState } from './stream/stream.state';

// Index потока больше не реэкспортирует схему снимка курса (срез student):
// те же два сценария проверяются на поле `contentSnapshot` состояния потока.
const ContentSnapshotSchema = StreamState.entries.contentSnapshot;

describe('contentSnapshot в состоянии потока', () => {
  test('схема доступна и валидирует пустой массив', () => {
    expect(() => v.parse(ContentSnapshotSchema, [])).not.toThrow();
  });

  test('схема отклоняет невалидные данные', () => {
    expect(() =>
      v.parse(ContentSnapshotSchema, [
        {
          projectId: 'bad-uuid',
          projectTitle: '',
          lessons: [],
        },
      ]),
    ).toThrow();
  });
});
