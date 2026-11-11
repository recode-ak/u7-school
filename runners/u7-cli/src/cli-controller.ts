import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import type { U7BotAppMeta } from '@u7-scl/app';
import type { ApiApp, UcDocType } from '@u7-scl/core/api';
import {
  GetUserUcDef,
  ListUsersUcDef,
  UserModuleDef,
  type UserView,
} from '@u7-scl/domain/user/contract';
import { type Command, GuestCaller } from 'dmg-core';
import { Trace } from 'dmg-core/app';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Узел внутренней структуры схемы Valibot (duck-typing) */
interface SchemaNode {
  type?: string;
  wrapped?: SchemaNode;
  item?: SchemaNode;
  options?: readonly string[];
  enum?: Record<string, string>;
  entries?: Record<string, SchemaNode>;
}

/** Схема-объект Valibot с полем entries */
interface ObjectSchemaLike {
  entries: Record<string, SchemaNode>;
}

function getTypeString(schemaProp: SchemaNode | undefined): string {
  if (!schemaProp) return 'unknown';

  if (schemaProp.type === 'optional' && schemaProp.wrapped) {
    return getTypeString(schemaProp.wrapped);
  }

  // handle valibot's pipe type
  if (schemaProp.type === 'pipe' && schemaProp.item) {
    return getTypeString(schemaProp.item);
  }

  let typeStr = schemaProp.type || 'unknown';

  if (typeStr === 'array') {
    if (schemaProp.item) {
      typeStr = `array<${getTypeString(schemaProp.item)}>`;
    } else {
      typeStr = 'array';
    }
  } else if (typeStr === 'picklist' && schemaProp.options) {
    typeStr = `picklist (${schemaProp.options.join(', ')})`;
  } else if (typeStr === 'enum' && schemaProp.enum) {
    typeStr = `enum (${Object.values(schemaProp.enum).join(', ')})`;
  }

  return typeStr;
}

function printSchemaPrompt(schema: ObjectSchemaLike | undefined) {
  if (!schema?.entries) return;
  console.log('\n```');
  for (const [key, prop] of Object.entries(schema.entries)) {
    const p = prop as SchemaNode;
    const isOptional = p.type === 'optional';
    const reqStr = isOptional ? '' : '*';

    const typeStr = getTypeString(p);
    console.log(`${key}${reqStr}: ${typeStr}`);
  }
  console.log('```');
  console.log('\n---');
  console.log('*: обязательные');
}

export class CliController {
  private currentActor: UserView | null = null;
  private rl: readline.Interface;

  constructor(private app: ApiApp<U7BotAppMeta>) {
    this.rl = readline.createInterface({ input, output });
  }

  async run() {
    // Load and check about files
    const appAboutPath = join(__dirname, '../about.md');
    if (!fs.existsSync(appAboutPath)) {
      throw new Error(
        `Файл about.md приложения не найден по пути: ${appAboutPath}`,
      );
    }
    const appAbout = fs.readFileSync(appAboutPath, 'utf-8');

    const moduleAbouts = new Map<string, string>();
    for (const mod of this.app.getModules()) {
      const modAboutPath = join(
        __dirname,
        '../../../modules',
        mod.name,
        'about.md',
      );
      if (!fs.existsSync(modAboutPath)) {
        throw new Error(
          `Модуль ${mod.name} не имеет файла about.md по пути: ${modAboutPath}`,
        );
      }
      moduleAbouts.set(mod.name, fs.readFileSync(modAboutPath, 'utf-8'));
    }

    console.log(appAbout);
    console.log('\n=== u7 CLI ===');
    console.log('Введите /app для справки\n');

    this.prompt();
    let buffer: string[] = [];
    let isBuffering = false;

    for await (const line of this.rl) {
      const text = line.trim();

      if (text === '/quit' || text === '/exit') {
        console.log('До свидания!');
        break;
      }

      if (!isBuffering) {
        if (!text) {
          this.prompt();
          continue;
        }

        if (text === '/app' || text === '/') {
          this.printHelp();
          this.prompt();
          continue;
        }

        if (text === '/modules') {
          this.printModules();
          this.prompt();
          continue;
        }

        if (text.startsWith('/about')) {
          const args = text.slice(6).trim();
          if (!args) {
            console.log(`\n--- О приложении ---\n`);
            console.log(appAbout);
          } else {
            const modAbout = moduleAbouts.get(args);
            if (modAbout) {
              console.log(`\n--- О модуле: ${args} ---\n`);
              console.log(modAbout);
            } else {
              console.log(
                `Модуль '${args}' не найден. Для списка введите /modules`,
              );
            }
          }
          this.prompt();
          continue;
        }

        if (text.startsWith('/login')) {
          const args = text.slice(6).trim();
          await this.handleLogin(args || undefined);
          this.prompt();
          continue;
        }

        if (text.startsWith('/logout')) {
          this.currentActor = null;
          console.log('Вы вышли из системы.');
          this.prompt();
          continue;
        }

        const parts = text.split('/').filter(Boolean);
        // Формат: /module/usecase (2 части)
        // В старой системе было /module/aggregate/usecase (3 части), но сейчас UC напрямую в модуле
        // Поддержим оба варианта для совместимости: если 2 части - module/uc, если 3 части - module/agg/uc

        let modName = '';
        let ucName = '';

        if (parts.length >= 2 && text.startsWith('/')) {
          modName = parts[0] as string;
          ucName = parts[parts.length - 1] as string;
          buffer.push(text);
          isBuffering = true;

          const mod = this.app.getModule(modName);
          const ucDoc = mod
            ?.getDocTypes()
            .find((d: UcDocType) => d.ucName === ucName);
          if (ucDoc?.inputSchema) {
            printSchemaPrompt(ucDoc.inputSchema as unknown as ObjectSchemaLike);
          }

          process.stdout.write('... ');
          continue;
        }

        console.log('Неизвестная команда. Введите /app для справки.');
        this.prompt();
      } else {
        // Режим буферизации данных
        if (text === '') {
          this.executeBuffer(buffer);
          buffer = [];
          isBuffering = false;
          this.prompt();
        } else {
          buffer.push(text);
          process.stdout.write('... ');
        }
      }
    }

    this.rl.close();
  }

  private prompt() {
    process.stdout.write('\n> ');
  }

  private printHelp() {
    console.log('\n--- Меню ---');
    console.log('- /modules  - Список модулей');
    console.log('- /about [m] - О приложении или модуле m');
    if (this.currentActor) {
      console.log(
        `- Активный пользователь: ${this.currentActor.name} (${this.currentActor.uuid})`,
      );
      console.log('- /logout   - Выйти');
    } else {
      console.log('- /login    - Войти в систему');
    }
  }

  private printModules() {
    const mods = this.app.getModules();
    console.log('\n--- Доступные модули ---');
    for (const mod of mods) {
      console.log(`\nМодуль /${mod.name} (описание: /about ${mod.name})`);
      for (const uc of mod.getDocTypes()) {
        console.log(
          `  /${mod.name}/${uc.arName ? `${uc.arName}/` : ''}${uc.ucName}`,
        );
      }
    }
  }

  /**
   * Legacy-UC нет: модули работают на DMG, UC вызывается по имени извне
   * (`scripts/call-uc.ts`).
   */
  private executeBuffer(buffer: string[]) {
    const commandPath = buffer[0]?.trim() || '';
    console.log(
      `Команда ${commandPath}: legacy-UC нет; вызов UC — \`bun run scripts/call-uc.ts\``,
    );
  }

  private async handleLogin(args?: string) {
    try {
      const users = await this.#dispatchUser(ListUsersUcDef.command({}));

      if (users.length === 0) {
        console.log('Нет пользователей. База пуста.');
        return;
      }

      if (!args) {
        console.log('Доступные пользователи:');
        for (const u of users) {
          console.log(`- ${u.name} (uuid: ${u.uuid}, tg: ${u.telegramId})`);
        }
        console.log('Введите /login <uuid> или /login tg: <telegramId>');
        return;
      }

      let targetUser = null;
      if (args.startsWith('tg:')) {
        const tg = Number(args.slice(3).trim());
        targetUser = users.find((u) => u.telegramId === tg);
      } else if (args.startsWith('name:')) {
        const namePart = args.slice(5).trim().toLowerCase();
        targetUser = users.find((u) => u.name.toLowerCase().includes(namePart));
      } else {
        targetUser = users.find((u) => u.uuid === args);
      }

      if (targetUser) {
        const fullUser = await this.#dispatchUser(
          GetUserUcDef.command({ uuid: targetUser.uuid }),
        );
        this.currentActor = fullUser;
        console.log(`Вход выполнен. Активный пользователь: ${fullUser.name}`);
      } else {
        console.log(`Пользователь ${args} не найден.`);
      }
    } catch (e: unknown) {
      console.error(
        'Ошибка при получении списка пользователей:',
        (e as Error).message,
      );
    }
  }

  /** Чтение модуля `user` от гостя: CLI не передаёт актора в запросы чтения. */
  async #dispatchUser<D extends (typeof UserModuleDef)['useCases'][number]>(
    command: Command<D>,
  ) {
    const trace = Trace.fromRequest({
      requestId: crypto.randomUUID(),
      channel: { name: 'cli' },
    });
    const res = await this.app.dispatch(
      UserModuleDef,
      command,
      new GuestCaller(),
      trace,
    );
    if (!res.ok) throw new Error(res.error.code);
    return res.value;
  }
}
