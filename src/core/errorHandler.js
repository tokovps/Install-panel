import { logger } from '../utils/logger.js';

export const ErrorHandler = {
  /**
   * Catches errors in bot middleware and logs them, failing gracefully
   */
  setup: (bot) => {
    bot.catch((err, ctx) => {
      logger.error(`Telegraf encountered an error for update ${ctx.update.update_id}`, err);
      try {
        ctx.reply('⚠️ Terjadi kesalahan internal pada sistem. Silakan coba kembali nanti atau hubungi Admin.');
      } catch (replyErr) {
        logger.error('Failed to send error message to user', replyErr);
      }
    });

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception occurred!', err);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at Promise', new Error(String(reason)));
    });
  }
};
