import { db } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { EditorEngine } from './editor.js';
import { PageEngine } from './page.js';

export const NavigationEngine = {
  /**
   * Navigate to a target page
   * @param {Object} ctx - Telegraf context
   * @param {string} pageId - Target page ID
   * @param {Object} user - User document
   * @param {Object} options - Navigation options
   */
  navigateTo: async (ctx, pageId, user, options = {}) => {
    const { pushToHistory = true } = options;
    
    const page = PageEngine.getPage(pageId);
    if (!page) {
      logger.error(`Page not found: ${pageId}`);
      // Fallback to home
      if (pageId !== 'home') {
        return NavigationEngine.navigateTo(ctx, 'home', user, { pushToHistory: false });
      }
      return;
    }

    // Capture old page for history
    const oldPage = user.currentPage;
    let history = [...(user.navigationHistory || [])];

    if (pushToHistory && oldPage && oldPage !== pageId && oldPage !== 'home' && pageId !== 'home') {
      // Avoid duplicates in history
      if (history[history.length - 1] !== oldPage) {
        history.push(oldPage);
      }
    }

    // If navigating to home, clear history
    if (pageId === 'home') {
      history = [];
    }

    // Update user state first so render can use accurate navigation metadata
    const updatedUser = await db.updateUser(user.telegramId, {
      currentPage: pageId,
      navigationHistory: history
    });

    try {
      // Render the page
      const renderObj = await page.render(updatedUser);
      
      // Prepare options for Keyboard Engine
      const kbOptions = {
        currentPage: pageId,
        hasHistory: history.length > 0,
        cancelCallback: renderObj.cancelCallback || null
      };
      
      // Process keyboard using our Keyboard Engine
      if (renderObj.keyboard && typeof renderObj.keyboard.reply_markup === 'undefined') {
        const { Keyboard } = await import('./keyboard.js');
        renderObj.keyboard = Keyboard.create(renderObj.keyboard, kbOptions);
      }

      // Safe Edit standard message
      await EditorEngine.editMessage(ctx, renderObj, updatedUser);
    } catch (err) {
      logger.error(`Error rendering page: ${pageId}`, err);
      // Failsafe notification
      try {
        if (ctx && typeof ctx.reply === 'function') {
          await ctx.reply(`⚠️ Terjadi kesalahan saat memuat halaman ini. Silakan hubungi admin.`);
        }
      } catch (replyErr) {
        // Silently catch
      }
    }
  },

  /**
   * Navigate backward in history
   */
  goBack: async (ctx, user) => {
    const history = [...(user.navigationHistory || [])];
    if (history.length === 0) {
      return NavigationEngine.navigateTo(ctx, 'home', user, { pushToHistory: false });
    }

    const previousPage = history.pop();
    
    // Update user history in DB
    const updatedUser = await db.updateUser(user.telegramId, {
      navigationHistory: history
    });

    return NavigationEngine.navigateTo(ctx, previousPage, updatedUser, { pushToHistory: false });
  }
};
