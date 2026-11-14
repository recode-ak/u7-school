import type { DialogResponse } from '@u7-scl/core/ui';

/** Кнопка клавиатуры экрана. */
export type Button = {
  text: string;
  code: string;
  url?: string;
};

/** Экран ответа бота глазами теста: плоский список кнопок экрана `DialogResponse`. */
export class Screen {
  private constructor(private readonly response: DialogResponse) {}

  static of(response: DialogResponse): Screen {
    return new Screen(response);
  }

  buttons(): Button[] {
    return this.response.screen?.keyboard?.rows.flat() ?? [];
  }

  texts(): string[] {
    return this.buttons().map((b) => b.text);
  }

  codes(): string[] {
    return this.buttons().map((b) => b.code);
  }

  /** Первая кнопка, текст которой содержит фрагмент. */
  button(textContains: string): Button {
    const found = this.buttons().find((b) => b.text.includes(textContains));
    if (!found) {
      throw new Error(
        `Кнопка «${textContains}» не найдена среди: ${this.texts().join(' | ')}`,
      );
    }
    return found;
  }
}
