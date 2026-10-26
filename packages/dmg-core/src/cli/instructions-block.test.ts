import { describe, expect, test } from 'bun:test';
import { InstructionsBlock } from './instructions-block';

const block = new InstructionsBlock('1.2.3');

describe('InstructionsBlock', () => {
  test('блок ссылается на llms.txt пакета и несёт версию', () => {
    expect(block.text).toStartWith('<!-- dmg-core:begin -->\n');
    expect(block.text).toEndWith('<!-- dmg-core:end -->\n');
    expect(block.text).toContain('node_modules/dmg-core/llms.txt');
    expect(block.text).toContain('dmg-core@1.2.3');
  });

  test('пустой файл — только блок', () => {
    expect(block.apply('')).toBe(block.text);
  });

  test('блока нет — дописывается в конец через пустую строку', () => {
    expect(block.apply('# Правила\n\nТекст.\n')).toBe(
      `# Правила\n\nТекст.\n\n${block.text}`,
    );
  });

  test('блок есть — заменяется на месте, остальное не трогается', () => {
    const old = new InstructionsBlock('1.0.0').apply('# А\n');
    const text = `${old}\n# Б\n`;
    expect(block.apply(text)).toBe(`# А\n\n${block.text}\n# Б\n`);
  });

  test('apply идемпотентен; isCurrent — блок актуален', () => {
    const once = block.apply('# А\n');
    expect(block.apply(once)).toBe(once);
    expect(block.isCurrent(once)).toBe(true);
    expect(block.isCurrent('# А\n')).toBe(false);
    expect(block.isCurrent(new InstructionsBlock('1.0.0').apply(''))).toBe(
      false,
    );
  });
});
