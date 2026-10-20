import { describe, expect, it } from 'bun:test';
import { checkDefs, formatViolation } from 'dmg-core/arch';
import { indexDefs, normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { StreamEvents, StreamModuleDef, StudentEvents } from './contract';

const ids = {
  studentId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  streamId: '33333333-3333-4333-8333-333333333333',
  moduleId: '44444444-4444-4444-8444-444444444444',
};

describe('StreamModuleDef — внешний модуль (D-37)', () => {
  it('паспорт: внешний, зависит от user и course, агрегаты stream и student', () => {
    expect(StreamModuleDef.external).toBe(true);
    expect(normalize(StreamModuleDef)).toMatchObject({
      dependsOn: ['user', 'course'],
      aggregates: ['stream', 'student'],
      useCases: [],
      reactions: [],
      jobs: [],
    });
  });

  it('checkDefs по модулю и зависимостям — без нарушений', () => {
    expect(
      checkDefs(indexDefs([StreamModuleDef])).map(formatViolation),
    ).toEqual([]);
  });

  it('StudentEvents.enrolled — FQN и payload контракта', () => {
    expect(StudentEvents.enrolled.name).toBe('stream.student.enrolled');
    expect(v.parse(StudentEvents.enrolled.payload, ids)).toEqual(ids);
    const { moduleId: _, ...noModule } = ids;
    expect(v.safeParse(StudentEvents.enrolled.payload, noModule).success).toBe(
      false,
    );
  });

  it('StreamEvents.created — FQN и payload контракта', () => {
    const payload = { streamId: ids.streamId, moduleId: ids.moduleId };
    expect(StreamEvents.created.name).toBe('stream.stream.created');
    expect(v.parse(StreamEvents.created.payload, payload)).toEqual(payload);
    expect(
      v.safeParse(StreamEvents.created.payload, {
        streamId: 'x',
        moduleId: 'y',
      }).success,
    ).toBe(false);
  });
});
