import { basename } from 'node:path';
import type { Marker } from './marker';

/** Среда агентов, под которую собирается копия роли */
export type AgentEnv = 'claude' | 'pi';

/** Формат копии роли: исходный (для сборщика проекта) или готовый для среды */
export type RoleFormat = 'neutral' | AgentEnv;

const TOOLS = {
  read: { claude: 'Read', pi: 'read' },
  edit: { claude: 'Edit', pi: 'edit' },
  write: { claude: 'Write', pi: 'write' },
  bash: { claude: 'Bash', pi: 'bash' },
  grep: { claude: 'Grep', pi: 'grep' },
  find: { claude: 'Glob', pi: 'find' },
} as const satisfies Record<string, Record<AgentEnv, string>>;

/** Нейтральное имя инструмента */
export type Tool = keyof typeof TOOLS;

const ENVS: readonly AgentEnv[] = ['claude', 'pi'];
const FIELDS = ['name', 'description', 'tools', 'model'];

/** Роль агента пакета (`agents/roles/<role>.md`, формат — `agents/README.md`) */
export class Role {
  private constructor(
    readonly name: string,
    readonly description: string,
    readonly tools: Tool[],
    readonly model: Partial<Record<AgentEnv, string>>,
    readonly body: string,
    private readonly source: string,
  ) {}

  /** Разбирает файл роли; бросает Error с путём при нарушении формата */
  static parse(path: string, text: string): Role {
    const fail = (message: string): never => {
      throw new Error(`${path}: ${message}`);
    };
    const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
    if (!match) return fail('нет frontmatter');
    const fm = Bun.YAML.parse(match[1] ?? '');
    if (typeof fm !== 'object' || fm === null || Array.isArray(fm)) {
      return fail('frontmatter должен быть объектом');
    }
    const data = fm as Record<string, unknown>;

    for (const key of Object.keys(data)) {
      if (!FIELDS.includes(key)) fail(`неизвестное поле «${key}»`);
    }
    const name = basename(path, '.md');
    if (data.name !== name) {
      fail(`name «${String(data.name)}» не совпадает с именем файла`);
    }
    if (typeof data.description !== 'string' || data.description === '') {
      fail('нужен description');
    }
    if (!Array.isArray(data.tools) || data.tools.length === 0) {
      fail('нужен непустой список tools');
    }
    const tools = (data.tools as unknown[]).map((tool) =>
      typeof tool === 'string' && tool in TOOLS
        ? (tool as Tool)
        : fail(`неизвестный инструмент «${String(tool)}»`),
    );

    const model: Partial<Record<AgentEnv, string>> = {};
    if (data.model !== undefined) {
      if (typeof data.model !== 'object' || data.model === null) {
        fail('model должен быть объектом { claude?, pi? }');
      }
      for (const [env, value] of Object.entries(data.model as object)) {
        if (!(ENVS as readonly string[]).includes(env)) {
          fail(`неизвестная среда модели «${env}»`);
        }
        if (typeof value !== 'string') fail(`model.${env} должен быть строкой`);
        model[env as AgentEnv] = value as string;
      }
    }

    return new Role(
      name,
      data.description as string,
      tools,
      model,
      (match[2] ?? '').trim(),
      text,
    );
  }

  /**
   * Текст копии роли. neutral — исходник с меткой (общий блок доставляется
   * отдельным файлом); claude / pi — готовая роль среды с общим блоком в конце.
   */
  render(format: RoleFormat, marker: Marker, common = ''): string {
    if (format === 'neutral') return marker.mark(this.source);
    const lines = [
      '---',
      `name: ${this.name}`,
      `description: ${JSON.stringify(this.description)}`,
      `tools: ${this.tools.map((tool) => TOOLS[tool][format]).join(', ')}`,
    ];
    const model = this.model[format];
    if (model) lines.push(`model: ${model}`);
    lines.push('---', '', marker.comment, '', this.body, '');
    if (common.trim()) lines.push(common.trim(), '');
    return lines.join('\n');
  }
}
