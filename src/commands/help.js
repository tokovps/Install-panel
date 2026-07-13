import { NavigationEngine } from '../core/navigation.js';

export default {
  name: 'help',
  execute: async (ctx, user) => {
    const { db } = await import('../config/db.js');
    const updatedUser = await db.updateUser(user.telegramId, {
      anchorMessageId: null,
      currentPage: 'help',
      navigationHistory: []
    });
    
    await NavigationEngine.navigateTo(ctx, 'help', updatedUser, { pushToHistory: false });
  }
};
