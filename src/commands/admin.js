import { NavigationEngine } from '../core/navigation.js';

export default {
  name: 'admin',
  execute: async (ctx, user) => {
    if (user.role !== 'admin') {
      return ctx.reply('⚠️ Anda tidak memiliki akses ke menu ini.');
    }
    
    const { db } = await import('../config/db.js');
    const updatedUser = await db.updateUser(user.telegramId, {
      anchorMessageId: null,
      currentPage: 'admin:dashboard',
      navigationHistory: []
    });

    await NavigationEngine.navigateTo(ctx, 'admin:dashboard', updatedUser, { pushToHistory: false });
  }
};
