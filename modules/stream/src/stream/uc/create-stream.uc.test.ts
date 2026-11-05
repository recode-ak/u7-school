import { beforeEach, describe, expect, it } from 'bun:test';
import {
  CourseModuleDef,
  GetModuleSnapshotUcDef,
} from '@u7-scl/domain/course/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { err } from 'dmg-core';
import { ModuleFacades } from 'dmg-core/app';
import { expectErr, expectOk, StubFacade } from 'dmg-core/testing';
import { CreateStreamUc } from './create-stream.uc';
import {
  contentSnapshot,
  guestRole,
  MENTOR_ID,
  MODULE,
  makeEnv,
  mentor,
  REQ,
  SCHOOL,
  START,
  T0,
} from './stream-uc.fixture';

// Перенос `api/stream/create-stream-uc.test.ts`.
// Сохраняется: статус enrollment, необязательные поля, ключа без enrollmentKey нет,
// schoolId — школа приложения, снимок модуля в момент создания, created после
// записи, гость и не-ментор — отказ. Новое: ментор — субъект.

let env: ReturnType<typeof makeEnv>;
let uc: CreateStreamUc;

beforeEach(() => {
  env = makeEnv();
  uc = new CreateStreamUc(env.deps, StreamModuleDef);
});

const input = {
  title: 'Новый курс',
  description: 'Описание',
  moduleId: MODULE,
  startDate: START,
};

describe('CreateStreamUc — успех', () => {
  it('ментор создаёт поток: enrollment, mentorId из субъекта, schoolId из школы, снимок модуля', async () => {
    const { streamId } = expectOk(await uc.handle(input, mentor, REQ));

    expect(env.streams.saved).toHaveLength(1);
    expect(env.streams.saved[0]).toEqual({
      uuid: streamId,
      schoolId: SCHOOL,
      mentorId: MENTOR_ID,
      title: 'Новый курс',
      description: 'Описание',
      moduleId: MODULE,
      startDate: START,
      status: 'enrollment',
      contentSnapshot,
      createdAt: T0,
      updatedAt: T0,
      version: 0,
    });
    expect(env.ctx.published).toHaveLength(1);
    expect(env.ctx.published[0]).toMatchObject({
      name: 'stream.stream.created',
      aggregateId: streamId,
      payload: { streamId, moduleId: MODULE },
    });
  });

  it('снимок модуля берётся у курса по moduleId от имени операции', async () => {
    expectOk(await uc.handle(input, mentor, REQ));

    expect(env.course.received).toHaveLength(1);
    expect(env.course.received[0]?.input).toEqual({ moduleId: MODULE });
  });

  it('необязательные поля копируются, enrollmentKey сохраняется', async () => {
    const optional = {
      telegramGroupId: 'tg1',
      telegramGroupInvite: 'https://t.me/+abc123',
      goal: 'Цель',
      result: 'Результат',
      rules: 'Правила',
      additional: 'Доп',
      targetAudience: 'Студенты',
      enrollmentKey: 'секретное-слово',
    };
    expectOk(await uc.handle({ ...input, ...optional }, mentor, REQ));

    expect(env.streams.saved[0]).toMatchObject(optional);
  });

  it('без enrollmentKey ключа в записи нет', async () => {
    expectOk(await uc.handle(input, mentor, REQ));

    expect('enrollmentKey' in (env.streams.saved[0] ?? {})).toBe(false);
  });
});

describe('CreateStreamUc — отказы', () => {
  it('пользователь с ролью GUEST — ACCESS_DENIED, ничего не записано', async () => {
    const res = await uc.handle(input, guestRole, REQ);

    expectErr(res, 'ACCESS_DENIED');
    expect(env.streams.saved).toEqual([]);
    expect(env.course.received).toEqual([]);
  });

  it('модуль не найден — MODULE_NOT_FOUND (ModuleErrors.NOT_FOUND, Т8), ничего не записано', async () => {
    const missing = new StubFacade(CourseModuleDef).answer(
      GetModuleSnapshotUcDef,
      () =>
        err({
          code: 'MODULE_NOT_FOUND',
          kind: 'not_found',
          label: 'Модуль не найден',
          description: 'Модуль не найден',
          payload: { moduleId: MODULE },
        }) as never,
    );
    const failed = new CreateStreamUc(
      { ...env.deps, facades: new ModuleFacades([missing]) },
      StreamModuleDef,
    );

    const res = await failed.handle(input, mentor, REQ);

    expectErr(res, 'MODULE_NOT_FOUND');
    expect(env.streams.saved).toEqual([]);
    expect(env.ctx.published).toEqual([]);
  });
});
