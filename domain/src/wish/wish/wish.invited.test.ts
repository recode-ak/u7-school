import { describe, expect, it } from 'bun:test';
import { expectErr, expectOk } from 'dmg-core/testing';
import { WishInvitationDcs } from '../wish-invitation.dcs';
import { WishAr } from './wish.ar';
import type { WishStatus } from './wish.state';

// Желание помнит потоки, на которые приглашено
// (`invitedStreamIds`); повтор `stream.created` не приглашает повторно.

const WISH = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const USER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const COURSE = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const STREAM = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const OTHER_STREAM = '1f2e3d4c-5b6a-4978-8695-a4b3c2d1e0f9';
const MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
const T0 = Date.UTC(2026, 7, 26, 10);
const T1 = Date.UTC(2026, 7, 27);
const target = { kind: 'course' as const, courseId: COURSE };

const stored = (status: WishStatus, invitedStreamIds?: string[]) => ({
  uuid: WISH,
  userId: USER,
  target,
  status,
  ...(invitedStreamIds && { invitedStreamIds }),
  createdAt: T0,
  updatedAt: T0,
  version: 0,
});

describe('WishAr.invite — запоминает поток', () => {
  const to = { streamId: STREAM, telegramId: 42 };

  it('приглашение на второй поток дописывает к первому', () => {
    const ar = WishAr.restore(stored('expressed', [OTHER_STREAM]));
    expectOk(ar.invite(T1, to));
    expect(ar.snapshot().invitedStreamIds).toEqual([OTHER_STREAM, STREAM]);
  });

  it('повторное приглашение на тот же поток — WISH_ALREADY_INVITED, события нет', () => {
    const ar = WishAr.restore(stored('expressed', [STREAM]));
    const error = expectErr(ar.invite(T1, to), 'WISH_ALREADY_INVITED');
    expect(error.kind).toBe('conflict');
    expect(ar.pullEvents()).toEqual([]);
    expect(ar.snapshot().invitedStreamIds).toEqual([STREAM]);
  });
});

describe('WishInvitationDcs — отсев приглашённых', () => {
  const dcs = (wishes: readonly WishAr[]) =>
    new WishInvitationDcs(STREAM, MODULE, wishes);
  const match = { courses: { courseIds: [COURSE] } };
  const reach = {
    stream: { exists: true },
    addresses: { addresses: [{ userId: USER, telegramId: 42 }] },
  };

  it('уже приглашённое на этот поток желание — пустой reachQuestion, invite без приглашённых', () => {
    const invited = WishAr.restore(stored('expressed', [STREAM]));
    expect(dcs([invited]).reachQuestion(match)).toEqual({});

    const res = expectOk(dcs([invited]).invite(match, reach, T1));

    expect(res).toEqual({ invited: [], unreachable: [] });
    expect(invited.pullEvents()).toEqual([]);
  });

  it('приглашённое на другой поток — приглашается на этот', () => {
    const wish = WishAr.restore(stored('expressed', [OTHER_STREAM]));
    const res = expectOk(dcs([wish]).invite(match, reach, T1));
    expect(res.invited).toEqual([wish]);
    expect(wish.snapshot().invitedStreamIds).toEqual([OTHER_STREAM, STREAM]);
  });
});
