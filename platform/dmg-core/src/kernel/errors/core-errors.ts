import * as v from 'valibot';
import { ErrorDef } from './error-def';

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
export const CoreErrors = ErrorDef.define('', {
  UNAUTHORIZED: {
    kind: 'unauthorized',
    label: 'Вызов не разрешён',
    description:
      'Вид вызывающего не входит в `callers` операции. Вызов UC другого модуля вне `calls` отсекает тип (D-43).',
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
  OPERATION_NOT_FOUND: {
    kind: 'not_found',
    label: 'Операция не найдена',
    description:
      'По адресу транспорта нет модуля или в модуле нет UC с именем из команды (D-49); обычно — расхождение версий клиента и сервиса.',
    payload: v.object({
      module: v.pipe(v.string(), v.description('Адрес модуля')),
      uc: v.pipe(v.string(), v.description('Имя UC из команды')),
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
