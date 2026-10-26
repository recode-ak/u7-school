import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { WishEvents } from './wish.events';

const USER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const STREAM = '3a2b1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d';
const COURSE = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const MODULE = '1f2e3d4c-5b6a-4978-8695-a4b3c2d1e0f9';

const valid = (schema: v.GenericSchema, payload: unknown) =>
  v.safeParse(schema, payload).success;

describe('WishEvents.invited', () => {
  const { payload } = WishEvents.invited;
  const course = {
    userId: USER,
    telegramId: 123456789,
    streamId: STREAM,
    targetKind: 'course' as const,
    courseId: COURSE,
  };
  const module = {
    userId: USER,
    telegramId: 123456789,
    streamId: STREAM,
    targetKind: 'module' as const,
    moduleId: MODULE,
  };

  it('FQN — wish.wish.invited', () => {
    expect(WishEvents.invited.name).toBe('wish.wish.invited');
  });

  it('payload курса и модуля — допустим', () => {
    expect(v.parse(payload, course)).toEqual(course);
    expect(v.parse(payload, module)).toEqual(module);
  });

  it('payload без адресата или с целью не своей ветки — недопустим', () => {
    const { telegramId: _, ...noAddressee } = course;
    expect(valid(payload, noAddressee)).toBe(false);
    expect(valid(payload, { ...course, targetKind: 'module' })).toBe(false);
    expect(valid(payload, { ...course, streamId: 'x' })).toBe(false);
    expect(valid(payload, { ...course, telegramId: 1.5 })).toBe(false);
  });
});

describe('WishEvents.confirmed', () => {
  const { payload } = WishEvents.confirmed;

  it('FQN — wish.wish.confirmed', () => {
    expect(WishEvents.confirmed.name).toBe('wish.wish.confirmed');
  });

  it('payload { userId, courseId } — допустим', () => {
    const ok = { userId: USER, courseId: COURSE };
    expect(v.parse(payload, ok)).toEqual(ok);
  });

  it('payload без курса или с невалидным uuid — недопустим', () => {
    expect(valid(payload, { userId: USER })).toBe(false);
    expect(valid(payload, { userId: 'x', courseId: COURSE })).toBe(false);
  });
});
