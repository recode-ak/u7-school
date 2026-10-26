/**
 * Метка копии, доставленной `dmg-core sync`: по ней CLI узнаёт свои файлы
 * и их версию. Ставится после frontmatter (или в начало файла без него).
 */
export class Marker {
  private static readonly pattern =
    /<!-- dmg-core@(\S+): сгенерировано `dmg-core sync` — не править -->\n\n/;
  private static readonly frontmatter = /^---\n[\s\S]*?\n---\n\n?/;

  readonly comment: string;

  constructor(readonly version: string) {
    this.comment = `<!-- dmg-core@${version}: сгенерировано \`dmg-core sync\` — не править -->`;
  }

  /** Версия пакета из метки; undefined — файл не сгенерирован */
  static versionOf(text: string): string | undefined {
    return Marker.pattern.exec(text)?.[1];
  }

  /** Текст без метки — исходник, из которого сделана копия */
  static strip(text: string): string {
    return text.replace(Marker.pattern, '');
  }

  /** Текст с меткой этой версии */
  mark(text: string): string {
    const head = Marker.frontmatter.exec(text)?.[0] ?? '';
    return `${head}${this.comment}\n\n${text.slice(head.length)}`;
  }
}
