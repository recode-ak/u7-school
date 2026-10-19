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
    description: 'Вид вызывающего не входит в `callers` операции.',
    payload: v.object({
      callerKind: v.pipe(v.string(), v.description('Вид вызывающего')),
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
  SERVER_INTERNAL: {
    kind: 'internal',
    label: 'Внутренняя ошибка',
    description: 'Непредвиденный сбой; подробности — в логе.',
  },
});

export type CoreError = ReturnType<
  (typeof CoreErrors)[keyof typeof CoreErrors]['make']
>;
