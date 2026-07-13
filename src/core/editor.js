import { db } from '../config/db.js';
import { logger } from '../utils/logger.js';

/**
 * Editor Engine - Standardizes and protects all Telegram edits/replies
 */
export const EditorEngine = {
  /**
   * Safely edit the user's Anchor Message or fall back to sending a new one
   * @param {Object} ctx - Telegraf context
   * @param {Object} renderObj - Render object { text, photo, keyboard }
   * @param {Object} user - User document from DB
   * @returns {Promise<Object>} - The updated user object or message
   */
  editMessage: async (ctx, renderObj, user) => {
    const { text, photo, keyboard } = renderObj;
    const chatId = ctx.chat?.id || user.anchorChatId || ctx.from?.id;
    const messageId = user.anchorMessageId;

    const parseMode = 'HTML';
    const replyMarkup = keyboard ? keyboard.reply_markup : null;

    // Helper: Send a brand new message and save it as the Anchor
    const sendNewAnchor = async () => {
      let sentMsg;
      try {
        if (photo) {
          sentMsg = await ctx.telegram.sendPhoto(chatId, photo, {
            caption: text,
            parse_mode: parseMode,
            reply_markup: replyMarkup
          });
        } else {
          sentMsg = await ctx.telegram.sendMessage(chatId, text, {
            parse_mode: parseMode,
            reply_markup: replyMarkup,
            disable_web_page_preview: true
          });
        }
        
        logger.info(`New anchor message created: ${sentMsg.message_id} in chat ${chatId}`);
        
        // Update user's anchor in database
        return await db.updateUser(user.telegramId, {
          anchorMessageId: sentMsg.message_id,
          anchorChatId: chatId
        });
      } catch (err) {
        logger.error(`Failed to send new anchor message`, err);
        throw err;
      }
    };

    // If there is no existing anchor message, send a new one
    if (!messageId) {
      return await sendNewAnchor();
    }

    try {
      // If we are currently responding to an inline callback, we can edit the message directly
      if (ctx.callbackQuery && ctx.callbackQuery.message && ctx.callbackQuery.message.message_id === messageId) {
        if (photo) {
          // If message has photo, we must edit media
          try {
            await ctx.editMessageMedia({
              type: 'photo',
              media: photo,
              caption: text,
              parse_mode: parseMode
            }, {
              reply_markup: replyMarkup
            });
          } catch (mediaErr) {
            if (mediaErr.message && mediaErr.message.includes('message is not modified')) {
              return user;
            }
            logger.warn(`editMessageMedia failed, trying replacement`, mediaErr);
            throw mediaErr; // trigger outer fallback
          }
        } else {
          // Edit text message
          try {
            await ctx.editMessageText(text, {
              parse_mode: parseMode,
              reply_markup: replyMarkup,
              disable_web_page_preview: true
            });
          } catch (textErr) {
            if (textErr.message && textErr.message.includes('message is not modified')) {
              return user;
            }
            logger.warn(`editMessageText failed, trying replacement`, textErr);
            throw textErr;
          }
        }
        return user;
      } else {
        // Edit using ctx.telegram (for commands, messages, or webhooks)
        if (photo) {
          await ctx.telegram.editMessageMedia(chatId, messageId, null, {
            type: 'photo',
            media: photo,
            caption: text,
            parse_mode: parseMode
          }, {
            reply_markup: replyMarkup
          });
        } else {
          await ctx.telegram.editMessageText(chatId, messageId, null, text, {
            parse_mode: parseMode,
            reply_markup: replyMarkup,
            disable_web_page_preview: true
          });
        }
        return user;
      }
    } catch (error) {
      if (error.message && error.message.includes('message is not modified')) {
        return user;
      }

      logger.warn(`Safe edit failed for message ${messageId}: ${error.message}. Sending fallback message.`);
      
      try {
        await ctx.telegram.deleteMessage(chatId, messageId);
      } catch (delErr) {
        // Ignore deletion errors
      }

      return await sendNewAnchor();
    }
  }
};
