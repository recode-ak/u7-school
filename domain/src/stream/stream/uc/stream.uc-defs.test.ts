import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { StreamAr } from '../stream.ar';
import {
  MENTOR,
  MODULE,
  SCHOOL,
  START,
  STREAM,
  stored,
} from '../stream.fixture';
import { StreamPolicy } from '../stream.policy';
import { StreamRules } from '../stream.rules';
import { ActivateStreamUcDef } from './activate-stream.uc';
import { ArchiveStreamUcDef } from './archive-stream.uc';
import { CompleteStreamUcDef } from './complete-stream.uc';
import { CreateStreamUcDef } from './create-stream.uc';
import { FindStreamByTelegramGroupUcDef } from './find-stream-by-telegram-group.uc';
import { GetStreamUcDef } from './get-stream.uc';
import { GetStreamMembersUcDef } from './get-stream-members.uc';
import { GetStreamPresenceUcDef } from './get-stream-presence.uc';
import { ListStreamsUcDef } from './list-streams.uc';

// Def 9 UC потока: имя, тип, callers, Policy,
// правила, ошибки, события, вход и выход.

const view = StreamAr.restore(
  stored('active', { enrollmentKey: 'секрет' }),
).view();
const ok = (schema: v.GenericSchema, value: unknown) =>
  v.safeParse(schema, value).success;

describe('CreateStreamUcDef', () => {
  it('command пользователя: calls getModuleSnapshot, ошибка модуля не найден, событие created', () => {
    expect(normalize(CreateStreamUcDef)).toMatchObject({
      name: 'createStream',
      type: 'command',
      aggregate: 'stream',
      callers: ['user'],
      calls: ['getModuleSnapshot'],
      errors: ['MODULE_NOT_FOUND'],
      emits: ['stream.stream.created'],
    });
    expect(CreateStreamUcDef.policy).toBe(StreamPolicy.rules.canCreate);
  });

  const input = {
    title: 'Новый курс',
    description: 'Описание',
    moduleId: MODULE,
    startDate: START,
  };

  it('вход: обязательные поля без mentorId, schoolId, status, contentSnapshot (С3)', () => {
    const { input: schema } = CreateStreamUcDef;
    expect(v.parse(schema, input)).toEqual(input);
    for (const key of ['title', 'description', 'moduleId', 'startDate']) {
      const { [key]: _omitted, ...rest } = input as Record<string, unknown>;
      expect(ok(schema, rest)).toBe(false);
    }
    expect(ok(schema, { ...input, moduleId: 'x' })).toBe(false);
    expect(ok(schema, { ...input, title: '   ' })).toBe(false);
    const parsed = v.parse(schema, {
      ...input,
      mentorId: MENTOR,
      schoolId: SCHOOL,
      status: 'active',
      contentSnapshot: [],
    });
    expect(parsed).toEqual(input);
  });

  it('вход: необязательные поля принимаются', () => {
    const optional = {
      telegramGroupId: '-100',
      telegramGroupInvite: 'https://t.me/+abc',
      goal: 'Цель',
      result: 'Результат',
      rules: 'Правила',
      additional: 'Допы',
      targetAudience: 'Все',
      enrollmentKey: 'секрет',
    };
    expect(v.parse(CreateStreamUcDef.input, { ...input, ...optional })).toEqual(
      {
        ...input,
        ...optional,
      },
    );
  });

  it('выход — { streamId }', () => {
    const { output } = CreateStreamUcDef;
    expect(v.parse(output, { streamId: STREAM })).toEqual({ streamId: STREAM });
    expect(ok(output, { streamId: 'x' })).toBe(false);
  });
});

describe.each([
  [
    'activateStream',
    ActivateStreamUcDef,
    ['STREAM_NOT_FOUND', 'STREAM_NOT_ENROLLING'],
    [],
  ],
  [
    'completeStream',
    CompleteStreamUcDef,
    ['STREAM_NOT_FOUND', 'STREAM_NOT_ACTIVE'],
    ['studentsSettled'],
  ],
  [
    'archiveStream',
    ArchiveStreamUcDef,
    ['STREAM_NOT_FOUND', 'STREAM_NOT_COMPLETED', 'STREAM_ALREADY_ARCHIVED'],
    [],
  ],
] as const)('%s', (name, def, errors, rules) => {
  it('command пользователя: Policy canManage, ошибки, без событий', () => {
    const normalized = normalize(def);
    expect(normalized).toMatchObject({
      name,
      type: 'command',
      aggregate: 'stream',
      callers: ['user'],
      emits: [],
    });
    expect(normalized.errors).toEqual(expect.arrayContaining([...errors]));
    expect(def.policy).toBe(StreamPolicy.rules.canManage);
  });

  it('правила', () => {
    expect((def.rules ?? []).map((r) => r.name)).toEqual([...rules]);
  });

  it('вход { streamId }, выход — пусто', () => {
    expect(v.parse(def.input, { streamId: STREAM })).toEqual({
      streamId: STREAM,
    });
    expect(ok(def.input, { streamId: 'x' })).toBe(false);
    expect(ok(def.input, {})).toBe(false);
    expect(ok(def.output, undefined)).toBe(true);
  });
});

describe('CompleteStreamUcDef — правило', () => {
  it('rules: [studentsSettled]', () => {
    expect(CompleteStreamUcDef.rules).toEqual([
      StreamRules.rules.studentsSettled,
    ]);
  });
});

describe('GetStreamUcDef', () => {
  it('query пользователя и гостя, allowAll, ошибка NOT_FOUND', () => {
    expect(normalize(GetStreamUcDef)).toMatchObject({
      name: 'getStream',
      type: 'query',
      aggregate: 'stream',
      callers: ['user', 'guest'],
      errors: ['STREAM_NOT_FOUND'],
    });
    expect(GetStreamUcDef.policy.op).toBe('allowAll');
  });

  it('вход { streamId }', () => {
    expect(v.parse(GetStreamUcDef.input, { streamId: STREAM })).toEqual({
      streamId: STREAM,
    });
    expect(ok(GetStreamUcDef.input, { streamId: 'x' })).toBe(false);
  });

  it('выход — представление потока + canManage, без enrollmentKey (С1, Т7)', () => {
    const { output } = GetStreamUcDef;
    const parsed = v.parse(output, {
      ...view,
      enrollmentKey: 'секрет',
      canManage: true,
    });
    expect(parsed).toMatchObject({
      uuid: STREAM,
      canManage: true,
      requiresEnrollmentKey: true,
    });
    expect('enrollmentKey' in parsed).toBe(false);
    expect(ok(output, view)).toBe(false);
  });
});

describe('ListStreamsUcDef', () => {
  it('query пользователя и гостя, allowAll, без ошибок', () => {
    expect(normalize(ListStreamsUcDef)).toMatchObject({
      name: 'listStreams',
      type: 'query',
      aggregate: 'stream',
      callers: ['user', 'guest'],
      errors: [],
    });
    expect(ListStreamsUcDef.policy.op).toBe('allowAll');
  });

  it('вход: все фильтры необязательны; status, mentorId, schoolId проверяются', () => {
    const { input } = ListStreamsUcDef;
    expect(v.parse(input, {})).toEqual({});
    expect(
      v.parse(input, { status: 'active', mentorId: MENTOR, schoolId: SCHOOL }),
    ).toEqual({ status: 'active', mentorId: MENTOR, schoolId: SCHOOL });
    expect(ok(input, { status: 'paused' })).toBe(false);
    expect(ok(input, { schoolId: 'invalid-school-id' })).toBe(false);
    expect(ok(input, { mentorId: 'x' })).toBe(false);
  });

  it('выход — массив представлений без enrollmentKey', () => {
    const parsed = v.parse(ListStreamsUcDef.output, [
      { ...view, enrollmentKey: 'секрет' },
    ]);
    expect(parsed).toHaveLength(1);
    expect('enrollmentKey' in (parsed[0] ?? {})).toBe(false);
    expect(v.parse(ListStreamsUcDef.output, [])).toEqual([]);
  });
});

describe('FindStreamByTelegramGroupUcDef', () => {
  it('query пользователя и гостя, allowAll, без ошибок', () => {
    expect(normalize(FindStreamByTelegramGroupUcDef)).toMatchObject({
      name: 'findStreamByTelegramGroup',
      type: 'query',
      aggregate: 'stream',
      callers: ['user', 'guest'],
      errors: [],
    });
    expect(FindStreamByTelegramGroupUcDef.policy.op).toBe('allowAll');
  });

  it('вход — идентификатор группы строкой (Т8)', () => {
    const { input } = FindStreamByTelegramGroupUcDef;
    expect(v.parse(input, { telegramGroupId: '-1001234567890' })).toEqual({
      telegramGroupId: '-1001234567890',
    });
    expect(ok(input, {})).toBe(false);
    expect(ok(input, { telegramGroupId: -1001234567890 })).toBe(false);
  });

  it('выход — представление потока или undefined (нет такой группы)', () => {
    const { output } = FindStreamByTelegramGroupUcDef;
    expect(ok(output, undefined)).toBe(true);
    expect(ok(output, view)).toBe(true);
    expect(
      'enrollmentKey' in
        (v.parse(output, { ...view, enrollmentKey: 'x' }) ?? {}),
    ).toBe(false);
  });
});

describe('GetStreamMembersUcDef (Т6)', () => {
  it('query system, user, guest над агрегатом потока, allowAll', () => {
    expect(normalize(GetStreamMembersUcDef)).toMatchObject({
      name: 'getStreamMembers',
      type: 'query',
      aggregate: 'stream',
      callers: ['system', 'user', 'guest'],
      errors: [],
    });
    expect(GetStreamMembersUcDef.policy.op).toBe('allowAll');
  });

  const student = {
    studentId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    status: 'active',
    neverStarted: false,
    inProgress: true,
  };

  it.each(['enrolled', 'active', 'abandoned', 'advanced', 'not_advanced'])(
    'выход: студент со статусом %s, studentId и inProgress',
    (status) => {
      const out = { mentorId: MENTOR, students: [{ ...student, status }] };
      expect(v.parse(GetStreamMembersUcDef.output, out)).toEqual(out as never);
    },
  );

  it('выход: без studentId или inProgress, чужой статус — отклоняется; нет потока — undefined', () => {
    const { output } = GetStreamMembersUcDef;
    const { studentId: _s, ...noStudentId } = student;
    const { inProgress: _i, ...noInProgress } = student;
    expect(ok(output, { mentorId: MENTOR, students: [noStudentId] })).toBe(
      false,
    );
    expect(ok(output, { mentorId: MENTOR, students: [noInProgress] })).toBe(
      false,
    );
    expect(
      ok(output, { mentorId: MENTOR, students: [{ ...student, status: 'x' }] }),
    ).toBe(false);
    expect(ok(output, undefined)).toBe(true);
  });
});

describe('GetStreamPresenceUcDef — без изменений', () => {
  it('query system, allowAll, { exists }', () => {
    expect(normalize(GetStreamPresenceUcDef)).toMatchObject({
      name: 'getStreamPresence',
      callers: ['system'],
      errors: [],
    });
    expect(v.parse(GetStreamPresenceUcDef.output, { exists: true })).toEqual({
      exists: true,
    });
  });
});
