import { describe, expect, test } from 'bun:test';
import type { BotSession, DialogResponse } from '@u7-scl/core/ui';
import { QuestionnaireEvents } from '@u7-scl/domain/questionnaire/contract';
import { userActor } from '../../../core/user-actor.test-kit';
import { FillStory } from './fill.story';
import { InviteStory } from './invite.story';
import { initStory, invitedView } from './questionnaire-dmg.test-kit';

/**
 * Реестр кодов кнопок анкетных стори на контракте «Диалог и Экран»
 * (DialogResponse): формы `fill:answer:{qId}:{aCode}`, `fill:next:{qId}:{qCode}`
 * и коды invite-экранов, плюс сторожа состава подписок стори. Тексты кнопок и
 * экранов держат поведенческие тесты стори.
 *
 * Коды кнопок в ответах стори — без префикса контроллера (префиксует
 * контроллер); в проактивном invite-канале (подписки) — полные коды
 * `questionnaire:…` (транспорт проактивы не префиксует).
 */

// ══ Хелперы ══

const actor = userActor({
  uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  roles: ['GUEST'],
});

/** Сессия активного fill-диалога (ожидание ввода с анкетой). */
function fillSession(qId = 'q-1'): BotSession {
  return {
    dialog: {
      path: 'questionnaire/fill',
      seq: 3,
      input: { context: { questionnaireId: qId } },
    },
  };
}

/** Одиночный выбор: три варианта. */
const radioQuestion = {
  questionCode: 'qc1',
  type: 'choice' as const,
  multiple: false,
  question: 'Какой у тебя опыт?',
  answers: [
    { answer: 'Новичок', answerCode: 'novice' },
    { answer: 'Средний', answerCode: 'mid' },
    { answer: 'Senior', answerCode: 'senior' },
  ],
};

/** Множественный выбор: два варианта. */
const multiQuestion = {
  questionCode: 'qc1',
  type: 'choice' as const,
  multiple: true,
  question: 'Что интересно?',
  answers: [
    { answer: 'Фронтенд', answerCode: 'fe' },
    { answer: 'Бэкенд', answerCode: 'be' },
  ],
};

/** Текстовый вопрос. */
const textQuestion = {
  questionCode: 'qc2',
  type: 'text' as const,
  question: 'Расскажи о себе',
};

/** Плоский список [текст, код] всех кнопок ответа. */
function flatButtons(res: DialogResponse): Array<[string, string]> {
  return (res.screen?.keyboard?.rows ?? []).flat().map((b) => [b.text, b.code]);
}

// ══ FillStory — инвентаризация экранов ══

describe('Инвентаризация FillStory', () => {
  test('S02a single: кнопки-варианты в одном ряду, коды fill:answer:{qId}:{aCode}', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        getCurrent: () => ({
          type: 'new_question',
          questionnaireId: 'q-1',
          question: radioQuestion,
          questionIndex: 1,
          poolSize: 3,
        }),
      },
    });

    const res = await story.handleCallback('current:q-1', actor, fillSession());

    expect(flatButtons(res)).toEqual([
      ['1', 'fill:answer:q-1:novice'],
      ['2', 'fill:answer:q-1:mid'],
      ['3', 'fill:answer:q-1:senior'],
    ]);
    expect(res.screen?.keyboard?.isMultiple).toBe(false);
  });

  test('S02b multiple: варианты + «Далее -->» отдельным рядом, код fill:next:{qId}:{qCode}', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        handleAction: () => ({
          type: 'wait_next',
          questionnaireId: 'q-1',
          currentQuestion: multiQuestion,
          selectedAnswers: ['fe'],
          nextButton: 'next:qc1',
        }),
      },
    });

    const res = await story.handleCallback(
      'answer:q-1:be',
      actor,
      fillSession(),
    );

    expect(
      res.screen?.keyboard?.rows.map((r) => r.map((b) => [b.text, b.code])),
    ).toEqual([
      [
        ['1', 'fill:answer:q-1:fe'],
        ['2', 'fill:answer:q-1:be'],
      ],
      [['Далее -->', 'fill:next:q-1:qc1']],
    ]);
    expect(res.screen?.keyboard?.isMultiple).toBe(true);
  });

  test('S03 text: без клавиатуры, подсказка «Введите ваш ответ текстом...»', async () => {
    const { story } = initStory(new FillStory(), {
      answers: {
        getCurrent: () => ({
          type: 'new_question',
          questionnaireId: 'q-1',
          question: textQuestion,
          questionIndex: 2,
          poolSize: 3,
        }),
      },
    });

    const res = await story.handleCallback('current:q-1', actor, fillSession());

    expect(res.screen?.keyboard).toBeUndefined();
    expect(String(res.screen?.text)).toContain('Введите ваш ответ текстом');
  });
});

// ══ InviteStory — инвентаризация экранов ══

describe('Инвентаризация InviteStory', () => {
  test('подписка InviteStory — только invited', () => {
    const { story } = initStory(new InviteStory());

    expect(story.getEventSubscriptions().map((s) => s.def.name)).toEqual([
      QuestionnaireEvents.invited.name,
    ]);
  });

  test('invite:why:{qId}: кнопка «✅ Хорошо» → invite:invite', async () => {
    const { story } = initStory(new InviteStory(), {
      answers: {
        getCurrent: () =>
          invitedView({ questionnaireId: 'q1', whyText: 'Для обучения' }),
      },
    });

    const res = await story.handleCallback('why:q1', actor, fillSession());

    expect(flatButtons(res)).toEqual([['✅ Хорошо', 'invite:invite:q1']]);
  });

  test('invite:invite:{qId}: кнопки start/why/decline', async () => {
    const { story } = initStory(new InviteStory(), {
      answers: {
        getCurrent: () =>
          invitedView({
            questionnaireId: 'q1',
            inviteText: 'Заполните анкету',
            whyText: 'Для обучения',
          }),
      },
    });

    const res = await story.handleCallback('invite:q1', actor, fillSession());

    expect(flatButtons(res)).toEqual([
      ['▶️ Начать заполнение', 'invite:start:q1'],
      ['❔ Зачем это нужно?', 'invite:why:q1'],
      ['⏭️ Пропустить', 'invite:decline:q1'],
    ]);
  });

  test('invite:decline:{qId} (S06a): confirm-кнопки пропуска', async () => {
    const { story } = initStory(new InviteStory(), {
      answers: {
        getCurrent: () =>
          invitedView({
            questionnaireId: 'q1',
            cancelWarning: 'Придётся заполнять с начала.',
          }),
      },
    });

    const res = await story.handleCallback('decline:q1', actor, fillSession());

    expect(flatButtons(res)).toEqual([
      ['✅ Да, пропустить', 'invite:decline-confirm:q1'],
      ['❌ Нет, вернуться', 'invite:invite:q1'],
    ]);
  });
});
