import { ErrorDef } from 'dmg-core';
import * as v from 'valibot';

/**
 * Ошибки агрегата `student`. `label` — текст, который видит пользователь
 * (прежние тексты legacy-исключений); статус студента в него не входит —
 * `label` статичен.
 */
export const StudentErrors = ErrorDef.define('STUDENT', {
  NOT_FOUND: {
    kind: 'not_found',
    label: 'Студент не найден',
    description: 'Записи студента с таким идентификатором нет.',
  },
  ENROLLMENT_CLOSED: {
    kind: 'conflict',
    label: 'Набор на поток закрыт.',
    description: 'Зачислить можно только в поток, который находится в наборе.',
  },
  WRONG_ENROLLMENT_KEY: {
    kind: 'validation',
    label: 'Неверное кодовое слово',
    description: 'Для зачисления на поток введено не то кодовое слово.',
  },
  ALREADY_STUDYING: {
    kind: 'conflict',
    label: 'Вы уже проходите обучение в другом потоке',
    description: 'У пользователя уже есть живая запись студента.',
  },
  PREREQUISITE_NOT_PASSED: {
    kind: 'conflict',
    label: 'Сначала пройдите предыдущий модуль',
    description: 'Предыдущий модуль курса не пройден.',
    payload: v.object({
      moduleTitle: v.pipe(
        v.string(),
        v.description('Название модуля, который нужно пройти'),
      ),
    }),
  },
  NO_STEPS: {
    kind: 'conflict',
    label: 'В потоке нет доступных шагов',
    description: 'В снимке контента потока нет ни одного шага.',
  },
  STEP_NOT_IN_STREAM: {
    kind: 'validation',
    label: 'Шаг не найден в структуре потока',
    description: 'Шага нет в снимке контента потока.',
  },
  STEP_NOT_ISSUED: {
    kind: 'conflict',
    label: 'Нельзя завершить шаг: он не был выдан студенту.',
    description: 'Завершить можно только выданный студенту шаг.',
  },
  STEP_ALREADY_ISSUED: {
    kind: 'conflict',
    label: 'Шаг уже выдан этому студенту.',
    description: 'Один и тот же шаг студенту выдаётся один раз.',
  },
  NOT_ENROLLED: {
    kind: 'conflict',
    label: 'Нельзя активировать студента: он уже не только зачислен.',
    description: 'Активировать можно только зачисленного студента.',
  },
  NOT_STUDYING: {
    kind: 'conflict',
    label: 'Нельзя снять студента с учёбы: он уже не учится.',
    description: 'Снять с учёбы можно только зачисленного или учащегося.',
  },
  NOT_COMPLETABLE: {
    kind: 'conflict',
    label: 'Нельзя завершить студента: он не учится.',
    description: 'Исход можно указать только учащемуся или уже завершившему.',
  },
});
