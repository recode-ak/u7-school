import type { ReadonlyAr } from 'dmg-core';
import type { StreamAr } from './stream/stream.ar';
import type { StudentAr } from './student/student.ar';

/**
 * DQS «какие модули прошёл студент»: модули потоков, записи на которые
 * завершились `advanced` (`not_advanced` не «прошёл»). Условие «пройден»
 * остаётся там, где было: запись студента + её поток; сравнения с программой
 * курса здесь нет — вердикт допуска считает курс (D-65). Только читает.
 */
export class PassedModulesDqs {
  constructor(
    private readonly students: readonly ReadonlyAr<StudentAr>[],
    private readonly streams: readonly ReadonlyAr<StreamAr>[],
  ) {}

  /**
   * Модули пройденных потоков без повторов: два прохождения одного модуля —
   * один элемент. Запись без своего потока среди переданных пропускается.
   */
  moduleIds(): string[] {
    const passed = this.students
      .filter((student) => student.isPassed())
      .flatMap((student) => {
        const stream = this.streams.find((candidate) =>
          student.belongsToStream(candidate.uuid),
        );
        return stream === undefined ? [] : [stream.moduleId()];
      });
    return [...new Set(passed)];
  }
}
