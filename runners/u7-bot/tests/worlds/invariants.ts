import {
  CourseArDef,
  CourseProgramInvariant,
} from '@u7-scl/domain/course/testing';
import type { StudentOutcome } from '@u7-scl/domain/peer-review/contract';
import type { StreamState } from '@u7-scl/domain/stream/testing';
import { Role } from '@u7-scl/domain/user/testing';
import * as v from 'valibot';
import type { WorldState, WorldUser } from './types';

/** Нарушение инварианта мира */
export interface InvariantViolation {
  code: string;
  message: string;
  entity: string;
  id: string;
}

/** Сопоставление исхода кампании и допустимых статусов студента */
const OUTCOME_TO_STATUSES: Record<StudentOutcome, string[]> = {
  completed_passed: ['advanced', 'active'],
  completed_not_passed: ['not_advanced'],
  dropped: ['abandoned', 'active'],
  never_started: ['enrolled'],
};

/**
 * Валидирует все инварианты WorldState и возвращает список нарушений.
 */
export function checkWorldInvariants(state: WorldState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  const usersById = new Map<string, WorldUser>(
    state.users.map((u) => [u.uuid, u]),
  );
  const streamsById = new Map<string, StreamState>(
    state.streams.map((s) => [s.uuid, s]),
  );

  // 1. Инварианты студента: пользователь и хронология (роль STUDENT stream
  // не ведёт)
  for (const st of state.students) {
    const user = usersById.get(st.userId);
    if (!user) {
      violations.push({
        code: 'STUDENT_USER_NOT_FOUND',
        message: `Студент ${st.uuid} ссылается на неизвестного пользователя ${st.userId}`,
        entity: 'Student',
        id: st.uuid,
      });
      continue;
    }

    // Хронология: регистрация пользователя <= зачисление студента
    const userCreated = user.createdAt;
    const enrolled = st.enrolledAt;
    if (userCreated > enrolled) {
      violations.push({
        code: 'CHRONOLOGY_REGISTRATION_AFTER_ENROLLMENT',
        message: `Дата регистрации пользователя "${user.name}" (${new Date(user.createdAt).toISOString()}) позже даты зачисления в поток (${new Date(st.enrolledAt).toISOString()})`,
        entity: 'Student',
        id: st.uuid,
      });
    }

    // Хронология: если студент уже учится / завершил поток, его регистрация не может быть позже старта потока
    const streamEntity = streamsById.get(st.streamId);
    if (streamEntity && st.status !== 'enrolled') {
      const streamStart = streamEntity.startDate;
      if (userCreated > streamStart) {
        violations.push({
          code: 'CHRONOLOGY_REGISTRATION_AFTER_STREAM_START',
          message: `Дата регистрации пользователя "${user.name}" (${new Date(user.createdAt).toISOString()}) позже старта потока "${streamEntity.title}" (${new Date(streamEntity.startDate).toISOString()})`,
          entity: 'Student',
          id: st.uuid,
        });
      }
    }
  }

  // 2. Инвариант роли ментора потока
  for (const s of state.streams) {
    const mentor = usersById.get(s.mentorId);
    if (!mentor) {
      violations.push({
        code: 'STREAM_MENTOR_NOT_FOUND',
        message: `Поток "${s.title}" ссылается на неизвестного ментора ${s.mentorId}`,
        entity: 'Stream',
        id: s.uuid,
      });
      continue;
    }

    const hasMentorRole = mentor.roles.some((r) => r === Role.MENTOR);
    if (!hasMentorRole) {
      violations.push({
        code: 'MENTOR_ROLE_MISMATCH',
        message: `Ментор "${mentor.name}" (${mentor.uuid}) ведёт поток "${s.title}", но не имеет роли MENTOR (роли: ${mentor.roles.join(', ')})`,
        entity: 'Stream',
        id: s.uuid,
      });
    }
  }

  // 3. Инварианты курса: state и программа (метки этапов в порядке программы)
  for (const c of state.courses) {
    const course = v.safeParse(CourseArDef.state, c);
    if (!course.success) {
      violations.push({
        code: 'COURSE_STATE_INVALID',
        message: `Курс "${c.title}" (${c.uuid}): ${course.issues[0]?.message}`,
        entity: 'Course',
        id: c.uuid,
      });
      continue;
    }

    const program = v.safeParse(CourseProgramInvariant, {
      moduleIds: course.output.moduleIds,
      phases: course.output.phases,
    });
    if (!program.success) {
      violations.push({
        code: 'COURSE_PROGRAM_INVALID',
        message: `Курс "${c.title}" (${c.uuid}): ${program.issues[0]?.message}`,
        entity: 'Course',
        id: c.uuid,
      });
    }
  }

  // 4. Инвариант роли автора курса
  for (const c of state.courses) {
    const author = usersById.get(c.authorId);
    if (author) {
      const hasAuthorRole = author.roles.some((r) => r === Role.AUTHOR);
      if (!hasAuthorRole) {
        violations.push({
          code: 'AUTHOR_ROLE_MISMATCH',
          message: `Автор "${author.name}" курса "${c.title}" не имеет роли AUTHOR`,
          entity: 'Course',
          id: c.uuid,
        });
      }
    }
  }

  // 5. Инварианты кампаний отзывов
  for (const cmp of state.campaigns) {
    // 5.1. Окно кампании: createdAt < expiresAt
    const createdTime = cmp.createdAt;
    const expiresTime = cmp.expiresAt;
    if (expiresTime <= createdTime) {
      violations.push({
        code: 'CAMPAIGN_WINDOW_INVALID',
        message: `Окно кампании ${cmp.uuid}: дата закрытия (${new Date(cmp.expiresAt).toISOString()}) не позже даты создания (${new Date(cmp.createdAt).toISOString()}) (expiresAt <= createdAt)`,
        entity: 'ReviewCampaign',
        id: cmp.uuid,
      });
    }

    // 5.2. Связь со студентом: согласованность исхода и даты
    const st = state.students.find(
      (s) => s.streamId === cmp.scopeId && s.userId === cmp.subjectId,
    );
    if (!st) {
      const stream = streamsById.get(cmp.scopeId);
      if (stream?.status === 'completed' || stream?.status === 'archived') {
        continue;
      }
      violations.push({
        code: 'CAMPAIGN_SUBJECT_NOT_FOUND',
        message: `Субъект кампании ${cmp.subjectId} не найден среди студентов потока ${cmp.scopeId}`,
        entity: 'ReviewCampaign',
        id: cmp.uuid,
      });
      continue;
    }

    // Согласованность исхода кампании и статуса студента
    const outcome = cmp.payload.subjectOutcome;
    const allowed = OUTCOME_TO_STATUSES[outcome];
    if (!allowed?.includes(st.status)) {
      violations.push({
        code: 'CAMPAIGN_FATE_MISMATCH',
        message: `Судьба кампании "${outcome}" противоречит статусу студента "${st.status}" (ожидалось: ${allowed?.join(', ')})`,
        entity: 'ReviewCampaign',
        id: cmp.uuid,
      });
    }

    // Хронология: кампания не может быть создана раньше зачисления студента
    const enrolledTime = st.enrolledAt;
    if (createdTime < enrolledTime) {
      violations.push({
        code: 'CAMPAIGN_CREATED_BEFORE_ENROLLMENT',
        message: `Окно кампании (${new Date(cmp.createdAt).toISOString()}) создано раньше зачисления/исхода студента (${new Date(st.enrolledAt).toISOString()})`,
        entity: 'ReviewCampaign',
        id: cmp.uuid,
      });
    }
  }

  return violations;
}

/**
 * Проверяет все инварианты WorldState и выбрасывает ошибку при первом нарушении.
 */
export function assertWorldInvariants(state: WorldState): void {
  const violations = checkWorldInvariants(state);
  const first = violations[0];
  if (first) {
    throw new Error(`Инвариант нарушен [${first.code}]: ${first.message}`);
  }
}
