import { describe, expect, it } from 'bun:test';
import { expectOk } from 'dmg-core/testing';
import { QuestionnaireAr } from './questionnaire.ar';
import { QuestionnaireEvents } from './questionnaire.events';
import { HOUR, refOf, stored, T0 } from './questionnaire.fixture';

// Перенос `warned-at.test.ts`, `continue-invited-at.test.ts` и ступеней Job
// (`sweep-abandoned-job*.test.ts`) на `sweepIdle(at)`: 3 ч — continueInvite,
// 6 ч — abandonWarning, 9 ч — abandoned(timeout). Флаг не сдвигает `updatedAt` (Т1).

const restore = (
  status: Parameters<typeof stored>[0],
  extra: Parameters<typeof stored>[1] = {},
) => QuestionnaireAr.restore(stored(status, extra));
const eventNames = (ar: QuestionnaireAr) => ar.pullEvents().map((e) => e.name);

describe('sweepIdle — ступени простоя', () => {
  it('меньше 3 ч — ничего: Ok, состояние и события не меняются', () => {
    const ar = restore('in_progress');
    expectOk(ar.sweepIdle(T0 + 2 * HOUR));
    expect(ar.snapshot()).toEqual(stored('in_progress'));
    expect(ar.pullEvents()).toEqual([]);
  });

  it('3 ч: continueInvitedAt = at, updatedAt не сдвинут (Т1), событие continueInvite', () => {
    const ar = restore('in_progress');
    expectOk(ar.sweepIdle(T0 + 3 * HOUR));
    const state = ar.snapshot();
    expect(state.continueInvitedAt).toBe(T0 + 3 * HOUR);
    expect(state.warnedAt).toBeUndefined();
    expect(state.updatedAt).toBe(T0);
    expect(state.status).toBe('in_progress');
    expect(ar.pullEvents()).toEqual([
      QuestionnaireEvents.continueInvite.make(refOf('standard')),
    ]);
  });

  it('5 ч — приглашение продолжить, ещё не предупреждение', () => {
    const ar = restore('in_progress');
    expectOk(ar.sweepIdle(T0 + 5 * HOUR));
    expect(eventNames(ar)).toEqual([QuestionnaireEvents.continueInvite.name]);
  });

  it('6 ч: warnedAt = at, updatedAt не сдвинут, событие abandonWarning; ступень 3 ч пропущена', () => {
    const ar = restore('in_progress');
    expectOk(ar.sweepIdle(T0 + 6 * HOUR));
    const state = ar.snapshot();
    expect(state.warnedAt).toBe(T0 + 6 * HOUR);
    expect(state.continueInvitedAt).toBeUndefined();
    expect(state.updatedAt).toBe(T0);
    expect(ar.pullEvents()).toEqual([
      QuestionnaireEvents.abandonWarning.make(refOf('standard')),
    ]);
  });

  it('8.5 ч без warnedAt — предупреждение, не закрытие', () => {
    const ar = restore('in_progress');
    expectOk(ar.sweepIdle(T0 + 8.5 * HOUR));
    expect(ar.snapshot().status).toBe('in_progress');
    expect(eventNames(ar)).toEqual([QuestionnaireEvents.abandonWarning.name]);
  });

  it('7 ч с continueInvitedAt, но без warnedAt — только предупреждение', () => {
    const ar = restore('in_progress', { continueInvitedAt: T0 + 3 * HOUR });
    expectOk(ar.sweepIdle(T0 + 7 * HOUR));
    expect(eventNames(ar)).toEqual([QuestionnaireEvents.abandonWarning.name]);
  });

  it('9 ч: abandoned, abandonReason timeout, событие abandoned { reason: timeout }', () => {
    const ar = restore('in_progress');
    expectOk(ar.sweepIdle(T0 + 9 * HOUR));
    expect(ar.snapshot()).toMatchObject({
      status: 'abandoned',
      abandonReason: 'timeout',
    });
    expect(ar.pullEvents()).toEqual([
      QuestionnaireEvents.abandoned.make({
        ...refOf('standard'),
        reason: 'timeout',
      }),
    ]);
  });

  it('9 ч с warnedAt — всё равно закрывается', () => {
    const ar = restore('in_progress', { warnedAt: T0 + 7 * HOUR });
    expectOk(ar.sweepIdle(T0 + 9 * HOUR));
    expect(ar.snapshot().status).toBe('abandoned');
  });

  it('повторный вызов после ступени — без события и без записи (идемпотентность)', () => {
    const ar = restore('in_progress');
    expectOk(ar.sweepIdle(T0 + 4 * HOUR));
    ar.pullEvents();
    const before = ar.snapshot();
    expectOk(ar.sweepIdle(T0 + 4 * HOUR));
    expect(ar.pullEvents()).toEqual([]);
    expect(ar.snapshot()).toEqual(before);
  });

  it('повтор после предупреждения (warnedAt, 7 ч) — дубля нет', () => {
    const ar = restore('in_progress', { warnedAt: T0 + 6 * HOUR });
    expectOk(ar.sweepIdle(T0 + 7 * HOUR));
    expect(ar.pullEvents()).toEqual([]);
  });

  it('warnedAt и continueInvitedAt независимы; updatedAt прежний', () => {
    const ar = restore('in_progress');
    expectOk(ar.sweepIdle(T0 + 3 * HOUR));
    expectOk(ar.sweepIdle(T0 + 6 * HOUR));
    const state = ar.snapshot();
    expect(state.continueInvitedAt).toBe(T0 + 3 * HOUR);
    expect(state.warnedAt).toBe(T0 + 6 * HOUR);
    expect(state.updatedAt).toBe(T0);
  });
});

describe('sweepIdle — invited (Т7)', () => {
  it.each([4, 7])('%s ч: Ok без флагов и событий', (hours) => {
    const ar = restore('invited');
    expectOk(ar.sweepIdle(T0 + hours * HOUR));
    expect(ar.snapshot()).toEqual(stored('invited'));
    expect(ar.pullEvents()).toEqual([]);
  });

  it('9 ч: закрывается с событием abandoned { timeout }', () => {
    const ar = restore('invited');
    expectOk(ar.sweepIdle(T0 + 9 * HOUR));
    expect(ar.snapshot()).toMatchObject({
      status: 'abandoned',
      abandonReason: 'timeout',
    });
    expect(eventNames(ar)).toEqual([QuestionnaireEvents.abandoned.name]);
  });
});

describe('needsSweep и idleFor', () => {
  it('false до 3 ч; true на 3 ч; false после приглашения; true на 6 ч и на 9 ч', () => {
    const ar = restore('in_progress');
    expect(ar.needsSweep(T0 + 2 * HOUR)).toBe(false);
    expect(ar.needsSweep(T0 + 3 * HOUR)).toBe(true);
    expectOk(ar.sweepIdle(T0 + 3 * HOUR));
    expect(ar.needsSweep(T0 + 4 * HOUR)).toBe(false);
    expect(ar.needsSweep(T0 + 6 * HOUR)).toBe(true);
    expectOk(ar.sweepIdle(T0 + 6 * HOUR));
    expect(ar.needsSweep(T0 + 8 * HOUR)).toBe(false);
    expect(ar.needsSweep(T0 + 9 * HOUR)).toBe(true);
  });

  it.each(['completed', 'abandoned'] as const)('%s — false', (status) => {
    const ar = restore(status, {
      abandonReason: status === 'abandoned' ? 'timeout' : undefined,
    });
    expect(ar.needsSweep(T0 + 20 * HOUR)).toBe(false);
  });

  it('idleFor считается от updatedAt, а не от флага', () => {
    const ar = restore('in_progress');
    expectOk(ar.sweepIdle(T0 + 4 * HOUR));
    expect(ar.idleFor(T0 + 5 * HOUR)).toBe(5 * HOUR);
  });
});

describe('сброс флагов при активности', () => {
  const flagged = { warnedAt: T0 + 5 * HOUR, continueInvitedAt: T0 + 3 * HOUR };

  it('handleAction сбрасывает оба флага и сдвигает updatedAt', () => {
    const ar = restore('in_progress', flagged);
    expectOk(
      ar.handleAction(T0 + 6 * HOUR, { type: 'callback', value: 'yes' }),
    );
    const state = ar.snapshot();
    expect(state.warnedAt).toBeUndefined();
    expect(state.continueInvitedAt).toBeUndefined();
    expect(state.updatedAt).toBe(T0 + 6 * HOUR);
  });

  it('start (invited, стандартная) сбрасывает оба флага', () => {
    const ar = restore('invited', flagged);
    expectOk(ar.start(T0 + 6 * HOUR));
    const state = ar.snapshot();
    expect(state.status).toBe('in_progress');
    expect(state.warnedAt).toBeUndefined();
    expect(state.continueInvitedAt).toBeUndefined();
  });

  it('после возобновления цепочка ступеней начинается заново', () => {
    const ar = restore('in_progress', flagged);
    expectOk(
      ar.handleAction(T0 + 6 * HOUR, { type: 'callback', value: 'yes' }),
    );
    ar.pullEvents();
    expectOk(ar.sweepIdle(T0 + 9 * HOUR));
    expect(eventNames(ar)).toEqual([QuestionnaireEvents.continueInvite.name]);
  });
});
