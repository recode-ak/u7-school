import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { U7BotUiStory } from '@u7-scl/bot/u7-bot-ui-story';
import {
  type MdText,
  md,
  mdConcat,
  mdJoin,
  mdRaw,
  now,
} from '@u7-scl/core/shared';
import type { BotSession, DialogResponse } from '@u7-scl/core/ui';
import {
  GetStreamUcDef,
  GetStudentProgressUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import { buttons } from '../../shared/buttons';
import { formatProgressBar, getStudent } from '../shared';

/**
 * Прогресс студента (S06).
 * Показывает детальные персональные метрики прохождения потока.
 */
export class ProgressStory extends U7BotUiStory {
  readonly name = 'progress';

  async handleCallback(
    action: string,
    actor: U7BotActor,
    session: BotSession,
  ): Promise<DialogResponse> {
    if (action.startsWith('progress:')) {
      const streamId = action.split(':')[1];
      if (!streamId) {
        return this.unknownCommand(action, actor, session);
      }
      return this.#showProgress(actor, streamId);
    }
    return this.unknownCommand(action, actor, session);
  }

  async #showProgress(
    actor: U7BotActor,
    streamId: string,
  ): Promise<DialogResponse> {
    const studentResult = await getStudent(
      (command) => this.dispatchUc(StreamModuleDef, command, actor),
      actor,
    );
    if (!studentResult.ok) return studentResult.value;

    const student = studentResult.value;

    if (student.streamId !== streamId) {
      return this.screen(
        md`⚠️ Этот прогресс не соответствует вашему текущему потоку\\.`,
      );
    }

    const loaded = await this.dispatchUc(
      StreamModuleDef,
      GetStreamUcDef.command({ streamId }),
      actor,
    );
    if (!loaded.ok) return this.ucErrorNotify(loaded.error);
    const stream = loaded.value;

    const loadedProgress = await this.dispatchUc(
      StreamModuleDef,
      GetStudentProgressUcDef.command({ studentId: student.uuid }),
      actor,
    );
    if (!loadedProgress.ok) return this.ucErrorNotify(loadedProgress.error);
    const calc = loadedProgress.value.progress;
    if (!calc) return this.warn(md`Поток не найден`);
    const card = calc.card;
    const projectProgress = calc.projects;

    const lines: MdText[] = [
      md`📊 *Мой прогресс* — ${stream.title}`,
      md``,
      mdRaw('———'),
      md``,
      md`*Общий прогресс:*`,
      mdConcat(
        md`📊 Пройдено шагов: `,
        formatProgressBar(
          card.moduleProgress.completed,
          card.moduleProgress.total,
        ),
        md` \\| ${card.moduleProgress.percent}%`,
      ),
      md`📁 Проекты курса: ${projectProgress.completed} из ${projectProgress.total} завершено`,
    ];

    if (card.currentProject) {
      lines.push(
        md``,
        mdRaw('———'),
        md``,
        md`*Текущий этап:*`,
        md`📁 Проект: «${card.currentProject.title}»`,
      );
      if (card.currentLesson) {
        lines.push(md`📝 Урок: «${card.currentLesson.title}»`);
      }
      lines.push(
        mdConcat(
          md`📊 Прогресс по проекту: `,
          formatProgressBar(
            card.currentProject.progress.completed,
            card.currentProject.progress.total,
          ),
          md` \\| ${card.currentProject.progress.percent}%`,
        ),
      );
    }

    lines.push(md``, mdRaw('———'), md``, md`*Темп и усидчивость:*`);

    if (card.medianTimeMinutes !== null) {
      lines.push(md`⏱ Типичное время на шаг: ${card.medianTimeMinutes} мин\\.`);
    }

    const catDescs: Record<string, string> = {
      Бегун: '< 1 мин\\.',
      Спринтер: '< 5 мин\\.',
      Вдумчивый: '< 15 мин\\.',
      Исследователь: '\\> 15 мин\\.',
    };
    for (const c of card.timeCategories) {
      const desc = catDescs[c.name] ?? '';
      lines.push(
        mdConcat(
          md`${c.emoji} ${c.name} `,
          mdRaw(`\\(${desc}\\)`),
          md`: ${c.count} шаг\\(ов\\)`,
        ),
      );
    }

    if (student.enrolledAt) {
      const dateStr = this.formatDate(student.enrolledAt);
      const days = Math.max(
        1,
        Math.floor(
          (now().getTime() - student.enrolledAt) / (1000 * 60 * 60 * 24),
        ),
      );
      lines.push(
        md``,
        mdRaw('———'),
        md``,
        md`📅 В обучении: с ${dateStr} \\(${days} дн\\.\\)`,
      );
    }

    return this.screen(
      mdJoin(lines),
      this.kb([
        [this.btn('⬅️ Назад к учёбе', this.cbFor('hub', 'my-study'))],
        [buttons.mainMenu()],
      ]),
    );
  }
}
