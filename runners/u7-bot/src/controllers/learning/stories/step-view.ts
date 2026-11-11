import type { User } from '@u7-scl/app-legacy/domain';
import { U7BotUiStory } from '@u7-scl/bot/u7-bot-ui-story';
import { md, mdJoin } from '@u7-scl/core/shared';
import type {
  BotSession,
  DialogResponse,
  KbButton,
  KeyboardDescription,
} from '@u7-scl/core/ui';
import {
  type ContentSnapshot,
  CourseModuleDef,
  GetStepUcDef,
} from '@u7-scl/domain/course/contract';
import {
  CompleteStepUcDef,
  GetStreamUcDef,
  GetStudentProgressUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import { buttons } from '../../shared/buttons';
import {
  buildStepList,
  buildTransitionMessage,
  findLessonIdForStep,
  formatStepMessage,
  getCompletedStepsInOrder,
  getStudent,
  getStudentAndStream,
  type ProgressView,
  type StreamDispatch,
} from '../shared';

/**
 * Просмотр и прохождение шага (S05a).
 * Обрабатывает: продолжение, отметку о выполнении, просмотр пройденных шагов.
 *
 * Контракт «Диалог и Экран»: стори возвращает экраны (screen) — edit или
 * send решает транспорт (владеем экраном → edit на месте, drill-down
 * внутри стори не растит seq).
 */
export class StepViewStory extends U7BotUiStory {
  readonly name = 'step-view';

  async handleCallback(
    action: string,
    actor: User,
    session: BotSession,
  ): Promise<DialogResponse> {
    if (action === 'my-study:continue') {
      return this.#showCurrentStep(actor);
    }
    if (action.startsWith('complete:')) {
      return this.#handleComplete(action, actor);
    }
    if (action.startsWith('my-study:view:')) {
      const [, , streamId, stepId] = action.split(':');
      if (!streamId || !stepId) {
        return this.unknownCommand(action, actor, session);
      }
      return this.#showStepView(actor, streamId, stepId);
    }
    return this.unknownCommand(action, actor, session);
  }

  /** Команды модуля `stream` от имени актора — для хелперов раздела learning. */
  #dispatchFor(actor: User): StreamDispatch {
    return (command) => this.dispatchUc(StreamModuleDef, command, actor);
  }

  /**
   * Расчёты прогресса студента (`getStudentProgress`): шаг и урок — по
   * необходимости. Потока нет или отказ — `undefined`.
   */
  async #loadProgress(
    actor: User,
    input: { studentId: string; stepId?: string; lessonId?: string },
  ): Promise<ProgressView | undefined> {
    const res = await this.dispatchUc(
      StreamModuleDef,
      GetStudentProgressUcDef.command(input),
      actor,
    );
    return res.ok ? res.value.progress : undefined;
  }

  // ── Приватные методы: основной поток ──

  async #showCurrentStep(
    actor: User,
    _overrideStepId?: string,
  ): Promise<DialogResponse> {
    const studentResult = await getStudent(this.#dispatchFor(actor), actor);
    if (!studentResult.ok) return studentResult.value;

    const student = studentResult.value;

    if (student.outcome.category !== 'in_progress') {
      return this.screen(
        md`🎉 *Поздравляю\\!* Вы завершили обучение в потоке\\!`,
      );
    }

    const stepId = _overrideStepId ?? student.currentStepId;

    const loaded = await this.dispatchUc(
      StreamModuleDef,
      GetStreamUcDef.command({ streamId: student.streamId }),
      actor,
    );
    if (!loaded.ok) return this.ucErrorNotify(loaded.error);
    const stream = loaded.value;

    // Все шаги программы завершены, а итоговый статус ставит ментор —
    // показываем экран завершения потока вместо повторного рендера шага
    // (иначе повтор «Выполнено» даёт same-content edit и ошибку Telegram
    // «message is not modified»)
    const progress = await this.#loadProgress(actor, {
      studentId: student.uuid,
      stepId,
    });
    const module = progress?.module;
    if (module && module.total > 0 && module.completed >= module.total) {
      return this.#streamCompletedScreen();
    }

    return this.#buildStepView(
      stream,
      stepId,
      student.streamId,
      progress,
      actor,
    );
  }

  async #handleComplete(action: string, actor: User): Promise<DialogResponse> {
    const [, streamId, stepId] = action.split(':');
    if (!streamId || !stepId) {
      return this.unknownCommand(action, actor);
    }

    const studentResult = await getStudent(this.#dispatchFor(actor), actor);
    if (!studentResult.ok) return studentResult.value;

    const student = studentResult.value;

    if (student.streamId !== streamId) {
      return this.screen(
        md`⚠️ *Ошибка:* поток не соответствует вашему текущему обучению\\. Пожалуйста, используйте /start для обновления\\.`,
      );
    }

    const completed = await this.dispatchUc(
      StreamModuleDef,
      CompleteStepUcDef.command({ studentId: student.uuid, streamId, stepId }),
      actor,
    );
    if (!completed.ok) return this.ucErrorNotify(completed.error);
    const result = completed.value;

    if (result.level === 'already_completed') {
      // Шаг уже был завершён ранее — просто показываем актуальный текущий шаг
      return this.#showCurrentStep(actor, result.currentStepId);
    }

    if (result.level === 'stream') {
      return this.#streamCompletedScreen();
    }

    if (result.level === 'lesson' || result.level === 'project') {
      // Расчёты после завершения шага: completeStep мутирует и сохраняет новое состояние
      const progress = await this.#loadProgress(actor, {
        studentId: student.uuid,
        lessonId:
          result.level === 'lesson' ? result.completedLessonId : undefined,
      });
      return this.#announceTransition(result, streamId, progress, actor);
    }

    return this.#showCurrentStep(actor, result.currentStepId);
  }

  // ── Приватные методы: просмотр шага ──

  /** Просмотр завершённого шага с ◀️/▶️ навигацией. */
  async #showStepView(
    actor: User,
    streamId: string,
    stepId: string,
  ): Promise<DialogResponse> {
    const { student, stream } = await getStudentAndStream(
      this.#dispatchFor(actor),
      actor,
      async (id) => {
        const loaded = await this.dispatchUc(
          StreamModuleDef,
          GetStreamUcDef.command({ streamId: id }),
          actor,
        );
        return loaded.ok ? loaded.value : undefined;
      },
    );
    if (!student || !stream) {
      const studentResult = await getStudent(this.#dispatchFor(actor), actor);
      return studentResult.ok
        ? this.screen(md`⚠️ Поток не найден`)
        : studentResult.value;
    }

    if (student.streamId !== streamId) {
      return this.screen(
        md`⚠️ *Ошибка:* поток не соответствует вашему текущему обучению\\.`,
      );
    }

    const progress = await this.#loadProgress(actor, {
      studentId: student.uuid,
      stepId,
    });
    const resolved = progress?.step?.position;

    if (!resolved) {
      return this.screen(md`⚠️ Шаг не найден в программе потока\\.`);
    }

    const loaded = await this.dispatchUc(
      CourseModuleDef,
      GetStepUcDef.command({ stepId }),
      actor,
    );
    if (!loaded.ok) return this.ucErrorNotify(loaded.error);
    const step = loaded.value;

    const stepRecord = student.steps.find((s) => s.stepId === stepId);
    const isCompleted = stepRecord?.status === 'completed';

    // Основное сообщение шага
    const mainMessage = formatStepMessage(
      stream.title,
      resolved,
      step,
      progress?.step?.lessonProgress,
    );

    // Список шагов урока
    const lessonId = findLessonIdForStep(stream.contentSnapshot, stepId);
    const stepList = lessonId
      ? await buildStepList(
          (command) => this.dispatchUc(CourseModuleDef, command, actor),
          stream.contentSnapshot,
          lessonId,
          student,
        )
      : '';

    const fullText = stepList
      ? mdJoin([mainMessage, stepList], '\n\n')
      : mainMessage;

    // Кнопки
    const rows: KbButton[][] = [];

    if (isCompleted) {
      // ◀️/▶️ навигация
      const navRow: KbButton[] = [];
      const completedSteps = getCompletedStepsInOrder(student);
      const currentIdx = completedSteps.indexOf(stepId);
      const prevIndex = completedSteps[currentIdx - 1];
      const nextIndex = completedSteps[currentIdx + 1];

      if (currentIdx > 0 && prevIndex) {
        navRow.push(
          this.btn('◀️ Назад', this.cb('my-study:view', streamId, prevIndex)),
        );
      }
      if (currentIdx < completedSteps.length - 1 && nextIndex) {
        navRow.push(
          this.btn('▶️ Вперёд', this.cb('my-study:view', streamId, nextIndex)),
        );
      }
      if (navRow.length > 0) rows.push(navRow);

      rows.push([
        this.btn(
          '⬅️ Назад к уроку',
          lessonId
            ? this.cbFor('nav-tree', 'my-study:lesson', lessonId)
            : this.cbFor('nav-tree', 'my-study:lessons'),
        ),
      ]);
    } else {
      // Активный шаг
      rows.push([
        this.btn('✅ Выполнено', this.cb('complete', streamId, stepId)),
      ]);
    }

    rows.push([buttons.mainMenu()]);

    return this.screen(fullText, this.kb(rows));
  }

  // ── Приватные методы: сборка представления шага ──

  async #buildStepView(
    stream: { title: string; contentSnapshot: ContentSnapshot },
    stepId: string,
    streamId: string,
    progress: ProgressView | undefined,
    actor: User,
  ): Promise<DialogResponse> {
    const resolved = progress?.step?.position ?? null;

    const loaded = await this.dispatchUc(
      CourseModuleDef,
      GetStepUcDef.command({ stepId }),
      actor,
    );
    if (!loaded.ok) return this.ucErrorNotify(loaded.error);
    const message = formatStepMessage(
      stream.title,
      resolved,
      loaded.value,
      progress?.step?.lessonProgress,
    );
    const keyboard = this.#buildStepKeyboard(streamId, stepId);

    keyboard.rows.push([buttons.mainMenu()]);

    // Шаг выдаётся новым сообщением: пройденный шаг остаётся в истории,
    // у него снимается клавиатура (хлебные крошки), новый шаг — send.
    return { ...this.screen(message, keyboard), newMessage: true };
  }

  #buildStepKeyboard(streamId: string, stepId: string): KeyboardDescription {
    return this.kb([
      [this.btn('✅ Выполнено', this.cb('complete', streamId, stepId))],
    ]);
  }

  /** Экран S05c «Завершение потока». */
  #streamCompletedScreen(): DialogResponse {
    return {
      ...this.screen(
        md`🏆 *Поток полностью завершён\\!* Поздравляю с успешным окончанием обучения\\!`,
        this.kb([[buttons.mainMenu()]]),
      ),
      newMessage: true,
    };
  }

  // ── Приватные методы: переходы ──

  async #announceTransition(
    result: {
      level: 'lesson' | 'project';
      completedLessonId?: string;
      completedProjectId?: string;
      currentStepId?: string;
    },
    streamId: string,
    progress: ProgressView | undefined,
    actor: User,
  ): Promise<DialogResponse> {
    const loaded = await this.dispatchUc(
      StreamModuleDef,
      GetStreamUcDef.command({ streamId }),
      actor,
    );
    if (!loaded.ok) return this.ucErrorNotify(loaded.error);
    const stream = loaded.value;
    if (!progress) return this.#showCurrentStep(actor, result.currentStepId);

    const { messageText, buttonText } = buildTransitionMessage(
      result,
      stream,
      progress,
    );

    return {
      ...this.screen(
        messageText,
        this.kb([
          [this.btn(buttonText, this.cb('my-study:continue'))],
          [buttons.mainMenu()],
        ]),
      ),
      newMessage: true,
    };
  }
}
