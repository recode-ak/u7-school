import { ErrorDef, F } from 'dmg-core';
import * as v from 'valibot';

/**
 * Ошибки агрегата `stream`. `label` — текст, который видит пользователь
 * (прежние тексты legacy-исключений); число студентов в него не входит —
 * `label` статичен, а список лежит в `payload`.
 */
export const StreamErrors = ErrorDef.define('STREAM', {
  NOT_FOUND: {
    kind: 'not_found',
    label: 'Поток не найден',
    description: 'Потока с таким идентификатором нет.',
    payload: v.object({ streamId: F.uuid('потока') }),
  },
  NOT_ENROLLING: {
    kind: 'conflict',
    label: 'Недопустимый переход статуса. Поток не может быть запущен.',
    description: 'Запустить можно только поток, в котором идёт набор.',
  },
  NOT_ACTIVE: {
    kind: 'conflict',
    label: 'Недопустимый переход статуса. Поток не может быть завершён.',
    description: 'Завершить можно только запущенный поток.',
  },
  NOT_COMPLETED: {
    kind: 'conflict',
    label: 'В архив можно отправить только завершённый поток.',
    description: 'В архив уходит только завершённый поток.',
  },
  ALREADY_ARCHIVED: {
    kind: 'conflict',
    label: 'Поток уже находится в архиве.',
    description: 'Поток в архиве больше не меняется.',
  },
  STUDENTS_IN_PROGRESS: {
    kind: 'conflict',
    label:
      'Нельзя завершить поток: есть студенты без исхода. Сначала укажите исход для каждого.',
    description:
      'Пока у кого-то из студентов нет итогового исхода (учится или только зачислен), поток не завершается.',
    payload: v.object({
      pending: v.pipe(
        v.array(
          v.object({
            userId: F.uuid('студента без исхода'),
            status: F.picklist(
              ['enrolled', 'active', 'abandoned', 'advanced', 'not_advanced'],
              'статуса студента в потоке',
            ),
          }),
        ),
        v.description('Студенты без исхода, блокирующие завершение'),
      ),
    }),
  },
  CONTENT_NOT_SYNCABLE: {
    kind: 'conflict',
    label: 'Контент потока нельзя обновить: поток завершён или в архиве.',
    description:
      'Снимок контента завершённого или архивного потока — история пройденного, он не меняется.',
  },
  SYNC_REMOVES_CURRENT_STEP: {
    kind: 'conflict',
    label:
      'Нельзя обновить контент: новая версия удаляет шаг, на котором стоят студенты.',
    description:
      'Обновление отклоняется целиком, если текущий шаг хотя бы одного идущего студента исчезает из нового снимка.',
    payload: v.object({
      students: v.pipe(
        v.array(
          v.object({
            studentId: F.uuid('студента на удаляемом шаге'),
            userId: F.uuid('пользователя-студента на удаляемом шаге'),
          }),
        ),
        v.description('Студенты, чей текущий шаг удаляется'),
      ),
    }),
  },
  SYNC_NEEDS_CONFIRMATION: {
    kind: 'conflict',
    label:
      'Список затронутых студентов изменился или не подтверждён. Перепроверьте предпросмотр.',
    description:
      'Обновление засчитывает шаги задним числом только подтверждённым студентам; затронут неподтверждённый — отказ.',
    payload: v.object({
      affected: v.pipe(
        v.array(F.uuid('затронутого студента')),
        v.description(
          'Актуальный список студентов, которым будут зачтены шаги',
        ),
      ),
    }),
  },
});
