import { beforeEach, describe, expect, it } from 'bun:test';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import { FindStreamByTelegramGroupUc } from './find-stream-by-telegram-group.uc';
import { GetStreamUc } from './get-stream.uc';
import { GetStreamMembersUc } from './get-stream-members.uc';
import { GetStreamPresenceUc } from './get-stream-presence.uc';
import { ListStreamsUc } from './list-streams.uc';
import {
  admin,
  anonymous,
  fact,
  MENTOR_ID,
  makeEnv,
  mentor,
  otherMentor,
  REQ,
  SCHOOL,
  STREAM,
  state,
  student,
  system,
} from './stream-uc.fixture';

// Перенос `get-stream-uc`, `list-streams-uc`, `stream-in-proc-facade` (getMembers),
// `get-stream-members.uc`: чтение открыто всем (allowAll), включая гостя;
// ключ записи в ответ не попадает (С1).

let env: ReturnType<typeof makeEnv>;
beforeEach(() => {
  env = makeEnv();
});

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '33333333-3333-4333-8333-333333333334';

describe('GetStreamUc', () => {
  const uc = () => new GetStreamUc(env.deps, StreamModuleDef);
  beforeEach(() =>
    env.streams.seed(state('active', { title: 'Тестовый поток' })),
  );

  it('возвращает поток по streamId (даты — числа)', async () => {
    const view = expectOk(
      await uc().handle({ streamId: STREAM }, student, REQ),
    );

    expect(view).toMatchObject({
      uuid: STREAM,
      title: 'Тестовый поток',
      status: 'active',
      mentorId: MENTOR_ID,
      schoolId: SCHOOL,
    });
    expect(typeof view.startDate).toBe('number');
  });

  it('гость читает без ограничений', async () => {
    expectOk(await uc().handle({ streamId: STREAM }, anonymous, REQ));
  });

  it('вызывающий system не допущен (callers: user, guest) — UNAUTHORIZED', async () => {
    const res = await uc().handle({ streamId: STREAM }, system as never, REQ);

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'system',
    });
  });

  it('нет потока — STREAM_NOT_FOUND «Поток не найден»', async () => {
    const other = '99999999-9999-4999-8999-999999999999';

    const error = expectErr(
      await uc().handle({ streamId: other }, student, REQ),
      'STREAM_NOT_FOUND',
    );

    expect(error.label).toBe('Поток не найден');
    expect(error.payload).toEqual({ streamId: other });
  });

  it.each([
    ['ментор потока', mentor, true],
    ['админ', admin, true],
    ['чужой ментор', otherMentor, false],
    ['студент', student, false],
    ['гость', anonymous, false],
  ] as const)('canManage для: %s — %s', async (_, caller, expected) => {
    const view = expectOk(await uc().handle({ streamId: STREAM }, caller, REQ));

    expect(view.canManage).toBe(expected);
  });

  it('кодовое слово не отдаётся: requiresEnrollmentKey вместо enrollmentKey (С1)', async () => {
    env.streams.seed(state('active', { enrollmentKey: 'секрет' }));

    const view = expectOk(
      await uc().handle({ streamId: STREAM }, student, REQ),
    );

    expect('enrollmentKey' in view).toBe(false);
    expect(view.requiresEnrollmentKey).toBe(true);
  });

  it('без ключа requiresEnrollmentKey = false', async () => {
    const view = expectOk(
      await uc().handle({ streamId: STREAM }, student, REQ),
    );

    expect(view.requiresEnrollmentKey).toBe(false);
  });
});

describe('ListStreamsUc', () => {
  const uc = () => new ListStreamsUc(env.deps, StreamModuleDef);

  it('фильтр status, mentorId, schoolId уходит в репозиторий как есть', async () => {
    env.answerWith(state('active'));

    const list = expectOk(
      await uc().handle(
        { status: 'active', mentorId: MENTOR_ID, schoolId: SCHOOL },
        student,
        REQ,
      ),
    );

    expect(env.asked.filter).toEqual({
      status: 'active',
      mentorId: MENTOR_ID,
      schoolId: SCHOOL,
    });
    expect(list).toHaveLength(1);
    expect(list[0]?.schoolId).toBe(SCHOOL);
  });

  it('только schoolId — фильтр { schoolId }', async () => {
    env.answerWith(state('enrollment'));

    expectOk(await uc().handle({ schoolId: SCHOOL }, student, REQ));

    expect(env.asked.filter).toEqual({ schoolId: SCHOOL });
  });

  it('без фильтра — все потоки; гость допущен', async () => {
    env.answerWith(state('enrollment'), state('archived', { uuid: U1 }));

    const list = expectOk(await uc().handle({}, anonymous, REQ));

    expect(list.map((s) => s.status)).toEqual(['enrollment', 'archived']);
  });

  it('кодовое слово не отдаётся', async () => {
    env.answerWith(state('enrollment', { enrollmentKey: 'секрет' }));

    const [view] = expectOk(await uc().handle({}, student, REQ));

    expect(view && 'enrollmentKey' in view).toBe(false);
    expect(view?.requiresEnrollmentKey).toBe(true);
  });

  it('пусто — пустой список', async () => {
    env.answerWith();

    expect(expectOk(await uc().handle({}, student, REQ))).toEqual([]);
  });
});

describe('FindStreamByTelegramGroupUc', () => {
  const uc = () => new FindStreamByTelegramGroupUc(env.deps, StreamModuleDef);

  it('группа привязана к потоку — представление потока', async () => {
    env.answerWith(state('active', { telegramGroupId: '-1001234567890' }));

    const view = expectOk(
      await uc().handle({ telegramGroupId: '-1001234567890' }, anonymous, REQ),
    );

    expect(env.asked.telegramGroupId).toBe('-1001234567890');
    expect(view).toMatchObject({ uuid: STREAM, mentorId: MENTOR_ID });
  });

  it('чужая группа — Ok(undefined), не ошибка', async () => {
    env.answerWith(state('active', { telegramGroupId: '-1001234567890' }));

    expect(
      expectOk(await uc().handle({ telegramGroupId: '-100999' }, student, REQ)),
    ).toBeUndefined();
  });

  it('кодовое слово не отдаётся', async () => {
    env.answerWith(
      state('active', { telegramGroupId: '-100', enrollmentKey: 'секрет' }),
    );

    const view = expectOk(
      await uc().handle({ telegramGroupId: '-100' }, student, REQ),
    );

    expect(view && 'enrollmentKey' in view).toBe(false);
  });
});

describe('GetStreamMembersUc', () => {
  const uc = () => new GetStreamMembersUc(env.deps, StreamModuleDef);

  it('нет потока — Ok(undefined), не ошибка', async () => {
    expect(
      expectOk(await uc().handle({ streamId: STREAM }, system, REQ)),
    ).toBeUndefined();
  });

  it('ментор и студенты: сырые статусы, studentId, inProgress, neverStarted; settled не отдаётся', async () => {
    env.streams.seed(state('completed'));
    const advanced = fact(U1, 'advanced');
    const notAdvanced = fact(U2, 'not_advanced');
    const enrolled = fact(U3, 'enrolled');
    const active = fact(MENTOR_ID, 'active');
    const never = fact('44444444-4444-4444-8444-444444444445', 'abandoned', {
      neverStarted: true,
    });
    const started = fact('55555555-5555-4555-8555-555555555556', 'abandoned');
    env.students.facts = [
      advanced,
      notAdvanced,
      enrolled,
      active,
      never,
      started,
    ];

    const members = expectOk(
      await uc().handle({ streamId: STREAM }, system, REQ),
    );

    expect(members?.mentorId).toBe(MENTOR_ID);
    expect(members?.students).toEqual(
      [advanced, notAdvanced, enrolled, active, never, started].map((f) => ({
        studentId: f.studentId,
        userId: f.userId,
        status: f.status,
        neverStarted: f.neverStarted,
        inProgress: f.inProgress,
      })),
    );
    expect(
      members?.students.map((s) => [s.status, s.neverStarted, s.inProgress]),
    ).toEqual([
      ['advanced', false, false],
      ['not_advanced', false, false],
      ['enrolled', false, true],
      ['active', false, true],
      ['abandoned', true, false],
      ['abandoned', false, false],
    ]);
    expect(env.students.asked).toEqual([STREAM]);
  });

  it('пользователь и гость тоже читают состав', async () => {
    env.streams.seed(state('active'));

    expectOk(await uc().handle({ streamId: STREAM }, student, REQ));
    expectOk(await uc().handle({ streamId: STREAM }, anonymous, REQ));
  });
});

describe('GetStreamPresenceUc', () => {
  const uc = () => new GetStreamPresenceUc(env.deps, StreamModuleDef);

  it('поток есть — exists: true', async () => {
    env.streams.seed(state('active'));

    expect(
      expectOk(await uc().handle({ streamId: STREAM }, system, REQ)),
    ).toEqual({
      exists: true,
    });
  });

  it('потока нет — exists: false без ошибки', async () => {
    expect(
      expectOk(await uc().handle({ streamId: STREAM }, system, REQ)),
    ).toEqual({
      exists: false,
    });
  });
});
