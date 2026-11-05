import { describe, expect, it } from 'bun:test';
import { PassedModulesDqs } from './passed-modules.dqs';
import { StreamAr } from './stream/stream.ar';
import { stored as streamStored } from './stream/stream.fixture';
import { StudentAr } from './student/student.ar';
import { stored } from './student/student.fixture';
import type { StudentState } from './student/student.state';

// `passedModuleIds` для `getModulePrerequisite` (Т10, D-65): модули потоков,
// записи на которые завершились `advanced`. Перенос трёх сценариев
// `prerequisitePassed` (student.rules.test.ts) — TST-08: условие «пройден»
// остаётся там, где было (запись + поток), сравнения с id курса здесь нет.

const MODULE_A = '12345678-1234-4234-8234-123456789012';
const MODULE_B = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
const STREAM_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const STREAM_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const STREAM_A2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

const streamOf = (uuid: string, moduleId: string) =>
  StreamAr.restore(streamStored('completed', { uuid, moduleId }));
const studentIn = (status: StudentState['status'], streamId: string, n = 1) =>
  StudentAr.restore(stored(status, { uuid: id(n), streamId }));

const moduleIds = (students: StudentAr[], streams: StreamAr[]): string[] =>
  new PassedModulesDqs(students, streams).moduleIds();

describe('PassedModulesDqs.moduleIds', () => {
  it('advanced в потоке модуля — модуль пройден', () => {
    expect(
      moduleIds(
        [studentIn('advanced', STREAM_A)],
        [streamOf(STREAM_A, MODULE_A)],
      ),
    ).toEqual([MODULE_A]);
  });

  it('not_advanced не «прошёл»', () => {
    expect(
      moduleIds(
        [studentIn('not_advanced', STREAM_A)],
        [streamOf(STREAM_A, MODULE_A)],
      ),
    ).toEqual([]);
  });

  it.each(['enrolled', 'active', 'abandoned'] as const)(
    'запись в статусе %s — не пройден',
    (status) => {
      expect(
        moduleIds(
          [studentIn(status, STREAM_A)],
          [streamOf(STREAM_A, MODULE_A)],
        ),
      ).toEqual([]);
    },
  );

  it('пройден другой модуль — только он и попадает в результат', () => {
    expect(
      moduleIds(
        [studentIn('advanced', STREAM_B)],
        [streamOf(STREAM_A, MODULE_A), streamOf(STREAM_B, MODULE_B)],
      ),
    ).toEqual([MODULE_B]);
  });

  it('записей нет — []', () => {
    expect(moduleIds([], [streamOf(STREAM_A, MODULE_A)])).toEqual([]);
  });

  it('потоков нет — []', () => {
    expect(moduleIds([studentIn('advanced', STREAM_A)], [])).toEqual([]);
  });

  it('запись без своего потока среди переданных пропускается', () => {
    expect(
      moduleIds(
        [studentIn('advanced', STREAM_B)],
        [streamOf(STREAM_A, MODULE_A)],
      ),
    ).toEqual([]);
  });

  it('два прохождения одного модуля (разные потоки) — модуль один раз', () => {
    expect(
      moduleIds(
        [
          studentIn('advanced', STREAM_A, 1),
          studentIn('advanced', STREAM_A2, 2),
        ],
        [streamOf(STREAM_A, MODULE_A), streamOf(STREAM_A2, MODULE_A)],
      ),
    ).toEqual([MODULE_A]);
  });

  it('прошёл один модуль, второй не завершил — только пройденный', () => {
    expect(
      moduleIds(
        [
          studentIn('advanced', STREAM_A, 1),
          studentIn('not_advanced', STREAM_B, 2),
        ],
        [streamOf(STREAM_A, MODULE_A), streamOf(STREAM_B, MODULE_B)],
      ),
    ).toEqual([MODULE_A]);
  });
});
