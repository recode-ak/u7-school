import * as v from 'valibot';

/** Условие показа вопроса */
export const ConditionSchema = v.object({
  questionCode: v.pipe(
    v.string(),
    v.nonEmpty('Код вопроса в условии не может быть пустым'),
    v.description('Код вопроса, от ответа на который зависит показ'),
  ),
  answerCodes: v.pipe(
    v.array(v.pipe(v.string(), v.nonEmpty('Код ответа не может быть пустым'))),
    v.minLength(1, 'answerCodes должен содержать хотя бы один элемент'),
    v.description('Коды ответов, при любом из которых вопрос показывается'),
  ),
});

export type Condition = v.InferOutput<typeof ConditionSchema>;

/** Вариант ответа (для choice-вопросов) */
export const AnswerOptionSchema = v.object({
  answer: v.pipe(
    v.string(),
    v.nonEmpty('Текст ответа не может быть пустым'),
    v.description('Текст варианта ответа'),
  ),
  answerCode: v.pipe(
    v.string(),
    v.nonEmpty('Код ответа не может быть пустым'),
    v.description('Код варианта ответа'),
  ),
});

export type AnswerOption = v.InferOutput<typeof AnswerOptionSchema>;

/** Вопрос с выбором ответа */
export const ChoiceQuestionSchema = v.object({
  question: v.pipe(
    v.string(),
    v.nonEmpty('Текст вопроса не может быть пустым'),
    v.description('Текст вопроса'),
  ),
  questionCode: v.pipe(
    v.string(),
    v.nonEmpty('Код вопроса не может быть пустым'),
    v.description('Код вопроса: уникален в пуле, на него ссылаются условия'),
  ),
  type: v.pipe(v.literal('choice'), v.description('Вид вопроса: с выбором')),
  multiple: v.pipe(
    v.boolean(),
    v.description('Можно выбрать несколько вариантов'),
  ),
  condition: v.optional(
    v.pipe(
      ConditionSchema,
      v.description('Условие показа; без него вопрос показывается всегда'),
    ),
  ),
  answers: v.pipe(
    v.array(AnswerOptionSchema),
    v.minLength(1, 'Вопрос с выбором должен иметь хотя бы один вариант ответа'),
    v.description('Варианты ответа'),
  ),
});

export type ChoiceQuestion = v.InferOutput<typeof ChoiceQuestionSchema>;

/** Текстовый вопрос (свободный ввод) */
export const TextQuestionSchema = v.object({
  question: v.pipe(
    v.string(),
    v.nonEmpty('Текст вопроса не может быть пустым'),
    v.description('Текст вопроса'),
  ),
  questionCode: v.pipe(
    v.string(),
    v.nonEmpty('Код вопроса не может быть пустым'),
    v.description('Код вопроса: уникален в пуле, на него ссылаются условия'),
  ),
  type: v.pipe(v.literal('text'), v.description('Вид вопроса: свободный ввод')),
  condition: v.optional(
    v.pipe(
      ConditionSchema,
      v.description('Условие показа; без него вопрос показывается всегда'),
    ),
  ),
});

export type TextQuestion = v.InferOutput<typeof TextQuestionSchema>;

/** Объединённая схема вопроса */
export const QuestionSchema = v.variant('type', [
  ChoiceQuestionSchema,
  TextQuestionSchema,
]);

export type Question = v.InferOutput<typeof QuestionSchema>;

// ── QuestionnairePool ──

/** Схема пула анкеты */
export const QuestionnairePoolSchema = v.object({
  inviteText: v.optional(
    v.pipe(v.string(), v.description('Текст приглашения к анкете')),
  ),
  whyText: v.optional(
    v.pipe(v.string(), v.description('Зачем анкета — пояснение респонденту')),
  ),
  completionText: v.optional(
    v.pipe(v.string(), v.description('Текст после завершения анкеты')),
  ),
  cancelWarning: v.optional(
    v.pipe(v.string(), v.description('Предупреждение при отмене анкеты')),
  ),
  questions: v.pipe(
    v.array(QuestionSchema),
    v.minLength(1, 'Пул должен содержать хотя бы один вопрос'),
    v.description('Вопросы анкеты в порядке показа'),
  ),
});

/** Пул анкеты — метаданные + вопросы */
export type QuestionnairePool = v.InferOutput<typeof QuestionnairePoolSchema>;
