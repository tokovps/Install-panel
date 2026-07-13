import { db } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { sessionStore } from '../store/session.js';
import { NavigationEngine } from './navigation.js';

export const AdminInputEngine = {
  /**
   * Processes text inputs for admin settings
   * @param {Object} ctx - Telegraf context
   * @param {Object} user - User document (must be admin)
   * @param {string} text - Message text
   * @returns {Promise<boolean>} - True if handled, false otherwise
   */
  handleText: async (ctx, user, text) => {
    if (user.role !== 'admin') return false;

    const telegramId = user.telegramId;
    const state = sessionStore.get(telegramId, 'state');
    if (!state) return false;

    const cleanText = text.trim();

    // A. Awaiting price for Pterodactyl
    if (state === 'awaiting_price_pterodactyl') {
      const price = parseInt(cleanText, 10);
      if (isNaN(price) || price < 0) {
        await ctx.reply('⚠️ Harga tidak valid! Masukkan angka yang benar.');
        return true;
      }
      
      await db.updateSettings({ 'prices.pterodactyl': price });
      sessionStore.clear(telegramId);
      await ctx.reply(`✅ Harga Install Pterodactyl berhasil diubah menjadi: Rp ${price}`);
      await NavigationEngine.navigateTo(ctx, 'admin:prices', user, { pushToHistory: false });
      return true;
    }

    // B. Awaiting price for MySQL
    if (state === 'awaiting_price_mysql') {
      const price = parseInt(cleanText, 10);
      if (isNaN(price) || price < 0) {
        await ctx.reply('⚠️ Harga tidak valid! Masukkan angka yang benar.');
        return true;
      }
      
      await db.updateSettings({ 'prices.mysql': price });
      sessionStore.clear(telegramId);
      await ctx.reply(`✅ Harga Install MySQL berhasil diubah menjadi: Rp ${price}`);
      await NavigationEngine.navigateTo(ctx, 'admin:prices', user, { pushToHistory: false });
      return true;
    }

    // C. Awaiting AutoGoPay API Key
    if (state === 'awaiting_gopay_apikey') {
      await db.updateSettings({ 'payment.autogopay.apiKey': cleanText });
      sessionStore.clear(telegramId);
      await ctx.reply(`✅ API Key AutoGoPay berhasil diperbarui.`);
      await NavigationEngine.navigateTo(ctx, 'admin:autogopay', user, { pushToHistory: false });
      return true;
    }

    // D. Awaiting AutoGoPay QRIS string
    if (state === 'awaiting_gopay_qris') {
      if (!cleanText.startsWith('000201')) {
        await ctx.reply('⚠️ String QRIS tidak valid! QRIS standar EMVCo harus diawali dengan <code>000201</code>. Silakan coba lagi.');
        return true;
      }
      
      await db.updateSettings({ 'payment.autogopay.qrisString': cleanText });
      sessionStore.clear(telegramId);
      await ctx.reply(`✅ QRIS Static String berhasil diperbarui.`);
      await NavigationEngine.navigateTo(ctx, 'admin:autogopay', user, { pushToHistory: false });
      return true;
    }

    // E. Awaiting AutoGoPay Webhook Path
    if (state === 'awaiting_gopay_webhook') {
      await db.updateSettings({ 'payment.autogopay.webhook': cleanText });
      sessionStore.clear(telegramId);
      await ctx.reply(`✅ Webhook URL AutoGoPay berhasil diperbarui.`);
      await NavigationEngine.navigateTo(ctx, 'admin:autogopay', user, { pushToHistory: false });
      return true;
    }

    // F. Awaiting Store Name
    if (state === 'awaiting_store_name') {
      await db.updateSettings({ 'bot.storeName': cleanText });
      sessionStore.clear(telegramId);
      await ctx.reply(`✅ Nama Toko berhasil diperbarui menjadi: <b>${cleanText}</b>`);
      await NavigationEngine.navigateTo(ctx, 'admin:settings', user, { pushToHistory: false });
      return true;
    }

    // G. Awaiting Maintenance Message
    if (state === 'awaiting_maint_msg') {
      await db.updateSettings({ 'bot.maintenanceMessage': cleanText });
      sessionStore.clear(telegramId);
      await ctx.reply(`✅ Pesan maintenance berhasil diperbarui.`);
      await NavigationEngine.navigateTo(ctx, 'admin:settings', user, { pushToHistory: false });
      return true;
    }

    // H. Awaiting Force Join Channel
    if (state === 'awaiting_force_join') {
      const channels = cleanText.split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0);
      
      await db.updateSettings({ 'bot.forceJoin': channels });
      sessionStore.clear(telegramId);
      await ctx.reply(`✅ Target Force Join berhasil diperbarui: ${channels.length > 0 ? channels.join(', ') : 'Tidak ada'}`);
      await NavigationEngine.navigateTo(ctx, 'admin:settings', user, { pushToHistory: false });
      return true;
    }

    // I. Awaiting Admin Contact
    if (state === 'awaiting_contact') {
      await db.updateSettings({ 'bot.contact': cleanText });
      sessionStore.clear(telegramId);
      await ctx.reply(`✅ Kontak Admin berhasil diperbarui.`);
      await NavigationEngine.navigateTo(ctx, 'admin:settings', user, { pushToHistory: false });
      return true;
    }

    // J. Awaiting Channel Updates
    if (state === 'awaiting_channel') {
      await db.updateSettings({ 'bot.channel': cleanText });
      sessionStore.clear(telegramId);
      await ctx.reply(`✅ Channel Update berhasil diperbarui.`);
      await NavigationEngine.navigateTo(ctx, 'admin:settings', user, { pushToHistory: false });
      return true;
    }

    // K. Awaiting broadcast message
    if (state === 'awaiting_broadcast_message') {
      if (cleanText.length === 0) {
        await ctx.reply('⚠️ Pesan broadcast tidak boleh kosong.');
        return true;
      }

      sessionStore.clear(telegramId);
      await ctx.reply('⏳ Memulai proses broadcast ke seluruh pengguna...');

      const users = await db.getAllUsers();
      let successCount = 0;
      let failCount = 0;

      for (const u of users) {
        try {
          await ctx.telegram.sendMessage(u.telegramId, `
📢 <b>PENGUMUMAN DARI ADMIN:</b>

${cleanText}
`, { parse_mode: 'HTML' });
          successCount++;
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (err) {
          failCount++;
          logger.warn(`Failed to send broadcast to user ${u.telegramId}: ${err.message}`);
        }
      }

      await ctx.reply(`✅ Broadcast selesai!\n• Sukses dikirim: ${successCount} user\n• Gagal: ${failCount} user`);
      await NavigationEngine.navigateTo(ctx, 'admin:dashboard', user, { pushToHistory: false });
      return true;
    }

    return false;
  }
};
