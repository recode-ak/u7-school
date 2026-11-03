import { describe, expect, it } from 'bun:test';
import { expectErr, expectOk } from 'dmg-core/testing';
import { StreamAr, StreamArDef } from './stream.ar';
import { StreamEvents } from './stream.events';
import {
  MENTOR,
  MODULE,
  OTHER_MENTOR,
  SCHOOL,
  START,
  STEP_1,
  STREAM,
  snapshot,
  stored,
  T0,
  T1,
} from './stream.fixture';
import type { StreamState } from './stream.state';

const STATUSES = ['enrollment', 'active', 'completed', 'archived'] as const;
const restore = (
  status: StreamState['status'],
  extra: Partial<StreamState> = {},
) => StreamAr.restore(stored(status, extra));

const input = {
  uuid: STREAM,
  schoolId: SCHOOL,
  title: 'Поток JS-1',
  description: 'Основной поток курса JavaScript',
  mentorId: MENTOR,
  moduleId: MODULE,
  startDate: START,
  contentSnapshot: snapshot,
};

describe('StreamArDef', () => {
  it('четыре статуса и три перехода (MAN-12)', () => {
    expect(Object.keys(StreamArDef.statuses)).toEqual([
      'enrollment',
      'active',
      'completed',
      'archived',
    ]);
    expect(Object.keys(StreamArDef.transitions)).toEqual([
      'activate',
      'complete',
      'archive',
    ]);
  });

  it('события агрегата — StreamEvents (только created)', () => {
    expect(Object.keys(StreamArDef.events)).toEqual(['created']);
  });
});

describe('StreamAr.create', () => {
  it('новый поток в статусе enrollment: поля input, createdAt = updatedAt = at, version 0', () => {
    const ar = expectOk(StreamAr.create(input, T0));
    expect(ar.snapshot()).toEqual({
      ...input,
      status: 'enrollment',
      createdAt: T0,
      updatedAt: T0,
      version: 0,
    });
  });

  it('событие created { streamId, moduleId } — единственное', () => {
    const ar = expectOk(StreamAr.create(input, T0));
    expect(ar.pullEvents()).toEqual([
      StreamEvents.created.make({ streamId: STREAM, moduleId: MODULE }),
    ]);
    expect(ar.pullEvents()).toEqual([]);
  });

  it('необязательные поля копируются', () => {
    const optional = {
      telegramGroupId: '-100123456789',
      telegramGroupInvite: 'https://t.me/+abc123',
      goal: 'Цель обучения',
      result: 'Результат обучения',
      rules: 'Правила прохождения',
      additional: 'Дополнительные материалы',
      targetAudience: 'Целевая аудитория',
      enrollmentKey: 'секретное-слово',
    };
    const state = expectOk(
      StreamAr.create({ ...input, ...optional }, T0),
    ).snapshot();
    expect(state).toMatchObject(optional);
  });

  it('без enrollmentKey ключа в state нет', () => {
    const state = expectOk(StreamAr.create(input, T0)).snapshot();
    expect('enrollmentKey' in state).toBe(false);
  });

  it('снимок контента сохраняется как есть', () => {
    const ar = expectOk(StreamAr.create(input, T0));
    expect(ar.snapshot().contentSnapshot).toEqual(snapshot);
  });
});

describe('StreamAr.restore', () => {
  it('legacy-запись: ISO-даты, без version и updatedAt', () => {
    const ar = StreamAr.restore({
      ...input,
      status: 'active',
      startDate: '2026-06-01T12:00',
      createdAt: '2026-06-01T10:00',
    } as never);
    expect(ar.snapshot()).toMatchObject({
      startDate: START,
      createdAt: T0,
      updatedAt: T0,
      version: 0,
    });
  });

  it('восстановленный поток событий не имеет', () => {
    expect(restore('active').pullEvents()).toEqual([]);
  });
});

describe('StreamAr.activate', () => {
  it('enrollment → active, updatedAt и version обновлены', () => {
    const ar = restore('enrollment');
    expectOk(ar.activate(T1));
    expect(ar.snapshot()).toEqual({
      ...stored('active'),
      updatedAt: T1,
      version: 1,
    });
  });

  it.each(['active', 'completed', 'archived'] as const)(
    'из %s — STREAM_NOT_ENROLLING, state не меняется',
    (status) => {
      const ar = restore(status);
      const error = expectErr(ar.activate(T1), 'STREAM_NOT_ENROLLING');
      expect(error.kind).toBe('conflict');
      expect(ar.snapshot()).toEqual(stored(status));
    },
  );
});

describe('StreamAr.complete', () => {
  it('active → completed, событий нет (stream.completed не переносится)', () => {
    const ar = restore('active');
    expectOk(ar.complete(T1));
    expect(ar.snapshot().status).toBe('completed');
    expect(ar.pullEvents()).toEqual([]);
  });

  it.each(['enrollment', 'completed', 'archived'] as const)(
    'из %s — STREAM_NOT_ACTIVE',
    (status) => {
      expect(
        expectErr(restore(status).complete(T1), 'STREAM_NOT_ACTIVE').kind,
      ).toBe('conflict');
    },
  );
});

describe('StreamAr.archive', () => {
  it('completed → archived', () => {
    const ar = restore('completed');
    expectOk(ar.archive(T1));
    expect(ar.snapshot().status).toBe('archived');
  });

  it.each(['enrollment', 'active'] as const)(
    'из %s — STREAM_NOT_COMPLETED',
    (status) => {
      expectErr(restore(status).archive(T1), 'STREAM_NOT_COMPLETED');
    },
  );

  it('из archived — STREAM_ALREADY_ARCHIVED', () => {
    expectErr(restore('archived').archive(T1), 'STREAM_ALREADY_ARCHIVED');
  });
});

describe('StreamAr — полный цикл', () => {
  it('enrollment → active → completed → archived', () => {
    const ar = restore('enrollment');
    expectOk(ar.activate(T1));
    expectOk(ar.complete(T1));
    expectOk(ar.archive(T1));
    expect(ar.snapshot().status).toBe('archived');
    expect(ar.snapshot().version).toBe(3);
  });
});

describe('StreamAr — вопросы', () => {
  it('isMentoredBy: ментор потока — да, другой — нет', () => {
    const ar = restore('active');
    expect(ar.isMentoredBy(MENTOR)).toBe(true);
    expect(ar.isMentoredBy(OTHER_MENTOR)).toBe(false);
  });

  it('firstStepId: первый шаг первого урока со шагами', () => {
    expect(restore('active').firstStepId()).toBe(STEP_1);
  });

  it('firstStepId: пустые уроки пропускаются', () => {
    const [project] = snapshot;
    const ar = restore('active', {
      contentSnapshot: [
        {
          ...project!,
          lessons: [
            {
              lessonId: '55555555-5555-4555-8555-555555555555',
              lessonTitle: 'Пустой',
              stepIds: [],
            },
            ...project!.lessons,
          ],
        },
      ],
    });
    expect(ar.firstStepId()).toBe(STEP_1);
  });

  it('firstStepId: пустой снимок или уроки без шагов — undefined', () => {
    expect(
      restore('active', { contentSnapshot: [] }).firstStepId(),
    ).toBeUndefined();
    const [project] = snapshot;
    const noSteps = restore('active', {
      contentSnapshot: [
        {
          ...project!,
          lessons: [
            {
              lessonId: '55555555-5555-4555-8555-555555555555',
              lessonTitle: 'Пустой',
              stepIds: [],
            },
          ],
        },
      ],
    });
    expect(noSteps.firstStepId()).toBeUndefined();
  });
});

describe('StreamAr.view (D-60, С1)', () => {
  it('без enrollmentKey, requiresEnrollmentKey = true, когда ключ задан', () => {
    const view = restore('enrollment', { enrollmentKey: 'секрет' }).view();
    expect('enrollmentKey' in view).toBe(false);
    expect(view.requiresEnrollmentKey).toBe(true);
  });

  it('requiresEnrollmentKey = false, когда ключа нет', () => {
    const view = restore('enrollment').view();
    expect('enrollmentKey' in view).toBe(false);
    expect(view.requiresEnrollmentKey).toBe(false);
  });

  it('остальные поля state — как есть (даты — числа)', () => {
    const { enrollmentKey: _key, ...rest } = stored('active', { goal: 'Цель' });
    expect(restore('active', { goal: 'Цель' }).view()).toEqual({
      ...rest,
      requiresEnrollmentKey: false,
    });
  });
});
