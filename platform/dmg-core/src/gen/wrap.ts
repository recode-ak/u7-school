/**
 * Переносы строк шаблонов в форме biome (CODE-01): генератор пишет код,
 * который форматтер не правит, при любой длине имён. Варианты переноса
 * задаёт шаблон — здесь только выбор по ширине и список в скобках.
 */
import { LINE_WIDTH } from './import-order';

const fits = (text: string) =>
  text.split('\n').every((line) => line.length <= LINE_WIDTH);

/** Первый вариант, все строки которого влезают в ширину biome, иначе последний. */
export function fit(...variants: [string, ...string[]]): string {
  return variants.find(fits) ?? (variants.at(-1) as string);
}

type ListStyle = {
  /** Пробелы внутри скобок в одной строке (`{ a }`) */
  readonly space?: boolean;
  /** Запятая после последнего элемента в столбике; у типовых аргументов — нет */
  readonly comma?: boolean;
};

/**
 * Список в скобках (аргументы, параметры, объект, типовые аргументы): в
 * строку, если влезает, иначе по элементу на строку с отступом `pad + 2`.
 * `open` — до первого элемента (`f(`), `close` — после последнего (`);`).
 */
export function list(
  pad: string,
  open: string,
  items: readonly string[],
  close: string,
  { space = false, comma = true }: ListStyle = {},
): string {
  const gap = space ? ' ' : '';
  const column = items.map((item, i) =>
    i < items.length - 1 || comma ? `${pad}  ${item},` : `${pad}  ${item}`,
  );
  return fit(
    `${pad}${open}${gap}${items.join(', ')}${gap}${close}`,
    `${pad}${open}\n${column.join('\n')}\n${pad}${close}`,
  );
}
