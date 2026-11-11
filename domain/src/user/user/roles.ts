import * as v from 'valibot';

// ══ Роли пользователей ══

/**
 * Роли пользователей платформы u7-school.
 * - GUEST: гость, только что начавший взаимодействие с ботом
 * - SUBSCRIBER: подписчик Telegram-канала
 * - MENTOR: наставник, проверяющий задания и ведущий потоки
 * - AUTHOR: автор программы — создаёт модули, курсы, уроки, шаги, проекты
 * - ADMIN: администратор платформы
 */
export enum Role {
  GUEST = 'GUEST',
  SUBSCRIBER = 'SUBSCRIBER',
  MENTOR = 'MENTOR',
  AUTHOR = 'AUTHOR',
  ADMIN = 'ADMIN',
}

/** Valibot-схема для валидации роли пользователя */
export const RoleSchema = v.picklist(
  [Role.GUEST, Role.SUBSCRIBER, Role.MENTOR, Role.AUTHOR, Role.ADMIN],
  `Недопустимая роль. Ожидается: ${Object.keys(Role).join(',')}`,
);
