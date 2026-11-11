import { describe, expect, mock, test } from 'bun:test';
import {
  FindStreamByTelegramGroupUcDef,
  GetStreamMembersUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import {
  GetUserByTelegramIdUcDef,
  GetUserUcDef,
} from '@u7-scl/domain/user/contract';
import { ok, UserCaller } from 'dmg-core';
import { StreamsController } from './controller';

// Перенос `controller.test.ts` (handleMessengerEvent, FR-7) на UC DMG
// (поток по группе — `findStreamByTelegramGroup`, студенты —
// `getStreamMembers` (`inProgress` вместо `new StudentAr` в контроллере).
// Тексты уведомлений ментору — как в v0.2.6. Ментор и пользователь — UC DMG
// модуля `user` (`getUser`, `getUserByTelegramId`).

const GROUP = '-1001234567890';
const MENTOR_ID = '11111111-1111-4111-8111-aaaaaaaaaaa6';
const STUDENT_ID = '33333333-3333-4333-8333-333333333333';
const STREAM = {
  uuid: '11111111-1111-4111-8111-111111111111',
  title: 'JavaScript с нуля',
  telegramGroupId: GROUP,
  mentorId: MENTOR_ID,
};
const mentor = {
  uuid: MENTOR_ID,
  name: 'Ментор Иван',
  telegramId: 999999,
  roles: ['MENTOR'],
};
const studentUser = {
  uuid: STUDENT_ID,
  name: 'Петр Студентов',
  telegramId: 777,
  roles: ['GUEST'],
};

/** Отказ UC «пользователь не найден» — как у `getUser`/`getUserByTelegramId`. */
const userNotFound = () => ({
  ok: false as const,
  error: { code: 'USER_NOT_FOUND', kind: 'not_found', payload: {} },
});

type Member = {
  studentId: string;
  userId: string;
  status: string;
  neverStarted: boolean;
  inProgress: boolean;
};
const member = (status: 'active' | 'enrolled' | 'abandoned'): Member => ({
  studentId: '22222222-2222-4222-8222-222222222222',
  userId: STUDENT_ID,
  status,
  neverStarted: false,
  inProgress: status !== 'abandoned',
});

function setup(options: { students?: Member[]; failOn?: string } = {}) {
  const controller = new StreamsController();
  const notify = mock(async () => {});
  const dispatched: { uc: string; input: unknown; module: unknown }[] = [];
  const dispatch = mock(
    async (module: unknown, command: { uc: string; input: unknown }) => {
      dispatched.push({ uc: command.uc, input: command.input, module });
      if (command.uc === options.failOn) throw new Error('сбой');
      if (command.uc === FindStreamByTelegramGroupUcDef.name) {
        const id = (command.input as { telegramGroupId: string })
          .telegramGroupId;
        return ok(id === GROUP ? STREAM : undefined);
      }
      if (command.uc === GetStreamMembersUcDef.name) {
        return ok({
          mentorId: STREAM.mentorId,
          students: options.students ?? [],
        });
      }
      if (command.uc === GetUserByTelegramIdUcDef.name) {
        const { telegramId } = command.input as { telegramId: number };
        return telegramId === studentUser.telegramId
          ? ok(studentUser)
          : userNotFound();
      }
      if (command.uc === GetUserUcDef.name) {
        const { uuid } = command.input as { uuid: string };
        return uuid === MENTOR_ID ? ok(mentor) : userNotFound();
      }
      throw new Error(`неожиданная команда ${command.uc}`);
    },
  );
  const callers = {
    resolve: async () => new UserCaller(studentUser),
  };
  controller.init(
    { appApi: { dispatch }, callers } as never,
    { notify, execute: mock(async () => {}) } as never,
  );
  return { controller, notify, dispatched };
}

const event = (
  kind: 'member_joined' | 'member_left',
  id: number,
  chatId = GROUP,
) =>
  ({
    kind,
    chatId,
    user: { id, firstName: 'Аноним', username: 'anon' },
  }) as never;

describe('StreamsController.handleMessengerEvent на UC DMG', () => {
  test('поток ищется командой findStreamByTelegramGroup модуля stream со строковым id группы', async () => {
    const { controller, dispatched } = setup();

    await controller.handleMessengerEvent({
      kind: 'member_joined',
      chatId: -1001234567890 as never,
      user: { id: 888, firstName: 'Аноним' },
    });

    expect(dispatched[0]).toMatchObject({
      uc: 'findStreamByTelegramGroup',
      input: { telegramGroupId: GROUP },
      module: StreamModuleDef,
    });
  });

  test('чужая группа → pass, студентов не спрашивали, ментору ничего', async () => {
    const { controller, notify, dispatched } = setup();

    const result = await controller.handleMessengerEvent(
      event('member_joined', 888, '-100999'),
    );

    expect(result).toBe('pass');
    expect(notify).not.toHaveBeenCalled();
    expect(dispatched.map((d) => d.uc)).toEqual(['findStreamByTelegramGroup']);
  });

  test('member_joined: неизвестный участник → ментору предупреждение и stop', async () => {
    const { controller, notify, dispatched } = setup({ students: [] });

    const result = await controller.handleMessengerEvent(
      event('member_joined', 888),
    );

    expect(result).toBe('stop');
    expect(dispatched.map((d) => d.uc)).toEqual([
      'findStreamByTelegramGroup',
      'getStreamMembers',
      'getUserByTelegramId',
      'getUser',
    ]);
    expect(dispatched[1]?.input).toEqual({ streamId: STREAM.uuid });
    expect(notify).toHaveBeenCalledTimes(1);
    const [tgId, payload] = notify.mock.calls[0] as unknown as [
      number,
      { text: string },
    ];
    expect(tgId).toBe(999999);
    expect(payload.text).toContain(
      '⚠️ В группу «JavaScript с нуля» вступил неизвестный участник: Аноним \\(@anon\\)',
    );
    expect(payload.text).toContain('Он не числится студентом этого потока');
  });

  test.each(['active', 'enrolled'] as const)(
    'member_joined: студент потока (%s) → ментору предупреждения нет, stop',
    async (status) => {
      const { controller, notify } = setup({ students: [member(status)] });

      const result = await controller.handleMessengerEvent(
        event('member_joined', 777),
      );

      expect(result).toBe('stop');
      expect(notify).not.toHaveBeenCalled();
    },
  );

  test('member_joined: студент уже не учится (abandoned) → предупреждение ментору', async () => {
    const { controller, notify } = setup({ students: [member('abandoned')] });

    await controller.handleMessengerEvent(event('member_joined', 777));

    expect(notify).toHaveBeenCalledTimes(1);
  });

  test('member_left: активный студент вышел → ментору «🚪 Студент … покинул группу»', async () => {
    const { controller, notify } = setup({ students: [member('active')] });

    const result = await controller.handleMessengerEvent(
      event('member_left', 777),
    );

    expect(result).toBe('stop');
    expect(notify).toHaveBeenCalledTimes(1);
    const [tgId, payload] = notify.mock.calls[0] as unknown as [
      number,
      { text: string },
    ];
    expect(tgId).toBe(999999);
    expect(payload.text).toContain(
      '🚪 Студент Петр Студентов покинул группу «JavaScript с нуля»',
    );
  });

  test('member_left: выбывший студент (abandoned) → уведомления нет, stop', async () => {
    const { controller, notify } = setup({ students: [member('abandoned')] });

    const result = await controller.handleMessengerEvent(
      event('member_left', 777),
    );

    expect(result).toBe('stop');
    expect(notify).not.toHaveBeenCalled();
  });

  test('member_left: пользователь неизвестен → уведомления нет, stop', async () => {
    const { controller, notify } = setup({ students: [member('active')] });

    const result = await controller.handleMessengerEvent(
      event('member_left', 555),
    );

    expect(result).toBe('stop');
    expect(notify).not.toHaveBeenCalled();
  });

  test('исключение при обработке → stop, ментору ничего', async () => {
    const { controller, notify } = setup({ failOn: 'getStreamMembers' });

    const result = await controller.handleMessengerEvent(
      event('member_joined', 888),
    );

    expect(result).toBe('stop');
    expect(notify).not.toHaveBeenCalled();
  });
});
