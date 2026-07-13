import express from 'express';
import { Telegraf } from 'telegraf';
import { config } from './config/config.js';
import { logger } from './utils/logger.js';
import { connectDB, db } from './config/db.js';
import { PageEngine } from './core/page.js';
import { loadCommands } from './core/commandLoader.js';
import { CallbackRouter } from './core/callbackRouter.js';
import { ErrorHandler } from './core/errorHandler.js';
import { handleTextMessage } from './handlers/message.js';
import router from './routes/index.js';

const app = express();
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Global status states for Health Check
let botStatus = {
  initialized: false,
  username: null,
  error: 'Bot token not set or invalid.',
  dbConnected: false
};

export let botInstance = null;

/**
 * Retrieve current bot and DB connection status
 */
export function getBotStatus() {
  return {
    status: 'OK',
    bot: botStatus.initialized ? 'Online' : 'Offline',
    botUsername: botStatus.username,
    database: botStatus.dbConnected ? 'Connected' : 'Disconnected',
    error: botStatus.error
  };
}

/**
 * Lazy bot starter
 */
async function initTelegramBot(token) {
  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN') {
    const msg = 'BOT_TOKEN is missing or set to default placeholder. Bot is offline.';
    logger.warn(msg);
    botStatus.error = msg;
    botStatus.initialized = false;
    return null;
  }

  try {
    logger.info('Initializing Telegram Bot...');
    const bot = new Telegraf(token);
    
    // Register error handler
    ErrorHandler.setup(bot);

    // Register commands autoloader
    await loadCommands(bot);

    // Register Callback Router
    CallbackRouter.setup(bot);

    // Register incoming text message handler
    bot.on('message', async (ctx) => {
      await handleTextMessage(ctx);
    });

    // Start bot polling
    bot.launch();
    
    const botInfo = await bot.telegram.getMe();
    logger.info(`Telegram Bot successfully launched: @${botInfo.username}`);
    
    botInstance = bot;
    botStatus.initialized = true;
    botStatus.username = botInfo.username;
    botStatus.error = null;
    return bot;
  } catch (err) {
    logger.error('Failed to launch Telegraf Bot:', err);
    botStatus.error = `Failed to connect to Telegram: ${err.message}`;
    botStatus.initialized = false;
    botInstance = null;
    return null;
  }
}

/**
 * Start Express server and bot
 */
async function startServer() {
  // 1. Connect database (MongoDB)
  const isMongoConnected = await connectDB();
  
  if (isMongoConnected) {
    botStatus.dbConnected = true;

    // 2. Load Page Engine Pages
    await PageEngine.loadPages();

    // 3. Initiate Telegram Bot
    try {
      await initTelegramBot(config.telegramToken);
    } catch (err) {
      logger.error('Failed to initialize bot:', err);
    }
  } else {
    botStatus.dbConnected = false;
    botStatus.error = 'Database connection failed: MONGODB_URI is not set or invalid.';
    logger.warn('CRITICAL: MongoDB is not connected. Bot will remain offline.');
  }

  // 4. Mount API Routes
  app.use(router);

  // Bind and listen to correct port
  app.listen(config.port, '0.0.0.0', () => {
    logger.info(`Telegram Bot pure-backend server listening on http://0.0.0.0:${config.port}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

// Enable graceful stop
process.once('SIGINT', () => {
  if (botInstance) botInstance.stop('SIGINT');
  process.exit();
});
process.once('SIGTERM', () => {
  if (botInstance) botInstance.stop('SIGTERM');
  process.exit();
});
