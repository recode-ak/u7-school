const BEGIN = '<!-- dmg-core:begin -->';
const END = '<!-- dmg-core:end -->';

/**
 * Вставка в файл инструкций агентов проекта (`AGENTS.md` и т. п.): ссылка
 * на индекс документации пакета. Живёт между метками begin/end, остальной
 * текст файла не трогается.
 */
export class InstructionsBlock {
  private static readonly pattern = new RegExp(
    `${BEGIN}\\n[\\s\\S]*?${END}\\n?`,
  );

  readonly text: string;

  constructor(version: string) {
    this.text = [
      BEGIN,
      '## Платформа dmg-core',
      '',
      `Модули пишутся на \`dmg-core@${version}\`. Индекс документации для LLM — \`node_modules/dmg-core/llms.txt\`; перед работой с модулем загрузи скил \`dmg-architecture\`.`,
      END,
      '',
    ].join('\n');
  }

  /** Текст файла с актуальным блоком: замена на месте или дописывание в конец */
  apply(text: string): string {
    if (InstructionsBlock.pattern.test(text)) {
      return text.replace(InstructionsBlock.pattern, this.text);
    }
    if (text.trim() === '') return this.text;
    return `${text.replace(/\n*$/, '')}\n\n${this.text}`;
  }

  /** В файле есть блок этой версии */
  isCurrent(text: string): boolean {
    return InstructionsBlock.pattern.exec(text)?.[0] === this.text;
  }
}
