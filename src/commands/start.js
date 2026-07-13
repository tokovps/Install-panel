import { NavigationEngine } from '../core/navigation.js';

export default {
  name: 'start',
  execute: async (ctx, user) => {
    // Clear user anchor message ID on start command to force a clean message
    const { db } = await import('../config/db.js');
    const updatedUser = await db.updateUser(user.telegramId, {
      anchorMessageId: null,
      currentPage: 'home',
      navigationHistory: []
    });
    
    await NavigationEngine.navigateTo(ctx, 'home', updatedUser, { pushToHistory: false });
  }
};
