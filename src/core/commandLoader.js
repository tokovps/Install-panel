import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { db } from '../config/db.js';

/**
 * Autoloader for Telegram Bot Commands
 */
export async function loadCommands(bot) {
  const commandsDir = path.join(process.cwd(), 'src', 'commands');
  
  if (!fs.existsSync(commandsDir)) {
    fs.mkdirSync(commandsDir, { recursive: true });
  }

  const files = fs.readdirSync(commandsDir);
  for (const file of files) {
    if (file.endsWith('.js')) {
      try {
        const filePath = path.join(commandsDir, file);
        const module = await import(`file://${filePath}`);
        const command = module.default || module;
        
        if (command && command.name && typeof command.execute === 'function') {
          // Register command with Telegraf
          if (command.name === 'start') {
            bot.start(async (ctx) => {
              const user = await db.getUser(ctx.from.id);
              if (ctx.from.username) {
                await db.updateUser(ctx.from.id, { username: ctx.from.username });
              }
              await command.execute(ctx, user);
            });
          } else {
            bot.command(command.name, async (ctx) => {
              const user = await db.getUser(ctx.from.id);
              if (ctx.from.username) {
                await db.updateUser(ctx.from.id, { username: ctx.from.username });
              }
              await command.execute(ctx, user);
            });
          }
          logger.info(`Loaded command: /${command.name} (${file})`);
        } else {
          logger.warn(`Skipping invalid command file: ${file}`);
        }
      } catch (err) {
        logger.error(`Error loading command ${file}`, err);
      }
    }
  }
}
