import { Role, type User } from '@u7-scl/domain/user/contract';
import { PolicyDef, type ReadonlyAr, Rule } from 'dmg-core';
import type { StreamAr } from './stream.ar';

/** Субъект прав потока: кто спрашивает и какие у него роли. */
type StreamSubject = Pick<User, 'uuid' | 'roles'>;

/** Контекст прав на поток: поток, над которым действие. */
export type StreamCtx = { readonly stream: ReadonlyAr<StreamAr> };

const canCreate = Rule.of({
  name: 'canCreate',
  label: 'Ментор',
  denyMessage: 'Недостаточно прав для создания потока',
  check: (subject: StreamSubject) => subject.roles.includes(Role.MENTOR),
});

const isStreamMentor = Rule.of({
  name: 'isStreamMentor',
  label: 'Ментор потока',
  denyMessage: 'Недостаточно прав для управления потоком',
  check: (subject: StreamSubject, ctx: StreamCtx) =>
    ctx.stream.isMentoredBy(subject.uuid),
});

const isAdmin = Rule.of({
  name: 'isAdmin',
  label: 'Администратор',
  denyMessage: 'Недостаточно прав для управления потоком',
  check: (subject: StreamSubject) => subject.roles.includes(Role.ADMIN),
});

/**
 * Права на потоки. Создаёт поток роль `MENTOR` (администратор без неё —
 * нет, как в legacy); управляет ментор потока или администратор. Чтение
 * открыто всем — `allowAll` в Def UC.
 */
export const StreamPolicy = PolicyDef.define({
  name: 'stream',
  label: 'Права на потоки',
  description:
    'Кто создаёт поток — ментор; кто управляет потоком — его ментор или администратор.',
  rules: {
    canCreate,
    canManage: Rule.anyOf(
      {
        name: 'canManage',
        label: 'Ментор потока или администратор',
        denyMessage: 'Недостаточно прав для управления потоком',
      },
      isStreamMentor,
      isAdmin,
    ),
  },
});
