import * as v from 'valibot';
import { buildErrors } from './define-errors';

const Issues = v.object({
  issues: v.pipe(
    v.array(
      v.object({
        path: v.pipe(v.string(), v.description('Путь к полю')),
        message: v.pipe(v.string(), v.description('Описание проблемы')),
      }),
    ),
    v.description('Проблемы валидации'),
  ),
});

/** Базовые ошибки ядра: подмешиваются к `errors` каждого UC. */
export const CoreErrors = buildErrors('', {
  UNAUTHORIZED: {
    kind: 'unauthorized',
    label: 'Вызов не разрешён',
    description:
      'Вид вызывающего не входит в `callers` операции, или другой модуль вызвал UC, которого нет в `calls` его операции.',
    payload: v.object({
      callerKind: v.pipe(v.string(), v.description('Вид вызывающего')),
      from: v.optional(
        v.pipe(
          v.string(),
          v.description(
            'Операция другого модуля, не объявившая UC в `calls` (у `module`)',
          ),
        ),
      ),
    }),
  },
  INPUT_VALIDATION: {
    kind: 'validation',
    label: 'Некорректные данные',
    description: 'Вход операции не прошёл схему.',
    payload: Issues,
  },
  ACCESS_DENIED: {
    kind: 'access',
    label: 'Доступ запрещён',
    description: 'Политика отказала в действии.',
    payload: v.object({
      rule: v.pipe(v.string(), v.description('Отказавшее правило')),
      denyMessage: v.pipe(v.string(), v.description('Причина отказа')),
    }),
  },
  OUTPUT_VALIDATION: {
    kind: 'internal',
    label: 'Некорректный ответ',
    description: 'Выход операции не прошёл схему — баг реализации.',
    payload: Issues,
  },
  VERSION_CONFLICT: {
    kind: 'conflict',
    label: 'Данные изменились',
    description:
      'Запись изменили параллельно, пока шла операция; повторите её с актуальными данными.',
    payload: v.object({
      aggregate: v.pipe(v.string(), v.description('Агрегат')),
      uuid: v.pipe(v.string(), v.description('Идентификатор записи')),
    }),
  },
  SERVER_INTERNAL: {
    kind: 'internal',
    label: 'Внутренняя ошибка',
    description: 'Непредвиденный сбой; подробности — в логе.',
  },
});

export type CoreError = ReturnType<
  (typeof CoreErrors)[keyof typeof CoreErrors]['make']
>;
